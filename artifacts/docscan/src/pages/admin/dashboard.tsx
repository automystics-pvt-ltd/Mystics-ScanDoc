import { useGetDashboardStats } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Send, AlertCircle, Activity, FileCheck } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="space-y-8 animate-pulse">
        <div>
          <div className="h-8 w-48 bg-muted rounded mb-2"></div>
          <div className="h-4 w-64 bg-muted rounded"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-border shadow-sm">
              <CardHeader className="h-16 pb-2" />
              <CardContent className="h-16" />
            </Card>
          ))}
        </div>
        <Card className="h-[400px] border-border shadow-sm" />
      </div>
    );
  }

  const statCards = [
    { title: "Total Users", value: stats.totalUsers, icon: Users, desc: `${stats.activeUsers} active accounts`, trend: "neutral" },
    { title: "Total Documents", value: stats.totalDocuments, icon: FileText, desc: "Lifetime system volume", trend: "neutral" },
    { title: "Docs Today", value: stats.documentsToday || 0, icon: FileCheck, desc: "Processed since 00:00", trend: "positive" },
    { title: "Emails Sent", value: stats.totalEmailsSent, icon: Send, desc: "Successful deliveries", trend: "positive" },
    { title: "Failed Deliveries", value: stats.failedEmails, icon: AlertCircle, desc: "Require attention", trend: "negative", color: "text-destructive", bg: "bg-destructive/10" },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
        <p className="text-muted-foreground mt-2">Real-time metrics and recent mailroom activity.</p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-3 lg:grid-cols-5"
      >
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div variants={item} key={i}>
              <Card className="h-full border-border shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-md ${stat.bg || 'bg-muted'}`}>
                    <Icon className={`w-4 h-4 ${stat.color || 'text-foreground'}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${stat.color || 'text-foreground'} tracking-tight`}>
                    {stat.value.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div variants={item} initial="hidden" animate="show" className="col-span-2">
          <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3 border-b border-border bg-muted/20 pb-4 pt-5">
              <div className="bg-primary/10 p-2 rounded-md">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Recent Audit Feed</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {stats.recentActivity.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 text-sm font-medium">No system activity recorded yet.</div>
              ) : (
                <div className="divide-y divide-border">
                  {stats.recentActivity.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-muted/10 transition-colors flex gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {log.userName || 'System'}
                          </p>
                          <time className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {format(new Date(log.createdAt), 'MMM d, HH:mm')}
                          </time>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                            {log.action}
                          </span>
                          {log.details && (
                            <span className="text-sm text-muted-foreground truncate">{log.details}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
