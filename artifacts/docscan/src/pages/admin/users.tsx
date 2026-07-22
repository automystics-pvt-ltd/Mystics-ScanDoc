import { useState } from 'react';
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, useUnlockUser, getListUsersQueryKey, UserInput, UserUpdate } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, MoreHorizontal, ShieldAlert, Edit, Trash, Lock, LockOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters").or(z.string().length(0).optional()),
  role: z.enum(["admin", "user"]),
  status: z.enum(["active", "inactive"]).optional(),
});

export default function Users() {
  const { data: users, isLoading } = useListUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const unlockUser = useUnlockUser();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "user",
      status: "active",
    },
  });

  const filteredUsers = users?.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingUserId(null);
    form.reset({ name: "", email: "", password: "", role: "user", status: "active" });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setEditingUserId(user.id);
    form.reset({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof userSchema>) => {
    if (editingUserId) {
      const updateData: UserUpdate = {
        name: values.name,
        role: values.role as "admin" | "user",
        status: values.status as "active" | "inactive",
      };
      if (values.password) {
        updateData.password = values.password;
      }

      updateUser.mutate({ id: editingUserId, data: updateData }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setIsDialogOpen(false);
          toast({ title: "User Updated", description: `${values.name}'s profile has been saved.` });
        },
        onError: (err) => {
          toast({ title: "Update failed", description: (err as any).data?.error || "Error updating user.", variant: "destructive" });
        }
      });
    } else {
      if (!values.password) {
        form.setError("password", { message: "Password is required for new users" });
        return;
      }
      
      const createData: UserInput = {
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role as "admin" | "user",
      };

      createUser.mutate({ data: createData }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setIsDialogOpen(false);
          toast({ title: "User Created", description: `${values.name} has been added to the system.` });
        },
        onError: (err) => {
          toast({ title: "Creation failed", description: (err as any).data?.error || "Error creating user.", variant: "destructive" });
        }
      });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to completely remove ${name}? This action cannot be undone.`)) {
      deleteUser.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "User Deleted", description: "The account has been removed." });
        }
      });
    }
  };

  const handleUnlock = (id: number) => {
    unlockUser.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "Account Unlocked", description: "The user can now log in." });
      },
      onError: (err) => {
        toast({ title: "Unlock failed", description: (err as any).data?.error || "Error", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Directory</h1>
          <p className="text-muted-foreground mt-2">Manage access controls and account status.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search users..." 
              className="pl-9 h-10 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={handleOpenCreate} className="h-10">
            <Plus className="w-4 h-4 mr-2" />
            New User
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-semibold text-foreground">Account</TableHead>
              <TableHead className="font-semibold text-foreground">Role</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="font-semibold text-foreground">Scans</TableHead>
              <TableHead className="font-semibold text-foreground">Last Active</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground font-medium">Loading directory...</TableCell></TableRow>
            ) : filteredUsers?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground font-medium">No users match your criteria.</TableCell></TableRow>
            ) : filteredUsers?.map((user) => (
              <TableRow key={user.id} className="hover:bg-muted/20 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{user.name}</span>
                      <span className="text-xs text-muted-foreground font-mono mt-0.5">{user.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className={`uppercase text-[10px] tracking-wider font-semibold ${user.role === 'admin' ? 'bg-primary text-primary-foreground' : ''}`}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1.5">
                    <Badge variant="outline" className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold border-0 ${user.status === 'active' ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                      {user.status}
                    </Badge>
                    {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                      <Badge variant="outline" className="gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-destructive/10 text-destructive border-0">
                        <Lock className="w-3 h-3" /> Locked
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{user.documentCount || 0}</TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">
                  {user.lastActivity ? format(new Date(user.lastActivity), 'MMM d, yyyy') : 'Never'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 font-medium">
                      <DropdownMenuItem onClick={() => handleOpenEdit(user)} className="cursor-pointer">
                        <Edit className="w-4 h-4 mr-2 text-muted-foreground" /> Edit Profile
                      </DropdownMenuItem>
                      {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                        <DropdownMenuItem onClick={() => handleUnlock(user.id)} className="cursor-pointer">
                          <LockOpen className="w-4 h-4 mr-2 text-green-600" /> Unlock Account
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(user.id, user.name)} className="text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                        <Trash className="w-4 h-4 mr-2" /> Delete Account
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">{editingUserId ? 'Edit Profile' : 'New User'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Full Name</FormLabel>
                  <FormControl><Input className="bg-muted/50" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Email Address</FormLabel>
                  <FormControl><Input className="bg-muted/50 font-mono text-sm" {...field} disabled={!!editingUserId} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                    {editingUserId ? "Reset Password (Optional)" : "Initial Password"}
                  </FormLabel>
                  <FormControl><Input type="password" placeholder={editingUserId ? "Leave blank to keep current" : ""} className="bg-muted/50 font-mono text-sm" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">System Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/50">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {editingUserId && (
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/50">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
              <DialogFooter className="pt-6">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="px-8">{editingUserId ? 'Save Changes' : 'Create User'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
