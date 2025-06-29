// src/components/questions/tags-selector.tsx
'use client';

import { useState } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Plus, X, Tag } from 'lucide-react';
import { useTags } from '@/features/questions/hooks/use-tags';

interface TagsSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export function TagsSelector({
  selectedTagIds,
  onTagsChange
}: TagsSelectorProps) {
  const [newTagName, setNewTagName] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const { tags, createTag } = useTags();

  const handleTagToggle = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
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

  return (
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
                    <Button type="button" size="sm" onClick={handleCreateTag}>
                      Add
                    </Button>
                    <Button
                      type="button"
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
                    type="button"
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
  );
}
