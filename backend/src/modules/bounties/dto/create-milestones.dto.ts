import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsString, Min, MinLength, ValidateNested } from 'class-validator';

class MilestoneItemDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsInt()
  @Min(1000, { message: '마일스톤 금액은 최소 1,000원입니다' })
  amount: number;
}

export class CreateMilestonesDto {
  @ValidateNested({ each: true })
  @Type(() => MilestoneItemDto)
  @ArrayMinSize(2, { message: '마일스톤은 최소 2개 이상이어야 합니다 (1개면 분할의 의미가 없음)' })
  milestones: MilestoneItemDto[];
}
