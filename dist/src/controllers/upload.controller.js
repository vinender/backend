"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get upload () {
        return upload;
    },
    get uploadDirect () {
        return uploadDirect;
    },
    get uploadMultiple () {
        return uploadMultiple;
    }
});
const _clients3 = require("@aws-sdk/client-s3");
const _multer = /*#__PURE__*/ _interop_require_default(require("multer"));
const _sharp = /*#__PURE__*/ _interop_require_default(require("sharp"));
const _uuid = require("uuid");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
// Initialize S3 client
const s3Client = new _clients3.S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});
// Configure multer for memory storage
const storage = _multer.default.memoryStorage();
const upload = (0, _multer.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb)=>{
        // Accept images only
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});
const uploadDirect = async (req, res)=>{
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }
        const { folder = 'uploads', convertToWebp = 'true' } = req.body;
        let fileBuffer = req.file.buffer;
        let mimeType = req.file.mimetype;
        let fileExtension = req.file.originalname.split('.').pop() || 'jpg';
        // Convert to WebP if requested and it's an image
        if (convertToWebp === 'true' && req.file.mimetype.startsWith('image/')) {
            try {
                fileBuffer = await (0, _sharp.default)(req.file.buffer).webp({
                    quality: 80
                }).toBuffer();
                mimeType = 'image/webp';
                fileExtension = 'webp';
            } catch (error) {
                console.error('Error converting to WebP:', error);
            // Continue with original file if conversion fails
            }
        }
        // Generate unique filename
        const fileName = `${(0, _uuid.v4)()}.${fileExtension}`;
        const key = `${folder}/${fileName}`;
        // Upload to S3 with public-read ACL
        const command = new _clients3.PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType,
            ACL: 'public-read'
        });
        await s3Client.send(command);
        // Return the file URL
        const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
        res.status(200).json({
            success: true,
            fileUrl,
            key
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload file'
        });
    }
};
const uploadMultiple = async (req, res)=>{
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded'
            });
        }
        const { folder = 'uploads', convertToWebp = 'true' } = req.body;
        const uploadedFiles = [];
        for (const file of files){
            let fileBuffer = file.buffer;
            let mimeType = file.mimetype;
            let fileExtension = file.originalname.split('.').pop() || 'jpg';
            // Convert to WebP if requested
            if (convertToWebp === 'true' && file.mimetype.startsWith('image/')) {
                try {
                    fileBuffer = await (0, _sharp.default)(file.buffer).webp({
                        quality: 80
                    }).toBuffer();
                    mimeType = 'image/webp';
                    fileExtension = 'webp';
                } catch (error) {
                    console.error('Error converting to WebP:', error);
                }
            }
            const fileName = `${(0, _uuid.v4)()}.${fileExtension}`;
            const key = `${folder}/${fileName}`;
            const command = new _clients3.PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: key,
                Body: fileBuffer,
                ContentType: mimeType,
                ACL: 'public-read'
            });
            await s3Client.send(command);
            const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
            uploadedFiles.push({
                fileUrl,
                key,
                originalName: file.originalname
            });
        }
        res.status(200).json({
            success: true,
            files: uploadedFiles
        });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload files'
        });
    }
};

//# sourceMappingURL=upload.controller.js.map