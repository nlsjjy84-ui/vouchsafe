import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 기획서 확장 - 안심전화번호(가상번호) 기능.
 *
 * 배달앱/중고거래 앱의 "안심번호"와 동일한 개념: 의뢰인과 전문가가 서로의 진짜
 * 전화번호를 모른 채, 둘만 이어주는 가상번호 하나를 통해 연락한다.
 *
 * 바운티 하나(정확히는 client-expert 매칭 하나)당 가상번호 하나를 발급하고,
 * 바운티가 끝나도 기록은 남겨두되(정산/분쟁 이력 추적 목적 - 감사 로그와 같은 원리),
 * "지금 이 번호가 아직 살아있는지"는 조회 시점에 바운티 상태를 같이 보고 판단한다
 * (BountiesService.getOrCreateSafeNumber 참고) - 매번 별도로 비활성화 처리를
 * 여기저기서 호출하지 않아도 되게 하기 위한 설계.
 */
@Entity('safe_number_mappings')
export class SafeNumberMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 바운티 하나당 매핑 하나만 존재해야 한다 (재발급이 아니라 재사용).
  @Column({ name: 'bounty_id', unique: true })
  bountyId: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @Column({ name: 'expert_id' })
  expertId: string;

  // 실제 서비스라면 통신사/안심번호 API(예: NHN Cloud 070 안심번호)가 발급하는 값.
  // Mock에서는 "050-XXXX-XXXX" 형식의 가짜 번호를 임의 생성한다.
  @Column({ name: 'safe_number' })
  safeNumber: string;

  @CreateDateColumn()
  createdAt: Date;
}
