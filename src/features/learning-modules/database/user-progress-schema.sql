-- User Progress Tracking Table (Simple Version)
-- This should be added to the main database schema

CREATE TABLE user_module_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module_id VARCHAR(100) NOT NULL, -- Reference to module ID from our static data
    
    -- Progress tracking
    status VARCHAR(20) CHECK (status IN ('available', 'in_progress', 'completed', 'locked')) DEFAULT 'available',
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Performance data
    score INTEGER CHECK (score >= 0 AND score <= 100),
    time_spent_minutes INTEGER DEFAULT 0,
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, module_id)
);

-- Indexes for performance
CREATE INDEX idx_user_module_progress_user_id ON user_module_progress(user_id);
CREATE INDEX idx_user_module_progress_module_id ON user_module_progress(module_id);
CREATE INDEX idx_user_module_progress_status ON user_module_progress(status);

-- RLS Policies
ALTER TABLE user_module_progress ENABLE ROW LEVEL SECURITY;

-- Users can only access their own progress
CREATE POLICY "Users can view their own progress" ON user_module_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON user_module_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify their own progress" ON user_module_progress
    FOR UPDATE USING (auth.uid() = user_id);

-- Function to update last_accessed_at and updated_at
CREATE OR REPLACE FUNCTION update_user_module_progress_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_module_progress_timestamps
    BEFORE UPDATE ON user_module_progress
    FOR EACH ROW EXECUTE FUNCTION update_user_module_progress_timestamps();