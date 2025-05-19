/**
 * @source src/app/error.tsx
 * 
 * This file defines an ErrorPage component that displays a custom error message
 * when an error occurs in the application. It randomly selects a headline, message,
 * error code, and button text from predefined arrays to provide a unique error
 * experience each time. The component also logs the error to the console and
 * announces the error message to screen readers for accessibility.
 */

"use client";

import { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import FloatingCharacter from "@/components/landing/dr-albright";

const ERROR_CONTENT = {
  headlines: [
    "Specimen Processing Error",
    "Specimen Mismatch Error",
    "Specimen Handling Error",
    "Tissue Processing Error"
  ],
  messages: [
    "The resident swears they put it in the cassette… we have our doubts.",
    "Looks like someone forgot the embedding. Again.",
    "We could blame the microtome, but let's be honest…",
    "Paraffin blocks don't just disappear... or do they?"
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

const getRandomElement = <T,>(arr: readonly T[]): T => 
  arr[Math.floor(Math.random() * arr.length)];

export default function ErrorPage({ 
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Log error
    console.error('Page Error:', error);
    
    // Create and use the error message for screen readers
    const errorMessage = `Error occurred: ${error.message}`;
    
    // You could use this with an aria-live region if needed
    // For now, just focus the error message element
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
          errorElement.setAttribute('aria-label', errorMessage);
          errorElement.focus();
        }
      }, 100);
    }
  }, [error]);

  const headline = getRandomElement(ERROR_CONTENT.headlines);
  const message = getRandomElement(ERROR_CONTENT.messages);
  const errorCode = `${getRandomElement(ERROR_CONTENT.prefixes)}-500`;
  const buttonText = getRandomElement(ERROR_CONTENT.buttonMessages);

  return (
    <main 
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      role="alert"
      aria-labelledby="error-headline"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex justify-center w-full">
          <FloatingCharacter
            imagePath="/images/dr-albright.png"
            imageAlt="Dr. Albright Character"
            size={320}
            wrapperClassName="w-full md:w-auto"
          />
        </div>

        <div 
          className="text-center mt-8 space-y-4"
          tabIndex={-1}
          id="error-message"
        >
          <h1 
            id="error-headline"
            className="text-4xl font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent"
          >
            {headline}
          </h1>
          <p 
            className="text-lg text-muted-foreground"
            aria-live="polite"
          >
            {message}
          </p>
          <p 
            className="text-sm text-muted-foreground/80"
            aria-label={`Error code: ${error?.digest || errorCode}`}
          >
            Error Code: {error?.digest || errorCode}
          </p>
          
          <Button 
            onClick={() => window.location.href = '/'}
            className="mt-4 bg-primary hover:bg-primary/90 shadow-lg 
              hover:shadow-primary/25 transition-all duration-300"
            aria-label={buttonText}
          >
            {buttonText}
          </Button>
        </div>
      </div>
    </main>
  );
}