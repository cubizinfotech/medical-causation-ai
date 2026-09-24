import { EwiCorrespondenceService } from './ewi-correspondence.service';
import { EWI_EMAIL_TEMPLATE_IDS } from './ewi-email.templates';

describe('EwiCorrespondenceService', () => {
  const send = jest.fn();
  const service = new EwiCorrespondenceService({ send } as never);

  const base = {
    to: 'records@university.edu',
    expertName: 'Jane Smith',
    organizationName: 'State University',
    caseReference: 'EWI-100',
    senderName: 'Alex Attorney',
  };

  beforeEach(() => {
    send.mockReset();
  });

  it('renders each request template without sending', () => {
    const extras = {
      'foia-request': { requestDescription: 'Licensure file, if public.' },
      'university-record-request': {
        recordType: 'Enrollment verification',
        dateRange: '1998-2002',
      },
      'graduation-verification': {
        claimedDegree: 'M.D.',
        claimedYear: '2002',
      },
      'research-request': {
        requestPurpose: 'Confirm the published faculty appointment.',
      },
    } as const;

    for (const kind of EWI_EMAIL_TEMPLATE_IDS) {
      const message = service.compose({ ...base, kind, ...extras[kind] });
      expect(message.templateId).toBe(`ewi/${kind}`);
      expect(message.subject).toContain('Jane Smith');
      expect(message.text).toContain('State University');
      expect(message.text).toContain('EWI-100');
      expect(message.html).toContain('Jane Smith');
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('escapes HTML and leaves the text body unchanged', () => {
    const message = service.compose({
      ...base,
      kind: 'foia-request',
      expertName: 'Jane <Smith>',
      requestDescription: 'Public roster',
    });
    expect(message.text).toContain('Jane <Smith>');
    expect(message.html).toContain('Jane &lt;Smith&gt;');
    expect(message.html).not.toContain('Jane <Smith>');
  });

  it('rejects a graduation request that omits the claimed credential', () => {
    expect(() =>
      service.compose({ ...base, kind: 'graduation-verification' }),
    ).toThrow(/claimedDegree/);
  });

  it('delivers only when asked, through the shared email service', async () => {
    send.mockResolvedValue({
      provider: 'console',
      messageId: 'console-1',
      delivered: false,
    });
    const result = await service.deliver({
      ...base,
      kind: 'research-request',
      requestPurpose: 'Confirm the faculty page.',
    });
    expect(result.delivered).toBe(false);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'ewi/research-request' }),
    );
  });
});
