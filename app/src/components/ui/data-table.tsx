import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface DataTableColumn<T> {
    key: string;
    header: ReactNode;
    cell: (row: T) => ReactNode;
    className?: string;
    headerClassName?: string;
    /** Hide the column below this breakpoint (keeps tables usable on phones). */
    hideBelow?: "sm" | "md" | "lg" | "xl";
}

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

interface DataTableProps<T> {
    columns: DataTableColumn<T>[];
    data: T[] | undefined;
    rowKey: (row: T) => string;
    loading?: boolean;
    error?: unknown;
    onRetry?: () => void;
    pagination?: PaginationMeta;
    onPageChange?: (page: number) => void;
    /** Whole-row navigation target. */
    rowHref?: (row: T) => string;
    onRowClick?: (row: T) => void;
    empty?: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode };
    className?: string;
    /** Render without the outer card border (when already inside a Card). */
    bare?: boolean;
}

const hideClass = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;

/**
 * Server-paginated table (mockup `.panel + table`). Loading → skeleton, error → ErrorState (403/404 aware),
 * empty → EmptyState. Rows are clickable when `rowHref`/`onRowClick` is given.
 */
export function DataTable<T>({ columns, data, rowKey, loading, error, onRetry, pagination, onPageChange, rowHref, onRowClick, empty, className, bare }: DataTableProps<T>) {
    const navigate = useNavigate();
    const clickable = !!rowHref || !!onRowClick;

    let body: ReactNode;
    if (loading && !data) body = <ListSkeleton />;
    else if (error) body = <ErrorState error={error} onRetry={onRetry} />;
    else if (!data?.length) body = <EmptyState compact title={empty?.title ?? "Nothing here yet"} description={empty?.description} action={empty?.action} icon={empty?.icon} />;
    else
        body = (
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        {columns.map((c) => (
                            <TableHead key={c.key} className={cn("h-9 whitespace-nowrap text-xs font-medium text-muted-foreground", c.hideBelow && hideClass[c.hideBelow], c.headerClassName)}>
                                {c.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody className={cn(loading && "opacity-60")}>
                    {data.map((row) => (
                        <TableRow
                            key={rowKey(row)}
                            className={cn("border-border-soft", clickable && "cursor-pointer")}
                            onClick={(e) => {
                                if ((e.target as HTMLElement).closest("button,a,[role=menuitem],[role=checkbox],input")) return;
                                if (onRowClick) onRowClick(row);
                                else if (rowHref) navigate(rowHref(row));
                            }}
                        >
                            {columns.map((c) => (
                                <TableCell key={c.key} className={cn("py-2 text-[13px]", c.hideBelow && hideClass[c.hideBelow], c.className)}>
                                    {c.cell(row)}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );

    return (
        <div className={cn(!bare && "overflow-hidden rounded-lg border border-border bg-card", className)}>
            <div className="overflow-x-auto">{body}</div>
            {pagination && pagination.total_pages > 1 && onPageChange && (
                <div className="flex flex-col items-center justify-between gap-2 border-t border-border px-3 py-2 sm:flex-row">
                    <span className="text-xs text-muted-foreground tabular">
                        {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </span>
                    <Pagination currentPage={pagination.page} totalPages={pagination.total_pages} onPageChange={onPageChange} />
                </div>
            )}
        </div>
    );
}

/** Toolbar above a table: search on the left, filters/actions on the right; stacks on phones. */
export function TableToolbar({ search, onSearch, placeholder = "Search…", children, className }: { search?: string; onSearch?: (v: string) => void; placeholder?: string; children?: ReactNode; className?: string }) {
    return (
        <div className={cn("mb-3 flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
            {onSearch && (
                <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ash" />
                    <Input value={search ?? ""} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="h-8 pl-8" aria-label="Search" />
                </div>
            )}
            {children && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{children}</div>}
        </div>
    );
}
