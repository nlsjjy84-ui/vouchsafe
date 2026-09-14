# CredoBounty

검증된 전문가와 의뢰인을 잇는 고관여 전문 결과물 에스크로 거래 플랫폼.

백엔드 튜닝, 스마트컨트랙트 감사, 건축물 하자진단, 계약서 검토처럼 "결과를 사전에 판단하기
어렵고 실패하면 손실이 큰" 전문 영역을 대상으로, 국가 공인 자격 검증과 에스크로 결제를
하나의 거래 구조 안에 묶어 검증 부재·직거래 이탈·먹튀 문제를 해결한다.

## 프로젝트 구성
```
credobounty/
├── backend/    # NestJS + PostgreSQL API 서버
├── frontend/   # Next.js 클라이언트
├── docs/       # 원본 기획서, 참고 자료
└── PROGRESS.md # 개발 일지 (의사결정 이력, 발견한 버그, 다음 단계)
```

## 빠른 시작 (백엔드)
```bash
cd backend
cp .env.example .env   # 값 확인/수정
npm install
npm run build
npm run start:dev
# http://localhost:8080/api/health 로 확인
```

## 핵심 흐름
1. 회원가입/로그인 (`/api/auth`)
2. 전문가 자격 인증 신청 (`/api/certifications`) — Mock 검증으로 즉시 승인/반려
3. 바운티 등록 (`/api/bounties`) 및 전문가 지원 (`/api/bounties/:id/apply`)
4. 의뢰인이 지원자 선택 → 에스크로 락업 (`/api/bounties/:id/select/:applicationId`)
5. 전문가 결과물 제출 (`/api/bounties/:id/submit`)
6. 의뢰인 승인 → 수수료 반영 정산 (`/api/bounties/:id/approve`)
7. 이의 있을 시 이의제기 → 자금 동결 → 관리자 중재 (`/api/disputes`)

## 설계 원칙
- 본인인증/오픈뱅킹 에스크로/AWS S3는 전부 Mock 어댑터로 구현 (`backend/src/mocks/`).
  실제 계약이 생기면 이 계층만 교체하면 되도록 인터페이스를 고정했다.
- 상세한 의사결정 배경과 발견한 버그, 다음 단계는 [`PROGRESS.md`](./PROGRESS.md) 참고.
