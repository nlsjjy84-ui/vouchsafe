import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpertOffer } from './entities/expert-offer.entity';
import { OfferMessage } from './entities/offer-message.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { User } from '../users/entities/user.entity';
import { DomainType } from '../../common/enums/domain-type.enum';
import { ServiceType } from '../../common/enums/service-type.enum';
import { VerificationStatus } from '../../common/enums/verification-track.enum';

interface SampleOffer {
  domainType: DomainType;
  title: string;
  description: string;
  price: number;
  serviceType: ServiceType;
  area?: string;
  days: number;
  question?: string;
  answer?: string;
}

/**
 * 시연용 상품. 이미 인증이 승인된 데모 전문가(@demo.com)가 있는 분야에만 만든다 —
 * 실제 사용자 이름으로 상품을 만들지 않는다. 상품 표가 비어 있을 때 한 번만 채운다.
 */
export const SAMPLE_OFFERS: SampleOffer[] = [
  {
    domainType: DomainType.VEHICLE_DIAGNOSTICS, serviceType: ServiceType.COMPANION, area: '서울·경기', days: 1, price: 120_000,
    title: '중고차 구매 전 동행 점검 (소형·준중형)',
    description: '매장이든 개인 거래든 차가 있는 곳으로 같이 갑니다. 사고·침수 흔적, 하부 누유, 엔진·미션 상태, 타이어와 소모품 교체 시기까지 약 1시간 동안 봅니다. 점검표와 사진은 결과물로 올려 드리고, 승인하셔야 정산됩니다.',
    question: '딜러 매장 말고 개인 간 거래 차도 봐 주시나요?',
    answer: '네, 개인 거래도 갑니다. 만날 장소와 시간은 의뢰 뒤 안심번호로 정해요.',
  },
  {
    domainType: DomainType.BUILDING_DEFECT_INSPECTION, serviceType: ServiceType.COMPANION, area: '서울·인천', days: 1, price: 100_000,
    title: '입주 전 아파트 사전점검 동행 (34평 이하)',
    description: '사전점검일에 같이 들어가 벽지·바닥·창호·타일·설비를 순서대로 확인합니다. 하자 위치를 사진으로 남기고 하자 접수용 목록을 정리해 드립니다.',
    question: '열화상 카메라도 쓰시나요?',
    answer: '네, 단열·누수 의심 부위는 열화상으로 한 번 더 봅니다.',
  },
  {
    domainType: DomainType.DEV_CODE_REVIEW, serviceType: ServiceType.REMOTE, days: 3, price: 150_000,
    title: '출시 전 웹 서비스 코드 리뷰 (3천 줄 이내)',
    description: '저장소 읽기 권한만 받아 보안 취약점, 오류 처리, 테스트 빈 곳을 봅니다. AI 1차 점검 결과도 같이 확인하고, 고칠 순서를 정한 리뷰 문서를 드립니다.',
  },
  {
    domainType: DomainType.BACKEND_DB_TUNING, serviceType: ServiceType.REMOTE, days: 3, price: 200_000,
    title: '느린 쿼리 5개 원인 진단과 개선안',
    description: '실행 계획을 같이 보고 인덱스, 쿼리 구조, N+1 문제를 찾습니다. 고친 전후 응답 시간을 숫자로 비교해 드립니다.',
  },
  {
    domainType: DomainType.STARTUP_CONTRACT_REVIEW, serviceType: ServiceType.REMOTE, days: 2, price: 180_000,
    title: '스타트업 용역·투자 계약서 1건 검토',
    description: '불리한 조항, 빠진 조항, 위약금과 지식재산권 귀속을 표시해 드립니다. 수정 문구 제안까지 포함합니다.',
  },
  {
    domainType: DomainType.FIRE_SAFETY_INSPECTION, serviceType: ServiceType.COMPANION, area: '서울', days: 1, price: 130_000,
    title: '소규모 매장 소방시설 자체점검 동행',
    description: '소화기, 유도등, 비상조명, 스프링클러 헤드 상태를 점검하고 점검표 작성 방법을 알려 드립니다.',
  },
  {
    domainType: DomainType.REAL_ESTATE_TITLE_ANALYSIS, serviceType: ServiceType.REMOTE, days: 1, price: 100_000,
    title: '전세 계약 전 등기부·건축물대장 권리분석',
    description: '등기부등본과 건축물대장을 보고 선순위 채권, 근저당 비율, 위반건축물 여부를 확인합니다. 계약 전에 물어볼 질문 목록을 같이 드립니다.',
    question: '계약일이 모레인데 내일까지 가능할까요?',
    answer: '서류를 오늘 올려 주시면 내일 오전까지 드릴 수 있어요.',
  },
  {
    domainType: DomainType.MOBILE_QA_AUTOMATION, serviceType: ServiceType.REMOTE, days: 4, price: 160_000,
    title: '앱 출시 전 기기 10종 QA',
    description: '안드로이드·iOS 기기 10종에서 주요 흐름을 따라가며 깨지는 화면과 오류를 영상으로 남깁니다. 재현 순서가 적힌 이슈 목록을 드립니다.',
  },
];

@Injectable()
export class OffersSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(OffersSeeder.name);

  constructor(
    @InjectRepository(ExpertOffer) private readonly offers: Repository<ExpertOffer>,
    @InjectRepository(OfferMessage) private readonly messages: Repository<OfferMessage>,
    @InjectRepository(Certification) private readonly certifications: Repository<Certification>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    if ((process.env.OFFER_SEED ?? '').toLowerCase() === 'off') return;
    try {
      const created = await this.seed();
      if (created > 0) this.logger.log(`sample offers created: ${created}`);
    } catch (e) {
      // 시연 데이터가 실패해도 서버는 떠야 한다
      this.logger.warn(`offer seed skipped: ${(e as Error).message}`);
    }
  }

  async seed(): Promise<number> {
    if ((await this.offers.count()) > 0) return 0;
    const asker = await this.users.findOne({ where: { email: 'client@demo.com' } });
    let created = 0;
    for (const sample of SAMPLE_OFFERS) {
      const cert = await this.certifications
        .createQueryBuilder('c')
        .innerJoin(User, 'u', 'u.id = c.userId')
        .where('c.domainType = :domain', { domain: sample.domainType })
        .andWhere('c.verifiedStatus = :approved', { approved: VerificationStatus.APPROVED })
        .andWhere('u.email LIKE :demo', { demo: '%@demo.com' })
        .orderBy('u.email', 'ASC')
        .getOne();
      if (!cert) continue;
      const { question, answer, ...fields } = sample;
      const offer = await this.offers.save(
        this.offers.create({ ...fields, area: sample.area ?? null, expertId: cert.userId, messageCount: question && asker ? (answer ? 2 : 1) : 0 }),
      );
      if (question && asker) {
        await this.messages.save(this.messages.create({ offerId: offer.id, authorId: asker.id, content: question }));
        if (answer) await this.messages.save(this.messages.create({ offerId: offer.id, authorId: cert.userId, content: answer }));
      }
      created++;
    }
    return created;
  }
}
