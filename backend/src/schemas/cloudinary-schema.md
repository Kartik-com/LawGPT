# Cloudinary Media Storage Schema

This document describes the Cloudinary storage schema and structure for the Lawyer Zen application.

## Overview

Cloudinary is used to securely store and serve all media files (documents, images, videos, etc.) for the application. Files are organized in folders by user and case/folder structure.

## Cloudinary Folder Structure

```
lawyer-zen/
  ├── user-{userId}/
  │   ├── folder-{folderId}/
  │   │   ├── document-1.pdf
  │   │   ├── image-1.jpg
  │   │   └── video-1.mp4
  │   └── document-2.pdf
  └── shared/
      └── common-resources/
```

## Document Model Schema

The MongoDB Document model stores metadata about files stored in Cloudinary:

```javascript
{
  _id: ObjectId,                  // MongoDB document ID
  name: string,                   // Original file name
  mimetype: string,               // MIME type (e.g., 'application/pdf')
  size: number,                   // File size in bytes
  url: string,                    // Cloudinary secure URL
  cloudinaryPublicId: string,     // Cloudinary public ID (for deletion)
  resourceType: string,           // 'image' | 'video' | 'raw' | 'auto'
  folderId: ObjectId,             // Reference to Folder (optional)
  ownerId: ObjectId,              // Reference to User (required)
  tags: [string],                 // Searchable tags
  createdAt: Date,                // Upload timestamp
  updatedAt: Date                 // Last update timestamp
}
```

## Cloudinary Upload Response

When a file is uploaded to Cloudinary, the response includes:

```javascript
{
  public_id: string,              // Public ID (e.g., 'lawyer-zen/user-123/document-abc')
  secure_url: string,             // HTTPS URL for the file
  url: string,                    // HTTP URL (use secure_url instead)
  resource_type: string,          // 'image' | 'video' | 'raw' | 'auto'
  format: string,                // File format (e.g., 'pdf', 'jpg', 'mp4')
  width: number,                 // Image/video width (if applicable)
  height: number,                 // Image/video height (if applicable)
  bytes: number,                  // File size in bytes
  created_at: string,            // Upload timestamp
  etag: string,                  // Entity tag for caching
  version: number,               // Version number
  signature: string              // Upload signature
}
```

## File Upload Flow

### 1. Client Upload Request

```javascript
// Client sends file(s) via FormData
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);
formData.append('folderId', folderId); // Optional

fetch('/api/documents/upload', {
  method: 'POST',
  body: formData,
  credentials: 'include'
});
```

### 2. Server Processing

```javascript
// 1. Receive file buffer from multer
const fileBuffer = req.files[0].buffer;

// 2. Upload to Cloudinary
const uploadResult = await uploadToCloudinary(
  fileBuffer,
  file.originalname,
  `lawyer-zen/user-${userId}/folder-${folderId}`,
  { resource_type: 'auto' }
);

// 3. Save metadata to MongoDB
const document = await Document.create({
  name: file.originalname,
  mimetype: file.mimetype,
  size: file.size,
  url: uploadResult.secure_url,
  cloudinaryPublicId: uploadResult.public_id,
  resourceType: uploadResult.resource_type,
  folderId: folderId,
  ownerId: userId
});
```

## File Deletion Flow

### 1. Delete Single File

```javascript
// 1. Find document in MongoDB
const doc = await Document.findById(documentId);

// 2. Delete from Cloudinary
await deleteFromCloudinary(
  doc.cloudinaryPublicId,
  doc.resourceType
);

// 3. Delete from MongoDB
await doc.deleteOne();
```

### 2. Delete Folder (with all files)

```javascript
// 1. Find all documents in folder
const docs = await Document.find({ folderId, ownerId });

// 2. Delete each file from Cloudinary
for (const doc of docs) {
  await deleteFromCloudinary(doc.cloudinaryPublicId, doc.resourceType);
  await doc.deleteOne();
}

// 3. Delete folder
await Folder.findByIdAndDelete(folderId);
```

## Supported File Types

Cloudinary automatically detects and handles:

- **Images**: JPG, PNG, GIF, WebP, SVG, etc.
- **Videos**: MP4, MOV, AVI, WebM, etc.
- **Documents**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, etc.
- **Other**: Any file type (stored as 'raw')

## File Size Limits

- **Default limit**: 100MB per file
- **Cloudinary free tier**: 25MB per file
- **Cloudinary paid tiers**: Up to 100MB per file

Configure in `multer` options:

```javascript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});
```

## Environment Variables

Required Cloudinary configuration:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Security Considerations

1. **Use secure URLs** (`secure_url`) for all file access
2. **Validate file types** on upload to prevent malicious files
3. **Set file size limits** to prevent abuse
4. **Organize files by user** to enable access control
5. **Delete files from Cloudinary** when deleting from database
6. **Use signed URLs** for private files (if needed)
7. **Enable Cloudinary security settings**:
   - Restrict unsigned uploads
   - Set allowed file formats
   - Configure access control

## Image Transformations

Cloudinary supports on-the-fly image transformations:

```javascript
// Generate thumbnail URL
const thumbnailUrl = getCloudinaryUrl(publicId, {
  width: 200,
  height: 200,
  crop: 'fill',
  quality: 'auto'
});

// Generate optimized image
const optimizedUrl = getCloudinaryUrl(publicId, {
  width: 1200,
  quality: 'auto',
  format: 'auto'
});
```

## Migration from Local Storage

If migrating from local file storage:

1. Upload existing files to Cloudinary
2. Update Document records with Cloudinary URLs
3. Update file serving routes to redirect to Cloudinary
4. Remove local uploads directory after migration





