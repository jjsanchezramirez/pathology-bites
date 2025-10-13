import { useState } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { IMAGE_CATEGORIES, type ImageCategory } from '@/features/images/types/images';
import { Loader2 } from 'lucide-react';

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onSave: (data: { category?: string; source_ref?: string }) => Promise<void>;
}

export function BulkEditDialog({
  open,
  onOpenChange,
  selectedCount,
  onSave
}: BulkEditDialogProps) {
  const [category, setCategory] = useState<string>('');
  const [sourceRef, setSourceRef] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: { category?: string; source_ref?: string } = {};
      
      // Only include fields that have been set
      if (category && category !== 'no-change') {
        updates.category = category;
      }
      if (sourceRef.trim()) {
        updates.source_ref = sourceRef.trim();
      }

      // Only save if there are actual changes
      if (Object.keys(updates).length > 0) {
        await onSave(updates);
      }
      
      // Reset form
      setCategory('');
      setSourceRef('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save bulk edits:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCategory('');
    setSourceRef('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Bulk Edit Images</DialogTitle>
            <DialogDescription>
              Edit metadata for {selectedCount} selected image{selectedCount !== 1 ? 's' : ''}. 
              Only fields you modify will be updated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="bulk-category">Category</Label>
              <Select
                value={category}
                onValueChange={setCategory}
              >
                <SelectTrigger id="bulk-category">
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-change">No change</SelectItem>
                  {Object.entries(IMAGE_CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave as "No change" to keep existing categories
              </p>
            </div>

            {/* Source Reference Input */}
            <div className="space-y-2">
              <Label htmlFor="bulk-source">Source Reference</Label>
              <Input
                id="bulk-source"
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                placeholder="Leave empty to keep existing sources"
              />
              <p className="text-xs text-muted-foreground">
                Enter a value to update all selected images, or leave empty to keep existing values
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || (category === '' && sourceRef.trim() === '')}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                `Update ${selectedCount} Image${selectedCount !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

