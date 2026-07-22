import { useState, useMemo, useEffect } from 'react';
import { useListRecipients, useCreateRecipient, useDeleteRecipient, getListRecipientsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Trash2, Mail, Search } from 'lucide-react';
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
import { SortableHeader } from '@/components/sortable-header';
import { PaginationControls } from '@/components/pagination-controls';

const PAGE_SIZE = 10;

export default function Recipients() {
  const { data: recipients, isLoading } = useListRecipients();
  const createRecip = useCreateRecipient();
  const deleteRecip = useDeleteRecipient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [newEmail, setNewEmail] = useState("");
  const [search, setSearch] = useState("");
  
  const [sortKey, setSortKey] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return (recipients ?? []).filter(r => 
      r.recipientEmail.toLowerCase().includes(search.toLowerCase())
    );
  }, [recipients, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal: any = a[sortKey as keyof typeof a];
      let bVal: any = b[sortKey as keyof typeof b];
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const paginated = useMemo(() => {
    return sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [sorted, page]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  useEffect(() => setPage(1), [search, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes("@")) return;

    createRecip.mutate({ data: { recipientEmail: newEmail } }, {
      onSuccess: () => {
        setNewEmail("");
        queryClient.invalidateQueries({ queryKey: getListRecipientsQueryKey() });
        toast({ title: "Recipient Added", description: "Email successfully added." });
      },
      onError: (err) => {
        toast({ title: "Error", description: (err as any).data?.error || "Error adding address.", variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteRecip.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRecipientsQueryKey() });
        toast({ title: "Recipient Removed", description: "Address removed from the list." });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Recipients</h1>

      <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/20">
          <form onSubmit={handleAdd} className="flex gap-2 w-full sm:w-auto">
            <Input 
              type="email" 
              required 
              placeholder="Add new email..." 
              className="h-9 w-full sm:w-64"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={createRecip.isPending}
            />
            <Button type="submit" disabled={createRecip.isPending || !newEmail} className="h-9 whitespace-nowrap">
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </form>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search emails..." 
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 hover:bg-muted/40">
              <TableRow>
                <TableHead>
                  <SortableHeader label="Email Address" sortKey="recipientEmail" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Added Date" sortKey="createdAt" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">No recipients found.</TableCell></TableRow>
              ) : paginated.map((recip) => (
                <TableRow key={recip.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {recip.recipientEmail}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(recip.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => handleDelete(recip.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <PaginationControls 
          page={page} 
          totalPages={totalPages} 
          totalItems={filtered.length} 
          pageSize={PAGE_SIZE} 
          onPageChange={setPage} 
        />
      </div>
    </div>
  );
}
