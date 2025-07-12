#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Cell type categorization based on hematology
const CELL_CATEGORIES = {
  myeloid: [
    'blast', 'promyelocyte', 'myelocyte', 'metamyelocyte', 'band', 'segmented'
  ],
  erythroid: [
    'proerythroblast', 'basophilic', 'polychromatic', 'orthochromatic'
  ],
  other_cells: [
    'eosinophil', 'basophil', 'monocyte', 'macrophage', 'lymphocyte', 'plasma'
  ],
  all_cells: [
    'blast', 'promyelocyte', 'myelocyte', 'metamyelocyte', 'band', 'segmented',
    'proerythroblast', 'basophilic', 'polychromatic', 'orthochromatic',
    'eosinophil', 'basophil', 'monocyte', 'macrophage', 'lymphocyte', 'plasma'
  ]
};

const CELL_DESCRIPTIONS = {
  band: "Immature neutrophil with a horseshoe-shaped nucleus that hasn't fully segmented yet",
  segmented: "Mature neutrophil with a segmented nucleus, the most common white blood cell",
  metamyelocyte: "Immature neutrophil with an indented but not segmented nucleus",
  myelocyte: "Immature neutrophil with a round to oval nucleus, found in bone marrow",
  promyelocyte: "Early neutrophil precursor with prominent azurophilic granules",
  blast: "Immature hematopoietic cell, the earliest recognizable cell in a lineage",
  eosinophil: "Granulocyte with bright orange-red granules, involved in allergic reactions",
  basophil: "Granulocyte with dark blue-purple granules, involved in inflammatory responses",
  monocyte: "Large mononuclear cell that differentiates into macrophages",
  macrophage: "Large phagocytic cell derived from monocytes, part of innate immunity",
  lymphocyte: "Small mononuclear cell including T cells, B cells, and NK cells",
  proerythroblast: "Earliest recognizable red blood cell precursor with a large nucleus",
  basophilic: "Early red blood cell precursor with basophilic cytoplasm due to ribosomes",
  polychromatic: "Intermediate red blood cell precursor with mixed blue-pink cytoplasm",
  orthochromatic: "Late red blood cell precursor with mostly pink cytoplasm",
  plasma: "Antibody-producing cell derived from B lymphocytes with eccentric nucleus"
};

function analyzeCellImages() {
  const cellsDir = path.join(__dirname, '../../public/images/cells');
  
  if (!fs.existsSync(cellsDir)) {
    console.error('Cells directory not found:', cellsDir);
    return;
  }

  const files = fs.readdirSync(cellsDir);
  const cellTypes = {};

  // Group files by cell type
  files.forEach(file => {
    if (file.endsWith('.png')) {
      const cellType = file.split('_')[0];
      if (!cellTypes[cellType]) {
        cellTypes[cellType] = [];
      }
      cellTypes[cellType].push(file);
    }
  });

  // Generate cell data structure
  const cellData = {};
  
  Object.keys(cellTypes).forEach(cellType => {
    const images = cellTypes[cellType];
    const categories = [];
    
    // Determine which categories this cell belongs to
    Object.keys(CELL_CATEGORIES).forEach(category => {
      if (CELL_CATEGORIES[category].includes(cellType)) {
        categories.push(category);
      }
    });

    cellData[cellType] = {
      name: cellType.charAt(0).toUpperCase() + cellType.slice(1),
      description: CELL_DESCRIPTIONS[cellType] || `${cellType} cell`,
      categories: categories,
      images: images.map(img => `/images/cells/${img}`),
      count: images.length
    };
  });

  // Output results
  console.log('Cell Analysis Results:');
  console.log('=====================');
  console.log(`Total cell types: ${Object.keys(cellTypes).length}`);
  console.log(`Total images: ${files.filter(f => f.endsWith('.png')).length}`);
  console.log('');

  Object.keys(cellData).forEach(cellType => {
    const data = cellData[cellType];
    console.log(`${data.name}: ${data.count} images`);
    console.log(`  Categories: ${data.categories.join(', ')}`);
    console.log(`  Description: ${data.description}`);
    console.log('');
  });

  // Save to JSON file
  const outputPath = path.join(__dirname, '../../src/data/cell-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(cellData, null, 2));
  console.log(`Cell data saved to: ${outputPath}`);

  return cellData;
}

if (require.main === module) {
  analyzeCellImages();
}

module.exports = { analyzeCellImages, CELL_CATEGORIES, CELL_DESCRIPTIONS };
