# Loan Eligibility Engine - API Reference

## Base URL

- **Local**: `http://localhost:3001/api`
- **Production**: `https://your-api-id.execute-api.ap-south-1.amazonaws.com/prod/api`

## Authentication

Currently, the API does not require authentication. In production, consider adding:
- API Key authentication
- JWT tokens
- AWS IAM authentication

---

## Endpoints

### Upload Endpoints

#### POST /upload/initiate

Generate a pre-signed URL for direct S3 upload.

**Request**

```http
POST /api/upload/initiate
Content-Type: application/json

{
  "filename": "users.csv",
  "file_size": 1024000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| filename | string | Yes | Name of the CSV file |
| file_size | integer | Yes | File size in bytes |

**Response**

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "upload_url": "https://loan-eligibility-uploads-dev.s3.amazonaws.com/uploads/550e8400.../users.csv?X-Amz-Algorithm=...",
  "s3_key": "uploads/550e8400-e29b-41d4-a716-446655440000/users.csv",
  "expires_in": 900
}
```

| Field | Type | Description |
|-------|------|-------------|
| job_id | string (UUID) | Unique identifier for this upload job |
| upload_url | string | Pre-signed URL for S3 upload |
| s3_key | string | S3 object key |
| expires_in | integer | URL validity in seconds |

**Errors**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Only CSV files allowed | Invalid file extension |
| 400 | File size exceeds limit | File larger than 50MB |
| 500 | Internal server error | Server-side error |

**Usage Example**

```javascript
// Step 1: Get pre-signed URL
const initResponse = await fetch('/api/upload/initiate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: file.name,
    file_size: file.size
  })
});

const { job_id, upload_url } = await initResponse.json();

// Step 2: Upload directly to S3
await fetch(upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'text/csv' },
  body: file
});

// Step 3: Poll for status
// ...
```

---

### Job Status Endpoints

#### GET /jobs/{jobId}/status

Get the current status of a processing job.

**Request**

```http
GET /api/jobs/550e8400-e29b-41d4-a716-446655440000/status
```

**Response (Processing)**

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "s3_key": "uploads/550e8400.../users.csv",
  "status": "MATCHING_TRIGGERED",
  "total_rows": 10000,
  "processed_rows": 9950,
  "valid_rows": 9900,
  "invalid_rows": 50,
  "error_message": null,
  "error_details": null,
  "started_at": "2024-01-15T10:30:00.000Z",
  "completed_at": null,
  "created_at": "2024-01-15T10:29:55.000Z"
}
```

**Response (Completed)**

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "s3_key": "uploads/550e8400.../users.csv",
  "status": "COMPLETED",
  "total_rows": 10000,
  "processed_rows": 9950,
  "valid_rows": 9900,
  "invalid_rows": 50,
  "error_message": null,
  "error_details": null,
  "started_at": "2024-01-15T10:30:00.000Z",
  "completed_at": "2024-01-15T10:34:30.000Z",
  "created_at": "2024-01-15T10:29:55.000Z",
  "match_stats": {
    "total_matches": 45000,
    "users_matched": 8500,
    "avg_score": 72.5
  }
}
```

**Job Status Values**

| Status | Description |
|--------|-------------|
| UPLOADED | File uploaded to S3, awaiting processing |
| VALIDATING | Validating CSV format and data |
| STAGING | Inserting data into staging table |
| LOADED | Data merged into users table |
| MATCHING_TRIGGERED | n8n matching workflow triggered |
| COMPLETED | All processing complete |
| FAILED | Processing failed (see error_message) |

**Errors**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | Job not found | Invalid job ID |
| 500 | Internal server error | Server-side error |

---

## Webhook Endpoints (n8n)

These endpoints are called by Lambda functions to trigger n8n workflows.

### POST /webhook/matching

Trigger the user-loan matching workflow.

**Request**

```json
{
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_count": 9900,
  "triggered_at": "2024-01-15T10:32:00.000Z"
}
```

### POST /webhook/notification

Trigger the notification workflow.

**Request**

```json
{
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "matches_created": 45000,
  "triggered_at": "2024-01-15T10:33:00.000Z"
}
```

---

## CSV Format

### Required Columns

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| user_id | UUID | Unique user identifier | Valid UUID format |
| name | string | User's full name | 2-255 characters |
| email | string | Email address | Valid email format |
| monthly_income | integer | Monthly income in INR | Positive integer |
| credit_score | integer | Credit score | 300-900 |
| employment_status | string | Employment type | Salaried, Self-Employed, Business |
| age | integer | User's age | 18-100 |

### Example CSV

```csv
user_id,name,email,monthly_income,credit_score,employment_status,age
b35de23e-755f-4c6a-81d8-f7dd99ce53ef,Dhruv Iyengar,dhruv.iyengar@example.com,131000,725,Self-Employed,37
77fce4da-b901-4b27-b1bb-01989567b98b,Tara Khan,tara.khan@example.com,38000,765,Self-Employed,36
```

### Validation Rules

1. **user_id**: Must be a valid UUID v4 format
2. **email**: Must contain @ symbol, unique per user
3. **monthly_income**: Must be > 0
4. **credit_score**: Must be between 300 and 900
5. **age**: Must be between 18 and 100
6. **employment_status**: Must be exactly one of: "Salaried", "Self-Employed", "Business"

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Bad Request - Invalid input |
| 404 | Not Found - Resource doesn't exist |
| 413 | Payload Too Large - File exceeds 50MB |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /upload/initiate | 10 requests/minute |
| /jobs/{id}/status | 60 requests/minute |

---

## CORS

The API supports CORS with the following headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

For production, restrict `Access-Control-Allow-Origin` to your frontend domain.
