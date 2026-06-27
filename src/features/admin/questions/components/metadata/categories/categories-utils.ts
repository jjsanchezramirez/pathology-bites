// Pure helpers + shared types for the categories management UI.
// Extracted from categories-management.tsx so the hierarchy/pagination logic is
// unit-testable in isolation (see categories-utils.test.ts).

export interface Category {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  level: number;
  color?: string;
  created_at: string;
  question_count?: number;
  parent_name?: string;
  parent_short_form?: string;
  parent_color?: string;
  short_form?: string;
}

export const PAGE_SIZE = 30;

export function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
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

/**
 * Flatten a category list into hierarchy order: each root (alphabetical) is
 * immediately followed by its descendants (also alphabetical, depth-first).
 */
export function organizeHierarchically(categories: Category[]): Category[] {
  const categoryMap = new Map<string, Category>();
  const rootCategories: Category[] = [];
  const childCategories = new Map<string, Category[]>();

  // First pass: organize into map and separate roots from children
  categories.forEach((category) => {
    categoryMap.set(category.id, category);
    if (!category.parent_id) {
      rootCategories.push(category);
    } else {
      if (!childCategories.has(category.parent_id)) {
        childCategories.set(category.parent_id, []);
      }
      childCategories.get(category.parent_id)!.push(category);
    }
  });

  const sortAlphabetically = (a: Category, b: Category) => a.name.localeCompare(b.name);

  const buildHierarchy = (parentCategories: Category[]): Category[] => {
    const result: Category[] = [];

    parentCategories.sort(sortAlphabetically);

    parentCategories.forEach((category) => {
      result.push(category);

      const children = childCategories.get(category.id) || [];
      if (children.length > 0) {
        result.push(...buildHierarchy(children));
      }
    });

    return result;
  };

  return buildHierarchy(rootCategories);
}
