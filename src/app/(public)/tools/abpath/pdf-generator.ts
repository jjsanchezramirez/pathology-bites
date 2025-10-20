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

export class ABPathPDFGenerator {
  private doc: jsPDF;
  private currentY: number = 20;
  private pageHeight: number = 280;
  private margin: number = 20;
  private lineHeight: number = 5;
  private logoImage: string | null = null;

  // Minimal color palette - just teal accent
  private teal: [number, number, number] = [20, 184, 166]; // Teal-500 - website color
  private black: [number, number, number] = [0, 0, 0];
  private white: [number, number, number] = [255, 255, 255];
  private lightGray: [number, number, number] = [245, 245, 245]; // Very light gray for alternating rows

  // Column layout for content details
  private columnWidth = 80;
  private leftColumnX = 20;
  private rightColumnX = 110;
  private currentColumn: 'left' | 'right' = 'left';
  private leftColumnY = 25;
  private rightColumnY = 25;

  constructor() {
    this.doc = new jsPDF();
  }

  private async initializeDocument(): Promise<void> {
    await this.loadLogo();
    this.addHeader();
  }

  private async loadLogo(): Promise<void> {
    try {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      return new Promise((resolve) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          this.logoImage = canvas.toDataURL('image/png');
          resolve();
        };
        img.onerror = () => {
          resolve();
        };
        img.src = '/icons/apple-touch-icon.png';
      });
    } catch {
      // Silent fail
    }
  }

  private addNewPage() {
    this.doc.addPage();
    this.currentY = 20;
    this.addHeader();
    // Reset column positions when adding new page
    this.currentColumn = 'left';
    this.leftColumnY = 25;
    this.rightColumnY = 25;
  }

  private checkColumnPageBreak(requiredSpace: number = 8) {
    if (this.currentColumn === 'left') {
      if (this.leftColumnY + requiredSpace > this.pageHeight) {
        this.currentColumn = 'right';
        this.currentY = this.rightColumnY;
      }
    } else {
      if (this.rightColumnY + requiredSpace > this.pageHeight) {
        this.addNewPage();
      }
    }
  }

  private addColumnText(text: string, fontSize: number = 8, style: 'normal' | 'bold' = 'normal', isTeal: boolean = false) {
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', style);
    this.doc.setTextColor(...(isTeal ? this.teal : this.black));

    const maxWidth = this.columnWidth - 2;
    const lines = this.doc.splitTextToSize(text, maxWidth);

    for (let i = 0; i < lines.length; i++) {
      this.checkColumnPageBreak();
      
      const x = this.currentColumn === 'left' ? this.leftColumnX : this.rightColumnX;
      
      if (this.currentColumn === 'left') {
        this.doc.text(lines[i], x, this.leftColumnY);
        this.leftColumnY += this.lineHeight;
      } else {
        this.doc.text(lines[i], x, this.rightColumnY);
        this.rightColumnY += this.lineHeight;
      }
    }
  }

  private addColumnSubtitle(subtitle: string) {
    this.checkColumnPageBreak(8);
    this.addColumnText(subtitle, 11, 'bold');
    
    // Add extra spacing after subtitle
    if (this.currentColumn === 'left') {
      this.leftColumnY += 2;
    } else {
      this.rightColumnY += 2;
    }
  }

  private addHeader() {
    // Logo
    const logoX = this.margin;
    const logoY = 5;
    const logoSize = 10;
    
    if (this.logoImage) {
      try {
        this.doc.addImage(this.logoImage, 'PNG', logoX, logoY, logoSize, logoSize);
      } catch {
        // Fallback - just text
        this.doc.setTextColor(...this.teal);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(8);
        this.doc.text('🔬', logoX, logoY + 6);
      }
    }
    
    // Brand name
    this.doc.setTextColor(...this.black);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.text('Pathology Bites', logoX + logoSize + 3, logoY + 6);
    
    // Subtitle
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.text('ABPath Content Specifications', logoX + logoSize + 3, logoY + 10);

    // Date
    this.doc.setFontSize(7);
    this.doc.text(`Generated: ${new Date().toLocaleDateString()}`, 150, logoY + 8);

    // Simple line separator
    this.doc.setDrawColor(...this.teal);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, 18, 190, 18);

    this.currentY = 25;
  }

  private drawTable(headers: string[], rows: string[][], startY: number, options?: { columnStyles?: { [key: number]: { cellWidth: number; }; }; }) {
    const pageWidth = 170; // Full width minus margins
    let currentTableY = startY;

    // Calculate column positions based on columnStyles or equal distribution
    const columnPositions: number[] = [];
    const columnWidths: number[] = [];

    if (options?.columnStyles) {
      let currentX = 0;
      for (let i = 0; i < headers.length; i++) {
        columnPositions[i] = currentX;
        columnWidths[i] = options.columnStyles[i]?.cellWidth || (pageWidth / headers.length);
        currentX += columnWidths[i];
      }
    } else {
      const equalWidth = pageWidth / headers.length;
      for (let i = 0; i < headers.length; i++) {
        columnPositions[i] = i * equalWidth;
        columnWidths[i] = equalWidth;
      }
    }

    // Header
    this.doc.setFillColor(...this.teal);
    this.doc.rect(this.margin, currentTableY - 2, pageWidth, 6, 'F');

    this.doc.setTextColor(...this.white);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);

    headers.forEach((header, i) => {
      this.doc.text(header, this.margin + columnPositions[i] + 2, currentTableY + 2);
    });

    currentTableY += 5;

    // Rows
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(7);
    this.doc.setTextColor(...this.black);

    rows.forEach((row, rowIndex) => {
      // Alternating row background
      if (rowIndex % 2 === 0) {
        this.doc.setFillColor(...this.lightGray);
        this.doc.rect(this.margin, currentTableY - 1, pageWidth, 4, 'F');
      }

      row.forEach((cell, cellIndex) => {
        this.doc.text(cell, this.margin + columnPositions[cellIndex] + 2, currentTableY + 2);
      });
      currentTableY += 4;
    });

    this.currentY = currentTableY + 5;
  }

  private checkPageBreak(requiredSpace: number = 8) {
    if (this.currentY + requiredSpace > this.pageHeight) {
      this.addNewPage();
    }
  }

  private addText(text: string, x: number = this.margin, fontSize: number = 8, style: 'normal' | 'bold' = 'normal', isTeal: boolean = false) {
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', style);
    this.doc.setTextColor(...(isTeal ? this.teal : this.black));

    const maxWidth = 170;
    const lines = this.doc.splitTextToSize(text, maxWidth);

    for (let i = 0; i < lines.length; i++) {
      this.checkPageBreak();
      this.doc.text(lines[i], x, this.currentY);
      this.currentY += this.lineHeight;
    }
  }

  private addTitle(title: string) {
    this.checkPageBreak(10);
    this.addText(title, this.margin, 16, 'bold', true);
    this.currentY += 3;
  }

  private addSubtitle(subtitle: string) {
    this.checkPageBreak(8);
    this.addText(subtitle, this.margin, 11, 'bold');
    this.currentY += 2;
  }

  private renderItem(item: PathologyItem, level: number = 0) {
    const indent = this.margin + (level * 8);
    
    // Build item text
    let itemText = '';
    if (item.number) itemText += `${item.number}. `;
    if (item.letter) itemText += `${item.letter}. `;
    if (item.roman) itemText += `${item.roman}. `;
    itemText += item.title;
    
    // Add designation
    if (item.designation) {
      itemText += ` [${item.designation}]`;
    }
    
    this.addText(itemText, indent, 8);
    
    // Note
    if (item.note) {
      this.addText(`Note: ${item.note}`, indent + 5, 7);
    }

    // Subitems
    if (item.subitems) {
      item.subitems.forEach(subitem => {
        this.renderItem(subitem, level + 1);
      });
    }
  }

  private renderColumnItem(item: PathologyItem, level: number = 0) {
    // Build item text
    let itemText = '';
    if (item.number) itemText += `${item.number}. `;
    if (item.letter) itemText += `${item.letter}. `;
    if (item.roman) itemText += `${item.roman}. `;
    itemText += item.title;
    
    // Add designation
    if (item.designation) {
      itemText += ` [${item.designation}]`;
    }
    
    // Add indentation for the text
    const indentSpaces = '  '.repeat(level);
    this.addColumnText(indentSpaces + itemText, 8);
    
    // Note
    if (item.note) {
      this.addColumnText(indentSpaces + `  Note: ${item.note}`, 7);
    }

    // Subitems
    if (item.subitems) {
      item.subitems.forEach(subitem => {
        this.renderColumnItem(subitem, level + 1);
      });
    }
  }

  private generateSummaryPage(
    filteredData: PathologySection[],
    filters: {
      searchTerm: string;
      selectedType: string;
      selectedDesignation: string;
      stats: ItemCounts;
    }
  ) {
    this.addTitle('ABPath Content Specifications');
    this.currentY += 2;

    // Filters
    if (filters.searchTerm || filters.selectedType !== 'all' || filters.selectedDesignation !== 'all') {
      this.addSubtitle('Applied Filters');
      if (filters.searchTerm) this.addText(`Search: "${filters.searchTerm}"`);
      if (filters.selectedType !== 'all') this.addText(`Type: ${filters.selectedType.toUpperCase()}`);
      if (filters.selectedDesignation !== 'all') this.addText(`Level: ${filters.selectedDesignation}`);
      this.currentY += 3;
    }

    // Overall statistics
    this.addSubtitle('Statistics');

    const overallHeaders = ['Metric', 'Count', 'Percentage'];
    const overallRows = [
      ['Visible Items', filters.stats.totalVisible.toString(), `${filters.stats.totalPercentage}%`],
      ['Total Items', filters.stats.totalAll.toString(), '100%'],
      ['Core (C)', filters.stats.cCount.toString(), `${filters.stats.cPercentage}%`],
      ['Advanced Resident (AR)', filters.stats.arCount.toString(), `${filters.stats.arPercentage}%`],
      ['Fellow (F)', filters.stats.fCount.toString(), `${filters.stats.fPercentage}%`]
    ];

    this.drawTable(overallHeaders, overallRows, this.currentY);

    // Section breakdown
    this.addSubtitle('Section Breakdown');

    const sectionHeaders = ['Section', 'Total', 'Core', 'AR', 'Fellow'];
    const sectionRows: string[][] = [];

    filteredData.forEach(section => {
      const sectionStats = this.calculateSectionStats(section);
      // Clean up section title by removing unwanted prefixes
      const cleanTitle = section.title
        .replace(/^Topics for Anatomic Pathology Residents?\s*:?\s*/i, '')
        .replace(/^The\s+/i, '');

      sectionRows.push([
        `${section.type.toUpperCase()} ${section.section}: ${cleanTitle}`,
        sectionStats.total.toString(),
        sectionStats.core.toString(),
        sectionStats.ar.toString(),
        sectionStats.fellow.toString()
      ]);
    });

    this.drawTable(sectionHeaders, sectionRows, this.currentY, {
      columnStyles: {
        0: { cellWidth: 100 }, // Section name - much wider for text
        1: { cellWidth: 17.5 }, // Total
        2: { cellWidth: 17.5 }, // Core
        3: { cellWidth: 17.5 }, // AR
        4: { cellWidth: 17.5 }, // Fellow
      }
    });

    // Add page break before section lists
    this.addNewPage();

    // Section lists
    const apSections = filteredData.filter(s => s.type === 'ap');
    const cpSections = filteredData.filter(s => s.type === 'cp');

    this.addTitle('Content Sections');

    if (apSections.length > 0) {
      this.addSubtitle('Anatomic Pathology Sections');
      apSections.forEach(s => {
        this.addText(`AP ${s.section}: ${s.title}`);
      });
      this.currentY += 3;
    }
      
    if (cpSections.length > 0) {
      this.addSubtitle('Clinical Pathology Sections');
      cpSections.forEach(s => {
        this.addText(`CP ${s.section}: ${s.title}`);
      });
    }

    this.addNewPage();
  }

  private calculateSectionStats(section: PathologySection): { total: number; core: number; ar: number; fellow: number } {
    let total = 0, core = 0, ar = 0, fellow = 0;

    const countItems = (items: PathologyItem[]) => {
      items.forEach(item => {
        total++;
        if (item.designation === 'C') core++;
        else if (item.designation === 'AR') ar++;
        else if (item.designation === 'F') fellow++;

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

    return { total, core, ar, fellow };
  }

  private generateContentPages(filteredData: PathologySection[]) {
    // Start with title in single column
    this.addTitle('Content Details');
    
    // Initialize column layout
    this.currentColumn = 'left';
    this.leftColumnY = this.currentY + 2;
    this.rightColumnY = this.currentY + 2;

    filteredData.forEach(section => {
      this.checkColumnPageBreak(12);

      // Clean up section title by removing unwanted prefixes
      const cleanTitle = section.title
        .replace(/^Topics for Anatomic Pathology Residents?\s*:?\s*/i, '')
        .replace(/^The\s+/i, '');

      // Section header
      this.addColumnSubtitle(`${section.type.toUpperCase()} ${section.section}: ${cleanTitle}`);

      // Section items
      if (section.items) {
        section.items.forEach(item => {
          this.renderColumnItem(item, 0);
        });
      }

      // Subsections
      if (section.subsections) {
        section.subsections.forEach(subsection => {
          this.checkColumnPageBreak(6);
          const subsectionTitle = `${subsection.letter || subsection.number}. ${subsection.title}`;
          this.addColumnText(subsectionTitle, 9, 'bold');

          if (subsection.items) {
            subsection.items.forEach(item => {
              this.renderColumnItem(item, 1);
            });
          }

          if (subsection.sections) {
            subsection.sections.forEach(subSection => {
              this.checkColumnPageBreak(4);
              this.addColumnText(subSection.title, 8, 'bold');

              if (subSection.items) {
                subSection.items.forEach(item => {
                  this.renderColumnItem(item, 2);
                });
              }
            });
          }
        });
      }

      // Add space between sections
      if (this.currentColumn === 'left') {
        this.leftColumnY += 3;
      } else {
        this.rightColumnY += 3;
      }
    });
  }

  public async generatePDF(
    filteredData: PathologySection[],
    filters: {
      searchTerm: string;
      selectedType: string;
      selectedDesignation: string;
      stats: ItemCounts;
    }
  ): Promise<jsPDF> {
    await this.initializeDocument();
    this.generateSummaryPage(filteredData, filters);
    this.generateContentPages(filteredData);
    return this.doc;
  }
}