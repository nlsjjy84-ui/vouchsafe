import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AlertPreference } from './entities/alert-preference.entity';
import { Notification } from './entities/notification.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { Bounty } from '../bounties/entities/bounty.entity';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { DomainType, DOMAIN_LABELS } from '../../common/enums/domain-type.enum';
import { VerificationStatus } from '../../common/enums/verification-track.enum';
import { SetAlertPreferenceDto } from './dto/set-alert-preference.dto';

const MAX_RECIPIENTS = 300;

type Pref = Pick<AlertPreference, 'enabled' | 'domains' | 'minAmount'>;

/**
 * 새 프로젝트가 올라왔을 때 이 전문가에게 알릴지. 인증받은 분야가 아니면 어떤 설정이어도 알리지 않는다
 * (지원 자체가 불가능한 프로젝트를 알려봐야 소음이다).
 */
export function shouldAlert(
  pref: Pref | null,
  bounty: { domainType: DomainType; bountyAmount: number | string },
  verifiedDomains: DomainType[],
): boolean {
  if (!verifiedDomains.includes(bounty.domainType)) return false;
  if (!pref) return true;
  if (!pref.enabled) return false;
  if (pref.domains.length > 0 && !pref.domains.includes(bounty.domainType)) return false;
  if (pref.minAmount != null && Number(bounty.bountyAmount) < pref.minAmount) return false;
  return true;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(AlertPreference) private readonly prefs: Repository<AlertPreference>,
    @InjectRepository(Certification) private readonly certs: Repository<Certification>,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  private async verifiedDomains(userId: string): Promise<DomainType[]> {
    const rows = await this.certs.find({ where: { userId, verifiedStatus: VerificationStatus.APPROVED } });
    return [...new Set(rows.map((r) => r.domainType))];
  }

  async getMine(userId: string) {
    const [pref, verifiedDomains] = await Promise.all([this.prefs.findOne({ where: { userId } }), this.verifiedDomains(userId)]);
    return {
      enabled: pref?.enabled ?? true,
      domains: (pref?.domains ?? []) as DomainType[],
      minAmount: pref?.minAmount ?? null,
      verifiedDomains,
      isDefault: !pref,
    };
  }

  async setMine(userId: string, dto: SetAlertPreferenceDto) {
    const verified = await this.verifiedDomains(userId);
    const domains = [...new Set(dto.domains)].filter((d) => verified.includes(d));
    const existing = await this.prefs.findOne({ where: { userId } });
    const row = existing ?? this.prefs.create({ userId });
    row.enabled = dto.enabled;
    row.domains = domains;
    row.minAmount = dto.minAmount ?? null;
    await this.prefs.save(row);
    return this.getMine(userId);
  }

  /**
   * 새 프로젝트가 등록되면 그 분야 인증 전문가 중 설정이 맞는 사람에게 알림을 보낸다.
   * 알림은 부가 기능이라 어떤 실패도 프로젝트 등록을 막지 않는다(예외를 삼킨다).
   */
  async notifyNewBounty(bounty: Bounty): Promise<number> {
    try {
      const certs = await this.certs.find({
        where: { domainType: bounty.domainType, verifiedStatus: VerificationStatus.APPROVED },
      });
      const userIds = [...new Set(certs.map((c) => c.userId))].filter((id) => id !== bounty.clientId).slice(0, MAX_RECIPIENTS);
      if (userIds.length === 0) return 0;
      const prefs = await this.prefs.find({ where: { userId: In(userIds) } });
      const prefBy = new Map(prefs.map((p) => [p.userId, p]));
      const targets = userIds.filter((id) => shouldAlert(prefBy.get(id) ?? null, bounty, [bounty.domainType]));
      if (targets.length === 0) return 0;
      const message = `내 인증 분야(${DOMAIN_LABELS[bounty.domainType]})에 새 프로젝트가 올라왔어요: "${bounty.title.slice(0, 60)}" · ${Number(bounty.bountyAmount).toLocaleString('ko-KR')}원`;
      await this.notifications.save(
        targets.map((userId) =>
          this.notifications.create({ userId, type: NotificationType.NEW_BOUNTY_IN_FIELD, message, relatedBountyId: bounty.id }),
        ),
      );
      return targets.length;
    } catch (err) {
      this.logger.error(`맞춤 알림 발송 실패 (프로젝트 등록에는 영향 없음): ${(err as Error).message}`);
      return 0;
    }
  }
}
