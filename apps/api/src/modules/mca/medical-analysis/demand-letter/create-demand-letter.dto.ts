import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };

/** What the attorney adds to the analysis to draft a demand letter. */
export class CreateDemandLetterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  clientName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  recipientName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  recipientCompany?: string;

  @IsString()
  @IsOptional()
  @MaxLength(400)
  recipientAddress?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  claimNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  insuredName?: string;

  /** YYYY-MM-DD; defaults to the accident date of the case. */
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfLoss must be YYYY-MM-DD' })
  dateOfLoss?: string;

  /** How the incident happened and why the insured is responsible. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(6000)
  incidentDescription!: string;

  @IsNumber(MONEY)
  @IsOptional()
  @Min(0)
  @Max(1_000_000_000)
  lostWages?: number;

  @IsString()
  @IsOptional()
  @MaxLength(600)
  lostWagesNote?: string;

  @IsNumber(MONEY)
  @IsOptional()
  @Min(0)
  @Max(1_000_000_000)
  futureMedical?: number;

  @IsString()
  @IsOptional()
  @MaxLength(600)
  futureMedicalNote?: string;

  @IsNumber(MONEY)
  @Min(1)
  @Max(10_000_000_000)
  demandAmount!: number;

  /** Days the offer stays open; 30 when not given. */
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(180)
  responseDays?: number;

  @IsNumber(MONEY)
  @IsOptional()
  @Min(0)
  @Max(10_000_000_000)
  policyLimits?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  attorneyName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  firmName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(400)
  firmAddress?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  attorneyPhone?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(160)
  attorneyEmail?: string;

  /** Write the treatment section with AI from the chronology (default true). */
  @IsBoolean()
  @IsOptional()
  useAi?: boolean;
}
