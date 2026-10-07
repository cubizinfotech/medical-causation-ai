import { BadRequestException } from '@nestjs/common';

/** The browser resizes photos to 256×256 before upload, so real files are far smaller. */
export const AVATAR_MAX_BYTES = 64 * 1024;

export interface AvatarImage {
  data: Buffer;
  mimeType: string;
}

const DATA_URL =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Parses a base64 data URL and checks that the bytes really are the
 * declared image type, so the API never stores or serves anything else.
 */
export function parseAvatarDataUrl(dataUrl: string): AvatarImage {
  const match = DATA_URL.exec(dataUrl.trim());
  if (!match) {
    throw new BadRequestException(
      'Profile photo must be a JPEG, PNG, or WebP image.',
    );
  }
  const [, mimeType, base64] = match;
  const data = Buffer.from(base64, 'base64');
  if (data.length === 0) {
    throw new BadRequestException('Profile photo is empty.');
  }
  if (data.length > AVATAR_MAX_BYTES) {
    throw new BadRequestException('Profile photo is too large (max 64 KB).');
  }
  if (!matchesSignature(data, mimeType)) {
    throw new BadRequestException(
      'Profile photo content does not match its image type.',
    );
  }
  return { data, mimeType };
}

function matchesSignature(data: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case 'image/png':
      return data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    case 'image/webp':
      return (
        data.subarray(0, 4).toString('ascii') === 'RIFF' &&
        data.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    default:
      return false;
  }
}
