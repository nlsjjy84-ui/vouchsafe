import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityComment } from './entities/community-comment.entity';
import { CommunityLike } from './entities/community-like.entity';
import { User } from '../users/entities/user.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([CommunityPost, CommunityComment, CommunityLike, User, Certification]), StorageModule],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
