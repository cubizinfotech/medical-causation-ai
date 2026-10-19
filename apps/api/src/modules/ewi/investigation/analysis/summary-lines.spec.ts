import { NO_RECORDS_LINE, presentableSummaryLines } from './summary-lines';

describe('presentableSummaryLines', () => {
  const header = [
    'Investigation of Dr Matthew Cahill (Anesthesiology).',
    'This summary uses collected source statements only. It does not confirm a qualification that those statements do not support.',
  ];

  it('drops the per-source gap lines of a saved summary and rewords the empty result', () => {
    const saved = [
      ...header,
      'No research items were collected. The information could not be verified.',
      'Could not verify identity. The searched source returned no record. That is not evidence the expert lacks this qualification.',
      'Could not verify web. web_search did not return a usable record. Nothing was inferred.',
      'Could not verify deposition. depositions requires authorized access. Nothing was inferred.',
      'Could not verify income_bias. open_payments did not return a usable record. Nothing was inferred.',
    ].join('\n');

    expect(presentableSummaryLines(saved)).toEqual([
      ...header,
      NO_RECORDS_LINE,
    ]);
  });

  it('says how many items were collected, without "could not be verified"', () => {
    expect(
      presentableSummaryLines(
        '39 item(s) were collected. Not verified and conflicting items could not be verified.',
      ),
    ).toEqual(['39 item(s) were collected from the sources searched.']);
  });

  it('keeps statements about items that were collected', () => {
    const itemLine =
      'Could not verify "Diplomate, American Board of Anesthesiology". The npi_registry statement is not verified.';

    expect(presentableSummaryLines(`${header[0]}\n${itemLine}`)).toEqual([
      header[0],
      itemLine,
    ]);
  });

  it('drops a gap note recorded by the analysis, whatever its wording', () => {
    expect(
      presentableSummaryLines('Header.\nCustom gap wording.\n\n', [
        { note: 'Custom gap wording.' },
      ]),
    ).toEqual(['Header.']);
  });
});
