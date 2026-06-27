"use client";

import { TableCell, TableRow } from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Edit } from "lucide-react";
import { CategoryBadge } from "@/shared/components/ui/category-badge";
import type { Category } from "./categories-utils";

interface CategoryTableRowProps {
  category: Category;
  selected: boolean;
  onToggleSelect: (categoryId: string) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export function CategoryTableRow({
  category,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: CategoryTableRowProps) {
  return (
    <TableRow className={selected ? "bg-muted/50" : ""}>
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(category.id)}
          aria-label={`Select ${category.name}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center">
          <span className="font-medium">{category.name}</span>
        </div>
      </TableCell>
      <TableCell>
        {category.short_form ? (
          <CategoryBadge
            category={{
              id: category.id,
              color: category.color,
              short_form: category.short_form,
              parent_short_form: category.parent_short_form,
              name: category.name,
            }}
          />
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {category.parent_short_form ? (
          <CategoryBadge
            category={{
              color: category.parent_color,
              short_form: category.parent_short_form,
              parent_short_form: category.parent_short_form,
              name: category.parent_name,
            }}
          />
        ) : category.parent_name ? (
          <Badge
            variant="outline"
            className="bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800"
          >
            {category.parent_name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-800"
        >
          {category.question_count || 0} questions
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(category)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(category)} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
