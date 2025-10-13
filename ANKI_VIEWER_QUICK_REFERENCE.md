# Anki Viewer - Quick Reference Guide

## Access Points

### Public Version (Unauthenticated)
- **URL**: `https://yourdomain.com/tools/anki`
- **Purpose**: Preview, marketing, quick reference
- **Features**: Full interactive viewer, no login required
- **Audience**: Potential users, students, educators

### Dashboard Version (Authenticated)
- **URL**: `https://yourdomain.com/dashboard/anki`
- **Purpose**: Personal study with progress tracking
- **Features**: Full interactive viewer + future personalization
- **Audience**: Registered users
- **Navigation**: Dashboard sidebar → "Study & Practice" → "Anki Deck Viewer"

## Features

### Interactive Cloze Deletions
- **Click to reveal**: Click on yellow `[...]` boxes to reveal content
- **Keyboard shortcuts**: 
  - `Space` or `Enter` - Reveal next cloze
  - `←` `→` - Navigate between cards
  - `Ctrl/Cmd + R` - Reset all clozes
- **Visual feedback**:
  - Hidden: Yellow background (#fef3c7)
  - Revealed: Green background (#d1fae5)

### Image Support
- **Inline images**: Embedded directly in card content
- **Smart sizing**: Small icons stay inline, full images display as blocks
- **Image occlusion**: Special handling for masked images
- **R2 CDN**: Fast loading from Cloudflare R2 storage

### Card Types
1. **Cloze Cards**: Interactive `{{c1::content}}` format
2. **Basic Cards**: Traditional front/back flashcards
3. **Image Occlusion**: Click-to-reveal masked images
4. **Pre-processed**: Support for `[...]` placeholders

### Navigation
- **Dual Sidebar**: Browse by topic and subtopic
- **Search**: Find specific cards or topics
- **Keyboard**: Full keyboard navigation support
- **Mobile**: Touch-optimized interface

## Technical Details

### Component Architecture
```
DoubleSidebarAnkomaViewer (Main Container)
  └── InteractiveAnkiViewer (Card Display)
      ├── Interactive Cloze Processor
      ├── Image Extraction & Display
      ├── Keyboard Event Handlers
      └── Card Type Detection
```

### File Locations
```
src/
├── app/
│   ├── (public)/tools/anki/page.tsx          # Public version
│   └── (dashboard)/dashboard/anki/page.tsx   # Dashboard version
├── features/anki/
│   ├── components/
│   │   ├── interactive-anki-viewer.tsx       # Main viewer component
│   │   ├── double-sidebar-ankoma-viewer.tsx  # Container with sidebars
│   │   └── anki-card-viewer.tsx              # Basic viewer (legacy)
│   └── utils/
│       ├── interactive-cloze-processor.ts    # Cloze processing logic
│       ├── cloze-processor.ts                # Basic cloze (legacy)
│       └── ankoma-parser.ts                  # Deck parsing
└── shared/
    ├── config/navigation.ts                  # Navigation config
    └── components/layout/unified-sidebar.tsx # Sidebar component
```

### Bundle Sizes
- **Public version**: 6.35 kB (First Load: 289 kB)
- **Dashboard version**: 5.04 kB (First Load: 159 kB)
- **Shared component**: ~4 kB (gzipped)

## User Flows

### New User Journey
```
1. Discover → Visit /tools/anki (public)
2. Try → Use interactive features
3. Value → See 15,000+ cards, interactive clozes
4. Convert → Sign up for account
5. Engage → Access /dashboard/anki with progress tracking
```

### Returning User Journey
```
1. Login → Access dashboard
2. Navigate → Click "Anki Deck Viewer" in sidebar
3. Study → Use /dashboard/anki with saved progress
4. Share → Send /tools/anki link to colleagues
```

## Future Enhancements

### Planned Features (Dashboard Version)
- [ ] **Progress Tracking**: Cards studied, time spent, mastery levels
- [ ] **Spaced Repetition**: SRS algorithm, review scheduling
- [ ] **Custom Decks**: Create personal collections, tag cards
- [ ] **Study Analytics**: Performance metrics, weak areas
- [ ] **Annotations**: Personal notes, highlights, mnemonics
- [ ] **Study Streaks**: Daily/weekly study tracking
- [ ] **Achievements**: Gamification elements

### Potential Features (Public Version)
- [ ] **Limited Preview**: First 100 cards only
- [ ] **Social Sharing**: Share specific cards
- [ ] **Embed Support**: Embed cards in blog posts

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` or `Enter` | Reveal next cloze / Show answer / Next card |
| `←` | Previous card |
| `→` | Next card |
| `Ctrl/Cmd + R` | Reset all clozes |

## Troubleshooting

### Cards Not Loading
1. Check internet connection
2. Verify R2 storage is accessible
3. Check browser console for errors
4. Try refreshing the page

### Images Not Displaying
1. Verify R2 CDN URL is correct
2. Check image paths in ankoma.json
3. Ensure images are in `/anki/` subfolder
4. Check browser network tab for 404s

### Clozes Not Interactive
1. Verify JavaScript is enabled
2. Check for console errors
3. Ensure card has proper cloze format: `{{c1::content}}`
4. Try a different browser

### Navigation Not Working
1. Check keyboard focus (click on card area)
2. Verify not in an input field
3. Try clicking navigation buttons instead
4. Check browser console for errors

## Development

### Running Locally
```bash
npm run dev
# Visit http://localhost:3000/tools/anki (public)
# Visit http://localhost:3000/dashboard/anki (dashboard)
```

### Building for Production
```bash
npm run build
npm run start
```

### Testing
```bash
# Lint check
npm run lint

# Type check
npm run type-check

# Build check
npm run build
```

## Support

### Common Questions

**Q: Can I use this without an account?**
A: Yes! Visit `/tools/anki` for full access without authentication.

**Q: What's the difference between public and dashboard versions?**
A: Same features, but dashboard version will add progress tracking and personalization.

**Q: How many cards are available?**
A: 15,000+ pathology flashcards organized by topic.

**Q: Can I create my own decks?**
A: Coming soon in the dashboard version!

**Q: Is my progress saved?**
A: Coming soon in the dashboard version!

**Q: Can I export my study data?**
A: Coming soon in the dashboard version!

## Credits

- **Anki Deck**: Ankoma pathology deck
- **Storage**: Cloudflare R2
- **Framework**: Next.js 15 + React 19
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React

## Version History

### v2.0.0 (Current)
- ✅ Interactive cloze support
- ✅ Image occlusion support
- ✅ Keyboard navigation
- ✅ Dual placement (public + dashboard)
- ✅ Enhanced image handling
- ✅ Mobile optimization

### v1.0.0 (Legacy)
- Basic card viewer
- Manual answer reveal
- Limited keyboard support
- Public only

---

**Last Updated**: 2025-10-13
**Status**: ✅ Production Ready

