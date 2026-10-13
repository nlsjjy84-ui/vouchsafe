import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ReportReason } from '../entities/offer-report.entity';

export class ReportOfferDto {
  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  detail?: string;

  /** 문의를 신고할 때만 */
  @IsOptional()
  @IsUUID()
  messageId?: string;
}

export class ResolveReportDto {
  @IsIn(['DISMISS', 'HIDE_MESSAGE', 'CLOSE_OFFER'])
  action: 'DISMISS' | 'HIDE_MESSAGE' | 'CLOSE_OFFER';
}
