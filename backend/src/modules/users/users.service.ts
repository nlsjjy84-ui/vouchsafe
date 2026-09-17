import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 이메일은 대소문자를 구분하지 않고 찾는다 (일반적인 서비스 관례).
   * create()에서 항상 소문자로 저장하므로, 조회할 때도 소문자로 맞춰서 비교한다.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  create(partial: Partial<User>): Promise<User> {
    const normalized = partial.email
      ? { ...partial, email: partial.email.trim().toLowerCase() }
      : partial;
    const user = this.userRepository.create(normalized);
    return this.userRepository.save(user);
  }

  /** 실명 대사(마이데이터, 7장) 검사용 - 이 CI가 이미 다른 계정에 쓰였는지 확인 */
  findByCiHash(ciHash: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { ciHash } });
  }

  /** 이메일 인증 완료 처리 (Phase 2 AuthToken 플로우에서 호출) */
  async markEmailVerified(userId: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { emailVerifiedAt: new Date() });
  }

  /** 비밀번호 재설정 완료 처리. 호출 전에 이미 새 비밀번호를 해시해서 넘겨야 한다 */
  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { passwordHash });
  }

  /**
   * "AI 기반 개인화 예산 및 소비패턴 분석" 기능용 - 월 지출 예산 목표 설정/해제.
   * null을 넘기면 예산 목표를 해제한다 (AiInsightsService가 이 경우 예산 인사이트를 건너뛴다).
   */
  async updateMonthlyBudgetGoal(userId: string, monthlyBudgetGoal: number | null): Promise<void> {
    await this.userRepository.update({ id: userId }, { monthlyBudgetGoal });
  }
}
