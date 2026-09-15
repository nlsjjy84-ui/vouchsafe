import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SafeNumberMapping } from './entities/safe-number-mapping.entity';
import { MockSafeNumberService } from '../../mocks/mock-safe-number.service';
import { Bounty } from '../bounties/entities/bounty.entity';
import { ServiceType } from '../../common/enums/service-type.enum';
import { BountyStatus } from '../../common/enums/bounty-status.enum';

/**
 * 동행(COMPANION) 서비스에서 의뢰인/전문가에게 안심번호를 발급하고 조회하는 서비스.
 * 실제 전화번호는 이 서비스도, DB도 전혀 모른다 — Mock 단계는 "매핑 레코드가 있다/없다"와
 * "누가 조회할 수 있는가"라는 접근 제어 로직만 실제로 동작시키고, 실제 착신 중계는
 * MockSafeNumberService가 실 통신사 연동으로 바뀔 때 함께 채워질 자리다.
 */
@Injectable()
export class SafeNumberService {
  constructor(
    @InjectRepository(SafeNumberMapping)
    private readonly safeNumberRepository: Repository<SafeNumberMapping>,
    private readonly mockSafeNumber: MockSafeNumberService,
  ) {}

  async getOrCreateForBounty(bounty: Bounty, requesterId: string): Promise<SafeNumberMapping> {
    if (bounty.serviceType !== ServiceType.COMPANION) {
      throw new BadRequestException('동행(COMPANION) 서비스 바운티만 안심번호를 발급할 수 있습니다');
    }
    if (bounty.status === BountyStatus.PENDING || !bounty.assignedExpertId) {
      throw new BadRequestException('전문가가 확정(LOCKED 이상)된 바운티만 안심번호를 발급할 수 있습니다');
    }
    if (requesterId !== bounty.clientId && requesterId !== bounty.assignedExpertId) {
      throw new ForbiddenException('이 바운티의 의뢰인 또는 담당 전문가만 조회할 수 있습니다');
    }

    let mapping = await this.safeNumberRepository.findOne({ where: { bountyId: bounty.id } });
    if (mapping) return mapping;

    const clientSafeNumber = this.mockSafeNumber.generateSafeNumber(
      `${bounty.id}:client:${bounty.clientId}`,
    );
    const expertSafeNumber = this.mockSafeNumber.generateSafeNumber(
      `${bounty.id}:expert:${bounty.assignedExpertId}`,
    );
    mapping = this.safeNumberRepository.create({
      bountyId: bounty.id,
      clientSafeNumber,
      expertSafeNumber,
    });
    return this.safeNumberRepository.save(mapping);
  }
}
