-- Loan Eligibility Engine - Database Schema
-- Version: 1.0.0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- INGESTION TRACKING
-- =====================================================

-- Track CSV upload jobs and their processing status
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    s3_key VARCHAR(512) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',
    -- Status flow: UPLOADED → VALIDATING → STAGING → LOADED → MATCHING_TRIGGERED → COMPLETED → FAILED
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    valid_rows INTEGER DEFAULT 0,
    invalid_rows INTEGER DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staging table for CSV imports (validation before merge)
CREATE TABLE IF NOT EXISTS users_staging (
    staging_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES ingestion_jobs(job_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    monthly_income INTEGER,
    credit_score INTEGER,
    employment_status VARCHAR(50),
    age INTEGER,
    is_valid BOOLEAN DEFAULT TRUE,
    validation_errors JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users table (main table populated from CSV)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    monthly_income INTEGER NOT NULL,
    credit_score INTEGER NOT NULL,
    employment_status VARCHAR(50) NOT NULL,
    age INTEGER NOT NULL,
    batch_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_monthly_income CHECK (monthly_income > 0),
    CONSTRAINT chk_credit_score CHECK (credit_score BETWEEN 300 AND 900),
    CONSTRAINT chk_age CHECK (age BETWEEN 18 AND 100),
    CONSTRAINT chk_employment_status CHECK (employment_status IN ('Salaried', 'Self-Employed', 'Business'))
);

-- Loan Products table (populated by n8n crawler)
CREATE TABLE IF NOT EXISTS loan_products (
    product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_name VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,

    -- Eligibility criteria using PostgreSQL range types
    income_range INT4RANGE NOT NULL,
    credit_range INT4RANGE NOT NULL,
    age_range INT4RANGE NOT NULL,
    employment_types TEXT[] NOT NULL,

    -- Loan details
    interest_rate_min DECIMAL(5,2),
    interest_rate_max DECIMAL(5,2),
    loan_amount_min INTEGER,
    loan_amount_max INTEGER,
    processing_fee_percent DECIMAL(5,2),
    tenure_months INTEGER[],

    -- Raw data preservation for resilience
    raw_criteria_text TEXT,
    raw_criteria_json JSONB,
    special_conditions TEXT,
    special_conditions_parsed JSONB,

    -- Crawler metadata
    source_url TEXT NOT NULL,
    source_hash VARCHAR(64),
    parser_version VARCHAR(20) DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT TRUE,

    last_crawled_at TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(provider_name, product_name)
);

-- =====================================================
-- CRAWLER HEALTH TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS crawl_runs (
    run_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_name VARCHAR(255) NOT NULL,
    site_url TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    products_found INTEGER DEFAULT 0,
    products_updated INTEGER DEFAULT 0,
    products_created INTEGER DEFAULT 0,
    extraction_strategy VARCHAR(50),
    error_message TEXT,
    error_sample JSONB,
    duration_ms INTEGER,
    run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- MATCHING TABLES
-- =====================================================

-- User-Product matches with scoring breakdown
CREATE TABLE IF NOT EXISTS user_product_matches (
    match_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    product_id UUID REFERENCES loan_products(product_id) ON DELETE CASCADE,
    batch_id UUID,

    -- Match scoring (weighted)
    match_score DECIMAL(5,2) NOT NULL,
    income_fit_score DECIMAL(5,2),
    credit_fit_score DECIMAL(5,2),
    profile_fit_score DECIMAL(5,2),
    conditions_fit_score DECIMAL(5,2),

    match_reason TEXT,
    match_details JSONB,

    -- Processing flags
    used_llm_evaluation BOOLEAN DEFAULT FALSE,
    is_notified BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, product_id)
);

-- =====================================================
-- NOTIFICATION TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_log (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(512),
    products_included UUID[],
    status VARCHAR(50) NOT NULL,
    ses_message_id VARCHAR(255),
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
