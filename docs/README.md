# Pathology Bites Documentation

Welcome to the Pathology Bites documentation! This directory contains comprehensive documentation for the Pathology Bites question bank platform.

## 📚 Documentation Overview

This documentation is organized into focused guides that cover different aspects of the platform:

### Core Documentation

| Document | Description |
|----------|-------------|
| **[System Overview](./system_overview.md)** | High-level overview of the platform, features, and architecture |
| **[Technical Architecture](./technical_architecture.md)** | Detailed technical architecture, database design, and system components |
| **[Development Guide](./development_guide.md)** | Setup instructions, development workflow, and coding standards |
| **[User Guide](./user_guide.md)** | End-user documentation for all platform features |
| **[API Reference](./api_reference.md)** | Complete API documentation with endpoints and examples |
| **[Security Guide](./security_guide.md)** | Security architecture, authentication, and best practices |

## 🚀 Quick Start

### For Developers
1. Start with the **[Development Guide](./development_guide.md)** for setup instructions
2. Review the **[Technical Architecture](./technical_architecture.md)** to understand the system
3. Check the **[API Reference](./api_reference.md)** for backend integration

### For Users
1. Read the **[User Guide](./user_guide.md)** for platform features
2. Check the **[System Overview](./system_overview.md)** for general information

### For Administrators
1. Review the **[Security Guide](./security_guide.md)** for security configuration
2. Check the **[Technical Architecture](./technical_architecture.md)** for system administration

## 🏗️ Platform Architecture

Pathology Bites is built with modern web technologies:

- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Vercel
- **Testing**: Jest + React Testing Library + Playwright

## 📋 Key Features

- **Question Management**: Create, edit, and organize pathology questions
- **Quiz System**: Take practice quizzes with multiple modes (practice, tutor, timed)
- **User Management**: Role-based access control (admin, creator, reviewer, user)
- **Image Management**: Upload and organize medical images
- **Review Workflow**: Question review and approval system
- **Analytics**: Performance tracking and statistics
- **Public Tools**: Cell quiz, gene lookup, citation generator

## 🔒 Security

The platform implements comprehensive security measures:
- 100% Row Level Security (RLS) coverage
- JWT-based authentication
- Role-based access control
- Audit logging
- Rate limiting
- CSRF protection

## 📊 Database

- **21 tables** with comprehensive relationships
- **58 RLS policies** for data security
- **19 secure functions** for business logic
- **6 security-invoker views** for data access

## 🧪 Testing

- **Unit Tests**: Feature-based testing with Jest
- **Integration Tests**: API and component testing
- **E2E Tests**: Full user workflow testing with Playwright
- **95% coverage requirement**

## 📁 Archive

Historical documentation has been moved to the `old/` directory to maintain a clean, focused documentation structure while preserving historical context.

## 🤝 Contributing

When contributing to the documentation:

1. **Update existing documents** rather than creating new ones
2. **Follow the established structure** and formatting
3. **Keep content focused** and actionable
4. **Include examples** where appropriate
5. **Update this README** if adding new documentation

## 📞 Support

For questions about the documentation or platform:

1. Check the relevant guide first
2. Review the **[Development Guide](./development_guide.md)** for technical issues
3. Consult the **[API Reference](./api_reference.md)** for integration questions

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Platform**: Pathology Bites Question Bank
