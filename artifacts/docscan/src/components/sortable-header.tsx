import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string;
  currentSortDir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  currentSortDir,
  onSort,
  className
}: SortableHeaderProps) {
  const isActive = sortKey === currentSortKey;
  
  return (
    <div 
      className={cn("flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors", isActive ? "text-foreground" : "text-muted-foreground", className)}
      onClick={() => onSort(sortKey)}
    >
      <span>{label}</span>
      <span className="w-4 h-4 flex items-center justify-center shrink-0">
        {!isActive && <ChevronsUpDown className="w-3 h-3 opacity-50" />}
        {isActive && currentSortDir === "asc" && <ChevronUp className="w-3.5 h-3.5 text-primary" />}
        {isActive && currentSortDir === "desc" && <ChevronDown className="w-3.5 h-3.5 text-primary" />}
      </span>
    </div>
  );
}
