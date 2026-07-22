import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange
}: PaginationControlsProps) {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  // Generate page numbers
  const pages = [];
  const maxVisiblePages = 5;
  
  let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between px-2 py-4 border-t border-border">
      <div className="text-sm text-muted-foreground font-medium">
        Showing <span className="text-foreground">{start}</span> to <span className="text-foreground">{end}</span> of <span className="text-foreground">{totalItems}</span> results
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="w-8 h-8 rounded-md"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        {startPage > 1 && (
          <>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md text-sm font-medium" onClick={() => onPageChange(1)}>1</Button>
            {startPage > 2 && <span className="text-muted-foreground text-sm px-1">...</span>}
          </>
        )}
        
        {pages.map(p => (
          <Button
            key={p}
            variant={page === p ? "default" : "ghost"}
            size="icon"
            className={`w-8 h-8 rounded-md text-sm font-medium ${page === p ? 'bg-primary text-primary-foreground shadow-sm' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-muted-foreground text-sm px-1">...</span>}
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-md text-sm font-medium" onClick={() => onPageChange(totalPages)}>{totalPages}</Button>
          </>
        )}

        <Button
          variant="outline"
          size="icon"
          className="w-8 h-8 rounded-md"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages || totalPages === 0}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
