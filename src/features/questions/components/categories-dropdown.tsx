// src/components/questions/categories-dropdown.tsx
'use client';

import { useMemo } from 'react';

import { useCategories } from '@/features/questions/hooks/use-categories';
import { CategoryData } from '@/features/questions/types/questions';

interface CategoriesDropdownProps {
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string) => void;
}

export function CategoriesDropdown({
  selectedCategoryId,
  onCategoryChange
}: CategoriesDropdownProps) {
  const { categories } = useCategories();

  // Organize categories hierarchically for display
  const organizedCategories = useMemo(() => {
    // Create a map for quick lookup
    const categoryMap = new Map<string, CategoryData>();
    const rootCategories: CategoryData[] = [];
    const childCategories = new Map<string, CategoryData[]>();

    // First pass: organize into map and separate roots from children
    categories.forEach(category => {
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

    // Sort function for alphabetical order
    const sortAlphabetically = (a: CategoryData, b: CategoryData) => a.name.localeCompare(b.name);

    // Recursive function to build hierarchy
    const buildHierarchy = (parentCategories: CategoryData[]): CategoryData[] => {
      const result: CategoryData[] = [];

      // Sort current level alphabetically
      parentCategories.sort(sortAlphabetically);

      parentCategories.forEach(category => {
        result.push(category);

        // Add children recursively
        const children = childCategories.get(category.id) || [];
        if (children.length > 0) {
          result.push(...buildHierarchy(children));
        }
      });

      return result;
    };

    return buildHierarchy(rootCategories);
  }, [categories]);

  const handleCategorySelect = (categoryId: string) => {
    onCategoryChange(categoryId);
  };

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

  const renderCategoryName = (category: CategoryData) => {
    const indentLevel = category.level - 1;
    const prefix = '> '.repeat(indentLevel);
    return `${prefix}${category.name}`;
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Category
      </label>
      <select
        value={selectedCategoryId}
        onChange={(e) => handleCategorySelect(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">No category</option>
        {organizedCategories.map((category) => (
          <option key={category.id} value={category.id}>
            {renderCategoryName(category)}
          </option>
        ))}
      </select>
    </div>
  );
}
