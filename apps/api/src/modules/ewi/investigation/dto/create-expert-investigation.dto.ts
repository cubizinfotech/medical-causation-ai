import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate,
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

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  city!: string;

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
}
