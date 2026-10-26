/**
 * Local opening-pages check: fixture PDF, no database write, no live APIs.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PdfParser } from '../src/modules/document-processing/parsers/pdf.parser';
import { compareCv } from '../src/modules/ewi/cv/cv-comparison';
import type { CvClaim, CvExtraction } from '../src/modules/ewi/cv/cv.types';
import { EwiPdfReportService } from '../src/modules/ewi/report/ewi-pdf-report.service';
import { EwiWordReportService } from '../src/modules/ewi/report/ewi-word-report.service';
import { EWI_REPORT_TEMPLATE_VERSION } from '../src/modules/ewi/report/ewi-report.version';
import { PdfReportRenderer } from '../src/platform/report/pdf/pdf-report.renderer';
import { DocxReportRenderer } from '../src/platform/report/docx/docx-report.renderer';
import mammoth from 'mammoth';

function claim(
  id: string,
  category: CvClaim['category'],
  statement: string,
  details: CvClaim['details'],
): CvClaim {
  return { id, category, statement, details, page: 1, quote: statement };
}

async function main() {
  const extraction: CvExtraction = {
    document: {
      id: 'cv-dev',
      name: 'ellenberg-dev-cv.pdf',
      pageCount: 6,
      unreadablePages: [],
      ocrPages: [],
    },
    status: 'completed',
    warnings: [],
    claims: [
      claim(
        'cv-p',
        'publication',
        'Ellenberg L (1999). Memory after pediatric TBI. JINS, 5, 139.',
        { title: 'Memory after pediatric TBI', year: '1999', journal: 'JINS' },
      ),
      claim('cv-m', 'membership', 'AACN member', { name: 'AACN' }),
      claim('cv-a', 'award', 'Dean scholarship', { name: 'Dean' }),
    ],
  };
  const evidence = [
    {
      sourceId: 'pubmed',
      category: 'publication',
      title: 'Memory after pediatric TBI.',
      summary:
        'PubMed lists “Memory after pediatric TBI.” Authors: Ellenberg L, Smith J. Listed as first author.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/11111111/',
      identityMatch: 'matched' as const,
      informationStatus: 'unverified' as const,
      raw: {
        pmid: '11111111',
        doi: '10.1000/ellenberg-memory',
        authors: ['Ellenberg L', 'Smith J'],
        authorPosition: 'first',
        authorIndex: 0,
        authorCount: 2,
        journal: 'JINS',
        pubdate: '1999 Jan',
      },
    },
  ];
  const cvCheck = compareCv({
    extraction,
    evidence,
    sourceResults: [],
    identity: {
      status: 'ambiguous' as const,
      identity: null,
      basis: [],
      note: 'No NPI Registry record matches the name and specialty in Los Angeles. 1 record(s) match the name and specialty in another city (NPI 1234567893 in BEVERLY HILLS, CA).',
      notes: [],
      candidates: [
        {
          npi: '1234567893',
          name: 'Leah Ellenberg, PhD',
          credential: 'PhD',
          taxonomy: 'Clinical Neuropsychologist',
          city: 'BEVERLY HILLS',
          state: 'CA',
          url: 'https://npiregistry.cms.hhs.gov/provider-view/1234567893',
        },
      ],
    },
    publications: [{ title: 'Memory after pediatric TBI', status: 'not_found' }],
    expertName: 'Leah Ellenberg',
  });
  const reportInput = {
    expertName: 'Leah Ellenberg',
    city: 'Los Angeles',
    specialty: 'Neuropsychology',
    evidence,
    discrepancies: [],
    questions: [],
    generatedAt: '2026-10-26T12:00:00.000Z',
    identity: {
      status: 'ambiguous' as const,
      identity: null,
      basis: [],
      note: 'No NPI Registry record matches the name and specialty in Los Angeles. 1 record(s) match the name and specialty in another city (NPI 1234567893 in BEVERLY HILLS, CA). The city entered for this investigation is not the registry practice city, so the record was not used as a confirmed identity. Public sources were still searched.',
      notes: [],
      candidates: [
        {
          npi: '1234567893',
          name: 'Leah Ellenberg, PhD',
          credential: 'PhD',
          taxonomy: 'Clinical Neuropsychologist',
          city: 'BEVERLY HILLS',
          state: 'CA',
          url: 'https://npiregistry.cms.hhs.gov/provider-view/1234567893',
        },
      ],
    },
    cvCheck,
  };
  const pdfReport = new EwiPdfReportService(new PdfReportRenderer());
  const wordReport = new EwiWordReportService(new DocxReportRenderer());
  const pdf = await pdfReport.build(reportInput);
  const word = await wordReport.build(reportInput);
  const links = await pdfReport.buildSourceLinks(reportInput);
  const parsed = await new PdfParser().parse({
    filePath: 'opening-pages.pdf',
    buffer: pdf.buffer,
    filename: 'opening-pages.pdf',
    extension: 'pdf',
    fileSize: pdf.buffer.byteLength,
    createdAt: new Date(),
    modifiedAt: new Date(),
  });
  const pages = parsed.pages.map((page) => page.text);
  const firstSix = pages.slice(0, 6).join('\n\n');
  const allPdf = pages.join('\n');
  const { value: wordText } = await mammoth.extractRawText({
    buffer: word.buffer,
  });
  const dir = join(tmpdir(), 'ewi-opening-pages-dev');
  mkdirSync(dir, { recursive: true });
  const pdfFile = join(dir, pdf.fileName);
  const wordFile = join(dir, word.fileName);
  const linksFile = join(dir, links.fileName);
  writeFileSync(pdfFile, pdf.buffer);
  writeFileSync(wordFile, word.buffer);
  writeFileSync(linksFile, links.buffer);
  writeFileSync(join(dir, 'first-six.txt'), firstSix);
  const linksParsed = await new PdfParser().parse({
    filePath: 'source-links.pdf',
    buffer: links.buffer,
    filename: 'source-links.pdf',
    extension: 'pdf',
    fileSize: links.buffer.byteLength,
    createdAt: new Date(),
    modifiedAt: new Date(),
  });
  const linksText = linksParsed.pages.map((page) => page.text).join('\n');
  const linksRaw = links.buffer.toString('latin1');
  console.log(
    JSON.stringify(
      {
        pdfFile,
        wordFile,
        linksFile,
        templateVersion: pdf.templateVersion,
        expectedVersion: EWI_REPORT_TEMPLATE_VERSION,
        pageCount: pages.length,
        coverHas3105: /3\.10\.5/.test(pages[0] ?? ''),
        coverHas3104: /3\.10\.4/.test(pages[0] ?? ''),
        coverHas3101: /3\.10\.1/.test(pages[0] ?? ''),
        typeUnverifiedGone: !/Type:\s*unverified/i.test(allPdf),
        firstAuthorOrder: /Ellenberg L, Smith J/.test(allPdf),
        npiPossibleOnly: /Identity not confirmed/.test(firstSix),
        pubmedUrlOnceInLinks:
          (linksText.match(/pubmed\.ncbi\.nlm\.nih\.gov\/11111111/g) ?? [])
            .length === 1,
        pubmedMatchInCv: /Verified match[\s\S]*Memory after pediatric TBI/i.test(
          firstSix,
        ),
        catalogMissGone: !/not confirmed in the catalogs searched: Memory after pediatric TBI/i.test(
          firstSix,
        ),
        claimCounts: /3 claim\(s\) were read/.test(firstSix),
        possibleNpi: /Identity not confirmed/.test(firstSix),
        beverlyHillsPossible: /BEVERLY HILLS/.test(firstSix),
        notVerifiedIdentity: !/Status: Verified/.test(firstSix),
        enteredCity: /Los Angeles/.test(firstSix),
        pubmedLink: firstSix.includes(
          'https://pubmed.ncbi.nlm.nih.gov/11111111/',
        ),
        questionsOmittedPdf: /Cross-examination questions omitted/i.test(
          allPdf,
        ),
        questionsSectionGone: !/42\. Cross-Examination Questions/i.test(allPdf),
        questionsOmittedWord: /Cross-examination questions omitted/i.test(
          wordText,
        ),
        abbreviations: /NPI \(National Provider Identifier\)/.test(allPdf),
        linksTemplate: links.templateId,
        linksClickablePubmed: /\/URI\s*\(https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/11111111\/?\)/.test(
          linksRaw,
        ),
        linksHasNpi: linksText.includes(
          'https://npiregistry.cms.hhs.gov/provider-view/1234567893',
        ),
        linksHasCategory: /Category: Publication/.test(linksText),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
