# Storage Capacity Analysis

This document analyzes the storage requirements and capacity limits for the Pathology Bites database on Supabase's free tier (500MB limit).

## 📊 **Storage Breakdown by Table**

### **🎯 Core Question Data**

| Component | Size per Question | Notes |
|-----------|------------------|-------|
| **Questions table** | ~3KB | Includes search_vector (~1KB) |
| **Question options** | ~1KB | 5 options × 200 bytes each |
| **Question images** | ~200 bytes | Metadata only, images stored separately |
| **Question analytics** | ~500 bytes | All performance metrics |
| **Question versions** | ~15KB | Average 3 versions × 5KB each |
| **Tags/Categories** | ~100 bytes | Average 3 tags per question |
| **Reviews/Flags** | ~30 bytes | Estimate 0.1 per question |
| **Total per question** | **~20KB** | |

### **👥 User Data**

| Component | Size per Active User | Notes |
|-----------|---------------------|-------|
| **Users table** | ~1KB | Profile and auth metadata |
| **Quiz sessions** | ~5KB | Average 10 sessions × 500 bytes |
| **Quiz attempts** | ~40KB | Average 200 attempts × 200 bytes |
| **Total per active user** | **~46KB** | |

### **🔍 Supporting Data**

| Component | Estimated Size | Notes |
|-----------|---------------|-------|
| **Categories** | ~5KB | 31 categories × 150 bytes |
| **Tags** | ~10KB | 500 tags × 20 bytes |
| **Sets** | ~2KB | 10 sets × 200 bytes |
| **Images metadata** | Variable | ~200 bytes per image |
| **Database overhead** | ~50MB | Indexes, constraints, system tables |

## 📈 **Capacity Scenarios**

### **Scenario 1: Balanced Platform (Recommended)**
```
Target: 15,000 questions, 3,000 active users

Questions: 15,000 × 20KB = 300MB
Users: 3,000 × 46KB = 138MB
Overhead & Indexes: ~50MB
Total: ~488MB ✅ (within 500MB limit)
```

### **Scenario 2: Question-Heavy Platform**
```
Target: 20,000 questions, 2,000 active users

Questions: 20,000 × 20KB = 400MB
Users: 2,000 × 46KB = 92MB
Overhead & Indexes: ~50MB
Total: ~542MB ❌ (exceeds limit by 42MB)
```

### **Scenario 3: User-Heavy Platform**
```
Target: 10,000 questions, 5,000 active users

Questions: 10,000 × 20KB = 200MB
Users: 5,000 × 46KB = 230MB
Overhead & Indexes: ~50MB
Total: ~480MB ✅ (within limit)
```

## 🎯 **Realistic Capacity Estimates**

### **Conservative Estimate (Recommended for Launch)**
- **12,000-15,000 questions**
- **2,500-3,000 active users**
- **50,000+ total quiz attempts**
- **Storage usage: 400-488MB**

### **Optimistic Estimate (With Optimizations)**
- **18,000-20,000 questions**
- **2,000-2,500 active users**
- **40,000+ total quiz attempts**
- **Storage usage: 450-500MB**

## 🔧 **Storage Optimization Strategies**

### **1. Question Versions Cleanup**
```sql
-- Keep only last 2 versions per question
DELETE FROM question_versions 
WHERE version_number < (
  SELECT MAX(version_number) - 1 
  FROM question_versions v2 
  WHERE v2.question_id = question_versions.question_id
);
```
**Potential Savings: ~10KB per question = 150MB for 15K questions**

### **2. Old Quiz Data Archival**
```sql
-- Archive quiz attempts older than 1 year
DELETE FROM quiz_attempts 
WHERE attempted_at < NOW() - INTERVAL '1 year';
```
**Potential Savings: ~30KB per user = 90MB for 3K users**

### **3. Analytics Data Compression**
- Store time intervals as integers (seconds) instead of PostgreSQL intervals
- Use smaller numeric precision for calculated metrics
- Compress JSON data in question_versions

**Potential Savings: ~200 bytes per question = 3MB for 15K questions**

### **4. Image Optimization**
- Use external CDN for image storage (images don't count toward DB limit)
- Store only essential metadata in database
- Implement image compression and optimization

**Potential Savings: Database images don't count, but metadata optimization saves ~100 bytes per question**

## 📊 **Storage Monitoring**

### **Database Size Query**
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### **Record Count Query**
```sql
SELECT 
  'questions' as table_name, COUNT(*) as records FROM questions
UNION ALL
SELECT 'question_options', COUNT(*) FROM question_options
UNION ALL
SELECT 'question_analytics', COUNT(*) FROM question_analytics
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'quiz_attempts', COUNT(*) FROM quiz_attempts
UNION ALL
SELECT 'quiz_sessions', COUNT(*) FROM quiz_sessions
UNION ALL
SELECT 'question_versions', COUNT(*) FROM question_versions
ORDER BY records DESC;
```

### **Storage Efficiency Query**
```sql
-- Average storage per question
SELECT 
  COUNT(q.id) as total_questions,
  COUNT(qo.id) as total_options,
  COUNT(qa.id) as total_attempts,
  pg_size_pretty(pg_database_size(current_database())) as total_db_size
FROM questions q
LEFT JOIN question_options qo ON q.id = qo.question_id
LEFT JOIN quiz_attempts qa ON q.id = qa.question_id;
```

## 🚀 **Scaling Strategy**

### **Phase 1: Free Tier (0-500MB)**
- **Target**: 12,000 questions, 2,500 users
- **Focus**: High-quality content curation
- **Strategy**: Implement cleanup routines, monitor growth
- **Timeline**: Launch to 1,000 active users

### **Phase 2: Pro Tier ($25/month for 8GB)**
- **Target**: 100,000+ questions, 25,000+ users
- **Focus**: Full analytics retention, advanced features
- **Strategy**: Expand content library, add institutions
- **Timeline**: Scale to 10,000 active users

### **Phase 3: Team Tier ($125/month for 100GB)**
- **Target**: 500,000+ questions, 100,000+ users
- **Focus**: Enterprise scale, multi-institutional support
- **Strategy**: Full data retention, advanced analytics
- **Timeline**: National/international expansion

## ⚠️ **Monitoring Alerts**

### **Storage Thresholds**
- **300MB (60%)**: Start monitoring growth rate
- **400MB (80%)**: Implement cleanup routines
- **450MB (90%)**: Consider optimization strategies
- **475MB (95%)**: Plan upgrade or aggressive cleanup

### **Growth Rate Monitoring**
```sql
-- Track weekly growth (run weekly)
CREATE TABLE storage_metrics (
  recorded_at timestamp DEFAULT now(),
  total_questions integer,
  total_users integer,
  total_attempts integer,
  database_size_bytes bigint
);

-- Insert current metrics
INSERT INTO storage_metrics (total_questions, total_users, total_attempts, database_size_bytes)
SELECT 
  (SELECT COUNT(*) FROM questions),
  (SELECT COUNT(*) FROM users),
  (SELECT COUNT(*) FROM quiz_attempts),
  pg_database_size(current_database());
```

## 💡 **Recommendations**

### **For Launch (Free Tier)**
1. **Target 12,000 questions initially** - Provides substantial content while staying well within limits
2. **Focus on quality over quantity** - Curate high-value questions for maximum educational impact
3. **Implement automated cleanup** - Set up monthly cleanup of old versions and attempts
4. **Monitor weekly** - Track storage usage and growth patterns
5. **Plan upgrade path** - Set clear metrics for when to upgrade to Pro tier

### **Content Strategy**
- **Prioritize high-yield topics** - Focus on frequently tested pathology concepts
- **Optimize question versions** - Limit to 2-3 versions per question
- **Efficient image usage** - Use external CDN, optimize metadata storage
- **Smart analytics retention** - Keep detailed analytics for active questions only

### **Technical Implementation**
- **Automated monitoring** - Set up alerts at storage thresholds
- **Cleanup automation** - Schedule monthly maintenance tasks
- **Performance optimization** - Regular index maintenance and query optimization
- **Backup strategy** - Regular exports before cleanup operations

## 📋 **Action Items**

- [ ] Implement storage monitoring dashboard
- [ ] Set up automated cleanup routines
- [ ] Create storage alert system
- [ ] Document upgrade decision criteria
- [ ] Plan content curation strategy
- [ ] Implement growth tracking metrics

**Bottom Line**: The current database structure can comfortably support **12,000-15,000 high-quality questions** with **2,500-3,000 active users** within the 500MB Supabase free tier limit. This provides an excellent foundation for launching a successful pathology education platform.
