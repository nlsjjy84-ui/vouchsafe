import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DomainType } from '../../../common/enums/domain-type.enum';
import { ServiceType } from '../../../common/enums/service-type.enum';

export enum OfferStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

/**
 * 전문가 상품. 의뢰인이 공고를 올리고 전문가가 지원하는 흐름의 반대 방향이다 —
 * 인증받은 전문가가 "이 일을 이 가격에 해 드린다"를 먼저 올리고, 의뢰인이 그 가격 그대로 의뢰한다.
 * 가격은 플랫폼이 정하지 않고 전문가가 정한다. 플랫폼은 거래가 성사돼 정산될 때만 수수료(누진식, settlement-fee.util)를 받는다.
 */
@Entity('expert_offers')
export class ExpertOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expert_id' })
  expert: User;

  @Index()
  @Column({ name: 'expert_id' })
  expertId: string;

  @Index()
  @Column({ type: 'enum', enum: DomainType })
  domainType: DomainType;

  @Column({ length: 60 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  /** 원 단위 정수. 전문가가 정한 가격이고, 의뢰인은 이 금액 그대로 결제한다. */
  @Column({ type: 'bigint' })
  price: number;

  @Column({ type: 'enum', enum: ServiceType, default: ServiceType.REMOTE })
  serviceType: ServiceType;

  /** 동행 상품이면 다닐 수 있는 지역(예: "서울·경기 남부"). 원격이면 비워 둔다. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  area: string | null;

  /** 보통 며칠 걸리는지(1~60). */
  @Column({ type: 'int', default: 3 })
  days: number;

  /** 상품 사진 URL (최대 4장, PNG/JPG). 저장은 기존 업로드 저장소(매직바이트 검증 포함)를 쓴다. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  images: string[];

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.ACTIVE })
  status: OfferStatus;

  /** 이 상품으로 들어온 의뢰 수(결제 대기 포함). 목록 정렬과 카드 숫자에 쓴다. */
  @Column({ name: 'order_count', type: 'int', default: 0 })
  orderCount: number;

  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
