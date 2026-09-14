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

  /** 비밀번호 재설정 성공 시, 새 해시로 교체 */
  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { passwordHash });
  }

  /** 이메일 인증 성공 시, 인증 시각 기록 */
  async markEmailVerified(userId: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { emailVerifiedAt: new Date() });
  }

  /** 안심번호 발급 등 연락처가 필요한 기능을 위해 본인 전화번호를 등록/수정 */
  async updatePhoneNumber(userId: string, phoneNumber: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { phoneNumber });
  }
}
