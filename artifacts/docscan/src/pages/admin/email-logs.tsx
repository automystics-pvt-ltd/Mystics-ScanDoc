import { useState, useMemo, useEffect } from 'react';
import { useListEmailLogs } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { Mail, CheckCircle2, AlertCircle, Clock, RefreshCw, Copy, Check, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { SortableHeader } from '@/components/sortable-header';
import { PaginationControls } from '@/components/pagination-controls';

const MAX_RETRIES = 3;
const PAGE_SIZE = 10;

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
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground bg-muted ml-2"
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
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [sortKey, setSortKey] = useState<string>("sentAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return (logs ?? []).filter(l => {
      const matchSearch = 
        l.recipientEmail.toLowerCase().includes(search.toLowerCase()) || 
        (l.documentName && l.documentName.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [logs, search, statusFilter]);

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

  useEffect(() => setPage(1), [search, statusFilter, sortKey, sortDir]);

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
      <h1 className="text-2xl font-bold tracking-tight">Delivery Logs</h1>

      <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search recipients or documents..." 
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="retry_pending">Retry Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 hover:bg-muted/40">
              <TableRow>
                <TableHead className="w-[120px]">
                  <SortableHeader label="State" sortKey="status" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Document" sortKey="documentName" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Recipient" sortKey="recipientEmail" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Sender" sortKey="senderName" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <span>Diagnostics</span>
                </TableHead>
                <TableHead className="w-[140px]">
                  <SortableHeader label="Timestamp" sortKey="sentAt" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading logs...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No logs found.</TableCell></TableRow>
              ) : paginated.map((log) => {
                const retryCount = log.retryCount ?? 0;
                
                let StatusIcon = Clock;
                let statusColor = "bg-muted text-muted-foreground";
                let statusLabel = 'QUEUED';

                if (log.status === 'failed') {
                  StatusIcon = AlertCircle;
                  statusColor = "bg-destructive/10 text-destructive";
                  statusLabel = 'FAILED';
                } else if (log.status === 'sent') {
                  StatusIcon = CheckCircle2;
                  statusColor = "bg-green-500/10 text-green-600";
                  statusLabel = 'SENT';
                } else if (log.status === 'retry_pending') {
                  StatusIcon = RefreshCw;
                  statusColor = "bg-orange-500/10 text-orange-600";
                  statusLabel = `RETRY ${retryCount}/${MAX_RETRIES}`;
                }

                return (
                  <TableRow key={log.id} className="hover:bg-muted/20">
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 px-1.5 py-0.5 text-[10px] tracking-widest font-bold border-0 ${statusColor}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm truncate max-w-[200px]" title={log.documentName || `Doc #${log.documentId}`}>
                      {log.documentName || `Doc #${log.documentId}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm font-mono">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{log.recipientEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {log.senderName || `User #${log.senderId}`}
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      {log.status === 'sent' && log.messageId ? (
                        <div className="flex items-center text-xs text-muted-foreground">
                          ID: <code className="ml-1 font-mono text-foreground truncate">{log.messageId}</code>
                          <CopyButton value={log.messageId} />
                        </div>
                      ) : log.errorMessage ? (
                        <div className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{log.errorMessage}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm opacity-50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {log.sentAt ? format(new Date(log.sentAt), 'MMM d, HH:mm') : '-'}
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
