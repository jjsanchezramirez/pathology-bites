import { ImageCategory } from '@/types/images';
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
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Format image name for display and database
export const formatImageName = (filename: string): string => {
  // Remove file extension and replace hyphens with spaces
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "").replace(/-/g, " ");
  
  // Convert to sentence case (capitalize first letter, rest lowercase)
  return nameWithoutExt.charAt(0).toUpperCase() + 
         nameWithoutExt.slice(1).toLowerCase();
};

// Clean filename for storage
export const cleanFileName = (filename: string): string => {
  const name = filename.split('.')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');
  const ext = filename.split('.').pop();
  return `${name}.${ext}`;
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