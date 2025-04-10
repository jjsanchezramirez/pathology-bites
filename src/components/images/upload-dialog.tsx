import { useState, useCallback, useEffect } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IMAGE_CATEGORIES, type ImageCategory, type UploadDialogProps } from '@/types/images';
import { getCategoryDescription, formatSize } from '@/lib/images/image-upload';
import { useImageUpload } from '@/hooks/use-image-upload';

export function UploadDialog({ open, onOpenChange, onUpload }: UploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ImageCategory>('microscopic');
  const [sourceRef, setSourceRef] = useState('');

  const { 
    isUploading, 
    fileProgress, 
    uploadFiles, 
    resetProgress 
  } = useImageUpload({
    onUploadComplete: onUpload
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      resetProgress();
      setIsDragging(false);
      setSourceRef('');
      setSelectedCategory('microscopic');
    }
  }, [open, resetProgress]);

  // Handle file input change
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    uploadFiles(files, selectedCategory, sourceRef);
  }, [uploadFiles, selectedCategory, sourceRef]);

  // Handle drag and drop events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files, selectedCategory, sourceRef);
  }, [uploadFiles, selectedCategory, sourceRef]);

  const handleCategoryChange = useCallback((value: string) => {
    setSelectedCategory(value as ImageCategory);
    if (!['figure', 'table'].includes(value)) {
      setSourceRef('');
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Images</DialogTitle>
          <DialogDescription>
            Images larger than 1MB will be automatically compressed while maintaining quality.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Image Category</Label>
            <Select 
              value={selectedCategory}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(IMAGE_CATEGORIES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {getCategoryDescription(selectedCategory)}
            </p>
          </div>

          {/* Source Reference Input - Only shown for figures and tables */}
          {(selectedCategory === 'figure' || selectedCategory === 'table') && (
            <div className="space-y-2">
              <Label htmlFor="sourceRef">
                Source Reference (optional)
              </Label>
              <Input
                id="sourceRef"
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                placeholder={`Enter source reference for this ${selectedCategory.toLowerCase()}`}
                className="w-full"
              />
            </div>
          )}

          {/* Upload Area */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center w-full h-32 
              border-2 border-dashed rounded-lg cursor-pointer 
              transition-colors duration-200
              ${isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-muted hover:bg-muted/50'
              }
            `}
          >
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              multiple 
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {isUploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragging 
                      ? 'Drop images here'
                      : 'Drag & drop images or click to select'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, GIF (max 1MB after compression)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {fileProgress.length > 0 && (
            <div className="space-y-3">
              {fileProgress.map((file) => (
                <div key={file.fileName} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate">{file.fileName}</span>
                    <span className="text-muted-foreground">
                      {file.compressedSize 
                        ? `${formatSize(file.originalSize)} → ${formatSize(file.compressedSize)}`
                        : formatSize(file.originalSize)}
                    </span>
                  </div>
                  <Progress 
                    value={file.progress} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{file.status}</span>
                    <span>{file.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}