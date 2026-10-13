import { IsString, Length } from 'class-validator';

export class OfferMessageDto {
  @IsString()
  @Length(2, 500)
  content: string;
}
