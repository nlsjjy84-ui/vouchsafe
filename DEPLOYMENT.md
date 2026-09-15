# 배포 가이드 (Vercel + Render/Railway)

이 문서는 CredoBounty를 실제로 인터넷에 올려 데모 링크를 확보하기 위한 절차입니다.
프론트는 Vercel, 백엔드는 Render 또는 Railway 중 하나를 씁니다(둘 다 무료 티어로 시작 가능).
아래 순서(백엔드 → 프론트)로 진행해야, 백엔드 URL을 프론트 환경변수에 넣을 수 있습니다.

---

## 0. 사전 준비

- GitHub에 이 저장소가 푸시되어 있어야 합니다 (Vercel/Render/Railway 모두 GitHub 연동 배포 방식).
- `backend/.env.example`을 참고해 실제 운영용 값을 미리 메모해 둡니다. 특히 `JWT_SECRET`은
  로컬 개발용과 다른, 새로 생성한 긴 랜덤 문자열을 써야 합니다:
  ```bash
  # 터미널에서 랜덤 시크릿 하나 생성 (예시)
  openssl rand -base64 48
  ```

---

## 1. 백엔드 배포 — Render 기준 (Railway도 절차는 거의 동일)

### 1-1. PostgreSQL 인스턴스 생성
1. Render 대시보드 → **New → PostgreSQL**
2. Region은 이후 만들 Web Service와 같은 리전으로 선택 (지연시간 최소화)
3. 생성 후 **Internal Database URL**(같은 Render 리전 안에서 쓸 주소) 또는
   **External Database URL**을 복사해 둡니다.

### 1-2. Web Service 생성
1. Render 대시보드 → **New → Web Service** → 이 GitHub 저장소 선택
2. 설정값:
   - **Root Directory**: `backend`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Node Version**: 20 (Render는 보통 `package.json`의 `engines` 또는 기본값을 따름 — 문제가
     있으면 Environment 탭에서 `NODE_VERSION=20` 추가)

### 1-3. 환경변수 설정 (Web Service → Environment)
| 변수 | 값 | 비고 |
|---|---|---|
| `DATABASE_URL` | 1-1에서 복사한 Postgres URL | 이걸 넣으면 `DB_HOST` 등 개별 변수는 무시되고, TLS도 자동으로 켜집니다 (이번 세션에서 이 동작을 코드에 추가했습니다) |
| `JWT_SECRET` | 0번에서 생성한 랜덤 문자열 | 로컬 개발용과 절대 공유하지 않기 |
| `FRONTEND_ORIGIN` | `https://<프론트-도메인>.vercel.app` | 2단계에서 Vercel 도메인이 나온 뒤 채워도 됨. 콤마로 여러 개 지정 가능 |
| `PORT` | `8080` | Render는 자체 `PORT`를 주입하기도 하니, 만약 Render가 자동 주입하는 `PORT`와 충돌하면 그 값을 우선 사용 |

> Railway를 쓴다면: **New Project → Provision PostgreSQL**로 DB를 먼저 만들고, 같은 프로젝트 안에
> **New → GitHub Repo**로 백엔드 서비스를 추가한 뒤, Root Directory를 `backend`로, 위와 같은
> 환경변수를 Variables 탭에 넣습니다. Railway는 `DATABASE_URL`을 자동으로 서비스 간에 참조
> (`${{Postgres.DATABASE_URL}}`) 변수로 넣어줄 수 있습니다.

### 1-4. 배포 확인
배포가 끝나면 `https://<백엔드-서비스명>.onrender.com/api/health`로 접속해 정상 응답을 확인합니다.
Swagger 문서는 `/api/docs`에서 확인할 수 있습니다.

---

## 2. 프론트엔드 배포 — Vercel

1. Vercel 대시보드 → **Add New → Project** → 이 GitHub 저장소 선택
2. **Root Directory**를 `frontend`로 지정 (Vercel이 Next.js를 자동 인식하므로 빌드/시작 명령은
   기본값 그대로 두면 됩니다)
3. 환경변수 (Project → Settings → Environment Variables):

| 변수 | 값 |
|---|---|
| `NEXT_PUBLIC_API_BASE` | 1단계에서 확인한 백엔드 URL (예: `https://credobounty-api.onrender.com`) |

4. Deploy 클릭 → 완료되면 `https://<프로젝트명>.vercel.app` 도메인이 발급됩니다.
5. 이 도메인을 1-3의 `FRONTEND_ORIGIN`에 채워 넣고 백엔드 서비스를 재배포(또는 Render/Railway가
   환경변수 변경 시 자동 재배포하도록 되어 있으면 저장만) 해서 CORS를 마무리합니다.

---

## 3. 배포 후 점검 체크리스트

- [ ] `GET /api/health` 200 응답
- [ ] 프론트에서 회원가입 → 로그인까지 실제로 동작
- [ ] 브라우저 개발자도구 Network 탭에서 CORS 에러가 없는지 확인
- [ ] Swagger(`/api/docs`)에서 로그인 토큰으로 인증이 필요한 API가 정상 호출되는지 확인
- [ ] `synchronize: true`로 되어 있어 첫 배포 시 스키마가 자동 생성됩니다 — 운영을 계속 이어갈
      계획이라면 이후에는 TypeORM 마이그레이션으로 전환하는 걸 다음 단계로 남겨둡니다.

---

## 4. 남은 회귀 테스트 (배포 이후)

- PortOne 실제 카드 테스트 결제 1건 (샌드박스 웹훅까지는 이번 세션에서 e2e로 검증 완료, 실제
  카드 결제만 남음)
- Next.js 16 정식 마이그레이션
