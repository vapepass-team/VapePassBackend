import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { cloudinary } from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_LOGO_DIR = path.join(__dirname, '../../public/uploads/logos');

const isCloudinaryConfigured = () =>
  Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

function mimeToExt(mimetype = '') {
  switch (String(mimetype).toLowerCase()) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.png';
  }
}

/**
 * Persist logo locally when Cloudinary is not configured (dev / simple hosts).
 * Files are served from /uploads/logos via express.static(public).
 *
 * Returns a root-relative path — never an absolute URL — so the same record
 * resolves correctly in every environment that reads the shared database.
 */
async function uploadImageLocally(fileBuffer, mimetype) {
  await fs.mkdir(LOCAL_LOGO_DIR, { recursive: true });
  const filename = `${crypto.randomBytes(16).toString('hex')}${mimeToExt(mimetype)}`;
  await fs.writeFile(path.join(LOCAL_LOGO_DIR, filename), fileBuffer);
  return `/uploads/logos/${filename}`;
}

/**
 * Upload an image buffer to Cloudinary (or local public/uploads fallback).
 * Returns the public URL of the uploaded asset.
 */
export const uploadImage = async (
  fileBuffer,
  folder = 'vapepass/logos',
  mimetype = 'image/png'
) => {
  if (!fileBuffer) {
    throw new ApiError(400, 'No file provided for upload');
  }

  if (!isCloudinaryConfigured()) {
    console.warn(
      '[cloudinary] Not configured — saving logo to public/uploads/logos. Set CLOUDINARY_* for production CDN uploads.'
    );
    return uploadImageLocally(fileBuffer, mimetype);
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ width: 400, height: 400, crop: 'limit' }],
      },
      (error, result) => {
        if (error) {
          reject(new ApiError(500, 'Failed to upload image to Cloudinary'));
          return;
        }
        resolve(result.secure_url);
      }
    );

    stream.end(fileBuffer);
  });
};

/**
 * Remove an image from Cloudinary by public ID or URL.
 */
export const deleteImage = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // Non-critical — log in production monitoring
  }
};
