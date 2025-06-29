# Database Performance Guide

This document outlines the database performance optimizations implemented in Pathology Bites and guidelines for maintaining optimal performance.

## 📊 Performance Optimizations

### Database Indexes

Strategic indexes have been implemented to optimize common query patterns:

#### Questions Table Indexes

```sql
-- User activity queries (admin dashboard)
CREATE INDEX idx_questions_user_status_date 
ON questions(created_by, status, created_at DESC);

-- Quiz generation queries (difficulty-based selection)
CREATE INDEX idx_questions_difficulty_status 
ON questions(difficulty, status) 
WHERE status = 'published';

-- Full-text search index
CREATE INDEX idx_questions_search 
ON questions USING gin(search_vector);
```

#### User Activity Indexes

```sql
-- User dashboard queries
CREATE INDEX idx_quiz_sessions_user_date 
ON quiz_sessions(user_id, created_at DESC);

-- Quiz attempt tracking
CREATE INDEX idx_quiz_attempts_session_question 
ON quiz_attempts(quiz_session_id, question_id);
```

#### Admin Review Indexes

```sql
-- Question flag management
CREATE INDEX idx_question_flags_status_date 
ON question_flags(status, created_at DESC);

-- Question review history
CREATE INDEX idx_question_reviews_question_date 
ON question_reviews(question_id, created_at DESC);
```

### Full-Text Search

#### Implementation

Full-text search is implemented using PostgreSQL's built-in text search capabilities:

```sql
-- Search vector column
ALTER TABLE questions ADD COLUMN search_vector tsvector;

-- Automatic search vector updates
CREATE OR REPLACE FUNCTION update_questions_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.stem, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.teaching_point, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic updates
CREATE TRIGGER questions_search_update_trigger
  BEFORE INSERT OR UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_questions_search_vector();
```

#### Usage in Application

```typescript
// Search questions using full-text search
const { data: questions } = await supabase
  .from('questions')
  .select('*')
  .textSearch('search_vector', searchTerm)
  .eq('status', 'published')
  .order('created_at', { ascending: false })
```

#### Search Ranking

Search results are ranked by relevance:
- **Title matches**: Weight 'A' (highest priority)
- **Stem content**: Weight 'B' (medium priority)  
- **Teaching points**: Weight 'C' (lower priority)

### Materialized Views

#### Dashboard Statistics

A materialized view provides fast access to dashboard statistics:

```sql
CREATE MATERIALIZED VIEW dashboard_stats AS
WITH question_stats AS (
  SELECT 
    COUNT(*) FILTER (WHERE status = 'published') as published_questions,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_questions,
    COUNT(*) FILTER (WHERE status = 'flagged') as flagged_questions,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_questions
  FROM questions
),
user_stats AS (
  SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as recent_users
  FROM users
),
other_stats AS (
  SELECT 
    (SELECT COUNT(*) FROM images) as total_images,
    (SELECT COUNT(*) FROM quiz_sessions) as total_quiz_sessions,
    (SELECT COUNT(*) FROM quiz_sessions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_quiz_sessions,
    (SELECT COUNT(*) FROM inquiries) as total_inquiries,
    (SELECT COUNT(*) FROM question_reports) as question_reports,
    (SELECT COUNT(*) FROM question_reports WHERE status = 'pending') as pending_reports
)
SELECT 
  q.*,
  u.*,
  o.*,
  NOW() as last_updated
FROM question_stats q, user_stats u, other_stats o;
```

#### Refreshing Materialized Views

```sql
-- Manual refresh
REFRESH MATERIALIZED VIEW dashboard_stats;

-- Automated refresh function
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;
```

## 🚀 Query Optimization Guidelines

### Best Practices

#### 1. Use Appropriate Indexes

```typescript
// ✅ Good: Uses idx_questions_user_status_date
const userQuestions = await supabase
  .from('questions')
  .select('*')
  .eq('created_by', userId)
  .eq('status', 'published')
  .order('created_at', { ascending: false })

// ❌ Avoid: Full table scan
const allQuestions = await supabase
  .from('questions')
  .select('*')
  .order('random()') // This forces a full table scan
```

#### 2. Limit Result Sets

```typescript
// ✅ Good: Paginated results
const questions = await supabase
  .from('questions')
  .select('*')
  .range(0, 19) // Limit to 20 results
  .order('created_at', { ascending: false })

// ❌ Avoid: Unlimited results
const allQuestions = await supabase
  .from('questions')
  .select('*') // Could return thousands of records
```

#### 3. Use Selective Queries

```typescript
// ✅ Good: Select only needed columns
const questionTitles = await supabase
  .from('questions')
  .select('id, title, created_at')
  .eq('status', 'published')

// ❌ Avoid: Select all columns when not needed
const questions = await supabase
  .from('questions')
  .select('*') // Includes large text fields unnecessarily
```

### Query Performance Monitoring

#### Using EXPLAIN

```sql
-- Analyze query performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM questions 
WHERE status = 'published' 
AND difficulty = 'intermediate'
ORDER BY created_at DESC 
LIMIT 20;
```

#### Key Metrics to Monitor

- **Execution Time**: Should be < 100ms for most queries
- **Index Usage**: Queries should use indexes, not sequential scans
- **Buffer Usage**: Monitor shared buffer hits vs reads

## 📈 Performance Monitoring

### Database Metrics

Monitor these key performance indicators:

#### Query Performance
- Average query execution time
- Slow query log (queries > 1 second)
- Index hit ratio (should be > 95%)
- Cache hit ratio (should be > 90%)

#### Resource Usage
- CPU utilization
- Memory usage
- Disk I/O
- Connection count

### Application-Level Monitoring

#### Supabase Dashboard
- Query performance metrics
- Real-time database activity
- Connection pooling status
- Storage usage

#### Custom Monitoring

```typescript
// Example: Query performance logging
const startTime = Date.now()
const result = await supabase.from('questions').select('*')
const duration = Date.now() - startTime

if (duration > 1000) {
  console.warn(`Slow query detected: ${duration}ms`)
}
```

## 🔧 Maintenance Tasks

### Regular Maintenance

#### Weekly
- [ ] Review slow query log
- [ ] Check index usage statistics
- [ ] Monitor database size growth

#### Monthly
- [ ] Refresh materialized views
- [ ] Analyze table statistics
- [ ] Review and optimize slow queries

#### Quarterly
- [ ] Full database performance review
- [ ] Index optimization analysis
- [ ] Capacity planning assessment

### Performance Troubleshooting

#### Common Issues

1. **Slow Queries**
   - Check if appropriate indexes exist
   - Verify query is using indexes (EXPLAIN)
   - Consider query rewriting

2. **High CPU Usage**
   - Identify expensive queries
   - Check for missing indexes
   - Review concurrent query load

3. **Memory Issues**
   - Monitor connection count
   - Check for memory leaks in application
   - Review query complexity

## 📋 Performance Checklist

### Development
- [ ] Use indexes for WHERE clauses
- [ ] Limit result sets with pagination
- [ ] Select only needed columns
- [ ] Test queries with realistic data volumes

### Production
- [ ] Monitor query performance
- [ ] Set up slow query alerts
- [ ] Regular materialized view refresh
- [ ] Database backup and recovery testing

## 🔗 Related Documentation

- [Security Guide](SECURITY_GUIDE.md) - Database security measures
- [Developer Setup](DEVELOPER_SETUP.md) - Local database setup
- [API Documentation](../features/api-documentation.md) - Query patterns
