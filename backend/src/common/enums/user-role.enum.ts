/**
 * 기획서 10장 Users 테이블 role 컬럼 (의뢰인/전문가/하이브리드).
 * HYBRID: 한 계정으로 의뢰도 하고 전문가로 지원도 하는 경우 (기획서에서 명시적으로 허용).
 *
 * ADMIN: Phase 2에서 추가한 역할. 이의제기(Dispute) 중재처럼 "운영자만" 할 수 있는
 * 작업을 구분하기 위해 존재한다. 아주 중요한 보안 규칙 하나 —
 * ADMIN은 절대로 공개 회원가입(POST /auth/register)으로 만들어질 수 없다.
 * 누구나 회원가입 화면에서 role을 ADMIN으로 보내면 관리자가 될 수 있다면
 * 보안적으로 무의미하기 때문. ADMIN 계정은 오직 서버 운영자가 별도 스크립트
 * (scripts/seed-admin.ts)로만 만들 수 있게 분리했다. → RegisterDto 참고.
 */
export enum UserRole {
  CLIENT = 'CLIENT',
  EXPERT = 'EXPERT',
  HYBRID = 'HYBRID',
  ADMIN = 'ADMIN',
}

/** 공개 회원가입 화면에서 선택 가능한 역할 목록 (ADMIN 제외) */
export const PUBLIC_REGISTRABLE_ROLES = [UserRole.CLIENT, UserRole.EXPERT, UserRole.HYBRID] as const;
