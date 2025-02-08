/**
 * @source src/components/landing/feature-card.tsx
 * 
 * A React component that displays a feature with an icon, title, and description.
 * The component supports additional styling through the `className` prop.
 */

import { cn } from "@/lib/utils"

interface FeatureCardProps {
  icon: React.ElementType
  title: string
  description: string
  className?: string
}

export function FeatureCard({ 
  icon: Icon, 
  title, 
  description,
  className 
}: FeatureCardProps) {
  return (
    <div className={cn(
      "group flex flex-col items-center text-center p-6",
      "bg-white/50 backdrop-blur-sm rounded-lg shadow-sm",
      "hover:shadow-md transition-all duration-300 hover:scale-105",
      className
    )}>
      <div className="flex items-center justify-center mb-4 transform group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2 transform group-hover:scale-105 transition-transform duration-300">
        {title}
      </h3>
      <p className="text-muted-foreground transform group-hover:scale-105 transition-transform duration-300">
        {description}
      </p>
    </div>
  )
}