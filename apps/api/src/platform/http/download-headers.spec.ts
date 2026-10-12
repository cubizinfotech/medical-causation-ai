import { downloadHeaders } from './download-headers';

describe('downloadHeaders', () => {
  it('keeps quotes and line breaks out of the header', () => {
    const headers = downloadHeaders(
      'a"b\r\nc é.pdf',
      'application/pdf',
      'inline',
    );
    expect(headers['Content-Disposition']).toBe(
      `inline; filename="a'b__c _.pdf"; filename*=UTF-8''a%22b%0D%0Ac%20%C3%A9.pdf`,
    );
    expect(headers['Content-Disposition']).not.toMatch(/[\r\n]/);
  });

  it('never sends an empty file name', () => {
    expect(
      downloadHeaders('', 'application/pdf')['Content-Disposition'],
    ).toContain('filename="download"');
  });
});
