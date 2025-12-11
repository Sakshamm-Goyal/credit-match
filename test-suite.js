/**
 * Comprehensive Test Suite for Loan Eligibility Engine
 * Tests: Database, AWS S3, Gemini API, n8n Webhooks, End-to-End Flow
 */

import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

// Load environment
const env = {};
fs.readFileSync('.env', 'utf-8').split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }
});

console.log('\n🧪 LOAN ELIGIBILITY ENGINE - COMPREHENSIVE TEST SUITE\n');
console.log('=' .repeat(60));

let passCount = 0;
let failCount = 0;

async function runTest(name, testFn) {
  process.stdout.write(`\n📋 ${name}... `);
  try {
    const result = await testFn();
    console.log('✅ PASS');
    if (result) console.log(`   ${result}`);
    passCount++;
    return true;
  } catch (error) {
    console.log('❌ FAIL');
    console.log(`   Error: ${error.message}`);
    failCount++;
    return false;
  }
}

// ============== DATABASE TESTS ==============
async function testDatabaseConnection() {
  const pool = new pg.Pool({
    host: 'localhost',
    port: 5433,
    database: 'loan_eligibility',
    user: 'postgres',
    password: 'postgres123'
  });

  const result = await pool.query('SELECT NOW() as time, current_database() as db');
  await pool.end();
  return `Connected to ${result.rows[0].db} at ${result.rows[0].time}`;
}

async function testDatabaseTables() {
  const pool = new pg.Pool({
    host: 'localhost',
    port: 5433,
    database: 'loan_eligibility',
    user: 'postgres',
    password: 'postgres123'
  });

  const result = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `);
  await pool.end();

  const tables = result.rows.map(r => r.table_name);
  const required = ['users', 'loan_products', 'user_product_matches', 'ingestion_jobs', 'users_staging'];
  const missing = required.filter(t => !tables.includes(t));

  if (missing.length > 0) throw new Error(`Missing tables: ${missing.join(', ')}`);
  return `Found ${tables.length} tables: ${tables.join(', ')}`;
}

async function testStoredProcedures() {
  const pool = new pg.Pool({
    host: 'localhost',
    port: 5433,
    database: 'loan_eligibility',
    user: 'postgres',
    password: 'postgres123'
  });

  const result = await pool.query(`
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
    AND routine_name IN ('match_new_users', 'merge_staging_to_users', 'get_matches_for_notification')
  `);
  await pool.end();

  if (result.rows.length < 3) throw new Error('Missing stored procedures');
  return `Found ${result.rows.length} stored procedures`;
}

async function testDataIntegrity() {
  const pool = new pg.Pool({
    host: 'localhost',
    port: 5433,
    database: 'loan_eligibility',
    user: 'postgres',
    password: 'postgres123'
  });

  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM loan_products WHERE is_active = true) as products,
      (SELECT COUNT(*) FROM user_product_matches) as matches
  `);
  await pool.end();

  const { users, products, matches } = counts.rows[0];
  return `Users: ${users}, Products: ${products}, Matches: ${matches}`;
}

// ============== AWS S3 TESTS ==============
async function testS3Connection() {
  const s3Client = new S3Client({
    region: env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    }
  });

  const response = await s3Client.send(new ListBucketsCommand({}));
  const bucketNames = response.Buckets.map(b => b.Name);
  return `Connected! Found ${response.Buckets.length} buckets`;
}

async function testS3BucketAccess() {
  const s3Client = new S3Client({
    region: env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    }
  });

  const bucketName = env.S3_BUCKET || 'loan-eligibility-uploads-dev';

  // Try to generate a pre-signed URL (doesn't require bucket to exist)
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: 'test/test-file.csv',
    ContentType: 'text/csv'
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  if (!signedUrl) throw new Error('Failed to generate pre-signed URL');
  return `Pre-signed URL generated for bucket: ${bucketName}`;
}

// ============== GEMINI API TEST ==============
async function testGeminiAPI() {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Respond with only: "API_OK"' }]
        }],
        generationConfig: { maxOutputTokens: 10 }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return `Gemini responded: "${text.trim()}"`;
}

async function testGeminiLoanEvaluation() {
  const apiKey = env.GEMINI_API_KEY;

  const prompt = `Evaluate if this user is eligible for a personal loan.
User: Income ₹75,000/month, Credit Score 780, Age 32, Salaried
Loan: Requires minimum income ₹50,000, credit score 700+, age 21-60

Respond ONLY with JSON: {"eligible": true/false, "reason": "brief reason"}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Try to parse JSON from response
  const jsonMatch = text.match(/\{[^}]+\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  const result = JSON.parse(jsonMatch[0]);
  return `Eligible: ${result.eligible}, Reason: ${result.reason}`;
}

// ============== N8N TESTS ==============
async function testN8nHealth() {
  const response = await fetch('http://localhost:5678/', { method: 'GET' });
  if (!response.ok) throw new Error(`n8n not responding: ${response.status}`);
  return `n8n is running on port 5678`;
}

// ============== API SERVER TESTS ==============
async function testAPIUploadInitiate() {
  const response = await fetch('http://localhost:3000/api/upload/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'test.csv', file_size: 1000 })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = await response.json();
  if (!data.job_id || !data.upload_url) throw new Error('Invalid response');
  return `Job ID: ${data.job_id.substring(0, 8)}...`;
}

async function testAPIJobStatus() {
  // First create a job
  const initResponse = await fetch('http://localhost:3000/api/upload/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'test.csv', file_size: 1000 })
  });
  const { job_id } = await initResponse.json();

  // Then check status
  const statusResponse = await fetch(`http://localhost:3000/api/jobs/${job_id}/status`);
  if (!statusResponse.ok) throw new Error(`Status API error: ${statusResponse.status}`);

  const status = await statusResponse.json();
  return `Status: ${status.status}`;
}

// ============== END-TO-END TEST ==============
async function testEndToEndFlow() {
  // 1. Initiate upload
  const initResponse = await fetch('http://localhost:3000/api/upload/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'e2e_test.csv', file_size: 500 })
  });
  const { job_id, upload_url } = await initResponse.json();

  // 2. Upload CSV
  const csvContent = `user_id,name,email,monthly_income,credit_score,employment_status,age
550e8400-e29b-41d4-a716-446655440099,E2E Test User,e2e@test.com,80000,750,Salaried,30`;

  await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/csv' },
    body: csvContent
  });

  // 3. Wait for processing
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 4. Check status
  const statusResponse = await fetch(`http://localhost:3000/api/jobs/${job_id}/status`);
  const status = await statusResponse.json();

  if (status.status !== 'COMPLETED') throw new Error(`Job not completed: ${status.status}`);

  return `Processed ${status.valid_rows} users, found ${status.matches_found} matches`;
}

// ============== FRONTEND TEST ==============
async function testFrontendAccessible() {
  const response = await fetch('http://localhost:5173/');
  if (!response.ok) throw new Error(`Frontend not accessible: ${response.status}`);
  return 'Frontend is accessible on port 5173';
}

// ============== RUN ALL TESTS ==============
async function runAllTests() {
  console.log('\n📦 DATABASE TESTS');
  console.log('-'.repeat(40));
  await runTest('Database Connection', testDatabaseConnection);
  await runTest('Database Tables', testDatabaseTables);
  await runTest('Stored Procedures', testStoredProcedures);
  await runTest('Data Integrity', testDataIntegrity);

  console.log('\n☁️  AWS S3 TESTS');
  console.log('-'.repeat(40));
  await runTest('S3 Connection', testS3Connection);
  await runTest('S3 Pre-signed URL Generation', testS3BucketAccess);

  console.log('\n🤖 GEMINI API TESTS');
  console.log('-'.repeat(40));
  await runTest('Gemini API Connection', testGeminiAPI);
  await runTest('Gemini Loan Evaluation', testGeminiLoanEvaluation);

  console.log('\n🔄 N8N TESTS');
  console.log('-'.repeat(40));
  await runTest('n8n Health Check', testN8nHealth);

  console.log('\n🌐 API SERVER TESTS');
  console.log('-'.repeat(40));
  await runTest('Upload Initiate Endpoint', testAPIUploadInitiate);
  await runTest('Job Status Endpoint', testAPIJobStatus);

  console.log('\n🎯 END-TO-END TESTS');
  console.log('-'.repeat(40));
  await runTest('Complete Upload Flow', testEndToEndFlow);

  console.log('\n💻 FRONTEND TESTS');
  console.log('-'.repeat(40));
  await runTest('Frontend Accessible', testFrontendAccessible);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (failCount === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System is ready.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.\n');
  }
}

runAllTests().catch(console.error);
