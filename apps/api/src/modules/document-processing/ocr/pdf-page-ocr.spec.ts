import { makeScannedTestPdf } from '@modules/mca/medical-analysis/records/testing/make-test-pdf';
import { PdfPageOcr } from './pdf-page-ocr';

describe('PdfPageOcr', () => {
  it('reads text from a scanned page and leaves a blank page empty', async () => {
    const pdf = makeScannedTestPdf([
      [
        'EMERGENCY DEPARTMENT RECORD',
        'Date of service: 08/14/2024',
        'Assessment: Cervical strain after a motor vehicle collision.',
      ],
      [],
    ]);
    const progress: string[] = [];
    const pages = await new PdfPageOcr().recognize(pdf, [1, 2], {
      onPage: (done, total) => {
        progress.push(`${done}/${total}`);
      },
    });

    expect(pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    expect(pages[0].text).toContain('EMERGENCY DEPARTMENT RECORD');
    expect(pages[0].text).toContain('Cervical strain');
    expect(pages[0].text).not.toContain('\n');
    expect(pages[0].confidence).toBeGreaterThan(70);
    expect(pages[1].text).toBe('');
    expect(progress).toEqual(['1/2', '2/2']);
  }, 60000);

  it('reports a page that cannot be rendered instead of failing', async () => {
    const pdf = makeScannedTestPdf([['Only one page here']]);
    const [missing] = await new PdfPageOcr().recognize(pdf, [5]);
    expect(missing).toMatchObject({ pageNumber: 5, text: '', confidence: 0 });
    expect(missing.error).toBeTruthy();
  }, 60000);
});
