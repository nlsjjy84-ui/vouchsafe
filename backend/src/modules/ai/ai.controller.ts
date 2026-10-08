import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DomainType } from '../../common/enums/domain-type.enum';

type AuthUser = { userId: string; role: string };

class ConfirmRequirementsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  items: string[];
}

class PriceQueryDto {
  @IsEnum(DomainType)
  domainType: DomainType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  bountyId?: string;
}

class ReviewDraftDto {
  @IsNumber()
  @IsIn(Array.from({ length: 19 }, (_, i) => 1 + i * 0.5))
  rating: number;

  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  keywords: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  hint?: string;
}

class BountyDraftDto {
  @IsString()
  @MaxLength(800)
  idea: string;

  @IsOptional()
  @IsIn(['REMOTE', 'COMPANION'])
  serviceType?: string;
}

class RiskCheckDto {
  @IsString()
  @MaxLength(3000)
  text: string;

  @IsOptional()
  @IsIn(['BOUNTY', 'APPLICATION'])
  kind?: string;
}

// AI 호출은 비용이 드는 경로라 전역 한도(분당 60)보다 훨씬 빡빡하게 묶는다.
const AI_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('ai')
@ApiBearerAuth('JWT-auth')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  status() {
    return this.ai.status();
  }

  @Throttle(AI_THROTTLE)
  @Post('bounties/:id/requirements/draft')
  draft(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ai.draftRequirements(id, user);
  }

  @Put('bounties/:id/requirements')
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: ConfirmRequirementsDto) {
    return this.ai.confirmRequirements(id, user, dto.items);
  }

  @Get('bounties/:id/requirements')
  requirements(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ai.getRequirements(id, user);
  }

  @Throttle(AI_THROTTLE)
  @Get('bounties/:id/applicants/ranking')
  ranking(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ai.rankApplicants(id, user);
  }

  @Throttle(AI_THROTTLE)
  @Get('bounties/:id/expert-recommendations')
  expertRecs(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ai.recommendExperts(id, user);
  }

  @Throttle(AI_THROTTLE)
  @Get('recommended-bounties')
  bountyRecs(@CurrentUser() user: AuthUser) {
    return this.ai.recommendBounties(user);
  }

  @Throttle(AI_THROTTLE)
  @Post('bounties/:id/submission-check')
  check(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ai.checkSubmission(id, user);
  }

  @Throttle(AI_THROTTLE)
  @Post('disputes/:id/summary')
  dispute(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ai.summarizeDispute(id, user);
  }

  @Throttle(AI_THROTTLE)
  @Get('price-reference')
  price(@Query() q: PriceQueryDto, @CurrentUser() user: AuthUser) {
    return this.ai.priceReference(q.domainType, q.amount ?? null, user, q.bountyId);
  }

  @Throttle(AI_THROTTLE)
  @Post('bounties/:id/milestone-draft')
  milestones(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ai.draftMilestones(id, user);
  }

  @Throttle(AI_THROTTLE)
  @Post('bounties/:id/review-draft')
  reviewDraft(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDraftDto, @CurrentUser() user: AuthUser) {
    return this.ai.draftReview(id, dto, user);
  }

  @Throttle(AI_THROTTLE)
  @Get('experts/:id/review-summary')
  reviewSummary(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ai.summarizeExpertReviews(id, user);
  }

  @Throttle(AI_THROTTLE)
  @Post('bounty-draft')
  bountyDraft(@Body() dto: BountyDraftDto, @CurrentUser() user: AuthUser) {
    return this.ai.draftBounty(dto.idea, dto.serviceType ?? 'REMOTE', user);
  }

  @Throttle(AI_THROTTLE)
  @Post('risk-check')
  riskCheck(@Body() dto: RiskCheckDto, @CurrentUser() user: AuthUser) {
    return this.ai.checkRisk(dto.text, dto.kind ?? 'BOUNTY', user);
  }

  @Get('bounties/:id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.ai.history(id);
  }
}
