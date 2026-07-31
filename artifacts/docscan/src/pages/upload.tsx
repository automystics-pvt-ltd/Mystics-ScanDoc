import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import {
  Send, Loader2, CheckCircle2, XCircle, Clock,
  Printer, RefreshCw, Search, FileText, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PaginationControls } from '@/components/pagination-controls';

// ── types ─────────────────────────────────────────────────────────────────────
type DispatchStatus = 'queued' | 'sent' | 'failed' | 'pending';

type ScanDoc = {
  id: number;
  fileName: string;
  fileSize: number | null;
  uploadedAt: string;
  dispatchStatus: DispatchStatus;
  _dispatching?: boolean;
};

type Stats = { total: number; queued: number; pending: number; sent: number; failed: number };

type PageResult = {
  items: ScanDoc[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: Stats;
};

type DateRange    = 'all' | 'today' | 'week' | 'month';
type StatusFilter = 'all' | 'queued' | 'pending' | 'sent' | 'failed';

const PAGE_SIZE = 10;

// ── helpers ───────────────────────────────────────────────────────────────────
function fromDate(range: DateRange): string | undefined {
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (range === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 6);  return d.toISOString(); }
  if (range === 'month') { const d = new Date(now); d.setDate(d.getDate() - 29); return d.toISOString(); }
  return undefined;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  queued:       { label: 'Queued',   cls: 'bg-amber-50 text-amber-700 border-amber-200',  icon: <Clock className="w-3 h-3" /> },
  pending:      { label: 'Retrying', cls: 'bg-blue-50 text-blue-700 border-blue-200',     icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
  sent:         { label: 'Sent',     cls: 'bg-green-50 text-green-700 border-green-200',  icon: <CheckCircle2 className="w-3 h-3" /> },
  failed:       { label: 'Failed',   cls: 'bg-red-50 text-red-700 border-red-200',        icon: <XCircle className="w-3 h-3" /> },
  _dispatching: { label: 'Sending…', cls: 'bg-primary/10 text-primary border-primary/20', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.queued;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap', cfg.cls)}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ── stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, active, onClick }: {
  label: string; value: number; icon: React.ReactNode;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 bg-card border rounded-xl p-4 text-left transition-all',
        onClick ? 'hover:border-primary/40 hover:shadow-sm cursor-pointer' : 'cursor-default',
        active ? 'border-primary ring-1 ring-primary/20 shadow-sm' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center',
          active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>{icon}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </button>
  );
}

// ── main component ─────────────────────────────────────────────────────────────
export default function Upload() {
  const { toast } = useToast();

  const [docs,         setDocs]         = useState<ScanDoc[]>([]);
  const [total,        setTotal]        = useState(0);
  const [totalPages,   setTotalPages]   = useState(1);
  const [stats,        setStats]        = useState<Stats>({ total: 0, queued: 0, pending: 0, sent: 0, failed: 0 });
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRange,    setDateRange]    = useState<DateRange>('all');
  const [search,       setSearch]       = useState('');
  const [watchPath,    setWatchPath]    = useState('');
  const [lastRefresh,  setLastRefresh]  = useState<Date | null>(null);

  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a stable ref to the latest fetchDocs so the poll interval never
  // needs to be recreated when filters change (avoids stale closures).
  const fetchDocsCb = useRef<(p: number, silent?: boolean) => Promise<void>>(async () => {});

  // ── fetch ───────────────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async (p: number, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token  = localStorage.getItem('docscan_token') ?? '';
      if (!token) return;                       // not logged in — skip silently
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE), status: statusFilter });
      const from   = fromDate(dateRange);
      if (from) params.set('from', from);

      const r = await fetch(`${import.meta.env.BASE_URL}api/scanner/documents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data: PageResult = await r.json();

      setDocs((prev) => {
        const busy = new Set(prev.filter((d) => d._dispatching).map((d) => d.id));
        return data.items.map((d) => ({ ...d, _dispatching: busy.has(d.id) ? true : undefined }));
      });
      setTotal(data.total);
      setTotalPages(data.totalPages);
      if (data.stats) setStats(data.stats);
      setLastRefresh(new Date());
    } catch {}
    finally { if (!silent) setLoading(false); }
  }, [statusFilter, dateRange]);

  // Keep the ref current so the poll always calls the latest version
  useEffect(() => { fetchDocsCb.current = fetchDocs; }, [fetchDocs]);

  // Fetch whenever page or fetchDocs (filters) changes — fetchDocs already
  // captures statusFilter/dateRange so we don't need them as extra deps.
  useEffect(() => { fetchDocs(page); }, [page, fetchDocs]);
  useEffect(() => { setPage(1); }, [statusFilter, dateRange, search]);

  // Stable 8-second poll — only restart when page changes, not on every filter change
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchDocsCb.current(page, true), 8_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [page]);

  useEffect(() => {
    const token = localStorage.getItem('docscan_token') ?? '';
    fetch(`${import.meta.env.BASE_URL}api/scanner/config`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.scannerWatchPath) setWatchPath(d.scannerWatchPath); })
      .catch(() => {});
  }, []);

  // ── client-side filename search ───────────────────────────────────────────
  const visible = search.trim()
    ? docs.filter((d) => d.fileName.toLowerCase().includes(search.toLowerCase()))
    : docs;

  // ── dispatch ────────────────────────────────────────────────────────────────
  const dispatch = async (doc: ScanDoc) => {
    setDocs((p) => p.map((d) => d.id === doc.id ? { ...d, _dispatching: true } : d));
    try {
      const token = localStorage.getItem('docscan_token') ?? '';
      const r = await fetch(`${import.meta.env.BASE_URL}api/documents/${doc.id}/send`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error();
      toast({ title: '✅ Dispatched', description: `${doc.fileName} sent to all recipients.` });
      await fetchDocs(page, true);
    } catch {
      setDocs((p) => p.map((d) => d.id === doc.id ? { ...d, _dispatching: false } : d));
      toast({ title: 'Dispatch Failed', variant: 'destructive' });
    }
  };

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: 'all',     label: 'All' },
    { value: 'queued',  label: 'Queued' },
    { value: 'pending', label: 'Retrying' },
    { value: 'sent',    label: 'Sent' },
    { value: 'failed',  label: 'Failed' },
  ];

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Physical Scanner</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono">
            {watchPath || 'Configure watch folder in Admin → Settings → Scanner'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Updated {format(lastRefresh, 'HH:mm:ss')}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => fetchDocs(page)} className="h-8 text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── stat cards ── */}
      <div className="flex gap-3">
        <StatCard label="Total" value={stats.total}
          icon={<FileText className="w-4 h-4" />}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')} />
        <StatCard label="Queued" value={stats.queued}
          icon={<Clock className="w-4 h-4" />}
          active={statusFilter === 'queued'}
          onClick={() => setStatusFilter('queued')} />
        <StatCard label="Sent" value={stats.sent}
          icon={<CheckCircle2 className="w-4 h-4" />}
          active={statusFilter === 'sent'}
          onClick={() => setStatusFilter('sent')} />
        <StatCard label="Failed" value={stats.failed}
          icon={<AlertCircle className="w-4 h-4" />}
          active={statusFilter === 'failed'}
          onClick={() => setStatusFilter('failed')} />
      </div>

      {/* ── table card ── */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">

        {/* toolbar */}
        <div className="px-4 py-3 border-b border-border flex flex-wrap gap-3 items-center">
          {/* search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by filename…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* status tabs */}
          <div className="flex bg-muted/60 rounded-lg p-0.5 gap-0.5">
            {statusTabs.map((o) => (
              <button key={o.value} onClick={() => setStatusFilter(o.value)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                  statusFilter === o.value
                    ? 'bg-background shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground')}>
                {o.label}
              </button>
            ))}
          </div>

          {/* date range */}
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* table */}
        <div className="overflow-x-auto min-h-[420px]">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="pl-5 w-[40%]">Document</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead>Scanned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-5">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Loading…</p>
                  </TableCell>
                </TableRow>
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center">
                    <Printer className="w-10 h-10 opacity-20 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {search ? 'No documents match your search' :
                       statusFilter !== 'all' ? 'No documents with this status' :
                       'Waiting for scans…'}
                    </p>
                    {!search && statusFilter === 'all' && watchPath && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono opacity-70">{watchPath}</p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((doc) => {
                  const statusKey = doc._dispatching ? '_dispatching' : doc.dispatchStatus;
                  const ext = doc.fileName.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'DOC';
                  const extColors: Record<string, string> = {
                    PDF: 'bg-red-50 border-red-200 text-red-700',
                    JPG: 'bg-blue-50 border-blue-200 text-blue-700',
                    JPEG:'bg-blue-50 border-blue-200 text-blue-700',
                    PNG: 'bg-purple-50 border-purple-200 text-purple-700',
                    TIF: 'bg-teal-50 border-teal-200 text-teal-700',
                    TIFF:'bg-teal-50 border-teal-200 text-teal-700',
                  };

                  return (
                    <TableRow key={doc.id} className="group hover:bg-muted/20">
                      {/* document name */}
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 text-[9px] font-bold tracking-wide',
                            extColors[ext] ?? 'bg-muted border-border text-muted-foreground',
                          )}>
                            {ext}
                          </div>
                          <span className="font-medium text-sm truncate max-w-[220px]" title={doc.fileName}>
                            {doc.fileName}
                          </span>
                        </div>
                      </TableCell>

                      {/* size */}
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {fmtSize(doc.fileSize)}
                      </TableCell>

                      {/* date */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(doc.uploadedAt), 'MMM d, yyyy HH:mm')}
                      </TableCell>

                      {/* status */}
                      <TableCell>
                        <StatusBadge status={statusKey} />
                      </TableCell>

                      {/* action */}
                      <TableCell className="text-right pr-5">
                        {doc._dispatching && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary inline-block" />
                        )}
                        {!doc._dispatching && doc.dispatchStatus === 'queued' && (
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => dispatch(doc)}>
                            <Send className="w-3 h-3" /> Dispatch
                          </Button>
                        )}
                        {!doc._dispatching && doc.dispatchStatus === 'failed' && (
                          <Button size="sm" variant="outline"
                            className="h-7 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => dispatch(doc)}>
                            <RefreshCw className="w-3 h-3" /> Retry
                          </Button>
                        )}
                        {!doc._dispatching && (doc.dispatchStatus === 'sent' || doc.dispatchStatus === 'pending') && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* pagination */}
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
