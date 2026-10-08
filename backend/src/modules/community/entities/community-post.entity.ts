import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DomainType } from '../../../common/enums/domain-type.enum';

/** 게시판 분류. NOTICE(공지)는 관리자만 쓸 수 있다. */
export enum PostCategory {
  REVIEW = 'REVIEW', // 거래 후기
  QUESTION = 'QUESTION', // 질문과 답변
  WARNING = 'WARNING', // 사기·주의 사례
  TIP = 'TIP', // 꿀팁·정보
  NOTICE = 'NOTICE', // 공지 (관리자)
}

/**
 * 커뮤니티 게시글. 익명 기능은 일부러 두지 않는다 - 작성자 이름과 전문가 인증 여부가
 * 항상 함께 보여야 글의 신뢰도를 판단할 수 있기 때문이다(거래 사례와 같은 투명성 원칙).
 */
@Entity('community_posts')
export class CommunityPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Index()
  @Column({ name: 'author_id' })
  authorId: string;

  @Index()
  @Column({ type: 'enum', enum: PostCategory })
  category: PostCategory;

  @Column({ type: 'enum', enum: DomainType, nullable: true })
  domainType: DomainType | null;

  @Column({ length: 120 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  /** 첨부 이미지 경로 (/uploads/...). 최대 4장 */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  imageUrls: string[];

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
