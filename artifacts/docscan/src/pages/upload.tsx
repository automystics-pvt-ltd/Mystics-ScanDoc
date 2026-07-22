import { useState, useRef } from 'react';
import { UploadCloud, File as FileIcon, X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSendDocument } from '@workspace/api-client-react';

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
            title: "Document Sent",
            description: "Your document has been successfully processed and queued for delivery.",
          });
          setTimeout(() => {
            clearFile();
          }, 3000);
        },
        onError: () => {
          toast({
            title: "Send Failed",
            description: "The document was uploaded but failed to send.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your document.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scan & Send</h1>
        <p className="text-muted-foreground mt-2">Upload a document to automatically send it to pre-configured recipients.</p>
      </div>

      {!file ? (
        <div 
          onClick={triggerSelect}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}
          `}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={onFileChange} 
            className="hidden" 
            accept=".pdf,.jpg,.jpeg,.png" 
          />
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <UploadCloud className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Click to upload or drag and drop</h3>
          <p className="text-sm text-muted-foreground">PDF, JPG, or PNG (max 10MB)</p>
        </div>
      ) : (
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <FileIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-card-foreground">{file.name}</h4>
                <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            {!isUploading && !uploadSuccess && (
              <Button variant="ghost" size="icon" onClick={clearFile} className="text-muted-foreground hover:text-destructive">
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>

          <div className="mt-8 flex justify-end">
            {uploadSuccess ? (
              <Button variant="outline" className="w-full sm:w-auto text-green-600 border-green-200 bg-green-50 hover:bg-green-100 cursor-default">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Sent Successfully
              </Button>
            ) : (
              <Button 
                onClick={handleUploadAndSend} 
                disabled={isUploading || sendMutation.isPending}
                className="w-full sm:w-auto"
                size="lg"
              >
                {(isUploading || sendMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {isUploading ? "Uploading..." : sendMutation.isPending ? "Sending..." : "Send Document"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}