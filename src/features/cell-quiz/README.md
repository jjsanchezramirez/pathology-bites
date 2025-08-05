# Cell Identification Quiz

An interactive educational tool for learning hematologic cell identification with R2-optimized image delivery and smart caching. Users can test their knowledge across different cell categories with immediate feedback and progress tracking.

## Features

### 🎯 Quiz Categories
- **Myeloid Cells**: Neutrophils, eosinophils, basophils, monocytes and their precursors
- **Erythroid Cells**: Red blood cell precursors from proerythroblast to orthochromatic
- **Peripheral Blood**: Mature cells commonly seen in peripheral blood smears  
- **Bone Marrow**: Immature cells and precursors found in bone marrow

### 🎮 Game Features
- **10 questions per quiz** with randomized cell images
- **Multiple choice format** with 4 options per question
- **Immediate feedback** with detailed explanations
- **Progress tracking** with accuracy and streak statistics
- **Smart caching** with R2-optimized image delivery
- **Local storage** for persistent statistics

### 📚 Educational Components
- **Interactive tutorial** covering cell identification basics
- **Detailed explanations** for each cell type
- **Visual examples** with high-quality cell images
- **Key features guide** for systematic identification

## File Structure

```
src/features/cell-quiz/
├── components/
│   ├── cell-quiz-game.tsx      # Main quiz game component
│   ├── cell-quiz-tutorial.tsx  # Interactive tutorial
│   └── index.ts                # Component exports
└── README.md                   # This file
```

## Data Source & Optimization

Cell data is optimized for performance and cost efficiency:
- **R2 Storage**: All data served from Cloudflare R2 private buckets
- **Zero Egress Costs**: No bandwidth charges for image delivery
- **Smart Caching**: Client-side caching with TTL management
- **16 different cell types** with 538 total images
- **Categorization** by myeloid, erythroid, peripheral blood, and bone marrow
- **Global CDN**: Fast worldwide delivery via Cloudflare network

## Usage

### Basic Implementation
```tsx
import { CellQuizGame, CellQuizTutorial } from '@/features/cell-quiz/components'

// Quiz game
<CellQuizGame 
  quizSet="myeloid"
  onComplete={(results) => console.log(results)}
  onExit={() => console.log('Exit quiz')}
/>

// Tutorial
<CellQuizTutorial 
  onComplete={() => console.log('Tutorial complete')}
/>
```

### Quiz Results
```typescript
interface QuizResults {
  correct: number    // Number of correct answers
  total: number     // Total questions (always 10)
  streak: number    // Best streak in this session
}
```

## Cell Categories

### Myeloid Lineage
- Band neutrophils (54 images)
- Segmented neutrophils (72 images)  
- Metamyelocytes (58 images)
- Myelocytes (48 images)
- Promyelocytes (19 images)
- Blasts (8 images)
- Eosinophils (23 images)
- Basophils (3 images)
- Monocytes (16 images)
- Macrophages (9 images)

### Erythroid Lineage
- Proerythroblasts (10 images)
- Basophilic erythroblasts (14 images)
- Polychromatic erythroblasts (72 images)
- Orthochromatic erythroblasts (72 images)

### Additional Cells
- Lymphocytes (50 images) - Peripheral blood
- Plasma cells (10 images) - Bone marrow

## Statistics Tracking

The quiz tracks the following metrics per category:
- **Accuracy percentage** (correct/total)
- **Total attempts** across all sessions
- **Current streak** (consecutive correct answers)
- **Best streak** (highest consecutive correct answers)

Statistics are persisted in localStorage as `cell-quiz-stats`.

## Educational Value

This tool helps users develop systematic cell identification skills by:
1. **Pattern recognition** through repeated exposure to cell morphology
2. **Feature analysis** with guided explanations of key characteristics
3. **Progressive learning** across different complexity levels
4. **Immediate reinforcement** with explanatory feedback

Perfect for medical students, residents, and laboratory professionals learning hematopathology.
