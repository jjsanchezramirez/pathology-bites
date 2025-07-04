// src/components/questions/add-tags-dialog.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Search, Plus, X } from 'lucide-react';
import { useTags } from '@/features/questions/hooks/use-tags';

interface AddTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export function AddTagsDialog({
  open,
  onOpenChange,
  selectedTagIds,
  onTagsChange
}: AddTagsDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [tempSelectedTagIds, setTempSelectedTagIds] = useState<string[]>([]);

  const { tags, createTag } = useTags();

  // Initialize temp selection when dialog opens
  useEffect(() => {
    if (open) {
      setTempSelectedTagIds([...selectedTagIds]);
      setSearchTerm('');
      setNewTagName('');
      setShowCreateInput(false);
    }
  }, [open, selectedTagIds]);

  // Filter tags based on search term
  const filteredTags = useMemo(() => {
    if (!searchTerm) return tags;
    return tags.filter(tag =>
      tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [tags, searchTerm]);

  const handleTagToggle = (tagId: string) => {
    if (tempSelectedTagIds.includes(tagId)) {
      setTempSelectedTagIds(tempSelectedTagIds.filter(id => id !== tagId));
    } else if (tempSelectedTagIds.length < 5) {
      setTempSelectedTagIds([...tempSelectedTagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || tempSelectedTagIds.length >= 5) return;

    try {
      const newTag = await createTag(newTagName.trim());
      setTempSelectedTagIds([...tempSelectedTagIds, newTag.id]);
      setNewTagName('');
      setShowCreateInput(false);
      setSearchTerm('');
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSave = () => {
    onTagsChange(tempSelectedTagIds);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTempSelectedTagIds([...selectedTagIds]);
    onOpenChange(false);
  };

  const selectedTags = tags.filter(tag => tempSelectedTagIds.includes(tag.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tags (Max 5)</DialogTitle>
          </DialogHeader>

        <form onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Create New Tag */}
          {showCreateInput ? (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
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
                      setShowCreateInput(false);
                      setNewTagName('');
                    }
                  }}
                  autoFocus
                />
                <Button type="button" size="sm" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                  Add
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowCreateInput(false);
                  setNewTagName('');
                }}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateInput(true)}
              className="w-full"
              disabled={tempSelectedTagIds.length >= 5}
            >
              <Plus className="h-4 w-4 mr-2" />
              {tempSelectedTagIds.length >= 5 ? 'Maximum 5 tags reached' : 'Create New Tag'}
            </Button>
          )}

          {/* Tags List */}
          <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
            {filteredTags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No tags found</p>
                {searchTerm && !showCreateInput && tempSelectedTagIds.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewTagName(searchTerm);
                      setShowCreateInput(true);
                    }}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create "{searchTerm}"
                  </Button>
                )}
              </div>
            ) : (
              filteredTags.map((tag) => {
                const isSelected = tempSelectedTagIds.includes(tag.id);
                const canSelect = !isSelected && tempSelectedTagIds.length < 5;

                return (
                  <div key={tag.id} className={`flex items-center space-x-2 p-2 hover:bg-muted/50 rounded ${!canSelect && !isSelected ? 'opacity-50' : ''}`}>
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={isSelected}
                      onCheckedChange={() => handleTagToggle(tag.id)}
                      disabled={!canSelect && !isSelected}
                    />
                    <label
                      htmlFor={`tag-${tag.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      {tag.name}
                    </label>
                    {isSelected && (
                      <Badge variant="secondary" className="text-xs">
                        Selected
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Tags Preview */}
          {selectedTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Selected Tags ({selectedTags.length}/5)</p>
              <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
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
            </div>
          )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save Tags ({tempSelectedTagIds.length})
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
