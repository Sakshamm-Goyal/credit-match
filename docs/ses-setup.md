# AWS SES Email Configuration Guide

## Quick Setup (5 minutes)

### Step 1: Verify Email in AWS Console

1. Open AWS Console: https://console.aws.amazon.com/ses/home?region=us-east-1
2. Click **"Verified identities"** → **"Create identity"**
3. Select **"Email address"**
4. Enter: `your-email@gmail.com` (use your real email for testing)
5. Click **"Create identity"**
6. Check your inbox and click the verification link

### Step 2: Configure n8n with AWS Credentials

1. Open n8n: http://localhost:5678
2. Login: admin / admin123
3. Go to **Settings** → **Credentials**
4. Click **"Add Credential"** → Search for **"AWS"**
5. Fill in:
   - **Name**: `AWS SES Credentials`
   - **Region**: `us-east-1`
   - **Access Key ID**: `YOUR_AWS_ACCESS_KEY_ID_HERE` (from your .env)
   - **Secret Access Key**: `YOUR_AWS_SECRET_ACCESS_KEY_HERE`

### Step 3: Import Notification Workflow

1. In n8n, click **"Add workflow"** → **"Import from file"**
2. Upload: `/n8n/workflows/workflow_c_notification.json`
3. Configure the **AWS SES** node:
   - Select your AWS credentials
   - Set "From Email": your verified email
4. Configure the **PostgreSQL** node:
   - Host: `postgres` (docker network) or `host.docker.internal`
   - Port: `5432`
   - Database: `loan_eligibility`
   - User: `postgres`
   - Password: `postgres123`

### Step 4: Test Email Sending

```bash
# Test AWS SES directly
aws ses send-email \
  --from "your-verified-email@gmail.com" \
  --destination "ToAddresses=your-email@gmail.com" \
  --message "Subject={Data=Test,Charset=utf-8},Body={Text={Data=Hello from Loan Eligibility Engine!,Charset=utf-8}}" \
  --region us-east-1
```

## Important Notes

### Sandbox Mode Limitations
- Can only send to **verified email addresses**
- Maximum 200 emails per 24 hours
- Maximum 1 email per second

### To Move Out of Sandbox
1. Go to SES Console → **"Account dashboard"**
2. Click **"Request production access"**
3. Fill the form explaining your use case
4. Wait 24-48 hours for approval

## Alternative: Use SMTP Instead

If you prefer SMTP over API:

1. In SES Console → **"SMTP settings"**
2. Create SMTP credentials
3. In n8n, use **"Email (SMTP)"** node instead:
   - Host: `email-smtp.us-east-1.amazonaws.com`
   - Port: `587`
   - User: SMTP username from SES
   - Password: SMTP password from SES
   - Secure: `STARTTLS`
