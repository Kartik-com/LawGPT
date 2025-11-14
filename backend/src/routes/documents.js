import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { 
  createDocument, 
  getDocumentById, 
  updateDocument, 
  deleteDocument,
  queryDocuments,
  COLLECTIONS 
} from '../services/firestore.js';
import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl } from '../config/cloudinary.js';

const router = express.Router();

// Use memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

// Folders CRUD - All routes require authentication
router.get('/folders', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    if (!ownerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const folders = await queryDocuments(
      COLLECTIONS.FOLDERS,
      [{ field: 'ownerId', operator: '==', value: ownerId }],
      { field: 'createdAt', direction: 'desc' }
    );
    
    // Transform folders to match frontend expectations (_id instead of id)
    const transformedFolders = folders.map(folder => ({
      ...folder,
      _id: folder.id,
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
    const { name, parentId } = req.body;
    const ownerId = req.user.userId;
    
    if (!name || !ownerId) {
      return res.status(400).json({ error: 'Folder name and user authentication required' });
    }
    
    const folder = await createDocument(COLLECTIONS.FOLDERS, { 
      name: name.trim(), 
      parentId: parentId || null, 
      ownerId 
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
    const { name } = req.body;
    const ownerId = req.user.userId;
    
    if (!name || !ownerId) {
      return res.status(400).json({ error: 'Folder name and user authentication required' });
    }
    
    const existing = await getDocumentById(COLLECTIONS.FOLDERS, req.params.id);
    if (!existing || existing.ownerId !== ownerId) {
      return res.status(404).json({ error: 'Folder not found or access denied' });
    }
    
    const folder = await updateDocument(COLLECTIONS.FOLDERS, req.params.id, { name: name.trim() });
    
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
    if (!folder || folder.ownerId !== ownerId) {
      return res.status(404).json({ error: 'Folder not found or access denied' });
    }
    
    // Delete documents in the folder (only user's documents)
    const docs = await queryDocuments(COLLECTIONS.DOCUMENTS, [
      { field: 'folderId', operator: '==', value: folderId },
      { field: 'ownerId', operator: '==', value: ownerId }
    ]);
    
    for (const doc of docs) {
      try {
        // Delete from Cloudinary if URL is a Cloudinary URL
        if (doc.url && (doc.url.includes('cloudinary.com') || doc.cloudinaryPublicId)) {
          const publicId = doc.cloudinaryPublicId || extractPublicIdFromUrl(doc.url);
          if (publicId) {
            await deleteFromCloudinary(publicId, doc.resourceType || 'auto');
          }
        }
      } catch (e) {
        console.error('Failed to delete file from Cloudinary:', e);
      }
      await deleteDocument(COLLECTIONS.DOCUMENTS, doc.id);
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
    const { folderId } = req.query;
    const ownerId = req.user.userId;
    
    if (!ownerId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const filters = [{ field: 'ownerId', operator: '==', value: ownerId }];
    
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
        if (!folder || folder.ownerId !== ownerId) {
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
        
        const uploadResult = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          cloudinaryFolder,
          {
            public_id: undefined, // Let Cloudinary generate unique ID
          }
        );
        
        console.log(`✅ Cloudinary upload successful:`, {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url,
          resource_type: uploadResult.resource_type
        });
        
        // Create document record in Firestore
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
        
        console.log(`💾 Saving to Firestore:`, docData);
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
    if (!existing || existing.ownerId !== ownerId) {
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
    if (!doc || doc.ownerId !== ownerId) {
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


