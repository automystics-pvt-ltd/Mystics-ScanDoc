import { useState } from 'react';
import { useListEmailLogs } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Mail, CheckCircle2, AlertCircle, Clock, RefreshCw, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 ml-2"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs font-mono">{copied ? 'Copied!' : 'Copy MSG-ID'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function EmailLogs() {
  const { data: logs, isLoading } = useListEmailLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Delivery Logs</h1>
        <p className="text-muted-foreground mt-2">Network-level diagnostics for email routing.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-semibold text-foreground w-[120px]">State</TableHead>
              <TableHead className="font-semibold text-foreground">Payload</TableHead>
              <TableHead className="font-semibold text-foreground">Target</TableHead>
              <TableHead className="font-semibold text-foreground">Dispatcher</TableHead>
              <TableHead className="font-semibold text-foreground">Diagnostics</TableHead>
              <TableHead className="font-semibold text-foreground w-[100px]">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 font-medium text-muted-foreground">Compiling logs...</TableCell></TableRow>
            ) : logs?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 font-medium text-muted-foreground">No traffic logged.</TableCell></TableRow>
            ) : logs?.map((log) => {
              const retryCount = log.retryCount ?? 0;
              const nextRetryAt = log.nextRetryAt;

              let StatusIcon = Clock;
              let statusColor = "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50";
              let statusLabel: string = 'QUEUED';

              if (log.status === 'failed') {
                StatusIcon = AlertCircle;
                statusColor = "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20 dark:text-red-400 dark:border-destructive/30";
                statusLabel = 'FAILED';
              } else if (log.status === 'sent') {
                StatusIcon = CheckCircle2;
                statusColor = "bg-green-50 text-green-700 border-green-200/60 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/50";
                statusLabel = 'SENT';
              } else if (log.status === 'retry_pending') {
                StatusIcon = RefreshCw;
                statusColor = "bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50";
                statusLabel = `RETRY ${retryCount}/${MAX_RETRIES}`;
              }

              const badge = (
                <Badge variant="outline" className={`gap-1.5 px-2 py-0.5 text-[10px] tracking-widest font-bold ${statusColor}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusLabel}
                </Badge>
              );

              const retryTooltip = log.status === 'retry_pending' && nextRetryAt
                ? `Next attempt: ${format(new Date(nextRetryAt), 'HH:mm:ss')}`
                : null;

              return (
                <TableRow key={log.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell>
                    {retryTooltip ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>{badge}</TooltipTrigger>
                          <TooltipContent className="text-xs font-mono">{retryTooltip}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : badge}
                  </TableCell>

                  <TableCell className="font-semibold text-sm max-w-[200px] truncate" title={log.documentName || `Doc #${log.documentId}`}>
                    {log.documentName || `Doc #${log.documentId}`}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2 text-sm font-mono">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                      <span className="truncate">{log.recipientEmail}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground text-sm font-medium">
                    {log.senderName || `User #${log.senderId}`}
                  </TableCell>

                  <TableCell className="max-w-[280px]">
                    {log.status === 'sent' && log.messageId ? (
                      <div className="flex items-center min-w-0 bg-muted/50 border border-border/50 rounded pl-2 pr-1 py-1 w-fit">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mr-2">ID</span>
                        <code className="text-xs font-mono text-foreground truncate">
                          {log.messageId}
                        </code>
                        <CopyButton value={log.messageId} />
                      </div>
                    ) : log.errorMessage ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 text-destructive bg-destructive/5 border border-destructive/10 px-2 py-1 rounded text-xs font-medium cursor-default">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{log.errorMessage}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs bg-destructive text-destructive-foreground font-mono">{log.errorMessage}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-muted-foreground text-sm opacity-50">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                    {log.sentAt ? (
                      <>
                        <span>{format(new Date(log.sentAt), 'MMM d')}</span><br/>
                        <span className="opacity-70">{format(new Date(log.sentAt), 'HH:mm:ss')}</span>
                      </>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
