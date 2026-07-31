import { useState, useRef, useEffect, useCallback } from 'react';
import {
  File as FileIcon, X, Send, Loader2,
  CheckCircle2, Printer, Wifi, WifiOff, FolderOpen, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSendDocument } from '@workspace/api-client-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type SseStatus = 'connecting' | 'connected' | 'error';
type PendingScan = { id: number; name: string; file: File; sending: boolean; sent: boolean };

const SCAN_EXTS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff']);
const SENT_KEY  = 'docscan_sent_files';

const hasFsApi = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const loadSentFiles = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]')); }
  catch { return new Set(); }
};
const saveSentFiles = (s: Set<string>) => {
  // cap at 500 entries to avoid unbounded growth
  const arr = [...s].slice(-500);
  localStorage.setItem(SENT_KEY, JSON.stringify(arr));
};

export default function Upload() {
  // ── SSE (Scan-to-URL push) ───────────────────────────────────────────────
  const [sseStatus, setSseStatus]         = useState<SseStatus>('connecting');
  const [scannedDocId, setScannedDocId]   = useState<number | null>(null);
  const [scannedFileName, setScannedFileName] = useState('');
  const [scannerDocReady, setScannerDocReady] = useState(false);
  const [scanSending, setScanSending]     = useState(false);
  const [scanSuccess, setScanSuccess]     = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // ── Folder watch ─────────────────────────────────────────────────────────
  const [folderWatching, setFolderWatching] = useState(false);
  const [folderName, setFolderName]         = useState('');
  const [pendingScans, setPendingScans]     = useState<PendingScan[]>([]);
  const folderHandle    = useRef<FileSystemDirectoryHandle | null>(null);
  const seenFiles       = useRef<Set<string>>(new Set());   // all files touched this session
  const sentFiles       = useRef<Set<string>>(loadSentFiles()); // persisted across sessions
  const watchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Config ───────────────────────────────────────────────────────────────
  const [watchPath, setWatchPath]     = useState('');
  const [autoDispatch, setAutoDispatch] = useState(false);

  const { toast }      = useToast();
  const sendMutation   = useSendDocument();

  // Load scanner config (accessible to all authenticated users)
  useEffect(() => {
    const token = localStorage.getItem('docscan_token') ?? '';
    fetch(`${import.meta.env.BASE_URL}api/scanner/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) { setWatchPath(d.scannerWatchPath ?? ''); setAutoDispatch(d.scannerAutoDispatch ?? false); }
      })
      .catch(() => {});
  }, []);

  // Keep global auto-dispatch flag in sync (read in SSE closure to avoid stale value)
  useEffect(() => { (window as any).__docScanAutoDispatch = autoDispatch; }, [autoDispatch]);

  // ── SSE lifecycle ────────────────────────────────────────────────────────
  const connectSse = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    const token = localStorage.getItem('docscan_token') ?? '';
    const url   = `${import.meta.env.BASE_URL}api/scanner/events?token=${encodeURIComponent(token)}`;
    const es    = new EventSource(url);
    esRef.current = es;

    es.onopen  = () => setSseStatus('connected');
    es.onerror = () => setSseStatus('error');

    es.addEventListener('scan', (e) => {
      try {
        const data = JSON.parse(e.data) as { docId: number; fileName: string };
        // Guard: skip if this doc was already dispatched
        if (sentFiles.current.has(`sse:${data.docId}`)) return;
        setScannedDocId(data.docId);
        setScannedFileName(data.fileName);
        setScannerDocReady(true);
        const auto = (window as any).__docScanAutoDispatch ?? false;
        if (auto) {
          toast({ title: '⚡ Auto-dispatching…', description: data.fileName });
          sendMutation.mutate({ id: data.docId }, {
            onSuccess: () => {
              sentFiles.current.add(`sse:${data.docId}`);
              saveSentFiles(sentFiles.current);
              toast({ title: '✅ Dispatched', description: `${data.fileName} sent automatically.` });
              setScannerDocReady(false); setScannedDocId(null);
            },
          });
        } else {
          toast({ title: 'Document received', description: `Scanner delivered: ${data.fileName}` });
        }
      } catch {}
    });

    return es;
  }, [toast]);

  useEffect(() => { const es = connectSse(); return () => es.close(); }, [connectSse]);

  // ── Folder polling ───────────────────────────────────────────────────────
  const dispatchLocalFile = useCallback(async (id: number, name: string, file: File) => {
    setPendingScans((p) => p.map((s) => s.id === id ? { ...s, sending: true } : s));
    try {
      const fd    = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('docscan_token');
      const res   = await fetch(`${import.meta.env.BASE_URL}api/documents/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      const doc = await res.json();
      sendMutation.mutate({ id: doc.id }, {
        onSuccess: () => {
          sentFiles.current.add(name);
          saveSentFiles(sentFiles.current);
          setPendingScans((p) => p.map((s) => s.id === id ? { ...s, sending: false, sent: true } : s));
          toast({ title: '✅ Dispatched', description: `${name} sent to all recipients.` });
          setTimeout(() => setPendingScans((p) => p.filter((s) => s.id !== id)), 4000);
        },
        onError: (err: any) => {
          setPendingScans((p) => p.map((s) => s.id === id ? { ...s, sending: false } : s));
          toast({ title: 'Dispatch Failed', description: err?.data?.error ?? 'Failed.', variant: 'destructive' });
        },
      });
    } catch {
      setPendingScans((p) => p.map((s) => s.id === id ? { ...s, sending: false } : s));
      toast({ title: 'Upload Error', description: 'Failed to upload file.', variant: 'destructive' });
    }
  }, [sendMutation, toast]);

  const pollFolder = useCallback(async () => {
    if (!folderHandle.current) return;
    try {
      // @ts-ignore — File System Access API async iteration
      for await (const [name, handle] of folderHandle.current) {
        if (handle.kind !== 'file') continue;
        const ext = name.split('.').pop()?.toLowerCase() ?? '';
        if (!SCAN_EXTS.has(ext)) continue;
        if (seenFiles.current.has(name)) continue;   // already queued/processed this session
        if (sentFiles.current.has(name)) {            // already dispatched in a prior session
          seenFiles.current.add(name);
          continue;
        }
        seenFiles.current.add(name);
        await new Promise((r) => setTimeout(r, 600)); // let scanner finish writing
        try {
          const f: File = await (handle as FileSystemFileHandle).getFile();
          if (f.size === 0) { seenFiles.current.delete(name); continue; }
          const id  = Date.now() + Math.random();
          const auto = (window as any).__docScanAutoDispatch ?? false;
          setPendingScans((p) => [...p, { id, name, file: f, sending: false, sent: false }]);
          if (auto) {
            toast({ title: '⚡ Auto-dispatching…', description: name });
            setTimeout(() => dispatchLocalFile(id, name, f), 300);
          } else {
            toast({ title: '📄 New scan detected', description: name });
          }
        } catch {
          seenFiles.current.delete(name);
        }
      }
    } catch (err) {
      console.warn('Folder poll error:', err);
    }
  }, [toast, dispatchLocalFile]);

  const startFolderWatch = async () => {
    try {
      // @ts-ignore
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'read' });
      folderHandle.current  = handle;
      seenFiles.current     = new Set();
      setFolderName(handle.name);
      setFolderWatching(true);
      setPendingScans([]);
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
      watchIntervalRef.current = setInterval(pollFolder, 2000);
      pollFolder();
      toast({ title: '📂 Watching folder', description: `${handle.name} — new scans appear here automatically.` });
    } catch { /* user cancelled */ }
  };

  const stopFolderWatch = () => {
    if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    folderHandle.current = null;
    seenFiles.current    = new Set();
    setFolderWatching(false);
    setFolderName('');
    setPendingScans([]);
  };

  useEffect(() => () => { if (watchIntervalRef.current) clearInterval(watchIntervalRef.current); }, []);

  // ── Dispatch SSE doc ─────────────────────────────────────────────────────
  const dispatchScannedDoc = () => {
    if (!scannedDocId) return;
    setScanSending(true);
    sendMutation.mutate({ id: scannedDocId }, {
      onSuccess: () => {
        sentFiles.current.add(`sse:${scannedDocId}`);
        saveSentFiles(sentFiles.current);
        setScanSuccess(true);
        toast({ title: 'Document Dispatched', description: `${scannedFileName} sent to all recipients.` });
        setTimeout(() => { setScannerDocReady(false); setScannedDocId(null); setScanSuccess(false); }, 3500);
      },
      onError: () => toast({ title: 'Dispatch Failed', variant: 'destructive' }),
      onSettled: () => setScanSending(false),
    });
  };

  const hasItems = scannerDocReady || pendingScans.length > 0;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Physical Scanner</h1>
          <p className="text-muted-foreground text-sm">
            Documents pushed from your HP M128fn appear here automatically.
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 mt-1',
          sseStatus === 'connected' ? 'bg-green-50 text-green-700 border-green-200' :
          sseStatus === 'error'     ? 'bg-red-50 text-red-700 border-red-200' :
                                      'bg-muted text-muted-foreground border-border',
        )}>
          {sseStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {sseStatus === 'connected' ? 'Scanner Online' : sseStatus === 'error' ? 'Scanner Offline' : 'Connecting…'}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Folder watch bar */}
        <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3">
          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            {folderWatching ? (
              <>
                <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                  Watching folder
                </p>
                <p className="text-sm font-mono truncate text-foreground">{folderName}</p>
              </>
            ) : watchPath ? (
              <>
                <p className="text-xs text-muted-foreground mb-0.5">HP scanner save folder</p>
                <p className="text-sm font-mono truncate text-foreground">{watchPath}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No folder configured — set it in Settings → Scanner</p>
            )}
          </div>
          {hasFsApi && (
            folderWatching
              ? <Button size="sm" variant="outline" onClick={stopFolderWatch} className="shrink-0 text-xs h-8">Stop</Button>
              : <Button size="sm" variant="outline" onClick={startFolderWatch} className="shrink-0 text-xs h-8">
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Watch Folder
                </Button>
          )}
        </div>

        {/* Document list */}
        <AnimatePresence mode="popLayout">

          {/* Folder-detected files */}
          {pendingScans.map((scan) => (
            <motion.div key={scan.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
                <FileIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate text-sm">{scan.name}</p>
                <p className="text-xs text-muted-foreground">{(scan.file.size / 1024).toFixed(0)} KB · from folder</p>
              </div>
              {scan.sent
                ? <span className="flex items-center gap-1 text-xs text-green-700 font-semibold shrink-0">
                    <CheckCircle2 className="w-4 h-4" /> Sent
                  </span>
                : <Button size="sm" disabled={scan.sending} onClick={() => dispatchLocalFile(scan.id, scan.name, scan.file)} className="shrink-0">
                    {scan.sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1.5" />Dispatch</>}
                  </Button>
              }
            </motion.div>
          ))}

          {/* SSE-received document */}
          {scannerDocReady && (
            <motion.div key="sse-doc"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-semibold text-green-700">Received via scanner endpoint</span>
                <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => { setScannerDocReady(false); setScannedDocId(null); setScanSuccess(false); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-4 mb-4 bg-muted/50 rounded-xl p-4 border border-border">
                <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
                  <FileIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{scannedFileName}</p>
                  <p className="text-xs text-muted-foreground font-mono">Doc #{scannedDocId}</p>
                </div>
              </div>
              {scanSuccess
                ? <Button variant="outline" className="w-full h-10 font-semibold text-green-600 border-green-200 bg-green-50">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Dispatched Successfully
                  </Button>
                : <Button onClick={dispatchScannedDoc} disabled={scanSending} className="w-full h-10 font-semibold">
                    {scanSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Dispatching…</> : <><Send className="w-4 h-4 mr-2" />Dispatch Document</>}
                  </Button>
              }
            </motion.div>
          )}

          {/* Empty state */}
          {!hasItems && (
            <motion.div key="idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-xl p-12 shadow-sm flex flex-col items-center text-center gap-4 min-h-[260px] justify-center">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center',
                sseStatus === 'connected' ? 'bg-green-50 border border-green-200' : 'bg-muted border border-border',
              )}>
                {folderWatching
                  ? <Eye className={cn('w-8 h-8', sseStatus === 'connected' ? 'text-green-600' : 'text-muted-foreground')} />
                  : <Printer className={cn('w-8 h-8', sseStatus === 'connected' ? 'text-green-600' : 'text-muted-foreground')} />
                }
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">
                  {folderWatching ? `Watching ${folderName}…` : 'Listening for documents…'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {folderWatching
                    ? 'New files saved to the folder by the HP scanner will appear here automatically.'
                    : hasFsApi
                      ? 'Click Watch Folder to monitor the scanner save folder, or send a scan via the HP M128fn endpoint.'
                      : 'Send a scan from your HP M128fn and it will appear here within seconds.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
