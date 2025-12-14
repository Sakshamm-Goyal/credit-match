-- Loan Eligibility Engine - Performance Indexes
-- Version: 1.0.0

-- =====================================================
-- USER INDEXES
-- =====================================================

-- Composite index for eligibility queries
CREATE INDEX IF NOT EXISTS idx_users_eligibility
ON users(monthly_income, credit_score, age, employment_status);

-- Batch tracking
CREATE INDEX IF NOT EXISTS idx_users_batch ON users(batch_id);

-- Email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================================================
-- LOAN PRODUCTS INDEXES (GiST for range types)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_products_income_range
ON loan_products USING GIST (income_range);

CREATE INDEX IF NOT EXISTS idx_products_credit_range
ON loan_products USING GIST (credit_range);

CREATE INDEX IF NOT EXISTS idx_products_age_range
ON loan_products USING GIST (age_range);

-- Partial index for active products only
CREATE INDEX IF NOT EXISTS idx_products_active
ON loan_products(is_active) WHERE is_active = TRUE;

-- Partial index for products with special conditions (LLM candidates)
CREATE INDEX IF NOT EXISTS idx_products_special_conditions
ON loan_products(product_id)
WHERE special_conditions IS NOT NULL AND special_conditions != '';

-- =====================================================
-- MATCH INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_matches_user ON user_product_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_batch ON user_product_matches(batch_id);
CREATE INDEX IF NOT EXISTS idx_matches_product ON user_product_matches(product_id);

-- Partial index for unnotified matches
CREATE INDEX IF NOT EXISTS idx_matches_unnotified
ON user_product_matches(user_id, is_notified)
WHERE is_notified = FALSE;

-- =====================================================
-- JOB TRACKING INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_jobs_status ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON ingestion_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staging_job ON users_staging(job_id);

-- =====================================================
-- NOTIFICATION INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_notification_user ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_status ON notification_log(status);
