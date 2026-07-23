import { useGetDashboardStats } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users, FileText, Send, AlertCircle, TrendingUp, TrendingDown,
  Clock, ArrowRight, Minus, CheckCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useLocation } from 'wouter';

// ── Tiny bar-chart drawn with divs ────────────────────────────────────────────
function VolumeChart({ series }: { series: { date: string; documents: number; emails: number }[] }) {
  const maxVal = Math.max(1, ...series.map(d => Math.max(d.documents, d.emails)));

  return (
    <div className="flex items-end gap-[3px] h-full w-full">
      {series.map((d) => {
        const docH = Math.max(4, (d.documents / maxVal) * 100);
        const emailH = Math.max(4, (d.emails / maxVal) * 100);
        const label = format(parseISO(d.date), 'MMM d');
        return (
          <div key={d.date} className="flex-1 flex items-end gap-[1px] group relative" title={`${label}\nDocs: ${d.documents}\nEmails: ${d.emails}`}>
            <div className="flex-1 bg-primary rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity" style={{ height: `${docH}%` }} />
            <div className="flex-1 bg-primary/30 rounded-t-sm group-hover:bg-primary/50 transition-colors" style={{ height: `${emailH}%` }} />
          </div>
        );
      })}
    </div>
  );
}

// ── Trend badge ───────────────────────────────────────────────────────────────
function Trend({ delta, suffix = '' }: { delta: number; suffix?: string }) {
  if (delta > 0) return (
    <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
      <TrendingUp className="w-3 h-3 mr-1" />+{delta}{suffix} vs yesterday
    </div>
  );
  if (delta < 0) return (
    <div className="flex items-center text-xs text-destructive font-medium mt-1">
      <TrendingDown className="w-3 h-3 mr-1" />{delta}{suffix} vs yesterday
    </div>
  );
  return (
    <div className="flex items-center text-xs text-muted-foreground font-medium mt-1">
      <Minus className="w-3 h-3 mr-1" />Same as yesterday
    </div>
  );
}

// ── Alert severity badge ───────────────────────────────────────────────────────
function Severity({ retries }: { retries?: number }) {
  const n = retries ?? 0;
  if (n >= 3) return <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded uppercase">High</span>;
  if (n >= 1) return <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase">Med</span>;
  return <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded uppercase">Low</span>;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const [, setLocation] = useLocation();

  if (isLoading || !stats) {
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

  const quickActions = [
    { icon: Users, label: 'Manage Users', to: '/admin/users' },
    { icon: FileText, label: 'Documents', to: '/admin/documents' },
    { icon: Send, label: 'Dispatch', to: '/upload' },
    { icon: Clock, label: 'Email Logs', to: '/admin/email-logs' },
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
            <Send className="w-4 h-4 text-muted-foreground" />
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
          {/* Volume Trend chart — real data */}
          <Card className="h-[280px] flex flex-col">
            <CardHeader className="pb-0 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">30-Day Volume</CardTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary opacity-80" />Documents</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/30" />Emails</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pb-4 pt-4">
              {stats.volumeSeries && stats.volumeSeries.length > 0 ? (
                <VolumeChart series={stats.volumeSeries} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No activity in the last 30 days.
                </div>
              )}
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
                        {log.details && <span className="text-xs text-muted-foreground truncate max-w-xs">{log.details}</span>}
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
                          <span className="text-sm font-semibold truncate">Delivery Failure</span>
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
