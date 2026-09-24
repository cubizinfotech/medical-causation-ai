import { emailConfig } from './email.config';

describe('emailConfig', () => {
  const keys = [
    'EMAIL_PROVIDER',
    'EMAIL_DELIVERY_ENABLED',
    'FEATURE_EMAIL',
    'EMAIL_FROM',
    'EMAIL_FROM_NAME',
    'EMAIL_REPLY_TO',
    'EMAIL_REDIRECT_TO',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_SECURE',
    'EMAIL_MAX_ATTEMPTS',
    'EMAIL_RETRY_DELAY_MS',
  ];
  const previous = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of keys) previous.set(key, process.env[key]);
    for (const key of keys) delete process.env[key];
  });

  afterEach(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('defaults to the console provider with delivery off', () => {
    const config = emailConfig();
    expect(config.provider).toBe('console');
    expect(config.deliveryEnabled).toBe(false);
    expect(config.from).toBe('noreply@localhost');
    expect(config.password).toBe('');
    expect(config.maxAttempts).toBe(3);
  });

  it('reads SMTP settings and enables delivery from the environment', () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.EMAIL_DELIVERY_ENABLED = 'true';
    process.env.EMAIL_FROM = 'records@client.example';
    process.env.EMAIL_FROM_NAME = 'Records';
    process.env.SMTP_HOST = 'smtp.client.example';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'api-user';
    process.env.SMTP_PASSWORD = 'from-env';
    process.env.SMTP_SECURE = 'true';

    const config = emailConfig();
    expect(config.provider).toBe('smtp');
    expect(config.deliveryEnabled).toBe(true);
    expect(config.host).toBe('smtp.client.example');
    expect(config.port).toBe(587);
    expect(config.user).toBe('api-user');
    expect(config.password).toBe('from-env');
    expect(config.secure).toBe(true);
    expect(config.fromName).toBe('Records');
  });

  it('treats an unknown provider as console', () => {
    process.env.EMAIL_PROVIDER = 'sendgrid';
    expect(emailConfig().provider).toBe('console');
  });

  it('enables delivery when FEATURE_EMAIL is true', () => {
    process.env.FEATURE_EMAIL = 'true';
    expect(emailConfig().deliveryEnabled).toBe(true);
  });
});
