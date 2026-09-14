import { IsString, MinLength } from 'class-validator';

export class FileDisputeDto {
  @IsString()
  @MinLength(10, { message: '이의제기 사유를 최소 10자 이상 구체적으로 작성해주세요' })
  reason: string;
}
