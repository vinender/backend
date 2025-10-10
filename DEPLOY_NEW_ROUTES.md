# Deploy New Routes to Production
# Feildsy
## Routes Added
- `GET /api/fields/nearby` - Get nearby fields based on lat/lng
- `GET /api/fields/popular` - Get popular fields based on ratings and bookings

## Deployment Steps

### 1. Verify Local Build
```bash
cd backend
npm run build
```

### 2. Check Production Server
SSH into your production server and verify current status:
```bash
# Check if backend is running
pm2 status
# or
systemctl status fieldsy-backend
```

### 3. Deploy to Production

#### Option A: If using PM2
```bash
# On production server
cd /path/to/fieldsy/backend

# Pull latest code
git pull origin main

# Install dependencies (if needed)
npm install

# Build TypeScript
npm run build

# Restart backend
pm2 restart fieldsy-backend
# or
pm2 restart all

# View logs
pm2 logs fieldsy-backend
```

#### Option B: If using systemd
```bash
# On production server
cd /path/to/fieldsy/backend

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build TypeScript
npm run build

# Restart service
sudo systemctl restart fieldsy-backend

# Check status
sudo systemctl status fieldsy-backend

# View logs
sudo journalctl -u fieldsy-backend -f
```

#### Option C: If using Docker
```bash
# On production server or local (depending on your setup)
cd /path/to/fieldsy

# Rebuild backend image
docker-compose build backend

# Restart backend container
docker-compose up -d backend

# View logs
docker-compose logs -f backend
```

### 4. Verify Routes Work

Test the new endpoints:
```bash
# Test nearby fields (replace with your production URL)
curl "https://fieldsy-api.indiitserver.in/api/fields/nearby?lat=51.5074&lng=-0.1278&page=1&limit=10"

# Test popular fields
curl "https://fieldsy-api.indiitserver.in/api/fields/popular?page=1&limit=10"
```

Expected response:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 5. Common Issues

#### Routes Still Not Found
- **Check if build ran successfully**: `ls -la dist/controllers/field.controller.js`
- **Verify routes file**: `cat dist/routes/field.routes.js | grep nearby`
- **Check app.ts mounts routes**: `cat dist/app.js | grep fields`
- **Clear require cache**: Sometimes Node.js caches old modules, restart helps
- **Check environment**: Ensure production server is pointing to the built `dist` folder

#### TypeScript Build Errors
```bash
# Clean and rebuild
rm -rf dist
npm run build
```

#### Port/URL Issues
- Verify nginx/reverse proxy configuration
- Check if requests are reaching the backend: `tail -f /var/log/nginx/access.log`

### 6. Rollback (if needed)
```bash
# On production server
git log --oneline -10  # See recent commits
git checkout <previous-commit-hash>
npm run build
pm2 restart fieldsy-backend
```

## Testing Checklist

- [ ] Backend builds without errors
- [ ] PM2/systemd service restarts successfully
- [ ] `/api/fields/nearby` returns 200 with valid lat/lng
- [ ] `/api/fields/nearby` returns 400 without lat/lng
- [ ] `/api/fields/popular` returns 200
- [ ] Response includes only FieldCard required fields
- [ ] Pagination works correctly
- [ ] Frontend can call these APIs
- [ ] No performance degradation

## Notes

- Both routes are **public** (no authentication required)
- Routes return optimized data (only FieldCard fields)
- Popular fields are sorted by popularity score internally
- Nearby fields use existing `searchByLocation` model method
