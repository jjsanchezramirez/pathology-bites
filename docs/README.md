# Pathology Bites Documentation

Welcome to the Pathology Bites documentation! This directory contains comprehensive guides, architecture documentation, and references for the application.

## 📚 Documentation Index

### System Architecture

| Document | Description | Audience |
|----------|-------------|----------|
| [Toast System Architecture](./toast-system-architecture.md) | Complete technical deep-dive into the toast notification system | Developers |

### User Guides

| Document | Description | Audience |
|----------|-------------|----------|
| [Toast Usage Guide](./toast-usage-guide.md) | How to use toast notifications with examples and best practices | Developers |
| [NCI EVS Tester Guide](./nci-evs-tester-guide.md) | Guide for testing NCI EVS integration | QA, Developers |

### Quick References

| Document | Description | Audience |
|----------|-------------|----------|
| [UMLS Quick Reference](./UMLS_QUICK_REFERENCE.md) | Quick reference for UMLS API | Developers |

### Setup Guides

| Document | Description | Audience |
|----------|-------------|----------|
| [UMLS Setup](./UMLS_SETUP.md) | How to set up UMLS integration | DevOps, Developers |
| [Anki Workflow](./ANKI_WORKFLOW.md) | Export Anki decks and upload to R2 with compression | Content Creators, Developers |

### Summary Documents

| Document | Description | Audience |
|----------|-------------|----------|
| [Toast Standardization Summary](./TOAST_STANDARDIZATION_SUMMARY.md) | Summary of toast system migration and improvements | All |
| [Search Improvements Summary](./SEARCH_IMPROVEMENTS_SUMMARY.md) | Summary of search functionality improvements | Product, Developers |
| [UMLS Test Results](./UMLS_TEST_RESULTS.md) | Test results from UMLS integration | QA, Developers |

---

## 🎯 Getting Started

### For New Developers

1. **Architecture Overview**
   - Start with [Toast System Architecture](./toast-system-architecture.md) to understand our design patterns
   - Review summary documents to understand recent improvements

2. **Learn Key Systems**
   - **Toast Notifications:** [Usage Guide](./toast-usage-guide.md)
   - **UMLS Integration:** [Setup](./UMLS_SETUP.md) → [Quick Reference](./UMLS_QUICK_REFERENCE.md)

3. **Try Interactive Examples**
   - Toast System: Visit `/tools/toast-demo` in the app
   - NCI EVS Tester: Visit `/tools/nci-evs-tester`

### For Product/QA

1. **Feature Summaries**
   - [Toast Standardization](./TOAST_STANDARDIZATION_SUMMARY.md) - Better notifications UX
   - [Search Improvements](./SEARCH_IMPROVEMENTS_SUMMARY.md) - Enhanced search functionality

2. **Testing Guides**
   - [NCI EVS Tester](./nci-evs-tester-guide.md) - How to test medical terminology
   - [UMLS Test Results](./UMLS_TEST_RESULTS.md) - What to expect

---

## 📖 Documentation by Topic

### Toast Notification System

A comprehensive toast notification system with duplicate prevention and smart categorization.

**Documents:**
- 🏗️ [Architecture](./toast-system-architecture.md) - Complete technical deep-dive
- 📘 [Usage Guide](./toast-usage-guide.md) - How to use the API
- 📊 [Migration Summary](./TOAST_STANDARDIZATION_SUMMARY.md) - What changed and why

**Interactive Demo:** `/tools/toast-demo`

**Quick Start:**
```typescript
import { toast } from '@/shared/utils/toast'

toast.success('Done!')
toast.auth.error('Login failed')
toast.promise(saveData(), {
  loading: 'Saving...',
  success: 'Saved!',
  error: 'Failed'
})
```

---

### UMLS Integration

Integration with the Unified Medical Language System for medical terminology.

**Documents:**
- 🔧 [Setup Guide](./UMLS_SETUP.md) - How to configure
- 📖 [Quick Reference](./UMLS_QUICK_REFERENCE.md) - API reference
- ✅ [Test Results](./UMLS_TEST_RESULTS.md) - Quality metrics

---

### Search System

Enhanced medical terminology search with NCI EVS integration.

**Documents:**
- 📊 [Improvements Summary](./SEARCH_IMPROVEMENTS_SUMMARY.md) - What's new
- 🧪 [NCI EVS Tester Guide](./nci-evs-tester-guide.md) - How to test

**Interactive Tool:** `/tools/nci-evs-tester`

---

## 🔍 Finding Documentation

### By Role

**Frontend Developer:**
- Toast system: Architecture → Usage Guide → Demo
- Component patterns: (TODO: Add component guide)

**Backend Developer:**
- UMLS: Setup → Quick Reference
- API patterns: (TODO: Add API guide)

**QA Engineer:**
- Testing guides: NCI EVS Tester, UMLS Tests
- Feature summaries: All summary documents

**DevOps:**
- Setup guides: UMLS Setup
- Deployment: (TODO: Add deployment guide)

---

## 📝 Documentation Standards

### File Naming

- **Guides:** `lowercase-with-dashes.md`
- **Summaries:** `UPPERCASE_WITH_UNDERSCORES.md`
- **Architecture:** `lowercase-with-dashes-architecture.md`

### Document Structure

All documentation should include:
1. **Title and metadata** (version, date, author)
2. **Table of contents** (for long docs)
3. **Overview/Introduction**
4. **Main content** (with clear headings)
5. **Examples** (code samples, screenshots)
6. **Related links** (other docs, external resources)

### Code Examples

Use syntax highlighting and full context:

```typescript
// ✅ Good: Full context
import { toast } from '@/shared/utils/toast'

function handleSubmit() {
  toast.success('Form submitted!')
}
```

```typescript
// ❌ Bad: No context
toast.success('Form submitted!')
```

---

## 🔄 Keeping Docs Updated

Documentation should be updated when:
- New features are added
- APIs change
- Bugs are fixed that affect documented behavior
- User feedback indicates confusion

**Process:**
1. Update relevant docs in same PR as code changes
2. Add "Docs updated" to PR description
3. Link to specific doc sections in PR

---

## 🤝 Contributing to Docs

### Adding New Documentation

1. **Choose appropriate directory**
   - Architecture deep-dives → `docs/`
   - API references → `docs/`
   - Testing guides → `tests/*/README.md`

2. **Use template** (TODO: Add doc template)

3. **Update this index**
   - Add entry to relevant table
   - Update "By Topic" section if new topic

4. **Cross-link**
   - Link from related docs
   - Update navigation paths

### Improving Existing Docs

Found something unclear? Please:
1. Open an issue describing the confusion
2. Submit a PR with improvements
3. Tag with "documentation" label

---

## 📊 Documentation Health

| Metric | Target | Current |
|--------|--------|---------|
| Docs with examples | 100% | ✅ 100% |
| Docs with diagrams | 50% | 🟡 20% |
| Docs < 6 months old | 80% | ✅ 100% |
| Broken links | 0 | ✅ 0 |

**Last audit:** December 18, 2025

---

## 🎓 Learning Path

### Week 1: Fundamentals
- Read toast usage guide
- Try toast demo
- Review one summary document

### Week 2: Architecture
- Deep-dive: Toast architecture
- Understand UMLS integration
- Review test documentation

### Week 3: Advanced
- Read all architecture docs
- Study code with docs open
- Write your first doc improvement

---

## 🔗 External Resources

### Technologies
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Sonner (Toast Library)](https://sonner.emilkowal.ski/)
- [Supabase Documentation](https://supabase.com/docs)

### Standards
- [NCI EVS API](https://api-evsrest.nci.nih.gov/api/v1/ui/)
- [UMLS Documentation](https://www.nlm.nih.gov/research/umls/)

### Best Practices
- [Kent C. Dodds Blog](https://kentcdodds.com/blog)
- [Patterns.dev](https://www.patterns.dev/)

---

## 📞 Getting Help

**Can't find what you need?**

1. **Search this directory** - Use your IDE's search
2. **Check code comments** - We document in code too
3. **Ask the team** - Someone probably knows!
4. **Open an issue** - Request new documentation

**Want to improve docs?**

1. **See a typo?** - Fix it and PR
2. **Found outdated info?** - Update and PR
3. **Need more examples?** - Add them and PR
4. **Want new doc?** - Propose in issue first

---

## 🎯 Documentation Roadmap

### Planned Additions

- [ ] Component library documentation
- [ ] API reference guide
- [ ] Database schema documentation
- [ ] Deployment guide
- [ ] Environment setup guide
- [ ] Contribution guidelines
- [ ] Coding standards
- [ ] Performance optimization guide

### In Progress

- [x] Toast system docs (Complete)
- [x] UMLS integration docs (Complete)
- [ ] Testing strategy guide (Partial)

---

**Last Updated:** December 18, 2025
**Maintainers:** Pathology Bites Engineering Team
**Questions?** Open an issue or reach out to the team.
