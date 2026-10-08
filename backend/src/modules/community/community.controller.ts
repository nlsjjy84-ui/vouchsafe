import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { CommunityService, MAX_IMAGES } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PostCategory } from './entities/community-post.entity';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DomainType } from '../../common/enums/domain-type.enum';
import { STORAGE_SERVICE, StorageService } from '../../storage/storage.interface';

const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 게시글 이미지 1장당 5MB
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
const WRITE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

/**
 * 커뮤니티 게시판. 읽기는 로그인 없이 누구나(공개), 쓰기·댓글·좋아요는 로그인 필요.
 * 이미지는 기존 업로드 저장소(STORAGE_SERVICE)를 그대로 쓰므로 매직바이트 검증과
 * Mock/S3 전환이 자동으로 적용된다. 게시글 이미지는 PNG/JPG만 허용한다.
 */
@ApiTags('community')
@Controller('community')
export class CommunityController {
  constructor(
    private readonly service: CommunityService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  @Get('posts')
  list(
    @Query('category') category?: string,
    @Query('domain') domain?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
  ) {
    const cat = category && (Object.values(PostCategory) as string[]).includes(category) ? (category as PostCategory) : undefined;
    const dom = domain && (Object.values(DomainType) as string[]).includes(domain) ? (domain as DomainType) : undefined;
    return this.service.list({ category: cat, domain: dom, q, sort: sort === 'popular' ? 'popular' : 'latest', page: Number(page) || 1 });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('posts/:id')
  get(@Param('id') id: string, @CurrentUser() user: { userId: string } | null) {
    return this.service.get(id, user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post('posts')
  @UseInterceptors(FilesInterceptor('images', MAX_IMAGES, { storage: memoryStorage(), limits: { fileSize: IMAGE_MAX_BYTES } }))
  async create(
    @CurrentUser() user: { userId: string; role: any },
    @Body() dto: CreatePostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const urls: string[] = [];
    for (const f of files ?? []) {
      const dot = f.originalname.lastIndexOf('.');
      const ext = dot >= 0 ? f.originalname.slice(dot).toLowerCase() : '';
      if (!IMAGE_EXTENSIONS.includes(ext)) {
        throw new BadRequestException('게시글에는 PNG, JPG 이미지만 첨부할 수 있습니다');
      }
      urls.push(await this.storage.saveFile(f.originalname, f.buffer, IMAGE_MAX_BYTES));
    }
    const post = await this.service.create(user, dto, urls);
    return { id: post.id };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:id')
  remove(@CurrentUser() user: { userId: string; role: any }, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post('posts/:id/like')
  like(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.service.toggleLike(user.userId, id);
  }

  @Get('posts/:id/comments')
  comments(@Param('id') id: string) {
    return this.service.listComments(id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post('posts/:id/comments')
  addComment(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    return this.service.addComment(user.userId, id, dto.content, dto.parentId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:id')
  removeComment(@CurrentUser() user: { userId: string; role: any }, @Param('id') id: string) {
    return this.service.removeComment(user, id);
  }
}
