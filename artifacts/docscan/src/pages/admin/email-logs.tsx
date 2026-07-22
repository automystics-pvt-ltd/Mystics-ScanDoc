import { useListEmailLogs } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Mail, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

export default function EmailLogs() {
  const { data: logs, isLoading } = useListEmailLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Logs</h1>
        <p className="text-muted-foreground mt-2">System-wide email delivery history and status.</p>
      </div>

      <div className="bg-card border rounded-xl shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Sender</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : logs?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No email logs found.</TableCell></TableRow>
            ) : logs?.map((log) => {
              const retryCount = log.retryCount ?? 0;
              const nextRetryAt = log.nextRetryAt;

              let StatusIcon = Clock;
              let statusColor = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
              let statusLabel: string = log.status ?? 'queued';

              if (log.status === 'failed') {
                StatusIcon = AlertCircle;
                statusColor = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
                statusLabel = 'Failed';
              } else if (log.status === 'sent') {
                StatusIcon = CheckCircle2;
                statusColor = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
                statusLabel = 'Sent';
              } else if (log.status === 'retry_pending') {
                StatusIcon = RefreshCw;
                statusColor = "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
                statusLabel = `Retry ${retryCount}/${MAX_RETRIES}`;
              } else {
                statusLabel = 'Queued';
              }

              const badge = (
                <Badge variant="outline" className={`gap-1.5 px-2 py-0.5 ${statusColor}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusLabel}
                </Badge>
              );

              const tooltipContent = log.status === 'retry_pending' && nextRetryAt
                ? `Next retry at ${format(new Date(nextRetryAt), 'HH:mm:ss')}${log.errorMessage ? ` — ${log.errorMessage}` : ''}`
                : log.status === 'failed' && log.errorMessage
                ? log.errorMessage
                : null;

              return (
                <TableRow key={log.id}>
                  <TableCell>
                    {tooltipContent ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>{badge}</TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">{tooltipContent}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : badge}
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.documentName || `Doc #${log.documentId}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{log.recipientEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {log.senderName || `User #${log.senderId}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {log.sentAt ? format(new Date(log.sentAt), 'MMM d, HH:mm:ss') : '-'}
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
