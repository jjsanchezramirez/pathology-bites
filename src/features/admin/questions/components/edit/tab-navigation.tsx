"use client";
import { Check } from "lucide-react";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface Step {
  id: string;
  name: string;
  description: string;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const steps: Step[] = [
    { id: "source", name: "Source", description: "AI model & context" },
    { id: "content", name: "Content", description: "Edit question details" },
    { id: "images", name: "Images", description: "Manage visual content" },
    { id: "metadata", name: "Metadata", description: "Update categorization" },
  ];

  const currentStepIndex = steps.findIndex((step) => step.id === activeTab);

  // Calculate line positions
  // Each step takes up (100 / numSteps)% of width
  // Circle centers are at the middle of each step's space
  const stepPercentage = 100 / steps.length;
  const lineStart = stepPercentage / 2; // Center of first step
  const lineEnd = 100 - stepPercentage / 2; // Center of last step
  const lineWidth = lineEnd - lineStart;

  // Progress line width as percentage of total line
  const progressPercentage = currentStepIndex / (steps.length - 1);

  return (
    <div className="w-full max-w-3xl min-w-[320px] mx-auto px-4 py-8">
      <div className="relative flex justify-between items-start">
        {/* Background connecting line */}
        <div
          className="absolute top-5 h-0.5 bg-muted-foreground/20"
          style={{
            left: `${lineStart}%`,
            width: `${lineWidth}%`,
          }}
        />

        {/* Progress line */}
        <div
          className="absolute top-5 h-0.5 bg-primary transition-all duration-500"
          style={{
            left: `${lineStart}%`,
            width: `${lineWidth * progressPercentage}%`,
          }}
        />

        {/* Steps */}
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = step.id === activeTab;

          return (
            <div key={step.id} className="flex flex-col items-center flex-1">
              {/* Circle */}
              <button
                type="button"
                onClick={() => onTabChange(step.id)}
                className={`
                  relative z-10 w-10 h-10 rounded-full flex items-center justify-center
                  text-sm font-medium transition-all duration-300
                  ${
                    isCurrent
                      ? "bg-white border-2 border-primary text-primary"
                      : isCompleted
                        ? "bg-primary border-2 border-primary text-white"
                        : "bg-white text-muted-foreground border-2 border-muted-foreground/30"
                  }
                `}
              >
                {isCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : <span>{index + 1}</span>}
              </button>

              {/* Text */}
              <button
                type="button"
                onClick={() => onTabChange(step.id)}
                className="mt-3 text-center"
              >
                <div
                  className={`
                  text-sm font-medium transition-colors whitespace-nowrap
                  ${isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"}
                `}
                >
                  {step.name}
                </div>
                <div className="text-xs text-muted-foreground/70 mt-0.5 hidden sm:block whitespace-nowrap">
                  {step.description}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
