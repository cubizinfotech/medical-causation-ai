import {
  googleDriveExportUrl,
  googleDriveFileId,
  isGoogleDriveFileUrl,
  isGoogleDriveHtmlGate,
  looksLikePdf,
  resolveGoogleDriveDownloadUrl,
  fetchGoogleDrivePdf,
} from './google-drive';

describe('google-drive', () => {
  it('parses common public sharing URL formats', () => {
    const id = '1FQfGCCLKHced7DfhowBgggmpiOfZISVX';
    expect(
      googleDriveFileId(`https://drive.google.com/file/d/${id}/view`),
    ).toBe(id);
    expect(
      googleDriveFileId(`https://drive.google.com/file/d/${id}/preview`),
    ).toBe(id);
    expect(
      googleDriveFileId(`https://drive.google.com/open?id=${id}`),
    ).toBe(id);
    expect(
      googleDriveFileId(
        `https://drive.google.com/uc?export=download&id=${id}`,
      ),
    ).toBe(id);
    expect(isGoogleDriveFileUrl('https://example.com/cv.pdf')).toBe(false);
    expect(googleDriveFileId('https://drive.google.com/drive/folders/abc')).toBe(
      null,
    );
  });

  it('resolves to the export download URL', () => {
    const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
    expect(
      resolveGoogleDriveDownloadUrl(
        `https://drive.google.com/file/d/${id}/view?usp=sharing`,
      ),
    ).toBe(googleDriveExportUrl(id));
  });

  it('detects PDF magic and HTML gates', () => {
    expect(looksLikePdf(Buffer.from('%PDF-1.4\n…'))).toBe(true);
    expect(looksLikePdf(Buffer.from('<!DOCTYPE html>'))).toBe(false);
    expect(
      isGoogleDriveHtmlGate(
        '<html><title>Google Drive - Sign in</title><body>Sign in</body></html>',
        'text/html',
      ),
    ).toBe(true);
    expect(
      isGoogleDriveHtmlGate(
        '<html>Virus scan warning <a id="uc-download-link">Download</a></html>',
        'text/html',
      ),
    ).toBe(true);
  });

  it('fetches a public Drive PDF via the export URL', async () => {
    const id = '1PublicTestFileIdABCDEFGHIJK';
    const pdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n' +
        'CURRICULUM VITAE Jane Expert Ph.D. Education University 2001 '.repeat(3),
    );
    const calls: string[] = [];
    const fetchImpl = ((input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('uc?export=download')) {
        return Promise.resolve(
          new Response(pdf, {
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          }),
        );
      }
      return Promise.resolve(new Response('no', { status: 404 }));
    }) as typeof fetch;

    const outcome = await fetchGoogleDrivePdf({
      url: `https://drive.google.com/file/d/${id}/view`,
      fetchImpl,
      timeoutMs: 2000,
      userAgent: 'test',
    });
    expect(outcome.kind).toBe('pdf');
    if (outcome.kind === 'pdf') {
      expect(looksLikePdf(outcome.bytes)).toBe(true);
    }
    expect(calls.some((c) => c.includes('export=download'))).toBe(true);
  });

  it('marks login HTML as restricted, not a PDF', async () => {
    const id = '1PrivateFileIdABCDEFGHIJKLMN';
    const fetchImpl = ((input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('uc?export=download')) {
        return Promise.resolve(
          new Response(
            '<html><head><title>Google Drive</title></head><body>You need access. Sign in</body></html>',
            { status: 200, headers: { 'content-type': 'text/html' } },
          ),
        );
      }
      return Promise.resolve(new Response('no', { status: 404 }));
    }) as typeof fetch;

    const outcome = await fetchGoogleDrivePdf({
      url: `https://drive.google.com/file/d/${id}/view`,
      fetchImpl,
      timeoutMs: 2000,
      userAgent: 'test',
    });
    expect(outcome.kind).toBe('restricted');
  });

  it('reports deleted files', async () => {
    const id = '1DeletedFileIdABCDEFGHIJKLMNO';
    const fetchImpl = (() =>
      Promise.resolve(
        new Response('Not Found', { status: 404 }),
      )) as typeof fetch;
    const outcome = await fetchGoogleDrivePdf({
      url: `https://drive.google.com/file/d/${id}/view`,
      fetchImpl,
      timeoutMs: 2000,
      userAgent: 'test',
    });
    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.note).toMatch(/not found|deleted/i);
    }
  });

  it('rejects invalid Drive-like URLs', async () => {
    const outcome = await fetchGoogleDrivePdf({
      url: 'https://drive.google.com/drive/my-drive',
      fetchImpl: fetch,
      timeoutMs: 1000,
      userAgent: 'test',
    });
    expect(outcome.kind).toBe('failed');
  });
});
