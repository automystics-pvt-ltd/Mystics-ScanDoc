import { useState } from 'react';
import { useGetDocumentHistory } from '@workspace/api-client-react';
import { format } from 'date-fns';
import {
  File as FileIcon,
  Clock,
  Mail,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const MAX_RETRIES = 3;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          >
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">{copied ? 'Copied!' : 'Copy message ID'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LogStatusBadge({ status, retryCount }: { status: string | null | undefined; retryCount?: number | null }) {
  let StatusIcon = Clock;
  let color = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
  let label = 'Queued';

  if (status === 'sent') {
    StatusIcon = CheckCircle2;
    color = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
    label = 'Sent';
  } else if (status === 'failed') {
    StatusIcon = AlertCircle;
    color = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
    label = 'Failed';
  } else if (status === 'retry_pending') {
    StatusIcon = RefreshCw;
    color = "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
    label = `Retry ${retryCount ?? 0}/${MAX_RETRIES}`;
  }

  return (
    <Badge variant="outline" className={`gap-1 px-1.5 py-0 text-xs ${color}`}>
      <StatusIcon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

export default function History() {
  const { data: documents, isLoading } = useGetDocumentHistory();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleRow = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
              <TableHead className="w-8" />
              <TableHead className="w-[280px]">Document</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell />
                  <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                </TableRow>
              ))
            ) : documents?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No documents found in your history.
                </TableCell>
              </TableRow>
            ) : (
              documents?.flatMap((doc) => {
                const logs = doc.emailLogs || [];
                const hasFailed = logs.some(log => log.status === 'failed');
                const hasRetry = logs.some(log => log.status === 'retry_pending');
                const hasQueued = logs.some(log => log.status === 'queued');
                const allSent = logs.length > 0 && logs.every(log => log.status === 'sent');

                let StatusIcon = Clock;
                let statusColor = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
                let statusText = "Queued";

                if (hasFailed) {
                  StatusIcon = AlertCircle;
                  statusColor = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
                  statusText = "Failed";
                } else if (hasRetry) {
                  StatusIcon = RefreshCw;
                  statusColor = "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
                  statusText = "Retrying";
                } else if (allSent) {
                  StatusIcon = CheckCircle2;
                  statusColor = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
                  statusText = "Sent";
                }

                const isExpanded = expandedIds.has(doc.id);
                const hasLogs = logs.length > 0;

                const summaryRow = (
                  <TableRow
                    key={`doc-${doc.id}`}
                    className={`group transition-colors ${hasLogs ? 'cursor-pointer hover:bg-muted/20' : ''}`}
                    onClick={() => hasLogs && toggleRow(doc.id)}
                  >
                    <TableCell className="pr-0">
                      {hasLogs && (
                        isExpanded
                          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                          <FileIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground uppercase">
                            {doc.fileType.split('/')[1] || 'FILE'} • {(doc.fileSize! / 1024).toFixed(1)} KB
                          </p>
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

                if (!isExpanded || !hasLogs) return [summaryRow];

                const detailRows = logs.map((log) => (
                  <TableRow key={`log-${log.id}`} className="bg-muted/30 border-t-0">
                    <TableCell />
                    <TableCell colSpan={4} className="py-2 pl-10">
                      <div className="flex items-start gap-4 text-sm">
                        {/* Recipient */}
                        <div className="flex items-center gap-1.5 min-w-[160px] text-muted-foreground">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{log.recipientEmail}</span>
                        </div>

                        {/* Status */}
                        <LogStatusBadge status={log.status} retryCount={log.retryCount} />

                        {/* Message ID (success) */}
                        {log.status === 'sent' && log.messageId && (
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-xs text-muted-foreground shrink-0">ID:</span>
                            <code className="text-xs font-mono text-foreground truncate max-w-[200px]">
                              {log.messageId}
                            </code>
                            <CopyButton value={log.messageId} />
                          </div>
                        )}

                        {/* Error reason (failed / retry) */}
                        {(log.status === 'failed' || log.status === 'retry_pending') && log.errorMessage && (
                          <p className="text-xs text-red-600 dark:text-red-400 truncate max-w-xs" title={log.errorMessage}>
                            {log.errorMessage}
                          </p>
                        )}

                        {/* Sent time */}
                        {log.sentAt && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
                            {format(new Date(log.sentAt), 'HH:mm:ss')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ));

                return [summaryRow, ...detailRows];
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
