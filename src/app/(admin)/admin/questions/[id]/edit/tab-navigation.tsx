'use client';

import { Button } from "@/shared/components/ui/button";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = [
    { id: 'content', label: 'Content' },
    { id: 'images', label: 'Images' },
    { id: 'metadata', label: 'Metadata' },
  ];

  return (
    <div className="border-b">
      <div className="flex space-x-1">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            onClick={() => onTabChange(tab.id)}
            className={`rounded-none border-b-2 px-6 py-3 ${
              activeTab === tab.id
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent hover:border-muted-foreground/30'
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
