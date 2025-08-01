// src/features/questions/components/universal-tag-selector.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { X, Tag, Loader2 } from 'lucide-react';
import { useUniversalTags } from '@/features/questions/hooks/use-universal-tags';
import { TagData } from '@/features/questions/types/questions';

interface UniversalTagSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  label?: string;
}

export function UniversalTagSelector({
  selectedTagIds,
  onTagsChange,
  multiple = true,
  placeholder = "Search tags or type to create new...",
  maxTags = 5,
  disabled = false,
  label = "Tags"
}: UniversalTagSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<TagData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { recentTags, searchTags, createTag, loading } = useUniversalTags();

  // Get currently displayed tags (search results or recent tags)
  const displayedTags = inputValue.trim() ? searchResults : recentTags;
  
  // Filter out already selected tags
  const availableTags = displayedTags.filter(tag => 
    !selectedTagIds.includes(tag.id)
  );

  // Get selected tag objects
  const selectedTags = selectedTagIds
    .map(id => recentTags.find(tag => tag.id === id) || searchResults.find(tag => tag.id === id))
    .filter(Boolean) as TagData[];

  // Handle search with debouncing
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchTags(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchTags]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(inputValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, handleSearch]);

  // Handle tag selection
  const handleTagSelect = (tag: TagData) => {
    if (multiple) {
      if (selectedTagIds.length >= maxTags) return;
      onTagsChange([...selectedTagIds, tag.id]);
    } else {
      onTagsChange([tag.id]);
    }
    
    setInputValue('');
    setShowDropdown(false);
    setHighlightedIndex(-1);
    
    // Focus back on input for multiple selection
    if (multiple) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  // Handle tag removal
  const handleTagRemove = (tagId: string) => {
    onTagsChange(selectedTagIds.filter(id => id !== tagId));
  };

  // Handle tag creation
  const handleCreateTag = async (tagName: string) => {
    if (!tagName.trim()) return;
    
    try {
      const newTag = await createTag(tagName.trim());
      handleTagSelect(newTag);
    } catch (error) {
      // Error handled in hook
    }
  };

  // Check if we can create a new tag
  const canCreateNewTag = inputValue.trim() && 
    !availableTags.some(tag => tag.name.toLowerCase() === inputValue.trim().toLowerCase()) &&
    (multiple ? selectedTagIds.length < maxTags : selectedTagIds.length === 0);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setShowDropdown(true);
        setHighlightedIndex(0);
      }
      return;
    }

    const totalItems = availableTags.length + (canCreateNewTag ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % totalItems);
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev <= 0 ? totalItems - 1 : prev - 1);
        break;
      
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < availableTags.length) {
          handleTagSelect(availableTags[highlightedIndex]);
        } else if (canCreateNewTag && highlightedIndex === availableTags.length) {
          handleCreateTag(inputValue.trim());
        } else if (canCreateNewTag && inputValue.trim()) {
          handleCreateTag(inputValue.trim());
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        setInputValue('');
        break;
    }
  };

  // Handle input changes
  const handleInputChange = (value: string) => {
    setInputValue(value);
    setShowDropdown(true);
    setHighlightedIndex(-1);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't show input if single mode and tag is selected, or if max tags reached
  const showInput = !disabled && (multiple ? selectedTagIds.length < maxTags : selectedTagIds.length === 0);

  return (
    <div className="space-y-3">
      {label && (
        <label htmlFor="universal-tag-input" className="text-sm font-medium flex items-center gap-2">
          <Tag className="h-4 w-4" />
          {label}
        </label>
      )}

      {/* Input with dropdown */}
      {showInput && (
        <div className="relative" ref={dropdownRef}>
          <Input
            id="universal-tag-input"
            ref={inputRef}
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            disabled={loading}
          />

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-64 overflow-y-auto">
              {isSearching ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Searching...</span>
                </div>
              ) : (
                <>
                  {/* Available tags */}
                  {availableTags.map((tag, index) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                        index === highlightedIndex ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleTagSelect(tag)}
                    >
                      {tag.name}
                    </button>
                  ))}

                  {/* Create new tag option */}
                  {canCreateNewTag && (
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm border-t hover:bg-muted ${
                        availableTags.length === highlightedIndex ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleCreateTag(inputValue.trim())}
                    >
                      Create "{inputValue.trim()}"
                    </button>
                  )}

                  {/* No results message */}
                  {availableTags.length === 0 && !canCreateNewTag && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {inputValue.trim() ? 'No tags found' : 'No available tags'}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
              {tag.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleTagRemove(tag.id)}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                  aria-label={`Remove ${tag.name} tag`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && selectedTags.length === 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading tags...</span>
        </div>
      )}
    </div>
  );
}
