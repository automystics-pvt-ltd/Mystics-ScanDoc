import { useGetDashboardStats } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Send, AlertCircle, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded mb-2"></div>
        <div className="grid gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back. Here's what's happening today.</p>
        </div>
        <div className="hidden sm:block text-xs font-semibold text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-md">
          {format(new Date(), 'MMMM d, yyyy')}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalUsers}</div>
            <div className="flex items-center text-xs text-primary font-medium mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              Active directory
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Documents Today</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.documentsToday || 0}</div>
            <div className="flex items-center text-xs text-primary font-medium mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              Volume steady
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Emails Sent</CardTitle>
            <Send className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalEmailsSent}</div>
            <div className="flex items-center text-xs text-primary font-medium mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              All-time count
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Failed Emails</CardTitle>
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.failedEmails}</div>
            <div className="flex items-center text-xs text-destructive font-medium mt-1">
              <TrendingDown className="w-3 h-3 mr-1" />
              Requires attention
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Chart Area (placeholder to match layout concept) */}
          <Card className="h-[300px] flex flex-col">
            <CardHeader className="pb-0">
              <CardTitle className="text-base font-semibold">Volume Trend</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-end pb-6 pt-4 gap-2">
              {Array.from({ length: 30 }).map((_, i) => {
                const height = Math.random() * 80 + 20;
                return (
                  <div key={i} className="flex-1 bg-primary rounded-t-sm" style={{ height: `${height}%` }} />
                );
              })}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {stats.recentActivity.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No recent activity.</div>
                ) : (
                  stats.recentActivity.slice(0, 5).map((log) => (
                    <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{log.userName || 'System'}</span>
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium capitalize">
                            {log.action.replace('_', ' ')}
                          </span>
                        </div>
                        {log.details && <span className="text-xs text-muted-foreground">{log.details}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {format(new Date(log.createdAt), 'HH:mm')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {[
                { icon: Users, label: "Manage Users" },
                { icon: FileText, label: "Archive" },
                { icon: Send, label: "Dispatch" },
                { icon: AlertCircle, label: "Alerts" },
              ].map((action, i) => (
                <div key={i} className="bg-card border border-border p-4 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors cursor-pointer text-muted-foreground group">
                  <action.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold text-foreground">{action.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardHeader className="bg-destructive/5 border-b border-destructive/10">
              <CardTitle className="text-base font-semibold text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="p-4 border-b border-border hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Delivery Failure</span>
                      <span className="text-xs text-muted-foreground mt-0.5">SMTP Timeout on Document #402</span>
                    </div>
                    <span className="text-[10px] font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded uppercase">High</span>
                  </div>
               </div>
               <div className="p-4 border-b border-border hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Rate Limit Warning</span>
                      <span className="text-xs text-muted-foreground mt-0.5">Approaching hourly quota</span>
                    </div>
                    <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded uppercase">Med</span>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
