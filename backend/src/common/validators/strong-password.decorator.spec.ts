import { validate } from 'class-validator';
import { IsStrongPassword } from './strong-password.decorator';

/**
 * 유닛 테스트 — IsStrongPassword (보안 강화 5탄: 16자 이상 + 대/소문자 + 특수문자)
 * class-validator의 validate()를 직접 돌려서, RegisterDto/ConfirmPasswordResetDto가
 * 실제로 적용받는 것과 동일한 검증 경로를 재현한다.
 */
class TestDto {
  @IsStrongPassword()
  password: string;
}

async function isValidPassword(password: string): Promise<boolean> {
  const dto = new TestDto();
  dto.password = password;
  const errors = await validate(dto);
  return errors.length === 0;
}

describe('IsStrongPassword', () => {
  it('16자 미만이면 거부된다', async () => {
    expect(await isValidPassword('Ab1!Ab1!Ab1!Ab1')).toBe(false); // 15자
  });

  it('대문자가 없으면 거부된다', async () => {
    expect(await isValidPassword('abcdefghijklmn1!')).toBe(false);
  });

  it('특수문자가 없으면 거부된다', async () => {
    expect(await isValidPassword('AbcdefghijklmnOP1')).toBe(false);
  });

  it('16자 이상 + 대문자 + 소문자 + 특수문자를 모두 만족하면 통과한다', async () => {
    expect(await isValidPassword('Str0ng!Passw0rd#2026')).toBe(true);
  });
});
