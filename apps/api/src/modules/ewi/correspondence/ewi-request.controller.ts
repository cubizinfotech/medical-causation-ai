import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '@database/prisma.service';
import { Roles } from '@platform/auth/auth.decorators';
import type { AuthUserRef } from '@platform/auth/auth.types';
import { requireRequestUser } from '@platform/auth/request-user';
import {
  ApproveEwiRequestDto,
  ManualReviewEwiRequestDto,
  PrepareEwiRequestDto,
} from './dto/ewi-request.dto';
import { EwiRequestWorkflowService } from './ewi-request-workflow.service';

/** Roles allowed to prepare/approve/send EWI correspondence. */
const EWI_REQUEST_ROLES = [
  'super_admin',
  'admin',
  'attorney',
  'paralegal',
] as const;

/** Follow-up batch processing is admin-only (intended for jobs/ops). */
const EWI_REQUEST_OPS_ROLES = ['super_admin', 'admin'] as const;

/**
 * EWI request/email control plane.
 * Role checks apply even when AUTH_ENABLED is false for other product APIs.
 * Credentials are never accepted on these routes.
 */
@Controller('ewi/requests')
@Roles(...EWI_REQUEST_ROLES)
export class EwiRequestController {
  constructor(
    private readonly workflow: EwiRequestWorkflowService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('investigations/:investigationId')
  async listForInvestigation(
    @Param('investigationId', ParseUUIDPipe) investigationId: string,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
    await this.assertInvestigationOwner(
      investigationId,
      requireRequestUser(request).id,
    );
    return this.workflow.listForInvestigation(investigationId);
  }

  @Get(':id')
  async getRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
    await this.assertRequestOwner(id, requireRequestUser(request).id);
    return this.workflow.getRequest(id);
  }

  @Post('prepare')
  @HttpCode(HttpStatus.CREATED)
  async prepare(
    @Body() body: PrepareEwiRequestDto,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
    await this.assertInvestigationOwner(
      body.investigationId,
      requireRequestUser(request).id,
    );
    return this.workflow.prepare(body);
  }

  @Post(':id/approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApproveEwiRequestDto,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
    const user = requireRequestUser(request);
    await this.assertRequestOwner(id, user.id);
    const approvedBy =
      body.approvedBy?.trim() ||
      request.user?.email ||
      request.user?.displayName ||
      'authenticated-user';
    return this.workflow.approve(id, approvedBy);
  }

  @Post(':id/send')
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
    await this.assertRequestOwner(id, requireRequestUser(request).id);
    return this.workflow.sendIfEligible(id);
  }

  @Post(':id/manual-review')
  async completeManualReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ManualReviewEwiRequestDto,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
    const user = requireRequestUser(request);
    await this.assertRequestOwner(id, user.id);
    return this.workflow.completeManualReview({
      requestId: id,
      recipientEmail: body.recipientEmail,
      recipientName: body.recipientName,
      approvedBy:
        body.approvedBy?.trim() ||
        request.user?.email ||
        request.user?.displayName,
      approve: body.approve,
    });
  }

  @Post(':id/follow-up')
  async createFollowUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
    await this.assertRequestOwner(id, requireRequestUser(request).id);
    return this.workflow.createFollowUp(id);
  }

  private async assertInvestigationOwner(
    investigationId: string,
    ownerUserId: string,
  ): Promise<void> {
    const row = await this.prisma.investigation.findFirst({
      where: { id: investigationId, ownerUserId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Investigation not found');
    }
  }

  private async assertRequestOwner(
    requestId: string,
    ownerUserId: string,
  ): Promise<void> {
    const row = await this.prisma.investigationRequest.findFirst({
      where: { id: requestId, investigation: { ownerUserId } },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Investigation request not found');
    }
  }

  @Post('follow-ups/process-due')
  @HttpCode(HttpStatus.OK)
  @Roles(...EWI_REQUEST_OPS_ROLES)
  processDueFollowUps() {
    return this.workflow.processDueFollowUps();
  }
}
