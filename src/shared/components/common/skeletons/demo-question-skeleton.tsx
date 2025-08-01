// src/components/landing/skeletons/demo-question-skeleton.tsx
'use client'

import React from 'react';
import { Card, CardHeader, CardContent } from "@/shared/components/ui/card";

const QuestionSkeleton = () => {
  return (
    <div
      className="w-full max-w-4xl mx-auto"
      style={{ minHeight: '600px' }}
      data-testid="question-skeleton"
    >
      <Card className="h-full animate-pulse">
        <CardHeader className="py-2">
          <div className="h-6 w-48 bg-muted rounded-lg" />
        </CardHeader>
        <CardContent className="space-y-4">
        {/* Question text skeleton */}
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded-lg w-3/4" />
          <div className="h-4 bg-muted rounded-lg w-full" />
          <div className="h-4 bg-muted rounded-lg w-5/6" />
          <div className="h-4 bg-muted rounded-lg w-2/3" />
        </div>

        {/* Image placeholder skeleton */}
        <div className="relative w-full border rounded-lg" style={{ aspectRatio: '16/10' }}>
          <div className="absolute inset-0 bg-muted rounded-lg w-full h-full" />
        </div>
        
        <div className="h-2 bg-muted rounded-lg w-full max-w-md" />

        {/* Options skeleton */}
        <div className="grid gap-2 pt-2">
          {[...Array(5)].map((_, index) => (
            <div 
              key={index}
              className="p-2 rounded-md border border-muted flex items-center gap-2"
            >
              <div className="w-5 h-5 rounded-full bg-muted shrink-0" />
              <div className="h-4 bg-muted rounded w-3/4 grow" />
            </div>
          ))}
        </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuestionSkeleton;