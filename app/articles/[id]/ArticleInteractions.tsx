'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadDemoSession, type DemoSession } from '../../demo-auth';
import { addComment, hasLiked, loadComments, loadLikes, toggleLike, type ArticleComment, type ArticleLike } from '../../interactions';
import { relativeTime } from '../../submissions';

export default function ArticleInteractions({ articleId, articleTitle }: { articleId: string; articleTitle: string }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [likes, setLikes] = useState<ArticleLike[]>([]);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const stored = loadDemoSession();
    setSession(stored);
    setLikes(loadLikes(articleId));
    setComments(loadComments(articleId));
    setLiked(stored ? hasLiked(articleId, stored.email) : false);
  }, [articleId]);

  const onLike = () => {
    if (!session) return;
    const result = toggleLike({ articleId, articleTitle, session });
    setLiked(result.liked);
    setLikes(result.likes);
  };

  const onComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session || !draft.trim()) return;
    addComment({ articleId, articleTitle, session, body: draft });
    setComments(loadComments(articleId));
    setDraft('');
  };

  return <section className="mt-14 border-t border-line pt-8" aria-label="Likes and comments">
    <div className="flex flex-wrap items-center gap-5">
      <button type="button" className={`like-button ${liked ? 'active' : ''}`} onClick={onLike} disabled={!session} aria-pressed={liked} title={session ? (liked ? 'Remove like' : 'Like this article') : 'Sign in to like'}>
        <span aria-hidden="true">{liked ? '\u2665' : '\u2661'}</span> {likes.length} {likes.length === 1 ? 'like' : 'likes'}
      </button>
      <span className="font-mono text-[10px] uppercase tracking-[.08em] text-muted">{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
    </div>

    <div className="mt-6 grid gap-3">
      {comments.length ? comments.map(comment => <article className="border border-line bg-white p-4" key={comment.id}>
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[.06em] text-muted"><span>{comment.authorName}</span><span>{relativeTime(comment.createdAt)}</span></div>
        <p className="mb-0 mt-2 text-[14px] leading-[1.6] text-[#424a44]">{comment.body}</p>
      </article>) : <p className="m-0 text-[13px] text-muted">No comments yet. Start the conversation.</p>}
    </div>

    {session ? <form className="mt-5 grid gap-3" onSubmit={onComment}>
      <textarea className="min-h-[88px] resize-y border border-line bg-[#fafbf8] p-3 text-sm leading-[1.6] text-ink outline-coral" value={draft} onChange={event => setDraft(event.target.value)} placeholder={`Add a comment as ${session.name}...`} maxLength={600} required aria-label="Write a comment" />
      <button className="primary-button justify-self-start" type="submit">Post comment -&gt;</button>
    </form> : <p className="mt-5 border border-dashed border-line bg-[#f7f8f3] p-4 text-[12px] text-muted"><Link href="/login" className="text-coral hover:text-ink">Sign in</Link> to like this article and join the conversation.</p>}
  </section>;
}
