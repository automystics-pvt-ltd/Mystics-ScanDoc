import type { DashboardStats } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, FileText, Mail, AlertCircle, TrendingUp, TrendingDown,
  Clock, ArrowRight, Minus, CheckCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useLocation } from 'wouter';
import { useState, useEffect } from 'react';

// ── Date-range options ────────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
];

// ── Volume bar chart ──────────────────────────────────────────────────────────
function VolumeChart({ series }: { series: { date: string; documents: number; emails: number }[] }) {
  const maxVal = Math.max(1, ...series.map(d => Math.max(d.documents, d.emails)));

  return (
    <div className="flex items-end gap-[3px] h-full w-full">
      {series.map((d) => {
        const docH = Math.max(3, (d.documents / maxVal) * 100);
        const emailH = Math.max(3, (d.emails / maxVal) * 100);
        const label = format(parseISO(d.date), 'MMM d');
        return (
          <div
            key={d.date}
            className="flex-1 flex items-end gap-[1px] group cursor-default"
            title={`${label}\nDocs: ${d.documents}\nEmails sent: ${d.emails}`}
          >
            <div
              className="flex-1 bg-primary rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity"
              style={{ height: `${docH}%` }}
            />
            <div
              className="flex-1 bg-primary/30 rounded-t-sm group-hover:bg-primary/50 transition-colors"
              style={{ height: `${emailH}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Trend badge ───────────────────────────────────────────────────────────────
function Trend({ delta }: { delta: number }) {
  if (delta > 0) return (
    <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
      <TrendingUp className="w-3 h-3 mr-1" />+{delta} vs yesterday
    </div>
  );
  if (delta < 0) return (
    <div className="flex items-center text-xs text-destructive font-medium mt-1">
      <TrendingDown className="w-3 h-3 mr-1" />{delta} vs yesterday
    </div>
  );
  return (
    <div className="flex items-center text-xs text-muted-foreground font-medium mt-1">
      <Minus className="w-3 h-3 mr-1" />Same as yesterday
    </div>
  );
}

// ── Alert severity badge ──────────────────────────────────────────────────────
function Severity({ retries }: { retries?: number }) {
  const n = retries ?? 0;
  if (n >= 3) return <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded uppercase">High</span>;
  if (n >= 1) return <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase">Med</span>;
  return <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded uppercase">Low</span>;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const token = localStorage.getItem('docscan_token');
    fetch(`/api/admin/dashboard?days=${days}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: DashboardStats) => { if (!cancelled) setStats(data); })
      .catch(() => {/* stay on current data */})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  if (loading && !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded mb-2" />
        <div className="grid gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-28" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 h-64" />
          <Card className="h-64" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const quickActions = [
    { icon: Users,    label: 'Manage Users', to: '/admin/users' },
    { icon: FileText, label: 'Documents',    to: '/admin/documents' },
    { icon: Mail,     label: 'Recipients',   to: '/admin/recipients' },
    { icon: Clock,    label: 'Email Logs',   to: '/admin/email-logs' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back. Here's what's happening today.</p>
        </div>
        <div className="hidden sm:block text-xs font-semibold text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-md">
          {format(new Date(), 'MMMM d, yyyy')}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalUsers}</div>
            <Trend delta={stats.trends.users} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Documents Today</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.documentsToday ?? 0}</div>
            <Trend delta={stats.trends.documents} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Emails Sent Today</CardTitle>
            <Mail className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.emailsToday ?? 0}</div>
            <Trend delta={stats.trends.emails} />
          </CardContent>
        </Card>

        <Card className={stats.failedEmails > 0 ? 'border-destructive/40' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Failed Emails</CardTitle>
            <AlertCircle className={`w-4 h-4 ${stats.failedEmails > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${stats.failedEmails > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {stats.failedEmails}
            </div>
            {stats.failedEmails > 0 ? (
              <button
                onClick={() => setLocation('/admin/email-logs')}
                className="flex items-center text-xs text-destructive font-medium mt-1 hover:underline"
              >
                View all <ArrowRight className="w-3 h-3 ml-1" />
              </button>
            ) : (
              <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
                <CheckCircle className="w-3 h-3 mr-1" />All clear
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart + sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* Volume chart with date-range picker */}
          <Card className="flex flex-col" style={{ height: 300 }}>
            <CardHeader className="pb-0 flex flex-row items-center justify-between shrink-0">
              <div>
                <CardTitle className="text-base font-semibold">Volume Trend</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Documents &amp; emails over the last {days} days
                </p>
              </div>
              {/* Date-range picker */}
              <div className="flex items-center gap-1">
                {RANGE_OPTIONS.map(({ label, days: d }) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                      days === d
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pb-4 pt-3 flex flex-col gap-2">
              <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary opacity-80" />Documents
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/30" />Emails sent
                </span>
              </div>
              <div className="flex-1 min-h-0">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground animate-pulse">
                    Loading…
                  </div>
                ) : stats.volumeSeries && stats.volumeSeries.length > 0 ? (
                  <VolumeChart series={stats.volumeSeries} />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No activity in the selected period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />Recent Activity
              </CardTitle>
              <button
                onClick={() => setLocation('/admin/audit-logs')}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {stats.recentActivity.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No recent activity.</div>
                ) : (
                  stats.recentActivity.slice(0, 6).map((log) => (
                    <div key={log.id} className="px-4 py-3 hover:bg-muted/30 transition-colors flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{log.userName || 'System'}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium capitalize">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {log.details && (
                          <span className="text-xs text-muted-foreground truncate max-w-xs">{log.details}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono shrink-0 ml-4">
                        {format(new Date(log.createdAt), 'HH:mm')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {quickActions.map(({ icon: Icon, label, to }) => (
                <button
                  key={to}
                  onClick={() => setLocation(to)}
                  className="bg-card border border-border p-4 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors cursor-pointer text-muted-foreground group"
                >
                  <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold text-foreground">{label}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Active Alerts — real failed emails */}
          <Card className={stats.recentFailures.length > 0 ? 'border-destructive/20' : ''}>
            <CardHeader className={`border-b ${stats.recentFailures.length > 0 ? 'bg-destructive/5 border-destructive/10' : 'border-border'}`}>
              <CardTitle className={`text-base font-semibold flex items-center gap-2 ${stats.recentFailures.length > 0 ? 'text-destructive' : 'text-foreground'}`}>
                <AlertCircle className="w-4 h-4" />Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {stats.recentFailures.length === 0 ? (
                <div className="p-6 flex flex-col items-center gap-2 text-center text-muted-foreground text-sm">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                  <span>No delivery failures.</span>
                </div>
              ) : (
                <>
                  {stats.recentFailures.map((f) => (
                    <div key={f.id} className="p-4 border-b border-border hover:bg-muted/30 transition-colors last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-sm font-semibold">Delivery Failure</span>
                          <span className="text-xs text-muted-foreground truncate" title={f.recipientEmail}>
                            → {f.recipientEmail}
                          </span>
                          {f.errorMessage && (
                            <span className="text-xs text-destructive/80 truncate" title={f.errorMessage}>
                              {f.errorMessage.slice(0, 60)}{f.errorMessage.length > 60 ? '…' : ''}
                            </span>
                          )}
                        </div>
                        <Severity retries={f.retryCount} />
                      </div>
                    </div>
                  ))}
                  <div className="p-3 border-t border-border">
                    <button
                      onClick={() => setLocation('/admin/email-logs')}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      View all email logs <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
