import { IS_PUBLIC_KEY } from '@platform/auth/auth.decorators';
import { OrcidOAuthController } from './orcid-oauth.controller';

describe('OrcidOAuthController', () => {
  it('exposes GET /orcid/callback as public and keeps authorize authenticated', () => {
    expect(methodMeta(IS_PUBLIC_KEY, 'callback')).toBe(true);
    expect(methodMeta(IS_PUBLIC_KEY, 'authorize')).toBeUndefined();
    expect(methodMeta(IS_PUBLIC_KEY, 'connection')).toBeUndefined();
  });
});

function methodMeta(key: string, name: string): unknown {
  const value = Object.getOwnPropertyDescriptor(
    OrcidOAuthController.prototype,
    name,
  )?.value as object | undefined;
  return value ? Reflect.getMetadata(key, value) : undefined;
}
