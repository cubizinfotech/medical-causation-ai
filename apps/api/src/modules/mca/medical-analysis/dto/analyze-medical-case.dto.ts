import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AnalyzeMedicalCaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  patientAge!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  patientGender!: string;

  @IsString()
  @IsNotEmpty()
  accidentDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  accidentType!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  accidentDescription!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  diagnosis!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(5000)
  symptoms!: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  medicalHistory?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  medications?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  timeline?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  medicalQuestion!: string;

  /** Uploaded medical records (POST /medical-analysis/records) to read. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  recordIds?: string[];
}
