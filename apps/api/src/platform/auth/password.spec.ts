import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('accepts the original password and rejects a different one', async () => {
    const stored = await hashPassword('password');
    expect(stored).not.toContain('password');
    await expect(verifyPassword('password', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false);
  });
});
