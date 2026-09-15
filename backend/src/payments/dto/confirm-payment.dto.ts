import { IsString, IsUUID } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  paymentId: string;

  @IsUUID()
  bountyId: string;
}
