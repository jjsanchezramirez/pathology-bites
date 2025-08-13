# Anki Card Viewer

A comprehensive React component system for displaying and interacting with Anki flashcards, including support for cloze deletions, images, and rich HTML content.

## Features

### Card Types Supported
- **Basic Cards**: Traditional front/back flashcards
- **Cloze Deletion Cards**: Cards with fill-in-the-blank style questions
- **Image Cards**: Cards with embedded images
- **Rich HTML Content**: Full HTML support for complex formatting

### Interactive Features
- Show/hide answers with smooth transitions
- Navigate between cards in a deck
- Cloze navigation for multi-cloze cards
- Study mode with progress tracking
- Card statistics and metadata display

## Components

### AnkiCardViewer
Displays a single Anki card with full interactivity.

```tsx
import { AnkiCardViewer } from '@/features/anki'

<AnkiCardViewer
  card={ankiCard}
  showAnswer={false}
  onAnswerToggle={() => setShowAnswer(!showAnswer)}
  onNext={() => goToNextCard()}
  onPrevious={() => goToPreviousCard()}
/>
```

**Props:**
- `card: AnkiCard` - The card data to display
- `showAnswer?: boolean` - Whether to show the answer (controlled)
- `onAnswerToggle?: () => void` - Callback when answer visibility toggles
- `onNext?: () => void` - Callback for next card navigation
- `onPrevious?: () => void` - Callback for previous card navigation
- `className?: string` - Additional CSS classes

### AnkiDeckViewer
Displays an entire deck of cards with navigation and study features.

```tsx
import { AnkiDeckViewer } from '@/features/anki'

<AnkiDeckViewer
  deck={ankiDeck}
  currentCardIndex={0}
  onCardChange={(index) => setCurrentCard(index)}
  showAnswers={false}
/>
```

**Props:**
- `deck: AnkiDeck` - The deck containing multiple cards
- `currentCardIndex?: number` - Current card index (controlled)
- `onCardChange?: (index: number) => void` - Callback when card changes
- `showAnswers?: boolean` - Whether to show answers by default
- `className?: string` - Additional CSS classes

## Cloze Deletion Support

The system fully supports Anki's cloze deletion format:

### Basic Cloze
```
The {{c1::heart}} pumps blood through the body.
```

### Cloze with Hints
```
The {{c1::mitochondria::powerhouse}} of the cell produces ATP.
```

### Multiple Clozes
```
{{c1::DNA}} is transcribed to {{c2::RNA}}, which is translated to {{c3::proteins}}.
```

### Cloze Processing Utilities

```tsx
import { 
  processClozeText, 
  hasClozes, 
  getClozeIndices,
  generateClozeQuestion,
  generateClozeAnswer
} from '@/features/anki/utils/cloze-processor'

// Check if text contains clozes
const hasClozeDeletions = hasClozes(text)

// Get all cloze indices
const indices = getClozeIndices(text) // [1, 2, 3]

// Generate question for specific cloze
const question = generateClozeQuestion(text, 1) // Shows cloze 1 as blank

// Generate answer showing all clozes
const answer = generateClozeAnswer(text) // Shows all content
```

## Data Types

### AnkiCard
```tsx
interface AnkiCard {
  id: string
  cardId: number
  noteId: number
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags: string[]
  question: string
  answer: string
  css: string
  interval: number
  due: number
  factor: number
  reviews: number
  lapses: number
  // ... additional Anki metadata
}
```

### AnkiDeck
```tsx
interface AnkiDeck {
  id: string
  name: string
  cards: AnkiCard[]
  description?: string
  options?: AnkiDeckOptions
}
```

## Usage Examples

### Basic Card Example
```tsx
const basicCard: AnkiCard = {
  id: '1',
  cardId: 1001,
  noteId: 2001,
  deckName: 'Medical Terms',
  modelName: 'Basic',
  question: 'What does "tachycardia" mean?',
  answer: 'Rapid heart rate (>100 bpm)',
  tags: ['cardiology', 'terminology'],
  // ... other required fields
}

<AnkiCardViewer card={basicCard} />
```

### Cloze Card Example
```tsx
const clozeCard: AnkiCard = {
  id: '2',
  cardId: 1002,
  noteId: 2002,
  deckName: 'Pathology',
  modelName: 'Cloze',
  question: 'The {{c1::glomerulus}} filters blood in the {{c2::kidney}}.',
  answer: 'The glomerulus filters blood in the kidney.',
  tags: ['nephrology', 'anatomy'],
  // ... other required fields
}

<AnkiCardViewer card={clozeCard} />
```

### Deck Example
```tsx
const deck: AnkiDeck = {
  id: 'deck-1',
  name: 'Pathology Fundamentals',
  description: 'Essential pathology concepts',
  cards: [basicCard, clozeCard, /* ... more cards */]
}

<AnkiDeckViewer deck={deck} />
```

## Styling

The components use Tailwind CSS and follow the project's design system:
- Cards use the standard `Card` component styling
- Buttons follow the project's button variants
- Colors and spacing match the overall theme
- Responsive design for mobile and desktop

## Integration

The Anki viewer integrates seamlessly with the existing codebase:
- Uses the same UI components (`Card`, `Button`, `Badge`, etc.)
- Follows the project's TypeScript patterns
- Implements the feature-first organization structure
- Uses Next.js Image component with `unoptimized={true}` for images

### AnkomaViewer
Automatically loads and displays the complete Ankoma pathology deck with section navigation.

```tsx
import { AnkomaViewer } from '@/features/anki'

<AnkomaViewer
  autoLoad={true}
  defaultSection="ankoma---ap::basic-principles"
  onSectionChange={(section) => console.log('Selected:', section.name)}
  onError={(error) => console.error('Load error:', error)}
/>
```

**Props:**
- `autoLoad?: boolean` - Whether to automatically load ankoma.json on mount (default: true)
- `defaultSection?: string` - Default section ID to select when data loads
- `onSectionChange?: (section: AnkomaSection) => void` - Callback when section changes
- `onError?: (error: string) => void` - Callback for loading errors
- `className?: string` - Additional CSS classes

**Features:**
- **Auto-loading**: Automatically fetches and parses `ankoma.json` from `/api/debug/anki-data/ankoma.json`
- **Section Navigation**: Hierarchical dropdown with search for AP/CP sections and subsections
- **Card Browsing**: Navigate through cards within selected sections with "Card X of Y" counter
- **Error Handling**: Graceful handling of loading failures, invalid JSON, and empty sections
- **Real Data**: Works with the actual Ankoma deck containing thousands of pathology cards

## Ankoma.json Structure

The `ankoma.json` file is expected to be located at `json/anki/ankoma.json` and follows this structure:

```json
{
  "__type__": "Deck",
  "name": "Ankoma",
  "children": [
    {
      "__type__": "Deck",
      "name": "Ankoma - AP",
      "children": [
        {
          "__type__": "Deck",
          "name": "Basic Principles",
          "notes": [
            {
              "__type__": "Note",
              "fields": ["Header", "{{c1::Cloze text}}", "Extra info"],
              "guid": "unique-id",
              "tags": ["pathology", "basics"]
            }
          ]
        }
      ]
    }
  ]
}
```

## Demo Pages

- `/demo/anki-viewer` - Full-featured demo with Ankoma integration and sample cards
- `/tools/anki-viewer` - Production Ankoma deck viewer

## Future Enhancements

- Anki deck import/export functionality
- Spaced repetition algorithm integration
- Study session analytics
- Custom card templates
- Audio support for pronunciation cards
- Synchronization with Anki desktop/mobile apps
- Progress tracking and performance analytics
