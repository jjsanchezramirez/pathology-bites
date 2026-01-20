"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "@/shared/utils/toast";

interface Tag {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
}

interface TagAutocompleteProps {
  selectedTags: string[];
  onTagsChange: (tagIds: string[]) => void;
  allTags: Tag[];
  onTagCreated: (tag: Tag) => void;
}

export function TagAutocomplete({
  selectedTags,
  onTagsChange,
  allTags,
  onTagCreated,
}: TagAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter tags based on search term and initialize on mount
  useEffect(() => {
    if (!searchTerm.trim()) {
      // Show 10 most recent unselected tags when no search term
      const unselected = allTags
        .filter((tag) => !selectedTags.includes(tag.id))
        .slice(0, 10);
      setFilteredTags(unselected);
      setHighlightedIndex(0);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filtered = allTags.filter(
      (tag) => tag.name.toLowerCase().includes(searchLower) && !selectedTags.includes(tag.id)
    );

    setFilteredTags(filtered);
    setHighlightedIndex(0);
  }, [searchTerm, allTags, selectedTags]);

  // Show dropdown automatically when clicking in the input if there are tags to show
  const handleInputFocus = () => {
    setShowDropdown(true);
    // Force update filtered tags to show recent ones if search is empty
    if (!searchTerm.trim()) {
      const unselected = allTags
        .filter((tag) => !selectedTags.includes(tag.id))
        .slice(0, 10);
      setFilteredTags(unselected);
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [highlightedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectTag = (tag: Tag) => {
    // Check if tag is already selected
    if (selectedTags.includes(tag.id)) {
      toast.error(`"${tag.name}" is already added`);
      setSearchTerm("");
      setShowDropdown(false);
      inputRef.current?.focus();
      return;
    }

    onTagsChange([...selectedTags, tag.id]);
    setSearchTerm("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagId: string) => {
    onTagsChange(selectedTags.filter((id) => id !== tagId));
  };

  const handleCreateTag = async () => {
    const tagName = searchTerm.trim();

    if (!tagName) {
      toast.error("Please enter a tag name");
      return;
    }

    // Check if tag already exists (case-insensitive)
    const existingTag = allTags.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());

    if (existingTag) {
      // Tag exists, just select it
      handleSelectTag(existingTag);
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tagName }),
      });

      if (response.ok) {
        const result = await response.json();
        const newTag = result.tag;

        if (newTag) {
          onTagCreated(newTag);
          onTagsChange([...selectedTags, newTag.id]);
          setSearchTerm("");
          setShowDropdown(false);
          toast.success(`Tag "${newTag.name}" created`);
          inputRef.current?.focus();
        }
      } else if (response.status === 409) {
        // Tag already exists (race condition), fetch it
        const tagsResponse = await fetch(
          `/api/admin/tags?page=0&pageSize=1000&search=${encodeURIComponent(tagName)}`
        );
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json();
          const foundTag = tagsData.tags?.find(
            (tag: Tag) => tag.name.toLowerCase() === tagName.toLowerCase()
          );
          if (foundTag) {
            handleSelectTag(foundTag);
          }
        }
      } else {
        const errorData = await response.json();
        toast.error(`Failed to create tag: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error creating tag:", error);
      toast.error("Failed to create tag");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowDropdown(true);
      setHighlightedIndex((prev) =>
        prev < filteredTags.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();

      if (filteredTags.length > 0) {
        // Select the highlighted tag
        handleSelectTag(filteredTags[highlightedIndex]);
      } else if (searchTerm.trim()) {
        // If no matches, create new tag
        handleCreateTag();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setSearchTerm("");
      setHighlightedIndex(0);
    } else if (e.key === "Tab" && filteredTags.length > 0) {
      e.preventDefault();
      // Tab selects the highlighted option
      handleSelectTag(filteredTags[highlightedIndex]);
    }
  };

  const selectedTagObjects = allTags.filter((tag) => selectedTags.includes(tag.id));

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTagObjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTagObjects.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="pl-2 pr-1 py-1 text-sm">
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search Input with Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search existing tags or create new..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleCreateTag}
            disabled={!searchTerm.trim() || isCreating}
            size="sm"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Dropdown */}
        {showDropdown && (filteredTags.length > 0 || searchTerm.trim()) && (
          <div className="absolute z-[9999] w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredTags.length > 0 ? (
              <div className="py-1">
                {filteredTags.map((tag, index) => (
                  <button
                    key={tag.id}
                    ref={(el) => (optionRefs.current[index] = el)}
                    type="button"
                    onClick={() => handleSelectTag(tag)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                      index === highlightedIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : searchTerm.trim() ? (
              <div className="py-2 px-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>No matching tags found</span>
                  <Button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={isCreating}
                    size="sm"
                    variant="ghost"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create "{searchTerm.trim()}"
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Use ↑↓ arrows to navigate, Enter/Tab to select, Escape to cancel
      </p>
    </div>
  );
}
