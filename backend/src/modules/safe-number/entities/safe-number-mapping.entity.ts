import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 프로젝트 하나(동행 서비스)당 의뢰인/전문가 각각에게 부여된 안심번호 매핑.
 * bountyId에 unique 제약을 걸어 같은 프로젝트에 중복 발급되지 않게 한다.
 */
@Entity('safe_number_mappings')
export class SafeNumberMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  bountyId: string;

  @Column()
  clientSafeNumber: string;

  @Column()
  expertSafeNumber: string;

  @CreateDateColumn()
  createdAt: Date;
}
