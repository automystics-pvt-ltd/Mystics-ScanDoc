import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/auth-context';
import { 
  LayoutDashboard, 
  UploadCloud, 
  History, 
  Users, 
  Files, 
  Mail, 
  ContactRound, 
  Settings,
  LogOut,
  ScanText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logout();
  };

  const navItems = user?.role === 'admin' 
    ? [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/documents', label: 'Documents', icon: Files },
        { href: '/admin/email-logs', label: 'Email Logs', icon: Mail },
        { href: '/admin/recipients', label: 'Recipients', icon: ContactRound },
        { href: '/admin/settings', label: 'Settings', icon: Settings },
      ]
    : [
        { href: '/upload', label: 'Scan & Send', icon: UploadCloud },
        { href: '/history', label: 'History', icon: History },
      ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border bg-sidebar">
          <ScanText className="w-6 h-6 text-sidebar-primary mr-3" />
          <span className="font-bold text-lg text-sidebar-foreground tracking-tight">DocScan</span>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          <div className="px-2 pb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
            {user?.role === 'admin' ? 'Administration' : 'Workspace'}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-semibold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</div>
              <div className="text-xs text-sidebar-foreground/50 truncate capitalize">{user?.role}</div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <ScanText className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">DocScan</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}