import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { CommunityPost, PostCategory } from './entities/community-post.entity';
import { CommunityComment } from './entities/community-comment.entity';
import { CommunityLike } from './entities/community-like.entity';
import { User } from '../users/entities/user.entity';
import { Certification } from '../certifications/entities/certification.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { DomainType } from '../../common/enums/domain-type.enum';
import { VerificationStatus } from '../../common/enums/verification-track.enum';
import { CreatePostDto } from './dto/create-post.dto';

export interface AuthorInfo {
  id: string;
  name: string;
  role: UserRole;
  /** 승인(APPROVED)된 전문가 인증 분야. 비어 있으면 인증 전문가가 아님 */
  verifiedDomains: DomainType[];
}

export interface PostSummary {
  id: string;
  category: PostCategory;
  domainType: DomainType | null;
  title: string;
  excerpt: string;
  thumbnail: string | null;
  imageCount: number;
  author: AuthorInfo;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
}

export interface CommentView {
  id: string;
  parentId: string | null;
  content: string;
  deleted: boolean;
  author: AuthorInfo;
  isPostAuthor: boolean;
  /** 글의 분야에서 인증받은 전문가가 쓴 답변인지 */
  isExpertAnswer: boolean;
  createdAt: Date;
  replies: CommentView[];
}

export const MAX_IMAGES = 4;
const PAGE_SIZE = 15;

export function buildExcerpt(content: string, max = 110): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/**
 * 댓글 평면 목록 → 2단계 트리. 부모가 없거나(삭제 등) 부모가 이미 대댓글인 항목은
 * 최상위 댓글로 올려 화면에서 사라지지 않게 한다.
 */
export function buildCommentTree(rows: CommentView[]): CommentView[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const roots: CommentView[] = [];
  for (const r of rows) {
    const parent = r.parentId ? byId.get(r.parentId) : undefined;
    if (parent && !parent.parentId) parent.replies.push(r);
    else roots.push(r);
  }
  return roots;
}

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(CommunityPost) private readonly posts: Repository<CommunityPost>,
    @InjectRepository(CommunityComment) private readonly comments: Repository<CommunityComment>,
    @InjectRepository(CommunityLike) private readonly likes: Repository<CommunityLike>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Certification) private readonly certs: Repository<Certification>,
  ) {}

  /** 작성자 정보(이름·역할·승인된 인증 분야)를 한 번에 묶어 가져온다 */
  private async authorMap(ids: string[]): Promise<Map<string, AuthorInfo>> {
    const unique = [...new Set(ids)];
    const map = new Map<string, AuthorInfo>();
    if (!unique.length) return map;
    const [users, certs] = await Promise.all([
      this.users.find({ where: { id: In(unique) } }),
      this.certs.find({ where: { userId: In(unique), verifiedStatus: VerificationStatus.APPROVED } }),
    ]);
    for (const u of users) map.set(u.id, { id: u.id, name: u.name, role: u.role, verifiedDomains: [] });
    for (const c of certs) {
      const info = map.get(c.userId);
      if (info && !info.verifiedDomains.includes(c.domainType)) info.verifiedDomains.push(c.domainType);
    }
    return map;
  }

  private unknownAuthor(id: string): AuthorInfo {
    return { id, name: '탈퇴한 사용자', role: UserRole.CLIENT, verifiedDomains: [] };
  }

  async list(opts: {
    category?: PostCategory;
    domain?: DomainType;
    q?: string;
    sort?: 'latest' | 'popular';
    page?: number;
  }) {
    const page = Math.max(1, Number(opts.page) || 1);
    const qb = this.posts.createQueryBuilder('p');
    if (opts.category) qb.andWhere('p.category = :cat', { cat: opts.category });
    if (opts.domain) qb.andWhere('p.domainType = :dom', { dom: opts.domain });
    const q = opts.q?.trim();
    if (q) qb.andWhere('(p.title ILIKE :q OR p.content ILIKE :q)', { q: `%${q.replace(/[%_]/g, '\\$&')}%` });
    // 공지는 항상 맨 위
    qb.addSelect(`CASE WHEN p.category = 'NOTICE' THEN 0 ELSE 1 END`, 'notice_rank').orderBy('notice_rank', 'ASC');
    if (opts.sort === 'popular') qb.addOrderBy('p.viewCount', 'DESC').addOrderBy('p.createdAt', 'DESC');
    else qb.addOrderBy('p.createdAt', 'DESC');
    qb.skip((page - 1) * PAGE_SIZE).take(PAGE_SIZE);
    const [rows, total] = await qb.getManyAndCount();

    const ids = rows.map((r) => r.id);
    const [authors, likeRows, commentRows] = await Promise.all([
      this.authorMap(rows.map((r) => r.authorId)),
      ids.length
        ? this.likes.createQueryBuilder('l').select('l.postId', 'postId').addSelect('COUNT(*)', 'n').where('l.postId IN (:...ids)', { ids }).groupBy('l.postId').getRawMany()
        : [],
      ids.length
        ? this.comments.createQueryBuilder('c').select('c.postId', 'postId').addSelect('COUNT(*)', 'n').where('c.postId IN (:...ids)', { ids }).andWhere('c.deletedAt IS NULL').groupBy('c.postId').getRawMany()
        : [],
    ]);
    const likeBy = new Map<string, number>(likeRows.map((r: any): [string, number] => [r.postId, Number(r.n)]));
    const comBy = new Map<string, number>(commentRows.map((r: any): [string, number] => [r.postId, Number(r.n)]));

    const items: PostSummary[] = rows.map((p) => ({
      id: p.id,
      category: p.category,
      domainType: p.domainType,
      title: p.title,
      excerpt: buildExcerpt(p.content),
      thumbnail: p.imageUrls?.[0] ?? null,
      imageCount: p.imageUrls?.length ?? 0,
      author: authors.get(p.authorId) ?? this.unknownAuthor(p.authorId),
      viewCount: p.viewCount,
      likeCount: likeBy.get(p.id) ?? 0,
      commentCount: comBy.get(p.id) ?? 0,
      createdAt: p.createdAt,
    }));
    return { items, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  }

  async get(id: string, viewerId?: string) {
    const post = await this.posts.findOne({ where: { id } }).catch(() => null);
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');
    await this.posts.increment({ id }, 'viewCount', 1);
    post.viewCount += 1;
    const authors = await this.authorMap([post.authorId]);
    const [likeCount, commentCount, mine] = await Promise.all([
      this.likes.count({ where: { postId: id } }),
      this.comments.count({ where: { postId: id, deletedAt: IsNull() } }),
      viewerId ? this.likes.findOne({ where: { postId: id, userId: viewerId } }) : null,
    ]);
    return {
      id: post.id,
      category: post.category,
      domainType: post.domainType,
      title: post.title,
      content: post.content,
      imageUrls: post.imageUrls ?? [],
      author: authors.get(post.authorId) ?? this.unknownAuthor(post.authorId),
      viewCount: post.viewCount,
      likeCount,
      commentCount,
      likedByMe: !!mine,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  async create(user: { userId: string; role: UserRole }, dto: CreatePostDto, imageUrls: string[]) {
    if (dto.category === PostCategory.NOTICE && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('공지는 관리자만 작성할 수 있습니다');
    }
    if (imageUrls.length > MAX_IMAGES) throw new BadRequestException(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다`);
    const post = this.posts.create({
      authorId: user.userId,
      category: dto.category,
      domainType: dto.domainType ? (dto.domainType as DomainType) : null,
      title: dto.title.trim(),
      content: dto.content.trim(),
      imageUrls,
    });
    return this.posts.save(post);
  }

  async remove(user: { userId: string; role: UserRole }, id: string) {
    const post = await this.posts.findOne({ where: { id } }).catch(() => null);
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');
    if (post.authorId !== user.userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('본인이 쓴 글만 삭제할 수 있습니다');
    }
    await this.likes.delete({ postId: id });
    await this.posts.delete({ id });
    return { deleted: true };
  }

  async toggleLike(userId: string, postId: string) {
    const post = await this.posts.findOne({ where: { id: postId }, select: ['id'] }).catch(() => null);
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');
    const existing = await this.likes.findOne({ where: { postId, userId } });
    if (existing) await this.likes.delete({ id: existing.id });
    else await this.likes.save(this.likes.create({ postId, userId }));
    const likeCount = await this.likes.count({ where: { postId } });
    return { liked: !existing, likeCount };
  }

  async listComments(postId: string): Promise<CommentView[]> {
    const post = await this.posts.findOne({ where: { id: postId } }).catch(() => null);
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');
    const rows = await this.comments.find({ where: { postId }, order: { createdAt: 'ASC' } });
    const authors = await this.authorMap(rows.map((r) => r.authorId));
    const views: CommentView[] = rows.map((r) => {
      const author = authors.get(r.authorId) ?? this.unknownAuthor(r.authorId);
      const deleted = !!r.deletedAt;
      return {
        id: r.id,
        parentId: r.parentId,
        content: deleted ? '' : r.content,
        deleted,
        author,
        isPostAuthor: r.authorId === post.authorId,
        isExpertAnswer: !!post.domainType && author.verifiedDomains.includes(post.domainType),
        createdAt: r.createdAt,
        replies: [],
      };
    });
    return buildCommentTree(views);
  }

  async addComment(userId: string, postId: string, content: string, parentId?: string) {
    const post = await this.posts.findOne({ where: { id: postId }, select: ['id'] }).catch(() => null);
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');
    let rootParent: string | null = null;
    if (parentId) {
      const parent = await this.comments.findOne({ where: { id: parentId, postId } });
      if (!parent) throw new BadRequestException('답글을 달 댓글을 찾을 수 없습니다');
      if (parent.deletedAt) throw new BadRequestException('삭제된 댓글에는 답글을 달 수 없습니다');
      // 대댓글에 다시 답하면 같은 원 댓글 아래로 모은다 (2단계 유지)
      rootParent = parent.parentId ?? parent.id;
    }
    const saved = await this.comments.save(this.comments.create({ postId, authorId: userId, parentId: rootParent, content: content.trim() }));
    return { id: saved.id };
  }

  async removeComment(user: { userId: string; role: UserRole }, commentId: string) {
    const c = await this.comments.findOne({ where: { id: commentId } }).catch(() => null);
    if (!c) throw new NotFoundException('댓글을 찾을 수 없습니다');
    if (c.authorId !== user.userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('본인이 쓴 댓글만 삭제할 수 있습니다');
    }
    const hasReplies = await this.comments.count({ where: { parentId: c.id } });
    if (hasReplies) {
      await this.comments.update({ id: c.id }, { deletedAt: new Date(), content: '' });
      return { deleted: true, soft: true };
    }
    await this.comments.delete({ id: c.id });
    return { deleted: true, soft: false };
  }
}
