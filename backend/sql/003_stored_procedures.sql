-- Loan Eligibility Engine - Stored Procedures
-- Version: 1.0.0
-- High-performance matching using PostgreSQL range types

-- =====================================================
-- MERGE STAGING TO USERS
-- =====================================================

CREATE OR REPLACE FUNCTION merge_staging_to_users(p_job_id UUID)
RETURNS TABLE (
    inserted INTEGER,
    updated INTEGER,
    skipped INTEGER
) AS $$
DECLARE
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
    v_skipped INTEGER := 0;
BEGIN
    -- Insert/Update users from staging
    WITH upserted AS (
        INSERT INTO users (user_id, name, email, monthly_income, credit_score, employment_status, age, batch_id)
        SELECT user_id::UUID, name, email, monthly_income, credit_score, employment_status, age, job_id
        FROM users_staging
        WHERE job_id = p_job_id AND is_valid = TRUE
        ON CONFLICT (user_id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            monthly_income = EXCLUDED.monthly_income,
            credit_score = EXCLUDED.credit_score,
            employment_status = EXCLUDED.employment_status,
            age = EXCLUDED.age,
            batch_id = EXCLUDED.batch_id,
            updated_at = CURRENT_TIMESTAMP
        RETURNING user_id
    )
    SELECT COUNT(*) INTO v_inserted FROM upserted;

    -- Count skipped (invalid rows)
    SELECT COUNT(*) INTO v_skipped
    FROM users_staging
    WHERE job_id = p_job_id AND is_valid = FALSE;

    RETURN QUERY SELECT v_inserted, v_updated, v_skipped;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HIGH-PERFORMANCE MATCHING PROCEDURE
-- Uses range types for O(log n) lookups with GiST indexes
-- =====================================================

CREATE OR REPLACE FUNCTION match_new_users(p_batch_id UUID)
RETURNS TABLE (
    matches_created INTEGER,
    users_processed INTEGER,
    llm_candidates INTEGER
) AS $$
DECLARE
    v_matches_created INTEGER := 0;
    v_users_processed INTEGER := 0;
    v_llm_candidates INTEGER := 0;
BEGIN
    -- Stage 1: SQL Pre-filter with range containment operators
    -- This is extremely fast due to GiST indexes on range columns
    INSERT INTO user_product_matches (
        user_id, product_id, batch_id,
        income_fit_score, credit_fit_score, profile_fit_score,
        match_score, match_reason
    )
    SELECT
        u.user_id,
        p.product_id,
        p_batch_id,
        -- Income fit score (0-100): how well user's income fits the range
        LEAST(100, GREATEST(0,
            CASE
                WHEN upper(p.income_range) IS NULL THEN 100
                WHEN u.monthly_income >= (lower(p.income_range) + COALESCE(upper(p.income_range), lower(p.income_range) * 2)) / 2
                THEN 100.0
                ELSE ((u.monthly_income - lower(p.income_range))::DECIMAL /
                     NULLIF((COALESCE(upper(p.income_range), lower(p.income_range) * 2) - lower(p.income_range)) / 2, 0)) * 100
            END
        )) AS income_fit,
        -- Credit fit score (0-100)
        LEAST(100, GREATEST(0,
            CASE
                WHEN u.credit_score >= (lower(p.credit_range) + upper(p.credit_range)) / 2
                THEN 100.0
                ELSE ((u.credit_score - lower(p.credit_range))::DECIMAL /
                     NULLIF((upper(p.credit_range) - lower(p.credit_range)) / 2, 0)) * 100
            END
        )) AS credit_fit,
        -- Profile fit score (employment + age match)
        CASE
            WHEN u.employment_status = ANY(p.employment_types) THEN 100.0
            ELSE 50.0
        END AS profile_fit,
        -- Combined weighted score
        (
            0.35 * LEAST(100, GREATEST(0,
                CASE
                    WHEN upper(p.income_range) IS NULL THEN 100
                    WHEN u.monthly_income >= (lower(p.income_range) + COALESCE(upper(p.income_range), lower(p.income_range) * 2)) / 2
                    THEN 100.0
                    ELSE ((u.monthly_income - lower(p.income_range))::DECIMAL /
                         NULLIF((COALESCE(upper(p.income_range), lower(p.income_range) * 2) - lower(p.income_range)) / 2, 0)) * 100
                END
            )) +
            0.35 * LEAST(100, GREATEST(0,
                CASE
                    WHEN u.credit_score >= (lower(p.credit_range) + upper(p.credit_range)) / 2
                    THEN 100.0
                    ELSE ((u.credit_score - lower(p.credit_range))::DECIMAL /
                         NULLIF((upper(p.credit_range) - lower(p.credit_range)) / 2, 0)) * 100
                END
            )) +
            0.20 * CASE WHEN u.employment_status = ANY(p.employment_types) THEN 100.0 ELSE 50.0 END +
            0.10 * 50  -- Default conditions score, updated by LLM if needed
        ) AS match_score,
        'SQL pre-filter match' AS match_reason
    FROM users u
    CROSS JOIN loan_products p
    WHERE u.batch_id = p_batch_id
      AND p.is_active = TRUE
      -- Range containment checks (uses GiST indexes)
      AND u.monthly_income <@ p.income_range
      AND u.credit_score <@ p.credit_range
      AND u.age <@ p.age_range
      AND u.employment_status = ANY(p.employment_types)
    ON CONFLICT (user_id, product_id) DO UPDATE SET
        match_score = EXCLUDED.match_score,
        income_fit_score = EXCLUDED.income_fit_score,
        credit_fit_score = EXCLUDED.credit_fit_score,
        profile_fit_score = EXCLUDED.profile_fit_score,
        batch_id = EXCLUDED.batch_id;

    GET DIAGNOSTICS v_matches_created = ROW_COUNT;

    -- Count users processed
    SELECT COUNT(DISTINCT user_id) INTO v_users_processed
    FROM users WHERE batch_id = p_batch_id;

    -- Count matches needing LLM evaluation (products with special conditions)
    SELECT COUNT(*) INTO v_llm_candidates
    FROM user_product_matches m
    JOIN loan_products p ON m.product_id = p.product_id
    WHERE m.batch_id = p_batch_id
      AND p.special_conditions IS NOT NULL
      AND p.special_conditions != '';

    RETURN QUERY SELECT v_matches_created, v_users_processed, v_llm_candidates;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GET MATCHES FOR NOTIFICATION
-- =====================================================

CREATE OR REPLACE FUNCTION get_matches_for_notification(p_batch_id UUID)
RETURNS TABLE (
    user_id UUID,
    user_name VARCHAR,
    user_email VARCHAR,
    product_id UUID,
    provider_name VARCHAR,
    product_name VARCHAR,
    interest_rate_min DECIMAL,
    interest_rate_max DECIMAL,
    loan_amount_min INTEGER,
    loan_amount_max INTEGER,
    match_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.user_id,
        u.name AS user_name,
        u.email AS user_email,
        p.product_id,
        p.provider_name,
        p.product_name,
        p.interest_rate_min,
        p.interest_rate_max,
        p.loan_amount_min,
        p.loan_amount_max,
        m.match_score
    FROM user_product_matches m
    JOIN users u ON m.user_id = u.user_id
    JOIN loan_products p ON m.product_id = p.product_id
    WHERE m.batch_id = p_batch_id
      AND m.is_notified = FALSE
      AND m.match_score >= 60
    ORDER BY u.user_id, m.match_score DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MARK MATCHES AS NOTIFIED
-- =====================================================

CREATE OR REPLACE FUNCTION mark_matches_notified(p_user_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE user_product_matches
    SET is_notified = TRUE, notification_sent_at = CURRENT_TIMESTAMP
    WHERE user_id = ANY(p_user_ids) AND is_notified = FALSE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
