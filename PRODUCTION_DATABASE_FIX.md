# Production Database Fix - isBlocked Field Missing & Duplicate Review Constraint

## Problems

### Problem 1: isBlocked Field Missing
Fields that are active, claimed, and approved are not visible on the production `/fields` page because the production MongoDB database is missing the `isBlocked` field that was added to the Prisma schema.

### Problem 2: Duplicate Review Constraint Error
When running `npx prisma db push`, you may encounter this error:
```
Error: MongoDB error
Kind: Command failed: Error code 11000 (DuplicateKey): Index build failed...
E11000 duplicate key error collection: fieldsy.field_reviews index: field_reviews_bookingId_key dup key: { bookingId: null }
```

This happens because there are multiple `FieldReview` documents with `bookingId: null`, and Prisma is trying to add a unique constraint on `bookingId`.

## Root Causes

1. **isBlocked Filter**: The code in `backend/src/models/field.model.ts` filters fields with `isBlocked: false`, but this field doesn't exist in production yet
2. **Duplicate Null Reviews**: Multiple field reviews exist with `null` bookingId values, violating the unique constraint requirement

## Solution

### Step 1: Clean Up Duplicate Field Reviews (PRODUCTION ONLY)

**IMPORTANT**: Only run this step if you get the duplicate key error. Run this in your **production environment**:

```bash
cd /path/to/fieldsy/backend

# Upload fix-field-reviews.js to production server
# Then run:
node fix-field-reviews.js
```

This script will:
1. Find all field reviews with `bookingId: null`
2. For each field-user combination with multiple reviews, keep the most recent one
3. Delete the older duplicate reviews
4. Prepare the database for the unique constraint

**Alternative - Manual MongoDB Cleanup**:
```javascript
// Connect to production MongoDB and run this query to see duplicates:
db.field_reviews.aggregate([
  { $match: { bookingId: null } },
  { $group: {
    _id: { fieldId: "$fieldId", userId: "$userId" },
    count: { $sum: 1 },
    docs: { $push: "$$ROOT" }
  }},
  { $match: { count: { $gt: 1 } } }
])

// Then manually delete duplicates, keeping the most recent one for each field-user pair
```

### Step 2: Push Prisma Schema to Production Database

After cleaning up duplicates, run this command in your **production environment**:

```bash
cd /path/to/fieldsy/backend
npx prisma db push
```

This will:
1. Add the `isBlocked` field to all existing Field documents (default: `false`)
2. Add the `isBlocked` field to all existing User documents (default: `false`)
3. Add unique constraint on `field_reviews.bookingId` (now safe after cleanup)
4. Update all other schema changes

### Step 3: Alternative - Manual MongoDB Update (If Automated Push Fails)

If you can't run `prisma db push` directly in production:

```javascript
// Connect to your production MongoDB and run these commands:

// 1. Update all Field documents to add isBlocked field
db.Field.updateMany(
  { isBlocked: { $exists: false } },
  { $set: { isBlocked: false } }
)

// 2. Update all User documents to add isBlocked field
db.User.updateMany(
  { isBlocked: { $exists: false } },
  { $set: { isBlocked: false } }
)

// 3. Add unique index on bookingId (after cleaning up duplicates)
db.field_reviews.createIndex({ bookingId: 1 }, { unique: true })
```

### Step 3: Verify the Fix

After updating the database, verify that fields are now visible:

1. Check that fields have the `isBlocked` field:
```javascript
db.Field.findOne({ isActive: true, isSubmitted: true, isApproved: true })
// Should include: isBlocked: false
```

2. Test the `/fields` endpoint in production
3. Verify that active, approved, claimed fields now appear on the frontend

## Code Changes Made

Updated `backend/src/models/field.model.ts` (line 316-341):
- Removed the problematic test query that was checking if `isBlocked` field exists
- Always include `isBlocked: false` in the where clause
- Simplified error handling for blocked field owners query

## Prevention

To prevent this issue in the future:

1. **Always run `prisma db push` after schema changes** before deploying to production
2. Use a deployment script that includes:
   ```bash
   npm run build
   npx prisma generate
   npx prisma db push  # Add this line
   ```
3. Consider using Prisma migrations for more controlled schema changes (requires setup)

## Deployment Checklist

When deploying schema changes to production:

- [ ] Update Prisma schema file
- [ ] Run `npx prisma generate` locally
- [ ] Test changes locally
- [ ] Deploy backend code
- [ ] **Run `npx prisma db push` in production** ⚠️ CRITICAL
- [ ] Restart backend server
- [ ] Verify frontend functionality

## MongoDB Connection String

Make sure your production environment has the correct `DATABASE_URL` in `.env`:
```
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority"
```
