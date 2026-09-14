import { PASSWORD_POLICY_REGEX, PASSWORD_MIN_LENGTH } from './password-policy';

/**
 * 정규식 하나로 "16자 이상 + 대문자 1개 이상 + 소문자 1개 이상 + 특수문자 1개
 * 이상"을 동시에 강제하고 있어서, 조건을 하나씩만 어긴 케이스들을 각각
 * 테스트해서 전방탐색(lookahead) 4개가 모두 제대로 걸리는지 확인한다.
 * (숫자는 요구사항에 없으므로 숫자 없이도 통과해야 하는 케이스도 함께 검증)
 */
describe('PASSWORD_POLICY_REGEX', () => {
  it('16자 이상 + 대/소문자 + 특수문자를 모두 만족하면 통과한다', () => {
    expect(PASSWORD_POLICY_REGEX.test('Aa!aaaaaaaaaaaaa')).toBe(true); // 16자
    expect(PASSWORD_POLICY_REGEX.test('MyStrongPassw0rd!!')).toBe(true);
  });

  it('숫자가 하나도 없어도 나머지 조건만 만족하면 통과한다 (숫자는 필수 아님)', () => {
    expect(PASSWORD_POLICY_REGEX.test('AbcdefGhijklmn!!')).toBe(true);
  });

  it('16자 미만이면 나머지를 다 만족해도 거부한다', () => {
    expect(PASSWORD_POLICY_REGEX.test('Aa!aaaaaaaaaaa')).toBe(false); // 14자
  });

  it('대문자가 없으면 거부한다', () => {
    expect(PASSWORD_POLICY_REGEX.test('aaaaaaaaaaaaaa!a')).toBe(false);
  });

  it('소문자가 없으면 거부한다', () => {
    expect(PASSWORD_POLICY_REGEX.test('AAAAAAAAAAAAAA!A')).toBe(false);
  });

  it('특수문자가 없으면 거부한다 (영문+숫자만으로는 부족)', () => {
    expect(PASSWORD_POLICY_REGEX.test('Aa1Aa1Aa1Aa1Aa1A')).toBe(false);
  });

  it('공백 문자도 특수문자로 인정한다', () => {
    expect(PASSWORD_POLICY_REGEX.test('Aa aaaaaaaaaaaaa')).toBe(true);
  });

  it('PASSWORD_MIN_LENGTH 상수는 16이다', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(16);
  });
});
