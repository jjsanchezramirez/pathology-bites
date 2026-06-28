// src/app/(dashboard)/dashboard/anki/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useClientAnkoma } from "@/shared/hooks/use-client-ankoma";
import { useMobile } from "@/shared/hooks/use-mobile";
import {
  organizeDecks,
  getAllCards,
  formatTagName,
  getSubcategoryCards,
  buildDeckSidebarData,
  buildCategorySidebarData,
} from "./anki-data";
import { AnkiDeckSidebar } from "./anki-deck-sidebar";
import { AnkiCategorySidebar } from "./anki-category-sidebar";
import { AnkiMobileSidebar } from "./anki-mobile-sidebar";
import { AnkiCardArea } from "./anki-card-area";

export default function AnkiPage() {
  const { ankomaData, isLoading } = useClientAnkoma();
  const [leftSidebarExpanded, setLeftSidebarExpanded] = useState(true); // Start expanded
  const [rightSidebarExpanded, setRightSidebarExpanded] = useState(false); // Start collapsed
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobileView = useMobile();

  // Detect mobile device once (useMemo ensures stable value)
  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  // Handle direct cardId navigation from URL
  useEffect(() => {
    if (!ankomaData || !window) return;

    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get("cardId");

    if (cardId) {
      const allCards = getAllCards(ankomaData.sections);

      // Try to find by exact card.id match first, then by GUID prefix
      let targetCard = allCards.find((card) => card.id === cardId);
      if (!targetCard) {
        targetCard = allCards.find(
          (card) => card.id.startsWith(cardId + "-") || card.id === cardId
        );
      }

      if (targetCard) {
        // Extract deck and category from the card's tags
        const ankomaTag = targetCard.tags.find((tag) => tag.startsWith("#ANKOMA::"));
        if (ankomaTag) {
          const tagParts = ankomaTag.replace("#ANKOMA::", "").split("::");
          if (tagParts.length >= 2) {
            const deckType = tagParts[0] as "AP" | "CP";
            const rawCategoryName = tagParts[1];
            const categoryName = formatTagName(rawCategoryName);
            const subcategoryName = tagParts[2]
              ? formatTagName(tagParts[2], rawCategoryName)
              : null;

            const deckId = deckType;
            const categoryId = `${deckType}::${categoryName}`;

            setSelectedDeckId(deckId);
            setSelectedCategoryId(categoryId);
            if (subcategoryName) {
              setSelectedSubcategory(subcategoryName);
              setExpandedCategoryId(categoryId);
            }

            setLeftSidebarExpanded(false);
            setRightSidebarExpanded(true);
          }
        }
      }
    }
  }, [ankomaData]);

  // Organize data by decks and categories
  const organizedDecks = useMemo(() => organizeDecks(ankomaData), [ankomaData]);

  const selectedDeck = organizedDecks.find((d) => d.id === selectedDeckId);
  const selectedCategory = selectedDeck?.categories.find((c) => c.id === selectedCategoryId);

  const currentCards = useMemo(() => {
    if (!selectedCategory) return [];
    const base = selectedSubcategory
      ? getSubcategoryCards(selectedCategory, selectedSubcategory)
      : selectedCategory.cards;
    return isShuffled ? [...base].sort(() => Math.random() - 0.5) : base;
  }, [selectedCategory, selectedSubcategory, isShuffled]);

  const currentCard = currentCards[currentCardIndex];

  // Set card index when navigating via URL with cardId
  useEffect(() => {
    if (!window || currentCards.length === 0) return;

    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get("cardId");

    if (cardId) {
      let targetIndex = currentCards.findIndex((card) => card.id === cardId);
      if (targetIndex === -1) {
        targetIndex = currentCards.findIndex(
          (card) => card.id.startsWith(cardId + "-") || card.id === cardId
        );
      }

      if (targetIndex !== -1) {
        setCurrentCardIndex(targetIndex);
      }
    }
  }, [currentCards]);

  const handleDeckSelect = (deckId: string) => {
    setSelectedDeckId(deckId);
    setSelectedCategoryId(null);
    setSelectedSubcategory(null);
    setCurrentCardIndex(0);
    setIsShuffled(false);
    // When deck is selected, collapse DECKS and expand CATEGORIES
    setIsAnimating(true);
    setLeftSidebarExpanded(false);
    setRightSidebarExpanded(true);
    // Clear animation flag after transition
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleCategoryClick = (categoryId: string, hasSubcategories: boolean) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubcategory(null);
    setCurrentCardIndex(0);
    if (hasSubcategories) {
      setExpandedCategoryId((prev) => (prev === categoryId ? null : categoryId));
    } else {
      setExpandedCategoryId(null);
      setMobileSidebarOpen(false);
    }
  };

  const handleSubcategoryClick = (subcategory: string) => {
    setSelectedSubcategory(subcategory);
    setCurrentCardIndex(0);
    setMobileSidebarOpen(false);
  };

  const handleNextCard = () => {
    if (currentCardIndex < currentCards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
    }
  };

  const handlePreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((prev) => prev - 1);
    }
  };

  const handleShuffle = () => {
    setIsShuffled(!isShuffled);
    setCurrentCardIndex(0);
  };

  const handleReset = () => {
    setIsShuffled(false);
    setCurrentCardIndex(0);
  };

  const deckSidebarData = buildDeckSidebarData(organizedDecks);
  const categorySidebarData = buildCategorySidebarData(selectedDeck);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Sidebar - DECKS */}
      <AnkiDeckSidebar
        decks={deckSidebarData}
        selectedDeckId={selectedDeckId}
        isLoading={isLoading}
        expanded={leftSidebarExpanded}
        isAnimating={isAnimating}
        onExpandedChange={setLeftSidebarExpanded}
        onDeckSelect={handleDeckSelect}
      />

      {/* Right Sidebar - CATEGORIES */}
      <AnkiCategorySidebar
        categories={categorySidebarData}
        selectedDeckName={selectedDeck?.name}
        selectedSubcategory={selectedSubcategory}
        expandedCategoryId={expandedCategoryId}
        expanded={rightSidebarExpanded}
        isAnimating={isAnimating}
        onExpandedChange={setRightSidebarExpanded}
        onCategoryClick={handleCategoryClick}
        onSubcategoryClick={handleSubcategoryClick}
      />

      {/* Main Content */}
      <AnkiCardArea
        selectedDeck={selectedDeck}
        selectedCategory={selectedCategory}
        selectedSubcategory={selectedSubcategory}
        currentCards={currentCards}
        currentCard={currentCard}
        currentCardIndex={currentCardIndex}
        isShuffled={isShuffled}
        isMobile={isMobile}
        onMobileSidebarOpen={() => setMobileSidebarOpen(true)}
        onShuffle={handleShuffle}
        onReset={handleReset}
        onPrevious={handlePreviousCard}
        onNext={handleNextCard}
      />

      {/* Mobile Sidebar Overlay */}
      {isMobileView && (
        <AnkiMobileSidebar
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          decks={deckSidebarData}
          categories={categorySidebarData}
          selectedDeckId={selectedDeckId}
          selectedSubcategory={selectedSubcategory}
          expandedCategoryId={expandedCategoryId}
          onDeckSelect={handleDeckSelect}
          onCategoryClick={handleCategoryClick}
          onSubcategoryClick={handleSubcategoryClick}
        />
      )}
    </div>
  );
}
