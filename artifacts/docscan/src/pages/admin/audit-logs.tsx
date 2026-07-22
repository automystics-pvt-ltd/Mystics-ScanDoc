import { useState, useMemo, useEffect } from 'react';
import { useListAuditLogs } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { ShieldAlert, RefreshCw, Filter, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const ACTION_LABELS: Record<string, string> = {
  user_login: 'AUTH_SUCCESS',
  login_failed: 'AUTH_REJECT',
  user_logout: 'SESSION_END',
  user_created: 'USER_INIT',
  user_updated: 'USER_PATCH',
  user_deleted: 'USER_PURGE',
  user_unlocked: 'LOCK_CLEAR',
  document_uploaded: 'DOC_INGEST',
  document_deleted: 'DOC_PURGE',
  email_sent: 'NET_TX_OK',
  email_failed: 'NET_TX_ERR',
};

function rowClass(action: string): string {
  if (action === 'login_failed') return 'bg-destructive/5 hover:bg-destructive/10';
  if (action === 'user_unlocked') return 'bg-orange-500/5 hover:bg-orange-500/10';
  return 'hover:bg-muted/20 transition-colors';
}

function ActionBadge({ action }: { action: string }) {
  const label = ACTION_LABELS[action] ?? action.toUpperCase();

  if (action === 'login_failed') {
    return (
      <Badge variant="outline" className="gap-1.5 bg-destructive/10 text-destructive border-destructive/20 whitespace-nowrap font-mono text-[10px] tracking-widest px-2">
        <ShieldAlert className="w-3 h-3" />
        {label}
      </Badge>
    );
  }
  if (action === 'user_unlocked') {
    return (
      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 whitespace-nowrap font-mono text-[10px] tracking-widest px-2">
        {label}
      </Badge>
    );
  }
  if (action === 'user_login') {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 whitespace-nowrap font-mono text-[10px] tracking-widest px-2">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground border-border/60 whitespace-nowrap font-mono text-[10px] tracking-widest px-2">
      {label}
    </Badge>
  );
}

export default function AuditLogs() {
  const [actionFilter, setActionFilter] = useState<string>('all');

  const queryParams = actionFilter !== 'all' ? { action: actionFilter } : {};
  const { data: logs, isLoading, refetch, isFetching } = useListAuditLogs(queryParams);

  useEffect(() => {
    const id = setInterval(() => { refetch(); }, 15_000);
    return () => clearInterval(id);
  }, [refetch]);

  const securityEventCount = useMemo(
    () => logs?.filter((l) => l.action === 'login_failed').length ?? 0,
    [logs]
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Security Feed</h1>
            <p className="text-muted-foreground mt-2 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Raw telemetry and system access events.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 bg-card p-2 rounded-lg border border-border shadow-sm">
            {securityEventCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-destructive/10 text-destructive rounded font-semibold text-sm border border-destructive/20 animate-pulse">
                <ShieldAlert className="w-4 h-4" />
                <span>{securityEventCount} Rejects</span>
              </div>
            )}
            <div className="h-6 w-px bg-border/60 mx-1"></div>
            <Filter className="w-4 h-4 text-muted-foreground ml-1" />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-44 h-8 bg-transparent border-0 shadow-none font-medium">
                <SelectValue placeholder="All Streams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Streams</SelectItem>
                <SelectItem value="login_failed">Auth Rejects</SelectItem>
                <SelectItem value="user_unlocked">Lock Clears</SelectItem>
                <SelectItem value="user_login">Auth Success</SelectItem>
                <SelectItem value="document_uploaded">Ingestions</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[140px] font-semibold text-foreground">Timestamp</TableHead>
                <TableHead className="w-[160px] font-semibold text-foreground">Directive</TableHead>
                <TableHead className="font-semibold text-foreground">Principal</TableHead>
                <TableHead className="font-semibold text-foreground">Vector</TableHead>
                <TableHead className="font-semibold text-foreground">Payload Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">
                    Awaiting stream...
                  </TableCell>
                </TableRow>
              ) : !logs?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">
                    Stream idle.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className={rowClass(log.action)}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap font-mono tracking-tight">
                      <div className="flex flex-col">
                        <span>{format(new Date(log.createdAt), 'yy/MM/dd')}</span>
                        <span className="text-foreground">{format(new Date(log.createdAt), 'HH:mm:ss.SSS')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={log.action} />
                    </TableCell>
                    <TableCell>
                      {log.userEmail ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{log.userName ?? 'SYS'}</span>
                          <span className="text-xs text-muted-foreground font-mono">{log.userEmail}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">SYS_AUTH</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {log.ipAddress ? (
                        <span className="bg-muted px-1.5 py-0.5 rounded border border-border/50">{log.ipAddress}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.details ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block max-w-[300px] cursor-default font-mono text-xs">
                              {log.details}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-md break-words font-mono text-xs">
                            {log.details}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
