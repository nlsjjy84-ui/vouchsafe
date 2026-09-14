import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
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

  // 미입력 시 서비스 레이어에서 REMOTE로 기본 처리 (기존 바운티와 동일한 방식).
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  // COMPANION(동행) 선택 시에만 필수 - BountiesService.create()에서 검증.
  @IsOptional()
  @IsDateString({}, { message: '예약 일시 형식이 올바르지 않습니다' })
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  location?: string;
}
