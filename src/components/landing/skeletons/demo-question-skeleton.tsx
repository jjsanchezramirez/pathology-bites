// src/components/landing/skeletons/demo-question-skeleton.tsx
'use client'

import React from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";

const QuestionSkeleton = () => {
  return (
    <Card className="w-full max-w-4xl mx-auto animate-pulse">
      <CardHeader>
        <div className="h-8 w-48 bg-muted rounded-lg" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question text skeleton */}
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded-lg w-3/4" />
          <div className="h-4 bg-muted rounded-lg w-full" />
          <div className="h-4 bg-muted rounded-lg w-2/3" />
        </div>

        {/* Image placeholder skeleton */}
        <div className="h-64 bg-muted rounded-lg w-full" />

        {/* Options skeleton */}
        <div className="grid gap-3">
          {[...Array(5)].map((_, index) => (
            <div 
              key={index}
              className="p-4 rounded-lg border-2 border-muted flex items-center gap-3"
            >
              <div className="w-6 h-6 rounded-full bg-muted flex-shrink-0" />
              <div className="h-4 bg-muted rounded w-2/3 flex-grow" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuestionSkeleton;