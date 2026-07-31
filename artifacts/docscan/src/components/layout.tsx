import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/auth-context';
import { useChangePassword } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
  Menu,
  KeyRound,
  ChevronUp,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { motion } from 'framer-motion';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const changePasswordMutation = useChangePassword();

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // ── Collapsible sidebar ──────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  };

  const form = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const handleLogout = () => {
    queryClient.clear();
    logout();
    toast({ title: 'Signed out', description: 'You have been signed out successfully.' });
  };

  const handleChangePassword = (values: z.infer<typeof changePasswordSchema>) => {
    changePasswordMutation.mutate(
      { data: { currentPassword: values.currentPassword, newPassword: values.newPassword } },
      {
        onSuccess: () => {
          setChangePasswordOpen(false);
          form.reset();
          toast({ title: 'Password changed', description: 'Your password has been updated successfully.' });
        },
        onError: (err) => {
          toast({
            title: 'Error',
            description: (err as any).data?.error || 'Failed to change password.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  // Admin sees only administration tools in the sidebar
  const adminAdminNav = [
    { href: '/dashboard',        label: 'Dashboard',  icon: LayoutDashboard },
    { href: '/admin/users',      label: 'Users',      icon: Users },
    { href: '/admin/documents',  label: 'Documents',  icon: Files },
    { href: '/admin/email-logs', label: 'Email Logs', icon: Mail },
    { href: '/admin/recipients', label: 'Recipients', icon: ContactRound },
    { href: '/admin/audit-logs', label: 'Audit Log',  icon: ShieldAlert },
    { href: '/admin/settings',   label: 'Settings',   icon: Settings },
  ];

  const userNav = [
    { href: '/upload',  label: 'Physical Scanner', icon: UploadCloud },
    { href: '/history', label: 'History',          icon: History },
  ];

  const isAdmin = user?.role === 'admin';

  // ── Nav content (desktop sidebar) ───────────────────────────────────────
  const DesktopNav = () => (
    <TooltipProvider delayDuration={0}>
      {/* Logo */}
      {collapsed ? (
        /* Collapsed header — just the toggle button, centred */
        <div className="h-16 flex items-center justify-center border-b border-sidebar-border/50 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleCollapsed}
                className="text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent p-1.5 rounded transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        /* Expanded header — logo on the left, toggle on the right */
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-primary p-1.5 rounded flex items-center justify-center shrink-0">
              <ScanText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-bold text-lg text-sidebar-foreground leading-none whitespace-nowrap">DocScan</span>
              <span className="text-[9px] font-semibold text-sidebar-foreground/60 tracking-[0.2em]">ENTERPRISE</span>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleCollapsed}
                className="text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent p-1.5 rounded transition-colors shrink-0"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Collapse sidebar</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Nav links */}
      <div className={cn('flex-1 py-6 space-y-6 overflow-y-auto custom-scrollbar transition-all duration-300', collapsed ? 'px-2' : 'px-4')}>
        {(isAdmin ? [
          { label: 'Administration', items: adminAdminNav },
        ] : [
          { label: 'Workspace', items: userNav },
        ]).map((section) => (
          <div key={section.label} className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-2 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded text-sm font-medium transition-colors relative',
                    collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
                    isActive
                      ? 'text-sidebar-foreground bg-sidebar-accent'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r"
                    />
                  )}
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'group-hover:text-sidebar-foreground')} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                </Tooltip>
              ) : link;
            })}
          </div>
        ))}
      </div>

      {/* User section */}
      <div className={cn('border-t border-sidebar-border/50 transition-all duration-300', collapsed ? 'p-2' : 'p-4')}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex justify-center p-1 rounded hover:bg-sidebar-accent transition-colors">
                    <div className="w-9 h-9 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-sidebar-foreground font-semibold">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-52">
                  <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => { form.reset(); setChangePasswordOpen(true); }}>
                    <KeyRound className="w-4 h-4" /> Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onSelect={handleLogout}>
                    <LogOut className="w-4 h-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>
            <TooltipContent side="right">{user?.name}</TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-2 rounded hover:bg-sidebar-accent transition-colors group">
                <div className="w-9 h-9 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-sidebar-foreground font-semibold shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</div>
                  <div className="text-xs text-sidebar-foreground/50 truncate capitalize">{user?.role}</div>
                </div>
                <ChevronUp className="w-4 h-4 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70 transition-colors shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
              <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => { form.reset(); setChangePasswordOpen(true); }}>
                <KeyRound className="w-4 h-4" /> Change Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onSelect={handleLogout}>
                <LogOut className="w-4 h-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

      </div>
    </TooltipProvider>
  );

  // ── Mobile nav content (sheet) ───────────────────────────────────────────
  const MobileNav = () => (
    <>
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50 gap-3">
        <div className="bg-primary p-1.5 rounded flex items-center justify-center">
          <ScanText className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg text-sidebar-foreground leading-none">DocScan</span>
          <span className="text-[9px] font-semibold text-sidebar-foreground/60 tracking-[0.2em]">ENTERPRISE</span>
        </div>
      </div>

      <div className="flex-1 py-6 px-4 space-y-6 overflow-y-auto custom-scrollbar">
        {(isAdmin ? [
          { label: 'Administration', items: adminAdminNav },
        ] : [
          { label: 'Workspace', items: userNav },
        ]).map((section) => (
          <div key={section.label} className="space-y-1">
            <div className="px-2 pb-2 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
              {section.label}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors relative',
                    isActive
                      ? 'text-sidebar-foreground bg-sidebar-accent'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  {isActive && (
                    <motion.div layoutId="activeMobileNavIndicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r" />
                  )}
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : '')} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-sidebar-border/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-2 rounded hover:bg-sidebar-accent transition-colors group">
              <div className="w-9 h-9 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-sidebar-foreground font-semibold shrink-0">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</div>
                <div className="text-xs text-sidebar-foreground/50 capitalize">{user?.role}</div>
              </div>
              <ChevronUp className="w-4 h-4 text-sidebar-foreground/40 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
            <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => { form.reset(); setChangePasswordOpen(true); }}>
              <KeyRound className="w-4 h-4" /> Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive" onSelect={handleLogout}>
              <LogOut className="w-4 h-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <>
      <div className="flex min-h-[100dvh] bg-background text-foreground">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'bg-sidebar flex-col hidden md:flex shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-300 overflow-hidden',
            collapsed ? 'w-16' : 'w-[260px]',
          )}
        >
          <DesktopNav />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 h-[100dvh]">
          {/* Mobile menu */}
          <div className="md:hidden flex items-center px-4 py-2 border-b border-border bg-card shrink-0">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0 bg-sidebar border-r-0 flex flex-col">
                <MobileNav />
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
            <div className="max-w-7xl mx-auto w-full animate-slide-down-fade pb-12">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={(open) => { setChangePasswordOpen(open); if (!open) form.reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" /> Change Password
            </DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one. Minimum 8 characters.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleChangePassword)} className="space-y-4 pt-2">
              <FormField control={form.control} name="currentPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setChangePasswordOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Password
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
