import { ewiRequestConfig } from '@config/ewi-request.config';
import { EwiRequestWorkflowService } from './ewi-request-workflow.service';
import type { EwiRequestRecordView } from './ewi-request.types';

function view(
  partial: Partial<EwiRequestRecordView> &
    Pick<EwiRequestRecordView, 'id' | 'status' | 'requestType'>,
): EwiRequestRecordView {
  return {
    investigationId: 'inv-1',
    organizationName: 'State University',
    recipientEmail: 'records@university.edu',
    recipientName: 'Registrar',
    subject: 'Education record request regarding Jane Smith',
    bodyText: 'Please confirm records.',
    templateId: 'ewi/university-record-request',
    caseReference: 'EWI-100',
    followUpAt: null,
    parentRequestId: null,
    approvedAt: null,
    approvedBy: null,
    sentAt: null,
    provider: null,
    providerMessageId: null,
    delivered: false,
    errorMessage: null,
    createdAt: '2026-09-29T00:00:00.000Z',
    updatedAt: '2026-09-29T00:00:00.000Z',
    ...partial,
  };
}

describe('EwiRequestWorkflowService', () => {
  const send = jest.fn();
  const compose = jest.fn();
  const create = jest.fn();
  const requireById = jest.fn();
  const update = jest.fn();
  const listDueFollowUps = jest.fn();

  const configValues: Record<string, unknown> = {
    ewiRequest: {
      ...ewiRequestConfig(),
      enabled: true,
      requireApproval: true,
      autoSend: false,
      followUpDays: 14,
      trialsmithEnabled: false,
      senderName: 'Alex Attorney',
    },
    email: {
      provider: 'console',
      deliveryEnabled: false,
      from: 'noreply@localhost',
      fromName: '',
      replyTo: '',
      redirectTo: '',
      host: 'localhost',
      port: 1025,
      user: '',
      password: '',
      secure: false,
      maxAttempts: 3,
      retryDelayMs: 500,
    },
  };

  const service = new EwiRequestWorkflowService(
    { get: (key: string) => configValues[key] } as never,
    { compose, deliver: jest.fn() } as never,
    { send } as never,
    {
      create,
      requireById,
      update,
      listDueFollowUps,
      listForInvestigation: jest.fn(),
    } as never,
  );

  beforeEach(() => {
    send.mockReset();
    compose.mockReset();
    create.mockReset();
    requireById.mockReset();
    update.mockReset();
    listDueFollowUps.mockReset();
  });

  it('prepares drafts without sending when approval is required', async () => {
    compose.mockReturnValue({
      subject: 'Public records request regarding Jane Smith',
      text: 'Please provide discoverable information and advise of fees.',
      html: '<p>Please provide discoverable information and advise of fees.</p>',
      templateId: 'ewi/foia-request',
      to: 'foia@agency.gov',
    });
    create.mockImplementation((data: { status: string }) =>
      Promise.resolve(
        view({
          id: 'req-1',
          status: data.status as never,
          requestType: 'foia',
          recipientEmail: 'foia@agency.gov',
          subject: 'Public records request regarding Jane Smith',
          bodyText:
            'Please provide discoverable information and advise of fees.',
          templateId: 'ewi/foia-request',
        }),
      ),
    );

    const prepared = await service.prepare({
      investigationId: 'inv-1',
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Orthopedics',
      targets: [
        {
          type: 'foia',
          organizationName: 'State Agency',
          recipientEmail: 'foia@agency.gov',
          requestDescription: 'Licensure file if public.',
        },
      ],
    });

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.status).toBe('pending_approval');
    expect(send).not.toHaveBeenCalled();
  });

  it('routes unknown recipients to manual review', async () => {
    compose.mockReturnValue({
      subject: 'Graduation announcement request regarding Jane Smith',
      text: 'Please provide graduation announcement.',
      html: '<p>Please provide graduation announcement.</p>',
      templateId: 'ewi/graduation-announcement',
      to: 'manual-review@invalid.local',
    });
    create.mockImplementation((data: { status: string }) =>
      Promise.resolve(
        view({
          id: 'req-2',
          status: data.status as never,
          requestType: 'graduation_announcement',
          recipientEmail: null,
          subject: 'Graduation announcement request regarding Jane Smith',
          bodyText: 'Please provide graduation announcement.',
          templateId: 'ewi/graduation-announcement',
        }),
      ),
    );

    const prepared = await service.prepare({
      investigationId: 'inv-1',
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Orthopedics',
      targets: [
        {
          type: 'graduation_announcement',
          organizationName: 'State University',
          claimedDegree: 'M.D.',
          claimedYear: '2002',
        },
      ],
    });

    expect(prepared[0]?.status).toBe('needs_manual_review');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends an approved request through the mock email provider and records follow-up', async () => {
    const approved = view({
      id: 'req-3',
      status: 'approved',
      requestType: 'foia',
      approvedAt: '2026-09-29T00:00:00.000Z',
      approvedBy: 'operator',
    });
    requireById.mockResolvedValue(approved);
    update
      .mockResolvedValueOnce({ ...approved, status: 'queued' })
      .mockResolvedValueOnce({
        ...approved,
        status: 'logged_not_sent',
        sentAt: '2026-09-29T01:00:00.000Z',
        provider: 'console',
        providerMessageId: 'console-1',
        delivered: false,
        followUpAt: '2026-10-13T01:00:00.000Z',
      });
    send.mockResolvedValue({
      provider: 'console',
      messageId: 'console-1',
      delivered: false,
    });

    const result = await service.sendIfEligible('req-3');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'records@university.edu',
        subject: approved.subject,
        templateId: 'ewi/university-record-request',
      }),
    );
    expect(result.status).toBe('logged_not_sent');
    expect(result.delivered).toBe(false);
    expect(result.followUpAt).toBeTruthy();
  });

  it('creates a follow-up that references the original request', async () => {
    const parent = view({
      id: 'req-parent',
      status: 'logged_not_sent',
      requestType: 'foia',
      sentAt: '2026-09-01T00:00:00.000Z',
      subject: 'Public records request regarding Jane Smith',
    });
    requireById.mockResolvedValue(parent);
    compose.mockReturnValue({
      subject: 'Follow-up: Public records request regarding Jane Smith',
      text: 'This is a follow-up. Original subject: Public records request regarding Jane Smith',
      html: '<p>Follow-up</p>',
      templateId: 'ewi/follow-up-request',
      to: 'records@university.edu',
    });
    create.mockImplementation(() =>
      Promise.resolve(
        view({
          id: 'req-follow',
          status: 'pending_approval',
          requestType: 'follow_up',
          parentRequestId: parent.id,
          subject: 'Follow-up: Public records request regarding Jane Smith',
          bodyText:
            'This is a follow-up. Original subject: Public records request regarding Jane Smith',
          templateId: 'ewi/follow-up-request',
        }),
      ),
    );

    const followUp = await service.createFollowUp('req-parent');
    expect(followUp?.requestType).toBe('follow_up');
    expect(followUp?.parentRequestId).toBe('req-parent');
    expect(followUp?.bodyText).toMatch(/follow-up/i);
    expect(followUp?.bodyText).toMatch(/Original subject/i);
  });

  it('does nothing when the workflow is disabled', async () => {
    configValues.ewiRequest = {
      ...ewiRequestConfig(),
      enabled: false,
    };
    const prepared = await service.prepare({
      investigationId: 'inv-1',
      expertName: 'Jane Smith',
      city: 'Boston',
      specialty: 'Orthopedics',
      targets: [
        {
          type: 'foia',
          organizationName: 'Agency',
          recipientEmail: 'foia@agency.gov',
          requestDescription: 'Public file',
        },
      ],
    });
    expect(prepared).toEqual([]);
    expect(create).not.toHaveBeenCalled();
    configValues.ewiRequest = {
      ...ewiRequestConfig(),
      enabled: true,
      requireApproval: true,
      autoSend: false,
      followUpDays: 14,
      trialsmithEnabled: false,
      senderName: 'Alex Attorney',
    };
  });
});
