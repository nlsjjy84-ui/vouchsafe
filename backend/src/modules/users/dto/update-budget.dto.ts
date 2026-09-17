import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

/**
 * "AI 기반 개인화 예산 및 소비패턴 분석" 기능용 - 월 지출 예산 목표 설정 DTO.
 * monthlyBudgetGoal을 생략하거나 null로 보내면 예산 목표를 해제한다.
 */
export class UpdateBudgetDto {
  @IsOptional()
  @ValidateIf((dto) => dto.monthlyBudgetGoal !== null)
  @IsInt()
  @Min(10000, { message: '월 예산은 최소 10,000원 이상으로 설정해주세요' })
  monthlyBudgetGoal?: number | null;
}
