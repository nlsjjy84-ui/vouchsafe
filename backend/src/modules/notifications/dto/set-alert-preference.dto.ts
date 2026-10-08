import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DomainType } from '../../../common/enums/domain-type.enum';

export class SetAlertPreferenceDto {
  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @ArrayMaxSize(15)
  @IsEnum(DomainType, { each: true })
  domains: DomainType[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  minAmount?: number | null;
}
