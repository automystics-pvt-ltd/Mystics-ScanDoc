import { useListAllDocuments, useDeleteDocument, getListAllDocumentsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { File as FileIcon, Trash2, Search, ExternalLink } from 'lucide-react';
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
import { useState } from 'react';

export default function Documents() {
  const { data: documents, isLoading } = useListAllDocuments();
  const deleteDoc = useDeleteDocument();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const handleDelete = (id: number) => {
    if (confirm("Permanently delete this document?")) {
      deleteDoc.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAllDocumentsQueryKey() });
          toast({ title: "Document deleted" });
        }
      });
    }
  };

  const filteredDocs = documents?.filter(d => 
    d.fileName.toLowerCase().includes(search.toLowerCase()) || 
    d.userName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-2">All scanned documents across the system.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search documents or users..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card border rounded-xl shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Uploader</TableHead>
              <TableHead>Size & Type</TableHead>
              <TableHead>Date Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filteredDocs?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No documents found.</TableCell></TableRow>
            ) : filteredDocs?.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate max-w-[200px]" title={doc.fileName}>{doc.fileName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{doc.userName}</span>
                    <span className="text-xs text-muted-foreground">{doc.userEmail}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {(doc.fileSize! / 1024).toFixed(1)} KB <br />
                  <span className="uppercase text-xs">{doc.fileType.split('/')[1] || 'FILE'}</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(doc.uploadedAt), 'MMM d, yyyy HH:mm')}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" asChild>
                    {/* If there was a view URL we could put it here */}
                    <a href="#" onClick={(e) => e.preventDefault()} title="View (Not implemented in backend)">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(doc.id)}>
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