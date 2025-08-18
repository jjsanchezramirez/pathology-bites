// src/shared/components/common/dr-albright.tsx
'use client'

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useImageCacheHandler } from '@/shared/hooks/use-smart-image-cache';

interface Particle {
  id: string;
  offset: number;
}

interface FloatingCharacterProps {
  imagePath: string;
  imageAlt: string;
  size?: number;
  wrapperClassName?: string;
}

const DEFAULT_SIZE = 288;
const SMOKE_POSITION = { x: 33, y: 40 };

const Smoke = ({ 
  offset, 
  containerSize 
}: { 
  offset: number;
  containerSize: number;
}) => {
  const particleSize = Math.max(containerSize / 96, 8);

  const style = {
    '--smoke-offset': `${offset}%`,
    '--smoke-x': `${SMOKE_POSITION.x}%`,
    '--smoke-y': `${SMOKE_POSITION.y}%`,
    width: `${particleSize}px`,
    height: `${particleSize}px`,
  } as React.CSSProperties;

  return (
    <div
      className="smoke-particle absolute rounded-full bg-primary/20 z-10"
      style={style}
    />
  );
};

const FloatingCharacter = ({
  imagePath,
  imageAlt,
  size = DEFAULT_SIZE,
  wrapperClassName = "",
}: FloatingCharacterProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [mounted, setMounted] = useState(false);
  const particleCounter = useRef(0);
  const handleImageLoad = useImageCacheHandler(imagePath, true); // Priority cache for Dr. Albright

  useEffect(() => {
    setMounted(true);
  }, []);

  const addParticle = useCallback(() => {
    if (!mounted) return;
    
    particleCounter.current += 1;
    const newParticle = {
      id: `particle-${particleCounter.current}`,
      offset: (particleCounter.current * 7) % 20 - 10 // Deterministic offset
    };

    setParticles(prev => [...prev, newParticle]);

    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== newParticle.id));
    }, 2000);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    
    const particleInterval = setInterval(addParticle, 300);

    const resetInterval = setInterval(() => {
      clearInterval(particleInterval);
      setTimeout(() => {
        const newParticleInterval = setInterval(addParticle, 300);
        setTimeout(() => clearInterval(newParticleInterval), 1200);
      }, 0);
    }, 2500);

    return () => {
      clearInterval(particleInterval);
      clearInterval(resetInterval);
    };
  }, [addParticle, mounted]);

  return (
    <>
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(-8px); }
          50% { transform: translateY(8px); }
        }

        @keyframes smoke {
          0% {
            bottom: var(--smoke-y);
            left: var(--smoke-x);
            transform: scale(0.8);
            opacity: 1;
          }
          60% {
            bottom: calc(var(--smoke-y) + 35%);
            left: calc(var(--smoke-x) + var(--smoke-offset));
            transform: scale(1.5);
            opacity: 0.6;
          }
          100% {
            bottom: calc(var(--smoke-y) + 50%);
            left: calc(var(--smoke-x) + var(--smoke-offset) * 2);
            transform: scale(2);
            opacity: 0;
          }
        }

        .smoke-particle {
          animation: smoke 2s ease-out forwards;
        }

        .floating {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>

      <div 
        className={`relative ${wrapperClassName}`} 
        style={{ 
          width: `${size}px`,
          height: `${size}px`,
          maxWidth: '100%'
        }}
      >
        {mounted && particles.map((particle) => (
          <Smoke 
            key={particle.id} 
            offset={particle.offset} 
            containerSize={size}
          />
        ))}
        
        <div className="floating relative w-full h-full z-0">
          {mounted ? (
            <Image
              src={imagePath}
              alt={imageAlt}
              fill
              sizes={`${size}px`}
              className="object-contain"
              unoptimized
              onLoad={handleImageLoad}
            />
          ) : (
            <div
              className="w-full h-full bg-muted/20 rounded animate-pulse"
              style={{ aspectRatio: '1' }}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default FloatingCharacter;