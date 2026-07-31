import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send, Loader2, CheckCircle2, XCircle, Clock,
  Printer, RefreshCw, ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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

type PageResult = {
  items: ScanDoc[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type DateRange    = 'today' | 'week' | 'month' | 'all';
type StatusFilter = 'all' | 'queued' | 'sent' | 'failed' | 'pending';

// ── helpers ───────────────────────────────────────────────────────────────────
function fromDate(range: DateRange): string | undefined {
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (range === 'week')  { const d = new Date(now); d.setDate(d.getDate() - 6);  return d.toISOString(); }
  if (range === 'month') { const d = new Date(now); d.setDate(d.getDate() - 29); return d.toISOString(); }
  return undefined;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `${h}h ago`;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: DispatchStatus | '_dispatching' }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    queued:       { label: 'Queued',   cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: <Clock className="w-3 h-3" /> },
    pending:      { label: 'Retrying', cls: 'bg-blue-50 text-blue-700 border-blue-200',      icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
    sent:         { label: 'Sent',     cls: 'bg-green-50 text-green-700 border-green-200',   icon: <CheckCircle2 className="w-3 h-3" /> },
    failed:       { label: 'Failed',   cls: 'bg-red-50 text-red-700 border-red-200',         icon: <XCircle className="w-3 h-3" /> },
    _dispatching: { label: 'Sending…', cls: 'bg-primary/10 text-primary border-primary/20',  icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  };
  const cfg = map[status] ?? map.queued;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', cfg.cls)}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ── component ─────────────────────────────────────────────────────────────────
export default function Upload() {
  const { toast } = useToast();

  const [docs,         setDocs]         = useState<ScanDoc[]>([]);
  const [total,        setTotal]        = useState(0);
  const [totalPages,   setTotalPages]   = useState(1);
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRange,    setDateRange]    = useState<DateRange>('all');
  const [watchPath,    setWatchPath]    = useState('');

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const PAGE_SIZE = 10;

  // ── fetch ───────────────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async (p: number, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token  = localStorage.getItem('docscan_token') ?? '';
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
    } catch { /* network error — keep stale data */ }
    finally { if (!silent) setLoading(false); }
  }, [statusFilter, dateRange]);

  // Reload when filter/page changes
  useEffect(() => { fetchDocs(page); }, [page, statusFilter, dateRange, fetchDocs]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [statusFilter, dateRange]);

  // Background poll every 8 s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchDocs(page, true), 8_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchDocs, page]);

  // Load scanner config for header display
  useEffect(() => {
    const token = localStorage.getItem('docscan_token') ?? '';
    fetch(`${import.meta.env.BASE_URL}api/scanner/config`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.scannerWatchPath) setWatchPath(d.scannerWatchPath); })
      .catch(() => {});
  }, []);

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

  // ── filter options ──────────────────────────────────────────────────────────
  const statusOpts: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' }, { value: 'queued', label: 'Queued' },
    { value: 'pending', label: 'Retrying' }, { value: 'sent', label: 'Sent' },
    { value: 'failed', label: 'Failed' },
  ];
  const dateOpts: { value: DateRange; label: string }[] = [
    { value: 'all', label: 'All time' }, { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last 7 days' }, { value: 'month', label: 'Last 30 days' },
  ];

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-5">

      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Physical Scanner</h1>
          {watchPath
            ? <p className="text-sm text-muted-foreground font-mono">{watchPath}</p>
            : <p className="text-sm text-muted-foreground">Set watch folder in Admin → Settings → Scanner</p>
          }
        </div>
        <Button size="sm" variant="outline" onClick={() => fetchDocs(page)} className="h-8 text-xs shrink-0 mt-1">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

        <div className="flex bg-muted/60 rounded-lg p-0.5 gap-0.5">
          {statusOpts.map((o) => (
            <button key={o.value} onClick={() => setStatusFilter(o.value)}
              className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors',
                statusFilter === o.value
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground')}>
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex bg-muted/60 rounded-lg p-0.5 gap-0.5">
          {dateOpts.map((o) => (
            <button key={o.value} onClick={() => setDateRange(o.value)}
              className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors',
                dateRange === o.value
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground')}>
              {o.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {total} document{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* list */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 gap-4 border border-dashed rounded-xl text-muted-foreground">
          <Printer className="w-9 h-9 opacity-25" />
          <div className="text-center">
            <p className="text-sm font-medium">
              {statusFilter !== 'all' || dateRange !== 'all'
                ? 'No documents match this filter'
                : 'Waiting for scans…'}
            </p>
            {statusFilter === 'all' && dateRange === 'all' && watchPath && (
              <p className="text-xs mt-1 opacity-70 font-mono">{watchPath}</p>
            )}
          </div>
        </div>
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          <div className="flex flex-col gap-2">
            {docs.map((doc) => (
              <motion.div key={doc.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'bg-card border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm',
                  doc.dispatchStatus === 'sent'   ? 'border-green-200' :
                  doc.dispatchStatus === 'failed' ? 'border-red-200'   : 'border-border',
                )}>

                {/* file type chip */}
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 text-[10px] font-bold uppercase tracking-wide',
                  doc.dispatchStatus === 'sent'   ? 'bg-green-50 border-green-200 text-green-700' :
                  doc.dispatchStatus === 'failed' ? 'bg-red-50 border-red-200 text-red-600' :
                                                    'bg-primary/10 border-primary/20 text-primary',
                )}>
                  {doc.fileName.split('.').pop()?.slice(0, 3) ?? 'DOC'}
                </div>

                {/* name + meta */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate leading-tight">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(doc.uploadedAt)}{doc.fileSize ? ` · ${fmtSize(doc.fileSize)}` : ''}
                  </p>
                </div>

                {/* status */}
                <StatusBadge status={doc._dispatching ? '_dispatching' : doc.dispatchStatus} />

                {/* action */}
                {(doc.dispatchStatus === 'queued' || doc.dispatchStatus === 'failed') && !doc._dispatching && (
                  <Button size="sm" className="h-7 text-xs shrink-0 ml-1" onClick={() => dispatch(doc)}>
                    <Send className="w-3 h-3 mr-1" />
                    {doc.dispatchStatus === 'failed' ? 'Retry' : 'Dispatch'}
                  </Button>
                )}
                {doc._dispatching && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0 ml-1" />
                )}
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <Button size="sm" variant="outline" disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)} className="h-8 text-xs">
            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)} className="h-8 text-xs">
            Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
