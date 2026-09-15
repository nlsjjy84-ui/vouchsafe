import { applyDecorators } from '@nestjs/common';
import { Matches, MinLength } from 'class-validator';

/**
 * 보안 강화 5탄 — "비밀번호 정책 강화: 16자 이상 + 대/소문자 + 특수문자".
 * 회원가입(RegisterDto.password)과 비밀번호 재설정(ConfirmPasswordResetDto.newPassword)
 * 양쪽에서 동일한 규칙을 재사용하기 위해 데코레이터 하나로 묶었다.
 * (기획서 표현 그대로 "프론트·백엔드 이중 검증" 중 백엔드 쪽 검증 — 프론트는 별도 동일 규칙 적용.)
 */
const HAS_UPPERCASE = '(?=.*[A-Z])';
const HAS_LOWERCASE = '(?=.*[a-z])';
const HAS_SPECIAL_CHAR = '(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>/?~`])';
const STRONG_PASSWORD_REGEX = new RegExp(`^${HAS_UPPERCASE}${HAS_LOWERCASE}${HAS_SPECIAL_CHAR}.+$`);

export function IsStrongPassword() {
  return applyDecorators(
    MinLength(16, { message: '비밀번호는 16자 이상이어야 합니다' }),
    Matches(STRONG_PASSWORD_REGEX, {
      message: '비밀번호는 대문자, 소문자, 특수문자를 각각 1개 이상 포함해야 합니다',
    }),
  );
}
