# Pathology Bites

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A modern question bank application for Pathology education, built with Next.js 15 and Supabase.

## Table of Contents
- [Project Overview](#project-overview)
- [Core Goals](#core-goals)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Database Schema](#database-schema)
- [Development Setup](#development-setup)
- [Deployment](#deployment)
- [Performance Optimization](#performance-optimization)
- [Future Roadmap](#future-roadmap)

## Project Overview
A responsive web application designed to:
- Provide a curated question bank for pathology education
- Support multiple quiz modes (Test, Tutor, Study)
- Track user progress with detailed analytics
- Enable easy content management for admins
- Prepare for future React Native (Expo) mobile implementation

## Core Goals
1. **Performance**: Sub-100ms API responses, <3s LCP
2. **Scalability**: Support 10k+ concurrent users
3. **Maintainability**: Strict TypeScript enforcement, 90%+ test coverage
4. **Accessibility**: WCAG 2.1 AA compliance
5. **Security**: Zero client-side secrets, RLS enforcement

## Features
| Module          | Key Functionality                              |
|-----------------|------------------------------------------------|
| Authentication  | Magic links, OAuth, Role-based access          |
| Question Bank   | Advanced filters, Full-text search, Bookmarks  |
| Quiz Engine     | Timed tests, Answer explanations, Progress save|
| Analytics       | Performance trends, Peer comparison, Weak areas|
| Admin Portal    | Content moderation, User management, Analytics |

## Tech Stack

### Frontend
| Category        | Technologies                                  |
|-----------------|-----------------------------------------------|
| Framework       | Next.js 15 (App Router)                       |
| State Management| React-Query                         |
| UI Library      | shadcn/ui + Radix Primitives                  |
| Styling         | Tailwind CSS                                  |
| Form Handling   | React Hook Form + Zod                         |
| Testing         | Jest, React Testing Library, Cypress          |

### Backend
| Service         | Technologies                                  |
|-----------------|-----------------------------------------------|
| Database        | Supabase PostgreSQL                           |
| Auth            | Supabase Auth                                 |
| Storage         | Supabase Storage + CDN                        |
| Real-time       | Supabase Realtime                             |
| Server Logic    | Edge Functions, PostgreSQL RPCs               |
| Monitoring      | Supabase Logs, Sentry                         |

## Directory Structure
```
.
├── .next/                      # Next.js build output
├── node_modules/               # Project dependencies
├── public/                     # Static assets
│   ├── images/                 # Image assets
│   └── fonts/                  # Font files
├── src/
│   ├── app/                    # App router directory
│   │   ├── _actions/           # Custom actions
│   │   │   ├── questions.ts    # Question actions
│   │   │   └── users.ts        # User actions
│   │   ├── (admin)/           # Admin routes group
│   │   │   ├── analytics/      # Analytics dashboard
│   │   │   │   └── page.tsx    
│   │   │   ├── categories/     # Category management
│   │   │   │   ├── [id]/      # Category detail
│   │   │   │   └── page.tsx
│   │   │   ├── questions/      # Question management
│   │   │   │   ├── [id]/      # Question detail
│   │   │   │   └── page.tsx
│   │   │   ├── settings/       # Admin settings
│   │   │   │   └── page.tsx
│   │   │   └── users/         # User management
│   │   │       ├── [id]/      # User detail
│   │   │       └── page.tsx
│   │   ├── (auth)/           # Authentication routes
│   │   │   ├── login/        # Login page
│   │   │   │   └── page.tsx
│   │   │   ├── register/     # Registration page
│   │   │   │   └── page.tsx
│   │   │   └── reset/        # Password reset
│   │   │       └── page.tsx
│   │   ├── (dashboard)/      # Protected routes
│   │   │   ├── profile/      # User profile
│   │   │   │   └── page.tsx
│   │   │   ├── questions/    # Question bank
│   │   │   │   ├── [id]/    # Question detail
│   │   │   │   └── page.tsx
│   │   │   ├── quizzes/      # Quiz sessions
│   │   │   │   ├── [id]/    # Quiz detail
│   │   │   │   └── page.tsx
│   │   │   └── stats/        # User statistics
│   │   │       └── page.tsx
│   │   ├── (public)/         # Public routes
│   │   │   ├── about/        # About page
│   │   │   │   └── page.tsx
│   │   │   ├── contact/      # Contact page
│   │   │   │   └── page.tsx
│   │   │   ├── faq/          # FAQ page
│   │   │   │   └── page.tsx
│   │   │   ├── privacy/      # Privacy policy
│   │   │   │   └── page.tsx
│   │   │   └── terms/        # Terms of service
│   │   │       └── page.tsx
│   │   ├── error.tsx         # Error handling
│   │   ├── layout.tsx        # Root layout
│   │   ├── not-found.tsx     # 404 page
│   │   └── page.tsx          # Landing page
│   ├── components/           # Reusable components
│   │   ├── admin/           # Admin components
│   │   │   ├── CategoryForm.tsx
│   │   │   ├── QuestionForm.tsx
│   │   │   └── UserList.tsx
│   │   ├── auth/            # Auth components
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── dashboard/       # Dashboard components
│   │   │   ├── QuestionCard.tsx
│   │   │   └── StatsChart.tsx
│   │   ├── quiz/            # Quiz components
│   │   │   ├── QuizTimer.tsx
│   │   │   └── QuestionView.tsx
│   │   ├── shared/          # Shared components
│   │   │   ├── Header.tsx
│   │   │   └── Footer.tsx
│   │   └── ui/              # UI components
│   │       ├── Button.tsx
│   │       └── Input.tsx
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.ts
│   │   └── useQuiz.ts
│   ├── lib/                 # Utility functions
│   │   ├── supabase/        # Supabase utilities
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   └── utils/          
│   │       ├── formatting.ts
│   │       └── validation.ts
│   ├── styles/              # Global styles
│   │   └── globals.css      # Global styling sheet
│   └── middleware.ts        # Auth middleware
├── .env                     # Environment variables
├── .gitignore              # Git ignore file
├── next.config.js          # Next.js configuration
├── package.json            # Project dependencies
├── tailwind.config.js      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
└── README.md              # Project documentation
```
```

## Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Institutions Table
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    middle_initial CHAR(1),
    last_name VARCHAR(100),
    institution_id UUID REFERENCES institutions(id),
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'admin')),
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('student', 'resident', 'fellow', 'attending', 'other')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    level INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tags Table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Questions Table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    stem TEXT NOT NULL,
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    teaching_point TEXT NOT NULL,
    question_references TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_by UUID NOT NULL REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Answer Options Table
CREATE TABLE answer_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    explanation TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Images Table
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('gross', 'microscopic', 'diagram')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Question Images Junction Table
CREATE TABLE question_images (
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    question_section VARCHAR(20) NOT NULL CHECK (question_section IN ('stem', 'explanation')),
    order_index INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (question_id, image_id, question_section)
);

-- Question Categories Junction Table
CREATE TABLE question_categories (
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, category_id)
);

-- Question Tags Junction Table
CREATE TABLE question_tags (
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
);

-- Quiz Sessions Table
CREATE TABLE quiz_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    quiz_mode VARCHAR(20) NOT NULL CHECK (quiz_mode IN ('test', 'tutor', 'study')),
    status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Responses Table
CREATE TABLE user_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id),
    selected_option_id UUID NOT NULL REFERENCES answer_options(id),
    is_correct BOOLEAN NOT NULL,
    time_spent INTEGER NOT NULL, -- in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance Analytics Table
CREATE TABLE performance_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    category_id UUID REFERENCES categories(id),
    total_questions INTEGER NOT NULL DEFAULT 0,
    questions_answered INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    average_time INTEGER NOT NULL DEFAULT 0, -- in seconds
    peer_rank DECIMAL(5,2),
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_questions_status ON questions(status);
CREATE INDEX idx_user_responses_quiz_session ON user_responses(quiz_session_id);
CREATE INDEX idx_user_responses_question ON user_responses(question_id);
CREATE INDEX idx_performance_analytics_user ON performance_analytics(user_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_answer_options_question ON answer_options(question_id);
CREATE INDEX idx_question_images_question ON question_images(question_id);
CREATE INDEX idx_users_institution ON users(institution_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';