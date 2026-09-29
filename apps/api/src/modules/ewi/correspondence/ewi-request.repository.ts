import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InvestigationRequestStatus,
  InvestigationRequestType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import type {
  EwiRequestRecordView,
  EwiRequestStatus,
  EwiRequestType,
} from './ewi-request.types';

@Injectable()
export class EwiRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    investigationId: string;
    requestType: EwiRequestType;
    status: EwiRequestStatus;
    organizationName: string;
    recipientEmail: string | null;
    recipientName: string | null;
    subject: string;
    bodyText: string;
    templateId: string;
    caseReference: string;
    followUpAt: Date | null;
    parentRequestId: string | null;
    metadata?: Prisma.InputJsonValue;
  }): Promise<EwiRequestRecordView> {
    return this.prisma.investigationRequest
      .create({
        data: {
          investigationId: data.investigationId,
          requestType: data.requestType,
          status: data.status,
          organizationName: data.organizationName,
          recipientEmail: data.recipientEmail,
          recipientName: data.recipientName,
          subject: data.subject,
          bodyText: data.bodyText,
          templateId: data.templateId,
          caseReference: data.caseReference,
          followUpAt: data.followUpAt,
          parentRequestId: data.parentRequestId,
          metadata: data.metadata ?? Prisma.JsonNull,
        },
      })
      .then(toView);
  }

  async findById(id: string): Promise<EwiRequestRecordView | null> {
    const row = await this.prisma.investigationRequest.findUnique({
      where: { id },
    });
    return row ? toView(row) : null;
  }

  async requireById(id: string): Promise<EwiRequestRecordView> {
    const row = await this.findById(id);
    if (!row) {
      throw new NotFoundException(`Investigation request "${id}" not found`);
    }
    return row;
  }

  listForInvestigation(
    investigationId: string,
  ): Promise<EwiRequestRecordView[]> {
    return this.prisma.investigationRequest
      .findMany({
        where: { investigationId },
        orderBy: { createdAt: 'asc' },
      })
      .then((rows) => rows.map(toView));
  }

  listDueFollowUps(asOf: Date): Promise<EwiRequestRecordView[]> {
    return this.prisma.investigationRequest
      .findMany({
        where: {
          followUpAt: { lte: asOf },
          status: { in: ['sent', 'logged_not_sent'] },
          followUps: { none: {} },
        },
        orderBy: { followUpAt: 'asc' },
      })
      .then((rows) => rows.map(toView));
  }

  update(
    id: string,
    data: Partial<{
      status: EwiRequestStatus;
      approvedAt: Date | null;
      approvedBy: string | null;
      sentAt: Date | null;
      provider: string | null;
      providerMessageId: string | null;
      delivered: boolean;
      errorMessage: string | null;
      followUpAt: Date | null;
      recipientEmail: string | null;
      recipientName: string | null;
    }>,
  ): Promise<EwiRequestRecordView> {
    return this.prisma.investigationRequest
      .update({
        where: { id },
        data: {
          status: data.status,
          approvedAt: data.approvedAt,
          approvedBy: data.approvedBy,
          sentAt: data.sentAt,
          provider: data.provider,
          providerMessageId: data.providerMessageId,
          delivered: data.delivered,
          errorMessage: data.errorMessage,
          followUpAt: data.followUpAt,
          recipientEmail: data.recipientEmail,
          recipientName: data.recipientName,
        },
      })
      .then(toView);
  }
}

function toView(row: {
  id: string;
  investigationId: string;
  requestType: InvestigationRequestType;
  status: InvestigationRequestStatus;
  organizationName: string;
  recipientEmail: string | null;
  recipientName: string | null;
  subject: string;
  bodyText: string;
  templateId: string;
  caseReference: string;
  followUpAt: Date | null;
  parentRequestId: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  sentAt: Date | null;
  provider: string | null;
  providerMessageId: string | null;
  delivered: boolean;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EwiRequestRecordView {
  return {
    id: row.id,
    investigationId: row.investigationId,
    requestType: row.requestType,
    status: row.status,
    organizationName: row.organizationName,
    recipientEmail: row.recipientEmail,
    recipientName: row.recipientName,
    subject: row.subject,
    bodyText: row.bodyText,
    templateId: row.templateId,
    caseReference: row.caseReference,
    followUpAt: row.followUpAt?.toISOString() ?? null,
    parentRequestId: row.parentRequestId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    sentAt: row.sentAt?.toISOString() ?? null,
    provider: row.provider,
    providerMessageId: row.providerMessageId,
    delivered: row.delivered,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
