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
    publications: [
      { title: 'Memory after pediatric TBI', status: 'not_found' },
    ],
    expertName: 'Leah Ellenberg',
  });
  const glassDirectory = {
    id: 'glass-dir',
    url: 'https://directory.example/los-angeles-neuropsychologists',
    title: 'Los Angeles Neuropsychologists — Leah Ellenberg, Leila Glass',
    kind: 'directory' as const,
    snippet: null,
    summary: 'Directory listing several pediatric neuropsychologists.',
    publishedAt: null,
    retrievedAt: '2026-10-26T12:00:00.000Z',
    searchProviders: ['gemini_grounding'],
    queries: ['Leah Ellenberg neuropsychology'],
    read: 'read' as const,
    readNote: null,
    match: {
      level: 'possible' as const,
      confidence: 'medium' as const,
      basis: ['surname', 'specialty'],
      conflicts: ['Leila Glass'],
      quote: 'Leila Glass, PhD, UCLA',
      quoteVerified: true,
      classifiedBy: 'rules' as const,
    },
    candidateId: 'cand-possible',
    claims: [
      {
        type: 'credential' as const,
        text: 'Education: Leila Glass, PhD, earned her doctorate from UCLA',
        quote: 'Leila Glass, PhD, earned her doctorate from UCLA',
        topic: 'education' as const,
        basis: 'third_party' as const,
        from: 'page' as const,
      },
    ],
  };
  const courtRetag = {
    id: 'court-ime',
    url: 'https://www.courtlistener.com/opinion/123/smith-v-jones/',
    title: 'Memorandum opinion',
    kind: 'ime' as const,
    snippet: null,
    summary: 'The court granted a compulsory medical examination.',
    publishedAt: null,
    retrievedAt: '2026-10-26T12:00:00.000Z',
    searchProviders: ['gemini_grounding'],
    queries: [],
    read: 'read' as const,
    readNote: null,
    match: {
      level: 'strong' as const,
      confidence: 'high' as const,
      basis: ['name'],
      conflicts: [],
      quote: 'Leah Ellenberg',
      quoteVerified: true,
      classifiedBy: 'model' as const,
    },
    candidateId: 'cand-subject',
    claims: [
      {
        type: 'advertising' as const,
        text: 'IME: compulsory medical examination',
        quote: 'compulsory medical examination of the plaintiff',
        topic: 'ime' as const,
        basis: 'third_party' as const,
        from: 'page' as const,
      },
    ],
  };
  const unratedReview = {
    id: 'review-1',
    url: 'https://www.healthgrades.com/physician/leah-ellenberg',
    title: 'Patient reviews',
    kind: 'review' as const,
    snippet: null,
    summary: 'A review listing.',
    publishedAt: null,
    retrievedAt: '2026-10-26T12:00:00.000Z',
    searchProviders: ['gemini_grounding'],
    queries: [],
    read: 'read' as const,
    readNote: null,
    match: {
      level: 'strong' as const,
      confidence: 'high' as const,
      basis: ['name'],
      conflicts: [],
      quote: 'Leah Ellenberg',
      quoteVerified: true,
      classifiedBy: 'rules' as const,
    },
    candidateId: 'cand-subject',
    claims: [
      {
        type: 'rating' as const,
        text: 'Review: wait times mentioned',
        quote: 'wait times mentioned',
        topic: 'review' as const,
        basis: 'third_party' as const,
        from: 'page' as const,
      },
    ],
    rating: null,
  };
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
      note: 'Identity is not confirmed. 1 possible NPI record(s) match the name and specialty in another city (NPI 1234567893 in BEVERLY HILLS, CA). No record matches the name and specialty in Los Angeles. The city entered for this investigation is not the registry practice city, so the record was not used as a confirmed identity. Public sources were still searched.',
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
    webResearch: {
      ranAt: '2026-10-26T12:00:00.000Z',
      durationMs: 1,
      partial: false,
      partialNote: null,
      queriesPlanned: 6,
      queriesRun: 6,
      providers: [
        {
          providerId: 'gemini_grounding',
          name: 'Gemini',
          configured: true,
          requests: 6,
          failedRequests: 0,
          hits: 3,
          failures: [],
        },
      ],
      pagesRead: 3,
      pagesBlocked: [],
      candidates: [
        {
          id: 'cand-possible',
          label: 'Possible match pages for Leah Ellenberg',
          role: 'other' as const,
          confidence: 'medium' as const,
          basis: ['possible only'],
          recordIds: ['glass-dir'],
        },
      ],
      records: [glassDirectory, courtRetag, unratedReview],
      registries: [],
      limitations: [],
      topics: [
        { topic: 'reviews', queries: 1, hits: 1 },
        { topic: 'directories', queries: 1, hits: 1 },
      ],
    },
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
        coverHas3107: /3\.10\.7/.test(pages[0] ?? ''),
        coverHas3106: /3\.10\.6/.test(pages[0] ?? ''),
        coverHas3105: /3\.10\.5/.test(pages[0] ?? ''),
        coverHas3104: /3\.10\.4/.test(pages[0] ?? ''),
        coverHas3101: /3\.10\.1/.test(pages[0] ?? ''),
        glassEducationGone:
          !/9\. Education and Degrees[\s\S]{0,400}Leila Glass/i.test(allPdf) &&
          !/Leila Glass[\s\S]{0,80}UCLA/i.test(allPdf),
        glassNotInEducation: !/earned her doctorate from UCLA/i.test(allPdf),
        glassNotInDirectories:
          !/22\. Expert Directories[\s\S]{0,800}Leila Glass, PhD, UCLA/i.test(
            allPdf,
          ),
        courtNotIme: !/compulsory medical examination of the plaintiff/i.test(
          allPdf,
        ),
        ratingNotShown: /Rating not shown on the retrieved page/.test(allPdf),
        npiPossibleHeading:
          /Identity not confirmed — one possible NPI record/.test(firstSix),
        uniqueClaimCounts: /unique CV claim\(s\) were read/.test(firstSix),
        fapeAbbrev: /FAPE \(Free Appropriate Public Education\)/.test(allPdf),
        typeUnverifiedGone: !/Type:\s*unverified/i.test(allPdf),
        firstAuthorOrder: /Ellenberg L, Smith J/.test(allPdf),
        npiPossibleOnly: /Identity not confirmed/.test(firstSix),
        pubmedUrlOnceInLinks:
          (linksText.match(/pubmed\.ncbi\.nlm\.nih\.gov\/11111111/g) ?? [])
            .length === 1,
        pubmedMatchInCv: /Consistent[\s\S]*Memory after pediatric TBI/i.test(
          firstSix,
        ),
        catalogMissGone:
          !/not confirmed in the catalogs searched: Memory after pediatric TBI/i.test(
            firstSix,
          ),
        claimCounts: /3 unique CV claim\(s\) were read/.test(firstSix),
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
        linksClickablePubmed:
          /\/URI\s*\(https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/11111111\/?\)/.test(
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
