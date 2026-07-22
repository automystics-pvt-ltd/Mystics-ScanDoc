import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { setAuthTokenGetter } from '@workspace/api-client-react';

import { AuthProvider } from '@/contexts/auth-context';
import { AuthGuard } from '@/components/auth-guard';
import { Layout } from '@/components/layout';

import Login from '@/pages/login';
import Upload from '@/pages/upload';
import History from '@/pages/history';
import Dashboard from '@/pages/admin/dashboard';
import Users from '@/pages/admin/users';
import Documents from '@/pages/admin/documents';
import EmailLogs from '@/pages/admin/email-logs';
import Recipients from '@/pages/admin/recipients';
import Settings from '@/pages/admin/settings';
import AuditLogs from '@/pages/admin/audit-logs';

// Configure the fetch client to inject the JWT token
setAuthTokenGetter(() => {
  return localStorage.getItem("docscan_token");
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* User Routes */}
      <Route path="/upload">
        <AuthGuard>
          <Layout>
            <Upload />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/history">
        <AuthGuard>
          <Layout>
            <History />
          </Layout>
        </AuthGuard>
      </Route>
      
      {/* Admin Routes */}
      <Route path="/dashboard">
        <AuthGuard requireAdmin>
          <Layout>
            <Dashboard />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/admin/users">
        <AuthGuard requireAdmin>
          <Layout>
            <Users />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/admin/documents">
        <AuthGuard requireAdmin>
          <Layout>
            <Documents />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/admin/email-logs">
        <AuthGuard requireAdmin>
          <Layout>
            <EmailLogs />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/admin/recipients">
        <AuthGuard requireAdmin>
          <Layout>
            <Recipients />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/admin/audit-logs">
        <AuthGuard requireAdmin>
          <Layout>
            <AuditLogs />
          </Layout>
        </AuthGuard>
      </Route>
      <Route path="/admin/settings">
        <AuthGuard requireAdmin>
          <Layout>
            <Settings />
          </Layout>
        </AuthGuard>
      </Route>

      {/* Default Redirect */}
      <Route path="/">
        <AuthGuard>
          <Layout>
            <Upload /> {/* Default for regular users, admin should probably go to dashboard but AuthGuard doesn't handle redirects smartly inside <Route>, wait, if they are admin, they can go to /upload too, or I can redirect them */}
          </Layout>
        </AuthGuard>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;