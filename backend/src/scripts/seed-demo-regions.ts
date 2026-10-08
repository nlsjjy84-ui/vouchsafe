import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';

/**
 * 지역 찾기 시연용 데이터: 시연 전문가에게 활동 지역(동 단위)을, 모집 중 프로젝트에 만남 지역을 붙인다.
 * 좌표는 각 동의 대략적인 중심 위치(시연용)이며, 이미 지역이 있는 전문가·프로젝트는 건드리지 않는다.
 * 사용법: npm run seed-demo-regions   (seed-demo, seed-demo-match 이후. 로컬 시연 전용)
 */
type R = [sido: string, sigungu: string, dong: string, lat: number, lng: number];
const SEONGSU: R = ['서울', '성동구', '성수동1가', 37.5446, 127.0557];
const YEOKSAM: R = ['서울', '강남구', '역삼동', 37.5006, 127.0364];
const SEOGYO: R = ['서울', '마포구', '서교동', 37.5547, 126.9206];
const JAMSIL: R = ['서울', '송파구', '잠실동', 37.5133, 127.1001];
const SEOCHO: R = ['서울', '서초구', '서초동', 37.4837, 127.0324];
const SANGGYE: R = ['서울', '노원구', '상계동', 37.6542, 127.0568];
const JEONGJA: R = ['경기', '성남시 분당구', '정자동', 37.3669, 127.1085];
const YEONGTONG: R = ['경기', '수원시 영통구', '영통동', 37.2517, 127.0713];
const PUNGDEOK: R = ['경기', '용인시 수지구', '풍덕천동', 37.3225, 127.0951];
const DEOKPUNG: R = ['경기', '하남시', '덕풍동', 37.5393, 127.2148];
const GUWOL: R = ['인천', '남동구', '구월동', 37.4486, 126.7053];
const SONGDO: R = ['인천', '연수구', '송도동', 37.3826, 126.6567];
const U: R = ['부산', '해운대구', '우동', 35.1631, 129.1635];
const BUJEON: R = ['부산', '부산진구', '부전동', 35.1579, 129.0597];
const BEOMEO: R = ['대구', '수성구', '범어동', 35.8588, 128.6306];
const BONGMYEONG: R = ['대전', '유성구', '봉명동', 36.3526, 127.3414];
const CHIPYEONG: R = ['광주', '서구', '치평동', 35.1526, 126.8497];
const BULDANG: R = ['충남', '천안시 서북구', '불당동', 36.8151, 127.1139];
const YEON: R = ['제주', '제주시', '연동', 33.489, 126.4983];

const EXPERT_REGIONS: Record<string, R> = {
  'match-car1@demo.com': SEONGSU,
  'match-car2@demo.com': GUWOL,
  'match-re1@demo.com': YEOKSAM,
  'match-re2@demo.com': JEONGJA,
  'match-re3@demo.com': U,
  'match-db1@demo.com': JAMSIL,
  'match-db2@demo.com': SEOCHO,
  'match-db3@demo.com': BEOMEO,
  'match-dev1@demo.com': SEOGYO,
  'match-dev2@demo.com': BONGMYEONG,
  'expert@demo.com': SANGGYE,
  'expert2@demo.com': YEONGTONG,
  'expert3@demo.com': CHIPYEONG,
  'expert4@demo.com': BUJEON,
};

// 모집 중 프로젝트 제목(일부 일치) → 만남 지역
const BOUNTY_REGIONS: [string, R][] = [
  ['중고 SUV 구매 전 현장 동행 점검', SEONGSU],
  ['경매 아파트 현장 임장 대행', JEONGJA],
  ['빌라 전세 계약 전 근저당', YEOKSAM],
  ['중고 전기차 배터리', GUWOL],
];
const SPARE: R[] = [PUNGDEOK, DEOKPUNG, SONGDO, U, BEOMEO, BULDANG, YEON, SEOGYO, JAMSIL];

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    console.error('운영 환경에서는 실행할 수 없습니다.');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const ds = app.get(DataSource);
    let users = 0, bounties = 0;
    for (const [email, r] of Object.entries(EXPERT_REGIONS)) {
      const res = await ds.query(
        `UPDATE users SET region_sido=$1, region_sigungu=$2, region_dong=$3, region_lat=$4, region_lng=$5 WHERE email=$6 AND region_sido IS NULL`,
        [r[0], r[1], r[2], r[3], r[4], email],
      );
      const n = Array.isArray(res) ? (res[1] ?? 0) : 0;
      if (n) { users += n; console.log(`전문가 지역: ${email} → ${r[0]} ${r[1]} ${r[2]}`); }
    }
    const open: { id: string; title: string; serviceType: string }[] = await ds.query(
      `SELECT id, title, "serviceType" FROM bounties WHERE status = 'PENDING' AND region_sido IS NULL ORDER BY "createdAt" DESC`,
    );
    let spare = 0;
    for (const b of open) {
      const hit = BOUNTY_REGIONS.find(([t]) => b.title.includes(t));
      // 제목이 맞는 건은 지정 지역에, 현장 동행 건은 남는 지역에 순서대로 배치한다. 원격 건은 지역이 없다.
      const r = hit ? hit[1] : b.serviceType === 'COMPANION' ? SPARE[spare++ % SPARE.length] : null;
      if (!r) continue;
      await ds.query(
        `UPDATE bounties SET region_sido=$1, region_sigungu=$2, region_dong=$3, region_lat=$4, region_lng=$5 WHERE id=$6`,
        [r[0], r[1], r[2], r[3], r[4], b.id],
      );
      bounties++;
      console.log(`프로젝트 지역: ${b.title} → ${r[0]} ${r[1]} ${r[2]}`);
    }
    console.log(`\n지역 시연 데이터: 전문가 ${users}명, 프로젝트 ${bounties}건. /map 에서 확인하세요.`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('지역 시연 데이터 생성 실패:', err);
  process.exit(1);
});
