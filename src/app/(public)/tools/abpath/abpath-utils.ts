// Pure logic extracted from the ABPath page: search/designation filtering, the
// statistics computation, category list, and pagination math. Unit-tested in
// isolation (see abpath-utils.test.ts).

import type { ABPathSection, ABPathItem, ABPathSubSection } from "@/shared/types/abpath";

export interface DesignationToggles {
  showC: boolean;
  showAR: boolean;
  showF: boolean;
}

/** True if the item (or any nested subitem) matches the search string. */
export function itemMatchesSearch(item: ABPathItem, search: string): boolean {
  if (!search) return true;

  const thisItemMatches =
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    (item.note && item.note.toLowerCase().includes(search.toLowerCase()));

  if (thisItemMatches) return true;

  if (item.subitems) {
    return item.subitems.some((subitem) => itemMatchesSearch(subitem, search));
  }

  return false;
}

/** Filter items by search + designation toggles, recursing into subitems. */
export function filterItems(
  items: ABPathItem[],
  search: string,
  { showC, showAR, showF }: DesignationToggles
): ABPathItem[] {
  return items
    .filter((item) => {
      if (search && !itemMatchesSearch(item, search)) {
        return false;
      }
      const matchesDesignation =
        (item.designation === "C" && showC) ||
        (item.designation === "AR" && showAR) ||
        (item.designation === "F" && showF) ||
        !item.designation; // Show items without designation
      return matchesDesignation;
    })
    .map((item) => {
      if (item.subitems) {
        return { ...item, subitems: filterItems(item.subitems, search, { showC, showAR, showF }) };
      }
      return item;
    });
}

/**
 * Apply designation filtering to a list of sections (shared by the on-page results
 * and the full PDF export). Returns [] when all designations are off.
 */
export function applyDesignationFilter(
  sections: ABPathSection[],
  toggles: DesignationToggles
): ABPathSection[] {
  const { showC, showAR, showF } = toggles;
  if (!showC && !showAR && !showF) return [];
  if (!sections.length) return [];

  return sections
    .map((section) => {
      const filteredSection = { ...section };

      if (section.items) {
        filteredSection.items = filterItems(section.items, "", toggles);
      }

      if (section.subsections) {
        filteredSection.subsections = section.subsections
          .map((subsection) => {
            const filteredSubsection = { ...subsection };

            if (subsection.items) {
              filteredSubsection.items = filterItems(subsection.items, "", toggles);
            }

            if (subsection.sections) {
              filteredSubsection.sections = subsection.sections
                .map((subSection: ABPathSubSection) => ({
                  ...subSection,
                  items: subSection.items ? filterItems(subSection.items, "", toggles) : undefined,
                }))
                .filter(
                  (subSection: ABPathSubSection) => !subSection.items || subSection.items.length > 0
                );
            }

            return filteredSubsection;
          })
          .filter(
            (subsection) =>
              (subsection.items && subsection.items.length > 0) ||
              (subsection.sections && subsection.sections.length > 0)
          );
      }

      return filteredSection;
    })
    .filter(
      (section) =>
        (section.items && section.items.length > 0) ||
        (section.subsections && section.subsections.length > 0) ||
        (showC && showAR && showF) // Keep sections without items if all designations shown
    );
}

export interface ABPathCategory {
  value: string;
  label: string;
  title: string;
}

/** Build the category dropdown options from all available sections. */
export function buildCategories(allSections: ABPathSection[]): ABPathCategory[] {
  if (!allSections.length) return [];
  return allSections.map((section) => ({
    value: `${section.type.toUpperCase()}_${section.section}`,
    label: `${section.type.toUpperCase()} ${section.section}: ${section.title}`,
    title: section.title,
  }));
}

export interface ABPathStats {
  totalVisible: number;
  totalAll: number;
  cCount: number;
  arCount: number;
  fCount: number;
  totalPercentage: number;
  cPercentage: number;
  arPercentage: number;
  fPercentage: number;
}

function countItems(items: ABPathItem[]): { total: number; c: number; ar: number; f: number } {
  let total = 0,
    c = 0,
    ar = 0,
    f = 0;

  items.forEach((item) => {
    total++;
    if (item.designation === "C") c++;
    else if (item.designation === "AR") ar++;
    else if (item.designation === "F") f++;

    if (item.subitems) {
      const subCounts = countItems(item.subitems);
      total += subCounts.total;
      c += subCounts.c;
      ar += subCounts.ar;
      f += subCounts.f;
    }
  });

  return { total, c, ar, f };
}

function countSection(section: ABPathSection) {
  const counts = { total: 0, c: 0, ar: 0, f: 0 };

  if (section.items) {
    const itemCounts = countItems(section.items);
    counts.total += itemCounts.total;
    counts.c += itemCounts.c;
    counts.ar += itemCounts.ar;
    counts.f += itemCounts.f;
  }

  if (section.subsections) {
    section.subsections.forEach((subsection) => {
      if (subsection.items) {
        const itemCounts = countItems(subsection.items);
        counts.total += itemCounts.total;
        counts.c += itemCounts.c;
        counts.ar += itemCounts.ar;
        counts.f += itemCounts.f;
      }

      if (subsection.sections) {
        subsection.sections.forEach((subSection) => {
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
}

/** Coverage statistics: items visible under the current designation toggles vs. all. */
export function computeStats(
  allSections: ABPathSection[],
  filteredSections: ABPathSection[],
  toggles: DesignationToggles
): ABPathStats {
  const defaultStats: ABPathStats = {
    totalVisible: 0,
    totalAll: 0,
    cCount: 0,
    arCount: 0,
    fCount: 0,
    totalPercentage: 0,
    cPercentage: 0,
    arPercentage: 0,
    fPercentage: 0,
  };

  if (!allSections.length) return defaultStats;

  const { showC, showAR, showF } = toggles;

  // Count ALL items from complete dataset (baseline)
  const allCounts = allSections.reduce(
    (acc, section) => {
      const sectionCounts = countSection(section);
      acc.total += sectionCounts.total;
      acc.c += sectionCounts.c;
      acc.ar += sectionCounts.ar;
      acc.f += sectionCounts.f;
      return acc;
    },
    { total: 0, c: 0, ar: 0, f: 0 }
  );

  // Apply designation filtering to hook-filtered data for accurate statistics
  const statsFilteredData = filteredSections.map((section) => {
    if (!showC && !showAR && !showF) return { ...section, items: [], subsections: [] };

    const filteredSection = { ...section };

    if (section.items) {
      filteredSection.items = filterItems(section.items, "", toggles);
    }

    if (section.subsections) {
      filteredSection.subsections = section.subsections.map((subsection) => {
        const filteredSubsection = { ...subsection };

        if (subsection.items) {
          filteredSubsection.items = filterItems(subsection.items, "", toggles);
        }

        if (subsection.sections) {
          filteredSubsection.sections = subsection.sections.map((subSection) => {
            const filteredSubSection = { ...subSection };
            if (subSection.items) {
              filteredSubSection.items = filterItems(subSection.items, "", toggles);
            }
            return filteredSubSection;
          });
        }

        return filteredSubsection;
      });
    }

    return filteredSection;
  });

  // Count currently visible items from fully filtered data (AP/CP + designation filtering)
  const visibleCounts = statsFilteredData.reduce(
    (acc, section) => {
      const sectionCounts = countSection(section);
      acc.total += sectionCounts.total;
      acc.c += sectionCounts.c;
      acc.ar += sectionCounts.ar;
      acc.f += sectionCounts.f;
      return acc;
    },
    { total: 0, c: 0, ar: 0, f: 0 }
  );

  const totalVisible = visibleCounts.c + visibleCounts.ar + visibleCounts.f;
  const totalAll = allCounts.c + allCounts.ar + allCounts.f; // Only designated items
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
    fPercentage: totalVisible > 0 ? Math.round((fCount / totalVisible) * 100) : 0,
  };
}

/** Page numbers to show in the pagination control (windowed to 5). */
export function getABPathPageNumbers(currentPage: number, totalPages: number): number[] {
  return Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    let pageNum: number;
    if (totalPages <= 5) {
      pageNum = i + 1;
    } else {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + 4);
      const adjustedStart = Math.max(1, end - 4);
      pageNum = adjustedStart + i;
    }
    return pageNum;
  }).filter((pageNum) => pageNum <= totalPages);
}
