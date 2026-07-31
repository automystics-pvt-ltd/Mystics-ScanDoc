import { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud, File as FileIcon, X, Send, Loader2,
  CheckCircle2, AlertCircle, Camera, RefreshCw, ScanLine, Printer, Wifi, WifiOff,
  FolderOpen, FolderSearch, Eye, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSendDocument, useGetSettings } from '@workspace/api-client-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type Mode = 'file' | 'camera' | 'scanner';
type CameraState = 'idle' | 'requesting' | 'live' | 'captured' | 'error';
type SseStatus = 'connecting' | 'connected' | 'error';
type PendingScan = { id: number; name: string; file: File; sending: boolean; sent: boolean };

const SCAN_EXTS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'tif', 'tiff']);
const hasFsApi = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export default function Upload() {
  const [mode, setMode] = useState<Mode>('file');

  // ── File mode ────────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Camera mode ──────────────────────────────────────────────────────────
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState('');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Physical scanner (SSE) ───────────────────────────────────────────────
  const [sseStatus, setSseStatus] = useState<SseStatus>('connecting');
  const [scannedDocId, setScannedDocId] = useState<number | null>(null);
  const [scannedFileName, setScannedFileName] = useState<string>('');
  const [scannerDocReady, setScannerDocReady] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // ── Local folder watch (File System Access API) ───────────────────────────
  const [folderWatching, setFolderWatching] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const folderHandle = useRef<FileSystemDirectoryHandle | null>(null);
  const seenFiles = useRef<Set<string>>(new Set());
  const watchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { toast } = useToast();
  const sendMutation = useSendDocument();
  const { data: settings } = useGetSettings();
  const autoDispatch = settings?.scannerAutoDispatch ?? false;

  // ── Stop camera stream ───────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
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
        setMode('scanner');
        // Read auto-dispatch from DOM to avoid stale closure
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

  // Keep global in sync so SSE closure can read it without stale value
  useEffect(() => { (window as any).__docScanAutoDispatch = autoDispatch; }, [autoDispatch]);

  useEffect(() => () => stopStream(), [stopStream]);

  // ── Folder polling ───────────────────────────────────────────────────────
  const pollFolder = useCallback(async () => {
    if (!folderHandle.current) return;
    try {
      // @ts-ignore — File System Access API iteration
      for await (const [name, handle] of folderHandle.current) {
        if (handle.kind !== 'file') continue;
        const ext = name.split('.').pop()?.toLowerCase() ?? '';
        if (!SCAN_EXTS.has(ext)) continue;
        if (seenFiles.current.has(name)) continue;
        seenFiles.current.add(name);
        // Small delay so scanner finishes writing the file
        await new Promise((r) => setTimeout(r, 800));
        try {
          const f: File = await (handle as FileSystemFileHandle).getFile();
          if (f.size === 0) { seenFiles.current.delete(name); continue; }
          const id = Date.now() + Math.random();
          const auto = (window as any).__docScanAutoDispatch ?? false;
          setPendingScans((prev) => [...prev, { id, name, file: f, sending: false, sent: false }]);
          if (auto) {
            toast({ title: '⚡ Auto-dispatching…', description: name });
            // slight delay so state settles
            setTimeout(() => dispatchLocalScanById(id, name, f), 300);
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
  }, [toast]);

  const startFolderWatch = async () => {
    try {
      // @ts-ignore
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'read' });
      folderHandle.current = handle;
      seenFiles.current = new Set();
      setFolderName(handle.name);
      setFolderWatching(true);
      setPendingScans([]);
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
      watchIntervalRef.current = setInterval(pollFolder, 2000);
      pollFolder();
      toast({ title: '📂 Watching folder', description: `${handle.name} — scan a document to see it here.` });
    } catch {
      // user cancelled picker — do nothing
    }
  };

  const stopFolderWatch = () => {
    if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    folderHandle.current = null;
    seenFiles.current = new Set();
    setFolderWatching(false);
    setFolderName('');
    setPendingScans([]);
  };

  useEffect(() => () => { if (watchIntervalRef.current) clearInterval(watchIntervalRef.current); }, []);

  // ── Dispatch a locally-watched scan (upload then send) ───────────────────
  // Can be called with an id (looks up from state) or with explicit name+file (for auto-dispatch before state settles)
  const dispatchLocalScanById = async (id: number, name: string, file: File) => {
    setPendingScans((prev) => prev.map((s) => s.id === id ? { ...s, sending: true } : s));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${import.meta.env.BASE_URL}api/documents/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const doc = await res.json();
      sendMutation.mutate({ id: doc.id }, {
        onSuccess: () => {
          setPendingScans((prev) => prev.map((s) => s.id === id ? { ...s, sending: false, sent: true } : s));
          toast({ title: '✅ Dispatched', description: `${name} sent to all recipients.` });
          setTimeout(() => setPendingScans((prev) => prev.filter((s) => s.id !== id)), 3000);
        },
        onError: (err: any) => {
          setPendingScans((prev) => prev.map((s) => s.id === id ? { ...s, sending: false } : s));
          toast({ title: 'Dispatch Failed', description: err?.data?.error ?? 'Failed to queue.', variant: 'destructive' });
        },
      });
    } catch {
      setPendingScans((prev) => prev.map((s) => s.id === id ? { ...s, sending: false } : s));
      toast({ title: 'Upload Error', description: 'Failed to upload file.', variant: 'destructive' });
    }
  };

  const dispatchLocalScan = async (id: number) => {
    const item = pendingScans.find((s) => s.id === id);
    if (!item) return;
    setPendingScans((prev) => prev.map((s) => s.id === id ? { ...s, sending: true } : s));
    try {
      const formData = new FormData();
      formData.append('file', item.file);
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${import.meta.env.BASE_URL}api/documents/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const doc = await res.json();
      sendMutation.mutate({ id: doc.id }, {
        onSuccess: () => {
          setPendingScans((prev) => prev.map((s) => s.id === id ? { ...s, sending: false, sent: true } : s));
          toast({ title: '✅ Dispatched', description: `${item.name} sent to all recipients.` });
          setTimeout(() => setPendingScans((prev) => prev.filter((s) => s.id !== id)), 3000);
        },
        onError: (err: any) => {
          setPendingScans((prev) => prev.map((s) => s.id === id ? { ...s, sending: false } : s));
          toast({ title: 'Dispatch Failed', description: err?.data?.error ?? 'Uploaded but failed to queue.', variant: 'destructive' });
        },
      });
    } catch {
      setPendingScans((prev) => prev.map((s) => s.id === id ? { ...s, sending: false } : s));
      toast({ title: 'Upload Error', description: 'Failed to upload file.', variant: 'destructive' });
    }
  };

  // ── Mode switch ──────────────────────────────────────────────────────────
  const switchMode = (m: Mode) => {
    stopStream();
    setCameraState('idle');
    setCapturedDataUrl(null);
    setCameraError('');
    setFile(null);
    setUploadSuccess(false);
    if (m !== 'scanner') { setScannerDocReady(false); setScannedDocId(null); }
    setMode(m);
  };

  // ── File mode handlers ───────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragActive(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragActive(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragActive(false);
    if (e.dataTransfer.files[0]) { setFile(e.dataTransfer.files[0]); setUploadSuccess(false); }
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) { setFile(e.target.files[0]); setUploadSuccess(false); }
  };
  const clearFile = () => {
    setFile(null); setUploadSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Camera handlers ──────────────────────────────────────────────────────
  const startCamera = async () => {
    setCameraState('requesting'); setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraState('live');
    } catch (err: any) {
      setCameraError(err?.name === 'NotAllowedError'
        ? 'Camera access denied. Allow camera permission and try again.'
        : 'Could not access the camera.');
      setCameraState('error');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    setCapturedDataUrl(canvas.toDataURL('image/jpeg', 0.92));
    stopStream(); setCameraState('captured');
  };

  // ── Shared upload ────────────────────────────────────────────────────────
  const uploadFile = async (f: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', f);
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${import.meta.env.BASE_URL}api/documents/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const doc = await res.json();
      sendMutation.mutate({ id: doc.id }, {
        onSuccess: () => {
          setUploadSuccess(true);
          toast({ title: 'Document Dispatched', description: 'Processed and queued for delivery.' });
          setTimeout(() => { clearFile(); setCapturedDataUrl(null); setUploadSuccess(false); }, 3000);
        },
        onError: (err: any) => toast({ title: 'Dispatch Failed', description: err?.data?.error ?? err?.message ?? 'Uploaded but failed to queue.', variant: 'destructive' }),
      });
    } catch {
      toast({ title: 'Upload Error', description: 'Failed to upload.', variant: 'destructive' });
    } finally { setIsUploading(false); }
  };

  // ── Dispatch scanned doc (already in DB, just send) ──────────────────────
  const [scanSending, setScanSending] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const dispatchScannedDoc = async () => {
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

  const isBusy = isUploading || sendMutation.isPending;
  const hasPending = pendingScans.length > 0;

  return (
    <div className="max-w-7xl w-full mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Scan & Dispatch</h1>
        <p className="text-muted-foreground text-sm">
          Upload a file, use your camera, or receive directly from a connected physical scanner.
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { id: 'file' as Mode, label: 'Upload File', icon: UploadCloud },
          { id: 'camera' as Mode, label: 'Use Camera', icon: Camera },
          { id: 'scanner' as Mode, label: 'Physical Scanner', icon: Printer },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchMode(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all relative',
              mode === id
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
            )}
          >
            <Icon className="w-4 h-4" /> {label}
            {id === 'scanner' && (scannerDocReady || hasPending) && mode !== 'scanner' && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
            )}
          </button>
        ))}

        {/* SSE status pill */}
        <div className={cn(
          'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border',
          sseStatus === 'connected' ? 'bg-green-50 text-green-700 border-green-200' :
          sseStatus === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-muted text-muted-foreground border-border',
        )}>
          {sseStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {sseStatus === 'connected' ? 'Scanner Online' : sseStatus === 'error' ? 'Scanner Offline' : 'Connecting…'}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="flex flex-col">
          <AnimatePresence mode="wait">

            {/* ── FILE MODE ─────────────────────────────────────────────── */}
            {mode === 'file' && !file && (
              <motion.div key="upload-zone"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                className={cn(
                  'relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer min-h-[400px] overflow-hidden bg-card',
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                )}
              >
                {isDragActive && <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />}
                <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
                <div className={cn('w-16 h-16 rounded-xl flex items-center justify-center mb-6 transition-colors', isDragActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-2">Select a document or drag it here</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">Supports PDF, JPG, or PNG files up to 10MB.</p>
              </motion.div>
            )}

            {mode === 'file' && file && (
              <motion.div key="file-preview"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-8 flex flex-col min-h-[400px] justify-between shadow-sm">
                <div>
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                        <FileIcon className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg mb-1 truncate max-w-[300px]">{file.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                          <span className="bg-muted px-1.5 py-0.5 rounded uppercase font-bold text-foreground">{file.name.split('.').pop()}</span>
                          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      </div>
                    </div>
                    {!isBusy && !uploadSuccess && (
                      <Button variant="ghost" size="icon" onClick={clearFile} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <X className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 border border-border flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-semibold text-foreground mb-1">Ready for dispatch</p>
                      <p>This document will be securely uploaded and routed to all configured recipients.</p>
                    </div>
                  </div>
                </div>
                <div className="mt-8">
                  {uploadSuccess
                    ? <Button variant="outline" className="w-full text-green-600 border-green-200 bg-green-50 h-12 font-semibold"><CheckCircle2 className="w-5 h-5 mr-2" /> Dispatched Successfully</Button>
                    : <Button onClick={() => uploadFile(file)} disabled={isBusy} className="w-full h-12 font-semibold">
                        {isBusy ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing…</> : <><Send className="w-5 h-5 mr-2" />Dispatch Document</>}
                      </Button>
                  }
                </div>
              </motion.div>
            )}

            {/* ── CAMERA MODE ───────────────────────────────────────────── */}
            {mode === 'camera' && cameraState === 'idle' && (
              <motion.div key="camera-idle"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-12 text-center min-h-[400px] bg-card cursor-pointer hover:border-primary/50 transition-all"
                onClick={startCamera}>
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mb-6">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2">Open Camera</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">Click to activate your camera and capture a document.</p>
                <Button className="mt-6"><Camera className="w-4 h-4 mr-2" /> Start Camera</Button>
              </motion.div>
            )}

            {mode === 'camera' && cameraState === 'requesting' && (
              <motion.div key="camera-requesting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center min-h-[400px] bg-card border-2 border-dashed border-border rounded-xl">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Requesting camera access…</p>
              </motion.div>
            )}

            {mode === 'camera' && cameraState === 'error' && (
              <motion.div key="camera-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center min-h-[400px] bg-card border-2 border-dashed border-destructive/40 rounded-xl p-8 text-center">
                <AlertCircle className="w-10 h-10 text-destructive mb-4" />
                <p className="font-semibold mb-2">Camera Unavailable</p>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">{cameraError}</p>
                <Button variant="outline" onClick={startCamera}><RefreshCw className="w-4 h-4 mr-2" />Try Again</Button>
              </motion.div>
            )}

            {mode === 'camera' && cameraState === 'live' && (
              <motion.div key="camera-live" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
                <div className="relative flex-1 bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ minHeight: 340 }} />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="border-2 border-primary/70 rounded-lg" style={{ width: '80%', height: '70%' }}>
                      {[['top-0 left-0 border-t-4 border-l-4 rounded-tl', '-mt-0.5 -ml-0.5'],
                        ['top-0 right-0 border-t-4 border-r-4 rounded-tr', '-mt-0.5 -mr-0.5'],
                        ['bottom-0 left-0 border-b-4 border-l-4 rounded-bl', '-mb-0.5 -ml-0.5'],
                        ['bottom-0 right-0 border-b-4 border-r-4 rounded-br', '-mb-0.5 -mr-0.5'],
                      ].map(([cls], i) => (
                        <div key={i} className={`absolute w-5 h-5 border-primary ${cls}`} />
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <Button size="lg" onClick={capturePhoto} className="rounded-full h-14 w-14 p-0 shadow-lg">
                      <ScanLine className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
                <div className="p-3 text-center text-xs text-muted-foreground bg-muted/30">Align document within the frame, then capture</div>
              </motion.div>
            )}

            {mode === 'camera' && cameraState === 'captured' && (
              <motion.div key="camera-captured" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
                {capturedDataUrl && <img src={capturedDataUrl} alt="Captured" className="w-full object-contain max-h-80" />}
                <div className="p-5 flex flex-col gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 border border-border flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <div className="text-sm"><p className="font-semibold">Photo captured</p><p className="text-muted-foreground">Review above, then dispatch or retake.</p></div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => { setCapturedDataUrl(null); setCameraState('idle'); }} disabled={isBusy}>
                      <RefreshCw className="w-4 h-4 mr-2" /> Retake
                    </Button>
                    {uploadSuccess
                      ? <Button className="flex-1" variant="outline"><CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Dispatched</Button>
                      : <Button className="flex-1" disabled={isBusy} onClick={() => {
                          if (!capturedDataUrl) return;
                          fetch(capturedDataUrl).then(r => r.blob()).then(blob => {
                            uploadFile(new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' }));
                          });
                        }}>
                          {isBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : <><Send className="w-4 h-4 mr-2" />Dispatch</>}
                        </Button>
                    }
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── PHYSICAL SCANNER MODE ──────────────────────────────────── */}
            {mode === 'scanner' && (
              <motion.div key="scanner-panel"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col gap-4">

                {/* ── Watch Folder card ───────────────────────────────────── */}
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FolderSearch className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">Watch Local Folder</span>
                      <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Easiest</span>
                    </div>
                    {folderWatching && (
                      <button onClick={stopFolderWatch} className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2">Stop</button>
                    )}
                  </div>

                  {!hasFsApi && (
                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border">
                      ⚠ Folder watching requires <strong>Chrome or Edge</strong> browser. Please switch browsers to use this feature.
                    </p>
                  )}

                  {hasFsApi && !folderWatching && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-muted-foreground">
                        Point DocScan at your HP scanner's save folder. New scans appear here automatically — no extra software needed.
                      </p>
                      <Button onClick={startFolderWatch} variant="outline" className="w-full">
                        <FolderOpen className="w-4 h-4 mr-2" /> Choose Scan Folder
                      </Button>
                    </div>
                  )}

                  {hasFsApi && folderWatching && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                        <span className="font-medium text-green-700">Watching:</span>
                        <span className="font-mono text-foreground truncate">{folderName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Scan a document on your HP M128fn — it will appear below within seconds.
                      </p>

                      {/* Pending scans queue */}
                      {pendingScans.length === 0 ? (
                        <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-4 border border-dashed border-border">
                          <Eye className="w-5 h-5 text-muted-foreground shrink-0" />
                          <p className="text-sm text-muted-foreground">Waiting for new scans in <strong>{folderName}</strong>…</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {pendingScans.map((scan) => (
                            <motion.div key={scan.id}
                              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                                <FileIcon className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">{scan.name}</p>
                                <p className="text-xs text-muted-foreground">{(scan.file.size / 1024).toFixed(0)} KB</p>
                              </div>
                              {scan.sent
                                ? <span className="flex items-center gap-1 text-xs text-green-700 font-semibold"><CheckCircle2 className="w-4 h-4" /> Sent</span>
                                : <Button size="sm" disabled={scan.sending} onClick={() => dispatchLocalScan(scan.id)} className="shrink-0">
                                    {scan.sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1" />Dispatch</>}
                                  </Button>
                              }
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── SSE / remote scanner doc card ──────────────────────── */}
                {!scannerDocReady && (
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Printer className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-sm text-muted-foreground">Scan-to-URL (Advanced)</span>
                    </div>
                    <div className={cn(
                      'flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-full w-fit border',
                      sseStatus === 'connected' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200',
                    )}>
                      {sseStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {sseStatus === 'connected' ? 'Listening for documents…' : 'Connection lost — '}
                      {sseStatus === 'error' && (
                        <button onClick={connectSse} className="underline underline-offset-2 font-semibold">Reconnect</button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Configure your scanner with the endpoint URL from <strong>Settings → Scanner</strong> for automatic push delivery.
                    </p>
                  </div>
                )}

                {scannerDocReady && (
                  <motion.div key="scanner-ready"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      <span className="text-sm font-semibold text-green-700">Document received from scanner</span>
                    </div>
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                        <FileIcon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold truncate">{scannedFileName}</h4>
                        <p className="text-xs text-muted-foreground font-mono">Doc #{scannedDocId}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                        onClick={() => { setScannerDocReady(false); setScannedDocId(null); setScanSuccess(false); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {scanSuccess
                      ? <Button variant="outline" className="w-full h-11 font-semibold text-green-600 border-green-200 bg-green-50">
                          <CheckCircle2 className="w-5 h-5 mr-2" /> Dispatched Successfully
                        </Button>
                      : <Button onClick={dispatchScannedDoc} disabled={scanSending} className="w-full h-11 font-semibold">
                          {scanSending ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Dispatching…</> : <><Send className="w-5 h-5 mr-2" />Dispatch Document</>}
                        </Button>
                    }
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* ── Side panel ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-4">Delivery Status</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-medium">Routing Online</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-medium">SMTP Connected</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={cn('w-2 h-2 rounded-full', sseStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-400')} />
                <span className="text-sm font-medium">Scanner {sseStatus === 'connected' ? 'Online' : 'Offline'}</span>
              </div>
              {folderWatching && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" />
                  <span className="text-sm font-medium">Folder Watch Active</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">
              {mode === 'camera' ? 'Camera Tips' : mode === 'scanner' ? 'Scanner Tips' : 'Scan Tips'}
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4 marker:text-muted">
              {mode === 'scanner' ? <>
                <li>Use <strong>Chrome or Edge</strong> for the Watch Folder feature.</li>
                <li>Set HP M128fn to save scans to a folder on your PC.</li>
                <li>Click <strong>Choose Scan Folder</strong> and select that folder once.</li>
                <li>New scans appear automatically — just click Dispatch.</li>
              </> : <>
                <li>Ensure pages are flat and fully visible.</li>
                <li>Avoid shadows or glare on the document.</li>
                <li>Use good lighting for clearer captures.</li>
                <li>Combine multi-page docs into one PDF before uploading.</li>
              </>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
