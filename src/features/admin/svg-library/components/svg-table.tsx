"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Search, Trash2, MoreVertical, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { fetchSvgAssets } from "@/features/admin/svg-library/services/svg-assets";
import type { SvgAsset, SvgListFilters } from "@/features/admin/svg-library/types";
import { toast } from "@/shared/utils/ui/toast";
import { log } from "@/shared/utils/logging";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function RowActions({
  asset,
  onEdit,
  onDelete,
}: {
  asset: SvgAsset;
  onEdit: (asset: SvgAsset) => void;
  onDelete: (asset: SvgAsset) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEdit(asset)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="text-red-600" onClick={() => onDelete(asset)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const pages: (number | "ellipsis")[] = [];
  pages.push(0);
  if (currentPage > 2) pages.push("ellipsis");
  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages - 2, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 3) pages.push("ellipsis");
  pages.push(totalPages - 1);
  return pages;
}

interface SvgTableProps {
  onEdit: (asset: SvgAsset) => void;
  onDelete: (asset: SvgAsset) => void;
  refreshKey: number;
}

export function SvgTable({ onEdit, onDelete, refreshKey }: SvgTableProps) {
  const [assets, setAssets] = useState<SvgAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SvgListFilters>({ page: 0, pageSize: 10 });
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchSvgAssets(filters);
      if (result.error) {
        toast.error("Failed to load SVG assets");
        return;
      }
      setAssets(result.data);
      setTotalItems(result.total);
    } catch (error) {
      log.error("Error loading SVG assets:", error);
      toast.error("Failed to load SVG assets");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets, refreshKey]);

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setPage(0);
      setFilters({
        search: searchQuery || undefined,
        page: 0,
        pageSize,
      });
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, pageSize]);

  // Sync page changes into filters
  useEffect(() => {
    setFilters((prev) => ({ ...prev, page, pageSize }));
  }, [page, pageSize]);

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[60px]">Preview</TableHead>
              <TableHead className="min-w-[200px]">Name</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="w-[120px]">Dimensions</TableHead>
              <TableHead className="w-[80px]">Size</TableHead>
              <TableHead className="w-[100px]">Created</TableHead>
              <TableHead className="w-[70px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <Skeleton className="h-10 w-10 rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 ml-auto rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {searchQuery
                    ? "No SVG assets found matching your search"
                    : "No SVG assets uploaded yet"}
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="w-10 h-10 rounded border bg-white flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="max-w-[40px] max-h-[40px] object-contain"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm font-medium line-clamp-1">{asset.name}</p>
                      {asset.description && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {asset.description}
                        </p>
                      )}
                      {asset.tags && asset.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {asset.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                          {asset.tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{asset.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {asset.category ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {asset.category}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {asset.width && asset.height ? `${asset.width} x ${asset.height}` : "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatBytes(asset.file_size_bytes)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(asset.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <RowActions asset={asset} onEdit={onEdit} onDelete={onDelete} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalItems)} of{" "}
              {totalItems}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[110px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {getPageNumbers(page, totalPages).map((p, i) =>
              p === "ellipsis" ? (
                <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPage(p)}
                >
                  {p + 1}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
