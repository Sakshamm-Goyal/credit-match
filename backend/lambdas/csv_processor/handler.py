import json
import boto3
import psycopg2
import pandas as pd
import io
import os
import uuid
import requests
from datetime import datetime
from psycopg2.extras import execute_batch

s3_client = boto3.client('s3')
secrets_client = boto3.client('secretsmanager')


def get_db_credentials():
    """Get DB credentials from Secrets Manager or environment."""
    secret_arn = os.environ.get('DB_SECRET_ARN')
    if not secret_arn:
        return {
            'username': os.environ.get('DB_USER', 'postgres'),
            'password': os.environ.get('DB_PASSWORD', 'postgres')
        }
    secret = secrets_client.get_secret_value(SecretId=secret_arn)
    return json.loads(secret['SecretString'])


def get_db_connection():
    """Create database connection."""
    creds = get_db_credentials()
    return psycopg2.connect(
        host=os.environ.get('DB_HOST', 'localhost'),
        database=os.environ.get('DB_NAME', 'loan_eligibility'),
        user=creds['username'],
        password=creds['password'],
        connect_timeout=5
    )


def handler(event, context):
    """Process CSV from SQS message (triggered by S3 via EventBridge)."""
    for record in event['Records']:
        try:
            # Parse SQS message
            message = json.loads(record['body'])
            if 'detail' in message:
                s3_event = message['detail']
                bucket = s3_event['bucket']['name']
                key = s3_event['object']['key']
            else:
                s3_record = message.get('Records', [{}])[0]
                bucket = s3_record.get('s3', {}).get('bucket', {}).get('name')
                key = s3_record.get('s3', {}).get('object', {}).get('key')

            job_id = key.split('/')[1]
            process_csv(bucket, key, job_id)

        except Exception as e:
            print(f"Error processing record: {e}")
            raise


def process_csv(bucket, key, job_id):
    """Process CSV file and load into database."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Update job status to PARSING
        cursor.execute("""
            INSERT INTO ingestion_jobs (job_id, s3_key, status, started_at)
            VALUES (%s, %s, 'PARSING', NOW())
            ON CONFLICT (job_id) DO UPDATE SET status = 'PARSING', started_at = NOW()
        """, (job_id, key))
        conn.commit()

        # Download and parse CSV
        response = s3_client.get_object(Bucket=bucket, Key=key)
        df = pd.read_csv(io.StringIO(response['Body'].read().decode('utf-8')))

        # Validate required columns
        required = ['user_id', 'name', 'email', 'monthly_income', 'credit_score', 'employment_status', 'age']
        missing = set(required) - set(df.columns)
        if missing:
            raise ValueError(f"Missing columns: {missing}")

        # Update total rows
        cursor.execute("UPDATE ingestion_jobs SET total_rows = %s, status = 'VALIDATING' WHERE job_id = %s",
                      (len(df), job_id))
        conn.commit()

        # Validate and stage data
        valid_rows, invalid_rows = [], []
        for _, row in df.iterrows():
            errors = validate_row(row)
            data = (job_id, str(row['user_id']), row['name'], row['email'],
                   int(row['monthly_income']) if pd.notna(row['monthly_income']) else None,
                   int(row['credit_score']) if pd.notna(row['credit_score']) else None,
                   row['employment_status'],
                   int(row['age']) if pd.notna(row['age']) else None,
                   len(errors) == 0, json.dumps(errors) if errors else None)
            (valid_rows if len(errors) == 0 else invalid_rows).append(data)

        # Batch insert to staging
        if valid_rows or invalid_rows:
            execute_batch(cursor, """
                INSERT INTO users_staging (job_id, user_id, name, email, monthly_income,
                    credit_score, employment_status, age, is_valid, validation_errors)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, valid_rows + invalid_rows)
            conn.commit()

        # Update status and merge
        cursor.execute("UPDATE ingestion_jobs SET status = 'STAGING', valid_rows = %s, invalid_rows = %s WHERE job_id = %s",
                      (len(valid_rows), len(invalid_rows), job_id))
        conn.commit()

        cursor.execute("SELECT * FROM merge_staging_to_users(%s)", (job_id,))
        result = cursor.fetchone()

        cursor.execute("UPDATE ingestion_jobs SET status = 'LOADED', processed_rows = %s WHERE job_id = %s",
                      (result[0] if result else 0, job_id))
        conn.commit()

        # Trigger n8n workflow
        if valid_rows:
            trigger_matching_workflow(job_id, len(valid_rows))

        cursor.execute("UPDATE ingestion_jobs SET status = 'MATCHING_TRIGGERED', completed_at = NOW() WHERE job_id = %s",
                      (job_id,))
        conn.commit()

    except Exception as e:
        cursor.execute("UPDATE ingestion_jobs SET status = 'FAILED', error_message = %s, completed_at = NOW() WHERE job_id = %s",
                      (str(e), job_id))
        conn.commit()
        raise
    finally:
        cursor.close()
        conn.close()


def validate_row(row):
    """Validate a single row and return list of errors."""
    errors = []
    try:
        uuid.UUID(str(row['user_id']))
    except:
        errors.append('Invalid user_id')

    if not (isinstance(row['monthly_income'], (int, float)) and row['monthly_income'] > 0):
        errors.append('Invalid monthly_income')

    if not (isinstance(row['credit_score'], (int, float)) and 300 <= row['credit_score'] <= 900):
        errors.append('Invalid credit_score')

    if not (isinstance(row['age'], (int, float)) and 18 <= row['age'] <= 100):
        errors.append('Invalid age')

    if row['employment_status'] not in ['Salaried', 'Self-Employed', 'Business']:
        errors.append('Invalid employment_status')

    if '@' not in str(row.get('email', '')):
        errors.append('Invalid email')

    return errors


def trigger_matching_workflow(job_id, user_count):
    """Trigger n8n matching workflow via webhook."""
    webhook_url = os.environ.get('N8N_MATCHING_WEBHOOK', 'http://localhost:5678/webhook/matching')
    try:
        requests.post(webhook_url, json={
            'batch_id': job_id,
            'user_count': user_count,
            'triggered_at': datetime.utcnow().isoformat()
        }, timeout=30)
    except Exception as e:
        print(f"Failed to trigger workflow: {e}")
