# Loan Eligibility Engine - Architecture Documentation

## System Architecture

### Overview

The Loan Eligibility Engine is a cloud-native application built on AWS with n8n for workflow automation. It follows an event-driven architecture pattern optimized for scalability and cost-efficiency.

### Core Components

#### 1. Data Ingestion Layer

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   React UI   │────▶│ API Gateway  │────▶│Lambda: Init  │
│              │     │              │     │              │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
                                          ┌──────────────┐
                                          │ Pre-signed   │
                                          │ S3 URL       │
                                          └──────┬───────┘
                                                  │
┌──────────────┐     ┌──────────────┐     ┌──────▼───────┐
│ SQS Queue    │◀────│ EventBridge  │◀────│ S3 Bucket    │
│ + DLQ        │     │              │     │              │
└──────┬───────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│Lambda: CSV   │────▶│ RDS Proxy    │────▶│ PostgreSQL   │
│Processor     │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Why this pattern?**

1. **Pre-signed URLs**: Bypass API Gateway's 10MB limit and 30s timeout
2. **EventBridge**: Flexible event routing and filtering
3. **SQS**: Backpressure control, automatic retries, DLQ for failed messages
4. **RDS Proxy**: Connection pooling prevents Lambda connection storms

#### 2. Workflow Automation Layer (n8n)

```
┌─────────────────────────────────────────────────────────────┐
│                     n8n Queue Mode                           │
│                                                              │
│  ┌─────────┐     ┌─────────────────────────────────────┐   │
│  │  Redis  │◀───▶│           n8n Workers               │   │
│  │ (Bull)  │     │                                     │   │
│  └─────────┘     │  ┌─────────┐ ┌─────────┐ ┌───────┐ │   │
│                  │  │Worker 1 │ │Worker 2 │ │Worker N│ │   │
│                  │  └─────────┘ └─────────┘ └───────┘ │   │
│                  └─────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Workflows                          │   │
│  │                                                      │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │Workflow A  │  │Workflow B  │  │Workflow C  │    │   │
│  │  │(Crawler)   │  │(Matching)  │  │(Notify)    │    │   │
│  │  │            │  │            │  │            │    │   │
│  │  │Cron: Daily │  │Webhook     │  │Webhook     │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Why Queue Mode?**

- Default n8n execution is single-threaded
- Queue mode enables horizontal scaling
- Redis provides persistent job queue
- Workers can be scaled independently

#### 3. Database Schema

```sql
-- Core entities and their relationships

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ ingestion_jobs  │     │     users       │     │ loan_products   │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ job_id (PK)     │◀────│ batch_id (FK)   │     │ product_id (PK) │
│ s3_key          │     │ user_id (PK)    │     │ provider_name   │
│ status          │     │ name            │     │ product_name    │
│ total_rows      │     │ email           │     │ income_range    │
│ valid_rows      │     │ monthly_income  │     │ credit_range    │
│ ...             │     │ credit_score    │     │ age_range       │
└─────────────────┘     │ employment_status│    │ employment_types│
                        │ age             │     │ special_conditions
                        └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 │    ┌──────────────────┘
                                 │    │
                                 ▼    ▼
                        ┌─────────────────┐
                        │user_product_    │
                        │matches          │
                        ├─────────────────┤
                        │ match_id (PK)   │
                        │ user_id (FK)    │
                        │ product_id (FK) │
                        │ match_score     │
                        │ is_notified     │
                        └─────────────────┘
```

### Data Flow

#### CSV Upload Flow

```
1. User selects CSV file in React UI
2. UI calls POST /api/upload/initiate
3. Lambda generates pre-signed S3 URL
4. UI uploads file directly to S3
5. S3 emits ObjectCreated event
6. EventBridge routes event to SQS
7. SQS triggers CSV Processor Lambda
8. Lambda:
   a. Downloads CSV from S3
   b. Validates data
   c. Inserts to staging table
   d. Merges to users table
   e. Triggers n8n matching webhook
9. UI polls job status endpoint
```

#### Matching Flow

```
1. Webhook receives batch_id
2. Execute stored procedure: match_new_users(batch_id)
   - Uses PostgreSQL range types
   - GiST indexes for O(log n) lookups
   - Returns: matches_created, users_processed, llm_candidates
3. If llm_candidates > 0:
   a. Query borderline matches with special conditions
   b. Batch into groups of 10-20
   c. Call Gemini API for evaluation
   d. Update match scores
4. Trigger notification workflow
5. Update job status to COMPLETED
```

#### Notification Flow

```
1. Webhook receives batch_id
2. Query unnotified matches grouped by user
3. For each user:
   a. Generate personalized HTML email
   b. Send via AWS SES
   c. Log notification status
   d. Mark matches as notified
```

### Security Considerations

1. **Secrets Management**: All credentials in AWS Secrets Manager
2. **IAM Least Privilege**: Each Lambda has minimal required permissions
3. **S3 Security**: Block public access, enforce SSL
4. **Database**: RDS in private subnet, accessed via RDS Proxy
5. **n8n**: Basic auth enabled, encryption key for credentials

### Scaling Considerations

| Component | Scaling Strategy |
|-----------|-----------------|
| Lambda | Automatic (up to reserved concurrency) |
| SQS | Automatic |
| RDS | Vertical (instance size) |
| n8n Workers | Horizontal (increase replicas) |
| Redis | Vertical or Redis Cluster |

### Cost Optimization

1. **Lambda**: Reserved concurrency prevents runaway costs
2. **RDS**: db.t3.micro for free tier eligibility
3. **S3**: Lifecycle rules delete old uploads after 30 days
4. **LLM**: Only ~5% of matches require AI evaluation
5. **n8n**: Self-hosted instead of cloud version
