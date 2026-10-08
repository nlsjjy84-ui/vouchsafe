'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Heart, MessageSquare, Trash2, CornerDownRight, BadgeCheck, X } from 'lucide-react';
import { api, extractErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { DOMAIN_LABELS } from '@/lib/types';
import { CommunityComment, PostDetail, timeAgo } from '@/lib/community-types';
import { AuthorChip, CategoryBadge } from '@/components/CommunityBits';
import { FIELD_INPUT_CLASS, FormErrorText } from '@/components/FormControls';

function CommentBox({
  placeholder,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  placeholder: string;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await onSubmit(text.trim());
      setText('');
    } catch (e2) {
      setErr(extractErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={FIELD_INPUT_CLASS}
      />
      {err && <FormErrorText>{err}</FormErrorText>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink-500 hover:bg-surface-raised">
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-full bg-brand-clay px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {busy ? '등록 중...' : '등록'}
        </button>
      </div>
    </form>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    const res = await api.get<CommunityComment[]>(`/community/posts/${id}/comments`);
    setComments(res.data);
  }, [id]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.get<PostDetail>(`/community/posts/${id}`), api.get<CommunityComment[]>(`/community/posts/${id}/comments`)])
      .then(([p, c]) => {
        if (!alive) return;
        setPost(p.data);
        setComments(c.data);
      })
      .catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, user?.id]);

  async function toggleLike() {
    if (!user || !post) return;
    setError(null);
    try {
      const res = await api.post<{ liked: boolean; likeCount: number }>(`/community/posts/${id}/like`);
      setPost({ ...post, likedByMe: res.data.liked, likeCount: res.data.likeCount });
    } catch (e) {
      setError(extractErrorMessage(e));
    }
  }

  async function removePost() {
    if (!post) return;
    if (!window.confirm('이 글을 삭제할까요? 되돌릴 수 없어요.')) return;
    try {
      await api.delete(`/community/posts/${id}`);
      router.push('/community');
    } catch (e) {
      setError(extractErrorMessage(e));
    }
  }

  async function addComment(content: string, parentId?: string) {
    await api.post(`/community/posts/${id}/comments`, { content, ...(parentId ? { parentId } : {}) });
    setReplyTo(null);
    await loadComments();
    setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
  }

  async function removeComment(cid: string) {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    try {
      await api.delete(`/community/comments/${cid}`);
      await loadComments();
      setPost((p) => (p ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
    } catch (e) {
      setError(extractErrorMessage(e));
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-4xl bg-surface-raised" />;
  if (notFound || !post) {
    return (
      <div className="rounded-4xl border border-hairline bg-surface-canvas p-10 text-center">
        <p className="text-sm text-ink-600">글을 찾을 수 없어요. 삭제되었거나 주소가 잘못됐을 수 있어요.</p>
        <Link href="/community" className="mt-3 inline-block text-sm font-semibold text-brand-clay hover:underline">목록으로</Link>
      </div>
    );
  }

  const canDeletePost = !!user && (user.id === post.author.id || user.role === 'ADMIN');

  const renderComment = (c: CommunityComment, isReply: boolean) => (
    <li key={c.id} className={isReply ? 'ml-6 border-l-2 border-hairline pl-4 sm:ml-10' : ''}>
      <div className={`rounded-2xl p-4 ${c.isExpertAnswer ? 'border border-brand-clay/30 bg-tint-clay/40' : 'bg-surface-raised'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <AuthorChip author={c.author} size={24} linkProfile />
          {c.isPostAuthor && <span className="rounded-full bg-brand-ink px-2 py-0.5 text-[10px] font-bold text-white">글쓴이</span>}
          {c.isExpertAnswer && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-clay px-2 py-0.5 text-[10px] font-bold text-white">
              <BadgeCheck size={11} /> 전문가 답변
            </span>
          )}
          <span className="text-xs text-ink-400">{timeAgo(c.createdAt)}</span>
        </div>
        {c.deleted ? (
          <p className="mt-2 text-sm italic text-ink-400">삭제된 댓글입니다.</p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-800">{c.content}</p>
        )}
        {!c.deleted && (
          <div className="mt-2 flex items-center gap-3 text-xs">
            {user && (
              <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="inline-flex items-center gap-1 font-semibold text-ink-500 hover:text-brand-clay">
                <CornerDownRight size={12} /> 답글
              </button>
            )}
            {user && (user.id === c.author.id || user.role === 'ADMIN') && (
              <button type="button" onClick={() => removeComment(c.id)} className="inline-flex items-center gap-1 text-ink-400 hover:text-brand-red">
                <Trash2 size={12} /> 삭제
              </button>
            )}
          </div>
        )}
        {replyTo === c.id && (
          <div className="mt-3">
            <CommentBox
              autoFocus
              placeholder={`${c.author.name}님에게 답글`}
              onSubmit={(t) => addComment(t, c.id)}
              onCancel={() => setReplyTo(null)}
            />
          </div>
        )}
      </div>
      {c.replies.length > 0 && <ul className="mt-2 space-y-2">{c.replies.map((r) => renderComment(r, true))}</ul>}
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/community" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-clay">
        <ArrowLeft size={15} /> 목록
      </Link>

      <article className="rounded-4xl border border-hairline bg-surface-canvas p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={post.category} />
          {post.domainType && (
            <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-600">{DOMAIN_LABELS[post.domainType]}</span>
          )}
        </div>
        <h1 className="mt-3 break-words font-display text-xl tracking-wide text-ink-900">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <AuthorChip author={post.author} linkProfile />
          <span className="text-xs text-ink-400">{new Date(post.createdAt).toLocaleString('ko-KR')}</span>
          <span className="inline-flex items-center gap-1 text-xs text-ink-400"><Eye size={13} /> {post.viewCount}</span>
        </div>

        <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-ink-800">{post.content}</div>

        {post.imageUrls.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {post.imageUrls.map((u, i) => (
              <button key={u} type="button" onClick={() => setZoom(u)} className="overflow-hidden rounded-2xl border border-hairline">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`첨부 이미지 ${i + 1}`} className="h-48 w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
          <button
            type="button"
            onClick={toggleLike}
            disabled={!user}
            title={user ? '' : '로그인하면 좋아요를 누를 수 있어요'}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              post.likedByMe ? 'bg-brand-clay text-white' : 'bg-surface-raised text-ink-700 hover:bg-hairline'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <Heart size={15} fill={post.likedByMe ? 'currentColor' : 'none'} /> 좋아요 {post.likeCount}
          </button>
          <span className="inline-flex items-center gap-1 text-sm text-ink-500"><MessageSquare size={15} /> 댓글 {post.commentCount}</span>
          {canDeletePost && (
            <button type="button" onClick={removePost} className="ml-auto inline-flex items-center gap-1 text-xs text-ink-400 hover:text-brand-red">
              <Trash2 size={13} /> 글 삭제
            </button>
          )}
        </div>
        {error && <div className="mt-3"><FormErrorText>{error}</FormErrorText></div>}
      </article>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold text-ink-900">댓글 {post.commentCount}</h2>
        {comments.length === 0 && <p className="mb-4 text-sm text-ink-500">첫 댓글을 남겨 보세요.</p>}
        {comments.length > 0 && <ul className="mb-5 space-y-3">{comments.map((c) => renderComment(c, false))}</ul>}

        {user ? (
          <div className="rounded-3xl border border-hairline bg-surface-canvas p-4">
            <CommentBox placeholder="댓글을 입력하세요 (전문가 인증을 받은 분야의 글이면 '전문가 답변'으로 표시돼요)" onSubmit={(t) => addComment(t)} />
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-hairline-strong bg-surface-canvas p-4 text-center text-sm text-ink-500">
            댓글을 쓰려면 <Link href="/login" className="font-semibold text-brand-clay hover:underline">로그인</Link>이 필요해요.
          </p>
        )}
      </section>

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setZoom(null)}>
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-ink-900" aria-label="닫기">
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="확대 이미지" className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
