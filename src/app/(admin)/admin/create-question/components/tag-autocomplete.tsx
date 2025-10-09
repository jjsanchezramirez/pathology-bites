'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Tag {
  id: string
  name: string
  description: string | null
  color: string | null
  created_at: string
}

interface TagAutocompleteProps {
  selectedTags: string[]
  onTagsChange: (tagIds: string[]) => void
  allTags: Tag[]
  onTagCreated: (tag: Tag) => void
}

export function TagAutocomplete({ selectedTags, onTagsChange, allTags, onTagCreated }: TagAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [filteredTags, setFilteredTags] = useState<Tag[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter tags based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredTags([])
      setShowDropdown(false)
      return
    }

    const searchLower = searchTerm.toLowerCase().trim()
    const filtered = allTags.filter(tag => 
      tag.name.toLowerCase().includes(searchLower) &&
      !selectedTags.includes(tag.id)
    )
    
    setFilteredTags(filtered)
    setShowDropdown(filtered.length > 0 || searchTerm.trim().length > 0)
  }, [searchTerm, allTags, selectedTags])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectTag = (tag: Tag) => {
    onTagsChange([...selectedTags, tag.id])
    setSearchTerm('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const handleRemoveTag = (tagId: string) => {
    onTagsChange(selectedTags.filter(id => id !== tagId))
  }

  const handleCreateTag = async () => {
    const tagName = searchTerm.trim()
    
    if (!tagName) {
      toast.error('Please enter a tag name')
      return
    }

    // Check if tag already exists (case-insensitive)
    const existingTag = allTags.find(tag => 
      tag.name.toLowerCase() === tagName.toLowerCase()
    )

    if (existingTag) {
      // Tag exists, just select it
      handleSelectTag(existingTag)
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName })
      })

      if (response.ok) {
        const result = await response.json()
        const newTag = result.tag
        
        if (newTag) {
          onTagCreated(newTag)
          onTagsChange([...selectedTags, newTag.id])
          setSearchTerm('')
          setShowDropdown(false)
          toast.success(`Tag "${newTag.name}" created`)
          inputRef.current?.focus()
        }
      } else if (response.status === 409) {
        // Tag already exists (race condition), fetch it
        const tagsResponse = await fetch(`/api/admin/tags?page=0&pageSize=1000&search=${encodeURIComponent(tagName)}`)
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json()
          const foundTag = tagsData.tags?.find((tag: Tag) =>
            tag.name.toLowerCase() === tagName.toLowerCase()
          )
          if (foundTag) {
            handleSelectTag(foundTag)
          }
        }
      } else {
        const errorData = await response.json()
        toast.error(`Failed to create tag: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating tag:', error)
      toast.error('Failed to create tag')
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      
      if (filteredTags.length === 1) {
        // If there's exactly one match, select it
        handleSelectTag(filteredTags[0])
      } else if (filteredTags.length === 0 && searchTerm.trim()) {
        // If no matches, create new tag
        handleCreateTag()
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setSearchTerm('')
    }
  }

  const selectedTagObjects = allTags.filter(tag => selectedTags.includes(tag.id))

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTagObjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTagObjects.map(tag => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="pl-2 pr-1 py-1 text-sm"
            >
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
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchTerm.trim() && (filteredTags.length > 0 || searchTerm.trim().length > 0)) {
                setShowDropdown(true)
              }
            }}
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
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredTags.length > 0 ? (
              <div className="py-1">
                {filteredTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleSelectTag(tag)}
                    className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground text-sm"
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
        Start typing to search existing tags, or press Enter to create a new tag
      </p>
    </div>
  )
}

