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
    if (confirm("Permanently delete this document from the archive? This cannot be undone.")) {
      deleteDoc.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAllDocumentsQueryKey() });
          toast({ title: "Document Expunged", description: "The record has been permanently removed." });
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
          <h1 className="text-3xl font-bold tracking-tight">System Archive</h1>
          <p className="text-muted-foreground mt-2">Complete log of all scanned materials.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search documents or users..." 
            className="pl-9 h-10 bg-card border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="font-semibold text-foreground">File Identity</TableHead>
              <TableHead className="font-semibold text-foreground">Originator</TableHead>
              <TableHead className="font-semibold text-foreground">Specs</TableHead>
              <TableHead className="font-semibold text-foreground">Timestamp</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">Scanning archive...</TableCell></TableRow>
            ) : filteredDocs?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No documents match the search criteria.</TableCell></TableRow>
            ) : filteredDocs?.map((doc) => (
              <TableRow key={doc.id} className="hover:bg-muted/20 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/5 border border-primary/10 rounded-lg flex items-center justify-center shrink-0">
                      <FileIcon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-semibold truncate max-w-[250px] text-foreground" title={doc.fileName}>{doc.fileName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm text-foreground">{doc.userName}</span>
                    <span className="text-xs text-muted-foreground font-mono mt-0.5">{doc.userEmail}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-col items-start gap-1">
                    <span className="uppercase text-[10px] font-bold tracking-wider bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {doc.fileType.split('/')[1] || 'FILE'}
                    </span>
                    <span className="font-mono text-muted-foreground">{(doc.fileSize! / 1024).toFixed(1)} KB</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono whitespace-nowrap">
                  {format(new Date(doc.uploadedAt), 'MMM d, yyyy')} <br/>
                  <span className="text-xs opacity-70">{format(new Date(doc.uploadedAt), 'HH:mm:ss')}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10" title="View (Not implemented)" asChild>
                      <a href="#" onClick={(e) => e.preventDefault()}>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(doc.id)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
