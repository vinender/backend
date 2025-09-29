# S3 CORS Configuration Setup

## Problem
You're experiencing CORS errors when trying to upload files directly to S3 from the browser using presigned URLs.

## Solution

### 1. Apply CORS Configuration to S3 Bucket

Run the setup script:
```bash
cd backend
./setup-s3-cors.sh
```

Or manually apply using AWS CLI:
```bash
aws s3api put-bucket-cors --bucket fieldsy --cors-configuration file://s3-cors-config.json
```

### 2. Verify CORS Configuration

Check current CORS settings:
```bash
aws s3api get-bucket-cors --bucket fieldsy
```

### 3. Alternative: Apply via AWS Console

1. Go to AWS S3 Console
2. Select your bucket (fieldsy)
3. Go to "Permissions" tab
4. Scroll to "Cross-origin resource sharing (CORS)"
5. Click "Edit"
6. Paste this configuration:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "HEAD"
    ],
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "http://localhost:3004",
      "http://localhost:3005",
      "https://fieldsy.indiitserver.in",
      "https://fieldsy.com",
      "https://*.fieldsy.com",
      "https://*.indiitserver.in"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-server-side-encryption",
      "x-amz-request-id",
      "x-amz-id-2"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

7. Click "Save changes"

## New Presigned URL Endpoint

The backend now has a proper presigned URL endpoint:

### Endpoint
```
POST /api/upload/presigned-url
```

### Request Body
```json
{
  "fileName": "example.jpg",
  "fileType": "image/jpeg",
  "folder": "claim-documents"
}
```

### Response
```json
{
  "uploadUrl": "https://fieldsy.s3.amazonaws.com/",
  "fileUrl": "https://fieldsy.s3.us-east-1.amazonaws.com/claim-documents/uuid.jpg",
  "fields": {
    "Content-Type": "image/jpeg",
    "bucket": "fieldsy",
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": "...",
    "X-Amz-Date": "...",
    "key": "claim-documents/uuid.jpg",
    "Policy": "...",
    "X-Amz-Signature": "..."
  }
}
```

## Frontend Upload Example

```javascript
// 1. Get presigned URL
const response = await fetch('/api/upload/presigned-url', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    fileName: file.name,
    fileType: file.type,
    folder: 'claim-documents'
  })
});

const { uploadUrl, fields, fileUrl } = await response.json();

// 2. Upload file to S3
const formData = new FormData();

// Important: Add fields first, then the file
Object.entries(fields).forEach(([key, value]) => {
  formData.append(key, value);
});
formData.append('file', file);

const uploadResponse = await fetch(uploadUrl, {
  method: 'POST',
  body: formData
});

if (uploadResponse.ok) {
  console.log('File uploaded successfully:', fileUrl);
}
```

## Important Notes

1. **Field Order**: When uploading, add the presigned fields to FormData BEFORE adding the file
2. **No Authorization Header**: Don't include Authorization header when uploading to S3
3. **Content-Type**: Make sure the Content-Type matches what was specified when generating the presigned URL
4. **File Size**: Default limit is 10MB, adjust in the backend if needed
5. **Expiration**: Presigned URLs expire after 10 minutes

## Troubleshooting

### Still Getting CORS Errors?

1. **Check bucket region**: Make sure AWS_REGION in .env matches your bucket's region
2. **Clear browser cache**: Sometimes old CORS settings are cached
3. **Check bucket policy**: Ensure the bucket allows public uploads or the IAM user has proper permissions
4. **Verify origin**: Make sure your frontend URL is in the AllowedOrigins list
5. **Check HTTPS**: If using HTTPS, ensure all origins in CORS config use HTTPS

### Common Issues

1. **403 Forbidden**: Usually a permissions issue or wrong AWS credentials
2. **CORS Error**: CORS not configured or origin not allowed
3. **Invalid Signature**: Fields not matching or expired presigned URL
4. **Network Error**: Check if S3 bucket is accessible from your region

## Testing

Test the presigned URL endpoint:
```bash
curl -X POST http://localhost:5000/api/upload/presigned-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fileName": "test.jpg",
    "fileType": "image/jpeg",
    "folder": "test"
  }'
```