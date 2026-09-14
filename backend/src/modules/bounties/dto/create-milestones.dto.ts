import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min, MinLength, ValidateNested } from 'class-validator';

class MilestoneItemDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsInt()
  @Min(1000, { message: '마일스톤 금액은 최소 1,000원 이상이어야 합니다' })
  amount: number;
}

/**
 * POST /bounties/:id/milestones 요청 본문.
 * items 배열의 amount 합이 바운티 전체 금액(bountyAmount)과 정확히 같아야 한다
 * (BountiesService.defineMilestones에서 검증 - 한 푼도 남거나 모자라면 안 됨).
 * 순서(sequence)는 배열에 담긴 순서 그대로 1부터 자동 부여된다.
 */
export class CreateMilestonesDto {
  @IsArray()
  @ArrayMinSize(2, { message: '마일스톤은 최소 2개 이상으로 나눠주세요 (1개면 일반 바운티와 같습니다)' })
  @ValidateNested({ each: true })
  @Type(() => MilestoneItemDto)
  items: MilestoneItemDto[];
}
