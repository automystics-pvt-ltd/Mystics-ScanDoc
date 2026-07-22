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
  ScanText,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    logout();
  };

  const adminNav = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/documents', label: 'Documents', icon: Files },
    { href: '/admin/email-logs', label: 'Email Logs', icon: Mail },
    { href: '/admin/recipients', label: 'Recipients', icon: ContactRound },
    { href: '/admin/audit-logs', label: 'Audit Log', icon: ShieldAlert },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const userNav = [
    { href: '/upload', label: 'Scan & Send', icon: UploadCloud },
    { href: '/history', label: 'History', icon: History },
  ];

  const navItems = user?.role === 'admin' ? adminNav : userNav;

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary p-1.5 rounded-md shadow-[0_0_15px_rgba(var(--primary),0.5)]">
              <ScanText className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-sidebar-foreground tracking-tight">DocScan</span>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="px-3 pb-3 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
            {user?.role === 'admin' ? 'Administration' : 'Workspace'}
          </div>
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all relative overflow-hidden",
                    isActive 
                      ? "text-sidebar-primary-foreground bg-sidebar-primary shadow-sm" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className={cn("w-4 h-4 shrink-0 transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                  <span className="z-10">{item.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeNav" 
                      className="absolute inset-0 bg-sidebar-primary opacity-10" 
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-sidebar-border/50">
          <div className="bg-sidebar-accent/50 rounded-lg p-3 border border-sidebar-border/50 mb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-semibold border border-sidebar-border shadow-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</div>
              <div className="text-xs text-sidebar-foreground/50 truncate capitalize flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {user?.role}
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent h-9 font-medium"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[url('/noise.png')] bg-repeat opacity-[0.99] mix-blend-multiply">
        {/* Subtle radial gradient background effect */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />
        
        {/* Mobile Header */}
        <header className="md:hidden h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1 rounded">
              <ScanText className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground tracking-tight">DocScan</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
            <LogOut className="w-4 h-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 md:p-8 max-w-7xl mx-auto w-full min-h-full flex flex-col animate-slide-down-fade">
            {/* Breadcrumb pseudo-effect for deeper immersion */}
            <div className="hidden md:flex items-center text-xs font-medium text-muted-foreground mb-6 uppercase tracking-wider">
              <span>{user?.role === 'admin' ? 'Admin' : 'Workspace'}</span>
              <ChevronRight className="w-3 h-3 mx-2 opacity-50" />
              <span className="text-foreground">{navItems.find(i => location.startsWith(i.href))?.label || 'Overview'}</span>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
