# License, discipline, board-certification, IME, and credential platforms for EWI reports

Access date for all prices and page reads unless a source is dated otherwise: **27 October 2026**. Currency: **USD**. Unpublished list prices are marked **quote-only**. Criminal-record aggregators are not a substitute for official board discipline and are not recommended. Local adapters already in this repo: `florida-mqa.client.ts` (HTML POST, reports blocked vs empty), `npi-registry.client.ts` (official REST), `open-payments.client.ts` (CMS DKAN REST, no key). Internal catalog last checked 22 October 2026: `docs/ewi/provider-register.md`.

## FSMB / DocInfo / Federation Physician Data Center: who can buy access, cost, API?

### Takeaway
DocInfo is FSMB’s free public HTML lookup of the same national license/discipline database; the paid Physician Data Center (PDC) is an institutional credentialing product for hospitals and other health-care organizations at **$9 / Standard** or **$12 / Premium** per physician, with a real OAuth2 API after a signed agreement. PI law firms are not listed as eligible PDC customers.

### Cited Findings
- DocInfo is FSMB’s free public national database of consolidated physician licensure and disciplinary information, described as the same database used by state medical boards and health-care entities during licensure and credentialing, covering disciplinary actions, license history, medical school, degree type, and ABMS/AOA specialty. — [FSMB, Information for Consumers](https://www.fsmb.org/u.s.-medical-regulatory-trends-and-actions/guide-to-medical-regulation-in-the-united-states/information-for-consumers)
- DocInfo is at `www.docinfo.org` and is intended for patients looking for license or sanction information; a live fetch of `https://www.docinfo.org/` on 27 Oct 2026 returned an Incapsula incident (bot wall). — [FSMB PDC Query Form](https://inte.fsmb.org/PDC/pdc-query/pdc-query-form/); fetch of [docinfo.org](https://www.docinfo.org/)
- The 2015 FSMB relaunch said DocInfo reports whether a physician has been disciplined, states of active licensure, medical school, city/state, and specialty certification from ABMS and AOA, with a link to the state board for sanction details; it also covers physician assistants. — [FSMB news release, 19 Aug 2015](https://www.fsmb.org/siteassets/advocacy/news-releases/2015/news-release-docinfo-relaunch.pdf)
- PDC query form copy: “If you’re a hospital or health care organization and would like to request a PDC account…” Patients are directed to DocInfo; physicians sending a report for licensure are directed to Practitioner Direct Service. — [FSMB PDC Query Form](https://inte.fsmb.org/PDC/pdc-query/pdc-query-form/)
- Eligible PDC user types listed during the 2020 COVID no-cost window (now expired): Hospital; Government Agency; Credentials Verification Service; Managed Care Facility; Placement Service; Medical Group or Clinical Practice. Law firms / attorneys are not on that list. — [ACGME / FSMB statement](https://www.acgme.org/newsroom/2020/3/acgme-shares-federation-of-state-medical-boards-fsmb-information-on-access-to-physician-data-center/)
- Account setup: email `pdc@fsmb.org` or complete the request form; phone (817) 868-4010. — [FSMB PDC FAQ](https://www.fsmb.org/PDC/pdc-faq/); [Request a PDC Account](https://www.fsmb.org/PDC/request-a-pdc-account/)
- Published per-query prices (still on the live FAQ as of 27 Oct 2026): **Standard Profile $9.00/physician**, includes 12 months of monitoring; **Premium Profile $12.00/physician**, same data plus ABMS board specialty. Charged when a query is run; monthly invoice on the first of the month; pay by card or check within 30 days; one org account, unlimited users. — [FSMB PDC FAQ](https://www.fsmb.org/PDC/pdc-faq/)
- PDC profiles do **not** contain malpractice information. They do include revocations/suspensions, loss of license, probation/restrictions, licensure denials, reinstatements, consent orders, administrative actions (fines, warnings), and Medicare/Medicaid exclusions or reinstatements. Queryable professions: MD, DO, PA only (other professions only if they also hold those designations). — [FSMB PDC FAQ](https://www.fsmb.org/PDC/pdc-faq/)
- PDC claims Joint Commission and URAC primary-source-equivalent status for state-board and federal sanctions, and NCQA-approved source status for state-board and federal sanctions history. All state medical boards contribute; cadence is daily, weekly, monthly, or quarterly depending on the board. Disciplinary alerts from boards are received daily. — [FSMB PDC FAQ](https://www.fsmb.org/PDC/pdc-faq/)
- Standard Profile contents (marketing): biographical information, license history, education and training, national identification numbers when available. Premium adds specialty board certification. FSMB says PDC is a designated equivalent source by ABMS. First year of continuous monitoring is included. — [FSMB PDC Query](https://www.fsmb.org/PDC/pdc-query)
- A separate “Data Licensing” product exists for high-volume institutional users; no public USD price. — [FSMB Physician Data Center](https://www.fsmb.org/pdc/)
- Official PDC API exists: production `https://services-pdc.fsmb.org`, OAuth2 client-credentials, scopes `pdc.search`, `pdc.member_read`, `pdc.member_write`. Search is `POST /v2/rosters/{customerKey}/search` requiring name plus one of birthDate, NPI, or licenseNumber. Contact `pdc@fsmb.org` to begin. OpenAPI: `https://services-pdc.fsmb.org/openapi/v2.yaml`. — [FSMB PDC OpenAPI](https://services-pdc.fsmb.org/openapi/v2.yaml); [github.com/fsmb/pdc-api](https://github.com/fsmb/pdc-api)
- Third-party credentialing vendor Modio (2025 integration guide): API access requires a signed FSMB agreement and an existing PDC account; each report is billed through PDC; request “PDC API” credentials from `pdc@fsmb.org` (stated turnaround ~2 business days). — [FSMB + Modio Integration 2025 PDF](https://www.modiohealth.com/life/wp-content/uploads/FSMB-Modio-Integration-2025.pdf)

### Inferences
- For a Florida PI defense EWI product, DocInfo is the FSMB-authorized public path; PDC is the path that actually “proves” multi-state license/discipline for Joint Commission/NCQA-style PSV — but only if FSMB will sell an account to a law firm or a CVO acting for one. Public pages never list attorneys as eligible.
- DocInfo is HTML-only and bot-walled (Incapsula). There is no public DocInfo API. Scraping it is a terms and reliability problem, not a substitute for PDC.
- Premium PDC at $12 is cheaper than a separate ABMS CertiFACTS subscription for a one-off expert, but it is still not a full CertiFACTS PSV product and is gated by eligibility.

### Gaps
- Whether a PI defense law firm, an expert-research vendor, or a CVO hired by a law firm can obtain a PDC account is **unpublished**. Public copy says hospital / health-care organization. Quote FSMB (`pdc@fsmb.org`) rather than assume yes.
- Data-licensing agreement pricing is unpublished (quote-only).
- DocInfo’s exact current field list versus PDC Standard/Premium is not fully documented on the live consumer page (bot wall prevented a 27 Oct 2026 read of the tool itself).

## State medical boards besides Florida MQA: usable public APIs or bulk data vs HTML-only? Priority: FL, NY, CA, TX, NJ, PA, GA, IL

### Takeaway
Florida, California, Texas, New Jersey, and Illinois publish official bulk or API license data; New York publishes a Socrata API for **discipline** but license verification is HTML (API in limited beta); Pennsylvania and Georgia are HTML-first, with paid roster files that are weaker than live verification. None of these board products is a criminal-record file.

### Cited Findings

#### Florida (priority #1; already coded)
- Official license verification is the MQA Search Services HTML form at `https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders`. Search by license number, name, city, county, ZIP; results can be exported as CSV; detail pages show discipline-on-file and public complaints. — [MQA Search Services and Data Download User Guide, rev. 1.27.2025](https://mqa-internet.doh.state.fl.us/MQASearchServices/Content/HelpFile/MQA%20SearchServices%20and%20DataDownload%20UserGuide.pdf)
- Practitioner Profile data (education, privileges, financial responsibility, legal actions, board final discipline, liability claims >$100,000 for MD/DO) is **self-reported by the practitioner and not verified by DOH unless otherwise indicated**. Required profile professions include Medical Doctors and Osteopathic Physicians. — [same User Guide §2.3](https://mqa-internet.doh.state.fl.us/MQASearchServices/Content/HelpFile/MQA%20SearchServices%20and%20DataDownload%20UserGuide.pdf)
- Separate Discipline and Administrative Actions search exists on the same portal. — [same User Guide §2.4](https://mqa-internet.doh.state.fl.us/MQASearchServices/Content/HelpFile/MQA%20SearchServices%20and%20DataDownload%20UserGuide.pdf)
- Official **Data Download Portal** provides daily-updated pipe-delimited ASCII licensure files (all professions or one profession; all statuses or currently licensed). Sign-on is required. Files can exceed 1 million records. No official REST API is documented. Guides live at [flhealthsource.gov/data-portal](https://flhealthsource.gov/data-portal/). — [User Guide §3](https://mqa-internet.doh.state.fl.us/MQASearchServices/Content/HelpFile/MQA%20SearchServices%20and%20DataDownload%20UserGuide.pdf); [FL HealthSource Data Portal](https://flhealthsource.gov/data-portal/)
- Repo adapter `florida-mqa.client.ts` posts to the HTML search and treats 3xx/bot walls as `blocked`, not as “no license.” `docs/ewi/provider-register.md` (22 Oct 2026) correctly says “no stable public API” and “bot / session walls,” but does **not** catalog the official bulk download portal.
- Third-party Apify “Florida MQA scrapers” exist; they are not official APIs and should not be used as the source of truth. — [example listing](https://apify.com/parseforge/florida-mqa-scraper/api/openapi)
- Third-party map (checked 7 Sep 2026) placed the download host at `data-download.mqa.flhealthsource.gov` and estimated ~1.5 million licensees. Treat host name as unofficial until confirmed in a logged-in session. — [VeriflowAPI state map, 7 Sep 2026](https://veriflowapi.com/research/state-license-data-sources.html)

#### New York
- License verification (primary source, updated daily Mon–Fri) is NYSED Office of the Professions HTML search: `https://op-prod.nysed.gov/verification-search`. — [NYSED verifications](https://www2.nysed.gov/COMS/EL001/ELSCR1)
- NYSED is “currently working on an API for bulk verification searches.” Organizations may request an API key via a support ticket; access is not automatically public. Profession list includes Physician. — [NYSED Bulk Verification Request form](https://op-support.nysed.gov/hc/en-us/requests/new?ticket_form_id=7599671137683)
- Physician **discipline** is not at NYSED; it is NYSDOH Office of Professional Medical Conduct (OPMC). Individual search: `https://www.health.ny.gov/professionals/doctors/conduct/`. — [OPMC license lookup](https://www.health.ny.gov/professionals/doctors/conduct/license_lookup)
- Official bulk/API for OPMC actions: Health Data NY dataset “Professional Medical Conduct Board Actions: Beginning 1990,” identifier `ebmi-8ctw`, Socrata JSON `https://health.data.ny.gov/resource/ebmi-8ctw.json` (also `/api/views/ebmi-8ctw.json`). Fields: name, address, license number, license type, year of birth, effective date, action, misconduct description, date updated. Updated monthly; covers physicians, PAs, specialist assistants, and professional medical corporations disciplined since 1990, non-disciplinary board orders, and served charges. — [Health Data NY dataset](https://health.data.ny.gov/Health/Professional-Medical-Conduct-Board-Actions-Beginni/ebmi-8ctw); [dataset overview PDF](https://health.data.ny.gov/api/assets/21122812-38D4-4083-8B05-7E32E284961C?download=true)
- A New York license does not expire; the triennial **registration** does. That distinction matters when interpreting “active.” — [VeriflowAPI, 7 Sep 2026](https://veriflowapi.com/research/state-license-data-sources.html) (third-party; consistent with NYSED registration model)

#### California
- Live public search is DCA BreEZe / DCA Search (HTML). Medical Board of California is on BreEZe. — [DCA About BreEZe](https://www.dca.ca.gov/breeze/about_breeze.html)
- **Free bulk:** Medical Board of California publishes a free Microsoft Access 2007+ physician/surgeon public database, refreshed every Tuesday morning; outpatient surgery settings monthly. Delivered via BOX after a request form. No NPI; email/phone confidential. Same information as DCA Search. — [MBC Public Information](https://mbc.ca.gov/Resources/Statistics/Public-Information.aspx)
- **Official API:** DCA iServices Search API, base `https://iservices.dca.ca.gov/api/search/v1/`, headers `app_id` and `app_key` after creating an iServices account. Guide dated **October 2025**. Legacy `https://search-api.dca.ca.gov/` must be migrated. MBC says the API is real-time, best used with a known list of license numbers, documentation is minimal, and a one-hour demo is required after DCA creates the account. — [DCA iServices API User Guide (Oct 2025)](https://iservices.dca.ca.gov/docs/iservice_user_guide.pdf); [MBC Public Information API form](https://mbc.ca.gov/Resources/Statistics/Public-Information.aspx)
- Third-party (7 Sep 2026): DCA also publishes monthly public licensee files for MBC and the Osteopathic Medical Board; tab-delimited; status vocabulary Current / Delinquent / Current Inactive; **no disciplinary history in the files** (discipline is in the API / live profile). `search.dca.ca.gov` was WAF-blocked from their network. — [VeriflowAPI](https://veriflowapi.com/research/state-license-data-sources.html)
- Paper copies of historical disciplinary documents: 10 cents/page plus staff time under BPC §161; lists of licensees in other formats may have cost-recovery charges (phone 916-574-8004). The Access bulk DB itself is described as free. — [MBC PRA Guidelines](https://www.mbc.ca.gov/Download/Documents/public-records-act.pdf)

#### Texas
- Live verification: TMB Look Up a License / profile search, updated daily (page stated data last updated **Monday, 26 October 2026**). Covers physicians, PAs, and other TMB professions; board orders/remedial plans where applicable. Copy: “intended solely for use with the automated verification system. Unauthorized access or use is strictly prohibited.” — [TMB Look Up a License](https://www.tmb.texas.gov/resources/for-the-public/look-up-a-license); [profile.tmb.state.tx.us/Search.aspx](https://profile.tmb.state.tx.us/Search.aspx)
- **Free official bulk + API:** Texas Open Data Portal dataset “DataSet-01-All Licenses” (`tm3v-pfq9`), ~514K rows, 23 columns, updated **daily**; last updated **26 October 2026**. Fields include license_type, first/last name, year_of_birth, license_number, issue/expiration dates, registration_status, **disciplinary_status**, disciplinary_status_date, license_status. OData v2 endpoint is advertised on the dataset page. — [data.texas.gov DataSet-01-All Licenses](https://data.texas.gov/dataset/DataSet-01-All-Licenses/tm3v-pfq9)
- Paid monthly Excel/text reports also exist via TMB Open Records Self-Service Portal (ORSSP). Newest reports posted first business day of the month; data date on portal **10/1/2026**. Price is shown only after login/checkout (**quote/cart-only**). TMB says licensees submit some ORSSP data and users should use Licensee Verification for what TMB has verified. Unauthorized access language is the same as the live search. — [ORSSP](https://orssp.tmb.state.tx.us/); [TMB data reports](https://tmb.state.tx.us/page/data-reports)
- Third-party VeriflowAPI (7 Sep 2026) listed Texas as “live lookup, no bulk file.” That is **contradicted** by the official data.texas.gov dataset above (created 8 June 2022, still updating 26 Oct 2026). Prefer the Open Data Portal.

#### New Jersey
- Live verification: `https://newjersey.mylicense.com/Verification/` — “intended to be used for VERIFICATION ONLY.” Bulk users are redirected to a roster download. — [NJ MyLicense Verification](https://newjersey.mylicense.com/Verification/)
- Official bulk roster: `https://newjersey.mylicense.com/Verification_Bulk/Search.aspx` — select profession, license type, status; download may take a few minutes. Third-party measurement: pipe-delimited, confirmation screen charged **$0.00**. — [NJ Verification_Bulk](https://newjersey.mylicense.com/Verification_Bulk/Search.aspx); [VeriflowAPI](https://veriflowapi.com/research/state-license-data-sources.html)
- No public REST API found on NJ DCA / BME pages. Board Action / discipline is on the live detail page, not in the roster file (third-party). — [NJ BME](https://www.njconsumeraffairs.gov/bme); [VeriflowAPI](https://veriflowapi.com/research/state-license-data-sources.html)

#### Pennsylvania
- Official live verification: PALS (`https://www.pals.pa.gov/`), Person Search / Disciplinary Search. DOS says PALS is how the public verifies license number, status, and whether the licensee has faced disciplinary action. Boards include Medicine and Osteopathic Medicine. — [PA.gov verify a license](https://www.pa.gov/services/dos/verify-a-professional-or-occupational-license)
- No public PALS REST API documented. PALS home also links “List Sales.” — [PALS default](https://www.pals.pa.gov/pages/default.html)
- Paid bulk **active** lists: $71.00 setup + **$0.005 per licensee** statewide, or **$0.03 per licensee** by county. Fields: license number, name, city, county, certification date, expiration date. **No phone, email, or mailing labels.** Inactive lists exist with the same fields. Excel download after registration. Not a discipline file. — [PA DOS List Requests](https://www.pa.gov/agencies/dos/programs/professional-licensing/list-requests)
- Third-party (7 Sep 2026): PALS name match is prefix, results cap 500, expired training permits often sort first, discipline empty unless the detail call carries person id. — [VeriflowAPI](https://veriflowapi.com/research/state-license-data-sources.html)

#### Georgia
- Live verification (primary source for license number, status, issue date, expiration date, and **public disciplinary actions**): `https://gateway.medicalboard.georgia.gov/verification/search.aspx`. Specialty board certification and specialty on the site are **not** primary-source. Physician profile is physician-supplied under the Patient Right to Know Act. — [GCMB primary-source statement](https://medicalboard.georgia.gov/document/document/gcmb-primary-source-verification/download); [License Verification](https://gateway.medicalboard.georgia.gov/verification/search.aspx)
- Self-serve CSV roster of **currently licensed** practitioners (no status history): `https://gateway.medicalboard.georgia.gov/Verification/roster.aspx`. Purchaser agrees not to distribute for resale. — [GCMB roster](https://gateway.medicalboard.georgia.gov/Verification/roster.aspx)
- Priced snapshots (Excel/CSV, emailed): **Physicians (MD & DO) $500.00**; most allied types $200.00; **All professions $1,100.00**. Columns include status, first license date, expiration, specialty, public board action, date of action. No published refresh subscription — another $500 buys another snapshot. Resale/distribution prohibited. — [GCMB Data Request](https://gateway.medicalboard.georgia.gov/DataRequests/request.aspx)
- Live lookup is widely reported as reCAPTCHA-gated. — [VeriflowAPI, 7 Sep 2026](https://veriflowapi.com/research/state-license-data-sources.html)

#### Illinois
- Official primary-source lookup (Joint Commission, NCQA, AOA HFAP): IDFPR License Lookup, daily updates for single lookup; **weekly** for Bulk License Lookup (up to 1,000 license numbers). Bulk URL: `https://idfpr.illinois.gov/licenselookup/bulklookup.html`. Disciplinary **documents** are via FOIA, not the lookup. — [IDFPR Check License](https://idfpr.illinois.gov/checklicense.html)
- Official open-data API (Socrata): Professional Licensing dataset `pzzh-kp68` on `data.illinois.gov`. JSON: `https://data.illinois.gov/resource/pzzh-kp68.json`. Free. IDFPR roster page also points here. Addresses are not in FOIA-compliant rosters. — [IDFPR GenerateRoster](https://online-obre.micropact.com/Lookup/GenerateRoster.aspx); [Illinois Open Data Professional Licensing](https://data.illinois.gov/Business-and-Workforce/Professional-Licensing/pzzh-kp68)
- Third-party (7 Sep 2026): ~4.2 million records, daily refresh. Status trap: `TERMINATED VALID REASON` is an ended license, not “valid/active.” — [VeriflowAPI](https://veriflowapi.com/research/state-license-data-sources.html)

#### Cross-state caution (not a substitute for the boards above)
- A third-party 50-state map dated **7 September 2026** is useful for bot-wall / vendor-platform context but missed Texas’s official open-data dataset and should not be treated as primary. — [VeriflowAPI](https://veriflowapi.com/research/state-license-data-sources.html)

### Inferences
- For Florida PI experts, the **issuing-body** path is: MQA HTML verification (already coded, often blocked) **plus** the official daily pipe-delimited download (not yet in `provider-register.md`). That bulk file is the practical way to make FL license/discipline sections reliable without fighting the bot wall on every report.
- Best official machine-readable boards among the priority list: **IL (Socrata API), TX (Socrata/OData daily licenses + discipline status), CA (weekly Access bulk + approved iServices API), NJ (free roster), FL (daily download, account required), NY OPMC (Socrata discipline)**. Weakest: **PA and GA live HTML**, with paid lists that omit or freeze discipline.
- NPI is not on CA MBC bulk files and almost never on state rosters; identity join still needs NPPES.

### Gaps
- Exact Florida Data Download Portal login URL and whether the licensure file includes a discipline flag (User Guide lists license status, mailing address, email; metadata file not fetched).
- Whether NYSED’s bulk-verification API is actually issuing keys in 2026, and at what cost (form says “working on” an API).
- TMB ORSSP cart prices (unpublished until checkout).
- CA iServices rate limits and whether an attorney/research vendor will be approved (form asks Business/Organization; no published fee).
- GA roster vs $500 snapshot: live roster page did not show a price in the fetch; data-request page prices the fuller file.

## ABMS / board certification verification products and cost

### Takeaway
Professional proof of ABMS certification is **CertiFACTS Online** (attorneys are an intended customer class) or **ABMS Direct Connect Select** (API only through named credentialing platforms). Dollar prices are **unpublished (quote-only)**. The free Certification Matters site is for patients only and is not authorized for professional/EWI use. Osteopathic certification is a separate $25 AOA Profile.

### Cited Findings
- ABMS Solutions licenses CertiFACTS for primary-source verification of ABMS board certification, updated daily from 24 Member Boards, >1 million physicians. Users explicitly include “hospitals and health systems as well as **attorneys, insurance groups, and other professionals**.” — [ABMS Solutions FAQs](https://www.abmssolutions.com/faqs/)
- CertiFACTS Online plans: **Limited** (any number of searches, **minimum 5 queries**); **Unlimited** one-year and two-year subscriptions. Unlimited plans get “My Favorite Physicians” lists and alerts. CertiFACTS “does not provide any third-party webcrawl access or software integration.” No USD prices on the product page. Phone (800) 733-2267, sales@ABMSSolutions.com. — [CertiFACTS Online](https://www.abmssolutions.com/product-comparison/certifacts-online/)
- ABMS Direct Connect Select: API into Axuall, HealthStream, MD Staff, symplr, and Verifiable; packages **minimum 100 queries** or unlimited search; one user login per email; does **not** include manual CertiFACTS access. No USD prices. — [ABMS Direct Connect Select](https://www.abmssolutions.com/product-comparison/abms-direct-connect-select/)
- ABMS Custom Data Services: Excel or pipe-delimited extracts, customized, one-time to multi-year. Quote-only. — [Product Comparison](https://www.abmssolutions.com/product-comparison/)
- A legacy SOAP endpoint still exists at `https://dcs.abms.org/VerifyCertification.asmx` (VerifyCertification web service). No public pricing or eligibility text on that page. — [dcs.abms.org](https://dcs.abms.org/VerifyCertification.asmx)
- **Certification Matters** (`certificationmatters.org`) is free for patients/families, **15 searches per rolling 24 hours**, and “is not valid or authorized for use by professional organizations.” Professional users are told to buy CertiFACTS. — [Patient vs professional user](https://www.certificationmatters.org/faq/what-is-the-difference-between-a-patient-and-a-professional-user/); [search limit FAQ](https://www.certificationmatters.org/faq/why-cant-i-do-an-unlimited-number-of-searches/); [ABMS Verify Certification](https://www.abms.org/board-certification/verify-certification/)
- FSMB PDC Premium ($12) includes “board specialty from ABMS” and FSMB calls PDC a designated ABMS equivalent source — this is not the same product as CertiFACTS PSV (effective/expiration dates, full certification history, continuing certification). — [FSMB PDC FAQ](https://www.fsmb.org/PDC/pdc-faq/); [FSMB PDC Query](https://www.fsmb.org/PDC/pdc-query)
- **AOA Official Osteopathic Physician Profile Report**: primary source for osteopathic education, training, and AOA specialty board certification (and can display ABMS certs as an Official Display Agent). **$25 per profile** for non-member physicians and for healthcare organizations; **$0** for AOA members sending/ordering; **$0** for state medical licensing boards. Meets TJC/NCQA/URAC/NAIC PSV for listed osteopathic elements. Unofficial copies are not sufficient as PSV. — [AOA Profiles FAQ](https://aoaprofiles.org/faq); [AOIA AOA Profiles](https://www.aoiassn.org/aoa-profiles); [sample profile](https://aoaprofiles.org/sample-profile)
- Local catalog already flags **ABPP** directory as proposed/manual, $0 lookup, “no verification API found,” and warns not to infer ABPP from Justia. — [`docs/ewi/provider-register.md` §2, 22 Oct 2026]

### Inferences
- Using Certification Matters (or Google snippets that echo it) in an EWI credential section is exactly the “web-snippet guess” problem: ABMS forbids professional use, caps searches, and does not deliver dated PSV artifacts.
- For MD experts: CertiFACTS Limited (min 5 queries) is the honest professional product if PDC eligibility fails. For DO experts common in Florida: AOA Profiles at $25 is the official path and is cheaper and clearer than ABMS quote-only plans.
- Direct Connect Select is useless to this repo unless the product is rebuilt on Axuall/HealthStream/MD Staff/symplr/Verifiable.

### Gaps
- CertiFACTS Limited per-query price and Unlimited annual USD price are unpublished as of 27 Oct 2026 (quote-only from 800-733-2267).
- Whether CertiFACTS will sell to a software vendor that caches results for law-firm reports (vs a law firm using the UI) is unpublished; the “no third-party webcrawl or software integration” note is a warning.
- AOA Profiles eligibility for a law firm vs “Healthcare Organization” types is listed as a click-through list not captured here; $25 is the published non-member/HCO price.

## SEAK, DRI, JurisPro, ALM, ExpertPages, SEAK IME directories: membership vs scrape vs API; typical annual cost

### Takeaway
These directories **prove paid advertisements**, not licenses or board certs. Attorney **search is free** (no official API) on SEAK, JurisPro, ExpertPages, and ALM; DRI’s expert database is a **member benefit** at **$335/year** individual dues, with extra Courtroom Insight features quote-only. Expert listing prices are published. Scraping is not an official product.

### Cited Findings
- **SEAK Expert Witness Directory:** attorney search is “100% free”; no referral fees; contact experts directly; 2,000+ experts. Expert **annual standard listing $655** (signup order total and store page). Additional state listings **$350/state/year**. Print upsells: half-page **$770**, full-page **$1,270**. First-time listing money-back until April 1, 2028. No official API found. Third-party Apify scrapers exist and are not SEAK products. — [seakexperts.com](https://www.seakexperts.com/); [signup](https://www.seakexperts.com/signup); [store listing](https://store.seak.com/seak-expert-witness-directory-listing/); [about](https://www.seakexperts.com/content/about)
- **SEAK IME Directory** (National Directory of Independent Medical Examiners, `imenet.com`): **annual standard listing $575**, website + print directory mailed to insurers, IME companies, TPAs, attorneys. First-time money-back before January 1, 2028. No official API found. — [SEAK IME store](https://store.seak.com/seak-ime-directory-listing/); [imenet application](https://www.imenet.com/content/IMEapplication)
- **JurisPro:** attorney access described as free on the internet. Expert listing **$449 a year** (includes taxes; multi-year discounts). No hourly-rate share. No official API found. An undated Courtroom Insight marketing guide listed JurisPro at $399/year — **contradicted** by the live registration page at $449. — [JurisPro registration](https://www.jurispro.com/expert-witness-registration); older recap: [Courtroom Insight marketing guide](https://test.courtroominsight.com/resources/expert-witness-marketing-guide)
- **ExpertPages:** Regional **$395/year** (1 of 4 regions, up to 15 areas); Nationwide **$495/year** (all regions + Canada, up to 30 areas). No lead fees / fee sharing / markups. Firmwide membership: call 415-339-6512 (quote). No official API found. — [Join ExpertPages](https://www.expertpages.com/jointoday); [signup](https://www.expertpages.com/signup)
- **ALM / Law.com Experts:** attorney-facing regional flipbook directories are free to search. Expert listing tiers **Bronze $749/year**, **Silver $1,295/year**, **Gold $1,695/year** (“as low as”). Extra digital directories: Gold $1,495–$1,395 each, Silver $1,095–$995, Bronze $629–$529 depending on count. Southeastern directory covers Alabama, Florida, Georgia, Mississippi, North Carolina, South Carolina, Tennessee. No official API found. — [ALM product listing](https://www.almexperts.com/addlisting/productlisting); [additional directories](https://www.law.com/expert-witness/addListing/GetDigitalDirectories); [Law.com Experts Directories](https://www.law.com/expert-witness/almexpertsdirectories/)
- **DRI:** Individual membership **$335/year** (2026 application form marked IM-2026); Young Lawyer $195; Corporate Counsel $335; Senior $65; Affiliate $125; Law Student $20. — [DRI membership types](https://www.dri.org/membership/applications); [individual application PDF](https://www.dri.org/docs/default-source/membership-applications/individual.pdf?sfvrsn=496220f1_26)
- DRI Courtroom Insight / Expert Witness Database: member benefit; DRI’s own expert-resources page says 65,000+ plaintiff and defense experts; Solutions Marketplace says 460,000+ expert witnesses, free sharing of CVs/transcripts/comments for members; **paid add-ons** for Daubert challenge histories, public performance reviews, judicial opinion excerpts; custom research/referral also sold. Courtroom Insight lists “CI APIs” as a product with **no public price**. — [DRI expert resources](https://www.dri.org/legal-resources/expert-witness-services); [DRI Solutions Marketplace](https://www.dri.org/solutionsmarketplace); [Courtroom Insight register/products](https://www.courtroominsight.com/register)
- Standalone **Daubert Tracker** (often bundled conceptually with challenge history, not the same as a license board): individual annual **$495**; 2-hour **$50**; 30-minute **$25**; documents $7.50 with subscription / $15 without. Group per-user rates start at $450 for 2 members. — [Daubert Tracker ordering](https://dauberttracker.com/product/ordering.cfm)
- Internal `provider-register.md` (22 Oct 2026) listed SEAK/DRI/ALM only as “Subscription / quote” with no dollar figures. Live 27 Oct 2026 pages above **do** publish listing and DRI dues prices; Courtroom Insight enterprise/API remains quote-only.

### Inferences
- For EWI reports, a SEAK/JurisPro/ExpertPages/ALM/SEAK-IME hit is admissible as **“this physician advertises as an expert/IME”**, including IME availability to insurers — it does not verify ME/OS license status or ABMS cert.
- Do not scrape. Attorney search UIs are the licensed access path; listing fees are paid by the expert, not the investigating firm.
- DRI is the only directory-class source here that is defense-bar gated and may contain **opponent comments / shared transcripts**, which is a different (and still not official-credential) evidence type.

### Gaps
- Courtroom Insight member vs paid-tier USD prices (quote-only). Whether “CI APIs” are sold to non-DRI vendors is unpublished.
- SEAK/JurisPro/ExpertPages/ALM terms of use on automated harvesting were not captured in full; third-party scrapers exist, which is a reason not to treat scrape-as-API as a product.
- Whether a given Florida PI expert is listed cannot be known without searching; directories are opt-in advertising, so **absence is not evidence of non-practice**.

## NPDB: is it available to PI attorneys at all?

### Takeaway
**No.** NPDB is not a PI-attorney product. Defense firms cannot query it. Even plaintiff attorneys may obtain a one-time Title IV extract only in a malpractice case **against a hospital**, only after proving the hospital failed a mandatory query, and may use the data **only against the hospital, not the practitioner**.

### Cited Findings
- Querying NPDB report information “is not available to the general public,” with two exceptions: Self-Query (own record) and Plaintiff’s Attorney under limited conditions. Organizations must be registered eligible entities; what they receive is determined by law. Intended uses listed: privileging, employment, professional review, hospital two-year review, licensing, fraud-and-abuse investigation, government-program certification. — [NPDB Querying](https://www.npdb.hrsa.gov/hcorg/aboutQuerying.jsp)
- Eligible-entity query fee: **$2.50** per One-Time Query or per one-year Continuous Query enrollment. One-Time and Continuous merge into “NPDB Query” on **4 December 2026**. — [NPDB Querying](https://www.npdb.hrsa.gov/hcorg/aboutQuerying.jsp); [Billing and Fees](https://www.npdb.hrsa.gov/hcorg/billingAndFees.jsp)
- Self-Query: personal account **$0** to view; **$3.00/year** for unlimited certified Self-Query PDF access; mailed paper copies **$13.00** extra. The subject may share their own Self-Query; a hospital cannot use a copy to satisfy its query duty. — [NPDB Self-Query cost FAQ](https://www.npdb.hrsa.gov/faqs/sq2.jsp); [Guidebook Ch. C Self-Queries](https://npdb.hrsa.gov/guidebook/CSelfQueries.jsp); [Billing and Fees](https://www.npdb.hrsa.gov/hcorg/billingAndFees.jsp)
- Attorney access (NPDB’s own attorney page and Guidebook): only a **plaintiff’s** attorney (or pro se plaintiff) and only if (1) a medical malpractice action/claim was filed **against a hospital**, (2) the practitioner is named in that action, and (3) HHS is given discovery evidence that the hospital failed its mandatory NPDB query. One-time disclosure only; Title IV reports only (malpractice payments, state licensure actions, clinical privileges, professional society, DEA, Medicare/Medicaid exclusions). **“The information obtained from the NPDB on the practitioner can be used only with respect to a legal action or claim against the hospital, not against the practitioner.”** Further disclosure is a CMP under SSA §1128A / 42 USC §1320a-7a. A fee is assessed if disclosure is approved. — [NPDB Information for Attorneys](https://www.npdb.hrsa.gov/resources/infoForAttorneys.jsp); [Guidebook Ch. D Queries](https://npdb.hrsa.gov/guidebook/DOverview.jsp); [45 CFR §60.18](https://www.law.cornell.edu/cfr/text/45/60.18)
- Internal catalog already marks “Commercial criminal / NPDB aggregators” as **Reject**. — [`docs/ewi/provider-register.md` §4 and §6, 22 Oct 2026]

### Inferences
- A Florida PI **defense** investigation of an opposing medical expert has **zero** lawful NPDB query path. Buying a “national practitioner” or criminal-record API and labeling it NPDB-equivalent would be both legally false and the exact aggregator failure mode the catalog already rejects.
- The only NPDB document that could appear in an EWI file is a **Self-Query the expert voluntarily produced** (e.g., attached to a hospital credentialing packet that later became public) — and even then it is the expert’s copy, not an attorney query.

### Gaps
- The specific USD fee for an approved plaintiff-attorney disclosure is described only as “a fee is assessed,” not as a unique line item; eligible-entity queries are $2.50. Unconfirmed whether attorney disclosures use the same $2.50.
- Whether any commercial “NPDB search” product sold to law firms is an illegal redisclosure vs a scrape of public board sites is a legal question; none should be treated as NPDB.

## Open Payments vs other industry-payment databases

### Takeaway
CMS Open Payments is the current official, free, no-key API and bulk download for manufacturer/GPO payments to physicians (data displayed **January 2019–December 2025** on the public site). ProPublica Dollars for Docs is a **historical, no-longer-updated** derivative. Exclusion lists (OIG LEIE, SAM.gov) are a different legal fact (program exclusion), not “industry payments.”

### Cited Findings
- Official site: `https://openpaymentsdata.cms.gov/`. Public search displays program years **January 2019–December 2025**. Anyone may download complete yearly ZIP/CSV datasets. Publication is twice yearly (initial + refresh). — [Open Payments home](https://openpaymentsdata.cms.gov/); [CMS methodology / data dictionary, January 2026](https://www.cms.gov/files/document/open-payments-methodology-data-dictionary-document-january-2026.pdf)
- Official API: `https://openpaymentsdata.cms.gov/api/1` (DKAN). Metastore, search, datastore query, SQL, and download. Public read access requires **no API key**. New endpoints update with each data publication. Repo adapter already calls this API. — [Open Payments API](https://openpaymentsdata.cms.gov/about/api); local `open-payments.client.ts`
- Open Payments covers general payments, research payments, and ownership/investment interests from applicable manufacturers and GPOs to physicians, NPPs, and teaching hospitals. It is not all professional income; publication is delayed by the statutory cycle. — [CMS methodology Jan 2026](https://www.cms.gov/files/document/open-payments-methodology-data-dictionary-document-january-2026.pdf); [`docs/ewi/provider-register.md` §1]
- **ProPublica Dollars for Docs** compiled CMS Sunshine data (and earlier settlement disclosures). The live explainer still describes an older vintage (one page: Aug 2013–Dec 2015 general payments only; archive of 2009–2013 settlement data). It is not a current substitute for Open Payments. — [ProPublica About the Dollars for Docs Data](https://www.propublica.org/article/about-the-dollars-for-docs-data)
- **HHS-OIG LEIE** (Medicare/Medicaid/federal program exclusions): free online search and monthly full CSV download (update stamp **10-09-2026** on the download page). No public REST API for the file; Privacy Act requires using Online Search to verify individuals because SSNs are stripped from the download. Hiring an excluded person can trigger CMPs. This is exclusion, not industry payment. — [OIG Exclusions](https://www.oig.hhs.gov/exclusions/); [LEIE downloads](https://www.oig.hhs.gov/exclusions/leie-database-supplement-downloads/)
- **SAM.gov Exclusions API**: public REST `https://api.sam.gov/entity-information/v4/exclusions?api_key=...` after generating a SAM.gov API key. Broader federal debarment, including some OIG exclusions. — [GSA Exclusions API](https://open.gsa.gov/api/exclusions-api/)
- FSMB PDC profiles include Medicare/Medicaid exclusions or reinstatements (if the firm can buy PDC). — [FSMB PDC FAQ](https://www.fsmb.org/PDC/pdc-faq/)
- NPI Registry is identity, **not** a license board: “Issuance of an NPI does not ensure or validate that the Health Care Provider is Licensed or Credentialed.” Official REST `https://npiregistry.cms.hhs.gov/api/?version=2.1`, free, versions 1.0/2.0 retired. Max 200 results/request, skip up to 1000, 1,200 records over six requests. Repo adapter already uses this. — [NPPES API page](https://npiregistry.cms.hhs.gov/api-page)

### Inferences
- Keep using the existing Open Payments adapter as the **only** current industry-payment source of truth. Do not add Dollars for Docs.
- Pair Open Payments with OIG LEIE (free CSV + online verify) when the report discusses federal program integrity; do not conflate a consulting meal with an exclusion.
- NPI is the join key across NPPES, Open Payments, and (when present) board files. State boards generally do not publish NPI.

### Gaps
- Open Payments 2025 data on the public site may still be in initial vs refresh status depending on CMS’s 2026 calendar; the methodology PDF’s Appendix A dates were not fully extracted here.
- No other current national physician-payment database with an official API was found that is not a restatement of Open Payments.

## What is the minimum license/discipline stack that would make EWI credential sections reliable instead of web-snippet guesses?

### Takeaway
A reliable credential section is **issuing-board license + issuing-board discipline + (if DO) AOA Profile or (if MD) CertiFACTS or FSMB PDC Premium if eligible + NPI identity + Open Payments + OIG LEIE**, with expert-directory hits labeled as advertisements. NPDB, Certification Matters, NPPES license strings, criminal aggregators, and Google snippets are not that stack.

### Cited Findings
- NPPES/NPI does not validate licensure. — [NPPES API page](https://npiregistry.cms.hhs.gov/api-page)
- Florida practitioner profile legal/discipline fields are largely **self-reported** unless DOH marks them verified; license verification and the Discipline search are the board’s own records. — [MQA User Guide §2.2–2.4](https://mqa-internet.doh.state.fl.us/MQASearchServices/Content/HelpFile/MQA%20SearchServices%20and%20DataDownload%20UserGuide.pdf)
- Georgia states specialty board certification on its website is **not** primary source. — [GCMB PSV statement](https://medicalboard.georgia.gov/document/document/gcmb-primary-source-verification/download)
- ABMS Certification Matters is **not authorized** for professional credentialing. — [Certification Matters FAQ](https://www.certificationmatters.org/faq/what-is-the-difference-between-a-patient-and-a-professional-user/)
- FSMB PDC is primary-source-equivalent for **sanctions** (JC/URAC/NCQA) but contains **no malpractice** and is sold to health-care organizations, not listed for attorneys. — [FSMB PDC FAQ](https://www.fsmb.org/PDC/pdc-faq/); [PDC Query Form](https://inte.fsmb.org/PDC/pdc-query/pdc-query-form/)
- NPDB attorney access cannot be used against the practitioner and is not available to defense PI counsel. — [NPDB Information for Attorneys](https://www.npdb.hrsa.gov/resources/infoForAttorneys.jsp)
- IDFPR, MBC bulk/API, TMB open data, NJ roster, FL download, NY OPMC Socrata, and GCMB live search are the actual issuing-body or official-extract sources identified above (see state section).
- SEAK/JurisPro/ExpertPages/ALM/SEAK IME are paid listings; attorney search is free; they are not boards. — (directory section sources)
- Internal rules already reject cheap criminal-record APIs as aggregators with identity error and false “no record” claims. — [`docs/ewi/provider-register.md` §6]

### Inferences
Minimum **reliable** stack for a US (especially Florida) physician EWI credential block:

1. **Identity (free API, already working):** NPI Registry v2.1. Use it to lock name/NPI/practice location and to collect **self-reported** license strings as leads only.
2. **Florida license + discipline (official, $0):** MQA license verification (adapter exists; handle `blocked`) **and** MQA Data Download Portal daily file (not yet wired) **and** MQA Discipline search / detail “discipline on file.” Do not treat a blocked scrape as “clean.”
3. **Every other state on the expert’s NPI taxonomy/license list (official, mostly $0):** issuing board lookup or that state’s bulk/API (IL Socrata, TX open data, CA Access/iServices, NJ roster + live detail for board actions, NY NYSED HTML + OPMC Socrata, PA PALS HTML, GA gateway). Absence from an active-only roster ≠ no license and ≠ no discipline.
4. **Multi-state sanction screen (if eligible):** FSMB PDC Standard **$9** (or Premium **$12** if ABMS specialty is needed in the same pull). If FSMB will not sell to a law firm, use **DocInfo manually** (human, not bot) plus the issuing boards — do not scrape DocInfo.
5. **Board certification (professional product):** MD → CertiFACTS (quote; attorneys allowed) or PDC Premium if eligible. DO → AOA Profile **$25**. Never Certification Matters. Never infer ABPP/ABMS from Justia/PACER/news.
6. **Federal program integrity (free):** OIG LEIE monthly file + online verify; optionally SAM.gov Exclusions API.
7. **Industry payments (free API, already working):** CMS Open Payments. Not Dollars for Docs.
8. **IME / expert-directory advertising (free attorney search):** SEAK ($0 to search; experts pay $655 EW / $575 IME), JurisPro, ExpertPages, ALM Southeastern, DRI member DB if the firm is a DRI member ($335). Label as **listing/advertisement**, not credential.

What this stack still does **not** prove: malpractice payments (NPDB-restricted; FL profile claims >$100k are self-report), hospital privilege actions, criminal history (do not buy aggregators as a board substitute), or “no other-state license” (only “not found in sources checked on date T”).

### Gaps
- FSMB will not publish whether a PI firm can buy PDC; that single eligibility answer changes whether the minimum stack is “$0 boards + $25 AOA/quote CertiFACTS” or “$9–$12 PDC + boards.”
- CertiFACTS Unlimited vs Limited actual USD quote for a low-volume EWI workload (likely <100 MDs/year) is unknown.
- Florida download-file field list for discipline vs status-only needs a logged-in sample.
- No official IME-registry API exists; IME proof remains directory listing + the physician’s own reports.
