'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cleanEditorHtml } from '../../sanitize';
import { loadDemoSession, type DemoSession } from '../../demo-auth';
import { canDeleteArticle, deleteArticle } from '../../interactions';
import { findSubmissionById, relativeTime, type Submission } from '../../submissions';
import ArticleInteractions from './ArticleInteractions';

export default function CommunityArticle({ id }: { id: string }) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSubmission(findSubmissionById(id));
    setSession(loadDemoSession());
    setLoaded(true);
  }, [id]);

  const onDelete = () => {
    if (!session) return;
    if (!window.confirm('Delete this article? This also removes its likes and comments. This can’t be undone.')) return;
    if (deleteArticle({ articleId: id, session })) window.location.assign('/');
  };

  if (!loaded) return <div className="mx-auto max-w-[820px] pt-16 sm:pt-24" aria-busy="true" />;

  if (!submission || submission.status !== 'approved') {
    return <div className="mx-auto max-w-[820px] pt-16 text-center sm:pt-24">
      <p className="font-mono text-[10px] uppercase tracking-[.08em] text-coral">Community submission</p>
      <h1 className="mt-4 font-display text-[clamp(34px,5vw,54px)] font-medium leading-[1.02] text-ink">This article is not available.</h1>
      <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-[1.6] text-muted">It may still be in review, or it may have been removed. Approved community submissions appear here once a curator has reviewed them.</p>
      <Link href="/" className="primary-button mt-8 inline-block">Back to the library -&gt;</Link>
    </div>;
  }

  const published = submission.reviewedAt ?? submission.submittedAt;

  return <article className="mx-auto max-w-[820px] pt-16 sm:pt-24">
    <div className="mb-5 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[.08em] text-coral"><span>Article</span><span className="text-line">/</span><span className="text-muted">{submission.stage}</span><span className="text-line">/</span><span className="text-muted">{submission.topic}</span></div>
    <h1 className="max-w-[780px] text-[clamp(44px,7vw,78px)] font-medium leading-[.98] tracking-[-.04em] text-ink">{submission.title}</h1>
    <p className="mt-7 max-w-[650px] text-[18px] leading-[1.55] text-muted">{submission.summary}</p>
    <div className="mt-8 flex flex-wrap items-center gap-4 border-y border-line py-4 font-mono text-[10px] uppercase tracking-[.06em] text-muted"><span>By {submission.submittedBy}</span><span className="text-coral">{submission.minutes} min read</span><span>Published {relativeTime(published)}</span>{session && canDeleteArticle(submission.id, session) && <button type="button" className="reject-button ml-auto" onClick={onDelete}>Delete article</button>}</div>

    {submission.url && <p className="mt-8 border-l-[3px] border-coral bg-[#f0e7dc] p-4 text-[13px] text-ink"><strong className="font-mono text-[10px] uppercase tracking-[.08em]">Source </strong><a className="break-all text-coral hover:text-ink" href={submission.url} target="_blank" rel="noreferrer noopener">{submission.url}</a></p>}

    <div className="mt-12">
      <div className="mb-5 font-mono text-[10px] uppercase tracking-[.08em] text-coral">The article</div>
      <div className="article-body" dangerouslySetInnerHTML={{ __html: cleanEditorHtml(submission.body) }} />
    </div>

    <ArticleInteractions articleId={submission.id} articleTitle={submission.title} />

    <aside className="mt-12 border-t border-line pt-6 text-[12px] leading-[1.6] text-muted"><strong className="text-ink">A note on professional advice.</strong> LifeStage Curator shares practical information and community resources. This article is not medical, legal, financial, or mental-health advice. Seek a qualified professional for guidance about your situation.</aside>
  </article>;
}
