import { IsIn } from 'class-validator';

/** 데모 둘러보기 — 의뢰인(client) 또는 전문가(expert) 시드 계정 중 하나로 바로 들어간다. */
export class DemoLoginDto {
  @IsIn(['client', 'expert'])
  role: 'client' | 'expert';
}
