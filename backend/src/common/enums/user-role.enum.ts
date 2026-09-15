/**
 * 기획서 10장 Users 테이블 role 컬럼 (의뢰인/전문가/하이브리드).
 * HYBRID: 한 계정으로 의뢰도 하고 전문가로 지원도 하는 경우 (기획서에서 명시적으로 허용).
 *
 * ADMIN (Phase 2): 분쟁 중재 등 관리자 전용 API를 호출할 수 있는 역할.
 * 공개 회원가입(RegisterDto)에서는 절대 선택할 수 없도록 화이트리스트로 막아뒀고,
 * 관리자 계정은 오직 서버 콘솔 스크립트(scripts/create-admin.ts)로만 생성된다 —
 * "회원가입 경로로 관리자 권한을 만들 수 없게 한다"는 원칙을 지키기 위함.
 */
export enum UserRole {
  CLIENT = 'CLIENT',
  EXPERT = 'EXPERT',
  HYBRID = 'HYBRID',
  ADMIN = 'ADMIN',
}

/** 공개 회원가입에서 선택 가능한 역할 화이트리스트 (ADMIN 제외) */
export const PUBLIC_REGISTERABLE_ROLES = [UserRole.CLIENT, UserRole.EXPERT, UserRole.HYBRID];
