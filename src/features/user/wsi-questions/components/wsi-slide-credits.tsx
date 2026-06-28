"use client";

import { VirtualSlide } from "@/shared/types/virtual-slides";

/** Attribution line under the WSI viewer, including formatted author list when present. */
export function WSISlideCredits({ wsi }: { wsi: VirtualSlide }) {
  const authorsValue = wsi.source_metadata?.authors;
  const hasAuthors = Array.isArray(authorsValue) && authorsValue.length > 0;

  const formatAuthor = (author: string) => {
    const parts = author.split(" – ");
    if (parts.length === 2) {
      return (
        <span key={author}>
          {parts[0]} – <em>{parts[1]}</em>
        </span>
      );
    }
    return author;
  };

  return (
    <div className="mt-2 text-xs text-muted-foreground text-center">
      <div>
        Virtual slide provided by <span className="font-bold">PathPresenter</span> and{" "}
        <span className="font-bold">Ace My Path</span>. All credits belong to the original authors.
      </div>
      {hasAuthors && (
        <div className="mt-1">
          <span className="font-bold">Authors:</span>{" "}
          {(() => {
            const authors = authorsValue as string[];
            if (authors.length === 1) {
              return formatAuthor(authors[0]);
            } else if (authors.length === 2) {
              return (
                <span>
                  {formatAuthor(authors[0])} and {formatAuthor(authors[1])}
                </span>
              );
            } else {
              return (
                <span>
                  {authors.slice(0, -1).map((author, index) => (
                    <span key={author}>
                      {formatAuthor(author)}
                      {index < authors.slice(0, -1).length - 1 ? ", " : ""}
                    </span>
                  ))}
                  , and {formatAuthor(authors[authors.length - 1])}
                </span>
              );
            }
          })()}
        </div>
      )}
    </div>
  );
}
