'use client';

import { useState, useEffect, useMemo } from 'react';
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
  const [data, setData] = useState<ContentSpecifications | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Toggle states for sections and designations
  const [showAP, setShowAP] = useState(true);
  const [showCP, setShowCP] = useState(true);
  const [showC, setShowC] = useState(true);
  const [showAR, setShowAR] = useState(true);
  const [showF, setShowF] = useState(true);

  // Helper function to check if an item or its subitems match search
  const itemMatchesSearch = (item: PathologyItem, search: string): boolean => {
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
  };

  // Define filterItems function before using it
  const filterItems = (items: PathologyItem[], search: string): PathologyItem[] => {
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
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/tools/abpath-content-specs');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();

        // Validate the data structure
        if (!jsonData || !jsonData.content_specifications) {
          throw new Error('Invalid data structure in content specifications file');
        }

        setData(jsonData);
      } catch (error) {
        console.error('Error loading content specifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get all available categories
  const categories = useMemo(() => {
    if (!data) return [];

    const allSections = [...data.content_specifications.ap_sections, ...data.content_specifications.cp_sections];
    return allSections.map(section => ({
      value: `${section.type.toUpperCase()}_${section.section}`,
      label: `${section.type.toUpperCase()} ${section.section}: ${section.title}`,
      title: section.title
    }));
  }, [data]);

  // Filter and search logic
  const filteredData = useMemo(() => {
    if (!data) return [];

    let sections: PathologySection[] = [];

    // Filter by section type (AP/CP)
    if (showAP && showCP) {
      sections = [...data.content_specifications.ap_sections, ...data.content_specifications.cp_sections];
    } else if (showAP) {
      sections = data.content_specifications.ap_sections;
    } else if (showCP) {
      sections = data.content_specifications.cp_sections;
    } else {
      sections = []; // Neither AP nor CP selected
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      const [type, sectionNum] = selectedCategory.split('_');
      sections = sections.filter(section =>
        section.type.toUpperCase() === type && section.section.toString() === sectionNum
      );
    }

    // Apply search and designation filters
    sections = sections.map(section => {
      const filteredSection = { ...section };

      if (section.items) {
        filteredSection.items = filterItems(section.items, searchTerm);
      }

      if (section.subsections) {
        filteredSection.subsections = section.subsections.map(subsection => {
          const filteredSubsection = { ...subsection };

          if (subsection.items) {
            filteredSubsection.items = filterItems(subsection.items, searchTerm);
          }

          if (subsection.sections) {
            filteredSubsection.sections = subsection.sections.map(subSection => ({
              ...subSection,
              items: subSection.items ? filterItems(subSection.items, searchTerm) : undefined
            })).filter(subSection => !subSection.items || subSection.items.length > 0);
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
      (!searchTerm && showC && showAR && showF && selectedCategory === 'all') // Keep sections without items if no filters
    );

    return sections;
  }, [data, searchTerm, showAP, showCP, showC, showAR, showF, selectedCategory, filterItems]);

  // Statistics calculation
  const stats = useMemo(() => {
    if (!data) return { totalVisible: 0, totalAll: 0, cCount: 0, arCount: 0, fCount: 0, totalPercentage: 0, cPercentage: 0, arPercentage: 0, fPercentage: 0 };

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

    // Count visible items (filtered)
    const visibleCounts = filteredData.reduce((acc, section) => {
      const sectionCounts = countSection(section);
      acc.total += sectionCounts.total;
      acc.c += sectionCounts.c;
      acc.ar += sectionCounts.ar;
      acc.f += sectionCounts.f;
      return acc;
    }, { total: 0, c: 0, ar: 0, f: 0 });

    // Count all items (unfiltered)
    const allSections = [...data.content_specifications.ap_sections, ...data.content_specifications.cp_sections];
    const allCounts = allSections.reduce((acc, section) => {
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
  }, [filteredData, data]);

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

  if (!data) {
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
              <p className="text-red-600">Error loading content specifications. Please try again later.</p>
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
                  <div className="text-2xl font-bold text-slate-500">{stats.totalAll}</div>
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
                                    {subsection.items.map(item => renderItem(item, 0, subsectionKey))}
                                  </div>
                                )}

                                {/* Subsection sections */}
                                {subsection.sections && subsection.sections.map((subSection, subSectionIndex) => (
                                  <div key={`${subsectionKey}-section-${subSectionIndex}`} className="mb-3 last:mb-0">
                                    <div className="font-medium text-sm text-gray-600 mb-1 pl-2 border-l-2 border-gray-200">
                                      {subSection.title}
                                    </div>
                                    {subSection.items && subSection.items.length > 0 && (
                                      <div className="ml-4">
                                        {subSection.items.map(item => renderItem(item, 0, `${subsectionKey}-section-${subSectionIndex}`))}
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
