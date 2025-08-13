# MongoDB Setup for Fieldsy Backend

## Configuration Complete ✅

The backend has been successfully configured to use MongoDB instead of PostgreSQL.

## Changes Made:

1. **Prisma Schema** (`prisma/schema.prisma`):
   - Updated datasource provider from `postgresql` to `mongodb`
   - Added MongoDB-specific annotations (`@map("_id")`, `@db.ObjectId`)
   - Removed PostgreSQL-specific features (`@db.Text`)

2. **Environment Variables** (`.env`):
   - Changed from PostgreSQL connection string to MongoDB URI
   - Using `MONGODB_URI=mongodb://localhost:27017/fieldsy`

3. **Database Models**:
   - All models updated to use MongoDB ObjectIds
   - Foreign key references properly configured with `@db.ObjectId`

## MongoDB Connection Options:

### Local MongoDB:
```bash
# Default connection (already configured)
MONGODB_URI=mongodb://localhost:27017/fieldsy
```

### MongoDB Atlas (Cloud):
```bash
# Replace with your Atlas connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/fieldsy?retryWrites=true&w=majority
```

## Starting the Server:

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Push schema to MongoDB (creates collections and indexes)
npx prisma db push

# Start development server
npm run dev
```

## Verify Installation:

The server should start with this message:
```
✅ MongoDB connected successfully
```

## Troubleshooting:

If MongoDB connection fails:

1. **For Local MongoDB:**
   - Make sure MongoDB is installed: `brew install mongodb-community`
   - Start MongoDB service: `brew services start mongodb-community`
   - Or run manually: `mongod`

2. **For MongoDB Atlas:**
   - Check your connection string
   - Verify network access (whitelist your IP)
   - Ensure database user has proper permissions

## Database Management:

```bash
# View database in Prisma Studio
npx prisma studio

# Reset database (caution: deletes all data)
npx prisma db push --force-reset
```

## API Endpoints:

The server is running on `http://localhost:5000` with the following endpoints:

- Health Check: `GET /health`
- API Info: `GET /api`
- Authentication: `/api/auth/*`
- Users: `/api/users/*`
- Fields: `/api/fields/*`
- Bookings: `/api/bookings/*`