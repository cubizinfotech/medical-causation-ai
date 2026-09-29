import type {
  ExpertResearchProviderId,
  ExpertResearchQuery,
  InformationStatus,
  SourceAccessClass,
} from '../expert-research.types';

export interface DevelopmentFixture {
  category: string;
  title: string;
  summary: string;
  url?: string;
  access: SourceAccessClass;
  informationStatus: InformationStatus;
  raw?: Record<string, unknown>;
}

const FIXTURE_NOTE =
  'Development fixture only. This is not a retrieved record and does not establish a credential, publication, case, license, or award.';

function matchedIdentity(
  query: ExpertResearchQuery,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    fixture: true,
    identity: {
      name: query.expertName,
      city: query.city,
      specialty: query.specialty,
    },
    ...extra,
  };
}

/**
 * Local fixtures for the investigation workflow.
 * Providers omitted here return unavailable and contribute no items.
 */
export function developmentFixtures(
  query: ExpertResearchQuery,
): Partial<Record<ExpertResearchProviderId, DevelopmentFixture[]>> {
  const { expertName, specialty, city } = query;
  return {
    web_search: [
      {
        category: 'profile',
        title: `Development fixture: web search for ${expertName}`,
        summary: `${FIXTURE_NOTE} Specialty context: ${specialty}. City context: ${city}.`,
        url: 'https://example.local/search',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query),
      },
      {
        category: 'profile',
        title: 'Development fixture: same name in another city',
        summary: `${FIXTURE_NOTE} Same name only. This is not merged with the queried expert.`,
        url: 'https://example.local/search/other-city',
        access: 'public',
        informationStatus: 'unverified',
        raw: {
          fixture: true,
          identity: {
            name: expertName,
            city: 'A different city',
            specialty,
          },
        },
      },
    ],
    pubmed: [
      {
        category: 'publication',
        title: `Development fixture: sample ${specialty} citation`,
        summary: FIXTURE_NOTE,
        url: 'https://pubmed.example.local/000000',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query),
      },
    ],
    author_verification: [
      {
        category: 'publication',
        title: 'Development fixture: curriculum vitae publication list',
        summary: `${FIXTURE_NOTE} Sample counts are included so discrepancy rules can be exercised.`,
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, { cvCount: 42, indexedCount: 38 }),
      },
    ],
    state_license: [
      {
        category: 'license',
        title: 'Development fixture: state medical license',
        summary: FIXTURE_NOTE,
        url: 'https://example.local/boards/ca',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, { status: 'active', state: 'CA' }),
      },
    ],
    expert_website: [
      {
        category: 'license',
        title: 'Development fixture: website credential claim',
        summary: `${FIXTURE_NOTE} Sample website text claims more than one state.`,
        url: 'https://example.local/experts/about',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'expert_website',
          pageTitle: `${expertName} practice site`,
          claimedStates: ['CA', 'NY'],
          claimedBoard: specialty,
          relevantClaims: [`Licensed in CA and NY`, `Board: ${specialty}`],
          advertisingClaims: ['Available for independent medical examinations'],
          forensicClaims: ['Provides forensic consulting'],
          expertWitnessClaims: ['Retained as an expert witness'],
          treatmentPracticeInfo: `Outpatient ${specialty} practice.`,
          conflictOrBiasIndicators: [
            'Site advertises both clinical care and retained expert work.',
          ],
          evidenceReference: 'Expert website about page',
        }),
      },
    ],
    other_public_websites: [
      {
        category: 'website',
        title: 'Development fixture: other public website',
        summary: `${FIXTURE_NOTE} Public association page reference.`,
        url: 'https://example.local/association/speaker',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'other_public_website',
          pageTitle: 'Association speaker listing',
          relevantClaims: ['Listed as a conference speaker'],
          evidenceReference: 'Association speaker page',
        }),
      },
    ],
    advertising: [
      {
        category: 'advertising',
        title: 'Development fixture: advertising directory metadata',
        summary: 'Restricted advertising body that must not be stored.',
        url: 'https://example.local/ads/listing',
        access: 'restricted',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'professional_website',
          pageTitle: 'Advertising directory listing',
          advertisingClaims: ['Nationwide expert availability'],
          evidenceReference: 'Advertising listing metadata',
          metadataOnly: true,
          fullText: 'must not store',
        }),
      },
    ],
    ime_websites: [
      {
        category: 'ime',
        title: 'Development fixture: IME website',
        summary: `${FIXTURE_NOTE} Public IME clinic page.`,
        url: 'https://example.local/ime/clinic',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'ime_website',
          pageTitle: 'IME clinic roster',
          advertisingClaims: ['Independent medical examinations available'],
          treatmentPracticeInfo: 'Clinic lists IME appointments.',
          conflictOrBiasIndicators: [
            'Clinic page markets retained examination services.',
          ],
          evidenceReference: 'IME clinic page',
        }),
      },
    ],
    ime_advertising: [
      {
        category: 'advertising',
        title: 'Development fixture: IME advertising metadata',
        summary: 'Restricted IME advertising body that must not be stored.',
        url: 'https://example.local/ime/ads',
        access: 'restricted',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'ime_website',
          pageTitle: 'IME advertising listing',
          advertisingClaims: ['Defense and plaintiff IME availability'],
          evidenceReference: 'IME advertising metadata',
          metadataOnly: true,
        }),
      },
    ],
    youtube: [
      {
        category: 'video',
        title: 'Development fixture: public lecture video',
        summary: `${FIXTURE_NOTE} Public video metadata.`,
        url: 'https://www.youtube.com/watch?v=example',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'youtube',
          pageTitle: `${specialty} lecture sample`,
          date: '2022-04-10',
          description: 'Public lecture listing.',
          transcriptAvailable: false,
          transcriptUnavailableReason:
            'Transcription was unavailable for this public video.',
          importantStatements: [
            'Speaker discusses causation methodology at a high level.',
          ],
          evidenceReference: 'YouTube lecture listing',
        }),
      },
    ],
    presentations: [
      {
        category: 'presentation',
        title: 'Development fixture: conference presentation',
        summary: `${FIXTURE_NOTE} Public presentation reference.`,
        url: 'https://example.local/conference/talk',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'presentation',
          pageTitle: 'Conference presentation listing',
          date: '2021-11-02',
          description: 'Agenda entry for a public conference talk.',
          transcriptAvailable: false,
          transcriptUnavailableReason:
            'Transcription was unavailable for this presentation.',
          evidenceReference: 'Conference agenda',
        }),
      },
    ],
    powerpoints: [
      {
        category: 'powerpoint',
        title: 'Development fixture: slide deck reference',
        summary: `${FIXTURE_NOTE} Public slide reference only. File bytes are not stored.`,
        url: 'https://example.local/slides/index',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'powerpoint',
          pageTitle: 'Slide deck index',
          date: '2020-08-15',
          description: 'Index page for a public slide deck.',
          transcriptAvailable: false,
          transcriptUnavailableReason:
            'Transcription was unavailable. Slide file bytes were not stored.',
          evidenceReference: 'Slide deck index',
        }),
      },
    ],
    social: [
      {
        category: 'social',
        title: 'Development fixture: public LinkedIn profile metadata',
        summary: 'Restricted social content that must not be stored.',
        url: 'https://www.linkedin.com/in/example',
        access: 'restricted',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'social',
          platform: 'linkedin',
          pageTitle: 'Public LinkedIn listing',
          relevantClaims: ['Lists current specialty practice'],
          evidenceReference: 'Public LinkedIn metadata',
          metadataOnly: true,
        }),
      },
      {
        category: 'social',
        title: 'Development fixture: public X profile metadata',
        summary: 'Restricted social content that must not be stored.',
        url: 'https://x.com/example',
        access: 'restricted',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'social',
          platform: 'x',
          pageTitle: 'Public X listing',
          evidenceReference: 'Public X metadata',
          metadataOnly: true,
        }),
      },
    ],
    blogs: [
      {
        category: 'news',
        title: 'Development fixture: blog post',
        summary: `${FIXTURE_NOTE} Public blog reference.`,
        url: 'https://example.local/blog/post',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'blog',
          pageTitle: 'Practice blog post',
          date: '2023-01-20',
          relevantClaims: ['Discusses clinic services'],
          evidenceReference: 'Practice blog post',
        }),
      },
    ],
    patient_reviews: [
      {
        category: 'patient_review',
        title: 'Development fixture: patient review metadata',
        summary: 'Restricted review body that must not be stored wholesale.',
        url: 'https://example.local/reviews/1',
        access: 'restricted',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'patient_review',
          pageTitle: 'Patient review listing',
          reviewDate: '2022-09-01',
          rating: '4/5',
          reviewTextPermitted: false,
          neutralSummary:
            'A public listing shows a rating. No medical or legal conclusion is drawn from the review.',
          evidenceReference: 'Patient review metadata',
          metadataOnly: true,
          fullText: 'must not store',
        }),
      },
    ],
    google_maps: [
      {
        category: 'office',
        title: 'Development fixture: Google Maps business listing',
        summary: `${FIXTURE_NOTE} Public business listing.`,
        url: 'https://maps.google.com/?q=example',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          presenceKind: 'google_maps',
          businessName: `${expertName} Clinic`,
          address: '100 Example Ave, Suite 200',
          locationFlags: ['shared_or_hourly_office', 'requires_verification'],
          locationNote:
            'Listing suggests a shared or hourly office. Address type requires verification. No unsupported conclusion was drawn.',
          evidenceReference: 'Google Maps listing',
        }),
      },
    ],
    courtlistener: [
      {
        category: 'legal',
        title: 'Development fixture: court opinion link',
        summary: `${FIXTURE_NOTE} Sample public opinion reference for workflow tests.`,
        url: 'https://www.courtlistener.com/example',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'expert_witness_case',
          matterKind: 'expert_witness_case',
          caseName: `${expertName} related opinion`,
          caseNumber: '1:18-cv-01001',
          court: 'U.S. District Court',
          jurisdiction: 'Federal',
          filingDate: '2018-04-12',
          documentDate: '2019-06-01',
          relevance: 'Names the queried expert as a disclosed witness.',
          findingsRegardingExpert:
            'The opinion names the expert as a disclosed witness. It does not state a credibility finding.',
          evidenceReference: 'CourtListener opinion link',
        }),
      },
    ],
    justia: [
      {
        category: 'legal',
        title: 'Development fixture: Justia case link',
        summary: `${FIXTURE_NOTE} Public case index link only.`,
        url: 'https://law.justia.com/example',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'case',
          caseName: 'Sample v. Sample',
          caseNumber: 'A-12345',
          court: 'State trial court',
          jurisdiction: 'State',
          filingDate: '2017-09-01',
          documentDate: '2017-09-01',
          relevance: 'Public index entry associated with the queried name.',
          findingsRegardingExpert:
            'The index lists the expert name. No credibility determination is stated.',
          evidenceReference: 'Justia case link',
        }),
      },
    ],
    motions: [
      {
        category: 'motion',
        title: 'Development fixture: motion to exclude',
        summary: `${FIXTURE_NOTE} Sample motion description.`,
        url: 'https://example.local/docket/motion-exclude',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'motion',
          caseName: 'Sample v. Sample',
          caseNumber: 'A-12345',
          court: 'State trial court',
          jurisdiction: 'State',
          filingDate: '2018-01-15',
          documentDate: '2018-01-15',
          shortDescription: 'Motion to exclude expert testimony.',
          relevance: 'Seeks to limit the expert’s testimony.',
          findingsRegardingExpert:
            'The motion asks the court to exclude the expert. A motion is not a court finding.',
          evidenceReference: 'Motion to exclude',
        }),
      },
    ],
    orders: [
      {
        category: 'court_order',
        title: 'Development fixture: scheduling order',
        summary: `${FIXTURE_NOTE} Sample scheduling order.`,
        url: 'https://example.local/docket/order-scheduling',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'order',
          caseName: 'Sample v. Sample',
          caseNumber: 'A-12345',
          court: 'State trial court',
          jurisdiction: 'State',
          filingDate: '2018-02-01',
          documentDate: '2018-02-01',
          shortDescription: 'Scheduling order. Does not address the expert.',
          orderTags: [],
          relevance: 'Sets case deadlines.',
          findingsRegardingExpert:
            'The order does not limit, strike, or criticize the expert.',
          evidenceReference: 'Scheduling order',
        }),
      },
      {
        category: 'court_order',
        title: 'Development fixture: order limiting testimony',
        summary: `${FIXTURE_NOTE} Sample order that limits testimony.`,
        url: 'https://example.local/docket/order-limit',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'order',
          caseName: 'Sample v. Sample',
          caseNumber: 'A-12345',
          court: 'State trial court',
          jurisdiction: 'State',
          filingDate: '2018-03-20',
          documentDate: '2018-03-20',
          shortDescription:
            'Order limiting the expert’s testimony on causation.',
          orderTags: ['limits_expert', 'restricts_testimony', 'qualifications'],
          relevance: 'Limits the scope of the expert’s testimony.',
          findingsRegardingExpert:
            'The order limits the expert’s testimony on causation. It does not state that the expert is not credible.',
          evidenceReference: 'Order limiting testimony',
        }),
      },
    ],
    pleadings: [
      {
        category: 'motion',
        title: 'Development fixture: complaint excerpt reference',
        summary: `${FIXTURE_NOTE} Sample pleading reference.`,
        url: 'https://example.local/docket/complaint',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'pleading',
          caseName: 'Sample v. Sample',
          caseNumber: 'A-12345',
          court: 'State trial court',
          jurisdiction: 'State',
          filingDate: '2017-09-01',
          documentDate: '2017-09-01',
          shortDescription: 'Complaint naming the parties.',
          relevance: 'Background pleading in the same matter.',
          findingsRegardingExpert: 'The pleading does not address the expert.',
          evidenceReference: 'Complaint',
        }),
      },
    ],
    depositions: [
      {
        category: 'deposition',
        title: 'Development fixture: deposition metadata',
        summary:
          'Transcript body that must not be stored from a restricted source.',
        url: 'https://example.local/depo/2019-05-01',
        access: 'restricted',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'deposition',
          caseName: 'Sample v. Sample',
          caseNumber: 'A-12345',
          court: 'State trial court',
          jurisdiction: 'State',
          documentDate: '2019-05-01',
          transcriptMetadata: 'Pages 1-120. Video not retained.',
          shortDescription: 'Deposition of the queried expert.',
          importantStatements: [
            'Date of examination was March 2016.',
            'Years of experience stated as 20.',
          ],
          relevance: 'User-supplied deposition reference.',
          findingsRegardingExpert:
            'Metadata only. The transcript body was not stored.',
          evidenceReference: 'Deposition 2019-05-01',
          fullText: 'transcript body must not be stored',
        }),
      },
    ],
    expert_testimony: [
      {
        category: 'testimony',
        title: 'Development fixture: trial testimony note A',
        summary: `${FIXTURE_NOTE} Sample testimony statement for contradiction tests.`,
        url: 'https://example.local/trial/testimony-a',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'testimony',
          caseName: 'Sample v. Sample',
          caseNumber: 'A-12345',
          court: 'State trial court',
          jurisdiction: 'State',
          documentDate: '2019-08-12',
          importantStatements: [
            'Date of examination was March 2016.',
            'Board certified in the stated specialty.',
          ],
          relevance: 'Trial testimony reference.',
          findingsRegardingExpert:
            'The note records the stated examination date. It does not state a court credibility finding.',
          evidenceReference: 'Trial testimony note A',
        }),
      },
      {
        category: 'testimony',
        title: 'Development fixture: trial testimony note B',
        summary: `${FIXTURE_NOTE} Second testimony statement for contradiction tests.`,
        url: 'https://example.local/trial/testimony-b',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'testimony',
          caseName: 'Other v. Other',
          caseNumber: 'B-99',
          court: 'State trial court',
          jurisdiction: 'State',
          documentDate: '2021-02-03',
          importantStatements: [
            'Date of examination was October 2017.',
            'Board certified in the stated specialty.',
          ],
          relevance: 'Later trial testimony reference.',
          findingsRegardingExpert:
            'The note records a different examination date. It does not state a court credibility finding.',
          evidenceReference: 'Trial testimony note B',
        }),
      },
    ],
    expert_directory: [
      {
        category: 'directory',
        title: 'Development fixture: expert directory listing',
        summary: FIXTURE_NOTE,
        access: 'restricted',
        informationStatus: 'unverified',
        raw: { fixture: true },
      },
    ],
    news: [
      {
        category: 'news',
        title: `Development fixture: news mention of ${expertName}`,
        summary: FIXTURE_NOTE,
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query),
      },
    ],
    grants: [
      {
        category: 'grant',
        title: 'Development fixture: NIH grant listing',
        summary: `${FIXTURE_NOTE} Public grant metadata.`,
        url: 'https://reporter.nih.gov/example',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          professionalKind: 'grant',
          name: expertName,
          title: `${specialty} outcomes study`,
          identifier: 'R01-NS000001',
          grantId: 'R01-NS000001',
          role: 'Principal Investigator',
          participation: 'Named investigator',
          authorship: 'Lead investigator on the application',
          institution: 'Example University',
          startDate: '2018-01-01',
          endDate: '2022-12-31',
          resultsAvailable: true,
          resultUrl: 'https://reporter.nih.gov/example/results',
          evidenceReference: 'NIH RePORTER listing',
        }),
      },
    ],
    grant_results: [
      {
        category: 'grant',
        title:
          'Development fixture: private foundation grant result unavailable',
        summary: `${FIXTURE_NOTE} Private foundation outcome was not available.`,
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          professionalKind: 'grant_result',
          name: expertName,
          title: 'Private foundation pilot award',
          identifier: 'PF-2019-22',
          institution: 'Private Foundation',
          resultsAvailable: false,
          resultsUnavailableReason:
            'Private foundation results were unavailable.',
          evidenceReference: 'Private foundation grant reference',
        }),
      },
    ],
    patents: [
      {
        category: 'patent',
        title: 'Development fixture: patent search',
        summary: `${FIXTURE_NOTE} Public patent metadata.`,
        url: 'https://patents.example.local/US1000000',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          professionalKind: 'patent',
          name: expertName,
          title: 'Sample medical device',
          identifier: 'US1000000',
          patentNumber: 'US1000000',
          filingDate: '2016-05-01',
          status: 'Granted',
          role: 'Inventor',
          evidenceReference: 'USPTO patent listing',
        }),
      },
    ],
    trademarks: [],
    awards: [
      {
        category: 'award',
        title: 'Development fixture: professional award',
        summary: `${FIXTURE_NOTE} Authoritative award listing sample.`,
        url: 'https://example.local/awards/2020',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          professionalKind: 'award',
          name: expertName,
          title: 'Society teaching award',
          identifier: 'STA-2020',
          date: '2020-06-01',
          organization: 'Example Medical Society',
          verificationNote:
            'Listing names the expert. No unsupported conclusion was added.',
          evidenceReference: 'Society award listing',
        }),
      },
    ],
    military_claims: [
      {
        category: 'military',
        title: 'Development fixture: military medal reference',
        summary: `${FIXTURE_NOTE} Public authoritative military reference sample.`,
        url: 'https://example.local/military/medal',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          professionalKind: 'military_medal',
          medal: 'Commendation Medal',
          name: expertName,
          title: 'Commendation Medal reference',
          source: 'Public military awards index',
          verificationNote:
            'Public index entry only. No unsupported conclusion about military service was drawn.',
          evidenceReference: 'Military awards index',
        }),
      },
    ],
    memberships: [
      {
        category: 'membership',
        title: 'Development fixture: society membership',
        summary: `${FIXTURE_NOTE} Public membership listing.`,
        url: 'https://example.local/society/members',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          professionalKind: 'membership',
          organization: 'Example Medical Society',
          cvClaim: 'Fellow, Example Medical Society',
          publicRecord: 'Listed as a member on the society directory',
          status: 'Active',
          evidenceReference: 'Society member directory',
        }),
      },
    ],
    professional_organizations: [
      {
        category: 'membership',
        title: 'Development fixture: professional organization record',
        summary: `${FIXTURE_NOTE} Public organization record.`,
        url: 'https://example.local/org/roster',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          professionalKind: 'professional_organization',
          organization: 'Example Specialty College',
          publicRecord: 'Appears on the public fellow roster',
          cvClaim: 'Fellow, Example Specialty College',
          evidenceReference: 'College fellow roster',
        }),
      },
    ],
    open_payments: [
      {
        category: 'income_bias',
        title: 'Development fixture: Open Payments record',
        summary: `${FIXTURE_NOTE} Public CMS Open Payments sample.`,
        url: 'https://openpaymentsdata.cms.gov/example',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          professionalKind: 'open_payments',
          paymentDate: '2021-03-15',
          paymentAmount: '1250.00',
          payer: 'Example Pharma',
          natureOfPayment: 'Consulting fee',
          forensicWork: 'Not stated in the Open Payments record',
          defenseWork: 'Not stated in the Open Payments record',
          hourlyRate: null,
          referralInfo: null,
          percentForensicWork: null,
          percentDefenseWork: null,
          neutralSummary:
            'Public payment record only. Being paid is not treated as proof of bias.',
          evidenceReference: 'CMS Open Payments',
        }),
      },
      {
        category: 'income_bias',
        title: 'Development fixture: disclosed forensic fee schedule',
        summary: `${FIXTURE_NOTE} Public fee disclosure sample.`,
        url: 'https://example.local/fees',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          professionalKind: 'forensic_income',
          paymentDate: '2023-01-01',
          forensicWork: 'Independent medical examinations',
          defenseWork: 'Retained by defense counsel in some matters',
          hourlyRate: '450',
          referralInfo: 'Referrals through a scheduling service',
          percentForensicWork: '40',
          percentDefenseWork: '60',
          neutralSummary:
            'Percentages are taken from the disclosed record. No bias conclusion is drawn from payment alone.',
          evidenceReference: 'Public fee disclosure',
        }),
      },
    ],
    corporate_affiliations: [
      {
        category: 'corporate_affiliation',
        title: 'Development fixture: corporate affiliation',
        summary: `${FIXTURE_NOTE} Public affiliation record.`,
        url: 'https://example.local/corp/roster',
        access: 'public',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          professionalKind: 'corporate_affiliation',
          organization: 'Example Diagnostics LLC',
          role: 'Medical director',
          startDate: '2019-01-01',
          status: 'Active',
          evidenceReference: 'Corporate roster',
        }),
      },
    ],
    lexisnexis: [
      {
        category: 'legal',
        title: 'Development fixture: LexisNexis link',
        summary: 'Licensed opinion text that must not be stored.',
        url: 'https://advance.lexis.com/example',
        access: 'restricted',
        informationStatus: 'unverified',
        raw: {
          fixture: true,
          fullText: 'opinion body',
          documentType: 'case',
          caseName: 'Licensed Case Caption',
          caseNumber: 'LN-001',
          court: 'Licensed court',
          jurisdiction: 'Unknown',
          documentDate: '2015-11-01',
          relevance: 'Authorized LexisNexis reference only.',
          evidenceReference: 'LexisNexis link',
          metadataOnly: true,
        },
      },
    ],
    criminal_records: [
      {
        category: 'criminal_record',
        title: 'Development fixture: criminal record metadata',
        summary: 'Restricted criminal content that must not be stored.',
        url: 'https://example.local/criminal/meta',
        access: 'restricted',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'criminal_record',
          caseName: 'Public criminal docket reference',
          caseNumber: 'CR-100',
          court: 'State court',
          jurisdiction: 'State',
          documentDate: '2010-01-01',
          relevance: 'Authorized metadata reference only.',
          evidenceReference: 'Criminal docket metadata',
          metadataOnly: true,
          fullText: 'must not store',
        }),
      },
    ],
    malpractice_records: [
      {
        category: 'malpractice',
        title: 'Development fixture: malpractice metadata',
        summary: 'Restricted malpractice content that must not be stored.',
        url: 'https://example.local/malpractice/meta',
        access: 'restricted',
        informationStatus: 'unverified',
        raw: matchedIdentity(query, {
          documentType: 'malpractice',
          matterKind: 'malpractice',
          caseName: 'Malpractice claim reference',
          caseNumber: 'MP-22',
          court: 'State court',
          jurisdiction: 'State',
          filingDate: '2014-05-05',
          documentDate: '2014-05-05',
          relevance: 'Authorized metadata reference only.',
          evidenceReference: 'Malpractice metadata',
          metadataOnly: true,
          fullText: 'must not store',
        }),
      },
    ],
  };
}
