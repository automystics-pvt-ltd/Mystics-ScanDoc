import { useState, useRef, useEffect, useCallback } from 'react';
import {
  File as FileIcon, X, Send, Loader2,
  CheckCircle2, Printer, Wifi, WifiOff, FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSendDocument } from '@workspace/api-client-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ── types ────────────────────────────────────────────────────────────────────
type SseStatus   = 'connecting' | 'connected' | 'error';
type ScanStatus  = 'queued' | 'sending' | 'sent' | 'failed';
type PendingScan = { id: number; name: string; file: File | null; sizeKb: number; status: ScanStatus };

const SCAN_EXTS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff']);
const SENT_KEY  = 'docscan_sent_files';

// ── sent-file helpers (localStorage) ─────────────────────────────────────────
const loadSent = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]')); }
  catch { return new Set(); }
};
const persistSent = (s: Set<string>) =>
  localStorage.setItem(SENT_KEY, JSON.stringify([...s].slice(-500)));

// ── IndexedDB helpers for folder handle persistence ───────────────────────────
const IDB_NAME  = 'docscan-fs';
const IDB_STORE = 'handles';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
async function saveHandle(h: FileSystemDirectoryHandle) {
  const db = await openIdb();
  await new Promise<void>((res) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(h, 'folder');
    tx.oncomplete = () => { db.close(); res(); };
  });
}
async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIdb();
    return await new Promise((res) => {
      const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get('folder');
      req.onsuccess = () => { db.close(); res(req.result ?? null); };
      req.onerror   = () => { db.close(); res(null); };
    });
  } catch { return null; }
}
async function clearHandle() {
  const db = await openIdb();
  await new Promise<void>((res) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete('folder');
    tx.oncomplete = () => { db.close(); res(); };
  });
}

// ── component ─────────────────────────────────────────────────────────────────
export default function Upload() {
  // SSE
  const [sseStatus,       setSseStatus]       = useState<SseStatus>('connecting');
  const [scannedDocId,    setScannedDocId]     = useState<number | null>(null);
  const [scannedFileName, setScannedFileName]  = useState('');
  const [scannerDocReady, setScannerDocReady]  = useState(false);
  const [scanSending,     setScanSending]      = useState(false);
  const [scanSuccess,     setScanSuccess]      = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Folder watch
  const [folderWatching,  setFolderWatching]   = useState(false);
  const [folderName,      setFolderName]        = useState('');
  const [needsPermission, setNeedsPermission]   = useState(false); // handle restored but perm not yet granted
  const [scans,           setScans]             = useState<PendingScan[]>([]);
  const folderHandle     = useRef<FileSystemDirectoryHandle | null>(null);
  const seenFiles        = useRef<Set<string>>(new Set());
  const sentFiles        = useRef<Set<string>>(loadSent());
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // Config
  const [watchPath,    setWatchPath]    = useState('');
  const [autoDispatch, setAutoDispatch] = useState(false);

  const { toast }    = useToast();
  const sendMutation = useSendDocument();

  // Load scanner config
  useEffect(() => {
    const token = localStorage.getItem('docscan_token') ?? '';
    fetch(`${import.meta.env.BASE_URL}api/scanner/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setWatchPath(d.scannerWatchPath ?? ''); setAutoDispatch(d.scannerAutoDispatch ?? false); } })
      .catch(() => {});
  }, []);

  useEffect(() => { (window as any).__docScanAutoDispatch = autoDispatch; }, [autoDispatch]);

  // ── SSE ──────────────────────────────────────────────────────────────────
  const connectSse = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    const token = localStorage.getItem('docscan_token') ?? '';
    const es = new EventSource(
      `${import.meta.env.BASE_URL}api/scanner/events?token=${encodeURIComponent(token)}`
    );
    esRef.current = es;
    es.onopen  = () => setSseStatus('connected');
    es.onerror = () => setSseStatus('error');
    es.addEventListener('scan', (e) => {
      try {
        const data = JSON.parse(e.data) as { docId: number; fileName: string };
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
              persistSent(sentFiles.current);
              toast({ title: '✅ Dispatched', description: `${data.fileName} sent automatically.` });
              setScannerDocReady(false); setScannedDocId(null);
            },
          });
        } else {
          toast({ title: 'Document received', description: data.fileName });
        }
      } catch {}
    });
    return es;
  }, [toast]);

  useEffect(() => { const es = connectSse(); return () => es.close(); }, [connectSse]);

  // ── Folder polling ────────────────────────────────────────────────────────
  const dispatchFile = useCallback(async (id: number, name: string, file: File) => {
    setScans((p) => p.map((s) => s.id === id ? { ...s, status: 'sending' } : s));
    try {
      const fd  = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${import.meta.env.BASE_URL}api/documents/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!res.ok) throw new Error();
      const doc = await res.json();
      sendMutation.mutate({ id: doc.id }, {
        onSuccess: () => {
          sentFiles.current.add(name);
          persistSent(sentFiles.current);
          setScans((p) => p.map((s) => s.id === id ? { ...s, status: 'sent', file: null } : s));
          toast({ title: '✅ Dispatched', description: `${name} sent to all recipients.` });
        },
        onError: (err: any) => {
          setScans((p) => p.map((s) => s.id === id ? { ...s, status: 'failed' } : s));
          toast({ title: 'Dispatch Failed', description: err?.data?.error ?? 'Failed.', variant: 'destructive' });
        },
      });
    } catch {
      setScans((p) => p.map((s) => s.id === id ? { ...s, status: 'failed' } : s));
      toast({ title: 'Upload Error', description: 'Failed to upload.', variant: 'destructive' });
    }
  }, [sendMutation, toast]);

  const pollFolder = useCallback(async () => {
    if (!folderHandle.current) return;
    try {
      // @ts-ignore
      for await (const [name, handle] of folderHandle.current) {
        if (handle.kind !== 'file') continue;
        const ext = name.split('.').pop()?.toLowerCase() ?? '';
        if (!SCAN_EXTS.has(ext)) continue;
        if (seenFiles.current.has(name)) continue;
        seenFiles.current.add(name);

        const isSent = sentFiles.current.has(name);

        if (isSent) {
          // Show as already-sent card (no file object needed)
          const id = Date.now() + Math.random();
          setScans((p) => {
            if (p.some((s) => s.name === name)) return p; // already in list
            return [...p, { id, name, file: null, sizeKb: 0, status: 'sent' }];
          });
          continue;
        }

        // New, unsent file — load it
        await new Promise((r) => setTimeout(r, 600));
        try {
          const f: File = await (handle as FileSystemFileHandle).getFile();
          if (f.size === 0) { seenFiles.current.delete(name); continue; }
          const id   = Date.now() + Math.random();
          const auto = (window as any).__docScanAutoDispatch ?? false;
          setScans((p) => [...p, { id, name, file: f, sizeKb: Math.round(f.size / 1024), status: 'queued' }]);
          if (auto) {
            toast({ title: '⚡ Auto-dispatching…', description: name });
            setTimeout(() => dispatchFile(id, name, f), 300);
          } else {
            toast({ title: '📄 New scan', description: name });
          }
        } catch { seenFiles.current.delete(name); }
      }
    } catch (err) { console.warn('poll error', err); }
  }, [toast, dispatchFile]);

  // ── Start / stop watching ─────────────────────────────────────────────────
  const startWatching = useCallback((handle: FileSystemDirectoryHandle) => {
    folderHandle.current = handle;
    seenFiles.current    = new Set();
    setFolderName(handle.name);
    setFolderWatching(true);
    setNeedsPermission(false);
    setScans([]);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(pollFolder, 2000);
    pollFolder();
  }, [pollFolder]);

  const stopFolderWatch = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    folderHandle.current = null;
    seenFiles.current    = new Set();
    setFolderWatching(false);
    setFolderName('');
    setNeedsPermission(false);
    setScans([]);
    clearHandle();
  };

  const chooseFolderAndWatch = async () => {
    try {
      // @ts-ignore
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'read' });
      await saveHandle(handle);
      startWatching(handle);
      toast({ title: '📂 Watching folder', description: `${handle.name} — new scans appear here automatically.` });
    } catch { /* cancelled */ }
  };

  const resumeWatching = async () => {
    if (!folderHandle.current) return;
    try {
      // @ts-ignore
      const perm = await folderHandle.current.requestPermission({ mode: 'read' });
      if (perm === 'granted') startWatching(folderHandle.current);
    } catch {}
  };

  // ── Auto-restore handle on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!('showDirectoryPicker' in window)) return;
    loadHandle().then(async (handle) => {
      if (!handle) return;
      folderHandle.current = handle;
      try {
        // @ts-ignore
        const perm = await handle.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          startWatching(handle);
        } else {
          // Permission lost (e.g. browser restart) — show Resume button
          setFolderName(handle.name);
          setNeedsPermission(true);
        }
      } catch {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // ── Dispatch SSE doc ──────────────────────────────────────────────────────
  const dispatchScannedDoc = () => {
    if (!scannedDocId) return;
    setScanSending(true);
    sendMutation.mutate({ id: scannedDocId }, {
      onSuccess: () => {
        sentFiles.current.add(`sse:${scannedDocId}`);
        persistSent(sentFiles.current);
        setScanSuccess(true);
        toast({ title: 'Document Dispatched', description: `${scannedFileName} sent to all recipients.` });
        setTimeout(() => { setScannerDocReady(false); setScannedDocId(null); setScanSuccess(false); }, 3500);
      },
      onError: () => toast({ title: 'Dispatch Failed', variant: 'destructive' }),
      onSettled: () => setScanSending(false),
    });
  };

  const hasFsApi = 'showDirectoryPicker' in window;
  const hasItems = scannerDocReady || scans.length > 0;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Physical Scanner</h1>
          <p className="text-muted-foreground text-sm">
            Documents from your HP M128fn appear here automatically.
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
        {/* ── Folder bar ── */}
        <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3">
          <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            {folderWatching ? (
              <>
                <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                  Watching folder
                </p>
                <p className="text-sm font-mono truncate">{folderName}</p>
              </>
            ) : needsPermission ? (
              <>
                <p className="text-xs text-amber-600 mb-0.5">Permission needed to resume</p>
                <p className="text-sm font-mono truncate text-muted-foreground">{folderName}</p>
              </>
            ) : watchPath ? (
              <>
                <p className="text-xs text-muted-foreground mb-0.5">HP scanner save folder</p>
                <p className="text-sm font-mono truncate">{watchPath}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No folder configured — set it in Settings → Scanner</p>
            )}
          </div>

          {hasFsApi && (
            folderWatching
              ? <Button size="sm" variant="outline" onClick={stopFolderWatch} className="shrink-0 h-8 text-xs">Stop</Button>
              : needsPermission
                ? <Button size="sm" variant="default" onClick={resumeWatching} className="shrink-0 h-8 text-xs">
                    Resume Watching
                  </Button>
                : <Button size="sm" variant="outline" onClick={chooseFolderAndWatch} className="shrink-0 h-8 text-xs">
                    <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> Watch Folder
                  </Button>
          )}
        </div>

        {/* ── Document list ── */}
        <AnimatePresence mode="popLayout">

          {/* Folder-detected files — all statuses persist in list */}
          {scans.map((scan) => (
            <motion.div key={scan.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={cn(
                'bg-card border rounded-xl p-4 shadow-sm flex items-center gap-4',
                scan.status === 'sent'   ? 'border-green-200 bg-green-50/30' :
                scan.status === 'failed' ? 'border-destructive/30 bg-destructive/5' :
                                           'border-border',
              )}>
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center border shrink-0',
                scan.status === 'sent'   ? 'bg-green-100 border-green-200' :
                scan.status === 'failed' ? 'bg-destructive/10 border-destructive/20' :
                                           'bg-primary/10 border-primary/20',
              )}>
                <FileIcon className={cn('w-5 h-5',
                  scan.status === 'sent'   ? 'text-green-600' :
                  scan.status === 'failed' ? 'text-destructive' : 'text-primary'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate text-sm">{scan.name}</p>
                <p className="text-xs text-muted-foreground">
                  {scan.sizeKb > 0 ? `${scan.sizeKb} KB · ` : ''}
                  {scan.status === 'queued'  ? 'Ready to dispatch' :
                   scan.status === 'sending' ? 'Dispatching…' :
                   scan.status === 'sent'    ? 'Sent ✓' :
                                               'Failed — retry below'}
                </p>
              </div>
              {scan.status === 'queued' && scan.file && (
                <Button size="sm" onClick={() => dispatchFile(scan.id, scan.name, scan.file!)} className="shrink-0">
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Dispatch
                </Button>
              )}
              {scan.status === 'sending' && (
                <Button size="sm" disabled className="shrink-0">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </Button>
              )}
              {scan.status === 'sent' && (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              )}
              {scan.status === 'failed' && scan.file && (
                <Button size="sm" variant="outline" onClick={() => dispatchFile(scan.id, scan.name, scan.file!)} className="shrink-0 text-destructive border-destructive/30">
                  Retry
                </Button>
              )}
            </motion.div>
          ))}

          {/* SSE push document */}
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
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
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

          {/* Empty / idle state */}
          {!hasItems && (
            <motion.div key="idle"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-card border border-border rounded-xl p-12 shadow-sm flex flex-col items-center text-center gap-4 min-h-[240px] justify-center">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center',
                sseStatus === 'connected' ? 'bg-green-50 border border-green-200' : 'bg-muted border border-border',
              )}>
                <Printer className={cn('w-8 h-8', sseStatus === 'connected' ? 'text-green-600' : 'text-muted-foreground')} />
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">
                  {folderWatching ? `Watching ${folderName}…` : 'Listening for documents…'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {folderWatching
                    ? 'New files saved to the folder appear here automatically.'
                    : hasFsApi
                      ? 'Click Watch Folder above to monitor the save folder, or send a scan via the HP M128fn endpoint.'
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
