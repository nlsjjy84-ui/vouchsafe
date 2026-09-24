# Vouchsafe

검증된 전문가와 의뢰인을 잇는 고관여 전문 결과물 에스크로 거래 플랫폼.

백엔드 튜닝, 스마트컨트랙트 감사, 건축물 하자진단, 계약서 검토처럼 "결과를 사전에 판단하기
어렵고 실패하면 손실이 큰" 전문 영역을 대상으로, 국가 공인 자격 검증과 에스크로 결제를
하나의 거래 구조 안에 묶어 검증 부재·직거래 이탈·먹튀 문제를 해결한다.

## 프로젝트 구성
```
vouchsafe/
├── backend/    # NestJS + PostgreSQL API 서버
├── frontend/   # Next.js 클라이언트
├── docs/       # 원본 기획서, 참고 자료
└── PROGRESS.md # 개발 일지 (의사결정 이력, 발견한 버그, 다음 단계)
```

## 빠른 시작

### 백엔드
```bash
cd backend
cp .env.example .env   # 값 확인/수정 (기본값은 로컬 Postgres + Mock 결제)
npm install
npm run build
npm run start:dev
# http://localhost:8080/api/health 로 확인
# http://localhost:8080/api/docs 에서 Swagger 문서 확인
```

### 프론트엔드
```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE=http://localhost:8080
npm install
npm run dev
# http://localhost:3000 접속 (백엔드가 먼저 떠 있어야 함)
```

## 핵심 흐름
1. 회원가입/로그인, 이메일 인증 (`/api/auth`)
2. 전문가 자격 인증 신청 (`/api/certifications`) — Mock 검증으로 즉시 승인/반려
3. 프로젝트 등록 (`/api/bounties`) 및 전문가 지원 (`/api/bounties/:id/apply`)
4. 의뢰인이 지원자 선택 → `PAYMENT_PENDING` (`/api/bounties/:id/select/:applicationId`)
5. 결제 확인 게이트: 프론트가 포트원(Mock) 결제창을 통과하면 서버가 PG에 직접
   재확인한 뒤에야 에스크로 락업 + `LOCKED` 전환 (`/api/bounties/:id/confirm-payment`)
6. 전문가 결과물 제출 (`/api/bounties/:id/submit`), 큰 프로젝트는 마일스톤 분할 제출/승인도 가능
   (`/api/bounties/:id/milestones`)
7. 의뢰인 승인 → 수수료 반영 정산, 또는 무이의 기간(5일) 만료 시 자동 정산
8. 이의 있을 시 이의제기 → 자금 동결(`FROZEN`) → 관리자 중재 → 정상 정산(`SETTLED`) 또는
   전액 환불(`REFUNDED`) (`/api/disputes`)
9. 정산 완료된 거래는 공개 거래 사례(`/api/cases`)에 익명화되어 자동 노출, 전문가 평판은
   완료율/분쟁승률/처리속도 기반으로 자동 계산(`/api/users/:id/reputation`)
10. 개인화 지출/수익 인사이트(`/api/ai-insights/me`), 관리자용 마이페이지 대시보드(`/api/dashboard/me`)

## 설계 원칙
- 본인인증/오픈뱅킹 에스크로/AWS S3/포트원 결제는 전부 Mock 어댑터로 구현 (`backend/src/mocks/`,
  `backend/src/payments/`). 실제 계약이 생기면 이 계층만 교체하면 되도록 인터페이스를 고정했다.
- "협상 타결"과 "실제 결제 완료"를 같은 순간으로 취급하지 않는다 — `PAYMENT_PENDING` 단계를
  따로 두고, 서버가 PG에 재확인한 뒤에야 에스크로를 잠근다 (위변조 방지).
- 상세한 의사결정 배경과 발견한 버그, 다음 단계는 [`PROGRESS.md`](./PROGRESS.md) 참고.
