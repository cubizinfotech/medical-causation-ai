import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '@platform/auth/auth.decorators';
import type { AuthUserRef } from '@platform/auth/auth.types';
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
  constructor(private readonly workflow: EwiRequestWorkflowService) {}

  @Get('investigations/:investigationId')
  listForInvestigation(
    @Param('investigationId', ParseUUIDPipe) investigationId: string,
  ) {
    return this.workflow.listForInvestigation(investigationId);
  }

  @Get(':id')
  getRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflow.getRequest(id);
  }

  @Post('prepare')
  @HttpCode(HttpStatus.CREATED)
  prepare(@Body() body: PrepareEwiRequestDto) {
    return this.workflow.prepare(body);
  }

  @Post(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApproveEwiRequestDto,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
    const approvedBy =
      body.approvedBy?.trim() ||
      request.user?.email ||
      request.user?.displayName ||
      'authenticated-user';
    return this.workflow.approve(id, approvedBy);
  }

  @Post(':id/send')
  send(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflow.sendIfEligible(id);
  }

  @Post(':id/manual-review')
  completeManualReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ManualReviewEwiRequestDto,
    @Req() request: Request & { user?: AuthUserRef },
  ) {
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
  createFollowUp(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflow.createFollowUp(id);
  }

  @Post('follow-ups/process-due')
  @HttpCode(HttpStatus.OK)
  @Roles(...EWI_REQUEST_OPS_ROLES)
  processDueFollowUps() {
    return this.workflow.processDueFollowUps();
  }
}
