-- LEARNING MODULES SYSTEM - INDEXES, VIEWS, AND POLICIES

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Module discovery and navigation
CREATE INDEX idx_learning_modules_category_status ON learning_modules(category_id, status) WHERE status = 'published';
CREATE INDEX idx_learning_modules_parent_order ON learning_modules(parent_module_id, sort_order);
CREATE INDEX idx_learning_modules_featured ON learning_modules(is_featured, status) WHERE is_featured = true;

-- Learning path navigation
CREATE INDEX idx_learning_path_modules_path_order ON learning_path_modules(learning_path_id, sort_order);
CREATE INDEX idx_learning_paths_status_featured ON learning_paths(status, is_featured);

-- User progress tracking
CREATE INDEX idx_user_enrollments_user_status ON user_learning_path_enrollments(user_id, status);
CREATE INDEX idx_module_sessions_user_module ON module_sessions(user_id, module_id);
CREATE INDEX idx_module_attempts_user_module ON module_attempts(user_id, module_id);
CREATE INDEX idx_module_attempts_completion ON module_attempts(completion_status, completed_at);

-- Analytics queries
CREATE INDEX idx_modules_analytics ON learning_modules(view_count, average_rating) WHERE status = 'published';
CREATE INDEX idx_sessions_timeframe ON module_sessions(started_at, ended_at);

-- ============================================================================
-- USEFUL VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for complete module hierarchy
CREATE VIEW v_module_hierarchy AS
WITH RECURSIVE module_tree AS (
    -- Root modules
    SELECT 
        id, parent_module_id, title, slug, category_id, sort_order, 
        0 as level, 
        ARRAY[id] as path,
        title as full_path
    FROM learning_modules 
    WHERE parent_module_id IS NULL AND status = 'published'
    
    UNION ALL
    
    -- Child modules
    SELECT 
        m.id, m.parent_module_id, m.title, m.slug, m.category_id, m.sort_order,
        mt.level + 1,
        mt.path || m.id,
        mt.full_path || ' > ' || m.title
    FROM learning_modules m
    JOIN module_tree mt ON m.parent_module_id = mt.id
    WHERE m.status = 'published'
)
SELECT * FROM module_tree ORDER BY path;

-- View for user progress summary
CREATE VIEW v_user_progress_summary AS
SELECT 
    u.id as user_id,
    COUNT(DISTINCT ue.learning_path_id) as enrolled_paths,
    COUNT(DISTINCT CASE WHEN ue.status = 'completed' THEN ue.learning_path_id END) as completed_paths,
    COUNT(DISTINCT ma.module_id) as attempted_modules,
    COUNT(DISTINCT CASE WHEN ma.completion_status = 'completed' THEN ma.module_id END) as completed_modules,
    AVG(ma.assessment_score) as average_score,
    SUM(ma.time_spent_minutes) as total_study_time
FROM auth.users u
LEFT JOIN user_learning_path_enrollments ue ON u.id = ue.user_id
LEFT JOIN module_attempts ma ON u.id = ma.user_id
GROUP BY u.id;

-- View for learning path details with module count
CREATE VIEW v_learning_path_details AS
SELECT 
    lp.*,
    COUNT(lpm.module_id) as total_modules,
    COUNT(CASE WHEN lpm.is_required THEN 1 END) as required_modules,
    AVG(lm.estimated_duration_minutes) as avg_module_duration,
    c.name as category_name,
    i.url as thumbnail_url
FROM learning_paths lp
LEFT JOIN learning_path_modules lpm ON lp.id = lpm.learning_path_id
LEFT JOIN learning_modules lm ON lpm.module_id = lm.id
LEFT JOIN categories c ON lp.category_id = c.id
LEFT JOIN images i ON lp.thumbnail_image_id = i.id
GROUP BY lp.id, c.name, i.url;

-- View for module details with related data
CREATE VIEW v_module_details AS
SELECT 
    lm.*,
    c.name as category_name,
    c.color as category_color,
    COUNT(DISTINCT mi.image_id) as image_count,
    COUNT(DISTINCT child.id) as child_module_count,
    parent.title as parent_title,
    creator.email as created_by_email,
    reviewer.email as reviewed_by_email
FROM learning_modules lm
LEFT JOIN categories c ON lm.category_id = c.id
LEFT JOIN module_images mi ON lm.id = mi.module_id
LEFT JOIN learning_modules child ON lm.id = child.parent_module_id
LEFT JOIN learning_modules parent ON lm.parent_module_id = parent.id
LEFT JOIN auth.users creator ON lm.created_by = creator.id
LEFT JOIN auth.users reviewer ON lm.reviewed_by = reviewer.id
GROUP BY lm.id, c.name, c.color, parent.title, creator.email, reviewer.email;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_path_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_prerequisites ENABLE ROW LEVEL SECURITY;

-- Public content policies
CREATE POLICY "Published modules are readable by all" ON learning_modules
    FOR SELECT USING (status = 'published');

CREATE POLICY "Published learning paths are readable by all" ON learning_paths
    FOR SELECT USING (status = 'published');

CREATE POLICY "Learning path modules are readable by all" ON learning_path_modules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM learning_paths lp 
            WHERE lp.id = learning_path_modules.learning_path_id 
            AND lp.status = 'published'
        )
    );

CREATE POLICY "Module images are readable by all" ON module_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM learning_modules lm 
            WHERE lm.id = module_images.module_id 
            AND lm.status = 'published'
        )
    );

CREATE POLICY "Module prerequisites are readable by all" ON module_prerequisites
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM learning_modules lm 
            WHERE lm.id = module_prerequisites.module_id 
            AND lm.status = 'published'
        )
    );

-- User data policies
CREATE POLICY "Users can manage their own enrollments" ON user_learning_path_enrollments
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sessions" ON module_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own attempts" ON module_attempts
    FOR ALL USING (auth.uid() = user_id);

-- Admin policies (assuming you have admin roles)
CREATE POLICY "Admins can manage all content" ON learning_modules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage all learning paths" ON learning_paths
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage path modules" ON learning_path_modules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage module images" ON module_images
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage module prerequisites" ON module_prerequisites
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Content creators can manage their own content
CREATE POLICY "Content creators can manage their modules" ON learning_modules
    FOR ALL USING (
        auth.uid() = created_by OR 
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'content_creator')
        )
    );

CREATE POLICY "Content creators can manage their learning paths" ON learning_paths
    FOR ALL USING (
        auth.uid() = created_by OR 
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'content_creator')
        )
    );

-- ============================================================================
-- TRIGGERS FOR AUTOMATION
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_learning_modules_updated_at 
    BEFORE UPDATE ON learning_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_paths_updated_at 
    BEFORE UPDATE ON learning_paths
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_enrollments_updated_at 
    BEFORE UPDATE ON user_learning_path_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_module_attempts_updated_at 
    BEFORE UPDATE ON module_attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update enrollment progress
CREATE OR REPLACE FUNCTION update_enrollment_progress()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completion_status = 'completed' AND OLD.completion_status != 'completed' THEN
        UPDATE user_learning_path_enrollments 
        SET 
            modules_completed = modules_completed + 1,
            progress_percentage = LEAST(100, ROUND((modules_completed + 1) * 100.0 / total_modules)),
            last_accessed_at = NOW(),
            completed_at = CASE 
                WHEN (modules_completed + 1) >= total_modules THEN NOW() 
                ELSE completed_at 
            END,
            status = CASE 
                WHEN (modules_completed + 1) >= total_modules THEN 'completed' 
                ELSE status 
            END
        WHERE user_id = NEW.user_id 
        AND learning_path_id = NEW.learning_path_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_path_progress_trigger
    AFTER UPDATE ON module_attempts
    FOR EACH ROW EXECUTE FUNCTION update_enrollment_progress();

-- Update module view count
CREATE OR REPLACE FUNCTION increment_module_view_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE learning_modules 
    SET view_count = view_count + 1
    WHERE id = NEW.module_id;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER increment_view_count_trigger
    AFTER INSERT ON module_sessions
    FOR EACH ROW EXECUTE FUNCTION increment_module_view_count();
