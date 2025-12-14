# Loan Eligibility Engine - Setup Guide

## Prerequisites

Before starting, ensure you have:

- [ ] Docker Desktop installed and running
- [ ] Node.js 18+ installed
- [ ] Python 3.11+ installed
- [ ] AWS CLI configured with credentials
- [ ] Git installed

## Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/loan-eligibility-engine.git
cd loan-eligibility-engine
```

## Step 2: Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your credentials
nano .env
```

### Required Environment Variables

```bash
# Database (for local development)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=loan_eligibility
DB_USER=postgres
DB_PASSWORD=<generate-strong-password>

# n8n
N8N_USER=admin
N8N_PASSWORD=<generate-strong-password>
N8N_ENCRYPTION_KEY=<32-character-random-string>

# AWS
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=ap-south-1

# Gemini API
GEMINI_API_KEY=<your-gemini-api-key>
```

### Generate Secure Passwords

```bash
# Generate a secure password
openssl rand -base64 24

# Generate encryption key
openssl rand -hex 16
```

## Step 3: Start Docker Services

```bash
cd n8n
docker-compose up -d

# Check service health
docker-compose ps

# Expected output:
# NAME                  STATUS
# loan-eligibility-db   Up (healthy)
# loan-eligibility-redis Up (healthy)
# n8n-main              Up
# n8n-worker            Up
```

## Step 4: Initialize Database

### Option A: Automatic (via Docker init scripts)

The SQL files in `backend/sql/` are mounted as init scripts and run automatically when PostgreSQL starts for the first time.

### Option B: Manual

```bash
# Connect to PostgreSQL
docker exec -it loan-eligibility-db psql -U postgres -d loan_eligibility

# Run each script
\i /docker-entrypoint-initdb.d/001_create_tables.sql
\i /docker-entrypoint-initdb.d/002_create_indexes.sql
\i /docker-entrypoint-initdb.d/003_stored_procedures.sql
\i /docker-entrypoint-initdb.d/004_seed_loan_products.sql

# Verify tables were created
\dt

# Exit
\q
```

## Step 5: Configure n8n

### 5.1 Access n8n

Open http://localhost:5678 in your browser.

Login with credentials from your `.env` file:
- Username: admin (or N8N_USER value)
- Password: admin123 (or N8N_PASSWORD value)

### 5.2 Create PostgreSQL Credential

1. Go to **Credentials** → **Add Credential**
2. Search for "Postgres"
3. Configure:
   - **Name**: Postgres DB
   - **Host**: postgres (Docker network name)
   - **Database**: loan_eligibility
   - **User**: postgres
   - **Password**: (your DB_PASSWORD)
   - **Port**: 5432
4. Click **Save**

### 5.3 Create AWS Credential

1. Go to **Credentials** → **Add Credential**
2. Search for "AWS"
3. Configure:
   - **Name**: AWS Credentials
   - **Region**: ap-south-1
   - **Access Key ID**: (your AWS access key)
   - **Secret Access Key**: (your AWS secret key)
4. Click **Save**

### 5.4 Create Gemini API Credential

1. Go to **Credentials** → **Add Credential**
2. Search for "HTTP Query Auth"
3. Configure:
   - **Name**: Gemini API Key
   - **Name**: key
   - **Value**: (your Gemini API key)
4. Click **Save**

### 5.5 Import Workflows

1. Go to **Workflows** → **Import from File**
2. Import each workflow from `n8n/workflows/`:
   - `workflow_a_crawler.json`
   - `workflow_b_matching.json`
   - `workflow_c_notification.json`
3. For each workflow:
   - Open the workflow
   - Update PostgreSQL nodes to use "Postgres DB" credential
   - Update AWS SES nodes to use "AWS Credentials"
   - Update Gemini HTTP nodes to use "Gemini API Key"
   - Click **Save**
   - Toggle **Active** to enable

## Step 6: Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at http://localhost:3000

## Step 7: Test the Pipeline

### Upload Test CSV

1. Open http://localhost:3000
2. Click "Browse" or drag-and-drop `sample-data/users.csv`
3. Click "Upload & Process"
4. Watch the job status update in real-time

### Monitor n8n Executions

1. Open http://localhost:5678
2. Go to **Executions**
3. You should see:
   - Workflow B (Matching) triggered by webhook
   - Workflow C (Notification) triggered after matching

### Verify Database

```bash
docker exec -it loan-eligibility-db psql -U postgres -d loan_eligibility

# Check users loaded
SELECT COUNT(*) FROM users;

# Check matches created
SELECT COUNT(*) FROM user_product_matches;

# Check match distribution
SELECT
  CASE
    WHEN match_score >= 80 THEN 'Excellent (80+)'
    WHEN match_score >= 60 THEN 'Good (60-80)'
    ELSE 'Fair (<60)'
  END as quality,
  COUNT(*)
FROM user_product_matches
GROUP BY 1;
```

## Step 8: AWS Deployment (Production)

### Install Serverless Framework

```bash
npm install -g serverless
```

### Deploy Backend

```bash
cd infrastructure

# Install plugins
npm install

# Deploy to dev
serverless deploy --stage dev

# Deploy to production
serverless deploy --stage prod
```

### Update Frontend API URL

```bash
# Update .env with API Gateway URL
VITE_API_URL=https://xxxxxx.execute-api.ap-south-1.amazonaws.com/prod/api
```

### Build and Deploy Frontend

```bash
cd frontend
npm run build

# Upload to S3 (create bucket first)
aws s3 sync dist/ s3://your-frontend-bucket/ --delete

# Or use CloudFront for CDN
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker logs loan-eligibility-db

# Test connection
docker exec -it loan-eligibility-db pg_isready
```

### n8n Workflow Issues

1. Check n8n logs: `docker logs n8n-main`
2. Verify credentials are configured correctly
3. Check webhook URLs match between Lambda and n8n

### Lambda Issues

```bash
# View Lambda logs
serverless logs -f csvProcessor --tail

# Test Lambda locally
serverless invoke local -f uploadInitiator -p test/event.json
```

### SES Sandbox Mode

In SES sandbox, you can only send to verified emails:

1. Go to AWS SES Console
2. Verify recipient email addresses
3. Or request production access

## Next Steps

1. Set up CloudWatch alarms for monitoring
2. Configure custom domain for API Gateway
3. Set up CI/CD pipeline
4. Request SES production access
5. Create backup strategy for RDS
