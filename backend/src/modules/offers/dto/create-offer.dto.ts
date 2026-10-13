import { IsEnum, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DomainType } from '../../../common/enums/domain-type.enum';
import { ServiceType } from '../../../common/enums/service-type.enum';

export class CreateOfferDto {
  @IsEnum(DomainType)
  domainType: DomainType;

  @IsString()
  @Length(5, 60)
  title: string;

  @IsString()
  @Length(20, 2000)
  description: string;

  @Type(() => Number)
  @IsInt()
  @Min(100_000)
  @Max(10_000_000)
  price: number;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  area?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  days?: number;
}
