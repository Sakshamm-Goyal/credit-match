import json
import boto3
import psycopg2
import os
from datetime import datetime
from decimal import Decimal

secrets_client = boto3.client('secretsmanager')

def get_db_credentials():
    secret_arn = os.environ.get('DB_SECRET_ARN')
    if not secret_arn:
        return {
            'username': os.environ.get('DB_USER', 'postgres'),
            'password': os.environ.get('DB_PASSWORD', 'postgres')
        }
    secret = secrets_client.get_secret_value(SecretId=secret_arn)
    return json.loads(secret['SecretString'])

def get_db_connection():
    creds = get_db_credentials()
    return psycopg2.connect(
        host=os.environ.get('DB_HOST', 'localhost'),
        database=os.environ.get('DB_NAME', 'loan_eligibility'),
        user=creds['username'],
        password=creds['password'],
        connect_timeout=5
    )

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)

def handler(event, context):
    """Get job status by job_id"""
    try:
        job_id = event['pathParameters']['jobId']

        conn = get_db_connection()
        cursor = conn.cursor()

        # Get job details
        cursor.execute("""
            SELECT job_id, s3_key, status, total_rows, processed_rows,
                   valid_rows, invalid_rows, error_message, error_details,
                   started_at, completed_at, created_at
            FROM ingestion_jobs
            WHERE job_id = %s
        """, (job_id,))

        row = cursor.fetchone()

        if not row:
            return response(404, {'error': 'Job not found'})

        job_data = {
            'job_id': str(row[0]),
            's3_key': row[1],
            'status': row[2],
            'total_rows': row[3],
            'processed_rows': row[4],
            'valid_rows': row[5],
            'invalid_rows': row[6],
            'error_message': row[7],
            'error_details': row[8],
            'started_at': row[9].isoformat() if row[9] else None,
            'completed_at': row[10].isoformat() if row[10] else None,
            'created_at': row[11].isoformat() if row[11] else None
        }

        # If job is completed, get match statistics
        if job_data['status'] in ['MATCHING_TRIGGERED', 'COMPLETED']:
            cursor.execute("""
                SELECT COUNT(*) as total_matches,
                       COUNT(DISTINCT user_id) as users_matched,
                       AVG(match_score) as avg_score
                FROM user_product_matches
                WHERE batch_id = %s
            """, (job_id,))

            match_row = cursor.fetchone()
            if match_row:
                job_data['match_stats'] = {
                    'total_matches': match_row[0],
                    'users_matched': match_row[1],
                    'avg_score': float(match_row[2]) if match_row[2] else 0
                }

        cursor.close()
        conn.close()

        return response(200, job_data)

    except Exception as e:
        print(f"Error: {str(e)}")
        return response(500, {'error': 'Internal server error'})

def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, OPTIONS'
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }
