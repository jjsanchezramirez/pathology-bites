// src/features/images/components/simple-image-preview.tsx
import { cn } from '@/shared/utils';
import Image from 'next/image';

interface SimpleImagePreviewProps {
  src: string;
  alt: string;
  className?: string;
}

export function SimpleImagePreview({
  src,
  alt,
  className
}: SimpleImagePreviewProps) {
  return (
    <div
      className={cn(
        "relative rounded overflow-hidden bg-muted",
        "transition-all duration-200 ease-in-out",
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 80px, 80px"
      />
    </div>
  );
}
