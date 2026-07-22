---
name: DocScan Table Pattern
description: Client-side filter/sort/paginate pattern used across all admin data tables
---

# Admin Table Pattern

All data tables in DocScan use client-side filtering, sorting, and pagination (API returns full data sets).

## Shared components
- `src/components/sortable-header.tsx` — column header with asc/desc chevron
- `src/components/pagination-controls.tsx` — "Showing X-Y of Z" + Prev/page numbers/Next

## Data pipeline (useMemo chain)
```
raw API data → filtered (search + dropdowns) → sorted (sortKey + sortDir) → paginated (page * PAGE_SIZE)
```

## State
```ts
const [search, setSearch] = useState("")
const [sortKey, setSortKey] = useState("createdAt")
const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
const [page, setPage] = useState(1)
const PAGE_SIZE = 10
// Reset page whenever search/filters change via useEffect
```

**Why:** API does not support server-side pagination params on most list endpoints. Client-side is simpler and consistent.

**How to apply:** Every new table page should follow this pattern and reuse SortableHeader + PaginationControls.
