import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EWI_REQUEST_TYPES } from '../ewi-request.types';

export class PrepareEwiRequestTargetDto {
  @IsIn(EWI_REQUEST_TYPES)
  type!: (typeof EWI_REQUEST_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  organizationName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  recipientEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipientName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requestDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  recordType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dateRange?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  claimedDegree?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  claimedYear?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  employmentRole?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  activityDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requestPurpose?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  originalSubject?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  originalSentDate?: string | null;

  @IsOptional()
  @IsUUID()
  parentRequestId?: string | null;

  @IsOptional()
  @IsBoolean()
  forceManualReview?: boolean;
}

export class PrepareEwiRequestDto {
  @IsUUID()
  investigationId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  expertName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  city!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  specialty!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  caseReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  senderName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => PrepareEwiRequestTargetDto)
  targets!: PrepareEwiRequestTargetDto[];
}

export class ApproveEwiRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  approvedBy?: string;
}

export class ManualReviewEwiRequestDto {
  @IsEmail()
  @MaxLength(320)
  recipientEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  approvedBy?: string;

  @IsOptional()
  @IsBoolean()
  approve?: boolean;
}
