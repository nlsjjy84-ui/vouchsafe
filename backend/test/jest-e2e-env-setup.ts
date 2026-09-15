/**
 * e2e 테스트 전용 환경변수 오버라이드.
 *
 * - DB_NAME을 별도의 credobounty_test DB로 돌려서, 로컬 개발용 credobounty DB를
 *   절대 건드리지 않는다 (CI의 postgres:16 서비스 컨테이너에서도 이 이름으로 새로 만든다).
 * - AUTH_RATE_LIMIT_PER_MIN을 크게 풀어서, 한 시나리오 안에서 회원가입/로그인을
 *   여러 번 연달아 호출하는 e2e 테스트가 운영용 분당 5회 제한에 걸리지 않게 한다
 *   (운영/개발 .env에는 이 값이 없으므로 실제 서비스 동작은 전혀 바뀌지 않는다).
 * - PORTONE_WEBHOOK_SECRET을 고정값으로 지정해, 웹훅 서명 검증 e2e 테스트가
 *   재현 가능한 시크릿으로 HMAC을 계산할 수 있게 한다.
 *
 * jest의 setupFiles는 각 테스트 파일이 로드(=AppModule을 import)되기 "전"에 실행되므로,
 * TypeOrmModule.forRootAsync의 useFactory가 process.env를 읽는 시점보다 항상 앞선다.
 */
process.env.DB_NAME = process.env.DB_NAME_TEST ?? 'credobounty_test';
process.env.AUTH_RATE_LIMIT_PER_MIN = '1000';
process.env.PORTONE_WEBHOOK_SECRET =
  'whsec_dGVzdC1lMmUtd2ViaG9vay1zZWNyZXQtMzJieXRlcyEh';
