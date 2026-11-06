import type { CvClaim } from '../../cv/cv.types';
import { buildEwiReportDocument } from '../../report/ewi-report.template';
import { EWI_REPORT_TEMPLATE_VERSION } from '../../report/ewi-report.version';
import {
  assessBoardCertificationsFromMaterials,
} from './board-certification-assessment';
import {
  boardCertificationEntriesFromClaims,
} from './board-certification-entries';
import {
  claimedBoardSignals,
  resolveCertifyingBoard,
} from './certification-registry';
import type { BoardCertificationEntry } from './board-certification.types';

function claim(
  partial: Partial<CvClaim> & Pick<CvClaim, 'category' | 'statement'>,
): CvClaim {
  return {
    id: partial.id ?? 'c1',
    category: partial.category,
    statement: partial.statement,
    details: partial.details ?? {},
    page: partial.page ?? 1,
    quote: partial.quote ?? partial.statement,
  };
}

function entry(
  partial: Partial<BoardCertificationEntry> &
    Pick<BoardCertificationEntry, 'statement'>,
): BoardCertificationEntry {
  return {
    id: partial.id ?? 'bc-1',
    credentialName: partial.credentialName ?? 'Clinical Neuropsychology',
    boardName: partial.boardName ?? 'American Board of Professional Psychology',
    boardId: partial.boardId !== undefined ? partial.boardId : 'abpp',
    specialty: partial.specialty ?? 'Clinical Neuropsychology',
    certificationDate: partial.certificationDate ?? null,
    expirationOrStatus: partial.expirationOrStatus ?? null,
    certificationNumber: null,
    statement: partial.statement,
    quote: partial.quote ?? partial.statement,
    page: partial.page ?? 1,
    cvSourceUrl: partial.cvSourceUrl ?? 'cv://1',
    claimId: partial.claimId ?? 'c1',
    extractionConfidence: partial.extractionConfidence ?? 'high',
  };
}

const ABPP_STRONG = {
  url: 'https://abpp.org/directory/jane-expert',
  title: 'Jane Expert — ABPP Directory',
  text: `
    Jane Expert, Ph.D., ABPP
    Clinical Neuropsychology
    Tampa, FL
    Diplomate, American Board of Professional Psychology
  `,
};

describe('board certification extraction', () => {
  it('1. extracts a valid certification claim from a CV', () => {
    const entries = boardCertificationEntriesFromClaims([
      claim({
        category: 'board_certification',
        statement:
          'Board Certified in Clinical Neuropsychology by the American Board of Professional Psychology (ABPP)',
        details: {
          board: 'American Board of Professional Psychology',
          specialty: 'Clinical Neuropsychology',
        },
      }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].boardId).toBe('abpp');
  });

  it('2. does not extract a professional membership as board certification', () => {
    const entries = boardCertificationEntriesFromClaims([
      claim({
        category: 'board_certification',
        statement: 'Member, American Academy of Clinical Neuropsychology',
        details: { board: 'AACN' },
      }),
    ]);
    expect(entries).toHaveLength(0);
  });

  it('3. does not classify an academic degree as board certification', () => {
    const entries = boardCertificationEntriesFromClaims([
      claim({
        category: 'board_certification',
        statement: 'Ph.D., University of Florida, 2005',
        details: { board: 'University of Florida' },
      }),
    ]);
    expect(entries).toHaveLength(0);
  });

  it('4. does not classify a state license as board certification', () => {
    const entries = boardCertificationEntriesFromClaims([
      claim({
        category: 'board_certification',
        statement: 'Licensed Psychologist, State of Florida, PY1234',
        details: { board: 'Florida Board of Psychology' },
      }),
    ]);
    expect(entries).toHaveLength(0);
  });

  it('5. maps a claimed certification to the correct board', () => {
    expect(resolveCertifyingBoard('ABPP-CN')?.id).toBe('abpp');
    expect(resolveCertifyingBoard('American Board of Psychiatry and Neurology')?.id).toBe(
      'abpn',
    );
    expect(resolveCertifyingBoard('AACN member directory')).toBeNull();
  });

  it('6. claimedBoardSignals only includes mapped boards', () => {
    const signals = claimedBoardSignals(['abpp']);
    expect(signals.hosts).toContain('abpp.org');
    expect(signals.hosts).not.toContain('abpn.com');
    expect(signals.acronyms).toContain('ABPP');
  });
});

describe('assessBoardCertificationsFromMaterials', () => {
  it('7. official profile confirms a certification', () => {
    const dossier = assessBoardCertificationsFromMaterials(
      [
        entry({
          statement: 'Board Certified in Clinical Neuropsychology by ABPP',
        }),
      ],
      { abpp: [ABPP_STRONG] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('verified');
  });

  it('8. similar-name official profile is rejected', () => {
    const dossier = assessBoardCertificationsFromMaterials(
      [
        entry({
          statement: 'Board Certified in Clinical Neuropsychology by ABPP',
        }),
      ],
      {
        abpp: [
          {
            url: 'https://abpp.org/directory/john-expert',
            title: 'John Expert',
            text: `
              John Expert, Ph.D., ABPP
              Clinical Neuropsychology
              Boston, MA
            `,
          },
        ],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('no_matching_record');
    expect(dossier.assessments[0].limitations.join(' ')).toMatch(
      /identity mismatch/i,
    );
  });

  it('9. potential match is not marked Verified', () => {
    const dossier = assessBoardCertificationsFromMaterials(
      [
        entry({
          statement: 'Board Certified in Clinical Neuropsychology by ABPP',
        }),
      ],
      {
        abpp: [
          {
            url: 'https://abpp.org/directory/jane-expert',
            title: 'Jane Expert',
            text: 'Jane Expert Clinical Neuropsychology Tampa',
            searchResultOnly: true,
          },
        ],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe(
      'potential_match_unconfirmed',
    );
  });

  it('10. inaccessible official website → Unable to Access', () => {
    const dossier = assessBoardCertificationsFromMaterials(
      [
        entry({
          statement: 'Board Certified in Clinical Neuropsychology by ABPP',
        }),
      ],
      {
        abpp: [
          {
            url: 'https://abpp.org/directory/locked',
            title: 'Login',
            text: 'Please sign in',
            restricted: true,
          },
        ],
      },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        loginBlocked: true,
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('unable_to_access');
  });

  it('11. successful search with no match → No Matching Record', () => {
    const dossier = assessBoardCertificationsFromMaterials(
      [
        entry({
          statement: 'Board Certified in Clinical Neuropsychology by ABPP',
        }),
      ],
      { abpp: [] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        searchAttempted: true,
      },
    );
    expect(dossier.assessments[0].status).toBe('no_matching_record');
  });

  it('12. unidentified certifying organization → Insufficient Information', () => {
    const dossier = assessBoardCertificationsFromMaterials(
      [
        entry({
          boardId: null,
          boardName: 'Some Unknown Specialty Board',
          statement: 'Board certified by Some Unknown Specialty Board',
        }),
      ],
      {},
      { expertName: 'Jane Expert' },
    );
    expect(dossier.assessments[0].status).toBe('insufficient_information');
  });

  it('13. CV-only credential remains Self-Reported without independent evidence', () => {
    const dossier = assessBoardCertificationsFromMaterials(
      [
        entry({
          statement: 'Board Certified in Clinical Neuropsychology by ABPP',
        }),
      ],
      { abpp: [] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        searchAttempted: false,
      },
    );
    expect(dossier.assessments[0].status).toBe('self_reported');
  });
});

describe('board certification report presentation', () => {
  it('14–16. findings display in §13 and Source Index; Exec Summary does not invent confirmation', () => {
    const assessments = assessBoardCertificationsFromMaterials(
      [
        entry({
          statement: 'Board Certified in Clinical Neuropsychology by ABPP',
        }),
      ],
      { abpp: [ABPP_STRONG] },
      {
        expertName: 'Jane Expert',
        specialty: 'Clinical Neuropsychology',
        city: 'Tampa, FL',
        searchAttempted: true,
      },
    );
    const document = buildEwiReportDocument({
      expertName: 'Jane Expert',
      city: 'Tampa, FL',
      specialty: 'Clinical Neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-06T12:00:00.000Z',
      boardCertificationAssessments: assessments,
      summary:
        'Investigation summary without claiming unverified board certification.',
    });
    expect(EWI_REPORT_TEMPLATE_VERSION).toBe('3.10.27');
    const section = document.sections.find((s) => s.id === 'board-certifications')!;
    const text = section.blocks.map((b) => b.text).join('\n');
    expect(text).toMatch(/Verified/);
    expect(text).toMatch(/American Board of Professional Psychology|ABPP/i);
    expect(text).toMatch(/abpp\.org/i);
    const orgs = document.sections.find((s) => s.id === 'certification-orgs')!;
    expect(orgs.blocks.map((b) => b.text).join('\n')).toMatch(/ABPP|Professional Psychology/i);
    const index = document.sections.find((s) => s.id === 'source-index')!;
    expect(index.blocks.map((b) => b.text).join('\n')).toMatch(/abpp\.org/i);
    const summary = document.sections.find((s) => s.id === 'summary')!;
    expect(summary.blocks.map((b) => b.text).join('\n')).not.toMatch(
      /confirmed board certified by every american board/i,
    );
  });

  it('17–19. website grouping and directory assessments remain available beside board certs', () => {
    const assessments = assessBoardCertificationsFromMaterials(
      [
        entry({
          statement: 'Board Certified in Clinical Neuropsychology by ABPP',
        }),
      ],
      { abpp: [] },
      {
        expertName: 'Jane Expert',
        searchAttempted: false,
      },
    );
    const document = buildEwiReportDocument({
      expertName: 'Jane Expert',
      city: 'Tampa, FL',
      specialty: 'Clinical Neuropsychology',
      evidence: [],
      discrepancies: [],
      questions: [],
      generatedAt: '2026-11-06T12:00:00.000Z',
      boardCertificationAssessments: assessments,
      onlinePresence: {
        websites: [
          {
            id: 'a',
            kind: 'expert_website',
            title: 'Home',
            url: 'https://practice.example/',
            sourceId: 'web_search',
            sourceName: 'Web',
            retrievedAt: '2026-11-06T00:00:00.000Z',
            publishedAt: null,
            summary: 'Main professional website',
            relevantClaims: [],
            advertisingClaims: [],
            forensicClaims: [],
            expertWitnessClaims: [],
            treatmentPracticeInfo: null,
            conflictOrBiasIndicators: [],
            evidenceReferences: [],
            restricted: false,
            identityMatch: 'matched',
            platform: null,
            description: null,
            transcript: null,
            transcriptAvailable: null,
            transcriptUnavailableReason: null,
            importantStatements: [],
            rating: null,
            reviewDate: null,
            reviewText: null,
            neutralSummary: null,
            address: null,
            businessName: null,
            locationFlags: [],
            locationNote: null,
          },
          {
            id: 'b',
            kind: 'expert_website',
            title: 'About',
            url: 'https://practice.example/about',
            sourceId: 'web_search',
            sourceName: 'Web',
            retrievedAt: '2026-11-06T00:00:00.000Z',
            publishedAt: null,
            summary: 'Professional biography',
            relevantClaims: [],
            advertisingClaims: [],
            forensicClaims: [],
            expertWitnessClaims: [],
            treatmentPracticeInfo: null,
            conflictOrBiasIndicators: [],
            evidenceReferences: [],
            restricted: false,
            identityMatch: 'matched',
            platform: null,
            description: null,
            transcript: null,
            transcriptAvailable: null,
            transcriptUnavailableReason: null,
            importantStatements: [],
            rating: null,
            reviewDate: null,
            reviewText: null,
            neutralSummary: null,
            address: null,
            businessName: null,
            locationFlags: [],
            locationNote: null,
          },
        ],
        directories: [],
        ime: [],
        videos: [],
        social: [],
        newsAndBlogs: [],
        patientReviews: [],
        locations: [],
        otherPublicSites: [],
        records: [],
        sourceAttempts: [],
      },
    });
    const websites = document.sections.find((s) => s.id === 'websites')!;
    expect(
      websites.blocks.filter((b) => /^Expert Website:/i.test(b.text)),
    ).toHaveLength(1);
    expect(document.sections.find((s) => s.id === 'memberships')).toBeTruthy();
    expect(document.sections.find((s) => s.id === 'ime')).toBeTruthy();
  });
});
