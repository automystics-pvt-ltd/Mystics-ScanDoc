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
      
      // Immediately send
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
    <div className="max-w-4xl w-full mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Scan & Dispatch</h1>
        <p className="text-muted-foreground">Drop a scanned document here to immediately route it to all configured mailroom recipients.</p>
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
                  relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer min-h-[400px] overflow-hidden
                  ${isDragActive ? 'border-primary bg-primary/5 shadow-inner' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
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
                <div className={`mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 ${isDragActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground'}`}>
                  <UploadCloud className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold mb-2">Select a document or drag it here</h3>
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
                        <h4 className="font-bold text-foreground text-lg mb-1">{file.name}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground font-mono">
                          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span>•</span>
                          <span className="uppercase">{file.name.split('.').pop()}</span>
                        </div>
                      </div>
                    </div>
                    {!isUploading && !uploadSuccess && (
                      <Button variant="ghost" size="icon" onClick={clearFile} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <X className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Ready for dispatch</p>
                        <p>This document will be securely uploaded and immediately routed to all configured mailroom recipients. This action cannot be undone.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  {uploadSuccess ? (
                    <Button variant="outline" className="w-full text-green-600 border-green-200 bg-green-50 hover:bg-green-100 cursor-default h-12 text-base" size="lg">
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Dispatched Successfully
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleUploadAndSend} 
                      disabled={isUploading || sendMutation.isPending}
                      className="w-full h-12 text-base font-semibold transition-all relative overflow-hidden"
                      size="lg"
                    >
                      {(isUploading || sendMutation.isPending) ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing & Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Dispatch Document
                        </>
                      )}
                      
                      {/* Subtle shine effect on button */}
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Side Info Panel */}
        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">Mailroom Status</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-medium">System Online</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-sm font-medium">API Connected</span>
              </div>
            </div>
          </div>
          
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Guidelines</h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4 marker:text-muted">
              <li>Ensure physical pages are flat and fully visible.</li>
              <li>Avoid extreme shadows or glare on camera scans.</li>
              <li>Multi-page PDFs should be combined before uploading.</li>
              <li>Sensitive documents are logged automatically.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
