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
  Filter,
  RefreshCw,
  Search
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import { SortableHeader } from '@/components/sortable-header';
import { PaginationControls } from '@/components/pagination-controls';

const PAGE_SIZE = 10;

function getRowStyle(action: string) {
  switch (action) {
    case 'login_failed':
      return { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' };
    case 'account_locked':
      return { icon: Lock, color: 'text-orange-600', bg: 'bg-orange-500/10' };
    case 'user_unlocked':
      return { icon: Unlock, color: 'text-orange-600', bg: 'bg-orange-500/10' };
    case 'user_login':
      return { icon: LogIn, color: 'text-green-600', bg: 'bg-green-500/10' };
    case 'user_logout':
      return { icon: LogOut, color: 'text-muted-foreground', bg: 'bg-muted' };
    case 'user_created':
      return { icon: UserPlus, color: 'text-primary', bg: 'bg-primary/10' };
    case 'user_deleted':
      return { icon: UserX, color: 'text-destructive', bg: 'bg-destructive/10' };
    case 'user_updated':
      return { icon: UserCog, color: 'text-blue-600', bg: 'bg-blue-500/10' };
    case 'document_sent':
      return { icon: Send, color: 'text-primary', bg: 'bg-primary/10' };
    default:
      return { icon: Shield, color: 'text-muted-foreground', bg: 'bg-muted' };
  }
}

export default function AuditLogs() {
  const { data: logs, isLoading, refetch, isFetching } = useListAuditLogs({ limit: 500 });
  
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  
  const [sortKey, setSortKey] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // Auto-refresh every 15 s
  useEffect(() => {
    const id = setInterval(() => { refetch(); }, 15_000);
    return () => clearInterval(id);
  }, [refetch]);

  const filtered = useMemo(() => {
    return (logs ?? []).filter(l => {
      const matchSearch = 
        (l.userEmail && l.userEmail.toLowerCase().includes(search.toLowerCase())) ||
        (l.ipAddress && l.ipAddress.toLowerCase().includes(search.toLowerCase())) ||
        (l.details && l.details.toLowerCase().includes(search.toLowerCase()));
      const matchAction = actionFilter === "all" || l.action === actionFilter;
      return matchSearch && matchAction;
    });
  }, [logs, search, actionFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: any = a[sortKey as keyof typeof a];
      let bVal: any = b[sortKey as keyof typeof b];
      
      if (!aVal) aVal = "";
      if (!bVal) bVal = "";
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const paginated = useMemo(() => {
    return sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [sorted, page]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  useEffect(() => setPage(1), [search, actionFilter, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search user, IP, details..." 
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[200px]">
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
          </div>
        </div>

        <div className="overflow-x-auto min-h-[500px]">
          <Table>
            <TableHeader className="bg-muted/40 hover:bg-muted/40">
              <TableRow>
                <TableHead className="w-[160px]">
                  <SortableHeader label="Timestamp" sortKey="createdAt" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[180px]">
                  <SortableHeader label="Event" sortKey="action" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="User" sortKey="userEmail" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[140px]">
                  <SortableHeader label="IP Address" sortKey="ipAddress" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Details" sortKey="details" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Loading audit logs...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No events found.</TableCell></TableRow>
              ) : paginated.map((log) => {
                const style = getRowStyle(log.action);
                const Icon = style.icon;
                const isHighlight = log.action === 'login_failed' || log.action === 'account_locked';
                
                return (
                  <TableRow key={log.id} className={cn('hover:bg-muted/20', isHighlight && 'bg-destructive/5 hover:bg-destructive/10')}>
                    <TableCell className="text-muted-foreground text-sm font-mono whitespace-nowrap">
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('gap-1.5 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider border-0', style.bg, style.color)}>
                        <Icon className="w-3 h-3" />
                        {log.action.replace(/_/g, ' ')}
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
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {log.ipAddress ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[250px]" title={log.details ?? ""}>
                      {log.details ?? '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <PaginationControls 
          page={page} 
          totalPages={totalPages} 
          totalItems={filtered.length} 
          pageSize={PAGE_SIZE} 
          onPageChange={setPage} 
        />
      </div>
    </div>
  );
}
