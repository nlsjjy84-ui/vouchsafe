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

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  create(partial: Partial<User>): Promise<User> {
    const user = this.userRepository.create(partial);
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
}
