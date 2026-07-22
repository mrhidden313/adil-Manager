import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env relative to this file if process.env.CLOUDINARY_CLOUD_NAME is empty
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

// Ensure it warns if still missing
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('Cloudinary keys missing in .env!');
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a buffer directly to Cloudinary via stream.
 * @param buffer The image buffer
 * @param folder The folder name in Cloudinary
 * @returns A promise that resolves to the secure URL of the uploaded image
 */
export const uploadToCloudinary = (buffer: Buffer, folder: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        format: 'webp', // Auto compress and format
        quality: 'auto'
      },
      (error: any, result: any) => {
        if (result) {
          resolve(result.secure_url);
        } else {
          reject(error);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};
