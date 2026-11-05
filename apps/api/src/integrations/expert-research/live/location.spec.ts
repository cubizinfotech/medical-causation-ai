import {
  citiesMatch,
  metroPeerCities,
  normalizeCity,
  parseCityState,
} from './location';

describe('parseCityState', () => {
  it('treats a bare state name or code as state-only, not a city', () => {
    expect(parseCityState('Florida')).toEqual({ city: '', state: 'FL' });
    expect(parseCityState('FL')).toEqual({ city: '', state: 'FL' });
    expect(parseCityState('California')).toEqual({ city: '', state: 'CA' });
    expect(parseCityState('New York')).toEqual({ city: '', state: 'NY' });
  });

  it('still parses city and state together', () => {
    expect(parseCityState('Fort Lauderdale, FL')).toEqual({
      city: 'Fort Lauderdale',
      state: 'FL',
    });
    expect(parseCityState('Gainesville Florida')).toEqual({
      city: 'Gainesville',
      state: 'FL',
    });
  });
});

describe('citiesMatch metro groups', () => {
  it('treats Los Angeles and Beverly Hills as the same metro', () => {
    expect(citiesMatch('Los Angeles, CA', 'Beverly Hills, CA')).toBe(true);
    expect(citiesMatch('Beverly Hills', 'Los Angeles')).toBe(true);
  });

  it('does not bridge unrelated cities', () => {
    expect(citiesMatch('Los Angeles, CA', 'Gainesville, FL')).toBe(false);
    expect(citiesMatch('Miami, FL', 'Chicago, IL')).toBe(false);
  });

  it('still matches exact city names', () => {
    expect(citiesMatch('Gainesville, FL', 'Gainesville')).toBe(true);
    expect(normalizeCity('St. Petersburg')).toBe('saint petersburg');
    expect(citiesMatch('Tampa, FL', 'St. Petersburg, FL')).toBe(true);
  });

  it('lists metro peers without the subject city', () => {
    expect(metroPeerCities('Los Angeles')).toEqual(
      expect.arrayContaining(['beverly hills', 'santa monica']),
    );
    expect(metroPeerCities('Los Angeles')).not.toContain('los angeles');
  });

  it('applies the same metro rule in other states, not only California', () => {
    expect(citiesMatch('Miami, FL', 'Miami Beach, FL')).toBe(true);
    expect(citiesMatch('Dallas, TX', 'Plano, TX')).toBe(true);
    expect(citiesMatch('New York, NY', 'Brooklyn, NY')).toBe(true);
    expect(citiesMatch('Chicago, IL', 'Evanston, IL')).toBe(true);
    expect(citiesMatch('Seattle, WA', 'Bellevue, WA')).toBe(true);
  });
});
