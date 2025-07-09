import jsPDF from 'jspdf';

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

interface ItemCounts {
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

interface SectionStats {
  sectionKey: string;
  sectionTitle: string;
  type: 'ap' | 'cp';
  totalItems: number;
  cItems: number;
  arItems: number;
  fItems: number;
  percentageOfTotal: number;
  percentageOfSelected: number;
}

export class ABPathPDFGenerator {
  private doc: jsPDF;
  private currentY: number = 20;
  private pageHeight: number = 280;
  private margin: number = 20;
  private lineHeight: number = 6;

  constructor() {
    this.doc = new jsPDF();
  }

  private addNewPage() {
    this.doc.addPage();
    this.currentY = 20;
  }

  private checkPageBreak(requiredSpace: number = 10) {
    if (this.currentY + requiredSpace > this.pageHeight) {
      this.addNewPage();
    }
  }

  private addText(text: string, x: number = this.margin, fontSize: number = 10, style: 'normal' | 'bold' = 'normal') {
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', style);

    // Handle text wrapping
    const maxWidth = 170;
    const lines = this.doc.splitTextToSize(text, maxWidth);

    for (let i = 0; i < lines.length; i++) {
      this.checkPageBreak();
      this.doc.text(lines[i], x, this.currentY);
      this.currentY += this.lineHeight;
    }
  }

  private addTableRow(columns: string[], columnWidths: number[], isHeader: boolean = false) {
    this.checkPageBreak(8);

    const startY = this.currentY;
    let currentX = this.margin;

    // Set font style for header or regular row
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', isHeader ? 'bold' : 'normal');

    // Draw cell borders and text
    columns.forEach((text, index) => {
      const width = columnWidths[index];

      // Draw cell border
      this.doc.rect(currentX, startY - 4, width, 8);

      // Add text with padding
      const lines = this.doc.splitTextToSize(text, width - 4);
      this.doc.text(lines[0] || '', currentX + 2, startY);

      currentX += width;
    });

    this.currentY += 8;
  }

  private addTable(headers: string[], rows: string[][], columnWidths: number[]) {
    // Add header
    this.addTableRow(headers, columnWidths, true);

    // Add rows
    rows.forEach(row => {
      this.addTableRow(row, columnWidths, false);
    });

    this.currentY += 3; // Space after table
  }

  private addTitle(title: string) {
    this.checkPageBreak(15);
    this.addText(title, this.margin, 16, 'bold');
    this.currentY += 5;
  }

  private addSubtitle(subtitle: string) {
    this.checkPageBreak(10);
    this.addText(subtitle, this.margin, 12, 'bold');
    this.currentY += 3;
  }

  private generateStatsPage(itemCounts: ItemCounts, sectionStats: SectionStats[], filters: {
    showAP: boolean;
    showCP: boolean;
    showC: boolean;
    showAR: boolean;
    showF: boolean;
    searchTerm: string;
    selectedSections: string[];
  }) {
    // Title
    this.addTitle('ABPath Content Specifications - Export Summary');
    
    // Export info
    this.addText(`Generated on: ${new Date().toLocaleDateString()}`, this.margin, 10);
    this.addText(`Export time: ${new Date().toLocaleTimeString()}`, this.margin, 10);
    this.currentY += 5;

    // Applied filters
    this.addSubtitle('Applied Filters:');
    this.addText(`• Content Types: ${[filters.showAP && 'AP', filters.showCP && 'CP'].filter(Boolean).join(', ') || 'None'}`, this.margin + 5);
    this.addText(`• Designations: ${[filters.showC && 'Core (C)', filters.showAR && 'Advanced Resident (AR)', filters.showF && 'Fellow (F)'].filter(Boolean).join(', ') || 'None'}`, this.margin + 5);
    if (filters.searchTerm) {
      this.addText(`• Search Term: "${filters.searchTerm}"`, this.margin + 5);
    }
    if (filters.selectedSections.length > 0) {
      this.addText(`• Selected Sections: ${filters.selectedSections.length} section(s)`, this.margin + 5);
    }
    this.currentY += 5;

    // Overall statistics
    this.addSubtitle('Overall Statistics:');
    this.addText(`• Total Designated Items: ${itemCounts.totalVisible} of ${itemCounts.totalAll} (${itemCounts.totalPercentage}%)`, this.margin + 5);
    this.addText(`• Core (C): ${itemCounts.cCount} items (${itemCounts.cPercentage}% of visible)`, this.margin + 5);
    this.addText(`• Advanced Resident (AR): ${itemCounts.arCount} items (${itemCounts.arPercentage}% of visible)`, this.margin + 5);
    this.addText(`• Fellow (F): ${itemCounts.fCount} items (${itemCounts.fPercentage}% of visible)`, this.margin + 5);
    this.currentY += 10;

    // Section breakdown
    this.addSubtitle('Section Breakdown:');

    if (sectionStats.length > 0) {
      // Table headers
      const headers = ['Section', 'Total', 'C', 'AR', 'F', '% Total', '% Selected'];
      const columnWidths = [75, 16, 11, 11, 11, 18, 18]; // Total width: 160

      // Prepare table rows
      const tableRows = sectionStats.map(section => [
        section.sectionTitle,
        section.totalItems.toString(),
        section.cItems.toString(),
        section.arItems.toString(),
        section.fItems.toString(),
        `${section.percentageOfTotal.toFixed(1)}%`,
        `${section.percentageOfSelected.toFixed(1)}%`
      ]);

      this.addTable(headers, tableRows, columnWidths);
    } else {
      this.addText('No sections match the current filters.', this.margin + 5, 9);
    }
  }

  private countItemsInSection(section: PathologySection): { total: number; c: number; ar: number; f: number } {
    let total = 0, c = 0, ar = 0, f = 0;

    const countItems = (items: PathologyItem[]) => {
      items.forEach(item => {
        if (item.designation && ['C', 'AR', 'F'].includes(item.designation)) {
          total++;
          if (item.designation === 'C') c++;
          else if (item.designation === 'AR') ar++;
          else if (item.designation === 'F') f++;
        }
        if (item.subitems) {
          countItems(item.subitems);
        }
      });
    };

    if (section.items) {
      countItems(section.items);
    }

    if (section.subsections) {
      section.subsections.forEach(subsection => {
        if (subsection.items) {
          countItems(subsection.items);
        }
        if (subsection.sections) {
          subsection.sections.forEach(subSection => {
            if (subSection.items) {
              countItems(subSection.items);
            }
          });
        }
      });
    }

    return { total, c, ar, f };
  }

  private countItemsInSubsection(subsection: PathologySubsection): { total: number; c: number; ar: number; f: number } {
    let total = 0, c = 0, ar = 0, f = 0;

    const countItems = (items: PathologyItem[]) => {
      items.forEach(item => {
        if (item.designation && ['C', 'AR', 'F'].includes(item.designation)) {
          total++;
          if (item.designation === 'C') c++;
          else if (item.designation === 'AR') ar++;
          else if (item.designation === 'F') f++;
        }
        if (item.subitems) {
          countItems(item.subitems);
        }
      });
    };

    if (subsection.items) {
      countItems(subsection.items);
    }

    if (subsection.sections) {
      subsection.sections.forEach(subSection => {
        if (subSection.items) {
          countItems(subSection.items);
        }
      });
    }

    return { total, c, ar, f };
  }

  private generateSectionStats(filteredData: PathologySection[], allData: PathologySection[], totalVisibleItems: number): SectionStats[] {
    // Calculate total designated items across all data (not just filtered)
    const totalDesignatedItems = allData.reduce((total, section) => {
      const counts = this.countItemsInSection(section);
      return total + counts.total;
    }, 0);

    const stats: SectionStats[] = [];

    filteredData.forEach(section => {
      // Add main section stats
      const sectionCounts = this.countItemsInSection(section);
      stats.push({
        sectionKey: `${section.type}-${section.section}`,
        sectionTitle: `${section.type.toUpperCase()} ${section.section}: ${section.title}`,
        type: section.type,
        totalItems: sectionCounts.total,
        cItems: sectionCounts.c,
        arItems: sectionCounts.ar,
        fItems: sectionCounts.f,
        percentageOfTotal: totalDesignatedItems > 0 ? (sectionCounts.total / totalDesignatedItems) * 100 : 0,
        percentageOfSelected: totalVisibleItems > 0 ? (sectionCounts.total / totalVisibleItems) * 100 : 0
      });

      // Add subsection stats for sections that have subsections
      if (section.subsections && section.subsections.length > 0) {
        section.subsections.forEach(subsection => {
          const subsectionCounts = this.countItemsInSubsection(subsection);
          if (subsectionCounts.total > 0) { // Only include subsections with designated items
            stats.push({
              sectionKey: `${section.type}-${section.section}-${subsection.letter || subsection.number}`,
              sectionTitle: `  ${subsection.letter || subsection.number}. ${subsection.title}`,
              type: section.type,
              totalItems: subsectionCounts.total,
              cItems: subsectionCounts.c,
              arItems: subsectionCounts.ar,
              fItems: subsectionCounts.f,
              percentageOfTotal: totalDesignatedItems > 0 ? (subsectionCounts.total / totalDesignatedItems) * 100 : 0,
              percentageOfSelected: totalVisibleItems > 0 ? (subsectionCounts.total / totalVisibleItems) * 100 : 0
            });
          }
        });
      }
    });

    return stats;
  }

  private renderItem(item: PathologyItem, level: number = 0) {
    const indent = this.margin + (level * 8);
    
    // Build the item text
    let itemText = '';
    if (item.number) itemText += `${item.number}. `;
    if (item.letter) itemText += `${item.letter}. `;
    if (item.roman) itemText += `${item.roman}. `;
    itemText += item.title;
    if (item.designation) itemText += ` [${item.designation}]`;

    this.addText(itemText, indent, 9);
    
    if (item.note) {
      this.addText(`Note: ${item.note}`, indent + 5, 8);
    }

    if (item.subitems) {
      item.subitems.forEach(subitem => {
        this.renderItem(subitem, level + 1);
      });
    }
  }

  private generateContentPages(filteredData: PathologySection[]) {
    this.addNewPage();
    this.addTitle('Filtered Content');

    filteredData.forEach(section => {
      this.checkPageBreak(20);
      
      // Section header
      this.addSubtitle(`${section.type.toUpperCase()} ${section.section}: ${section.title}`);
      
      // Section items
      if (section.items) {
        section.items.forEach(item => {
          this.renderItem(item, 0);
        });
      }

      // Subsections
      if (section.subsections) {
        section.subsections.forEach(subsection => {
          this.checkPageBreak(15);
          this.addText(`${subsection.letter || subsection.number}. ${subsection.title}`, this.margin + 5, 10, 'bold');

          if (subsection.items) {
            subsection.items.forEach(item => {
              this.renderItem(item, 1);
            });
          }

          if (subsection.sections) {
            subsection.sections.forEach(subSection => {
              this.checkPageBreak(10);
              this.addText(subSection.title, this.margin + 10, 9, 'bold');

              if (subSection.items) {
                subSection.items.forEach(item => {
                  this.renderItem(item, 2);
                });
              }
            });
          }
        });
      }

      this.currentY += 5; // Space between sections
    });
  }

  public generatePDF(
    filteredData: PathologySection[],
    allData: PathologySection[],
    itemCounts: ItemCounts,
    filters: {
      showAP: boolean;
      showCP: boolean;
      showC: boolean;
      showAR: boolean;
      showF: boolean;
      searchTerm: string;
      selectedSections: string[];
    }
  ): jsPDF {
    // Generate section statistics
    const sectionStats = this.generateSectionStats(filteredData, allData, itemCounts.totalVisible);

    // Generate statistics page
    this.generateStatsPage(itemCounts, sectionStats, filters);

    // Generate content pages
    this.generateContentPages(filteredData);

    return this.doc;
  }
}
