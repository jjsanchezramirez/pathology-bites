import sharp from 'sharp';

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Get image dimensions from a file buffer using Sharp (server-side only)
 */
export async function getImageDimensionsFromBuffer(buffer: Buffer): Promise<ImageDimensions> {
  try {
    const metadata = await sharp(buffer).metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to determine image dimensions');
    }

    return {
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    throw new Error('Failed to process image dimensions');
  }
}

/**
 * Get image dimensions from a File object (server-side only)
 */
export async function getImageDimensionsFromFile(file: File): Promise<ImageDimensions> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    return await getImageDimensionsFromBuffer(buffer);
  } catch (error) {
    console.error('Error getting image dimensions from file:', error);
    throw new Error('Failed to process image dimensions');
  }
}

/**
 * Validate that a buffer contains a valid image
 */
export async function validateImageBuffer(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return !!(metadata.width && metadata.height && metadata.format);
  } catch {
    return false;
  }
}

/**
 * Get image format from buffer
 */
export async function getImageFormat(buffer: Buffer): Promise<string | undefined> {
  try {
    const metadata = await sharp(buffer).metadata();
    return metadata.format;
  } catch (error) {
    console.error('Error getting image format:', error);
    return undefined;
  }
}
