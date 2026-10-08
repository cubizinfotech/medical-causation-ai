import {
  displayName,
  firstNamesCompatible,
  namesCompatible,
  parsePersonName,
  personNameFromParts,
} from './person-name';
import {
  specialtyMatches,
  specialtySearchTerms,
  specialtyStems,
  taxonomyMatches,
} from './specialty-match';

describe('person names', () => {
  it('strips titles and credentials and reads "Last, First"', () => {
    expect(parsePersonName('Dr. Jane A. Smith, MD')).toEqual({
      first: 'jane',
      middle: ['a'],
      last: 'smith',
    });
    expect(parsePersonName('Smith, Jane A., M.D., FACS')).toEqual({
      first: 'jane',
      middle: ['a'],
      last: 'smith',
    });
    expect(parsePersonName('María José García-López')).toEqual({
      first: 'maria',
      middle: ['jose'],
      last: 'garcia-lopez',
    });
    expect(parsePersonName('Madonna')).toBeNull();
  });

  it('matches middle initials only when both sides agree', () => {
    const query = parsePersonName('Jane A. Smith, MD')!;
    expect(
      namesCompatible(query, personNameFromParts('JANE', 'SMITH', 'ANN')!),
    ).toBe(true);
    expect(namesCompatible(query, personNameFromParts('JANE', 'SMITH')!)).toBe(
      true,
    );
    expect(
      namesCompatible(query, personNameFromParts('JANE', 'SMITH', 'B')!),
    ).toBe(false);
    expect(namesCompatible(query, personNameFromParts('JOAN', 'SMITH')!)).toBe(
      false,
    );
  });

  it('accepts short forms, nicknames, and initials of a first name', () => {
    expect(firstNamesCompatible('ravi', 'ravinder')).toBe(true);
    expect(firstNamesCompatible('rob', 'robert')).toBe(true);
    expect(firstNamesCompatible('bob', 'robert')).toBe(true);
    expect(firstNamesCompatible('bill', 'william')).toBe(true);
    expect(firstNamesCompatible('j', 'jane')).toBe(true);
    expect(firstNamesCompatible('jo', 'joan')).toBe(false);
    expect(firstNamesCompatible('jane', 'joan')).toBe(false);
    expect(firstNamesCompatible('rupert', 'robert')).toBe(false);
  });

  it('formats names for display', () => {
    expect(displayName(parsePersonName('jane a. smith-jones')!)).toBe(
      'Jane A. Smith-Jones',
    );
  });
});

describe('specialty matching', () => {
  it("matches NPI taxonomy wording to the attorney's wording", () => {
    expect(
      specialtyMatches('Neurology', 'Psychiatry & Neurology, Neurology'),
    ).toBe(true);
    expect(specialtyMatches('Orthopedic Surgery', 'Orthopaedic Surgery')).toBe(
      true,
    );
    expect(specialtyMatches('Neurologist', 'Neurology')).toBe(true);
    expect(specialtyMatches('Neurology', 'Psychiatry')).toBe(false);
    expect(specialtyMatches('Cardiology', 'Internal Medicine')).toBe(false);
  });

  it('ignores words too general to decide a match', () => {
    expect(specialtyStems('Emergency Medicine')).toEqual(['emergenc']);
    expect(specialtyMatches('General Surgery', 'Family Medicine')).toBe(false);
  });

  it('builds wildcard search terms', () => {
    expect(specialtySearchTerms('Neurology')).toEqual(['neurolog*']);
    expect(specialtySearchTerms('Orthopaedic Surgery')).toEqual(['orthoped*']);
    expect(specialtySearchTerms('Medicine')).toEqual([]);
  });

  it('reads NPPES taxonomy wording', () => {
    expect(
      taxonomyMatches(
        'Cardiology',
        'Internal Medicine, Cardiovascular Disease',
      ),
    ).toBe(true);
    expect(
      taxonomyMatches(
        'Cardiologist',
        'Internal Medicine, Cardiovascular Disease',
      ),
    ).toBe(true);
    expect(
      taxonomyMatches(
        'Internal Medicine',
        'Internal Medicine, Cardiovascular Disease',
      ),
    ).toBe(true);
    // A neurologist is not a psychiatrist, and neither is a neurosurgeon.
    expect(
      taxonomyMatches('Psychiatry', 'Psychiatry & Neurology, Neurology'),
    ).toBe(false);
    expect(taxonomyMatches('Neurology', 'Neurological Surgery')).toBe(false);
    expect(taxonomyMatches('Neurosurgeon', 'Neurological Surgery')).toBe(true);
    expect(
      taxonomyMatches('Pain Management', 'Anesthesiology, Pain Medicine'),
    ).toBe(true);
    expect(
      taxonomyMatches(
        'Board-certified spine surgeon',
        'Orthopaedic Surgery, Orthopaedic Surgery of the Spine',
      ),
    ).toBe(true);
    expect(taxonomyMatches('OB/GYN', 'Obstetrics & Gynecology')).toBe(true);
  });

  it('expands phrases into words court opinions use', () => {
    expect(specialtySearchTerms('Neurosurgery')).toEqual(['neurosurg*']);
    expect(specialtySearchTerms('Pain Management')).toEqual([
      '"pain management"',
      '"pain medicine"',
    ]);
  });
});
