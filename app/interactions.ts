import type { DemoSession } from './demo-auth';
import { loadNotifications, persistNotifications, pushNotification } from './notifications';
import { findSubmissionById, removeSubmissionById } from './submissions';

export type ArticleComment = {
  id: string;
  articleId: string;
  authorEmail: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type ArticleLike = {
  articleId: string;
  userEmail: string;
  userName: string;
  createdAt: string;
};

export const commentsKey = 'lsc-comments';
export const likesKey = 'lsc-likes';

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isComment(value: unknown): value is ArticleComment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ArticleComment>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.articleId === 'string' &&
    typeof candidate.authorEmail === 'string' &&
    typeof candidate.authorName === 'string' &&
    typeof candidate.body === 'string' &&
    typeof candidate.createdAt === 'string'
  );
}

function isLike(value: unknown): value is ArticleLike {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ArticleLike>;
  return (
    typeof candidate.articleId === 'string' &&
    typeof candidate.userEmail === 'string' &&
    typeof candidate.userName === 'string' &&
    typeof candidate.createdAt === 'string'
  );
}

function persist(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function loadArray<T>(key: string, guard: (value: unknown) => value is T): T[] {
  if (typeof window === 'undefined') return [];
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard);
  } catch {
    return [];
  }
}

function notifyAuthor(input: {
  articleId: string;
  articleTitle: string;
  session: DemoSession;
  type: 'comment' | 'like' | 'save';
  commentPreview?: string;
}): void {
  const submission = findSubmissionById(input.articleId);
  if (!submission?.submitterEmail) return;
  if (submission.submitterEmail.toLowerCase() === input.session.email.toLowerCase()) return;
  pushNotification({
    recipientEmail: submission.submitterEmail,
    type: input.type,
    actorName: input.session.name,
    articleId: input.articleId,
    articleTitle: input.articleTitle,
    commentPreview: input.commentPreview
  });
}

function notifyParticipants(input: {
  articleId: string;
  articleTitle: string;
  session: DemoSession;
}): void {
  const submission = findSubmissionById(input.articleId);
  const authorEmail = submission?.submitterEmail?.toLowerCase();
  const actorEmail = input.session.email.toLowerCase();
  const recipients = new Set<string>();
  for (const comment of loadComments(input.articleId)) {
    const email = comment.authorEmail.toLowerCase();
    if (email !== actorEmail && email !== authorEmail) recipients.add(email);
  }
  for (const like of loadLikes(input.articleId)) {
    const email = like.userEmail.toLowerCase();
    if (email !== actorEmail && email !== authorEmail) recipients.add(email);
  }
  for (const recipient of Array.from(recipients)) {
    pushNotification({
      recipientEmail: recipient,
      type: 'reply',
      actorName: input.session.name,
      articleId: input.articleId,
      articleTitle: input.articleTitle
    });
  }
}

export function loadComments(articleId: string): ArticleComment[] {
  return loadArray(commentsKey, isComment)
    .filter(comment => comment.articleId === articleId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function addComment(input: {
  articleId: string;
  articleTitle: string;
  session: DemoSession;
  body: string;
}): ArticleComment {
  const body = input.body.trim();
  const comment: ArticleComment = {
    id: newId('comment'),
    articleId: input.articleId,
    authorEmail: input.session.email,
    authorName: input.session.name,
    body,
    createdAt: new Date().toISOString()
  };
  persist(commentsKey, [...loadArray(commentsKey, isComment), comment]);
  notifyAuthor({
    articleId: input.articleId,
    articleTitle: input.articleTitle,
    session: input.session,
    type: 'comment',
    commentPreview: body.length > 90 ? `${body.slice(0, 90)}…` : body
  });
  notifyParticipants({
    articleId: input.articleId,
    articleTitle: input.articleTitle,
    session: input.session
  });
  return comment;
}

export function loadLikes(articleId: string): ArticleLike[] {
  return loadArray(likesKey, isLike).filter(like => like.articleId === articleId);
}

export function hasLiked(articleId: string, email: string): boolean {
  return loadLikes(articleId).some(like => like.userEmail.toLowerCase() === email.toLowerCase());
}

export function toggleLike(input: {
  articleId: string;
  articleTitle: string;
  session: DemoSession;
}): { liked: boolean; likes: ArticleLike[] } {
  const all = loadArray(likesKey, isLike);
  const existing = all.find(
    like => like.articleId === input.articleId && like.userEmail.toLowerCase() === input.session.email.toLowerCase()
  );
  if (existing) {
    const next = all.filter(like => like !== existing);
    persist(likesKey, next);
    return { liked: false, likes: next.filter(like => like.articleId === input.articleId) };
  }
  const like: ArticleLike = {
    articleId: input.articleId,
    userEmail: input.session.email,
    userName: input.session.name,
    createdAt: new Date().toISOString()
  };
  persist(likesKey, [...all, like]);
  notifyAuthor({
    articleId: input.articleId,
    articleTitle: input.articleTitle,
    session: input.session,
    type: 'like'
  });
  return { liked: true, likes: [...all, like].filter(item => item.articleId === input.articleId) };
}

export function notifyArticleSaved(input: {
  articleId: string;
  articleTitle: string;
  session: DemoSession;
}): void {
  notifyAuthor({ ...input, type: 'save' });
}

export const savedKey = 'lsc-saved';

export function canDeleteArticle(articleId: string, session: DemoSession): boolean {
  const submission = findSubmissionById(articleId);
  if (!submission) return false;
  if (session.role === 'admin') return true;
  return submission.submitterEmail?.toLowerCase() === session.email.toLowerCase();
}

export function deleteArticle(input: { articleId: string; session: DemoSession }): boolean {
  if (!canDeleteArticle(input.articleId, input.session)) return false;

  removeSubmissionById(input.articleId);

  const comments = loadArray(commentsKey, isComment).filter(comment => comment.articleId !== input.articleId);
  persist(commentsKey, comments);

  const likes = loadArray(likesKey, isLike).filter(like => like.articleId !== input.articleId);
  persist(likesKey, likes);

  persistNotifications(loadNotifications().filter(notification => notification.articleId !== input.articleId));

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(savedKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          window.localStorage.setItem(savedKey, JSON.stringify(parsed.map(String).filter(id => id !== input.articleId)));
        }
      } catch {
        // ignore malformed saved list
      }
    }
  }

  return true;
}
