import { frontendOrigins } from './frontend-origins';

describe('frontendOrigins', () => {
  it('allows the configured frontend origin', () => {
    expect(frontendOrigins('http://localhost:3000')).toEqual([
      'http://localhost:3000',
    ]);
  });

  it('also allows the public host when the API is published there', () => {
    expect(
      frontendOrigins('http://localhost:3000', 'http://157.230.156.87:3001'),
    ).toEqual(['http://localhost:3000', 'http://157.230.156.87:3000']);
  });

  it('accepts a comma-separated list', () => {
    expect(
      frontendOrigins('http://localhost:3000, http://157.230.156.87:3000'),
    ).toEqual(['http://localhost:3000', 'http://157.230.156.87:3000']);
  });
});
