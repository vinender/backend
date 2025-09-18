import { Request, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// Upload file directly to S3
export const uploadDirect = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const { folder = 'uploads', convertToWebp = 'true' } = req.body;
    
    let fileBuffer = req.file.buffer;
    let mimeType = req.file.mimetype;
    let fileExtension = req.file.originalname.split('.').pop() || 'jpg';

    // Convert to WebP if requested and it's an image
    if (convertToWebp === 'true' && req.file.mimetype.startsWith('image/')) {
      try {
        fileBuffer = await sharp(req.file.buffer)
          .webp({ quality: 80 })
          .toBuffer();
        mimeType = 'image/webp';
        fileExtension = 'webp';
      } catch (error) {
        console.error('Error converting to WebP:', error);
        // Continue with original file if conversion fails
      }
    }

    // Generate unique filename
    const fileName = `${uuidv4()}.${fileExtension}`;
    const key = `${folder}/${fileName}`;

    // Upload to S3 with public-read ACL
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: 'public-read', // Make the file publicly accessible
    });

    await s3Client.send(command);

    // Return the file URL
    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    res.status(200).json({
      success: true,
      fileUrl,
      key,
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload file',
    });
  }
};

// Upload multiple files
export const uploadMultiple = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const { folder = 'uploads', convertToWebp = 'true' } = req.body;
    const uploadedFiles = [];

    for (const file of files) {
      let fileBuffer = file.buffer;
      let mimeType = file.mimetype;
      let fileExtension = file.originalname.split('.').pop() || 'jpg';

      // Convert to WebP if requested
      if (convertToWebp === 'true' && file.mimetype.startsWith('image/')) {
        try {
          fileBuffer = await sharp(file.buffer)
            .webp({ quality: 80 })
            .toBuffer();
          mimeType = 'image/webp';
          fileExtension = 'webp';
        } catch (error) {
          console.error('Error converting to WebP:', error);
        }
      }

      const fileName = `${uuidv4()}.${fileExtension}`;
      const key = `${folder}/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        ACL: 'public-read',
      });

      await s3Client.send(command);

      const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
      
      uploadedFiles.push({
        fileUrl,
        key,
        originalName: file.originalname,
      });
    }

    res.status(200).json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error: any) {
    console.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload files',
    });
  }
};