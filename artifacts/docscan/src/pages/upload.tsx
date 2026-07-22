import { useState, useRef } from 'react';
import { UploadCloud, File as FileIcon, X, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSendDocument } from '@workspace/api-client-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const sendMutation = useSendDocument();

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setUploadSuccess(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadSuccess(false);
    }
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  const clearFile = () => {
    setFile(null);
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadAndSend = async () => {
    if (!file) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("docscan_token");
      
      const res = await fetch(`${import.meta.env.BASE_URL}api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const doc = await res.json();
      
      sendMutation.mutate({ id: doc.id }, {
        onSuccess: () => {
          setUploadSuccess(true);
          toast({
            title: "Document Dispatched",
            description: "Successfully processed and queued for delivery.",
          });
          setTimeout(() => {
            clearFile();
          }, 3000);
        },
        onError: () => {
          toast({
            title: "Dispatch Failed",
            description: "The document was uploaded but failed to queue for sending.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to upload the document to the server.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Scan & Dispatch</h1>
        <p className="text-muted-foreground text-sm">Drop a scanned document here to immediately route it to all configured mailroom recipients.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        {/* Main Upload Area */}
        <div className="flex flex-col">
          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div 
                key="upload-zone"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                onClick={triggerSelect}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`
                  relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer min-h-[400px] overflow-hidden bg-card
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                `}
              >
                {isDragActive && (
                  <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={onFileChange} 
                  className="hidden" 
                  accept=".pdf,.jpg,.jpeg,.png" 
                />
                <div className={`mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-6 transition-colors duration-300 ${isDragActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-foreground">Select a document or drag it here</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Supports PDF, JPG, or PNG files up to 10MB in size. High-contrast scans recommended.
                </p>
              </motion.div>
            ) : (
              <motion.div 
                key="file-preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-8 flex flex-col min-h-[400px] justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                        <FileIcon className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-lg mb-1 truncate max-w-[300px]">{file.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                          <span className="bg-muted px-1.5 py-0.5 rounded uppercase font-bold text-foreground">{file.name.split('.').pop()}</span>
                          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                      </div>
                    </div>
                    {!isUploading && !uploadSuccess && (
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
                        <p>This document will be securely uploaded and immediately routed to all configured mailroom recipients.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  {uploadSuccess ? (
                    <Button variant="outline" className="w-full text-green-600 border-green-200 bg-green-50 hover:bg-green-100 cursor-default h-12 text-base font-semibold">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Dispatched Successfully
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleUploadAndSend} 
                      disabled={isUploading || sendMutation.isPending}
                      className="w-full h-12 text-base font-semibold relative overflow-hidden"
                    >
                      {(isUploading || sendMutation.isPending) ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Dispatch Document
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Side Info Panel */}
        <div className="flex flex-col gap-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-4">Delivery Status</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-medium text-foreground">Routing Online</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-medium text-foreground">SMTP Connected</span>
              </div>
            </div>
          </div>
          
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">Guidelines</h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4 marker:text-muted">
              <li>Ensure physical pages are flat and fully visible.</li>
              <li>Avoid extreme shadows or glare on camera scans.</li>
              <li>Multi-page PDFs should be combined before uploading.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
