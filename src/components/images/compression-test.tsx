import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import Image from 'next/image';
import { 
  Upload, 
  Download, 
  Minimize2, 
  Expand, 
  FileImage, 
  RefreshCcw 
} from 'lucide-react';
import Compressor from 'compressorjs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Define CompressorOptions interface
interface CompressorOptions {
  quality: number;
  strict: boolean;
  checkOrientation: boolean;
  maxWidth?: number;
  maxHeight?: number;
  convertSize?: number;
  mimeType?: string;
  success: (result: File) => void;
  error: (err: Error) => void;
}

export default function AdvancedImageCompressor() {
  // State management
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [compressedImage, setCompressedImage] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Compression settings
  const [quality, setQuality] = useState(0.6);
  const [maxWidth, setMaxWidth] = useState(2048);
  const [maxHeight, setMaxHeight] = useState(2048);
  const [preserveOriginalDimensions, setPreserveOriginalDimensions] = useState(false);
  const [outputFormat, setOutputFormat] = useState<string>('original');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Utility functions
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const calculateReduction = () => {
    if (!originalImage || !compressedImage) return 0;
    return ((originalImage.size - compressedImage.size) / originalImage.size * 100).toFixed(1);
  };

  // File handling
  const handleFileSelect = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }
    
    setOriginalImage(file);
    await compressImage(file);
  };

  const compressImage = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const compressionOptions: CompressorOptions = {
        quality,
        strict: false,
        checkOrientation: false,
        success(result) {
          setCompressedImage(result);
          setIsProcessing(false);
        },
        error(err) {
          console.error('Compression error:', err);
          setIsProcessing(false);
        }
      };

      // Dimension handling
      if (!preserveOriginalDimensions) {
        compressionOptions.maxWidth = maxWidth;
        compressionOptions.maxHeight = maxHeight;
      }

      // Output format handling
      if (outputFormat !== 'original') {
        compressionOptions.convertSize = 5000000; // 5MB threshold for conversion
        compressionOptions.mimeType = `image/${outputFormat}`;
      }

      new Compressor(file, compressionOptions);
    } catch (error) {
      console.error('Error:', error);
      setIsProcessing(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDownload = () => {
    if (!compressedImage) return;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(compressedImage);
    link.download = `compressed-${originalImage?.name || 'image'}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const resetCompression = () => {
    setOriginalImage(null);
    setCompressedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Image Compression Tool
          {originalImage && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetCompression}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Compression Settings */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Compression Quality</Label>
              <Slider
                value={[quality]}
                onValueChange={([value]) => {
                  setQuality(value);
                  if (originalImage) compressImage(originalImage);
                }}
                min={0.1}
                max={1}
                step={0.1}
              />
              <p className="text-sm text-muted-foreground">
                {quality === 1 ? 'Highest Quality' : 
                 quality > 0.7 ? 'High Quality' : 
                 quality > 0.4 ? 'Medium Quality' : 
                 'Low Quality'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Output Format</Label>
              <Select 
                value={outputFormat} 
                onValueChange={(value) => {
                  setOutputFormat(value);
                  if (originalImage) compressImage(originalImage);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select output format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original Format</SelectItem>
                  <SelectItem value="jpeg">JPEG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="webp">WebP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <Label>Preserve Original Dimensions</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={preserveOriginalDimensions}
                  onCheckedChange={(checked) => {
                    setPreserveOriginalDimensions(checked);
                    if (originalImage) compressImage(originalImage);
                  }}
                />
                {preserveOriginalDimensions ? (
                  <Minimize2 className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Expand className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
            {!preserveOriginalDimensions && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Max Width</Label>
                  <Input
                    type="number"
                    value={maxWidth}
                    onChange={(e) => {
                      setMaxWidth(Number(e.target.value));
                      if (originalImage) compressImage(originalImage);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Max Height</Label>
                  <Input
                    type="number"
                    value={maxHeight}
                    onChange={(e) => {
                      setMaxHeight(Number(e.target.value));
                      if (originalImage) compressImage(originalImage);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drag and Drop Upload Area */}
        <div
          className={`border-2 ${
            isDragOver 
              ? 'border-primary bg-primary/10' 
              : 'border-dashed border-gray-300'
          } rounded-lg p-6 text-center transition-colors duration-200`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            id="image-input"
            ref={fileInputRef}
          />
          <label 
            htmlFor="image-input" 
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              {isDragOver 
                ? 'Drop your image here' 
                : 'Drag and drop or click to select an image'}
            </p>
          </label>
        </div>

        {/* Image Preview and Results */}
        {originalImage && (
          <div className="space-y-4">
            {isProcessing ? (
              <div className="flex items-center justify-center p-4">
                <RefreshCcw className="w-6 h-6 animate-spin" />
                <span className="ml-2">Processing image...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2 flex items-center">
                    <FileImage className="w-4 h-4 mr-2" /> Original
                  </h3>
                  <div className="border rounded-lg overflow-hidden relative h-48">
                    <Image
                      src={URL.createObjectURL(originalImage)}
                      alt="Original"
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement;
                        URL.revokeObjectURL(target.src);
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Size: {formatSize(originalImage.size)}
                  </p>
                </div>
                {compressedImage && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center">
                      <Download className="w-4 h-4 mr-2" /> Compressed
                    </h3>
                    <div className="border rounded-lg overflow-hidden relative h-48">
                      <Image
                        src={URL.createObjectURL(compressedImage)}
                        alt="Compressed"
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        onLoad={(e) => {
                          const target = e.target as HTMLImageElement;
                          URL.revokeObjectURL(target.src);
                        }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Size: {formatSize(compressedImage.size)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {compressedImage && !isProcessing && (
              <div className="text-center space-y-2">
                <p className="text-lg font-medium">
                  Size Reduction: {calculateReduction()}%
                </p>
                <Button
                  onClick={handleDownload}
                  className="mt-2"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Compressed Image
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}