import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection (connect to Docker container)
const pool = new pg.Pool({
  host: 'localhost',
  port: 5433,
  database: 'loan_eligibility',
  user: 'postgres',
  password: 'postgres123'
});

// Job statuses stored in memory for quick access
const jobStatuses = new Map();

// Upload initiator endpoint
app.post('/api/upload/initiate', (req, res) => {
  const { filename, file_size } = req.body;

  if (!filename || !filename.toLowerCase().endsWith('.csv')) {
    return res.status(400).json({ error: 'Only CSV files allowed' });
  }

  if (file_size > 50 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size exceeds 50MB limit' });
  }

  const jobId = crypto.randomUUID();

  // Initialize job status
  jobStatuses.set(jobId, {
    job_id: jobId,
    status: 'PENDING',
    total_rows: 0,
    processed_rows: 0,
    valid_rows: 0,
    invalid_rows: 0,
    matches_found: 0
  });

  res.json({
    job_id: jobId,
    upload_url: `http://localhost:3000/api/upload/${jobId}/${encodeURIComponent(filename)}`,
    s3_key: `uploads/${jobId}/${filename}`,
    expires_in: 900
  });
});

// Direct upload endpoint (simulates S3 pre-signed URL)
app.put('/api/upload/:jobId/:filename', express.raw({ type: 'text/csv', limit: '50mb' }), async (req, res) => {
  const { jobId, filename } = req.params;
  const csvContent = req.body.toString();

  try {
    // Save to local file
    const uploadDir = path.join(process.cwd(), 'test-uploads', jobId);
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, decodeURIComponent(filename)), csvContent);

    // Update status
    jobStatuses.set(jobId, {
      ...jobStatuses.get(jobId),
      status: 'UPLOADED'
    });

    // Process CSV asynchronously
    processCSV(jobId, csvContent);

    res.status(200).send();
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Job status endpoint
app.get('/api/jobs/:jobId/status', async (req, res) => {
  const { jobId } = req.params;

  // Try to get from database first
  try {
    const result = await pool.query(`
      SELECT
        j.job_id,
        j.status,
        j.total_rows,
        j.processed_rows,
        j.valid_rows,
        j.invalid_rows,
        j.error_message,
        COALESCE(m.match_count, 0) as matches_found
      FROM ingestion_jobs j
      LEFT JOIN (
        SELECT batch_id, COUNT(*) as match_count
        FROM user_product_matches
        GROUP BY batch_id
      ) m ON j.job_id = m.batch_id
      WHERE j.job_id = $1
    `, [jobId]);

    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Database query error:', error);
  }

  // Fall back to in-memory status
  const status = jobStatuses.get(jobId);
  if (status) {
    return res.json(status);
  }

  res.status(404).json({ error: 'Job not found' });
});

// CSV Processing function
async function processCSV(jobId, csvContent) {
  const client = await pool.connect();

  try {
    // Parse CSV
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV must have header and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['user_id', 'name', 'email', 'monthly_income', 'credit_score', 'employment_status', 'age'];
    const missing = requiredHeaders.filter(h => !headers.includes(h));

    if (missing.length > 0) {
      throw new Error(`Missing required columns: ${missing.join(', ')}`);
    }

    const totalRows = lines.length - 1;

    // Create job record
    await client.query(`
      INSERT INTO ingestion_jobs (job_id, s3_key, status, total_rows, started_at)
      VALUES ($1, $2, 'PARSING', $3, NOW())
      ON CONFLICT (job_id) DO UPDATE SET status = 'PARSING', started_at = NOW(), total_rows = $3
    `, [jobId, `uploads/${jobId}/data.csv`, totalRows]);

    jobStatuses.set(jobId, {
      job_id: jobId,
      status: 'PARSING',
      total_rows: totalRows,
      processed_rows: 0,
      valid_rows: 0,
      invalid_rows: 0
    });

    // Update to VALIDATING
    await client.query(`UPDATE ingestion_jobs SET status = 'VALIDATING' WHERE job_id = $1`, [jobId]);

    let validRows = 0;
    let invalidRows = 0;

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });

      // Validate row
      const errors = validateRow(row);
      const isValid = errors.length === 0;

      // Insert into staging
      await client.query(`
        INSERT INTO users_staging (job_id, user_id, name, email, monthly_income, credit_score, employment_status, age, is_valid, validation_errors)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        jobId,
        row.user_id,
        row.name,
        row.email,
        isValid ? parseInt(row.monthly_income) : null,
        isValid ? parseInt(row.credit_score) : null,
        row.employment_status,
        isValid ? parseInt(row.age) : null,
        isValid,
        errors.length > 0 ? JSON.stringify(errors) : null
      ]);

      if (isValid) validRows++;
      else invalidRows++;
    }

    // Update status
    await client.query(`
      UPDATE ingestion_jobs SET status = 'STAGING', valid_rows = $2, invalid_rows = $3 WHERE job_id = $1
    `, [jobId, validRows, invalidRows]);

    jobStatuses.set(jobId, {
      job_id: jobId,
      status: 'STAGING',
      total_rows: totalRows,
      processed_rows: totalRows,
      valid_rows: validRows,
      invalid_rows: invalidRows
    });

    // Merge staging to users
    const mergeResult = await client.query(`SELECT * FROM merge_staging_to_users($1)`, [jobId]);

    await client.query(`
      UPDATE ingestion_jobs SET status = 'LOADED', processed_rows = $2 WHERE job_id = $1
    `, [jobId, mergeResult.rows[0]?.inserted || 0]);

    // Run matching
    await client.query(`UPDATE ingestion_jobs SET status = 'MATCHING' WHERE job_id = $1`, [jobId]);

    jobStatuses.set(jobId, {
      ...jobStatuses.get(jobId),
      status: 'MATCHING'
    });

    const matchResult = await client.query(`SELECT * FROM match_new_users($1)`, [jobId]);
    const matchesCreated = matchResult.rows[0]?.matches_created || 0;

    // Update final status
    await client.query(`
      UPDATE ingestion_jobs SET status = 'COMPLETED', completed_at = NOW() WHERE job_id = $1
    `, [jobId]);

    jobStatuses.set(jobId, {
      job_id: jobId,
      status: 'COMPLETED',
      total_rows: totalRows,
      processed_rows: totalRows,
      valid_rows: validRows,
      invalid_rows: invalidRows,
      matches_found: matchesCreated
    });

    console.log(`Job ${jobId} completed: ${validRows} valid, ${invalidRows} invalid, ${matchesCreated} matches`);

  } catch (error) {
    console.error('Processing error:', error);

    await client.query(`
      UPDATE ingestion_jobs SET status = 'FAILED', error_message = $2, completed_at = NOW() WHERE job_id = $1
    `, [jobId, error.message]);

    jobStatuses.set(jobId, {
      ...jobStatuses.get(jobId),
      status: 'FAILED',
      error_message: error.message
    });
  } finally {
    client.release();
  }
}

// Validation function
function validateRow(row) {
  const errors = [];

  // Validate UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(row.user_id)) {
    errors.push('Invalid user_id format (must be UUID)');
  }

  // Validate income
  const income = parseInt(row.monthly_income);
  if (isNaN(income) || income <= 0) {
    errors.push('monthly_income must be a positive number');
  }

  // Validate credit score
  const creditScore = parseInt(row.credit_score);
  if (isNaN(creditScore) || creditScore < 300 || creditScore > 900) {
    errors.push('credit_score must be between 300 and 900');
  }

  // Validate age
  const age = parseInt(row.age);
  if (isNaN(age) || age < 18 || age > 100) {
    errors.push('age must be between 18 and 100');
  }

  // Validate employment status
  const validStatuses = ['Salaried', 'Self-Employed', 'Business'];
  if (!validStatuses.includes(row.employment_status)) {
    errors.push(`employment_status must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate email
  if (!row.email || !row.email.includes('@')) {
    errors.push('Invalid email format');
  }

  return errors;
}

// Get matches for a user
app.get('/api/users/:userId/matches', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        m.match_id,
        m.match_score,
        m.income_fit_score,
        m.credit_fit_score,
        m.profile_fit_score,
        p.provider_name,
        p.product_name,
        p.interest_rate_min,
        p.interest_rate_max,
        p.loan_amount_min,
        p.loan_amount_max,
        p.processing_fee_percent
      FROM user_product_matches m
      JOIN loan_products p ON m.product_id = p.product_id
      WHERE m.user_id = $1
      ORDER BY m.match_score DESC
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Get job details with matches summary
app.get('/api/jobs/:jobId/details', async (req, res) => {
  const { jobId } = req.params;

  try {
    const jobResult = await pool.query(`
      SELECT * FROM ingestion_jobs WHERE job_id = $1
    `, [jobId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const matchesResult = await pool.query(`
      SELECT
        u.user_id,
        u.name,
        u.email,
        COUNT(m.match_id) as match_count,
        MAX(m.match_score) as best_match_score
      FROM users u
      LEFT JOIN user_product_matches m ON u.user_id = m.user_id AND m.batch_id = $1
      WHERE u.batch_id = $1
      GROUP BY u.user_id, u.name, u.email
      ORDER BY match_count DESC, best_match_score DESC
    `, [jobId]);

    res.json({
      job: jobResult.rows[0],
      users: matchesResult.rows
    });
  } catch (error) {
    console.error('Error fetching job details:', error);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Loan Eligibility API running on http://localhost:${PORT}`);
  console.log(`Frontend should connect to http://localhost:${PORT}/api`);
});
