import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Validate Cloudinary configuration
function validateCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // Check if cloud name is missing or placeholder
  if (!cloudName || cloudName === 'your-cloud-name' || cloudName.trim() === '') {
    throw new Error('CLOUDINARY_CLOUD_NAME is not configured. Please set it in your .env file.');
  }

  // Validate cloud name format (Cloudinary cloud names are typically 3-27 characters, alphanumeric and hyphens only)
  // Invalid patterns: contains underscores with UUIDs (like mediaflows_xxx), too long, etc.
  const cloudNamePattern = /^[a-z0-9-]{3,27}$/i;
  if (!cloudNamePattern.test(cloudName)) {
    throw new Error(
      `Invalid Cloudinary Cloud Name format: "${cloudName}". ` +
      `Cloud names should be 3-27 characters, alphanumeric and hyphens only. ` +
      `Get your correct cloud name from: https://cloudinary.com/console`
    );
  }

  // Check if API key is missing or placeholder
  if (!apiKey || apiKey === 'your-api-key' || apiKey.trim() === '') {
    throw new Error('CLOUDINARY_API_KEY is not configured. Please set it in your .env file.');
  }

  // Basic API key validation - should be numeric and reasonable length
  // We'll let Cloudinary itself validate the actual format when uploading
  if (!/^\d+$/.test(apiKey) || apiKey.length < 5) {
    throw new Error(
      `Invalid Cloudinary API Key format: "${apiKey}". ` +
      `API keys should be numeric. Get your correct API key from: https://cloudinary.com/console`
    );
  }

  // Check if API secret is missing or placeholder
  if (!apiSecret || apiSecret === 'your-api-secret' || apiSecret.trim() === '') {
    throw new Error('CLOUDINARY_API_SECRET is not configured. Please set it in your .env file.');
  }

  // Basic validation - just check it's not too short (Cloudinary secrets are typically at least 10 chars)
  // We'll let Cloudinary itself validate the actual format when uploading
  if (apiSecret.length < 10) {
    throw new Error(
      `Invalid Cloudinary API Secret: too short. ` +
      `API secrets should be at least 10 characters. ` +
      `Get your correct API secret from: https://cloudinary.com/console`
    );
  }

  return { cloudName, apiKey, apiSecret };
}

// Configure Cloudinary with validation
// Note: We validate but don't block server startup - actual validation happens on upload
let cloudinaryConfigured = false;
try {
  const config = validateCloudinaryConfig();
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
  });
  cloudinaryConfigured = true;
  console.log('✅ Cloudinary configured successfully');
} catch (error) {
  console.warn('⚠️  Cloudinary configuration warning:', error.message);
  console.warn('⚠️  File uploads will fail until credentials are corrected.');
  console.warn('⚠️  Get your credentials from: https://cloudinary.com/console');
  // Don't throw here - let it fail when trying to upload, so we can provide better error messages
  // We'll validate again on upload attempt
}

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - Original file name
 * @param {string} folder - Cloudinary folder path (optional)
 * @param {Object} options - Additional Cloudinary options
 * @returns {Promise<Object>} Cloudinary upload result
 */
export async function uploadToCloudinary(fileBuffer, fileName, folder = 'lawyer-zen', options = {}) {
  // Validate configuration before attempting upload
  try {
    validateCloudinaryConfig();
  } catch (configError) {
    throw new Error(`Cloudinary not configured: ${configError.message}. Please check your .env file.`);
  }

  return new Promise((resolve, reject) => {
    if (!fileBuffer || fileBuffer.length === 0) {
      return reject(new Error('File buffer is empty'));
    }

    const uploadOptions = {
      folder: folder,
      resource_type: 'auto', // Automatically detect image, video, raw, etc.
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      ...options,
    };

    // Convert buffer to stream
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('❌ Cloudinary upload error:', error);
          // Provide more helpful error messages
          if (error.message?.includes('Invalid API Key') || error.http_code === 401) {
            const errorMsg = error.message?.includes('Invalid cloud_name') 
              ? `Invalid Cloudinary Cloud Name: "${process.env.CLOUDINARY_CLOUD_NAME}". ` +
                `Please get your correct cloud name from: https://cloudinary.com/console ` +
                `and update CLOUDINARY_CLOUD_NAME in your .env file.`
              : `Invalid Cloudinary credentials. Please verify all three values in your .env file: ` +
                `CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET. ` +
                `Get them from: https://cloudinary.com/console`;
            reject(new Error(errorMsg));
          } else if (error.message?.includes('Invalid signature')) {
            reject(new Error('Invalid Cloudinary API Secret. Please check your CLOUDINARY_API_SECRET in .env file.'));
          } else if (error.message?.includes('Invalid cloud_name')) {
            reject(new Error(
              `Invalid Cloudinary Cloud Name: "${process.env.CLOUDINARY_CLOUD_NAME}". ` +
              `Please get your correct cloud name from: https://cloudinary.com/console ` +
              `and update CLOUDINARY_CLOUD_NAME in your .env file.`
            ));
          } else {
            reject(new Error(`Cloudinary upload failed: ${error.message || 'Unknown error'}`));
          }
        } else {
          console.log('✅ Cloudinary upload successful:', {
            public_id: result.public_id,
            url: result.secure_url,
            resource_type: result.resource_type
          });
          resolve(result);
        }
      }
    );

    // Create readable stream from buffer
    const readableStream = new Readable();
    readableStream.push(fileBuffer);
    readableStream.push(null);
    
    readableStream.pipe(stream);
  });
}

/**
 * Upload a file from a file path to Cloudinary
 * @param {string} filePath - Path to the file
 * @param {string} folder - Cloudinary folder path (optional)
 * @param {Object} options - Additional Cloudinary options
 * @returns {Promise<Object>} Cloudinary upload result
 */
export async function uploadFileToCloudinary(filePath, folder = 'lawyer-zen', options = {}) {
  try {
    const uploadOptions = {
      folder: folder,
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      ...options,
    };

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type (image, video, raw, etc.)
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteFromCloudinary(publicId, resourceType = 'auto') {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
}

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID or null
 */
export function extractPublicIdFromUrl(url) {
  try {
    // Cloudinary URLs format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{transformations}/{version}/{public_id}.{format}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    if (match) {
      // Remove folder path if present
      return match[1];
    }
    return null;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
}

/**
 * Generate a secure URL for a Cloudinary resource
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Transformation options
 * @returns {string} Secure URL
 */
export function getCloudinaryUrl(publicId, options = {}) {
  return cloudinary.url(publicId, options);
}

export default cloudinary;





