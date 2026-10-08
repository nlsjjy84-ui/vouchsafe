import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommunityService, buildCommentTree, buildExcerpt, CommentView } from './community.service';
import { PostCategory } from './entities/community-post.entity';
import { UserRole } from '../../common/enums/user-role.enum';

const view = (id: string, parentId: string | null): CommentView => ({
  id, parentId, content: id, deleted: false,
  author: { id: 'u', name: 'n', role: UserRole.CLIENT, verifiedDomains: [] },
  isPostAuthor: false, isExpertAnswer: false, createdAt: new Date(), replies: [],
});

function build(opts: { comment?: any; replyCount?: number; like?: any; post?: any } = {}) {
  const posts: any = {
    findOne: jest.fn().mockResolvedValue('post' in opts ? opts.post : { id: 'p1', authorId: 'author' }),
    create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: 'new', ...x })), delete: jest.fn(),
  };
  const comments: any = {
    findOne: jest.fn().mockResolvedValue(opts.comment ?? null),
    count: jest.fn().mockResolvedValue(opts.replyCount ?? 0),
    create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: 'c-new', ...x })),
    update: jest.fn(), delete: jest.fn(),
  };
  const likes: any = {
    findOne: jest.fn().mockResolvedValue(opts.like ?? null),
    create: jest.fn((x) => x), save: jest.fn(), delete: jest.fn(), count: jest.fn().mockResolvedValue(3),
  };
  const svc = new CommunityService(posts, comments, likes, {} as any, {} as any);
  return { svc, posts, comments, likes };
}

describe('buildCommentTree', () => {
  it('대댓글을 원 댓글 아래로 묶는다', () => {
    const tree = buildCommentTree([view('a', null), view('b', 'a'), view('c', null), view('d', 'a')]);
    expect(tree.map((t) => t.id)).toEqual(['a', 'c']);
    expect(tree[0].replies.map((r) => r.id)).toEqual(['b', 'd']);
  });
  it('부모를 찾을 수 없으면 최상위로 올려 사라지지 않게 한다', () => {
    expect(buildCommentTree([view('x', 'missing')]).map((t) => t.id)).toEqual(['x']);
  });
});

describe('buildExcerpt', () => {
  it('줄바꿈을 공백으로 합치고 길면 줄인다', () => {
    expect(buildExcerpt('a\n\nb')).toBe('a b');
    expect(buildExcerpt('가'.repeat(200)).endsWith('…')).toBe(true);
  });
});

describe('CommunityService', () => {
  it('공지는 관리자만 쓸 수 있다', async () => {
    const { svc } = build();
    await expect(svc.create({ userId: 'u', role: UserRole.CLIENT }, { category: PostCategory.NOTICE, title: 'tt', content: 'content' } as any, [])).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.create({ userId: 'a', role: UserRole.ADMIN }, { category: PostCategory.NOTICE, title: 'tt', content: 'content' } as any, [])).resolves.toBeDefined();
  });

  it('이미지는 4장을 넘길 수 없다', async () => {
    const { svc } = build();
    await expect(svc.create({ userId: 'u', role: UserRole.CLIENT }, { category: PostCategory.TIP, title: 'tt', content: 'content' } as any, ['1', '2', '3', '4', '5'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('대댓글에 다시 답하면 같은 원 댓글 아래로 모은다', async () => {
    const { svc, comments } = build({ comment: { id: 'reply1', postId: 'p1', parentId: 'root1', deletedAt: null } });
    await svc.addComment('u', 'p1', ' 답글 ', 'reply1');
    expect(comments.save).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'root1', content: '답글' }));
  });

  it('삭제된 댓글에는 답글을 달 수 없다', async () => {
    const { svc } = build({ comment: { id: 'c', postId: 'p1', parentId: null, deletedAt: new Date() } });
    await expect(svc.addComment('u', 'p1', 'x', 'c')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('남의 댓글은 지울 수 없고, 관리자는 지울 수 있다', async () => {
    const { svc } = build({ comment: { id: 'c', authorId: 'other' } });
    await expect(svc.removeComment({ userId: 'u', role: UserRole.CLIENT }, 'c')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.removeComment({ userId: 'a', role: UserRole.ADMIN }, 'c')).resolves.toEqual({ deleted: true, soft: false });
  });

  it('대댓글이 달린 댓글은 내용만 지운다(soft delete)', async () => {
    const { svc, comments } = build({ comment: { id: 'c', authorId: 'u' }, replyCount: 2 });
    await expect(svc.removeComment({ userId: 'u', role: UserRole.CLIENT }, 'c')).resolves.toEqual({ deleted: true, soft: true });
    expect(comments.update).toHaveBeenCalled();
    expect(comments.delete).not.toHaveBeenCalled();
  });

  it('남의 글은 지울 수 없다', async () => {
    const { svc } = build({ post: { id: 'p1', authorId: 'author' } });
    await expect(svc.remove({ userId: 'u', role: UserRole.CLIENT }, 'p1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('좋아요는 누르면 켜지고 다시 누르면 꺼진다', async () => {
    const on = build();
    expect((await on.svc.toggleLike('u', 'p1')).liked).toBe(true);
    const off = build({ like: { id: 'l1' } });
    expect((await off.svc.toggleLike('u', 'p1')).liked).toBe(false);
    expect(off.likes.delete).toHaveBeenCalled();
  });
});
