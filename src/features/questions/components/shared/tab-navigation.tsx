'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="flex-shrink-0">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="options">Options</TabsTrigger>
        <TabsTrigger value="references">References</TabsTrigger>
        <TabsTrigger value="media">Media</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
