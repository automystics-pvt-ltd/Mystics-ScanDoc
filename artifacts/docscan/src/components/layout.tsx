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
                  'group flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors relative',
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
                <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-primary' : 'group-hover:text-sidebar-foreground')} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* User section with dropdown */}
      <div className="p-4 border-t border-sidebar-border/50">
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
            <DropdownMenuItem
              className="gap-2 cursor-pointer"
              onSelect={() => {
                form.reset();
                setChangePasswordOpen(true);
              }}
            >
              <KeyRound className="w-4 h-4" />
              Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              onSelect={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
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
        <aside className="w-[260px] bg-sidebar flex-col hidden md:flex shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
          <NavContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 h-[100dvh]">
          {/* Mobile menu — only visible on small screens */}
          <div className="md:hidden flex items-center px-4 py-2 border-b border-border bg-card shrink-0">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0 bg-sidebar border-r-0 flex flex-col">
                <NavContent />
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
                  <FormControl>
                    <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setChangePasswordOpen(false)}>
                  Cancel
                </Button>
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
