/**
 * @source src/app/not-found.tsx
 * 
 * This component renders a custom 404 Not Found page with randomized content.
 * It displays a headline, a message, an error code, and a button to navigate back to the home page.
 * The content is randomized from predefined arrays of headlines, messages, error codes, and button texts.
 * The component also includes a floating character image for visual appeal.
 * 
 * The null check in the useEffect hook is there to prevent flickering during the initial render.
 * It ensures that the random content is only generated once and not during the server-side rendering.
 */

"use client";

import { useEffect, useState } from 'react';
import { Button } from "@/shared/components/ui/button";
import FloatingCharacter from "@/shared/components/common/dr-albright";
import { getR2PublicUrl } from "@/shared/services/r2-storage";

const ERROR_CONTENT = {
  headlines: [
    "Specimen Not Found",
    "Slides Not Found",
    "Stains Not Found"
  ],
  messages: [
    "The resident swears the slides were there… we have our doubts.",
    "Slides are missing… they're probably just on the microscope. Again.",
    "Slides seem to have disappeared… Accio slides!",
    "Slides can't just vanish… or can they?"
  ],
  prefixes: ["LAB", "HE", "PATH"],
  buttonMessages: [
    "Return to Grossing Station",
    "Return to the Bench",
    "Go Back to the Bucket",
    "Back to the Lab",
    "Back to the Microscope"
  ]
} as const;

type RandomContent = {
  headline: string;
  message: string;
  errorCode: string;
  buttonText: string;
};

const getRandomElement = <T,>(arr: readonly T[]): T => 
  arr[Math.floor(Math.random() * arr.length)];

const generateRandomContent = (): RandomContent => ({
  headline: getRandomElement(ERROR_CONTENT.headlines),
  message: getRandomElement(ERROR_CONTENT.messages),
  errorCode: `${getRandomElement(ERROR_CONTENT.prefixes)}-404`,
  buttonText: getRandomElement(ERROR_CONTENT.buttonMessages)
});

export default function NotFoundPage() {
  // Keep the null check to prevent hydration mismatch
  const [randomContent, setRandomContent] = useState<RandomContent | null>(null);

  useEffect(() => {
    // Enforce light mode on 404 page (but NOT dashboard theme)
    const html = document.documentElement
    html.classList.remove('dark')
    html.classList.add('light')

    // Set data attribute to identify forced theme state
    html.setAttribute('data-not-found-page-enforced', 'true')

    if (!randomContent) {
      setRandomContent(generateRandomContent());
    }
  }, [randomContent]);

  // Show nothing during server render and hydration
  if (!randomContent) {
    return null;
  }

  return (
    <main 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      role="alert"
      aria-labelledby="not-found-headline"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex justify-center w-full">
          <FloatingCharacter
            imagePath={getR2PublicUrl("assets/dr-albright.png")}
            imageAlt="Dr. Albright Character"
            size={320}
            wrapperClassName="w-full md:w-auto"
          />
        </div>

        <div 
          className="text-center mt-8 space-y-4"
          tabIndex={-1}
          id="not-found-message"
        >
          <h1 
            id="not-found-headline"
            className="text-4xl font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent"
          >
            {randomContent.headline}
          </h1>
          <p 
            className="text-lg text-muted-foreground"
            aria-live="polite"
          >
            {randomContent.message}
          </p>
          <p 
            className="text-sm text-muted-foreground/80"
            aria-label={`Error code: ${randomContent.errorCode}`}
          >
            Error Code: {randomContent.errorCode}
          </p>
          
          <Button 
            onClick={() => window.location.href = '/'}
            className="mt-4 bg-primary hover:bg-primary/90 shadow-lg 
              hover:shadow-primary/25 transition-all duration-300"
            aria-label={randomContent.buttonText}
          >
            {randomContent.buttonText}
          </Button>
        </div>
      </div>
    </main>
  );
}