import json
import boto3
import uuid
import os

s3_client = boto3.client('s3')

BUCKET_NAME = os.environ.get('S3_BUCKET', 'loan-eligibility-uploads-dev')
ALLOWED_EXTENSIONS = ['.csv']
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def handler(event, context):
    """Generate pre-signed URL for direct S3 upload."""
    try:
        body = json.loads(event.get('body', '{}'))
        filename = body.get('filename', 'upload.csv')
        file_size = body.get('file_size', 0)

        # Validate file extension
        if not any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS):
            return response(400, {'error': 'Only CSV files allowed'})

        # Validate file size
        if file_size > MAX_FILE_SIZE:
            return response(400, {'error': f'File size exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit'})

        # Generate unique job ID and S3 key
        job_id = str(uuid.uuid4())
        s3_key = f"uploads/{job_id}/{filename}"

        # Generate pre-signed URL (valid for 15 minutes)
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key,
                'ContentType': 'text/csv'
            },
            ExpiresIn=900
        )

        return response(200, {
            'job_id': job_id,
            'upload_url': presigned_url,
            's3_key': s3_key,
            'expires_in': 900
        })

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
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        'body': json.dumps(body)
    }
