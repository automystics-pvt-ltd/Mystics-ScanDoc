import { useGetDashboardStats } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Send, AlertCircle, Activity, FileCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Loading statistics...</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-16" />
              <CardContent className="h-12" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { title: "Total Users", value: stats.totalUsers, icon: Users, desc: `${stats.activeUsers} active` },
    { title: "Total Documents", value: stats.totalDocuments, icon: FileText, desc: "All time" },
    { title: "Docs Today", value: stats.documentsToday || 0, icon: FileCheck, desc: "Uploaded today" },
    { title: "Emails Sent", value: stats.totalEmailsSent, icon: Send, desc: "Successfully delivered" },
    { title: "Failed Emails", value: stats.failedEmails, icon: AlertCircle, desc: "Delivery failed", color: "text-destructive" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of system activity and statistics.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className={`w-4 h-4 ${stat.color || 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-2">
          <CardHeader className="flex flex-row items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No recent activity</div>
            ) : (
              <div className="space-y-6">
                {stats.recentActivity.map((log) => (
                  <div key={log.id} className="flex gap-4">
                    <div className="relative mt-1">
                      <div className="w-2 h-2 rounded-full bg-primary ring-4 ring-primary/10" />
                      <div className="absolute top-4 bottom-[-24px] left-1 w-px bg-border -z-10" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">
                          {log.userName || 'System'} <span className="font-normal text-muted-foreground">{log.action}</span>
                        </p>
                        <time className="text-xs text-muted-foreground">
                          {format(new Date(log.createdAt), 'MMM d, HH:mm')}
                        </time>
                      </div>
                      {log.details && (
                        <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}