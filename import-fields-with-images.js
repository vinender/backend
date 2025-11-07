/**
 * Fields Import Script with Image Handling
 *
 * Supports multiple image sources:
 * 1. Direct S3/CDN URLs (no upload needed)
 * 2. External URLs (download and re-upload to S3)
 * 3. Local file paths (upload from disk)
 * 4. Google Drive/Dropbox URLs (convert and download)
 */

const XLSX = require('xlsx');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const prisma = new PrismaClient();

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME;

/**
 * Upload buffer to S3
 */
async function uploadToS3(buffer, key, contentType) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read'
  });

  await s3Client.send(command);

  return `https://${S3_BUCKET}.s3.amazonaws.com/${key}`;
}

/**
 * Convert sharing URLs to direct download URLs
 */
function convertToDirectUrl(url) {
  if (!url) return url;

  // Google Drive
  if (url.includes('drive.google.com')) {
    const fileId = url.match(/\/d\/(.+?)\//)?.[1] ||
                   url.match(/id=(.+?)(&|$)/)?.[1];
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }

  // Dropbox
  if (url.includes('dropbox.com')) {
    return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
              .replace('?dl=0', '?dl=1');
  }

  // OneDrive
  if (url.includes('1drv.ms') || url.includes('onedrive.live.com')) {
    // OneDrive requires specific handling
    console.warn('⚠️  OneDrive URLs need to be converted manually to direct download links');
  }

  return url;
}

/**
 * Download image from URL and upload to S3
 */
async function downloadAndUploadImage(imageUrl, fieldId, index) {
  try {
    // Convert sharing URLs to direct download
    const directUrl = convertToDirectUrl(imageUrl);

    console.log(`  Downloading image ${index + 1} from: ${directUrl.substring(0, 60)}...`);

    // Download image
    const response = await axios.get(directUrl, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 second timeout
      maxContentLength: 10 * 1024 * 1024, // 10MB max
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FieldsyImporter/1.0)'
      }
    });

    // Determine content type
    const contentType = response.headers['content-type'] || 'image/jpeg';

    // Get file extension
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' :
               contentType.includes('png') ? 'png' :
               contentType.includes('webp') ? 'webp' :
               contentType.includes('avif') ? 'avif' : 'jpg';

    // Upload to S3
    const timestamp = Date.now();
    const s3Key = `fields/${fieldId}/image-${index + 1}-${timestamp}.${ext}`;
    const s3Url = await uploadToS3(
      Buffer.from(response.data),
      s3Key,
      contentType
    );

    console.log(`  ✅ Uploaded image ${index + 1}: ${s3Url}`);
    return s3Url;

  } catch (error) {
    console.error(`  ❌ Failed to download/upload image ${index + 1}:`, error.message);
    return null;
  }
}

/**
 * Handle images from various sources
 */
async function processImages(imageSource, fieldId, localImagesPath = null) {
  const images = [];

  // Case 1: No images provided
  if (!imageSource) {
    console.warn(`⚠️  No images provided for field ${fieldId}`);
    return images;
  }

  // Case 2: URLs in comma-separated format
  if (typeof imageSource === 'string') {
    const urls = imageSource.split(',').map(u => u.trim()).filter(Boolean);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      // Check if already an S3 URL (no need to re-upload)
      if (url.includes('s3.amazonaws.com') || url.includes('cloudfront.net')) {
        console.log(`  ℹ️  Using existing S3 URL: ${url}`);
        images.push(url);
      } else {
        // External URL - download and upload to S3
        const s3Url = await downloadAndUploadImage(url, fieldId, i);
        if (s3Url) images.push(s3Url);
      }
    }
  }

  // Case 3: Local folder path
  if (localImagesPath && fs.existsSync(localImagesPath)) {
    const fieldFolder = path.join(localImagesPath, fieldId);

    if (fs.existsSync(fieldFolder)) {
      const files = fs.readdirSync(fieldFolder)
        .filter(file => /\.(jpg|jpeg|png|webp|avif)$/i.test(file))
        .sort();

      console.log(`  Found ${files.length} local images`);

      for (let i = 0; i < files.length; i++) {
        try {
          const filePath = path.join(fieldFolder, files[i]);
          const fileBuffer = fs.readFileSync(filePath);
          const ext = path.extname(files[i]).substring(1).toLowerCase();

          const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                            ext === 'png' ? 'image/png' :
                            ext === 'webp' ? 'image/webp' :
                            ext === 'avif' ? 'image/avif' : 'image/jpeg';

          const timestamp = Date.now();
          const s3Key = `fields/${fieldId}/image-${i + 1}-${timestamp}.${ext}`;
          const s3Url = await uploadToS3(fileBuffer, s3Key, contentType);

          images.push(s3Url);
          console.log(`  ✅ Uploaded local image: ${files[i]}`);

        } catch (error) {
          console.error(`  ❌ Failed to upload ${files[i]}:`, error.message);
        }
      }
    }
  }

  return images;
}

/**
 * Parse amenities from Excel columns
 */
function parseAmenities(row) {
  const amenities = [];

  const amenityFields = [
    'Entrance type',
    'Parking',
    'Dog fun available',
    'Human comforts',
    'Dog comforts',
    'Lighting'
  ];

  for (const field of amenityFields) {
    if (row[field]) {
      const values = row[field].split(',').map(v => v.trim()).filter(Boolean);
      amenities.push(...values);
    }
  }

  return [...new Set(amenities)]; // Remove duplicates
}

/**
 * Parse rules from Excel columns
 */
function parseRules(row) {
  const rules = [];

  if (row['Livestock in the area']?.toLowerCase() === 'yes') {
    rules.push('Livestock in nearby area - please keep dogs under control');
  }

  if (row['Accepts exempt dogs']) {
    if (row['Accepts exempt dogs'].toLowerCase() === 'yes') {
      rules.push('Exempt dogs welcome with proper muzzle and lead');
    } else {
      rules.push('Exempt dogs not permitted');
    }
  }

  if (row['Customers welcome']) {
    rules.push(row['Customers welcome']);
  }

  return rules;
}

/**
 * Map area type to enum
 */
function mapAreaType(areaType) {
  const mapping = {
    'private': 'PRIVATE',
    'public': 'PUBLIC',
    'training': 'TRAINING',
    'secure': 'PRIVATE',
    'open': 'PUBLIC'
  };

  return mapping[areaType?.toLowerCase()] || 'PRIVATE';
}

/**
 * Create or find field owner
 */
async function createOrFindOwner(email, phone, name) {
  let owner = await prisma.user.findFirst({
    where: {
      OR: [
        { email, role: 'FIELD_OWNER' },
        { phone, role: 'FIELD_OWNER' }
      ]
    }
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        name: name || `Field Owner (${email})`,
        email,
        phone,
        role: 'FIELD_OWNER',
        password: `temp_${Date.now()}`, // TODO: Generate proper password and send email
        provider: 'general',
        hasField: true
      }
    });

    console.log(`  Created new field owner: ${email}`);
  } else {
    console.log(`  Using existing field owner: ${email}`);
  }

  return owner;
}

/**
 * Main import function
 */
async function importFieldsFromExcel(excelPath, options = {}) {
  const {
    localImagesPath = null,
    allowWithoutImages = false,
    dryRun = false
  } = options;

  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      FIELDS IMPORT WITH IMAGES                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  // Read Excel file
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`📊 Found ${data.length} fields to import\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be saved\n');
  }

  let imported = 0;
  let failed = 0;
  let skippedNoImages = 0;
  const errors = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const fieldNum = i + 1;

    console.log(`\n[${fieldNum}/${data.length}] Processing: ${row['Name']}`);
    console.log('─'.repeat(80));

    try {
      // Create/find owner
      const owner = await createOrFindOwner(
        row['Email'],
        row['Phone'],
        row['Name']?.split('-')[0]?.trim() // Extract owner name from field name if possible
      );

      // Process images
      const fieldId = `field-${Date.now()}-${i}`;
      const images = await processImages(
        row['Image URLs'] || row['Images'],
        fieldId,
        localImagesPath
      );

      console.log(`  📸 Total images: ${images.length}`);

      // Check minimum image requirement
      if (images.length < 4 && !allowWithoutImages) {
        console.warn(`  ⚠️  Skipping field - need at least 4 images (found ${images.length})`);
        skippedNoImages++;
        continue;
      }

      if (dryRun) {
        console.log('  ✅ Would import field (dry run)');
        imported++;
        continue;
      }

      // Parse data
      const amenities = parseAmenities(row);
      const rules = parseRules(row);

      // Create field
      const field = await prisma.field.create({
        data: {
          name: row['Name'],
          description: `${row['Size'] || 'Medium'} field with ${row['Fencing type'] || 'standard'} fencing`,

          // Location
          address: row['Street'],
          city: row['City'],
          state: row['Region'],
          zipCode: row['Postcode'],
          latitude: parseFloat(row['Latitude']),
          longitude: parseFloat(row['Longitude']),

          location: {
            streetAddress: row['Street'],
            city: row['City'],
            county: row['Region'],
            postalCode: row['Postcode'],
            country: row['Country'] || 'UK',
            lat: parseFloat(row['Latitude']),
            lng: parseFloat(row['Longitude']),
            formatted_address: `${row['Street']}, ${row['City']}, ${row['Postcode']}`
          },

          // Owner
          owner: {
            connect: { id: owner.id }
          },

          // Field details
          type: mapAreaType(row['Area type']),
          size: row['Size'] || 'Medium',
          fenceType: row['Fencing type'],
          fenceSize: row['Fencing height'],

          // Images
          images,

          // Pricing
          price: 50.00,
          pricePerDay: 400.00,
          bookingDuration: '1hour',

          // Schedule
          openingTime: '08:00',
          closingTime: '18:00',
          operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],

          // Amenities and rules
          amenities,
          rules,

          // Status
          approvalStatus: images.length >= 4 ? 'PENDING' : 'DRAFT',
          isApproved: false,
          isClaimed: true,
          isSubmitted: images.length >= 4,
          isActive: false,

          // Step completion
          fieldDetailsCompleted: true,
          uploadImagesCompleted: images.length >= 4,
          pricingAvailabilityCompleted: true,
          bookingRulesCompleted: true,

          // Additional
          fieldFeatures: {
            website: row['Website'] || null
          },
          maxDogs: 10
        }
      });

      imported++;
      console.log(`  ✅ Imported field: ${field.id}`);

    } catch (error) {
      failed++;
      errors.push({
        field: row['Name'],
        error: error.message
      });
      console.error(`  ❌ Failed:`, error.message);
    }
  }

  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           IMPORT SUMMARY                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  console.log(`Total fields:           ${data.length}`);
  console.log(`✅ Successfully imported: ${imported}`);
  console.log(`⚠️  Skipped (no images):  ${skippedNoImages}`);
  console.log(`❌ Failed:               ${failed}`);

  if (errors.length > 0) {
    console.log('\n\nErrors:');
    errors.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.field}: ${e.error}`);
    });
  }

  console.log('\n');
}

// CLI Usage
const args = process.argv.slice(2);
const excelPath = args[0] || './fields-data.xlsx';
const localImagesPath = args[1] || null;
const allowWithoutImages = args.includes('--allow-no-images');
const dryRun = args.includes('--dry-run');

if (!fs.existsSync(excelPath)) {
  console.error(`❌ Excel file not found: ${excelPath}`);
  process.exit(1);
}

importFieldsFromExcel(excelPath, {
  localImagesPath,
  allowWithoutImages,
  dryRun
})
  .then(() => {
    console.log('Import complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });

module.exports = { importFieldsFromExcel, processImages, downloadAndUploadImage };
