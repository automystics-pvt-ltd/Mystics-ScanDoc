import { useGetDocumentHistory } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { File as FileIcon, Clock, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function History() {
  const { data: documents, isLoading } = useGetDocumentHistory();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground mt-2">View your previously scanned and sent documents.</p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[300px]">Document</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                </TableRow>
              ))
            ) : documents?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  No documents found in your history.
                </TableCell>
              </TableRow>
            ) : (
              documents?.map((doc) => {
                // Determine aggregate status
                const logs = doc.emailLogs || [];
                const hasFailed = logs.some(log => log.status === 'failed');
                const hasQueued = logs.some(log => log.status === 'queued');
                const allSent = logs.length > 0 && logs.every(log => log.status === 'sent');
                
                let StatusIcon = Clock;
                let statusColor = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
                let statusText = "Queued";
                
                if (hasFailed) {
                  StatusIcon = AlertCircle;
                  statusColor = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
                  statusText = "Failed";
                } else if (allSent) {
                  StatusIcon = CheckCircle2;
                  statusColor = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
                  statusText = "Sent";
                }

                return (
                  <TableRow key={doc.id} className="group hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                          <FileIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground uppercase">{doc.fileType.split('/')[1] || 'FILE'} • {(doc.fileSize! / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(doc.uploadedAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex -space-x-2">
                        {logs.slice(0, 3).map((log, i) => (
                          <div 
                            key={i} 
                            className="w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-xs font-medium"
                            title={log.recipientEmail}
                          >
                            {log.recipientEmail.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {logs.length > 3 && (
                          <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                            +{logs.length - 3}
                          </div>
                        )}
                        {logs.length === 0 && <span className="text-muted-foreground text-sm">None</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1.5 px-2.5 py-0.5 ${statusColor}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusText}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}