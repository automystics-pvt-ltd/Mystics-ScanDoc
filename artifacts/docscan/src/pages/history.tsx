import { useState, useMemo, useEffect } from 'react';
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
  Search
} from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';

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
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground bg-muted"
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

export default function History() {
  const { data: documents, isLoading } = useGetDocumentHistory();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [sortKey, setSortKey] = useState<string>("uploadedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const toggleRow = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getDocStatus = (logs: any[]) => {
    const hasFailed = logs.some(log => log.status === 'failed');
    const hasRetry = logs.some(log => log.status === 'retry_pending');
    const allSent = logs.length > 0 && logs.every(log => log.status === 'sent');
    if (hasFailed) return 'failed';
    if (hasRetry) return 'retry_pending';
    if (allSent) return 'sent';
    return 'queued';
  };

  const filtered = useMemo(() => {
    return (documents ?? []).filter(doc => {
      const matchSearch = doc.fileName.toLowerCase().includes(search.toLowerCase());
      const docStatus = getDocStatus(doc.emailLogs || []);
      const matchStatus = statusFilter === "all" || docStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [documents, search, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: any = a[sortKey as keyof typeof a];
      let bVal: any = b[sortKey as keyof typeof b];
      
      if (sortKey === 'status') {
        aVal = getDocStatus(a.emailLogs || []);
        bVal = getDocStatus(b.emailLogs || []);
      }
      
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
      <h1 className="text-2xl font-bold tracking-tight">Send History</h1>

      <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents..." 
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
                <SelectItem value="queued">Processing</SelectItem>
                <SelectItem value="sent">Delivered</SelectItem>
                <SelectItem value="failed">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <Table>
            <TableHeader className="bg-muted/40 hover:bg-muted/40">
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>
                  <SortableHeader label="Document Name" sortKey="fileName" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Size" sortKey="fileSize" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Uploaded Date" sortKey="uploadedAt" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>
                  <SortableHeader label="Status" sortKey="status" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading history...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No documents found.</TableCell></TableRow>
              ) : paginated.flatMap((doc) => {
                const logs = doc.emailLogs || [];
                const docStatus = getDocStatus(logs);
                const isExpanded = expandedIds.has(doc.id);
                const hasLogs = logs.length > 0;

                let StatusIcon = Clock;
                let statusColor = "bg-muted text-muted-foreground border-0";
                let statusText = "Processing";

                if (docStatus === 'failed') {
                  StatusIcon = AlertCircle;
                  statusColor = "bg-destructive/10 text-destructive border-0";
                  statusText = "Error";
                } else if (docStatus === 'retry_pending') {
                  StatusIcon = RefreshCw;
                  statusColor = "bg-orange-500/10 text-orange-600 border-0";
                  statusText = "Retrying";
                } else if (docStatus === 'sent') {
                  StatusIcon = CheckCircle2;
                  statusColor = "bg-green-500/10 text-green-600 border-0";
                  statusText = "Delivered";
                }

                const summaryRow = (
                  <TableRow
                    key={`doc-${doc.id}`}
                    className={`group hover:bg-muted/20 ${hasLogs ? 'cursor-pointer' : ''}`}
                    onClick={() => hasLogs && toggleRow(doc.id)}
                  >
                    <TableCell className="pr-0 pl-4">
                      {hasLogs && (
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                          <FileIcon className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium truncate max-w-[200px]" title={doc.fileName}>{doc.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {(doc.fileSize! / 1024).toFixed(1)} KB
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(doc.uploadedAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UsersGroup logs={logs} />
                        <span className="text-xs text-muted-foreground font-medium">{logs.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 px-2 py-0.5 uppercase tracking-widest text-[10px] font-bold ${statusColor}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusText}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );

                if (!isExpanded || !hasLogs) return [summaryRow];

                const detailRows = (
                  <TableRow key={`log-container-${doc.id}`} className="bg-muted/10 border-b-border hover:bg-muted/10">
                    <TableCell colSpan={6} className="p-0 border-0">
                      <div className="pl-14 pr-6 py-4">
                        <div className="border border-border bg-card rounded-md shadow-sm overflow-hidden">
                          <Table>
                            <TableBody>
                              {logs.map((log) => {
                                let SubStatusIcon = Clock;
                                let subStatusColor = "bg-muted text-muted-foreground border-0";
                                let subStatusText = "Queued";
                                
                                if (log.status === 'sent') {
                                  SubStatusIcon = CheckCircle2;
                                  subStatusColor = "bg-green-500/10 text-green-600 border-0";
                                  subStatusText = "Sent";
                                } else if (log.status === 'failed') {
                                  SubStatusIcon = AlertCircle;
                                  subStatusColor = "bg-destructive/10 text-destructive border-0";
                                  subStatusText = "Failed";
                                } else if (log.status === 'retry_pending') {
                                  SubStatusIcon = RefreshCw;
                                  subStatusColor = "bg-orange-500/10 text-orange-600 border-0";
                                  subStatusText = `Retry ${log.retryCount}/${MAX_RETRIES}`;
                                }

                                return (
                                  <TableRow key={`log-${log.id}`} className="border-b-border hover:bg-transparent">
                                    <TableCell className="py-2">
                                      <div className="flex items-center gap-2 text-sm">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        <span>{log.recipientEmail}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                      <Badge variant="outline" className={`gap-1 px-1.5 py-0 text-[10px] uppercase font-bold tracking-wider ${subStatusColor}`}>
                                        <SubStatusIcon className="w-3 h-3" />
                                        {subStatusText}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="py-2 w-[40%]">
                                      {log.status === 'sent' && log.messageId && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <span>ID:</span>
                                          <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">{log.messageId}</code>
                                          <CopyButton value={log.messageId} />
                                        </div>
                                      )}
                                      {(log.status === 'failed' || log.status === 'retry_pending') && log.errorMessage && (
                                        <div className="text-xs text-destructive flex items-center gap-1">
                                          <AlertCircle className="w-3.3 h-3.3 shrink-0" />
                                          <span className="truncate max-w-[200px]">{log.errorMessage}</span>
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );

                return [summaryRow, detailRows];
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

function UsersGroup({ logs }: { logs: any[] }) {
  if (!logs || logs.length === 0) return null;
  return (
    <div className="flex -space-x-2">
      {logs.slice(0, 3).map((log, i) => (
        <TooltipProvider key={i}>
          <Tooltip>
            <TooltipTrigger>
              <div className="w-6 h-6 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-[9px] font-bold text-primary relative z-10 hover:z-20">
                {log.recipientEmail.charAt(0).toUpperCase()}
              </div>
            </TooltipTrigger>
            <TooltipContent>{log.recipientEmail}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
