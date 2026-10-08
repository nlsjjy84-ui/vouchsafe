import { DomainType } from './types';

export type PostCategory = 'REVIEW' | 'QUESTION' | 'WARNING' | 'TIP' | 'NOTICE';
export type UserRoleName = 'CLIENT' | 'EXPERT' | 'HYBRID' | 'ADMIN';

export const CATEGORY_LABELS: Record<PostCategory, string> = {
  REVIEW: '거래 후기',
  QUESTION: '질문과 답변',
  WARNING: '사기·주의',
  TIP: '정보·꿀팁',
  NOTICE: '공지',
};

export interface CommunityAuthor {
  id: string;
  name: string;
  role: UserRoleName;
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
  author: CommunityAuthor;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

export interface PostListResponse {
  items: PostSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PostDetail {
  id: string;
  category: PostCategory;
  domainType: DomainType | null;
  title: string;
  content: string;
  imageUrls: string[];
  author: CommunityAuthor;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityComment {
  id: string;
  parentId: string | null;
  content: string;
  deleted: boolean;
  author: CommunityAuthor;
  isPostAuthor: boolean;
  isExpertAnswer: boolean;
  createdAt: string;
  replies: CommunityComment[];
}

/** "3일 전" 형태의 상대 시간 */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}
