import { toReportFriendlyImage } from './report-image';

describe('toReportFriendlyImage', () => {
  it('passes JPEG and PNG through unchanged', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, ...Buffer.alloc(40, 1)]);
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(40, 2),
    ]);
    await expect(
      toReportFriendlyImage({ mimeType: 'image/jpeg', bytes: jpeg }),
    ).resolves.toEqual({ mimeType: 'image/jpeg', bytes: jpeg });
    await expect(
      toReportFriendlyImage({ mimeType: 'image/png', bytes: png }),
    ).resolves.toEqual({ mimeType: 'image/png', bytes: png });
  });

  it('rejects tiny or unsupported payloads', async () => {
    await expect(
      toReportFriendlyImage({
        mimeType: 'image/gif',
        bytes: Buffer.alloc(100, 1),
      }),
    ).resolves.toBeNull();
    await expect(
      toReportFriendlyImage({
        mimeType: 'image/png',
        bytes: Buffer.from([1, 2, 3]),
      }),
    ).resolves.toBeNull();
  });
});
