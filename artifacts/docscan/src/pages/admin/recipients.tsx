import { useState } from 'react';
import { useListRecipients, useCreateRecipient, useDeleteRecipient, getListRecipientsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Trash2, Mail, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export default function Recipients() {
  const { data: recipients, isLoading } = useListRecipients();
  const createRecip = useCreateRecipient();
  const deleteRecip = useDeleteRecipient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [newEmail, setNewEmail] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes("@")) return;

    createRecip.mutate({ data: { recipientEmail: newEmail } }, {
      onSuccess: () => {
        setNewEmail("");
        queryClient.invalidateQueries({ queryKey: getListRecipientsQueryKey() });
        toast({ title: "Target Appended", description: "New email address added to global routing." });
      },
      onError: (err) => {
        toast({ title: "Routing Error", description: (err as any).data?.error || "Error adding address.", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteRecip.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRecipientsQueryKey() });
        toast({ title: "Target Removed", description: "Address removed from routing list." });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Global Routing</h1>
        <p className="text-muted-foreground mt-2">Manage persistent destination addresses for the mailroom.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 text-primary/10">
              <Users className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-2 text-foreground flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" /> Mechanism
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Documents uploaded by any authorized user are immediately multiplexed and dispatched to every address configured in this registry.
              </p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <form onSubmit={handleAdd} className="flex gap-3 items-end mb-8 bg-muted/30 p-4 rounded-lg border border-border/50">
              <div className="flex-1 space-y-2">
                <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Inject New Target</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <Input 
                    type="email" 
                    required 
                    placeholder="address@domain.com" 
                    className="pl-9 h-10 bg-card font-mono text-sm"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={createRecip.isPending}
                  />
                </div>
              </div>
              <Button type="submit" disabled={createRecip.isPending || !newEmail} className="h-10 px-6">
                <Plus className="w-4 h-4 mr-2" /> Inject
              </Button>
            </form>

            <div className="border border-border/60 rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-foreground">Target Address</TableHead>
                    <TableHead className="font-semibold text-foreground w-[150px]">Injection Date</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground font-medium">Reading registry...</TableCell></TableRow>
                  ) : recipients?.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground font-medium">Registry is empty. Nothing will be routed.</TableCell></TableRow>
                  ) : recipients?.map((recip) => (
                    <TableRow key={recip.id} className="hover:bg-muted/10">
                      <TableCell className="font-mono font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {recip.recipientEmail}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {format(new Date(recip.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => handleDelete(recip.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
