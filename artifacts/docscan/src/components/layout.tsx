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
  Search,
  Bell,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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

  const currentNavItem = navItems.find(i => location === i.href || location.startsWith(`${i.href}/`));
  const breadcrumbSection = user?.role === 'admin' ? 'Admin' : 'Workspace';
  const breadcrumbPage = currentNavItem?.label || 'Overview';

  const NavContent = () => (
    <>
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded flex items-center justify-center">
            <ScanText className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-sidebar-foreground leading-none">DocScan</span>
            <span className="text-[9px] font-semibold text-sidebar-foreground/60 tracking-[0.2em]">ENTERPRISE</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-8 overflow-y-auto custom-scrollbar">
        <div className="space-y-1">
          <div className="px-2 pb-2 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
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
                  "group flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors relative",
                  isActive 
                    ? "text-sidebar-foreground bg-sidebar-accent" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeNavIndicator" 
                    className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" 
                  />
                )}
                <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-primary" : "group-hover:text-sidebar-foreground")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border/50">
        <div className="flex items-center gap-3 p-2">
          <div className="w-9 h-9 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-sidebar-foreground font-semibold shrink-0">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</div>
            <div className="text-xs text-sidebar-foreground/50 truncate capitalize">{user?.role}</div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="w-[260px] bg-sidebar flex-col hidden md:flex shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh]">
        {/* Top Content Bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-8 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0 bg-sidebar border-r-0 flex flex-col">
                <NavContent />
              </SheetContent>
            </Sheet>

            <div className="hidden md:flex items-center text-sm font-medium text-muted-foreground">
              <span>{breadcrumbSection}</span>
              <span className="mx-2 text-muted-foreground/40">/</span>
              <span className="text-foreground">{breadcrumbPage}</span>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-4 hidden sm:block relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search everything..." 
              className="w-full h-9 bg-background border border-border rounded-md pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center px-2.5 py-1 rounded-full bg-background border border-border text-xs font-semibold capitalize text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5" />
              {user?.role}
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground relative h-9 w-9">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
          <div className="max-w-7xl mx-auto w-full animate-slide-down-fade pb-12">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
