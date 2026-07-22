import { useState, useMemo, useEffect } from 'react';
import { useListAuditLogs } from '@workspace/api-client-react';
import { format } from 'date-fns';
import {
  LogIn,
  LogOut,
  AlertTriangle,
  Lock,
  Unlock,
  UserPlus,
  UserX,
  UserCog,
  Send,
  Shield,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

type RowStyle = {
  row: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

function getRowStyle(action: string): RowStyle {
  switch (action) {
    case 'login_failed':
      return {
        row: 'bg-red-50 dark:bg-red-950/20',
        badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
        icon: AlertTriangle,
        label: 'Failed Login',
      };
    case 'account_locked':
      return {
        row: 'bg-orange-50 dark:bg-orange-950/20',
        badge: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
        icon: Lock,
        label: 'Account Locked',
      };
    case 'user_unlocked':
      return {
        row: 'bg-orange-50/50 dark:bg-orange-950/10',
        badge: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
        icon: Unlock,
        label: 'Account Unlocked',
      };
    case 'user_login':
      return {
        row: '',
        badge: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
        icon: LogIn,
        label: 'Login',
      };
    case 'user_logout':
      return {
        row: '',
        badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
        icon: LogOut,
        label: 'Logout',
      };
    case 'user_created':
      return {
        row: '',
        badge: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
        icon: UserPlus,
        label: 'User Created',
      };
    case 'user_deleted':
      return {
        row: '',
        badge: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
        icon: UserX,
        label: 'User Deleted',
      };
    case 'user_updated':
      return {
        row: '',
        badge: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
        icon: UserCog,
        label: 'User Updated',
      };
    case 'document_sent':
      return {
        row: '',
        badge: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
        icon: Send,
        label: 'Document Sent',
      };
    default:
      return {
        row: '',
        badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
        icon: Shield,
        label: action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      };
  }
}

export default function AuditLogs() {
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);

  const { data: logs, isLoading, refetch, isFetching } = useListAuditLogs({
    action: actionFilter === 'all' ? undefined : actionFilter,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  // Auto-refresh every 15 s — live feed of security events
  useEffect(() => {
    const id = setInterval(() => { refetch(); }, 15_000);
    return () => clearInterval(id);
  }, [refetch]);

  const securityEventCount = useMemo(
    () => logs?.filter((l) => l.action === 'login_failed' || l.action === 'account_locked').length ?? 0,
    [logs]
  );

  const hasNextPage = (logs?.length ?? 0) === PAGE_SIZE;
  const hasPrevPage = page > 0;

  function handleFilterChange(value: string) {
    setActionFilter(value);
    setPage(0);
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-muted-foreground mt-2">
              System-wide security and activity events. Updates every 15 seconds.
              {securityEventCount > 0 && (
                <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
                  <ShieldAlert className="inline w-3.5 h-3.5 mr-1" />
                  {securityEventCount} security event{securityEventCount !== 1 ? 's' : ''} in current view.
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-1">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={actionFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                <SelectItem value="login_failed">Failed logins</SelectItem>
                <SelectItem value="account_locked">Account lockouts</SelectItem>
                <SelectItem value="user_unlocked">Account unlocks</SelectItem>
                <SelectItem value="user_login">Logins</SelectItem>
                <SelectItem value="user_logout">Logouts</SelectItem>
                <SelectItem value="user_created">User created</SelectItem>
                <SelectItem value="user_updated">User updated</SelectItem>
                <SelectItem value="user_deleted">User deleted</SelectItem>
                <SelectItem value="document_sent">Document sent</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Time</TableHead>
                <TableHead className="w-44">Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="w-36">IP Address</TableHead>
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
                logs.map((log) => {
                  const style = getRowStyle(log.action);
                  const Icon = style.icon;
                  return (
                    <TableRow key={log.id} className={cn('transition-colors', style.row)}>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap font-mono">
                        {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('gap-1.5 px-2 py-0.5 whitespace-nowrap', style.badge)}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {style.label}
                        </Badge>
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
                      <TableCell className="max-w-xs">
                        {log.details ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm text-muted-foreground truncate cursor-default">
                                {log.details}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-sm break-words text-xs">
                              {log.details}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {logs && logs.length > 0
              ? `Showing ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + logs.length}`
              : 'No results'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNextPage}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
