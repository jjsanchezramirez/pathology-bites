'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSmartABPath } from '@/shared/hooks/use-smart-abpath';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Search, BookOpen, X, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { ABPathPDFGenerator } from './pdf-generator';
import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from '@/shared/components/common/join-community-section';

interface PathologyItem {
  number?: number;
  letter?: string;
  roman?: string;
  title: string;
  designation?: string;
  line?: number;
  note?: string;
  subitems?: PathologyItem[];
}

interface PathologySubsection {
  number?: number;
  letter?: string;
  title: string;
  line?: number;
  items?: PathologyItem[];
  sections?: {
    title: string;
    line?: number;
    items?: PathologyItem[];
  }[];
}

interface PathologySection {
  section: number;
  title: string;
  type: 'ap' | 'cp';
  items?: PathologyItem[];
  subsections?: PathologySubsection[];
  line?: number;
  note?: string;
}

interface ContentSpecifications {
  content_specifications: {
    ap_sections: PathologySection[];
    cp_sections: PathologySection[];
  };
  metadata: {
    total_sections: number;
    ap_sections: number;
    cp_sections: number;
    source_files: number;
    description: string;
  };
}

export default function ABPathContentPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Toggle states for sections and designations
  const [showAP, setShowAP] = useState(true);
  const [showCP, setShowCP] = useState(true);
  const [showC, setShowC] = useState(true);
  const [showAR, setShowAR] = useState(true);
  const [showF, setShowF] = useState(true);

  // Use smart loading hook
  const {
    sections: paginatedSections,
    allSections,
    metadata,
    pagination,
    isLoading: loading,
    error: loadingError,
    actions,
    strategy
  } = useSmartABPath({
    search: debouncedSearchTerm || undefined,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    showAP,
    showCP,
    sectionsPerPage: 7
  });

  // Create compatibility data structure
  const data = useMemo(() => {
    if (!metadata) return null;
    return {
      content_specifications: {
        ap_sections: paginatedSections.filter(s => s.type === 'ap'),
        cp_sections: paginatedSections.filter(s => s.type === 'cp')
      },
      metadata
    };
  }, [paginatedSections, metadata]);

  // Debounce search term to reduce processing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 150) // Reduced delay for better responsiveness

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Memoized helper function to check if an item or its subitems match search
  const itemMatchesSearch = useCallback((item: PathologyItem, search: string): boolean => {
    if (!search) return true;

    // Check if this item matches
    const thisItemMatches =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.note && item.note.toLowerCase().includes(search.toLowerCase()));

    if (thisItemMatches) return true;

    // Check if any subitems match
    if (item.subitems) {
      return item.subitems.some(subitem => itemMatchesSearch(subitem, search));
    }

    return false;
  }, []);

  // Memoized filterItems function to prevent re-creation
  const filterItems = useCallback((items: PathologyItem[], search: string): PathologyItem[] => {
    return items.filter(item => {
      // Apply search filter first
      if (search && !itemMatchesSearch(item, search)) {
        return false;
      }

      // Apply designation filter
      const matchesDesignation =
        (item.designation === 'C' && showC) ||
        (item.designation === 'AR' && showAR) ||
        (item.designation === 'F' && showF) ||
        (!item.designation); // Show items without designation

      return matchesDesignation;
    }).map(item => {
      if (item.subitems) {
        return {
          ...item,
          subitems: filterItems(item.subitems, search)
        };
      }
      return item;
    });
  }, [showC, showAR, showF, itemMatchesSearch]);

  // Smart pagination handler
  const handlePageChange = (page: number) => {
    actions.loadPage(page);
  };

  // Get all available categories - now from all available sections
  const categories = useMemo(() => {
    if (!data) return [];

    // For now, we'll need to build categories from what we can see
    // This could be enhanced by adding a separate endpoint for all categories
    const visibleSections = paginatedSections;
    return visibleSections.map(section => ({
      value: `${section.type.toUpperCase()}_${section.section}`,
      label: `${section.type.toUpperCase()} ${section.section}: ${section.title}`,
      title: section.title
    }));
  }, [data, paginatedSections]);

  // Client-side filtering for designation filters only (C, AR, F)
  const filteredData = useMemo(() => {
    // Check if user has deselected all designations (C, AR, F)
    if (!showC && !showAR && !showF) {
      return []
    }
    
    if (!paginatedSections.length) {
      return []
    }

    // Apply only designation filtering since the hook handles type, category, and search
    const sections = paginatedSections.map(section => {
      const filteredSection = { ...section };

      if (section.items) {
        filteredSection.items = filterItems(section.items, '');
      }

      if (section.subsections) {
        filteredSection.subsections = section.subsections.map(subsection => {
          const filteredSubsection = { ...subsection };

          if (subsection.items) {
            filteredSubsection.items = filterItems(subsection.items, '');
          }

          if (subsection.sections) {
            filteredSubsection.sections = subsection.sections.map((subSection: any) => ({
              ...subSection,
              items: subSection.items ? filterItems(subSection.items, '') : undefined
            })).filter((subSection: any) => !subSection.items || subSection.items.length > 0);
          }

          return filteredSubsection;
        }).filter(subsection =>
          (subsection.items && subsection.items.length > 0) ||
          (subsection.sections && subsection.sections.length > 0)
        );
      }

      return filteredSection;
    }).filter(section =>
      (section.items && section.items.length > 0) ||
      (section.subsections && section.subsections.length > 0) ||
      (showC && showAR && showF) // Keep sections without items if all designations shown
    );

    return sections;
  }, [paginatedSections, showC, showAR, showF, filterItems]);

  // Simplified statistics calculation using filtered data
  const stats = useMemo(() => {
    const defaultStats = { totalVisible: 0, totalAll: 0, cCount: 0, arCount: 0, fCount: 0, totalPercentage: 0, cPercentage: 0, arPercentage: 0, fPercentage: 0 };
    
    if (!allSections.length) return defaultStats;

    // Helper function to count items recursively
    const countItems = (items: PathologyItem[]): { total: number; c: number; ar: number; f: number } => {
      let total = 0, c = 0, ar = 0, f = 0;
      
      items.forEach(item => {
        total++;
        if (item.designation === 'C') c++;
        else if (item.designation === 'AR') ar++;
        else if (item.designation === 'F') f++;
        
        if (item.subitems) {
          const subCounts = countItems(item.subitems);
          total += subCounts.total;
          c += subCounts.c;
          ar += subCounts.ar;
          f += subCounts.f;
        }
      });
      
      return { total, c, ar, f };
    };

    // Helper function to count all items in a section
    const countSection = (section: PathologySection) => {
      const counts = { total: 0, c: 0, ar: 0, f: 0 };
      
      if (section.items) {
        const itemCounts = countItems(section.items);
        counts.total += itemCounts.total;
        counts.c += itemCounts.c;
        counts.ar += itemCounts.ar;
        counts.f += itemCounts.f;
      }
      
      if (section.subsections) {
        section.subsections.forEach(subsection => {
          if (subsection.items) {
            const itemCounts = countItems(subsection.items);
            counts.total += itemCounts.total;
            counts.c += itemCounts.c;
            counts.ar += itemCounts.ar;
            counts.f += itemCounts.f;
          }
          
          if (subsection.sections) {
            subsection.sections.forEach(subSection => {
              if (subSection.items) {
                const itemCounts = countItems(subSection.items);
                counts.total += itemCounts.total;
                counts.c += itemCounts.c;
                counts.ar += itemCounts.ar;
                counts.f += itemCounts.f;
              }
            });
          }
        });
      }
      
      return counts;
    };

    // Count ALL items from complete dataset (baseline)
    const allCounts = allSections.reduce((acc, section) => {
      const sectionCounts = countSection(section);
      acc.total += sectionCounts.total;
      acc.c += sectionCounts.c;
      acc.ar += sectionCounts.ar;
      acc.f += sectionCounts.f;
      return acc;
    }, { total: 0, c: 0, ar: 0, f: 0 });

    // Count currently visible items from filtered data
    const visibleCounts = filteredData.reduce((acc, section) => {
      const sectionCounts = countSection(section);
      acc.total += sectionCounts.total;
      acc.c += sectionCounts.c;
      acc.ar += sectionCounts.ar;
      acc.f += sectionCounts.f;
      return acc;
    }, { total: 0, c: 0, ar: 0, f: 0 });

    const totalVisible = visibleCounts.total;
    const totalAll = allCounts.total;
    const cCount = visibleCounts.c;
    const arCount = visibleCounts.ar;
    const fCount = visibleCounts.f;

    return {
      totalVisible,
      totalAll,
      cCount,
      arCount,
      fCount,
      totalPercentage: totalAll > 0 ? Math.round((totalVisible / totalAll) * 100) : 0,
      cPercentage: totalVisible > 0 ? Math.round((cCount / totalVisible) * 100) : 0,
      arPercentage: totalVisible > 0 ? Math.round((arCount / totalVisible) * 100) : 0,
      fPercentage: totalVisible > 0 ? Math.round((fCount / totalVisible) * 100) : 0
    };
  }, [allSections, filteredData]);

  // PDF generation function
  const generatePDF = async () => {
    if (!data) return;

    const generator = new ABPathPDFGenerator();
    const timestamp = new Date().toISOString().split('T')[0];

    // Determine filter suffix for filename
    let filterSuffix = '';
    if (!showAP && showCP) filterSuffix += 'CP';
    else if (showAP && !showCP) filterSuffix += 'AP';

    if (selectedCategory !== 'all') {
      const categoryInfo = categories.find(c => c.value === selectedCategory);
      if (categoryInfo) {
        filterSuffix += (filterSuffix ? '_' : '') + categoryInfo.title.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
      }
    }

    const designations = [];
    if (showC) designations.push('C');
    if (showAR) designations.push('AR');
    if (showF) designations.push('F');
    if (designations.length < 3) filterSuffix += (filterSuffix ? '_' : '') + designations.join('');

    if (searchTerm) filterSuffix += (filterSuffix ? '_' : '') + 'filtered';

    try {
      const pdf = await generator.generatePDF(filteredData, {
        searchTerm,
        selectedType: showAP && showCP ? 'all' : showAP ? 'ap' : 'cp',
        selectedDesignation: designations.length === 3 ? 'all' : designations.join(','),
        stats
      });

      const filename = `abpath-content_${timestamp}${filterSuffix ? '_' + filterSuffix : ''}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // You might want to show a user-friendly error message here
    }
  };

  const renderItem = (item: PathologyItem, level: number = 0, parentKey: string = '') => {
    const indent = level * 16;
    const itemKey = `${parentKey}-${item.number || ''}-${item.letter || ''}-${item.roman || ''}-${item.title}-${level}`;

    return (
      <div key={itemKey} className="mb-1">
        <div
          className="flex items-start gap-2 py-1 px-2 rounded hover:bg-gray-50 text-sm"
          style={{ marginLeft: `${indent}px` }}
        >
          <div className="flex-shrink-0 text-gray-500 min-w-[32px] text-xs">
            {item.number && `${item.number}.`}
            {item.letter && `${item.letter}.`}
            {item.roman && `${item.roman}.`}
          </div>
          <div className="flex-1">
            <span className="text-gray-900">{item.title}</span>
            {item.designation && (
              <Badge
                variant={
                  item.designation === 'C' ? 'default' :
                  item.designation === 'AR' ? 'secondary' :
                  'outline'
                }
                className="ml-2 text-xs"
              >
                {item.designation}
              </Badge>
            )}
            {item.note && (
              <div className="text-xs text-gray-500 mt-1 italic">
                {item.note}
              </div>
            )}
          </div>
        </div>
        {item.subitems && item.subitems.map(subitem =>
          renderItem(subitem, level + 1, itemKey)
        )}
      </div>
    );
  };

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        {/* Hero Section */}
        <PublicHero
          title="ABPath Content Specifications"
          description="Interactive ABPath content specifications with filtering by section, category, and designation."
        />

        {/* Loading Content */}
        <section className="flex-1 py-12">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="space-y-6">
              {/* Controls Skeleton */}
              <Card className="p-6">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Search skeleton */}
                  <div className="relative min-w-[200px] flex-1 max-w-sm">
                    <div className="h-10 bg-muted rounded-md animate-pulse" />
                  </div>

                  {/* Category filter skeleton */}
                  <div className="w-[280px]">
                    <div className="h-10 bg-muted rounded-md animate-pulse" />
                  </div>

                  {/* Toggle buttons skeleton */}
                  <div className="flex gap-1">
                    <div className="h-8 w-12 bg-muted rounded-md animate-pulse" />
                    <div className="h-8 w-12 bg-muted rounded-md animate-pulse" />
                  </div>

                  <div className="flex gap-1">
                    <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
                    <div className="h-8 w-12 bg-muted rounded-md animate-pulse" />
                    <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
                  </div>

                  {/* Export button skeleton */}
                  <div className="h-8 w-24 bg-muted rounded-md animate-pulse" />
                </div>
              </Card>

              {/* Statistics Skeleton */}
              <Card className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
                  {[...Array(6)].map((_, i) => (
                    <div key={i}>
                      <div className="h-8 w-12 bg-muted rounded mx-auto mb-2 animate-pulse" />
                      <div className="h-3 w-16 bg-muted rounded mx-auto animate-pulse" />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Results Skeleton */}
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                        <div className="h-5 w-64 bg-muted rounded animate-pulse" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[...Array(3)].map((_, j) => (
                          <div key={j} className="space-y-2">
                            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                            <div className="ml-4 space-y-1">
                              <div className="h-3 w-full bg-muted rounded animate-pulse" />
                              <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="flex min-h-screen flex-col">
        {/* Hero Section */}
        <PublicHero
          title="ABPath Content Specifications"
          description="Interactive ABPath content specifications with filtering by section, category, and designation."
        />

        {/* Error Content */}
        <section className="flex-1 py-12">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center py-8">
              <p className="text-red-600">Error loading content specifications: {loadingError.message}</p>
              <Button 
                onClick={() => window.location.reload()} 
                className="mt-4"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        {/* Hero Section */}
        <PublicHero
          title="ABPath Content Specifications"
          description="Interactive ABPath content specifications with filtering by section, category, and designation."
        />

        {/* Loading Content */}
        <section className="flex-1 py-12">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading content specifications...</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="ABPath Content Specifications"
        description="Interactive ABPath content specifications with filtering by section, category, and designation – Core, Advanced Resident, Fellow."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>{data.metadata.total_sections} sections</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{data.metadata.ap_sections} AP • {data.metadata.cp_sections} CP</span>
            </div>
            {strategy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>•</span>
                <span className="capitalize">{strategy.replace('-', ' ')}</span>
              </div>
            )}
          </div>
        }
      />

      {/* Main Content */}
      <section className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="space-y-6">
            {/* Controls */}
            <Card className="p-6">
              <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative min-w-[200px] flex-1 max-w-sm">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search topics..."
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Section Type Toggles */}
                <div className="flex gap-1">
                  <Button
                    variant={showAP ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowAP(!showAP)}
                  >
                    AP
                  </Button>
                  <Button
                    variant={showCP ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowCP(!showCP)}
                  >
                    CP
                  </Button>
                </div>

                {/* Designation Toggles */}
                <div className="flex gap-1">
                  <Button
                    variant={showC ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowC(!showC)}
                  >
                    Core
                  </Button>
                  <Button
                    variant={showAR ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowAR(!showAR)}
                  >
                    AR
                  </Button>
                  <Button
                    variant={showF ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowF(!showF)}
                  >
                    Fellow
                  </Button>
                </div>

                {/* Clear Filters */}
                {(searchTerm || selectedCategory !== 'all' || !showAP || !showCP || !showC || !showAR || !showF) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('all');
                      setShowAP(true);
                      setShowCP(true);
                      setShowC(true);
                      setShowAR(true);
                      setShowF(true);
                    }}
                    className="flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </Button>
                )}


                {/* PDF Export */}
                <Button
                  onClick={generatePDF}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  Export PDF
                </Button>
              </div>
            </Card>

            {/* Statistics */}
            <Card className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-slate-700">{stats.totalVisible}</div>
                  <div className="text-xs text-gray-500">Visible Items</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-700">{stats.totalAll}</div>
                  <div className="text-xs text-gray-500">Total Items</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-600">{stats.cCount}</div>
                  <div className="text-xs text-gray-500">Core (C)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-600">{stats.arCount}</div>
                  <div className="text-xs text-gray-500">Advanced (AR)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-600">{stats.fCount}</div>
                  <div className="text-xs text-gray-500">Fellow (F)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-700">{stats.totalPercentage}%</div>
                  <div className="text-xs text-gray-500">Coverage</div>
                </div>
              </div>
            </Card>

            {/* Results */}
            <div className="space-y-3">
              {filteredData.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No results found matching your criteria.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredData.map((section, sectionIndex) => (
                  <Card key={`section-${section.type}-${section.section}-${sectionIndex}`} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          section.type === 'ap'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {section.type.toUpperCase()} {section.section}
                        </span>
                        <span className="text-base">{section.title}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {section.note && !section.note.includes("This section is directed toward AP/CP residents") && (
                        <div className="mb-3 p-2 bg-yellow-50 border-l-4 border-yellow-200 text-sm text-yellow-800">
                          <strong>Note:</strong> {section.note}
                        </div>
                      )}

                      {/* Direct items */}
                      {section.items && section.items.length > 0 && (
                        <div className="mb-4">
                          {section.items.map(item => renderItem(item, 0, `section-${section.type}-${section.section}`))}
                        </div>
                      )}

                      {/* Subsections */}
                      {section.subsections && section.subsections.map((subsection, subsectionIndex) => {
                        const subsectionKey = `subsection-${section.type}-${section.section}-${subsectionIndex}`;
                        const isExpanded = expandedSections.has(subsectionKey);

                        return (
                          <div key={subsectionKey} className="mb-4 last:mb-0">
                            <button
                              onClick={() => toggleSection(subsectionKey)}
                              className="flex items-center gap-2 w-full text-left p-2 hover:bg-gray-50 rounded border-b"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 text-gray-500" />
                              )}
                              <span className="font-medium text-gray-700">
                                {subsection.number && `${subsection.number}. `}
                                {subsection.letter && `${subsection.letter}. `}
                                {subsection.title}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="mt-2 ml-6">
                                {/* Subsection direct items */}
                                {subsection.items && subsection.items.length > 0 && (
                                  <div className="mb-3">
                                    {subsection.items.map((item: any) => renderItem(item, 0, subsectionKey))}
                                  </div>
                                )}

                                {/* Subsection sections */}
                                {subsection.sections && subsection.sections.map((subSection: any, subSectionIndex: number) => (
                                  <div key={`${subsectionKey}-section-${subSectionIndex}`} className="mb-3 last:mb-0">
                                    <div className="font-medium text-sm text-gray-600 mb-1 pl-2 border-l-2 border-gray-200">
                                      {subSection.title}
                                    </div>
                                    {subSection.items && subSection.items.length > 0 && (
                                      <div className="ml-4">
                                        {subSection.items.map((item: any) => renderItem(item, 0, `${subsectionKey}-section-${subSectionIndex}`))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <span>•</span>
                  <span>
                    {pagination.totalSections} sections total
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage || loading}
                  >
                    Previous
                  </Button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else {
                        const start = Math.max(1, pagination.currentPage - 2);
                        const end = Math.min(pagination.totalPages, start + 4);
                        const adjustedStart = Math.max(1, end - 4);
                        pageNum = adjustedStart + i;
                      }
                      
                      if (pageNum > pagination.totalPages) return null;
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === pagination.currentPage ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => handlePageChange(pageNum)}
                          disabled={loading}
                        >
                          {pageNum}
                        </Button>
                      );
                    }).filter(Boolean)}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Spacer to push community section to bottom */}
      <div className="flex-1" />

      {/* Join Our Learning Community Section */}
      <JoinCommunitySection />
    </div>
  );
}
