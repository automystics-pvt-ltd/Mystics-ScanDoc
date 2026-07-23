import { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud, File as FileIcon, X, Send, Loader2,
  CheckCircle2, AlertCircle, Camera, RefreshCw, ScanLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSendDocument } from '@workspace/api-client-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type Mode = 'file' | 'camera';
type CameraState = 'idle' | 'requesting' | 'live' | 'captured' | 'error';

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

  const { toast } = useToast();
  const sendMutation = useSendDocument();

  // Stop the camera stream on unmount or mode switch
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const switchMode = (m: Mode) => {
    stopStream();
    setCameraState('idle');
    setCapturedDataUrl(null);
    setCameraError('');
    setFile(null);
    setUploadSuccess(false);
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

  // ── Camera mode handlers ─────────────────────────────────────────────────
  const startCamera = async () => {
    setCameraState('requesting');
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraState('live');
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera permission in your browser and try again.'
        : 'Could not access the camera. Make sure a camera is connected.';
      setCameraError(msg);
      setCameraState('error');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    setCapturedDataUrl(canvas.toDataURL('image/jpeg', 0.92));
    stopStream();
    setCameraState('captured');
  };

  const retakePhoto = () => {
    setCapturedDataUrl(null);
    setCameraState('idle');
  };

  // ── Shared upload & send ─────────────────────────────────────────────────
  const uploadFile = async (f: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', f);
      const token = localStorage.getItem('docscan_token');
      const res = await fetch(`${import.meta.env.BASE_URL}api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const doc = await res.json();

      sendMutation.mutate({ id: doc.id }, {
        onSuccess: () => {
          setUploadSuccess(true);
          toast({ title: 'Document Dispatched', description: 'Successfully processed and queued for delivery.' });
          setTimeout(() => { clearFile(); setCapturedDataUrl(null); setUploadSuccess(false); }, 3000);
        },
        onError: () => toast({ title: 'Dispatch Failed', description: 'Uploaded but failed to queue for sending.', variant: 'destructive' }),
      });
    } catch {
      toast({ title: 'Upload Error', description: 'Failed to upload the document.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDispatchFile = () => file && uploadFile(file);

  const handleDispatchCapture = () => {
    if (!capturedDataUrl) return;
    fetch(capturedDataUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const f = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
        uploadFile(f);
      });
  };

  const isBusy = isUploading || sendMutation.isPending;

  return (
    <div className="max-w-7xl w-full mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Scan & Dispatch</h1>
        <p className="text-muted-foreground text-sm">
          Upload a document or use your camera to scan and route it to all configured recipients.
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => switchMode('file')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all',
            mode === 'file'
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
          )}
        >
          <UploadCloud className="w-4 h-4" /> Upload File
        </button>
        <button
          onClick={() => switchMode('camera')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all',
            mode === 'camera'
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
          )}
        >
          <Camera className="w-4 h-4" /> Use Camera
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        {/* ── Main Area ── */}
        <div className="flex flex-col">
          <AnimatePresence mode="wait">

            {/* ── FILE MODE ── */}
            {mode === 'file' && !file && (
              <motion.div
                key="upload-zone"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                className={cn(
                  'relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer min-h-[400px] overflow-hidden bg-card',
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                )}
              >
                {isDragActive && <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />}
                <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
                <div className={cn('mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-6 transition-colors', isDragActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground')}>
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-2">Select a document or drag it here</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Supports PDF, JPG, or PNG files up to 10MB. High-contrast scans recommended.
                </p>
              </motion.div>
            )}

            {mode === 'file' && file && (
              <motion.div
                key="file-preview"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-8 flex flex-col min-h-[400px] justify-between shadow-sm"
              >
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
                  <div className="bg-muted/50 rounded-lg p-4 border border-border">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-semibold text-foreground mb-1">Ready for dispatch</p>
                        <p>This document will be securely uploaded and routed to all configured recipients.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-8">
                  {uploadSuccess ? (
                    <Button variant="outline" className="w-full text-green-600 border-green-200 bg-green-50 hover:bg-green-100 h-12 text-base font-semibold">
                      <CheckCircle2 className="w-5 h-5 mr-2" /> Dispatched Successfully
                    </Button>
                  ) : (
                    <Button onClick={handleDispatchFile} disabled={isBusy} className="w-full h-12 text-base font-semibold">
                      {isBusy ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing...</> : <><Send className="w-5 h-5 mr-2" />Dispatch Document</>}
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── CAMERA MODE ── */}
            {mode === 'camera' && cameraState === 'idle' && (
              <motion.div
                key="camera-idle"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-12 text-center min-h-[400px] bg-card cursor-pointer hover:border-primary/50 transition-all"
                onClick={startCamera}
              >
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mb-6">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2">Open Camera</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Click to activate your camera. Point it at the document and capture a photo to send.
                </p>
                <Button className="mt-6" onClick={startCamera}>
                  <Camera className="w-4 h-4 mr-2" /> Start Camera
                </Button>
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
                <p className="font-semibold text-foreground mb-2">Camera Unavailable</p>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">{cameraError}</p>
                <Button variant="outline" onClick={startCamera}><RefreshCw className="w-4 h-4 mr-2" />Try Again</Button>
              </motion.div>
            )}

            {mode === 'camera' && cameraState === 'live' && (
              <motion.div key="camera-live" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
                <div className="relative flex-1 bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ minHeight: 340 }} />
                  {/* scan overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="border-2 border-primary/70 rounded-lg" style={{ width: '80%', height: '70%' }}>
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl" style={{ margin: -2 }} />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr" style={{ margin: -2 }} />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl" style={{ margin: -2 }} />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br" style={{ margin: -2 }} />
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                    <Button size="lg" onClick={capturePhoto} className="rounded-full h-14 w-14 p-0 shadow-lg">
                      <ScanLine className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
                <div className="p-3 text-center text-xs text-muted-foreground bg-muted/30">
                  Align the document within the frame, then press the button to capture
                </div>
              </motion.div>
            )}

            {mode === 'camera' && cameraState === 'captured' && (
              <motion.div key="camera-captured" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
                <div className="relative flex-1">
                  {capturedDataUrl && <img src={capturedDataUrl} alt="Captured scan" className="w-full object-contain max-h-80" />}
                </div>
                <div className="p-5 flex flex-col gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 border border-border flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-foreground">Photo captured</p>
                      <p className="text-muted-foreground">Review the image above, then dispatch or retake.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={retakePhoto} disabled={isBusy}>
                      <RefreshCw className="w-4 h-4 mr-2" /> Retake
                    </Button>
                    {uploadSuccess ? (
                      <Button className="flex-1 text-green-600 border-green-200 bg-green-50 hover:bg-green-100" variant="outline">
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Dispatched
                      </Button>
                    ) : (
                      <Button className="flex-1" onClick={handleDispatchCapture} disabled={isBusy}>
                        {isBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : <><Send className="w-4 h-4 mr-2" />Dispatch</>}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* ── Side Panel ── */}
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
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">Scan Tips</h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4 marker:text-muted">
              <li>Ensure pages are flat and fully visible.</li>
              <li>Avoid shadows or glare on the document.</li>
              <li>Use good lighting for clearer captures.</li>
              <li>For multi-page docs, combine into one PDF before uploading.</li>
            </ul>
          </div>

          {mode === 'camera' && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
                <Camera className="w-3.5 h-3.5" /> Camera Mode
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4 marker:text-muted">
                <li>Point at the document and tap capture.</li>
                <li>Rear camera used when available.</li>
                <li>Captured as high-quality JPEG.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
