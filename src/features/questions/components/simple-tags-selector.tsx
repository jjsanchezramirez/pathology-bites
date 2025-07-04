// src/components/questions/simple-tags-selector.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { X } from 'lucide-react';
import { useTags } from '@/features/questions/hooks/use-tags';

interface SimpleTagsSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export function SimpleTagsSelector({
  selectedTagIds,
  onTagsChange
}: SimpleTagsSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { tags, createTag } = useTags();

  // Get selected tags
  const selectedTags = selectedTagIds
    .filter(id => id) // Filter out any undefined/null IDs
    .map((id) => {
      const existingTag = tags.find(tag => tag.id === id);
      if (existingTag) return existingTag;
      return { id, name: `Loading...`, created_at: '', updated_at: '' };
    });

  // Filter available tags (not already selected)
  const availableTags = tags.filter(tag =>
    !selectedTagIds.includes(tag.id) &&
    tag.name.toLowerCase().includes(inputValue.toLowerCase())
  ).slice(0, 5);

  const handleRemoveTag = (tagId: string) => {
    onTagsChange(selectedTagIds.filter(id => id !== tagId));
  };

  const handleAddTag = async (tagName: string) => {
    if (selectedTagIds.length >= 5) return;

    // Check if tag already exists
    const existingTag = tags.find(tag => tag.name.toLowerCase() === tagName.toLowerCase());
    if (existingTag) {
      if (!selectedTagIds.includes(existingTag.id)) {
        onTagsChange([...selectedTagIds, existingTag.id]);
      }
    } else {
      // Create new tag
      try {
        const newTag = await createTag(tagName);
        onTagsChange([...selectedTagIds, newTag.id]);
      } catch (error) {
        // Error handled in hook
      }
    }
    setInputValue('');
    setShowSuggestions(false);

    // Focus back on the input field
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleAddTag(inputValue.trim());
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setInputValue('');
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setShowSuggestions(value.length > 0);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Tags</label>

      {/* Input with suggestions */}
      {selectedTagIds.length < 5 && (
        <div className="relative" ref={inputRef}>
          <Input
            ref={inputRef}
            placeholder="Type to add tags..."
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue && setShowSuggestions(true)}
          />

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
              {availableTags.length > 0 && (
                <>
                  {availableTags.map((tag, index) => (
                    <button
                      key={tag.id || `available-tag-${index}`}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                      onClick={() => handleAddTag(tag.name)}
                    >
                      {tag.name}
                    </button>
                  ))}
                </>
              )}

              {inputValue.trim() && !tags.find(tag => tag.name.toLowerCase() === inputValue.toLowerCase()) && (
                <button
                  key={`create-${inputValue.trim()}`}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-t"
                  onClick={() => handleAddTag(inputValue.trim())}
                >
                  Create "{inputValue.trim()}"
                </button>
              )}

              {availableTags.length === 0 && !inputValue.trim() && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No tags found
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag, index) => (
            <Badge key={tag.id || `tag-${index}`} variant="secondary" className="flex items-center gap-1">
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
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
