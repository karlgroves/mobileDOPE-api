# File Upload and Download Patterns

> **Navigation:** [Main Documentation](./README.md#documentation-navigation) |
> [Operations & Responses](./operations-and-responses.md) | [Global Rules](./global-rules.md) |
> [✅ Validation](./validation-consolidated.md)

## Table of Contents

- [Purpose](#purpose)
- [File Upload Patterns](#file-upload-patterns)
  - [Upload Endpoint Design](#upload-endpoint-design)
    - [Single File Upload](#single-file-upload)
    - [Multiple File Upload](#multiple-file-upload)
    - [Upload with Metadata](#upload-with-metadata)
  - [Upload Response Format](#upload-response-format)
    - [Successful Upload Response](#successful-upload-response)
    - [Upload Error Response](#upload-error-response)
  - [File Validation Patterns](#file-validation-patterns)
    - [Server-Side Validation](#server-side-validation)
    - [Content-Based Validation](#content-based-validation)
  - [Storage Strategies](#storage-strategies)
    - [Local File Storage](#local-file-storage)
    - [Cloud Storage (AWS S3)](#cloud-storage-aws-s3)
  - [Upload Implementation](#upload-implementation)
    - [Single File Upload Handler](#single-file-upload-handler)
    - [Chunked Upload for Large Files](#chunked-upload-for-large-files)
- [File Download Patterns](#file-download-patterns)
  - [Download Endpoint Design](#download-endpoint-design)
    - [Direct File Download](#direct-file-download)
    - [Download with Access Control](#download-with-access-control)
    - [Streaming Download for Large Files](#streaming-download-for-large-files)
  - [Download Implementation](#download-implementation)
    - [Secure File Download](#secure-file-download)
    - [Range-Based Download (Resumable)](#range-based-download-resumable)
    - [Temporary Download URLs](#temporary-download-urls)
- [Security Considerations](#security-considerations)
  - [Upload Security](#upload-security)
  - [Download Security](#download-security)
- [Best Practices](#best-practices)
  - [Performance Optimization](#performance-optimization)
  - [Storage Management](#storage-management)
  - [Error Handling](#error-handling)
- [Resources](#resources)

## Purpose

This document defines comprehensive patterns for handling file uploads and downloads in REST-SPEC APIs.
It covers security considerations, validation rules, storage strategies, and implementation patterns
for reliable file handling.

## File Upload Patterns

### Upload Endpoint Design

#### Single File Upload

```http
POST /api/files
Content-Type: multipart/form-data
Authorization: Bearer jwt-token-here
X-Correlation-ID: correlation-id-here

Content-Disposition: form-data; name="file"; filename="document.pdf"
Content-Type: application/pdf

[Binary file content]
```

#### Multiple File Upload

```http
POST /api/files/batch
Content-Type: multipart/form-data
Authorization: Bearer jwt-token-here

Content-Disposition: form-data; name="files[]"; filename="file1.jpg"
Content-Type: image/jpeg
[Binary content for file1]

Content-Disposition: form-data; name="files[]"; filename="file2.jpg"
Content-Type: image/jpeg
[Binary content for file2]
```

#### Upload with Metadata

```http
POST /api/files
Content-Type: multipart/form-data

Content-Disposition: form-data; name="metadata"
Content-Type: application/json

{
  "description": "Profile image",
  "category": "avatar",
  "isPublic": true
}

Content-Disposition: form-data; name="file"; filename="avatar.jpg"
Content-Type: image/jpeg
[Binary file content]
```

### Upload Response Format

#### Successful Upload Response

```json
{
  "data": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "filename": "document.pdf",
    "originalName": "Annual Report 2024.pdf",
    "mimeType": "application/pdf",
    "size": 2048576,
    "url": "https://cdn.example.com/files/f47ac10b-58cc-4372-a567-0e02b2c3d479.pdf",
    "thumbnailUrl": "https://cdn.example.com/thumbnails/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg",
    "uploadedAt": "2024-01-15T10:30:00Z",
    "expiresAt": "2025-01-15T10:30:00Z",
    "metadata": {
      "description": "Annual company report",
      "category": "document"
    }
  }
}
```

#### Upload Error Response

```json
{
  "error": {
    "code": "upload_failed",
    "message": "File upload validation failed",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "params": [
      {
        "param": "file",
        "message": "File size exceeds maximum limit of 50MB"
      },
      {
        "param": "mimeType",
        "message": "File type 'application/exe' is not allowed"
      }
    ]
  }
}
```

### File Validation Patterns

#### Server-Side Validation

```javascript
const multer = require("multer");
const crypto = require("crypto");

// File validation middleware
const fileValidation = {
  // MIME type validation
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],

  // File size limits by type
  sizeLimits: {
    "image/*": 10 * 1024 * 1024, // 10MB for images
    "application/pdf": 50 * 1024 * 1024, // 50MB for PDFs
    default: 5 * 1024 * 1024, // 5MB default
  },

  // File extension validation
  allowedExtensions: [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".pdf",
    ".txt",
    ".doc",
    ".docx",
  ],

  // Validate file
  validateFile: (file) => {
    const errors = [];

    // Check MIME type
    if (!fileValidation.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`File type '${file.mimetype}' is not allowed`);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!fileValidation.allowedExtensions.includes(ext)) {
      errors.push(`File extension '${ext}' is not allowed`);
    }

    // Check file size
    const sizeLimit = fileValidation.getSizeLimit(file.mimetype);
    if (file.size > sizeLimit) {
      errors.push(
        `File size exceeds maximum limit of ${sizeLimit / 1024 / 1024}MB`,
      );
    }

    // Check for malicious content (basic check)
    if (fileValidation.containsMaliciousContent(file)) {
      errors.push("File contains potentially malicious content");
    }

    return errors;
  },

  getSizeLimit: (mimeType) => {
    for (const pattern in fileValidation.sizeLimits) {
      if (pattern === "default") continue;
      if (mimeType.match(new RegExp(pattern.replace("*", ".*")))) {
        return fileValidation.sizeLimits[pattern];
      }
    }
    return fileValidation.sizeLimits.default;
  },

  containsMaliciousContent: (file) => {
    // Basic malicious content detection
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
    ];

    // For text files, check content
    if (file.mimetype.startsWith("text/")) {
      const content = file.buffer?.toString() || "";
      return maliciousPatterns.some((pattern) => pattern.test(content));
    }

    return false;
  },
};
```

#### Content-Based Validation

```javascript
const fileType = require("file-type");

// Validate file content matches extension
const validateFileContent = async (buffer, filename) => {
  const detectedType = await fileType.fromBuffer(buffer);
  const extension = path.extname(filename).toLowerCase();

  const extensionMimeMap = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
  };

  const expectedMime = extensionMimeMap[extension];

  if (expectedMime && detectedType?.mime !== expectedMime) {
    throw new ValidationError(
      `File content does not match extension. Expected ${expectedMime}, ` +
        `got ${detectedType?.mime}`,
    );
  }

  return detectedType;
};
```

### Storage Strategies

#### Local File Storage

```javascript
const multer = require("multer");
const path = require("path");

// Local storage configuration
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(
      __dirname,
      "../uploads",
      new Date().getFullYear().toString(),
    );
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const extension = path.extname(file.originalname);
    const filename = `${uniqueId}${extension}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage: localStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10, // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    const errors = fileValidation.validateFile(file);
    if (errors.length > 0) {
      return cb(new ValidationError(errors.join(", ")));
    }
    cb(null, true);
  },
});
```

#### Cloud Storage (AWS S3)

```javascript
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3Storage = multerS3({
  s3: s3,
  bucket: process.env.S3_BUCKET_NAME,

  // Generate unique key for each file
  key: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const extension = path.extname(file.originalname);
    const key = `uploads/${new Date().getFullYear()}/${uniqueId}${extension}`;
    cb(null, key);
  },

  // Set content type
  contentType: multerS3.AUTO_CONTENT_TYPE,

  // Set metadata
  metadata: (req, file, cb) => {
    cb(null, {
      originalName: file.originalname,
      uploadedBy: req.user.id,
      uploadedAt: new Date().toISOString(),
    });
  },
});

const s3Upload = multer({
  storage: s3Storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const errors = fileValidation.validateFile(file);
    if (errors.length > 0) {
      return cb(new ValidationError(errors.join(", ")));
    }
    cb(null, true);
  },
});
```

### Upload Implementation

#### Single File Upload Handler

```javascript
app.post("/api/files", upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      throw new ValidationError("No file provided");
    }

    // Additional content validation
    const detectedType = await validateFileContent(
      file.buffer,
      file.originalname,
    );

    // Save file metadata to database
    const fileRecord = await File.create({
      id: crypto.randomUUID(),
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      url: generatePublicUrl(file),
      uploadedBy: req.user.id,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
    });

    // Generate thumbnail for images
    if (file.mimetype.startsWith("image/")) {
      const thumbnailUrl = await generateThumbnail(file);
      await fileRecord.update({ thumbnailUrl });
    }

    res.status(201).json({
      data: {
        id: fileRecord.id,
        filename: fileRecord.filename,
        originalName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        size: fileRecord.size,
        url: fileRecord.url,
        thumbnailUrl: fileRecord.thumbnailUrl,
        uploadedAt: fileRecord.createdAt,
        metadata: fileRecord.metadata,
      },
    });
  } catch (error) {
    next(error);
  }
});
```

#### Chunked Upload for Large Files

```javascript
// Initialize chunked upload
app.post("/api/files/chunked/init", async (req, res) => {
  try {
    const { filename, totalSize, chunkCount } = req.body;

    // Validate total size
    if (totalSize > 100 * 1024 * 1024) {
      // 100MB limit
      throw new ValidationError("File too large for chunked upload");
    }

    const uploadSession = await UploadSession.create({
      id: crypto.randomUUID(),
      filename,
      totalSize,
      chunkCount,
      uploadedBy: req.user.id,
      status: "initialized",
    });

    res.status(201).json({
      data: {
        sessionId: uploadSession.id,
        chunkSize: 1024 * 1024, // 1MB chunks
        totalChunks: chunkCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Upload individual chunk
app.post(
  "/api/files/chunked/:sessionId/chunks/:chunkNumber",
  upload.single("chunk"),
  async (req, res) => {
    try {
      const { sessionId, chunkNumber } = req.params;
      const chunk = req.file;

      const session = await UploadSession.findByPk(sessionId);
      if (!session) {
        throw new NotFoundError("Upload session not found");
      }

      // Save chunk
      await UploadChunk.create({
        sessionId,
        chunkNumber: parseInt(chunkNumber),
        path: chunk.path,
        size: chunk.size,
      });

      // Check if all chunks uploaded
      const uploadedChunks = await UploadChunk.count({ where: { sessionId } });
      if (uploadedChunks === session.chunkCount) {
        // Assemble file from chunks
        const assembledFile = await assembleChunkedFile(session);
        await session.update({
          status: "completed",
          filePath: assembledFile.path,
        });
      }

      res.status(200).json({
        data: {
          chunkNumber: parseInt(chunkNumber),
          uploaded: true,
          totalUploaded: uploadedChunks,
          completed: uploadedChunks === session.chunkCount,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
```

## File Download Patterns

### Download Endpoint Design

#### Direct File Download

```http
GET /api/files/{fileId}/download
Authorization: Bearer jwt-token-here
Accept: application/octet-stream
```

#### Download with Access Control

```http
GET /api/files/{fileId}/download?token=download-token
Authorization: Bearer jwt-token-here
```

#### Streaming Download for Large Files

```http
GET /api/files/{fileId}/stream
Authorization: Bearer jwt-token-here
Range: bytes=0-1048575
```

### Download Implementation

#### Secure File Download

```javascript
app.get("/api/files/:fileId/download", async (req, res, next) => {
  try {
    const { fileId } = req.params;

    // Find file record
    const file = await File.findByPk(fileId);
    if (!file) {
      throw new NotFoundError("File not found");
    }

    // Check permissions
    if (!(await hasFileAccess(req.user, file))) {
      throw new UnauthorizedError("Insufficient permissions to download file");
    }

    // Check if file exists on disk/storage
    if (!(await fileExists(file.path))) {
      throw new NotFoundError("File content not found");
    }

    // Set appropriate headers
    res.set({
      "Content-Type": file.mimeType,
      "Content-Length": file.size,
      "Content-Disposition": `attachment; filename="${file.originalName}"`,
      "Cache-Control": "private, max-age=3600",
      "X-File-ID": file.id,
    });

    // Log download activity
    logger.info("File downloaded", {
      correlationId: req.correlationId,
      fileId: file.id,
      userId: req.user.id,
      filename: file.originalName,
      size: file.size,
    });

    // Stream file to response
    const fileStream = fs.createReadStream(file.path);
    fileStream.pipe(res);

    // Handle stream errors
    fileStream.on("error", (error) => {
      logger.error("File stream error", {
        correlationId: req.correlationId,
        fileId: file.id,
        error: error.message,
      });
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: "download_failed",
            message: "Failed to download file",
          },
        });
      }
    });
  } catch (error) {
    next(error);
  }
});
```

#### Range-Based Download (Resumable)

```javascript
app.get("/api/files/:fileId/stream", async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const file = await File.findByPk(fileId);

    if (!file || !(await hasFileAccess(req.user, file))) {
      throw new NotFoundError("File not found");
    }

    const fileSize = file.size;
    const range = req.headers.range;

    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Set partial content headers
      res.status(206).set({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": file.mimeType,
      });

      // Create readable stream with range
      const fileStream = fs.createReadStream(file.path, { start, end });
      fileStream.pipe(res);
    } else {
      // Full file download
      res.set({
        "Content-Length": fileSize,
        "Content-Type": file.mimeType,
      });

      const fileStream = fs.createReadStream(file.path);
      fileStream.pipe(res);
    }
  } catch (error) {
    next(error);
  }
});
```

#### Temporary Download URLs

```javascript
// Generate temporary download URL
app.post("/api/files/:fileId/download-url", async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { expiresIn = 3600 } = req.body; // Default 1 hour

    const file = await File.findByPk(fileId);
    if (!file || !(await hasFileAccess(req.user, file))) {
      throw new NotFoundError("File not found");
    }

    // Generate temporary token
    const downloadToken = jwt.sign(
      {
        fileId: file.id,
        userId: req.user.id,
        type: "download",
      },
      process.env.DOWNLOAD_TOKEN_SECRET,
      { expiresIn },
    );

    const downloadUrl = `${req.protocol}://${req.get("host")}/api/files/${fileId}/download?token=${downloadToken}`;

    res.json({
      data: {
        downloadUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        fileId: file.id,
        filename: file.originalName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Download with temporary token
app.get("/api/files/:fileId/download", async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { token } = req.query;

    if (token) {
      // Verify temporary download token
      const decoded = jwt.verify(token, process.env.DOWNLOAD_TOKEN_SECRET);
      if (decoded.fileId !== fileId || decoded.type !== "download") {
        throw new UnauthorizedError("Invalid download token");
      }
      req.user = { id: decoded.userId }; // Set user from token
    }

    // Continue with normal download logic...
  } catch (error) {
    next(error);
  }
});
```

## Security Considerations

### Upload Security

- **File Type Validation**: Validate both MIME type and file extension
- **Content Scanning**: Scan uploaded files for malware
- **Size Limits**: Enforce reasonable file size limits
- **Storage Isolation**: Store uploads outside web root
- **Access Control**: Implement proper file access permissions

### Download Security

- **Authentication**: Require valid authentication for file access
- **Authorization**: Check user permissions for specific files
- **Rate Limiting**: Limit download frequency per user
- **Audit Logging**: Log all file access attempts
- **Content Security**: Set appropriate headers to prevent XSS

## Best Practices

### Performance Optimization

- **Streaming**: Use streams for large file uploads/downloads
- **Chunking**: Implement chunked upload for large files
- **Caching**: Cache file metadata and thumbnails
- **CDN Integration**: Use CDN for public file distribution
- **Compression**: Compress files when appropriate

### Storage Management

- **File Lifecycle**: Implement file expiration and cleanup
- **Backup Strategy**: Regular backup of uploaded files
- **Storage Monitoring**: Monitor storage usage and capacity
- **Redundancy**: Implement file redundancy for critical files
- **Cost Optimization**: Use appropriate storage tiers

### Error Handling

- **Graceful Failures**: Handle upload/download failures gracefully
- **Retry Logic**: Implement retry mechanisms for failed uploads
- **Progress Tracking**: Provide upload/download progress feedback
- **Cleanup**: Clean up partial uploads on failure
- **User Feedback**: Provide clear error messages to users

## Resources

- [Multer Documentation](https://github.com/expressjs/multer)
- [AWS S3 Upload Guide](<https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/>
  s3-example-photo-album.html)
- [File Upload Security Best Practices](<https://owasp.org/www-community/vulnerabilities/>
  Unrestricted_File_Upload)
- [HTTP Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)
- [JWT for Download Tokens](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
