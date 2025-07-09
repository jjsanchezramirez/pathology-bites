'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Search, BookOpen, ToggleLeft, Filter, X, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { ABPathPDFGenerator } from './pdf-generator';

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

const DESIGNATION_COLORS = {
  'C': 'bg-green-100 text-green-800 border-green-200',
  'AR': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'F': 'bg-purple-100 text-purple-800 border-purple-200'
};

const DESIGNATION_LABELS = {
  'C': 'Core',
  'AR': 'Advanced Resident',
  'F': 'Fellow'
};

export default function ABPathContentPage() {
  const [data, setData] = useState<ContentSpecifications | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  // Toggle states
  const [showAP, setShowAP] = useState(true);
  const [showCP, setShowCP] = useState(true);
  const [showC, setShowC] = useState(true);
  const [showAR, setShowAR] = useState(true);
  const [showF, setShowF] = useState(true);

  // Collapse state for subsections
  const [collapsedSubsections, setCollapsedSubsections] = useState<Set<string>>(new Set());

  // Toggle subsection collapse
  const toggleSubsectionCollapse = (subsectionKey: string) => {
    setCollapsedSubsections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subsectionKey)) {
        newSet.delete(subsectionKey);
      } else {
        newSet.add(subsectionKey);
      }
      return newSet;
    });
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (!data?.content_specifications) return;

    const generator = new ABPathPDFGenerator();
    const filters = {
      showAP,
      showCP,
      showC,
      showAR,
      showF,
      searchTerm,
      selectedSections
    };

    // Get all sections for percentage calculations
    const allSections = [
      ...data.content_specifications.ap_sections,
      ...data.content_specifications.cp_sections
    ];

    const pdf = generator.generatePDF(filteredData, allSections, itemCounts, filters);

    // Generate filename with timestamp and filters
    const timestamp = new Date().toISOString().slice(0, 10);
    const filterSuffix = [
      showAP && showCP ? 'AP-CP' : showAP ? 'AP' : showCP ? 'CP' : '',
      [showC && 'C', showAR && 'AR', showF && 'F'].filter(Boolean).join('-')
    ].filter(Boolean).join('_');

    const filename = `abpath-content_${timestamp}${filterSuffix ? '_' + filterSuffix : ''}.pdf`;
    pdf.save(filename);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/content_specifications_merged.json');
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

  // Get all available sections for the dropdown
  const availableSections = useMemo(() => {
    if (!data || !data.content_specifications) return [];

    const allSections = [
      ...data.content_specifications.ap_sections,
      ...data.content_specifications.cp_sections
    ];

    // Helper function to count items in a section
    const countSectionItems = (section: PathologySection): number => {
      let count = 0;

      if (section.items) {
        count += section.items.length;
      }

      if (section.subsections) {
        section.subsections.forEach(subsection => {
          if (subsection.items) {
            count += subsection.items.length;
          }
          if (subsection.sections) {
            subsection.sections.forEach(subSection => {
              if (subSection.items) {
                count += subSection.items.length;
              }
            });
          }
        });
      }

      return count;
    };

    return allSections
      .sort((a, b) => {
        // Sort by type first (AP then CP), then by section number
        if (a.type !== b.type) {
          return a.type === 'ap' ? -1 : 1;
        }
        return a.section - b.section;
      })
      .map(section => {
        const itemCount = countSectionItems(section);
        return {
          value: section.section,
          key: `${section.type}-${section.section}`,
          label: `${section.type.toUpperCase()} ${section.section}: ${section.title} (${itemCount} items)`,
          type: section.type
        };
      });
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data || !data.content_specifications) return [];

    // Combine AP and CP sections based on toggles
    let allSections: PathologySection[] = [];

    if (showAP) {
      allSections = [...allSections, ...data.content_specifications.ap_sections];
    }

    if (showCP) {
      allSections = [...allSections, ...data.content_specifications.cp_sections];
    }

    // Filter by selected sections
    if (selectedSections.length > 0) {
      allSections = allSections.filter(section =>
        selectedSections.includes(`${section.type}-${section.section}`)
      );
    }

    // Filter by search term and designation
    const filterItems = (items: PathologyItem[]): PathologyItem[] => {
      if (!items || !Array.isArray(items)) return [];

      return items.filter(item => {
        const matchesSearch = searchTerm === '' ||
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.note && item.note.toLowerCase().includes(searchTerm.toLowerCase()));

        // Check if this item has a matching designation
        const hasMatchingDesignation = item.designation &&
          ((item.designation === 'C' && showC) ||
           (item.designation === 'AR' && showAR) ||
           (item.designation === 'F' && showF));

        // Check if any subitems match (recursively)
        const filteredSubitems = item.subitems ? filterItems(item.subitems) : [];
        const hasMatchingSubitems = filteredSubitems.length > 0;

        // Include item if:
        // 1. It has a matching designation and matches search, OR
        // 2. It has matching subitems (to preserve hierarchy), OR
        // 3. It has no designation but matches search (organizational items)
        const shouldInclude = (hasMatchingDesignation && matchesSearch) ||
                             hasMatchingSubitems ||
                             (!item.designation && matchesSearch);

        // However, if no designations are selected at all, only show items without designations
        if (!showC && !showAR && !showF) {
          return !item.designation && matchesSearch;
        }

        return shouldInclude;
      }).map(item => ({
        ...item,
        subitems: item.subitems ? filterItems(item.subitems) : undefined
      }));
    };

    const filterSubsections = (subsections: PathologySubsection[]): PathologySubsection[] => {
      if (!subsections || !Array.isArray(subsections)) return [];

      return subsections.map(subsection => {
        const filteredItems = subsection.items ? filterItems(subsection.items) : [];
        const filteredSections = subsection.sections ? subsection.sections.map(section => ({
          ...section,
          items: section.items ? filterItems(section.items) : []
        })).filter(section => section.items && section.items.length > 0) : [];

        return {
          ...subsection,
          items: filteredItems,
          sections: filteredSections
        };
      }).filter(subsection =>
        (subsection.items && subsection.items.length > 0) ||
        (subsection.sections && subsection.sections.length > 0)
      );
    };

    return allSections.map(section => ({
      ...section,
      items: section.items ? filterItems(section.items) : undefined,
      subsections: section.subsections ? filterSubsections(section.subsections) : undefined
    })).filter(section =>
      (section.items && section.items.length > 0) ||
      (section.subsections && section.subsections.length > 0)
    ).sort((a, b) => {
      // Sort by type first (AP then CP), then by section number
      if (a.type !== b.type) {
        return a.type === 'ap' ? -1 : 1;
      }
      return a.section - b.section;
    });
  }, [data, searchTerm, selectedSections, showAP, showCP, showC, showAR, showF]);

  // Count total items and designation breakdown
  const itemCounts = useMemo(() => {
    let totalVisible = 0;
    let totalAll = 0;
    let cCount = 0;
    let arCount = 0;
    let fCount = 0;

    // Count items with designations only
    const countDesignatedItems = (items: PathologyItem[], isVisible: boolean = true): void => {
      if (!items) return;

      items.forEach(item => {
        // Only count items that have a designation (C, AR, or F)
        if (item.designation && (item.designation === 'C' || item.designation === 'AR' || item.designation === 'F')) {
          if (isVisible) {
            totalVisible++;
            if (item.designation === 'C') cCount++;
            else if (item.designation === 'AR') arCount++;
            else if (item.designation === 'F') fCount++;
          } else {
            totalAll++;
          }
        }

        if (item.subitems) {
          countDesignatedItems(item.subitems, isVisible);
        }
      });
    };

    // Count all designated items (for total percentage)
    if (data?.content_specifications) {
      [...data.content_specifications.ap_sections, ...data.content_specifications.cp_sections].forEach(section => {
        if (section.items) {
          countDesignatedItems(section.items, false);
        }
        if (section.subsections) {
          section.subsections.forEach(subsection => {
            if (subsection.items) {
              countDesignatedItems(subsection.items, false);
            }
            if (subsection.sections) {
              subsection.sections.forEach(subSection => {
                if (subSection.items) {
                  countDesignatedItems(subSection.items, false);
                }
              });
            }
          });
        }
      });
    }

    // Count visible designated items
    filteredData.forEach(section => {
      if (section.items) {
        countDesignatedItems(section.items, true);
      }
      if (section.subsections) {
        section.subsections.forEach(subsection => {
          if (subsection.items) {
            countDesignatedItems(subsection.items, true);
          }
          if (subsection.sections) {
            subsection.sections.forEach(subSection => {
              if (subSection.items) {
                countDesignatedItems(subSection.items, true);
              }
            });
          }
        });
      }
    });

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

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-sm leading-tight">{item.title}</span>
              {item.designation && (
                <Badge
                  variant="outline"
                  className={`text-xs px-1.5 py-0.5 ${DESIGNATION_COLORS[item.designation as keyof typeof DESIGNATION_COLORS]}`}
                >
                  {item.designation}
                </Badge>
              )}
            </div>
            {item.note && (
              <p className="text-xs text-gray-600 mt-0.5 italic leading-tight">{item.note}</p>
            )}
          </div>
        </div>

        {item.subitems && item.subitems.map((subitem, subIndex) =>
          renderItem(subitem, level + 1, `${itemKey}-sub-${subIndex}`)
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <BookOpen className="h-8 w-8 animate-pulse mx-auto mb-2" />
            <p>Loading content specifications...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-red-600">Error loading content specifications data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1">ABPath Content Specifications</h1>
        <p className="text-sm text-gray-600">
          {data.metadata.total_sections} sections • {data.metadata.ap_sections} AP • {data.metadata.cp_sections} CP
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search topics..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Section Filter */}
            <div className="min-w-[250px]">
              <Select
                value={selectedSections.length === 1 ? selectedSections[0] : "all"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSelectedSections([]);
                  } else {
                    setSelectedSections([value]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {availableSections.map((section) => (
                    <SelectItem key={section.key} value={section.key}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle Buttons */}
            <div className="flex gap-2">
              <Button
                variant={showAP ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAP(!showAP)}
                className="h-9"
              >
                AP
              </Button>
              <Button
                variant={showCP ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCP(!showCP)}
                className="h-9"
              >
                CP
              </Button>
              <Button
                variant={showC ? "default" : "outline"}
                size="sm"
                onClick={() => setShowC(!showC)}
                className={`h-9 ${showC ? 'bg-green-600 hover:bg-green-700' : 'border-green-600 text-green-600 hover:bg-green-50'}`}
              >
                C
              </Button>
              <Button
                variant={showAR ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAR(!showAR)}
                className={`h-9 ${showAR ? 'bg-yellow-600 hover:bg-yellow-700' : 'border-yellow-600 text-yellow-600 hover:bg-yellow-50'}`}
              >
                AR
              </Button>
              <Button
                variant={showF ? "default" : "outline"}
                size="sm"
                onClick={() => setShowF(!showF)}
                className={`h-9 ${showF ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-600 text-purple-600 hover:bg-purple-50'}`}
              >
                F
              </Button>
            </div>

            {/* Export Button */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="h-9"
                disabled={filteredData.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold">{itemCounts.totalVisible}</p>
                <p className="text-xs text-gray-500">{itemCounts.totalPercentage}% of all questions</p>
              </div>
              <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-gray-600">#</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Core</p>
                <p className="text-2xl font-bold">{itemCounts.cCount}</p>
                <p className="text-xs text-gray-500">{itemCounts.cPercentage}% of selected questions</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-green-600">C</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Advanced Resident</p>
                <p className="text-2xl font-bold">{itemCounts.arCount}</p>
                <p className="text-xs text-gray-500">{itemCounts.arPercentage}% of selected questions</p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-yellow-600">AR</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Fellow</p>
                <p className="text-2xl font-bold">{itemCounts.fCount}</p>
                <p className="text-xs text-gray-500">{itemCounts.fPercentage}% of selected questions</p>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-purple-600">F</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Filters */}
      {(selectedSections.length > 0 || searchTerm) && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-600">Active filters:</span>

              {searchTerm && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Search: "{searchTerm}"
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setSearchTerm('')}
                  />
                </Badge>
              )}

              {selectedSections.length > 0 && selectedSections.map(sectionKey => {
                const section = availableSections.find(s => s.key === sectionKey);
                return section ? (
                  <Badge key={sectionKey} variant="secondary" className="flex items-center gap-1">
                    {section.label}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => setSelectedSections(prev => prev.filter(key => key !== sectionKey))}
                    />
                  </Badge>
                ) : null;
              })}

              {(selectedSections.length > 0 || searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedSections([]);
                    setSearchTerm('');
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline ml-2"
                >
                  Clear all
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                {section.items && section.items.map((item, itemIndex) =>
                  renderItem(item, 0, `section-${section.type}-${section.section}-${sectionIndex}-item-${itemIndex}`)
                )}

                {section.subsections && section.subsections.map((subsection, subsectionIndex) => {
                  const subsectionKey = `${section.type}-${section.section}-${subsection.letter || subsection.number}-${subsectionIndex}`;
                  const isCollapsed = collapsedSubsections.has(subsectionKey);

                  return (
                    <div key={subsectionKey} className="mb-3">
                      <h4
                        className="font-medium text-sm mb-2 text-gray-700 border-l-2 border-gray-300 pl-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 py-1 rounded"
                        onClick={() => toggleSubsectionCollapse(subsectionKey)}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        )}
                        <span>
                          {subsection.letter && `${subsection.letter}. `}
                          {subsection.number && `${subsection.number}. `}
                          {subsection.title}
                        </span>
                      </h4>
                      {!isCollapsed && (
                        <>
                          {subsection.items && subsection.items.map((item, itemIndex) =>
                            renderItem(item, 1, `section-${section.type}-${section.section}-${sectionIndex}-subsection-${subsectionIndex}-item-${itemIndex}`)
                          )}
                          {subsection.sections && subsection.sections.map((subSection, subSectionIndex) => (
                            <div key={`${subsectionKey}-section-${subSectionIndex}`} className="ml-4 mb-2">
                              <h5 className="font-medium text-sm mb-1 text-gray-600 border-l-2 border-gray-200 pl-2">
                                {subSection.title}
                              </h5>
                              {subSection.items && subSection.items.map((item, itemIndex) =>
                                renderItem(item, 2, `section-${section.type}-${section.section}-${sectionIndex}-subsection-${subsectionIndex}-section-${subSectionIndex}-item-${itemIndex}`)
                              )}
                            </div>
                          ))}
                        </>
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
  );
}
