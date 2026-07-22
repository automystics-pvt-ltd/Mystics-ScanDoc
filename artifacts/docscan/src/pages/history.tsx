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
import { motion, AnimatePresence } from 'framer-motion';

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
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs font-mono">{copied ? 'Copied!' : 'Copy ID'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LogStatusBadge({ status, retryCount }: { status: string | null | undefined; retryCount?: number | null }) {
  let StatusIcon = Clock;
  let color = "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50";
  let label = 'Queued';

  if (status === 'sent') {
    StatusIcon = CheckCircle2;
    color = "bg-green-50 text-green-700 border-green-200/60 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/50";
    label = 'Sent';
  } else if (status === 'failed') {
    StatusIcon = AlertCircle;
    color = "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-red-400 dark:border-destructive/30";
    label = 'Failed';
  } else if (status === 'retry_pending') {
    StatusIcon = RefreshCw;
    color = "bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50";
    label = `Retry ${retryCount ?? 0}/${MAX_RETRIES}`;
  }

  return (
    <Badge variant="outline" className={`gap-1.5 px-2 py-0.5 text-xs font-medium ${color}`}>
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Transmission Log</h1>
        <p className="text-muted-foreground">Trace the delivery status of your uploaded documents.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b-border/60">
              <TableHead className="w-10 text-center"></TableHead>
              <TableHead className="w-[300px] font-semibold text-foreground">Document</TableHead>
              <TableHead className="font-semibold text-foreground">Uploaded</TableHead>
              <TableHead className="font-semibold text-foreground">Recipients</TableHead>
              <TableHead className="font-semibold text-foreground">Aggregate Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b-border/40">
                  <TableCell />
                  <TableCell><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-lg" /><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-16" /></div></div></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : documents?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <FileIcon className="w-10 h-10 mb-3 opacity-20" />
                    <p className="font-medium text-foreground">No documents found</p>
                    <p className="text-sm">You haven't scanned and sent any documents yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              documents?.flatMap((doc) => {
                const logs = doc.emailLogs || [];
                const hasFailed = logs.some(log => log.status === 'failed');
                const hasRetry = logs.some(log => log.status === 'retry_pending');
                const allSent = logs.length > 0 && logs.every(log => log.status === 'sent');

                let StatusIcon = Clock;
                let statusColor = "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50";
                let statusText = "Processing";

                if (hasFailed) {
                  StatusIcon = AlertCircle;
                  statusColor = "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-red-400 dark:border-destructive/30";
                  statusText = "Error";
                } else if (hasRetry) {
                  StatusIcon = RefreshCw;
                  statusColor = "bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50";
                  statusText = "Retrying";
                } else if (allSent) {
                  StatusIcon = CheckCircle2;
                  statusColor = "bg-green-50 text-green-700 border-green-200/60 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/50";
                  statusText = "Delivered";
                }

                const isExpanded = expandedIds.has(doc.id);
                const hasLogs = logs.length > 0;

                const summaryRow = (
                  <TableRow
                    key={`doc-${doc.id}`}
                    className={`group transition-colors border-b-border/40 ${hasLogs ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                    onClick={() => hasLogs && toggleRow(doc.id)}
                  >
                    <TableCell className="pr-0 pl-4">
                      {hasLogs && (
                        <div className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-muted' : 'group-hover:bg-muted'}`}>
                          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center shrink-0">
                          <FileIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate max-w-[220px]" title={doc.fileName}>{doc.fileName}</p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono mt-0.5">
                            <span className="uppercase bg-muted px-1 py-0.5 rounded text-[10px]">{doc.fileType.split('/')[1] || 'FILE'}</span>
                            <span>{(doc.fileSize! / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {format(new Date(doc.uploadedAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {logs.length > 0 ? (
                          <div className="flex -space-x-2 mr-2">
                            {logs.slice(0, 3).map((log, i) => (
                              <TooltipProvider key={i}>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <div className="w-7 h-7 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[10px] font-bold text-secondary-foreground shadow-sm relative z-10 hover:z-20 hover:-translate-y-1 transition-transform">
                                      {log.recipientEmail.charAt(0).toUpperCase()}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>{log.recipientEmail}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm font-medium">None</span>
                        )}
                        {logs.length > 3 && (
                          <span className="text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            +{logs.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1.5 px-2.5 py-0.5 font-medium ${statusColor}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusText}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );

                if (!isExpanded || !hasLogs) return [summaryRow];

                const detailRows = (
                  <TableRow key={`log-container-${doc.id}`} className="bg-muted/10 border-b-border/60 hover:bg-muted/10">
                    <TableCell colSpan={5} className="p-0 border-0">
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-14 pr-6 py-4">
                          <div className="border border-border/60 rounded-lg bg-card shadow-sm overflow-hidden">
                            <Table>
                              <TableBody>
                                {logs.map((log) => (
                                  <TableRow key={`log-${log.id}`} className="border-b-border/40 last:border-0 hover:bg-transparent">
                                    <TableCell className="w-[30%] py-3">
                                      <div className="flex items-center gap-2 text-sm font-medium">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        <span className="truncate">{log.recipientEmail}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="w-[20%] py-3">
                                      <LogStatusBadge status={log.status} retryCount={log.retryCount} />
                                    </TableCell>
                                    <TableCell className="w-[35%] py-3">
                                      {log.status === 'sent' && log.messageId && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">ID</span>
                                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground truncate max-w-[150px]">
                                            {log.messageId}
                                          </code>
                                          <CopyButton value={log.messageId} />
                                        </div>
                                      )}
                                      {(log.status === 'failed' || log.status === 'retry_pending') && log.errorMessage && (
                                        <div className="flex items-start gap-1.5 text-destructive bg-destructive/5 p-1.5 rounded-md border border-destructive/10">
                                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                          <p className="text-xs font-medium leading-snug line-clamp-2" title={log.errorMessage}>
                                            {log.errorMessage}
                                          </p>
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="w-[15%] py-3 text-right">
                                      {log.sentAt && (
                                        <span className="text-xs font-mono text-muted-foreground">
                                          {format(new Date(log.sentAt), 'HH:mm:ss')}
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </motion.div>
                    </TableCell>
                  </TableRow>
                );

                return [summaryRow, detailRows];
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
