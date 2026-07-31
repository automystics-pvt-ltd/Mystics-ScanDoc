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

type SseStatus = 'connecting' | 'connected' | 'error';

export default function Upload() {
  // ── Physical scanner (SSE) ───────────────────────────────────────────────
  const [sseStatus, setSseStatus] = useState<SseStatus>('connecting');
  const [scannedDocId, setScannedDocId] = useState<number | null>(null);
  const [scannedFileName, setScannedFileName] = useState<string>('');
  const [scannerDocReady, setScannerDocReady] = useState(false);
  const [scanSending, setScanSending] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const [watchPath, setWatchPath] = useState('');
  const [autoDispatch, setAutoDispatch] = useState(false);

  const { toast } = useToast();
  const sendMutation = useSendDocument();

  // Fetch scanner config — available to all authenticated users (not admin-only)
  useEffect(() => {
    const token = localStorage.getItem('docscan_token') ?? '';
    fetch(`${import.meta.env.BASE_URL}api/scanner/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setWatchPath(d.scannerWatchPath ?? '');
          setAutoDispatch(d.scannerAutoDispatch ?? false);
        }
      })
      .catch(() => {});
  }, []);

  // ── SSE lifecycle ────────────────────────────────────────────────────────
  const connectSse = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    const token = localStorage.getItem('docscan_token') ?? '';
    const url = `${import.meta.env.BASE_URL}api/scanner/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setSseStatus('connected');
    es.onerror = () => setSseStatus('error');

    es.addEventListener('scan', (e) => {
      try {
        const data = JSON.parse(e.data) as { docId: number; fileName: string };
        setScannedDocId(data.docId);
        setScannedFileName(data.fileName);
        setScannerDocReady(true);
        const auto = (window as any).__docScanAutoDispatch ?? false;
        if (auto) {
          toast({ title: '⚡ Auto-dispatching…', description: data.fileName });
          sendMutation.mutate({ id: data.docId }, {
            onSuccess: () => {
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

  useEffect(() => {
    const es = connectSse();
    return () => { es.close(); };
  }, [connectSse]);

  useEffect(() => { (window as any).__docScanAutoDispatch = autoDispatch; }, [autoDispatch]);

  // ── Dispatch scanned doc ─────────────────────────────────────────────────
  const dispatchScannedDoc = () => {
    if (!scannedDocId) return;
    setScanSending(true);
    sendMutation.mutate({ id: scannedDocId }, {
      onSuccess: () => {
        setScanSuccess(true);
        toast({ title: 'Document Dispatched', description: `${scannedFileName} sent to all recipients.` });
        setTimeout(() => { setScannerDocReady(false); setScannedDocId(null); setScanSuccess(false); }, 3500);
      },
      onError: () => toast({ title: 'Dispatch Failed', variant: 'destructive' }),
      onSettled: () => setScanSending(false),
    });
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Physical Scanner</h1>
          <p className="text-muted-foreground text-sm">
            Send a scan from your HP M128fn — documents appear here automatically.
          </p>
        </div>
        {/* SSE status pill */}
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
        {/* Watch folder path info */}
        {watchPath && (
          <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3">
            <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">HP scanner save folder</p>
              <p className="text-sm font-mono truncate text-foreground">{watchPath}</p>
            </div>
          </div>
        )}

        {/* Scanner panel */}
        <AnimatePresence mode="wait">
          {!scannerDocReady ? (
            <motion.div key="waiting"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center gap-4 min-h-[280px] justify-center">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center',
                sseStatus === 'connected' ? 'bg-green-50 border border-green-200' : 'bg-muted border border-border',
              )}>
                <Printer className={cn('w-8 h-8', sseStatus === 'connected' ? 'text-green-600' : 'text-muted-foreground')} />
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">
                  {sseStatus === 'connected' ? 'Listening for documents…' : 'Scanner Offline'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {sseStatus === 'connected'
                    ? 'Scan a document on your HP M128fn and it will appear here within seconds.'
                    : 'Lost connection to the scanner endpoint.'}
                </p>
              </div>
              {sseStatus === 'error' && (
                <Button variant="outline" size="sm" onClick={connectSse}>Reconnect</Button>
              )}
            </motion.div>
          ) : (
            <motion.div key="ready"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-semibold text-green-700">Document received from scanner</span>
                <Button variant="ghost" size="icon" className="ml-auto text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => { setScannerDocReady(false); setScannedDocId(null); setScanSuccess(false); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-4 mb-6 bg-muted/50 rounded-xl p-4 border border-border">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shrink-0">
                  <FileIcon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold truncate">{scannedFileName}</h4>
                  <p className="text-xs text-muted-foreground font-mono">Doc #{scannedDocId}</p>
                </div>
              </div>
              {scanSuccess
                ? <Button variant="outline" className="w-full h-11 font-semibold text-green-600 border-green-200 bg-green-50">
                    <CheckCircle2 className="w-5 h-5 mr-2" /> Dispatched Successfully
                  </Button>
                : <Button onClick={dispatchScannedDoc} disabled={scanSending} className="w-full h-11 font-semibold">
                    {scanSending
                      ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Dispatching…</>
                      : <><Send className="w-5 h-5 mr-2" />Dispatch Document</>}
                  </Button>
              }
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
