import { User } from '../users/entities/user.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiRunnerService } from './ai-runner.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { AiExecution } from './entities/ai-execution.entity';
import { BountyRequirementSet } from './entities/bounty-requirement-set.entity';
import { Bounty } from '../bounties/entities/bounty.entity';
import { BountyApplication } from '../bounties/entities/bounty-application.entity';
import { BountySubmission } from '../bounties/entities/bounty-submission.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiExecution,
      BountyRequirementSet,
      Bounty,
      BountyApplication,
      BountySubmission,
      Certification,
      Dispute,
      User,
    ]),
    UsersModule,
  ],
  controllers: [AiController],
  providers: [AiService, AiRunnerService, AnthropicProvider, OpenAiProvider, GeminiProvider],
  exports: [AiService],
})
export class AiModule {}
