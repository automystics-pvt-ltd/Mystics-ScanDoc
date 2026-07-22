import { useState } from 'react';
import { useListRecipients, useCreateRecipient, useDeleteRecipient, getListRecipientsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Trash2, Mail, Info } from 'lucide-react';
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
        toast({ title: "Recipient added" });
      },
      onError: (err) => {
        toast({ title: "Failed to add recipient", description: (err as any).data?.error || "Error", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteRecip.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRecipientsQueryKey() });
        toast({ title: "Recipient removed" });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recipients</h1>
        <p className="text-muted-foreground mt-2">Manage the global email addresses that will receive scanned documents.</p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3 text-blue-800 dark:text-blue-300">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold mb-1">How this works</p>
          <p>Every time any user uploads a document, it will be automatically emailed to all the recipients listed below.</p>
        </div>
      </div>

      <div className="bg-card border rounded-xl shadow-sm p-6">
        <form onSubmit={handleAdd} className="flex gap-4 items-end mb-8">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Add New Recipient</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                type="email" 
                required 
                placeholder="recipient@company.com" 
                className="pl-9"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={createRecip.isPending}
              />
            </div>
          </div>
          <Button type="submit" disabled={createRecip.isPending || !newEmail}>
            <Plus className="w-4 h-4 mr-2" /> Add
          </Button>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email Address</TableHead>
              <TableHead>Added On</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : recipients?.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No recipients configured.</TableCell></TableRow>
            ) : recipients?.map((recip) => (
              <TableRow key={recip.id}>
                <TableCell className="font-medium">{recip.recipientEmail}</TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(recip.createdAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(recip.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}