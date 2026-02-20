import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth-jwt.js';
import {
  createDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  queryDocuments,
  MODELS,
  COLLECTIONS
} from '../services/mongodb.js';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl } from '../config/cloudinary.js';

const router = express.Router();

// Use memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

// Allowed MIME types for upload
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  // Office documents (docx, xlsx, pptx, etc.)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
];

// File filter — reject disallowed types
const fileFilter = (_req, file, cb) => {
  const isAllowed =
    ALLOWED_MIME_TYPES.includes(file.mimetype) ||
    file.mimetype.startsWith('image/');

  if (isAllowed) {
    cb(null, true);
  } else {
    const err = new Error(
      `File type '${file.mimetype}' is not allowed. ` +
      'Accepted types: PDF, images, Office documents, and plain text.'
    );
    err.status = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Folders CRUD - All routes require authentication
router.get('/folders', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    if (!ownerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const folders = await queryDocuments(
      MODELS.FOLDERS,
      [{ field: 'ownerId', operator: '==', value: ownerId }],
      { field: 'createdAt', direction: 'desc' }
    );

    // Transform folders to match frontend expectations (_id instead of id)
    const transformedFolders = folders.map(folder => ({
      ...folder,
      _id: folder.id,
      caseId: folder.caseId || null,
      createdAt: folder.createdAt?.toDate ? folder.createdAt.toDate().toISOString() : folder.createdAt
    }));

    res.json({ folders: transformedFolders });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

router.post('/folders', requireAuth, async (req, res) => {
  try {
    const { name, parentId, caseId } = req.body;
    const ownerId = req.user.userId;

    if (!name || !ownerId) {
      return res.status(400).json({ error: 'Folder name and user authentication required' });
    }

    // Check for duplicate folder name within the same parent folder
    const foldersInParent = await queryDocuments(COLLECTIONS.FOLDERS, [
      { field: 'ownerId', operator: '==', value: ownerId },
      { field: 'parentId', operator: '==', value: parentId || null }
    ]);

    const duplicateName = foldersInParent.find(f =>
      f.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (duplicateName) {
      return res.status(409).json({
        error: `A folder named "${name}" already exists in this location. Please choose a different name.`
      });
    }

    // Check for duplicate caseId if provided (each case should have only one root folder)
    if (caseId) {
      const existingFolders = await queryDocuments(COLLECTIONS.FOLDERS, [
        { field: 'ownerId', operator: '==', value: ownerId },
        { field: 'caseId', operator: '==', value: caseId }
      ]);

      if (existingFolders.length > 0) {
        return res.status(409).json({
          error: `A folder already exists for this case. Each case can only have one folder. Please use the existing folder or update it.`
        });
      }
    }

    const folder = await createDocument(COLLECTIONS.FOLDERS, {
      name: name.trim(),
      parentId: parentId || null,
      ownerId,
      caseId: caseId || null
    });

    // Transform folder to match frontend expectations (_id instead of id)
    const transformedFolder = {
      ...folder,
      _id: folder.id,
      createdAt: folder.createdAt?.toDate ? folder.createdAt.toDate().toISOString() : folder.createdAt
    };

    res.status(201).json({ folder: transformedFolder });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

router.put('/folders/:id', requireAuth, async (req, res) => {
  try {
    const { name, caseId } = req.body;
    const ownerId = req.user.userId;

    if (!name || !ownerId) {
      return res.status(400).json({ error: 'Folder name and user authentication required' });
    }

    const existing = await getDocumentById(COLLECTIONS.FOLDERS, req.params.id);
    // Compare as strings to handle ObjectId vs string inconsistencies
    if (!existing || String(existing.ownerId) !== String(ownerId)) {
      return res.status(404).json({ error: 'Folder not found or access denied' });
    }

    // Check for duplicate folder name within the same parent folder (excluding current folder)
    const foldersInParent = await queryDocuments(COLLECTIONS.FOLDERS, [
      { field: 'ownerId', operator: '==', value: ownerId },
      { field: 'parentId', operator: '==', value: existing.parentId || null }
    ]);

    const duplicateName = foldersInParent.find(f =>
      f.id !== req.params.id &&
      f.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (duplicateName) {
      return res.status(409).json({
        error: `A folder named "${name}" already exists in this location. Please choose a different name.`
      });
    }

    // Check for duplicate caseId if being updated (excluding current folder)
    if (caseId !== undefined && caseId !== null) {
      const existingFolders = await queryDocuments(COLLECTIONS.FOLDERS, [
        { field: 'ownerId', operator: '==', value: ownerId },
        { field: 'caseId', operator: '==', value: caseId }
      ]);

      // Filter out the current folder being updated
      const duplicateFolders = existingFolders.filter(f => f.id !== req.params.id);
      if (duplicateFolders.length > 0) {
        return res.status(409).json({
          error: `A folder already exists for this case. Each case can only have one folder. Please use the existing folder.`
        });
      }
    }

    const updateData = { name: name.trim() };
    if (caseId !== undefined) {
      updateData.caseId = caseId || null;
    }

    const folder = await updateDocument(COLLECTIONS.FOLDERS, req.params.id, updateData);

    // Transform folder to match frontend expectations (_id instead of id)
    const transformedFolder = {
      ...folder,
      _id: folder.id,
      createdAt: folder.createdAt?.toDate ? folder.createdAt.toDate().toISOString() : folder.createdAt
    };

    res.json({ folder: transformedFolder });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

router.delete('/folders/:id', requireAuth, async (req, res) => {
  try {
    const folderId = req.params.id;
    const ownerId = req.user.userId;

    if (!ownerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const folder = await getDocumentById(COLLECTIONS.FOLDERS, folderId);
    // Compare as strings to handle ObjectId vs string inconsistencies
    if (!folder || String(folder.ownerId) !== String(ownerId)) {
      return res.status(404).json({ error: 'Folder not found or access denied' });
    }

    // Get all documents in this folder to clean up Cloudinary assets
    const docs = await queryDocuments(COLLECTIONS.DOCUMENTS, [
      { field: 'folderId', operator: '==', value: folderId },
      { field: 'ownerId', operator: '==', value: ownerId }
    ]);

    // Delete Cloudinary assets (still per-file as each has a unique public ID)
    const cloudinaryDeletions = docs
      .filter(doc => doc.url && (doc.url.includes('cloudinary.com') || doc.cloudinaryPublicId))
      .map(async (doc) => {
        try {
          const publicId = doc.cloudinaryPublicId || extractPublicIdFromUrl(doc.url);
          if (publicId) await deleteFromCloudinary(publicId, doc.resourceType || 'auto');
        } catch (e) {
          console.error('Failed to delete Cloudinary asset:', e);
        }
      });
    await Promise.allSettled(cloudinaryDeletions);

    // 16. Fix N+1: bulk delete all documents in folder with a single query
    // instead of looping and calling deleteDocument() for each one
    const { Document } = await import('../models/index.js').catch(() => ({}));
    if (Document) {
      await Document.deleteMany({ folderId, ownerId });
    } else {
      // Fallback: use service-level delete if Mongoose model unavailable
      for (const doc of docs) {
        try { await deleteDocument(COLLECTIONS.DOCUMENTS, doc.id); } catch (_e) { /* continue */ }
      }
    }

    await deleteDocument(COLLECTIONS.FOLDERS, folderId);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Documents CRUD - All routes require authentication
router.get('/files', requireAuth, async (req, res) => {
  try {
    const { folderId, all } = req.query;
    const ownerId = req.user.userId;

    if (!ownerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const filters = [{ field: 'ownerId', operator: '==', value: ownerId }];

    // If 'all=true' is specified, return ALL files for this user (for statistics)
    if (all === 'true') {
      console.log('📊 Fetching ALL files for statistics');
      const files = await queryDocuments(
        COLLECTIONS.DOCUMENTS,
        filters,
        { field: 'createdAt', direction: 'desc' }
      );

      const transformedFiles = files.map(file => {
        const transformed = {
          ...file,
          _id: file.id,
          createdAt: file.createdAt?.toDate ? file.createdAt.toDate().toISOString() : file.createdAt
        };
        if (file.folderId !== undefined) {
          transformed.folderId = file.folderId;
        }
        return transformed;
      });

      console.log(`📋 Returning ${transformedFiles.length} total files for statistics`);
      return res.json({ files: transformedFiles });
    }

    // Otherwise, filter by folderId as before
    // If folderId is provided, filter by it. If folderId is 'null' or empty, get root files (folderId is null)
    if (folderId && folderId !== 'null' && folderId !== 'undefined' && folderId !== '') {
      filters.push({ field: 'folderId', operator: '==', value: folderId });
    } else {
      // Get files with no folder (root level)
      filters.push({ field: 'folderId', operator: '==', value: null });
    }

    const files = await queryDocuments(
      COLLECTIONS.DOCUMENTS,
      filters,
      { field: 'createdAt', direction: 'desc' }
    );

    // Transform files to match frontend expectations (_id instead of id)
    const transformedFiles = files.map(file => {
      const transformed = {
        ...file,
        _id: file.id,
        createdAt: file.createdAt?.toDate ? file.createdAt.toDate().toISOString() : file.createdAt
      };
      // Ensure folderId is explicitly included
      if (file.folderId !== undefined) {
        transformed.folderId = file.folderId;
      }
      return transformed;
    });

    console.log(`📋 Returning ${transformedFiles.length} files for folderId: ${folderId || 'null'}`);
    res.json({ files: transformedFiles });
  } catch (error) {
    console.error('Get files error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message
    });
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// View a specific document (proxy to serve inline for browser viewing)
router.get('/files/:id/view', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    if (!ownerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const doc = await getDocumentById(COLLECTIONS.DOCUMENTS, req.params.id);

    // Compare as strings to handle ObjectId vs string inconsistencies
    if (!doc || String(doc.ownerId) !== String(ownerId)) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    console.log(`👁️  View requested: ${doc.name}`);

    // Fetch from Cloudinary and serve with inline disposition
    if (doc.url && (doc.url.startsWith('http://') || doc.url.startsWith('https://'))) {
      try {
        const response = await fetch(doc.url);

        if (!response.ok) {
          throw new Error(`Failed to fetch file from storage: ${response.statusText}`);
        }

        // Set headers for inline viewing (open in browser, not download)
        res.setHeader('Content-Type', doc.mimetype || 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${doc.name}"`);
        if (doc.size) {
          res.setHeader('Content-Length', doc.size);
        }

        // Pipe the file data to response
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));

        console.log(`✅ View served: ${doc.name}`);
      } catch (fetchError) {
        console.error('Error fetching file from storage:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch file from storage' });
      }
    } else {
      return res.status(400).json({ error: 'File URL not found or invalid' });
    }
  } catch (error) {
    console.error('View document error:', error);
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
});

// Download a specific document (proxy to handle CORS and filename issues)
router.get('/files/:id/download', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    if (!ownerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const doc = await getDocumentById(COLLECTIONS.DOCUMENTS, req.params.id);

    // Compare as strings to handle ObjectId vs string inconsistencies
    if (!doc || String(doc.ownerId) !== String(ownerId)) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    console.log(`📥 Download requested: ${doc.name}`);

    // If the URL is a Cloudinary URL, fetch it and pipe it to the response
    if (doc.url && (doc.url.startsWith('http://') || doc.url.startsWith('https://'))) {
      try {
        // Fetch the file from Cloudinary
        const response = await fetch(doc.url);

        if (!response.ok) {
          throw new Error(`Failed to fetch file from storage: ${response.statusText}`);
        }

        // Sanitize filename to avoid header injection
        const sanitizedName = doc.name.replace(/[^\x20-\x7E]/g, '').trim() || 'document';

        // Set proper headers for download with original filename
        res.setHeader('Content-Type', doc.mimetype || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${sanitizedName}"`);
        res.setHeader('Content-Length', doc.size);

        // Pipe the file data to response
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));

        console.log(`✅ Download completed: ${sanitizedName}`);
      } catch (fetchError) {
        console.error('Error fetching file from storage:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch file from storage' });
      }
    } else {
      // For local files (if any), return error as we only support cloud storage
      return res.status(400).json({ error: 'File URL not found or invalid' });
    }
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
});



router.post('/upload', requireAuth, upload.array('files'), async (req, res) => {
  try {
    // Parse folderId - handle empty string, null, undefined
    let folderId = req.body.folderId;
    if (folderId === '' || folderId === 'null' || folderId === 'undefined') {
      folderId = null;
    }

    const ownerId = req.user.userId;

    console.log('📤 Upload request:', {
      ownerId,
      folderId,
      fileCount: req.files?.length || 0,
      hasFiles: !!req.files
    });

    if (!ownerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!req.files || req.files.length === 0) {
      console.error('❌ No files in request');
      return res.status(400).json({ error: 'No files provided' });
    }

    // Verify folder exists if folderId is provided
    if (folderId) {
      try {
        const folder = await getDocumentById(COLLECTIONS.FOLDERS, folderId);
        // Compare as strings to handle ObjectId vs string inconsistencies
        if (!folder || String(folder.ownerId) !== String(ownerId)) {
          console.error(`❌ Folder not found or access denied: ${folderId}`);
          return res.status(404).json({ error: 'Folder not found or access denied' });
        }
        console.log(`✅ Folder verified: ${folder.name}`);
      } catch (folderError) {
        console.error('❌ Error verifying folder:', folderError);
        return res.status(500).json({ error: 'Failed to verify folder' });
      }
    }

    const saved = [];
    const errors = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        console.log(`📁 Uploading file ${i + 1}/${req.files.length}: ${file.originalname} (${file.size} bytes)`);

        // Upload to Cloudinary
        const cloudinaryFolder = `lawyer-zen/user-${ownerId}${folderId ? `/folder-${folderId}` : ''}`;
        console.log(`☁️  Cloudinary folder: ${cloudinaryFolder}`);

        // Determine resource type based on mimetype
        // PDFs and other documents should be 'raw', images/videos use 'auto'
        const isDocument = file.mimetype === 'application/pdf' ||
          file.mimetype.startsWith('application/') ||
          file.mimetype === 'text/plain' ||
          file.mimetype.includes('document') ||
          file.mimetype.includes('spreadsheet');

        const resourceType = isDocument ? 'raw' : 'auto';
        console.log(`📄 File type: ${file.mimetype}, Resource type: ${resourceType}`);

        const uploadResult = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          cloudinaryFolder,
          {
            public_id: undefined, // Let Cloudinary generate unique ID
            resource_type: resourceType, // Use correct resource type for documents
          }
        );

        console.log(`✅ Cloudinary upload successful:`, {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url,
          resource_type: uploadResult.resource_type
        });

        // Create document record in MongoDB
        const docData = {
          name: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: uploadResult.secure_url,
          cloudinaryPublicId: uploadResult.public_id,
          resourceType: uploadResult.resource_type,
          folderId: folderId || null,
          ownerId,
          tags: [],
        };

        console.log(`💾 Saving to MongoDB:`, docData);
        const doc = await createDocument(COLLECTIONS.DOCUMENTS, docData);

        console.log(`✅ File saved successfully:`, doc.id);
        saved.push(doc);
      } catch (uploadError) {
        console.error(`❌ Error uploading file ${file.originalname}:`, uploadError);
        console.error('Error details:', {
          message: uploadError.message,
          code: uploadError.code,
          stack: uploadError.stack
        });

        // Extract the most helpful error message
        let errorMessage = uploadError.message || 'Upload failed';

        // If it's a Cloudinary configuration error, make it more user-friendly
        if (errorMessage.includes('Cloudinary') || errorMessage.includes('CLOUDINARY')) {
          errorMessage = errorMessage.replace(/at.*$/gm, '').trim(); // Remove stack trace from message
        }

        errors.push({
          fileName: file.originalname,
          error: errorMessage
        });
        // Continue with other files even if one fails
      }
    }

    if (saved.length === 0) {
      console.error('❌ All uploads failed');

      // Get the most common error message
      const commonError = errors.length > 0 ? errors[0].error : 'Unknown error';

      return res.status(500).json({
        error: commonError.includes('Cloudinary')
          ? commonError
          : `Failed to upload any files: ${commonError}`,
        errors: errors,
        help: commonError.includes('Cloudinary')
          ? 'Please check your Cloudinary credentials in backend/.env file. Get them from: https://cloudinary.com/console'
          : undefined
      });
    }

    console.log(`✅ Upload complete: ${saved.length}/${req.files.length} files uploaded successfully`);

    // Transform saved files to match frontend expectations (_id instead of id)
    const transformedFiles = saved.map(file => {
      const transformed = {
        ...file,
        _id: file.id,
        createdAt: file.createdAt?.toDate ? file.createdAt.toDate().toISOString() : file.createdAt
      };
      // Ensure folderId is explicitly included
      if (file.folderId !== undefined) {
        transformed.folderId = file.folderId;
      }
      console.log(`📋 Transformed file for response:`, {
        _id: transformed._id,
        name: transformed.name,
        folderId: transformed.folderId,
        url: transformed.url
      });
      return transformed;
    });

    res.status(201).json({
      files: transformedFiles,
      ...(errors.length > 0 && {
        warnings: `${errors.length} file(s) failed to upload`,
        errors: errors
      })
    });
  } catch (error) {
    console.error('❌ Upload files error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to upload files',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        code: error.code
      })
    });
  }
});

router.put('/files/:id', requireAuth, async (req, res) => {
  try {
    const { name, tags, folderId } = req.body;
    const ownerId = req.user.userId;

    if (!ownerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const existing = await getDocumentById(COLLECTIONS.DOCUMENTS, req.params.id);
    // Compare as strings to handle ObjectId vs string inconsistencies
    if (!existing || String(existing.ownerId) !== String(ownerId)) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (tags !== undefined) updates.tags = tags;
    if (folderId !== undefined) updates.folderId = folderId || null;

    const doc = await updateDocument(COLLECTIONS.DOCUMENTS, req.params.id, updates);

    // Transform file to match frontend expectations (_id instead of id)
    const transformedFile = {
      ...doc,
      _id: doc.id,
      createdAt: doc.createdAt?.toDate ? doc.createdAt.toDate().toISOString() : doc.createdAt
    };

    res.json({ file: transformedFile });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ error: 'Failed to update file' });
  }
});

router.delete('/files/:id', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    if (!ownerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const doc = await getDocumentById(COLLECTIONS.DOCUMENTS, req.params.id);
    // Compare as strings to handle ObjectId vs string inconsistencies
    if (!doc || String(doc.ownerId) !== String(ownerId)) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }

    // Delete from Cloudinary if URL is a Cloudinary URL
    try {
      if (doc.url && (doc.url.includes('cloudinary.com') || doc.cloudinaryPublicId)) {
        const publicId = doc.cloudinaryPublicId || extractPublicIdFromUrl(doc.url);
        if (publicId) {
          await deleteFromCloudinary(publicId, doc.resourceType || 'auto');
        }
      }
    } catch (e) {
      console.error('Failed to delete file from Cloudinary:', e);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    await deleteDocument(COLLECTIONS.DOCUMENTS, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;


