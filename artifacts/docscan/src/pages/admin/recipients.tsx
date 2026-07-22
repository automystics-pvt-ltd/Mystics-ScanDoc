import { useState, useMemo, useEffect } from 'react';
import { useListRecipients, useCreateRecipient, useToggleRecipient, getListRecipientsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Mail, Search, Power } from 'lucide-react';
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
import { SortableHeader } from '@/components/sortable-header';
import { PaginationControls } from '@/components/pagination-controls';

const PAGE_SIZE = 10;

export default function Recipients() {
  const { data: recipients, isLoading } = useListRecipients();
  const createRecip = useCreateRecipient();
  const toggleRecip = useToggleRecipient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newEmail, setNewEmail] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      (recipients ?? []).filter((r) =>
        r.recipientEmail.toLowerCase().includes(search.toLowerCase())
      ),
    [recipients, search]
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        let aVal: unknown = a[sortKey as keyof typeof a];
        let bVal: unknown = b[sortKey as keyof typeof b];
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        if (aVal! < bVal!) return sortDir === 'asc' ? -1 : 1;
        if (aVal! > bVal!) return sortDir === 'asc' ? 1 : -1;
        return 0;
      }),
    [filtered, sortKey, sortDir]
  );

  const paginated = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  useEffect(() => setPage(1), [search, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes('@')) return;
    createRecip.mutate(
      { data: { recipientEmail: newEmail } },
      {
        onSuccess: () => {
          setNewEmail('');
          queryClient.invalidateQueries({ queryKey: getListRecipientsQueryKey() });
          toast({ title: 'Recipient Added', description: 'Email successfully added.' });
        },
        onError: (err) => {
          toast({
            title: 'Error',
            description: (err as any).data?.error || 'Error adding address.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleToggle = (id: number, currentlyActive: boolean) => {
    toggleRecip.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRecipientsQueryKey() });
          toast({
            title: currentlyActive ? 'Recipient Deactivated' : 'Recipient Activated',
            description: currentlyActive
              ? 'This address will no longer receive emails.'
              : 'This address will now receive emails.',
          });
        },
        onError: () => {
          toast({ title: 'Error', description: 'Could not update recipient.', variant: 'destructive' });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Recipients</h1>

      <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row gap-3 justify-between items-center bg-muted/20">
          <form onSubmit={handleAdd} className="flex gap-2 w-full sm:w-auto">
            <Input
              type="email"
              required
              placeholder="Add new email address..."
              className="h-9 w-full sm:w-72"
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

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 hover:bg-muted/40">
              <TableRow>
                <TableHead className="px-6 py-3">
                  <SortableHeader
                    label="Email Address"
                    sortKey="recipientEmail"
                    currentSortKey={sortKey}
                    currentSortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="px-6 py-3">
                  <SortableHeader
                    label="Status"
                    sortKey="isActive"
                    currentSortKey={sortKey}
                    currentSortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="px-6 py-3">
                  <SortableHeader
                    label="Added Date"
                    sortKey="createdAt"
                    currentSortKey={sortKey}
                    currentSortDir={sortDir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="px-6 py-3 w-[100px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    No recipients found.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((recip) => (
                  <TableRow
                    key={recip.id}
                    className={`hover:bg-muted/20 ${!recip.isActive ? 'opacity-60' : ''}`}
                  >
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm font-medium">{recip.recipientEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {recip.isActive ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(recip.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 gap-1.5 text-xs font-medium ${
                          recip.isActive
                            ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                            : 'text-primary hover:text-primary hover:bg-primary/10'
                        }`}
                        onClick={() => handleToggle(recip.id, recip.isActive)}
                        disabled={toggleRecip.isPending}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {recip.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
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
