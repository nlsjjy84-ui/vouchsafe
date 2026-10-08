import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { CommunityService } from '../modules/community/community.service';
import { CommunityPost, PostCategory } from '../modules/community/entities/community-post.entity';
import { DomainType } from '../common/enums/domain-type.enum';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * 커뮤니티 게시판 시연용 글·댓글·대댓글. 중고차/부동산 이야기를 중심으로 만든다.
 * 사용법: npm run seed-demo-community   (seed-demo, seed-demo-match 이후. 여러 번 실행해도 중복 생성 안 함)
 */
type C = { by: string; text: string; replies?: { by: string; text: string }[] };
interface P {
  by: string; category: PostCategory; domain?: DomainType; title: string; content: string;
  daysAgo: number; views: number; likes: string[]; comments?: C[];
}

const CAR = DomainType.VEHICLE_DIAGNOSTICS;
const RE = DomainType.REAL_ESTATE_TITLE_ANALYSIS;
const DB = DomainType.BACKEND_DB_TUNING;

const POSTS: P[] = [
  { by: 'demo-admin@demo.com', category: PostCategory.NOTICE, title: '커뮤니티 이용 안내 - 실명 공개와 전문가 인증 표시',
    content: '이 게시판은 익명 없이 운영됩니다. 모든 글과 댓글에는 작성자 이름이 표시되고, 승인된 전문가에게는 인증 분야가 함께 표시됩니다.\n글의 분야와 같은 분야에서 인증받은 전문가가 쓴 답변에는 "전문가 답변" 표시가 붙습니다.\n개인정보(연락처, 주소)와 거래를 우회하려는 연락 유도는 삭제될 수 있습니다.',
    daysAgo: 14, views: 120, likes: ['client@demo.com', 'client2@demo.com', 'match-car1@demo.com'] },
  { by: 'client@demo.com', category: PostCategory.REVIEW, domain: CAR, title: '중고 SUV 동행 점검 받고 계약 취소했습니다 (후기)',
    content: '성수동 매매단지에서 구매하려던 SUV였는데 동행 점검을 받아 보니 앞 휀더와 후드 도색 흔적, 하부 부식이 발견됐어요.\n딜러는 무사고라고 했지만 점검 보고서에 근거 사진이 있어서 협상 근거로 쓰거나 계약을 접을 수 있었습니다. 결국 취소했고 15만 원 쓰고 수백만 원 아낀 느낌입니다.',
    daysAgo: 3, views: 86, likes: ['client2@demo.com', 'client3@demo.com', 'match-car2@demo.com', 'match-re1@demo.com'],
    comments: [
      { by: 'client2@demo.com', text: '저도 비슷한 경험 있어요. 성능기록부만 믿으면 안 되더라고요.' },
      { by: 'match-car1@demo.com', text: '도색 흔적은 도막 두께 측정기로 확인하면 정확합니다. 점검 때는 앞 휀더 볼트 도장 상태도 같이 보세요.',
        replies: [{ by: 'client@demo.com', text: '맞아요, 볼트 부분 도장이 벗겨져 있다고 보여주셨어요!' }, { by: 'client3@demo.com', text: '볼트 도장 확인은 몰랐네요. 저장해 둡니다.' }] },
    ] },
  { by: 'client2@demo.com', category: PostCategory.QUESTION, domain: CAR, title: '중고 전기차 배터리 상태는 어디까지 믿어야 하나요?',
    content: '구매 검토 중인 중고 전기차가 있는데 딜러가 배터리 SOH 95%라고 합니다. 이 숫자를 그대로 믿어도 되는지, 확인 방법이 있는지 궁금합니다.',
    daysAgo: 2, views: 54, likes: ['client@demo.com'],
    comments: [
      { by: 'match-car2@demo.com', text: '딜러가 보여주는 숫자는 차량 계기판 기준이라 제조사마다 보정 방식이 다릅니다. 충전 이력(급속 비율)과 셀 간 전압 편차까지 같이 봐야 하고, 진단기로 직접 읽은 값을 요구하세요.',
        replies: [{ by: 'client2@demo.com', text: '셀 간 편차는 어디서 확인하나요?' }, { by: 'match-car2@demo.com', text: '진단기(OBD) 연결 후 셀 전압 목록에서 최고값과 최저값 차이를 봅니다. 보통 수십 mV 이내면 양호한 편이에요.' }] },
    ] },
  { by: 'client3@demo.com', category: PostCategory.WARNING, domain: RE, title: '[주의] "보증금 보호 보험 가입돼 있다"는 말만 믿고 계약할 뻔했습니다',
    content: '빌라 전세 계약 직전에 중개인이 보증보험 가입이 가능하다고만 말하고 서류는 보여주지 않았습니다. 등기부를 직접 떼어 보니 근저당이 시세 대비 높아 보증보험 가입 자체가 안 되는 집이었어요.\n말만 믿지 말고 등기부등본을 계약 전에 직접 확인하세요.',
    daysAgo: 5, views: 143, likes: ['client@demo.com', 'client2@demo.com', 'match-re1@demo.com', 'match-re2@demo.com', 'match-car1@demo.com'],
    comments: [
      { by: 'match-re1@demo.com', text: '근저당 채권최고액과 선순위 보증금을 합쳐 시세의 70%를 넘으면 위험 신호로 봅니다. 계약 당일 잔금 전에 등기부를 한 번 더 떼어 보세요.',
        replies: [{ by: 'client3@demo.com', text: '잔금 당일 재확인까지는 생각 못했어요. 감사합니다.' }] },
      { by: 'match-re2@demo.com', text: '건축물대장의 위반건축물 표시도 같이 확인하세요. 보증보험 가입이 막히는 흔한 이유입니다.' },
    ] },
  { by: 'client@demo.com', category: PostCategory.QUESTION, domain: RE, title: '경매 물건 임장은 어디까지 직접 하고 어디부터 맡기나요?',
    content: '처음 경매를 알아보고 있습니다. 물건 현장은 직접 가 보려는데 점유자 확인이나 인수 권리는 전문가에게 맡기는 편이 나은지 궁금합니다.',
    daysAgo: 4, views: 61, likes: ['client3@demo.com'],
    comments: [
      { by: 'match-re1@demo.com', text: '현장 분위기와 주변 환경은 직접 보시고, 점유자 전입 여부·인수해야 할 권리·명도 난이도는 맡기시길 권합니다. 잘못 판단하면 보증금이 묶입니다.' },
    ] },
  { by: 'match-re2@demo.com', category: PostCategory.TIP, domain: RE, title: '등기부등본 볼 때 꼭 확인하는 5가지',
    content: '1) 소유자 이름과 계약 상대방이 같은지\n2) 갑구의 가압류·가처분·압류 여부\n3) 을구의 근저당 채권최고액\n4) 신탁등기 여부 (신탁이면 소유자 동의가 따로 필요)\n5) 계약 당일과 잔금일에 한 번씩 다시 발급\n표제부의 건물 용도와 건축물대장도 꼭 대조하세요.',
    daysAgo: 8, views: 210, likes: ['client@demo.com', 'client2@demo.com', 'client3@demo.com', 'match-re1@demo.com', 'match-re3@demo.com'],
    comments: [
      { by: 'client2@demo.com', text: '신탁등기는 처음 알았습니다. 정리 감사해요.',
        replies: [{ by: 'match-re2@demo.com', text: '신탁이면 임대차 계약에 수탁자 동의서가 있어야 안전합니다. 없으면 계약을 보류하세요.' }] },
    ] },
  { by: 'match-car1@demo.com', category: PostCategory.TIP, domain: CAR, title: '침수차 구별하는 현장 체크 포인트',
    content: '시트 레일과 안전벨트 끝단의 녹, 트렁크 스페어타이어 아래 습기 자국, 실내 곰팡이 냄새를 가리려는 방향제 냄새를 확인하세요.\n전장품 커넥터에 녹이나 진흙이 끼어 있으면 의심해야 합니다. 현장에서 애매하면 동행 점검을 받는 것이 가장 확실합니다.',
    daysAgo: 6, views: 175, likes: ['client@demo.com', 'client2@demo.com', 'client3@demo.com', 'match-car2@demo.com'],
    comments: [{ by: 'client3@demo.com', text: '안전벨트 끝단은 정말 좋은 팁이네요. 다음 주 차 보러 가는데 확인해 보겠습니다.' }] },
  { by: 'client3@demo.com', category: PostCategory.REVIEW, domain: DB, title: '쿼리 튜닝 의뢰 후기 - 응답시간 4초에서 0.3초',
    content: '매출 집계 쿼리가 너무 느려 전문가에게 맡겼습니다. 실행계획 분석, 복합 인덱스 설계, 개선 전후 비교표까지 받았고 실제 운영에 적용해도 문제가 없었습니다.\n환불·분쟁 사례도 거래 사례 메뉴에서 같이 보이는 점이 신뢰가 갔어요.',
    daysAgo: 4, views: 47, likes: ['client@demo.com', 'match-db1@demo.com'],
    comments: [{ by: 'match-db1@demo.com', text: '좋은 평가 감사합니다. 인덱스가 늘면 쓰기 성능도 달라질 수 있으니 한 달 뒤 지표를 한 번 더 확인해 보세요.' }] },
  { by: 'client2@demo.com', category: PostCategory.WARNING, domain: CAR, title: '"사고 이력 없음" 확인서만 보여주는 딜러 주의',
    content: '딜러가 보험 이력 조회서만 보여 주며 무사고라고 했습니다. 하지만 자비로 수리한 사고는 보험 이력에 남지 않는다고 하네요. 이력 조회서와 실차 상태는 별개로 확인해야 합니다.',
    daysAgo: 1, views: 38, likes: ['client@demo.com', 'match-car1@demo.com'],
    comments: [{ by: 'match-car1@demo.com', text: '정확합니다. 자비 수리는 이력에 안 남으니 용접 흔적, 패널 단차, 도막 두께를 직접 봐야 합니다.',
      replies: [{ by: 'client2@demo.com', text: '패널 단차는 사진으로도 확인 가능한가요?' }, { by: 'match-car1@demo.com', text: '측면에서 빛을 비추고 찍은 사진이면 어느 정도는 가능합니다. 다만 현장 확인만큼 정확하지는 않아요.' }] }] },
];

async function bootstrap() {
  if (process.env.NODE_ENV === 'production') {
    console.error('운영 환경에서는 실행할 수 없습니다.');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const users = app.get(UsersService);
    const svc = app.get(CommunityService);
    const ds = app.get(DataSource);
    const postRepo = ds.getRepository(CommunityPost);

    const idOf = new Map<string, { id: string; role: UserRole }>();
    const need = async (email: string) => {
      if (idOf.has(email)) return idOf.get(email)!;
      const u = await users.findByEmail(email);
      if (!u) return null;
      const v = { id: u.id, role: u.role };
      idOf.set(email, v);
      return v;
    };

    let made = 0;
    for (const p of POSTS) {
      if (await postRepo.findOne({ where: { title: p.title } })) { console.log(`건너뜀(이미 있음): ${p.title}`); continue; }
      const author = await need(p.by);
      if (!author) { console.log(`건너뜀(계정 없음 - ${p.by}): ${p.title}`); continue; }
      const post = await svc.create({ userId: author.id, role: author.role }, { category: p.category, domainType: p.domain, title: p.title, content: p.content } as any, []);
      const base = Date.now() - p.daysAgo * 86_400_000;
      await ds.query(`UPDATE community_posts SET "createdAt" = $1, "updatedAt" = $1, "viewCount" = $2 WHERE id = $3`, [new Date(base), p.views, post.id]);
      for (const e of p.likes) { const u = await need(e); if (u) await svc.toggleLike(u.id, post.id); }
      let step = 1;
      for (const c of p.comments ?? []) {
        const cu = await need(c.by); if (!cu) continue;
        const root = await svc.addComment(cu.id, post.id, c.text);
        await ds.query(`UPDATE community_comments SET "createdAt" = $1 WHERE id = $2`, [new Date(base + step++ * 3_600_000), root.id]);
        for (const r of c.replies ?? []) {
          const ru = await need(r.by); if (!ru) continue;
          const rep = await svc.addComment(ru.id, post.id, r.text, root.id);
          await ds.query(`UPDATE community_comments SET "createdAt" = $1 WHERE id = $2`, [new Date(base + step++ * 3_600_000), rep.id]);
        }
      }
      made++;
      console.log(`[${p.category}] ${p.title}`);
    }
    console.log(`\n게시판 시연 글 ${made}개 생성 완료. /community 에서 확인하세요.`);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('게시판 시연 데이터 생성 실패:', err);
  process.exit(1);
});
