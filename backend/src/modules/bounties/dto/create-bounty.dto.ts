import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DomainType } from '../../../common/enums/domain-type.enum';
import { ServiceType } from '../../../common/enums/service-type.enum';

export class CreateBountyDto {
  @IsEnum(DomainType)
  domainType: DomainType;

  @IsString()
  @MinLength(5)
  title: string;

  @IsString()
  @MinLength(20, { message: '의뢰 내용은 최소 20자 이상 구체적으로 작성해주세요' })
  description: string;

  @IsInt()
  @Min(10000, { message: '최소 바운티 금액은 10,000원입니다' })
  bountyAmount: number;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType = ServiceType.REMOTE;

  // COMPANION(동행) 서비스일 때만 필수 — REMOTE면 그냥 비워둔다
  @ValidateIf((dto) => dto.serviceType === ServiceType.COMPANION)
  @IsString()
  @MinLength(5, { message: '동행 서비스는 만날 장소를 구체적으로 입력해주세요' })
  companionLocation?: string;

  @ValidateIf((dto) => dto.serviceType === ServiceType.COMPANION)
  @IsDateString({}, { message: '동행 서비스는 만날 시각(ISO 8601)을 입력해주세요' })
  companionMeetingAt?: string;
}
