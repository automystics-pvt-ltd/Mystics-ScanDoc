import { useState, useMemo, useEffect } from 'react';
import { useListAuditLogs } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { ShieldAlert, RefreshCw, Filter } from 'lucide-react';
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
  user_login: 'Login',
  login_failed: 'Failed Login',
  user_logout: 'Logout',
  user_created: 'User Created',
  user_updated: 'User Updated',
  user_deleted: 'User Deleted',
  user_unlocked: 'Account Unlocked',
  document_uploaded: 'Upload',
  document_deleted: 'Doc Deleted',
  email_sent: 'Email Sent',
  email_failed: 'Email Failed',
};

/** Colour coding: security events are red/orange, normal events are neutral. */
function rowClass(action: string): string {
  if (action === 'login_failed') return 'bg-red-50 dark:bg-red-950/20';
  if (action === 'user_unlocked') return 'bg-orange-50 dark:bg-orange-950/20';
  return '';
}

function ActionBadge({ action }: { action: string }) {
  const label = ACTION_LABELS[action] ?? action;

  if (action === 'login_failed') {
    return (
      <Badge variant="outline" className="gap-1 bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 whitespace-nowrap">
        <ShieldAlert className="w-3 h-3" />
        {label}
      </Badge>
    );
  }
  if (action === 'user_unlocked') {
    return (
      <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800 whitespace-nowrap">
        {label}
      </Badge>
    );
  }
  if (action === 'user_login') {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 whitespace-nowrap">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="whitespace-nowrap">
      {label}
    </Badge>
  );
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

export default function AuditLogs() {
  const [actionFilter, setActionFilter] = useState<string>('all');

  const queryParams = actionFilter !== 'all' ? { action: actionFilter } : {};
  const { data: logs, isLoading, refetch, isFetching } = useListAuditLogs(queryParams);

  // Auto-refresh every 15 s — live feed of new security events
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
            <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-muted-foreground mt-2">
              System-wide security and activity events.
              {securityEventCount > 0 && (
                <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                  {securityEventCount} failed login{securityEventCount !== 1 ? 's' : ''} in current view.
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="login_failed">Failed logins</SelectItem>
                <SelectItem value="user_unlocked">Account unlocks</SelectItem>
                <SelectItem value="user_login">Logins</SelectItem>
                <SelectItem value="user_logout">Logouts</SelectItem>
                <SelectItem value="user_created">User created</SelectItem>
                <SelectItem value="user_updated">User updated</SelectItem>
                <SelectItem value="user_deleted">User deleted</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Time</TableHead>
                <TableHead className="w-36">Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : !logs?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No events found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className={rowClass(log.action)}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap font-mono">
                      {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={log.action} />
                    </TableCell>
                    <TableCell>
                      {log.userEmail ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{log.userName ?? '—'}</span>
                          <span className="text-xs text-muted-foreground">{log.userEmail}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.ipAddress ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs">
                      {log.details ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate block max-w-xs cursor-default">
                              {log.details}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-sm break-words">
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
