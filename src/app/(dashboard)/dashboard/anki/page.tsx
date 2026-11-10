// src/app/(dashboard)/dashboard/anki/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useMobile } from "@/shared/hooks/use-mobile";
import { prefetchAroundCard } from "@/features/user/anki/utils/prefetch-card-images";
import { log } from "@/shared/utils/logging";
import {
  placeByTags,
  getSubcategoryCards,
  buildDeckSidebarData,
  buildCategorySidebarData,
  type CategoryData,
} from "./anki-data";
import { findCategoryForCardId } from "./anki-sections";
import { useAnkomaIndex, useCategoryCards, loadCardIdMap } from "./anki-loader";
import { AnkiDeckSidebar } from "./anki-deck-sidebar";
import { AnkiCategorySidebar } from "./anki-category-sidebar";
import { AnkiMobileSidebar } from "./anki-mobile-sidebar";
import { AnkiCardArea } from "./anki-card-area";

export default function AnkiPage() {
  // Page load fetches only the small index; a category's cards load when it is opened.
  const { data: index, isLoading } = useAnkomaIndex();
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
  // ?cardId= deep link waiting for its category's cards to arrive.
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const isMobileView = useMobile();

  // Detect mobile device once (useMemo ensures stable value)
  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  // ?cardId= deep link, step 1: find the card's category (card-id map, fetched only here).
  useEffect(() => {
    if (!index || typeof window === "undefined") return;
    const cardId = new URLSearchParams(window.location.search).get("cardId");
    if (!cardId) return;
    let active = true;
    loadCardIdMap(index.cardIds)
      .then((cardIds) => {
        const categoryId = active ? findCategoryForCardId(cardIds, cardId) : null;
        if (!categoryId) return;
        setSelectedDeckId(categoryId.split("::")[0]);
        setSelectedCategoryId(categoryId);
        setPendingCardId(cardId);
        setLeftSidebarExpanded(false);
        setRightSidebarExpanded(true);
      })
      .catch((e) => log.warn("[Anki] Could not resolve ?cardId= link", e));
    return () => {
      active = false;
    };
  }, [index]);

  const decks = useMemo(() => index?.decks ?? [], [index]);
  const selectedDeck = decks.find((d) => d.id === selectedDeckId);
  const selectedSummary = selectedDeck?.categories.find((c) => c.id === selectedCategoryId);

  const { cards: categoryCards, isLoading: isLoadingCards } = useCategoryCards(
    selectedCategoryId ? index?.categories[selectedCategoryId] : undefined
  );

  const selectedCategory = useMemo<CategoryData | undefined>(
    () =>
      selectedSummary
        ? {
            id: selectedSummary.id,
            name: selectedSummary.name,
            subcategories: selectedSummary.subcategories,
            cards: categoryCards,
          }
        : undefined,
    [selectedSummary, categoryCards]
  );

  // ?cardId= deep link, step 2: once the category's cards are in, open its subcategory.
  useEffect(() => {
    if (!pendingCardId || categoryCards.length === 0) return;
    const card =
      categoryCards.find((c) => c.id === pendingCardId) ??
      categoryCards.find((c) => c.id.startsWith(pendingCardId + "-"));
    const subcategoryName = card ? placeByTags(card.tags)?.subcategoryName : null;
    if (subcategoryName) {
      setSelectedSubcategory(subcategoryName);
      setExpandedCategoryId(selectedCategoryId);
    }
    setPendingCardId(null);
  }, [pendingCardId, categoryCards, selectedCategoryId]);

  const currentCards = useMemo(() => {
    if (!selectedCategory) return [];
    const base = selectedSubcategory
      ? getSubcategoryCards(selectedCategory, selectedSubcategory)
      : selectedCategory.cards;
    return isShuffled ? [...base].sort(() => Math.random() - 0.5) : base;
  }, [selectedCategory, selectedSubcategory, isShuffled]);

  const currentCard = currentCards[currentCardIndex];

  // Warm the cache with the neighbouring cards' images, after the current one has a head start.
  useEffect(() => {
    if (currentCards.length === 0) return;
    const timer = setTimeout(() => prefetchAroundCard(currentCards, currentCardIndex), 150);
    return () => clearTimeout(timer);
  }, [currentCards, currentCardIndex]);

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

  const deckSidebarData = buildDeckSidebarData(decks);
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
        isLoadingCards={isLoadingCards}
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
