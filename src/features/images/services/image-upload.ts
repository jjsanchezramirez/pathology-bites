import { ImageCategory } from '@/features/images/types/images';
import Compressor from 'compressorjs';

// Get descriptive text for each category
export const getCategoryDescription = (category: ImageCategory): string => {
  switch (category) {
    case 'microscopic':
      return 'Histological images taken through a microscope';
    case 'gross':
      return 'Macroscopic specimens and gross surgical pathology images';
    case 'figure':
      return 'Diagrams, illustrations, charts, and other explanatory graphics';
    case 'table':
      return 'Statistical data, classification systems, and other tabular information';
    default:
      return '';
  }
};

// Format file size for display
export const formatSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 Bytes';
  if (typeof bytes !== 'number' || isNaN(bytes)) return 'Unknown';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Ensure we don't go beyond our sizes array
  const sizeIndex = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2))} ${sizes[sizeIndex]}`;
};

// Format image name for display and database
export const formatImageName = (filename: string): string => {
  // Remove file extension and replace hyphens with spaces
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "").replace(/-/g, " ");
  
  // Convert to sentence case (capitalize first letter, rest lowercase)
  return nameWithoutExt.charAt(0).toUpperCase() + 
         nameWithoutExt.slice(1).toLowerCase();
};

// Clean filename for storage with graceful special character handling
export const cleanFileName = (filename: string): string => {
  const nameParts = filename.split('.');
  const extension = nameParts.pop()?.toLowerCase() || 'jpg';
  const baseName = nameParts.join('.')
    .toLowerCase()
    .trim()
    // Replace common special characters with meaningful equivalents
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/%/g, 'percent')
    .replace(/@/g, 'at')
    .replace(/\$/g, 'dollar')
    // Replace whitespace and punctuation with single hyphens
    .replace(/[\s\-_]+/g, '-') // Multiple spaces, hyphens, underscores → single hyphen
    .replace(/[^\w\-]/g, '-') // Non-word characters (except existing hyphens) → hyphen
    .replace(/-+/g, '-') // Multiple consecutive hyphens → single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    || 'file'; // Fallback if name becomes empty

  return `${baseName}.${extension}`;
};

// Get image dimensions
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
      URL.revokeObjectURL(img.src); // Clean up
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

// Compress image with incremental quality reduction
export const compressImage = (file: File, maxSizeBytes = 1000000): Promise<File> => {
  return new Promise((resolve, reject) => {
    const compressRecursively = (settings: {
      maxWidth: number;
      maxHeight: number;
      convertSize: number;
      quality: number;
    }) => {
      new Compressor(file, {
        ...settings,
        success: (result) => {
          const compressedFile = new File([result], file.name, {
            type: result.type,
            lastModified: new Date().getTime()
          });

          if (compressedFile.size <= maxSizeBytes) {
            resolve(compressedFile);
            return;
          }

          if (settings.quality > 0.6) {
            compressRecursively({
              ...settings,
              quality: Math.max(0.6, settings.quality - 0.05)
            });
          } else {
            resolve(compressedFile);
          }
        },
        error: (err) => {
          if (settings.quality > 0.6) {
            compressRecursively({
              ...settings,
              quality: Math.max(0.6, settings.quality - 0.05)
            });
          } else {
            reject(err);
          }
        }
      });
    };

    compressRecursively({
      maxWidth: 2048,
      maxHeight: 2048,
      convertSize: maxSizeBytes,
      quality: 0.8
    });
  });
};