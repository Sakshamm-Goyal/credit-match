import os
import json
import boto3
import psycopg2
from contextlib import contextmanager

secrets_client = boto3.client('secretsmanager')


def get_db_credentials():
    """Get database credentials from Secrets Manager or environment."""
    secret_arn = os.environ.get('DB_SECRET_ARN')
    if not secret_arn:
        return {
            'username': os.environ.get('DB_USER', 'postgres'),
            'password': os.environ.get('DB_PASSWORD', 'postgres')
        }
    secret = secrets_client.get_secret_value(SecretId=secret_arn)
    return json.loads(secret['SecretString'])


@contextmanager
def get_db_connection():
    """Context manager for database connections."""
    creds = get_db_credentials()
    conn = psycopg2.connect(
        host=os.environ.get('DB_HOST', 'localhost'),
        database=os.environ.get('DB_NAME', 'loan_eligibility'),
        user=creds['username'],
        password=creds['password'],
        connect_timeout=5
    )
    try:
        yield conn
    finally:
        conn.close()
