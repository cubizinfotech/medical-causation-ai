import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { isValidNpi } from '@integrations/expert-research';

@ValidatorConstraint({ name: 'npi', async: false })
class NpiConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidNpi(value);
  }

  defaultMessage(): string {
    return 'NPI must be a valid 10-digit National Provider Identifier.';
  }
}

export class CreateExpertInvestigationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  expertName!: string;

  /** Optional. A city narrows same-name candidates; the search runs without it. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_object, value: unknown) => value !== '' && value != null)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  city?: string;

  /** Required. A specialty or profession, e.g. neuropsychology, electrician, attorney. */
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  specialty!: string;

  /** Optional. Confirms the expert in the NPI Registry when the name is common. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '') || undefined : value,
  )
  @Validate(NpiConstraint)
  npi?: string;

  /** Optional. Aliases, employers, case names or anything else that helps tell people apart. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(2000)
  additionalContext?: string;

  /** Optional. The expert's CV, uploaded first with POST /ewi/documents/cv. */
  @IsOptional()
  @IsUUID()
  cvDocumentId?: string;
}
