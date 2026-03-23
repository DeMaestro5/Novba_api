import { Router, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';
import asyncHandler from '../../helpers/asyncHandler';
import { BadRequestError, InternalError } from '../../core/ApiError';
import { SuccessResponse } from '../../core/ApiResponse';

const router = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB hard limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

router.use(authentication);

router.post(
  '/portfolio-image',
  upload.single('image'),
  asyncHandler(async (req: ProtectedRequest, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('No image file provided');
    }

    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `novba/portfolio/${req.user.id}`,
            transformation: [
              { width: 1200, height: 630, crop: 'fill', gravity: 'auto' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
            resource_type: 'image',
          },
          (error, result) => {
            if (error || !result) return reject(error ?? new Error('Upload failed'));
            resolve(result);
          },
        );
        stream.end(req.file!.buffer);
      },
    );

    if (!result?.secure_url) {
      throw new InternalError('Failed to upload image to CDN');
    }

    new SuccessResponse('Image uploaded successfully', {
      imageUrl: result.secure_url,
      publicId: result.public_id,
    }).send(res);
  }),
);

router.post(
  '/profile-image',
  upload.single('image'),
  asyncHandler(async (req: ProtectedRequest, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('No image file provided');
    }

    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `novba/profiles/${req.user.id}`,
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
            resource_type: 'image',
          },
          (error, result) => {
            if (error || !result) return reject(error ?? new Error('Upload failed'));
            resolve(result);
          },
        );
        stream.end(req.file!.buffer);
      },
    );

    if (!result?.secure_url) {
      throw new InternalError('Failed to upload image to CDN');
    }

    // Save profilePicUrl directly to user record
    const prisma = (await import('../../database')).default;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { profilePicUrl: result.secure_url },
    });

    new SuccessResponse('Profile photo uploaded successfully', {
      profilePicUrl: result.secure_url,
      publicId: result.public_id,
    }).send(res);
  }),
);

export default router;
