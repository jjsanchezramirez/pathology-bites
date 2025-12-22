'use client'

import React, { useState } from 'react'
import { DeckSidebar } from '@/features/anki/components/deck-sidebar'
import { CategorySidebar } from '@/features/anki/components/category-sidebar'

export default function TestSidebarsPage() {
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const testDecks = [
    { id: 'AP', name: 'Anatomic Pathology', type: 'AP' as const, totalCards: 100, categoryCount: 5 },
    { id: 'CP', name: 'Clinical Pathology', type: 'CP' as const, totalCards: 50, categoryCount: 3 },
  ]

  const testCategories = [
    { id: 'cat1', name: 'Category 1', cardCount: 20, subcategories: [] },
    { id: 'cat2', name: 'Category 2', cardCount: 30, subcategories: [] },
  ]

  return (
    <div className="h-full flex overflow-hidden">
      <DeckSidebar
        decks={testDecks}
        selectedDeckId={selectedDeckId}
        onDeckSelect={setSelectedDeckId}
      />
      <CategorySidebar
        categories={testCategories}
        selectedCategoryId={selectedCategoryId}
        selectedSubcategory={null}
        onCategorySelect={setSelectedCategoryId}
        onSubcategorySelect={() => {}}
        deckName="Test Deck"
      />
      <div className="flex-1 flex items-center justify-center">
        <p>Main Content</p>
      </div>
    </div>
  )
}
