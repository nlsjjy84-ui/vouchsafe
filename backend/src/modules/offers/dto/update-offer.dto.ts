import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateOfferDto } from './create-offer.dto';

/** 상품 수정. 분야는 바꿀 수 없다(인증과 묶여 있어서) — 분야가 다르면 새 상품으로 올린다. */
export class UpdateOfferDto extends PartialType(OmitType(CreateOfferDto, ['domainType'] as const)) {}
