# Production Route Fix Guide

## Issues Found

1. **Route not found**: `/fields/nearby` returns 404
2. **Rate limiting error**: `X-Forwarded-For` header validation error

## Root Causes

### Issue 1: Missing `/api` prefix in requests
Your Postman request is hitting:
```
GET /fields/nearby
```

But it should be:
```
GET /api/fields/nearby
```

**All backend routes are mounted under `/api`**

### Issue 2: Trust proxy not set in server.ts
The `trust proxy` setting was in `app.ts` but production uses `server.ts`. This causes rate limiting to fail when behind nginx.

## Fixes Applied

### Fix 1: Added trust proxy to server.ts
```typescript
// In src/server.ts - configureMiddleware()
this.app.set('trust proxy', 1);
```

This tells Express to trust the `X-Forwarded-For` header from nginx.

## Deployment Steps

### 1. Pull latest code
```bash
cd /var/www/fieldsy/backend
git pull origin main
```

### 2. Rebuild TypeScript
```bash
npm run build
```

### 3. Restart PM2
```bash
pm2 restart backend
```

### 4. Verify logs
```bash
pm2 logs backend --lines 50
```

You should NOT see these errors anymore:
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false
```

## Testing the Routes

### Correct Postman Requests

#### Test 1: Nearby Fields ✅
```
GET https://fieldsy-api.indiitserver.in/api/fields/nearby?lat=51.5074&lng=-0.1278&limit=5
```

**Note the `/api` prefix!**

#### Test 2: Popular Fields ✅
```
GET https://fieldsy-api.indiitserver.in/api/fields/popular?limit=5
```

### Expected Responses

#### Success (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Green Field Park",
      "city": "London",
      "state": "England",
      "address": "123 Main St",
      "price": 25,
      "bookingDuration": "1hour",
      "averageRating": 4.5,
      "images": ["https://..."],
      "amenities": ["water", "shade"],
      "isClaimed": true,
      "ownerName": "John Doe",
      "latitude": 51.5074,
      "longitude": -0.1278,
      "location": {...}
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 50,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### Error (400 Bad Request) - Missing coordinates:
```json
{
  "success": false,
  "message": "Latitude and longitude are required"
}
```

## Common Mistakes

### ❌ Wrong - Missing /api prefix
```
GET https://fieldsy-api.indiitserver.in/fields/nearby
```

### ✅ Correct - With /api prefix
```
GET https://fieldsy-api.indiitserver.in/api/fields/nearby
```

### ❌ Wrong - HTTP instead of HTTPS
```
GET http://fieldsy-api.indiitserver.in/api/fields/nearby
```

### ✅ Correct - HTTPS
```
GET https://fieldsy-api.indiitserver.in/api/fields/nearby
```

## Verification Checklist

After deployment, verify:

- [ ] Backend starts without errors: `pm2 logs backend`
- [ ] No rate limiting errors in logs
- [ ] Nearby fields API works: `/api/fields/nearby?lat=51&lng=0`
- [ ] Popular fields API works: `/api/fields/popular`
- [ ] Frontend can call these APIs
- [ ] Postman requests work with `/api` prefix

## Nginx Configuration (Optional Check)

If you still have issues, verify nginx is proxying correctly:

```nginx
location /api/ {
    proxy_pass http://localhost:5000/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

## Quick Test Script

Save this as `test-production.sh`:

```bash
#!/bin/bash

BASE_URL="https://fieldsy-api.indiitserver.in/api"

echo "Testing Nearby Fields..."
curl -s "${BASE_URL}/fields/nearby?lat=51.5074&lng=-0.1278&limit=2" | python3 -m json.tool

echo -e "\n\nTesting Popular Fields..."
curl -s "${BASE_URL}/fields/popular?limit=2" | python3 -m json.tool
```

Run with:
```bash
chmod +x test-production.sh
./test-production.sh
```

## Rollback (if needed)

If something goes wrong:
```bash
cd /var/www/fieldsy/backend
git log --oneline -5
git checkout <previous-commit-hash>
npm run build
pm2 restart backend
```

## Support

If issues persist after following this guide:
1. Check PM2 logs: `pm2 logs backend --lines 100`
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify build output: `ls -la dist/routes/field.routes.js`
4. Test locally first: `npm run dev` and test on localhost
