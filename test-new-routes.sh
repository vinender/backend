#!/bin/bash

# Test script for new field routes
# Usage: ./test-new-routes.sh [base-url]
# Example: ./test-new-routes.sh https://fieldsy-api.indiitserver.in

BASE_URL="${1:-http://localhost:5000}"
API_URL="${BASE_URL}/api"

echo "🧪 Testing new field routes on: ${API_URL}"
echo "================================================"

# Test 1: Nearby fields with valid coordinates (London)
echo ""
echo "✅ Test 1: GET /fields/nearby (valid lat/lng)"
echo "Request: ${API_URL}/fields/nearby?lat=51.5074&lng=-0.1278&limit=5"
RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/fields/nearby?lat=51.5074&lng=-0.1278&limit=5")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Status: 200 OK"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo "✗ Status: $HTTP_CODE"
    echo "$BODY"
fi

# Test 2: Nearby fields without coordinates (should fail)
echo ""
echo "❌ Test 2: GET /fields/nearby (missing lat/lng - should fail)"
echo "Request: ${API_URL}/fields/nearby"
RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/fields/nearby")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ]; then
    echo "✓ Status: 400 Bad Request (expected)"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo "✗ Status: $HTTP_CODE (expected 400)"
    echo "$BODY"
fi

# Test 3: Popular fields
echo ""
echo "✅ Test 3: GET /fields/popular"
echo "Request: ${API_URL}/fields/popular?limit=5"
RESPONSE=$(curl -s -w "\n%{http_code}" "${API_URL}/fields/popular?limit=5")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Status: 200 OK"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo "✗ Status: $HTTP_CODE"
    echo "$BODY"
fi

# Test 4: Check if routes return optimized data
echo ""
echo "🔍 Test 4: Verify optimized response (checking field count)"
RESPONSE=$(curl -s "${API_URL}/fields/popular?limit=1")
FIELD_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('data', [])[0].keys()) if data.get('data') else 0)" 2>/dev/null || echo "0")

echo "Fields in response: $FIELD_COUNT"
if [ "$FIELD_COUNT" -lt "20" ] && [ "$FIELD_COUNT" -gt "10" ]; then
    echo "✓ Response is optimized (expected 13-15 fields)"
else
    echo "⚠ Warning: Response might contain too many fields ($FIELD_COUNT)"
fi

echo ""
echo "================================================"
echo "✅ Tests completed!"
