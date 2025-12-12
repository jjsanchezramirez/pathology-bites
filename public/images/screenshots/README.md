# Landing Page Screenshots

This directory contains screenshots used on the landing page to showcase the platform's features.

## Required Screenshots

### 1. Three Core Features Section (Small Previews)
These appear as preview cards in the "Three Platforms in One" section:

- **`qbank-preview.png`** (recommended: 800x600px)
  - Screenshot of the quiz interface showing a question with multiple choice options
  - Should show the clean, modern question layout

- **`wsi-search-preview.png`** (recommended: 800x600px)
  - Screenshot of the virtual slide search interface
  - Show the search bar and a few slide thumbnails from different institutions

- **`tools-preview.png`** (recommended: 800x600px)
  - Screenshot of one of the interactive tools (Anki visualizer, cell counter, or gene finder)
  - Should highlight the interactive nature of the tools

### 2. Feature Showcase Sections (Full Screenshots)
These appear as larger showcase images next to feature descriptions:

- **`qbank-full.png`** (recommended: 1200x900px)
  - Full screenshot of the quiz customization interface or active quiz
  - Show categories, difficulty selection, and question count options
  - Could also show the results/analytics page

- **`anki-visualizer.png`** (recommended: 1200x900px)
  - Screenshot of the Anki deck visualizer showing cards
  - Include the deck browser, card preview, and study controls
  - Show images if possible to demonstrate the visual nature

### 3. Optional Screenshots
Consider adding these for additional sections:

- **`wsi-viewer.png`** - Virtual slide viewer with zoom/pan controls
- **`cell-counter.png`** - Differential cell counter tool
- **`gene-finder.png`** - Gene reference database interface
- **`dashboard.png`** - User dashboard with progress tracking

## Screenshot Guidelines

### Technical Requirements
- **Format**: PNG (for transparency and quality) or JPG (for smaller file size)
- **Compression**: Optimize images to keep file sizes reasonable (< 500KB per image)
- **Aspect Ratio**:
  - Preview cards: 4:3 ratio (800x600, 1600x1200)
  - Full showcases: 4:3 ratio (1200x900, 1600x1200)

### Content Guidelines
- Use **light mode** for consistency with the landing page
- Ensure no **personal/sensitive information** is visible
- Show **realistic data** (not lorem ipsum or test data)
- Include some **pathology content** to make it authentic
- Use **clean browser window** (hide bookmarks bar, extensions, etc.)

### Taking Screenshots
1. Open the feature you want to capture in a clean browser
2. Zoom to 100% or use browser's responsive design mode for consistent sizing
3. Use a screenshot tool that captures exact pixels (macOS: Cmd+Shift+4, Windows: Snipping Tool)
4. Crop to remove browser chrome if needed
5. Optimize/compress the image before adding to this directory

## Current Status

- [ ] qbank-preview.png
- [ ] wsi-search-preview.png
- [ ] tools-preview.png
- [ ] qbank-full.png
- [ ] anki-visualizer.png

Once you add screenshots, the landing page will automatically use them (uncomment the Image components in the React code).
