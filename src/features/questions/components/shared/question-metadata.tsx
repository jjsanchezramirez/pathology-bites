'use client';

import React from 'react';
import { QuestionWithDetails } from '@/features/questions/types/questions';

interface QuestionMetadataProps {
  question: QuestionWithDetails;
}

export function QuestionMetadata({ question }: QuestionMetadataProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  const getVersionString = () => {
    const major = question.version_major || 1;
    const minor = question.version_minor || 0;
    const patch = question.version_patch || 0;
    return `v${major}.${minor}.${patch}`;
  };

  return (
    <div className="text-xs text-muted-foreground">
      <span>
        Created by {question.created_by_name || 'Unknown'} on {formatDate(question.created_at)}
      </span>
      {question.updated_at && question.updated_by_name && (
        <>
          <br />
          <span>
            Last updated by {question.updated_by_name} on {formatDate(question.updated_at)} {getVersionString()}
          </span>
        </>
      )}
    </div>
  );
}
