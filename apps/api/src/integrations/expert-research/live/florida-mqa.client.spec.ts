import {
  pageIsReadable,
  parseFloridaLicenseHits,
  professionForLicense,
} from './florida-mqa.client';

const RESULTS = `
<html><body>
<table>
<tr><th>Name</th><th>License Number</th><th>Profession</th><th>License Status</th><th>City</th><th>Discipline on File</th></tr>
<tr>
  <td>SMITH, JANE A</td>
  <td>PY7500</td>
  <td>Psychologist</td>
  <td>Clear/Active</td>
  <td>GAINESVILLE</td>
  <td>N</td>
</tr>
<tr>
  <td><a href="LicenseVerification?LicId=1">DOE, JOHN</a></td>
  <td>ME12345</td>
  <td>Medical Doctor</td>
  <td>Clear/Active</td>
  <td>MIAMI</td>
  <td>Y</td>
</tr>
</table>
<!-- florida mqa results page padding to pass the readable-length check ${'x'.repeat(180)} -->
</body></html>
`;

describe('Florida MQA HTML parsing', () => {
  it('reads name, license number, status, city, and discipline from the table', () => {
    const hits = parseFloridaLicenseHits(
      RESULTS,
      'https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders',
    );
    expect(hits).toEqual([
      expect.objectContaining({
        name: 'SMITH, JANE A',
        licenseNumber: 'PY7500',
        profession: 'Psychologist',
        status: 'Clear/Active',
        city: 'GAINESVILLE',
        disciplineOnFile: false,
      }),
      expect.objectContaining({
        name: 'DOE, JOHN',
        licenseNumber: 'ME12345',
        disciplineOnFile: true,
      }),
    ]);
    expect(hits[1].url).toContain('LicenseVerification');
  });

  it('returns no hits for unknown markup rather than inventing a record', () => {
    expect(
      parseFloridaLicenseHits(
        `<html><body>No records found. ${'x'.repeat(200)}</body></html>`,
        'https://example',
      ),
    ).toEqual([]);
  });

  it('treats bot walls as unreadable', () => {
    expect(pageIsReadable('Just a moment')).toBe(false);
    expect(
      pageIsReadable(
        `<html>${'x'.repeat(200)} cf-browser-verification enable javascript and cookies</html>`,
      ),
    ).toBe(false);
    expect(pageIsReadable(RESULTS)).toBe(true);
  });

  it('maps a Florida psychologist prefix', () => {
    expect(professionForLicense('PY7500')).toBe('Psychologist');
    expect(professionForLicense('ME12345')).toBe('Medical Doctor');
  });
});
