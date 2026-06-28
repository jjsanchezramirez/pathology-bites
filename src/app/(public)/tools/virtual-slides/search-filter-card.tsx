"use client";

import React from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Search, Filter, Loader2, Eye, EyeOff, Shuffle, Info, GraduationCap } from "lucide-react";

interface SearchFilterCardProps {
  mode: "search" | "study";
  studyQuestionCount: number;
  onStudyQuestionCountChange: (n: number) => void;
  searchInputRef: React.Ref<HTMLInputElement>;
  initialSearchValue: string;
  onSearchInput: (value: string) => void;
  onImmediateSearch: () => void;
  onGenerateQuestions: () => void;
  selectedRepository: string;
  onRepositoryChange: (v: string) => void;
  repositories: string[];
  selectedCategory: string;
  onCategoryChange: (v: string) => void;
  categories: string[];
  selectedOrganSystem: string;
  onOrganSystemChange: (v: string) => void;
  organSystems: string[];
  isLoading: boolean;
  expandedSearchTerms: string[];
  displaySlidesCount: number;
  totalResults: number;
  filteredTotal: number;
  showDiagnoses: boolean;
  onToggleDiagnoses: () => void;
  onClearFilters: () => void;
}

export function SearchFilterCard({
  mode,
  studyQuestionCount,
  onStudyQuestionCountChange,
  searchInputRef,
  initialSearchValue,
  onSearchInput,
  onImmediateSearch,
  onGenerateQuestions,
  selectedRepository,
  onRepositoryChange,
  repositories,
  selectedCategory,
  onCategoryChange,
  categories,
  selectedOrganSystem,
  onOrganSystemChange,
  organSystems,
  isLoading,
  expandedSearchTerms,
  displaySlidesCount,
  totalResults,
  filteredTotal,
  showDiagnoses,
  onToggleDiagnoses,
  onClearFilters,
}: SearchFilterCardProps) {
  const filterSummary =
    mode === "study" ? (
      <>
        <GraduationCap className="h-4 w-4" />
        <span>Showing {displaySlidesCount.toLocaleString()} questions</span>
      </>
    ) : (
      <>
        <Filter className="h-4 w-4" />
        <span>
          Showing {totalResults.toLocaleString()} of {filteredTotal.toLocaleString()} slides
        </span>
      </>
    );

  const diagnosesButtonLabel = showDiagnoses ? (
    <>
      <EyeOff className="h-4 w-4 mr-2" />
      Hide Diagnoses
    </>
  ) : (
    <>
      <Eye className="h-4 w-4 mr-2" />
      Show Diagnoses
    </>
  );

  return (
    <Card className="p-4 md:p-8 shadow-lg">
      <CardContent className="space-y-4 md:space-y-6">
        {/* Study Mode Configuration */}
        {mode === "study" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="question-count" className="text-lg font-semibold">
                Number of Questions
              </Label>
              <Select
                value={studyQuestionCount.toString()}
                onValueChange={(val) => onStudyQuestionCountChange(parseInt(val))}
              >
                <SelectTrigger id="question-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 Questions</SelectItem>
                  <SelectItem value="20">20 Questions</SelectItem>
                  <SelectItem value="30">30 Questions</SelectItem>
                  <SelectItem value="50">50 Questions</SelectItem>
                  <SelectItem value="100">100 Questions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="generate-questions" className="opacity-0 pointer-events-none">
                Actions
              </Label>
              <Button
                id="generate-questions"
                onClick={onGenerateQuestions}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Shuffle className="h-4 w-4 mr-2" />
                )}
                Generate New Questions
              </Button>
            </div>
          </div>
        )}

        {/* Search Bar - Only in Search Mode */}
        {mode === "search" && (
          <div className="space-y-2 md:space-y-4">
            <Label htmlFor="search-input" className="text-lg font-semibold">
              Search Virtual Slides
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                ref={searchInputRef}
                id="search-input"
                placeholder="Search by diagnosis, patient info, repository, category, or organ system..."
                defaultValue={initialSearchValue}
                onChange={(e) => onSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onImmediateSearch();
                  }
                }}
                className="flex-1"
              />

              <Button
                onClick={onImmediateSearch}
                disabled={isLoading}
                className="px-6 w-full sm:w-auto"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {/* Expanded Search Terms Display */}
            {expandedSearchTerms && expandedSearchTerms.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md border border-muted">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <span className="text-muted-foreground">Also searching for: </span>
                  <span className="font-medium">{expandedSearchTerms.join(", ")}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
          <div className="space-y-2">
            <Label htmlFor="repository-filter">Web Repository</Label>
            <Select value={selectedRepository} onValueChange={onRepositoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="All repositories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Repositories</SelectItem>
                {repositories.map((repo, index) => (
                  <SelectItem key={`repo-${index}-${repo}`} value={repo}>
                    {repo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-filter">Category</Label>
            <Select value={selectedCategory} onValueChange={onCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category, index) => (
                  <SelectItem key={`cat-${index}-${category}`} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organ-system-filter">Organ System</Label>
            <Select value={selectedOrganSystem} onValueChange={onOrganSystemChange}>
              <SelectTrigger>
                <SelectValue placeholder="All organ systems" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organ Systems</SelectItem>
                {organSystems.map((system, index) => (
                  <SelectItem key={`sys-${index}-${system}`} value={system}>
                    {system}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Clear Filters Button and Filter Summary */}
        <div className="space-y-2 md:space-y-4">
          {/* Desktop: Horizontal layout */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {filterSummary}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClearFilters} size="sm">
                Clear Filters
              </Button>
              <Button
                variant={showDiagnoses ? "outline" : "default"}
                size="sm"
                onClick={onToggleDiagnoses}
              >
                {diagnosesButtonLabel}
              </Button>
            </div>
          </div>

          {/* Mobile: Vertical layout */}
          <div className="md:hidden space-y-3">
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={onClearFilters} size="sm" className="w-full">
                Clear Filters
              </Button>
              <Button
                variant={showDiagnoses ? "outline" : "default"}
                size="sm"
                onClick={onToggleDiagnoses}
                className="w-full"
              >
                {diagnosesButtonLabel}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {filterSummary}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
