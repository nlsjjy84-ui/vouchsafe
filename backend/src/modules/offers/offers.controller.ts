import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { STORAGE_SERVICE, StorageService } from '../../storage/storage.interface';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MAX_OFFER_IMAGES, OffersService } from './offers.service';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { ReportOfferDto, ResolveReportDto } from './dto/report-offer.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferMessageDto } from './dto/offer-message.dto';
import { OrderOfferDto } from './dto/order-offer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DomainType } from '../../common/enums/domain-type.enum';

const WRITE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 사진 1장 5MB
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

/**
 * 전문가 상품 게시판. 커뮤니티 게시판과 따로 둔다 — 상품 홍보 글이 커뮤니티를 덮지 않게.
 * 읽기는 누구나, 상품 올리기·문의·의뢰는 로그인 필요. 쓰기는 분당 10회로 묶고,
 * 서비스 안에서 전문가당 상품 수·올리는 간격·시간당 문의 수를 한 번 더 막는다.
 */
@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(
    private readonly service: OffersService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  @Get()
  list(@Query('domain') domain?: string, @Query('sort') sort?: string) {
    const dom = domain && (Object.values(DomainType) as string[]).includes(domain) ? (domain as DomainType) : undefined;
    const order = sort === 'cheap' || sort === 'popular' ? sort : 'latest';
    return this.service.list({ domain: dom, sort: order });
  }

  /** [관리자] 처리 대기 신고 목록 */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('reports/open')
  openReports() {
    return this.service.openReports();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('reports/:reportId/resolve')
  resolveReport(@Param('reportId', ParseUUIDPipe) reportId: string, @Body() dto: ResolveReportDto) {
    return this.service.resolveReport(reportId, dto.action);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@CurrentUser() user: { userId: string }) {
    return this.service.mine(user.userId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateOfferDto) {
    return this.service.create(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post(':id/messages')
  addMessage(@CurrentUser() user: { userId: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferMessageDto) {
    return this.service.addMessage(user.userId, id, dto.content);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post(':id/close')
  close(@CurrentUser() user: { userId: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.close(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post(':id/order')
  order(@CurrentUser() user: { userId: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OrderOfferDto) {
    return this.service.order(user.userId, id, dto.note);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  update(@CurrentUser() user: { userId: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOfferDto) {
    return this.service.update(user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post(':id/reopen')
  reopen(@CurrentUser() user: { userId: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.reopen(user.userId, id);
  }

  /** 상품 사진 추가 (PNG/JPG, 1장 5MB, 상품당 4장). 저장소가 매직바이트로 실제 이미지인지 한 번 더 확인한다. */
  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', MAX_OFFER_IMAGES, { storage: memoryStorage(), limits: { fileSize: IMAGE_MAX_BYTES } }))
  async addImages(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) throw new BadRequestException('사진을 골라 주세요');
    const urls: string[] = [];
    for (const f of files) {
      const dot = f.originalname.lastIndexOf('.');
      const ext = dot >= 0 ? f.originalname.slice(dot).toLowerCase() : '';
      if (!IMAGE_EXTENSIONS.includes(ext)) throw new BadRequestException('상품 사진은 PNG, JPG만 올릴 수 있어요');
      urls.push(await this.storage.saveFile(f.originalname, f.buffer, IMAGE_MAX_BYTES));
    }
    return this.service.addImages(user.userId, id, urls);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Delete(':id/images/:index')
  removeImage(
    @CurrentUser() user: { userId: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.service.removeImage(user.userId, id, index);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post(':id/report')
  report(@CurrentUser() user: { userId: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportOfferDto) {
    return this.service.report(user.userId, id, dto.reason, dto.detail, dto.messageId);
  }
}
