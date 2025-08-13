-- LEARNING MODULES SYSTEM SCHEMA
-- Building on existing categories, images, and quiz infrastructure

-- ============================================================================
-- LEARNING MODULES SYSTEM
-- ============================================================================

-- Main learning modules table with hierarchical structure
CREATE TABLE learning_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Hierarchical structure (for submodules and sub-submodules)
    parent_module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
    
    -- Integration with existing category system
    category_id UUID NOT NULL REFERENCES categories(id),
    
    -- Basic module information
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description TEXT,
    content TEXT, -- Markdown/HTML content
    
    -- Module metadata
    learning_objectives TEXT[],
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
    estimated_duration_minutes INTEGER DEFAULT 15,
    sort_order INTEGER DEFAULT 0,
    
    -- Content storage options
    content_type VARCHAR(20) CHECK (content_type IN ('text', 'video', 'interactive', 'mixed')) DEFAULT 'text',
    external_content_url TEXT, -- For videos, external resources
    
    -- Integration points
    quiz_id UUID, -- References your existing quiz system
    
    -- Publishing and status
    status VARCHAR(20) CHECK (status IN ('draft', 'review', 'published', 'archived')) DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    
    -- Authoring
    created_by UUID REFERENCES auth.users(id),
    reviewed_by UUID REFERENCES auth.users(id),
    
    -- Analytics fields
    view_count INTEGER DEFAULT 0,
    average_completion_time_minutes INTEGER,
    average_rating DECIMAL(3,2),
    rating_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(parent_module_id, slug),
    -- Root modules must be unique by category
    UNIQUE(category_id, slug) WHERE parent_module_id IS NULL
);

-- Learning paths for curated sequences
CREATE TABLE learning_paths (
    id SERIAL PRIMARY KEY, -- Using number ID as requested
    
    -- Basic path information
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    
    -- Path metadata
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_total_duration_minutes INTEGER,
    learning_objectives TEXT[],
    prerequisites TEXT[],
    target_audience TEXT,
    
    -- Visual and categorization
    thumbnail_image_id UUID REFERENCES images(id),
    category_id UUID REFERENCES categories(id),
    tags TEXT[],
    
    -- Publishing
    status VARCHAR(20) CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    
    -- Analytics
    enrollment_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    rating_count INTEGER DEFAULT 0,
    
    -- Authoring
    created_by UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for modules in learning paths
CREATE TABLE learning_path_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_path_id INTEGER REFERENCES learning_paths(id) ON DELETE CASCADE,
    module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
    
    -- Sequencing
    sort_order INTEGER NOT NULL,
    
    -- Module requirements within path
    is_required BOOLEAN DEFAULT true,
    unlock_criteria JSONB, -- Prerequisites, minimum scores, etc.
    
    -- Path-specific overrides
    custom_description TEXT,
    estimated_duration_override INTEGER, -- Override module's default duration
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(learning_path_id, module_id),
    UNIQUE(learning_path_id, sort_order)
);

-- User enrollment in learning paths
CREATE TABLE user_learning_path_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    learning_path_id INTEGER REFERENCES learning_paths(id) ON DELETE CASCADE,
    
    -- Enrollment status
    status VARCHAR(20) CHECK (status IN ('active', 'completed', 'paused', 'dropped')) DEFAULT 'active',
    
    -- Progress tracking
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,
    
    -- Current position
    current_module_id UUID REFERENCES learning_modules(id),
    modules_completed INTEGER DEFAULT 0,
    total_modules INTEGER, -- Snapshot at enrollment time
    progress_percentage INTEGER DEFAULT 0,
    
    -- Performance metrics
    total_time_minutes INTEGER DEFAULT 0,
    average_score DECIMAL(5,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, learning_path_id)
);

-- ============================================================================
-- MODULE TRACKING SYSTEM (Separate from Quiz System)
-- ============================================================================

-- Individual module sessions (each time a user opens a module)
CREATE TABLE module_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
    
    -- Session tracking
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    
    -- Progress within session
    sections_viewed TEXT[], -- Track which sections were viewed
    completion_percentage INTEGER DEFAULT 0,
    
    -- Context
    accessed_via VARCHAR(20) CHECK (accessed_via IN ('learning_path', 'direct', 'search', 'recommendation')) DEFAULT 'direct',
    learning_path_id INTEGER REFERENCES learning_paths(id), -- If accessed via path
    
    -- Device/browser info for analytics
    user_agent TEXT,
    ip_address INET,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Module completion attempts (formal completion with assessment)
CREATE TABLE module_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
    
    -- Attempt tracking
    attempt_number INTEGER DEFAULT 1,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Performance
    time_spent_minutes INTEGER,
    completion_status VARCHAR(20) CHECK (completion_status IN ('in_progress', 'completed', 'failed', 'abandoned')) DEFAULT 'in_progress',
    
    -- Assessment results (separate from quiz system)
    assessment_score DECIMAL(5,2), -- Overall module score
    quiz_attempt_id UUID, -- Reference to your existing quiz system if quiz was taken
    
    -- Self-assessment and feedback
    self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 5),
    confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
    feedback TEXT,
    found_helpful BOOLEAN,
    
    -- Context
    learning_path_id INTEGER REFERENCES learning_paths(id),
    prerequisite_check_passed BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONTENT RELATIONSHIPS (Leveraging Existing Images Table)
-- ============================================================================

-- Junction table for module-image relationships
CREATE TABLE module_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id),
    
    -- Image context within module
    usage_type VARCHAR(20) CHECK (usage_type IN ('header', 'content', 'diagram', 'example', 'thumbnail')) DEFAULT 'content',
    sort_order INTEGER DEFAULT 0,
    caption TEXT,
    alt_text TEXT,
    
    -- Position in content
    content_section VARCHAR(100), -- Which section of the module
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(module_id, image_id, usage_type)
);

-- Module prerequisites (for complex dependency chains)
CREATE TABLE module_prerequisites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
    prerequisite_module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
    
    -- Requirement details
    requirement_type VARCHAR(20) CHECK (requirement_type IN ('required', 'recommended', 'optional')) DEFAULT 'required',
    minimum_score INTEGER, -- Minimum score needed in prerequisite
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(module_id, prerequisite_module_id),
    CHECK (module_id != prerequisite_module_id) -- No self-references
);
