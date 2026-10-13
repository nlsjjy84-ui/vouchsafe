import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ExpertOffer } from './expert-offer.entity';

/** 상품마다 달리는 문의·답변. 커뮤니티 게시판과 섞이지 않게 상품 안에서만 보인다. */
@Entity('offer_messages')
export class OfferMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ExpertOffer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' })
  offer: ExpertOffer;

  @Index()
  @Column({ name: 'offer_id' })
  offerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Index()
  @Column({ name: 'author_id' })
  authorId: string;

  @Column({ type: 'text' })
  content: string;

  /** 신고 처리로 관리자가 가린 시각. 가린 문의는 내용 대신 "관리자가 가린 문의"로 보인다. */
  @Column({ name: 'hidden_at', type: 'timestamptz', nullable: true })
  hiddenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
