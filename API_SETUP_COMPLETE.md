# API Setup Complete ✅

## Current Configuration

### Backend Server
- **URL**: `http://localhost:5001`
- **Database**: MongoDB with Replica Set
- **Status**: ✅ Running

### Frontend Server
- **URL**: `http://localhost:3002`
- **Backend API**: Connected to `http://localhost:5001/api`
- **Status**: ✅ Running

## What Was Fixed

### 1. **Port Conflict Resolution**
- Changed backend from port 5000 to 5001 (AirPlay was using 5000)
- Updated all environment variables to reflect new port

### 2. **CORS Configuration**
- Fixed CORS headers to allow requests from frontend
- Properly configured preflight OPTIONS requests
- Added all necessary headers for authentication

### 3. **MongoDB Setup**
- Configured MongoDB to run as a replica set (required for Prisma transactions)
- Connection string: `mongodb://localhost:27017/fieldsy?replicaSet=rs0`
- Database name: `fieldsy`

### 4. **Express Version**
- Downgraded from Express 5 to Express 4.x for better compatibility
- Fixed middleware configuration issues

## API Endpoints Working

### Authentication
✅ **Register**: `POST /api/auth/register`
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "Password123",
  "role": "DOG_OWNER" | "FIELD_OWNER"
}
```

✅ **Login**: `POST /api/auth/login`
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

### Other Endpoints
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/logout` - Logout user
- `GET /api/fields` - Get all fields
- `GET /api/bookings` - Get bookings (requires auth)

## Testing the API

### Using cURL
```bash
# Register
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test1234",
    "role": "DOG_OWNER"
  }'

# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'
```

### From Frontend
1. Navigate to `http://localhost:3002/register`
2. Fill in the registration form
3. Submit to create a new account
4. Use the login page at `http://localhost:3002/login`

## MongoDB Management

### Start MongoDB Replica Set
```bash
mongod --dbpath ~/data/mongodb-replica --replSet rs0 --bind_ip localhost --port 27017
```

### View Database
```bash
# Open MongoDB Shell
mongosh

# Use database
use fieldsy

# View collections
show collections

# View users
db.users.find()
```

### Prisma Studio (GUI)
```bash
npx prisma studio
```
Opens at `http://localhost:5555`

## Troubleshooting

### If MongoDB Connection Fails
1. Ensure MongoDB is running as a replica set
2. Check if replica set is initialized:
   ```bash
   mongosh --eval "rs.status()"
   ```
3. If not initialized:
   ```bash
   mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"
   ```

### If Frontend Can't Connect to Backend
1. Check backend is running on port 5001
2. Verify `.env.local` has correct URL:
   ```
   NEXT_PUBLIC_BACKEND_URL=http://localhost:5001/api
   ```
3. Restart frontend server after env changes

### If Registration/Login Fails
1. Check MongoDB is running
2. Verify password meets requirements (min 8 characters)
3. Check console for specific error messages

## Next Steps

1. **Test the signup flow** in the browser at `http://localhost:3002/register`
2. **Implement additional features**:
   - Email verification
   - Password reset
   - Social login (Google/Apple)
   - Field listings
   - Booking system

## Environment Variables

### Backend (.env)
```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/fieldsy?replicaSet=rs0
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret-key-here
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5001/api
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=your-nextauth-secret
```