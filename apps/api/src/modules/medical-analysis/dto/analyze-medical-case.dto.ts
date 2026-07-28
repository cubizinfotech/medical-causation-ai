import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AnalyzeMedicalCaseDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  patientName!: string;

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
}
