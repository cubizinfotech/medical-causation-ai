# EWI professional and financial background research

Professional and financial background research runs through the shared expert-research catalog. There is no second provider stack.

`ProfessionalBackgroundResearchService` selects the professional providers. `buildProfessionalBackgroundDossier` turns collected evidence into grants, patents and trademarks, awards, military claims, memberships, organizations, corporate affiliations, and public financial records. The model does not invent memberships, percentages, military service conclusions, or bias from payment alone.

## Categories and sources

| Category | Catalog providers | Verification notes |
|----------|-------------------|--------------------|
| Grants | `grants`, `grant_results` | Participation, role, authorship where applicable, institution, identifier, dates, and source. Public results are linked. Private foundation results marked unavailable when the source does not provide them |
| Patents / trademarks | `patents`, `trademarks` | Name, title, identifier, filing date, status, role, and source. An empty trademark fixture is `no_result`, not proof that no mark exists |
| Awards / medals | `awards` | Verified against authoritative listings when available. No award is invented |
| Military claims | `military_claims` | Public authoritative sources only. Source is recorded. Unsupported conclusions about military service are not drawn |
| Memberships | `memberships` | CV claims compared with public organization records |
| Professional organizations | `professional_organizations` | Membership verified only when public evidence exists |
| Corporate affiliations | `corporate_affiliations` | Public affiliation records only |
| Income / bias indicators | `open_payments` | Open Payments, forensic work, defense work, hourly rates, referrals, and stated percentages when the source provides them |

An unavailable source is recorded as unavailable. The investigation does not pretend that source completed a search.

## Grants

When the source provides them:

- expert participation
- role
- authorship where applicable
- institution
- grant identifier
- dates
- source
- public result URL when results are available

If private foundation results are unavailable, the dossier records that fact and does not invent an outcome.

## Patents and trademarks

Stored fields are name, title, identifier, filing date, status, role, and source URL when present.

## Awards and military claims

Awards and medals are checked against authoritative public listings where possible. Military claims use appropriate public authoritative sources. The dossier records the source and does not draw unsupported conclusions about military service.

## Memberships and organizations

CV membership claims are compared with public organization records. Membership is verified only when public evidence exists. Missing public evidence is not treated as proof that the claim is false.

## Financial information

Where legally and publicly available, the dossier may include:

- Open Payments information
- forensic work
- defense work
- hourly rates
- referral information
- percentage of forensic work (only when stated)
- percentage of defense work (only when stated)
- other relevant public financial information

Percentages are not estimated when evidence is missing. Bias is not inferred solely from being paid. Financial entries are presented factually and in chronological order.

## Code

- `apps/api/src/modules/ewi/research/professional-background/`
- Catalog rows stay in `integrations/expert-research`
- Report sections 8–10 render the dossier groups
- History rebuilds the dossier from stored findings and attributes
