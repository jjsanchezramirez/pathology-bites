// src/features/cell-quiz/data/cell-pathways.ts

/**
 * Cell maturation pathways and relationships for generating biologically meaningful quiz questions
 * Based on hematopoietic cell development and differentiation pathways
 */

export interface CellPathway {
  name: string;
  cells: string[];
  description: string;
}

export interface CellRelationship {
  cellType: string;
  closelyRelated: string[];    // Adjacent cells in same pathway
  moderatelyRelated: string[]; // Same pathway but not adjacent
  unrelated: string[];         // Different pathways entirely
}

// Define the maturation pathways
export const CELL_PATHWAYS: CellPathway[] = [
  {
    name: 'myeloid',
    cells: ['blast', 'promyelocyte', 'myelocyte', 'metamyelocyte', 'band', 'segmented'],
    description: 'Neutrophil maturation pathway from blast to mature segmented neutrophil'
  },
  {
    name: 'erythroid', 
    cells: ['proerythroblast', 'basophilic', 'polychromatic', 'orthochromatic'],
    description: 'Red blood cell maturation pathway from proerythroblast to mature RBC'
  },
  {
    name: 'monocytic',
    cells: ['promonocyte', 'monocyte', 'macrophage'],
    description: 'Monocyte maturation pathway from promonocyte to macrophage'
  },
  {
    name: 'lymphoid',
    cells: ['lymphocyte', 'plasma'],
    description: 'Lymphoid pathway including lymphocytes and plasma cells'
  },
  {
    name: 'granulocytes',
    cells: ['eosinophil', 'basophil', 'segmented'],
    description: 'Mature granulocytes with specific granule types'
  }
];

// Helper function to find pathway for a cell
export function findCellPathway(cellType: string): CellPathway | null {
  return CELL_PATHWAYS.find(pathway => 
    pathway.cells.includes(cellType)
  ) || null;
}

// Helper function to get cell position in pathway
export function getCellPosition(cellType: string, pathway: CellPathway): number {
  return pathway.cells.indexOf(cellType);
}

// Generate relationships for each cell type
export function generateCellRelationships(): Record<string, CellRelationship> {
  const relationships: Record<string, CellRelationship> = {};
  
  // Get all available cell types from our data
  const allCellTypes = [
    'blast', 'promyelocyte', 'myelocyte', 'metamyelocyte', 'band', 'segmented',
    'proerythroblast', 'basophilic', 'polychromatic', 'orthochromatic', 
    'promonocyte', 'monocyte', 'macrophage',
    'lymphocyte', 'plasma',
    'eosinophil', 'basophil'
  ];

  allCellTypes.forEach(cellType => {
    const pathway = findCellPathway(cellType);
    
    if (!pathway) {
      // If no pathway found, treat as unrelated to everything
      relationships[cellType] = {
        cellType,
        closelyRelated: [],
        moderatelyRelated: [],
        unrelated: allCellTypes.filter(c => c !== cellType)
      };
      return;
    }

    const position = getCellPosition(cellType, pathway);
    const closelyRelated: string[] = [];
    const moderatelyRelated: string[] = [];
    const unrelated: string[] = [];

    // Closely related: adjacent cells in same pathway
    if (position > 0) {
      closelyRelated.push(pathway.cells[position - 1]);
    }
    if (position < pathway.cells.length - 1) {
      closelyRelated.push(pathway.cells[position + 1]);
    }

    // Moderately related: same pathway but not adjacent
    pathway.cells.forEach((cell, index) => {
      if (cell !== cellType && !closelyRelated.includes(cell)) {
        moderatelyRelated.push(cell);
      }
    });

    // Unrelated: cells from different pathways
    allCellTypes.forEach(cell => {
      const cellPathway = findCellPathway(cell);
      if (cell !== cellType && 
          cellPathway && 
          cellPathway.name !== pathway.name &&
          !closelyRelated.includes(cell) && 
          !moderatelyRelated.includes(cell)) {
        unrelated.push(cell);
      }
    });

    relationships[cellType] = {
      cellType,
      closelyRelated,
      moderatelyRelated,
      unrelated
    };
  });

  return relationships;
}

// Pre-generate the relationships
export const CELL_RELATIONSHIPS = generateCellRelationships();

/**
 * Generate quiz options based on biological relationships
 * @param correctCellType The correct answer cell type
 * @returns Array of 4 options: [correct, closely related, moderately related, unrelated]
 */
export function generateBiologicalOptions(correctCellType: string): string[] {
  const relationship = CELL_RELATIONSHIPS[correctCellType];
  
  if (!relationship) {
    // Fallback to random selection if no relationship found
    const allCells = Object.keys(CELL_RELATIONSHIPS);
    return [
      correctCellType,
      ...allCells.filter(c => c !== correctCellType)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
    ].sort(() => Math.random() - 0.5);
  }

  const options: string[] = [correctCellType];

  // Add one closely related option
  if (relationship.closelyRelated.length > 0) {
    const closeOption = relationship.closelyRelated[
      Math.floor(Math.random() * relationship.closelyRelated.length)
    ];
    options.push(closeOption);
  }

  // Add one moderately related option
  if (relationship.moderatelyRelated.length > 0) {
    const moderateOption = relationship.moderatelyRelated[
      Math.floor(Math.random() * relationship.moderatelyRelated.length)
    ];
    options.push(moderateOption);
  }

  // Add one unrelated option
  if (relationship.unrelated.length > 0) {
    const unrelatedOption = relationship.unrelated[
      Math.floor(Math.random() * relationship.unrelated.length)
    ];
    options.push(unrelatedOption);
  }

  // If we don't have enough options, fill with random cells
  while (options.length < 4) {
    const allCells = Object.keys(CELL_RELATIONSHIPS);
    const randomCell = allCells[Math.floor(Math.random() * allCells.length)];
    if (!options.includes(randomCell)) {
      options.push(randomCell);
    }
  }

  // Shuffle the options so correct answer isn't always first
  return options.sort(() => Math.random() - 0.5);
}
