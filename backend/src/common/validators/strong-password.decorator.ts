import { applyDecorators } from '@nestjs/common';
import { Matches, MinLength } from 'class-validator';

/**
 * 보안 강화 5탄 — "비밀번호 정책: 10자 이상 + 대/소문자 + 숫자 + 특수문자".
 * (2026-09-15 조정: 처음엔 16자로 시작했으나, 실사용성을 고려해 10자로 낮추는 대신
 *  숫자 포함 요건을 추가해 강도를 보완했다.)
 * 회원가입(RegisterDto.password)과 비밀번호 재설정(ConfirmPasswordResetDto.newPassword)
 * 양쪽에서 동일한 규칙을 재사용하기 위해 데코레이터 하나로 묶었다.
 * (기획서 표현 그대로 "프론트·백엔드 이중 검증" 중 백엔드 쪽 검증 — 프론트는 별도 동일 규칙 적용.)
 */
export const PASSWORD_MIN_LENGTH = 10;

const HAS_UPPERCASE = '(?=.*[A-Z])';
const HAS_LOWERCASE = '(?=.*[a-z])';
const HAS_DIGIT = '(?=.*[0-9])';
const HAS_SPECIAL_CHAR = '(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>/?~`])';
const STRONG_PASSWORD_REGEX = new RegExp(
  `^${HAS_UPPERCASE}${HAS_LOWERCASE}${HAS_DIGIT}${HAS_SPECIAL_CHAR}.+$`,
);

export function IsStrongPassword() {
  return applyDecorators(
    MinLength(PASSWORD_MIN_LENGTH, { message: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다` }),
    Matches(STRONG_PASSWORD_REGEX, {
      message: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다',
    }),
  );
}
