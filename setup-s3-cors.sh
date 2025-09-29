#!/bin/bash

# Script to apply CORS configuration to S3 bucket
# Usage: ./setup-s3-cors.sh

BUCKET_NAME="fieldsy"
CORS_CONFIG_FILE="s3-cors-config.json"

echo "Applying CORS configuration to S3 bucket: $BUCKET_NAME"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if config file exists
if [ ! -f "$CORS_CONFIG_FILE" ]; then
    echo "CORS configuration file not found: $CORS_CONFIG_FILE"
    exit 1
fi

# Apply CORS configuration
aws s3api put-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --cors-configuration "file://$CORS_CONFIG_FILE"

if [ $? -eq 0 ]; then
    echo "✅ CORS configuration applied successfully!"
    echo ""
    echo "Current CORS configuration:"
    aws s3api get-bucket-cors --bucket "$BUCKET_NAME"
else
    echo "❌ Failed to apply CORS configuration"
    echo "Make sure you have the necessary permissions and the bucket exists"
fi