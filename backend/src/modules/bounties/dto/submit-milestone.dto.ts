import { IsOptional, IsString } from 'class-validator';

export class SubmitMilestoneDto {
  @IsOptional()
  @IsString()
  note?: string;
}
