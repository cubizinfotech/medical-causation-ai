import { BadRequestException } from '@nestjs/common';
import { AVATAR_MAX_BYTES, parseAvatarDataUrl } from './avatar';

const PNG_HEADER = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
]);

function dataUrl(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

describe('parseAvatarDataUrl', () => {
  it.each([
    ['image/png', PNG_HEADER],
    ['image/jpeg', JPEG_HEADER],
    ['image/webp', WEBP_HEADER],
  ])('accepts a real %s image', (mime, bytes) => {
    const image = parseAvatarDataUrl(dataUrl(mime, bytes));
    expect(image.mimeType).toBe(mime);
    expect(image.data.equals(bytes)).toBe(true);
  });

  it('rejects types other than JPEG, PNG, and WebP', () => {
    expect(() =>
      parseAvatarDataUrl(dataUrl('image/svg+xml', Buffer.from('<svg/>'))),
    ).toThrow(BadRequestException);
  });

  it('rejects bytes that do not match the declared type', () => {
    expect(() => parseAvatarDataUrl(dataUrl('image/png', JPEG_HEADER))).toThrow(
      'does not match',
    );
  });

  it('rejects images over the size limit', () => {
    const big = Buffer.concat([PNG_HEADER, Buffer.alloc(AVATAR_MAX_BYTES)]);
    expect(() => parseAvatarDataUrl(dataUrl('image/png', big))).toThrow(
      'too large',
    );
  });

  it('rejects text that is not a data URL', () => {
    expect(() => parseAvatarDataUrl('https://example.com/a.png')).toThrow(
      BadRequestException,
    );
  });
});
