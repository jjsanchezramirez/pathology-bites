// src/components/questions/tags-categories-selector.tsx
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, X, Tag, FolderTree } from 'lucide-react';
import { useTags } from '@/hooks/use-tags';
import { useCategories } from '@/hooks/use-categories';
import { TagData, CategoryData } from '@/types/questions';

interface TagsCategoriesSelectorProps {
  selectedTagIds: string[];
  selectedCategoryIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  onCategoriesChange: (categoryIds: string[]) => void;
}

export function TagsCategoriesSelector({
  selectedTagIds,
  selectedCategoryIds,
  onTagsChange,
  onCategoriesChange
}: TagsCategoriesSelectorProps) {
  const [newTagName, setNewTagName] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  
  const { tags, createTag } = useTags();
  const { categories } = useCategories();

  const handleTagToggle = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    if (selectedCategoryIds.includes(categoryId)) {
      onCategoriesChange(selectedCategoryIds.filter(id => id !== categoryId));
    } else {
      onCategoriesChange([...selectedCategoryIds, categoryId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const newTag = await createTag(newTagName.trim());
      onTagsChange([...selectedTagIds, newTag.id]);
      setNewTagName('');
      setShowTagInput(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));
  const selectedCategories = categories.filter(cat => selectedCategoryIds.includes(cat.id));

  return (
    <div className="space-y-4">
      {/* Tags Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Tags
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-3">
                <h4 className="font-medium">Select Tags</h4>
                
                {/* Create new tag */}
                <div className="space-y-2">
                  {showTagInput ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter tag name..."
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateTag();
                          }
                          if (e.key === 'Escape') {
                            setShowTagInput(false);
                            setNewTagName('');
                          }
                        }}
                        autoFocus
                      />
                      <Button size="sm" onClick={handleCreateTag}>
                        Add
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setShowTagInput(false);
                          setNewTagName('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTagInput(true)}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create New Tag
                    </Button>
                  )}
                </div>

                {/* Existing tags */}
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag.id}`}
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={() => handleTagToggle(tag.id)}
                      />
                      <label
                        htmlFor={`tag-${tag.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {tag.name}
                      </label>
                    </div>
                  ))}
                  {tags.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No tags available. Create your first tag above.
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Selected Tags Display */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
                {tag.name}
                <button
                  type="button"
                  onClick={() => handleTagToggle(tag.id)}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Categories Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Categories
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Categories
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-3">
                <h4 className="font-medium">Select Categories</h4>
                
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={selectedCategoryIds.includes(category.id)}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                      />
                      <label
                        htmlFor={`category-${category.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        style={{ paddingLeft: `${(category.level - 1) * 16}px` }}
                      >
                        {category.name}
                      </label>
                    </div>
                  ))}
                  {categories.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No categories available.
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Selected Categories Display */}
        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map((category) => (
              <Badge key={category.id} variant="outline" className="flex items-center gap-1">
                {category.name}
                <button
                  type="button"
                  onClick={() => handleCategoryToggle(category.id)}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
