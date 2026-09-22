import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

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
  specialty!: string;
}
