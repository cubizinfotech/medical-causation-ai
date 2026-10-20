import { authorPositionIn, parseCitationAuthors } from './author-position';
import { parsePersonName } from './person-name';

describe('author position', () => {
  const demery = parsePersonName('Jason A. Demery')!;

  it('parses authors from the common CV citation styles', () => {
    expect(
      parseCitationAuthors(
        'Hanlon, R.E., Demery, J.A., Martinovich, Z., & Kelly, J.P. (1999). A title.',
      ),
    ).toEqual(['Hanlon RE', 'Demery JA', 'Martinovich Z', 'Kelly JP']);
    expect(
      parseCitationAuthors(
        'Hanlon RE, Demery JA (1998). Axial movements are preserved.',
      ),
    ).toEqual(['Hanlon RE', 'Demery JA']);
    expect(parseCitationAuthors('Just a title with no authors')).toEqual([]);
  });

  it('reports first, middle, last and sole positions', () => {
    expect(
      authorPositionIn(['Jason A. Demery', 'Ann Lee'], demery)?.position,
    ).toBe('first');
    expect(
      authorPositionIn(['Ann Lee', 'Demery JA', 'Bo Chen'], demery)?.position,
    ).toBe('middle');
    expect(
      authorPositionIn(['Ann Lee', 'Demery, Jason A'], demery)?.position,
    ).toBe('last');
    expect(authorPositionIn(['Jason Demery'], demery)?.position).toBe('sole');
    expect(authorPositionIn(['Ann Lee', 'Bo Chen'], demery)).toBeNull();
  });
});
