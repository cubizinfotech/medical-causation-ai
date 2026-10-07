import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Empty strings clear a field. The service stores them as null. */
export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty.' })
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  organization?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  @Matches(/^[0-9+()\-.\s]*$/, {
    message: 'Phone can contain digits, spaces, and + ( ) - . only.',
  })
  phone?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  bio?: string;
}

export class UploadAvatarDto {
  /** data:image/(jpeg|png|webp);base64,... */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  dataUrl!: string;
}
