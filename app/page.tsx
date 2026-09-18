'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { clearDemoSession, initialsFor, loadDemoSession, type DemoSession } from './demo-auth';
import { canDeleteArticle, deleteArticle, notifyArticleSaved } from './interactions';
import { markAllNotificationsRead, markNotificationRead, notificationLabel, notificationMessage, notificationsFor, notificationsUpdatedEvent, pushNotification, unreadCount, type AppNotification } from './notifications';
import { cleanEditorHtml } from './sanitize';
import { createSubmission, findSubmissionById, loadSubmissions, relativeTime, updateSubmissionStatus, type Submission } from './submissions';

type Stage = { id: string; name: string; description: string; topics: string[]; color: string };
type Resource = { id: string; title: string; summary: string; stage: string; type: string; topic: string; time: string; source: string; rating: number; votes: number; featured?: boolean; community?: boolean };
type EnrichmentDuplicate = { content_id: string; similarity: number; url: string | null; reason: string };
type EnrichmentResponse = {
  status: 'success' | 'partial' | 'error';
  summary: string | null;
  metadata: { title: string | null; description: string | null; thumbnail_url: string | null; published_at: string | null; canonical_url: string | null; site_name: string | null };
  taxonomy: { primary_life_stage: string | null; sub_topics: string[]; content_type: string; estimated_minutes: number | null };
  duplicates: EnrichmentDuplicate[];
  enrichment_meta: { provider: string; model: string | null; latency_ms: number; tokens_used: number; offline_labelling_used: boolean; cached: boolean; llm_used: boolean };
  errors: { code: string; message: string; field?: string | null }[];
};

const stages: Stage[] = [
  { id: 'parenthood', name: 'Preparing for Parenthood', description: 'Make room for the person and the practical life ahead.', topics: ['Before baby', 'Finances', 'Relationships'], color: 'coral' },
  { id: 'new-parents', name: 'New Parents', description: 'Steady, useful support for the first three years.', topics: ['Sleep & settling', 'Feeding', 'Returning to work'], color: 'sage' },
  { id: 'partnership', name: 'Newlyweds / Early Partnership', description: 'Build a household that works for both of you.', topics: ['Money together', 'Home rhythms', 'Communication'], color: 'honey' },
  { id: 'new-home', name: 'Moving into a New Home', description: 'The checklists and decisions that make a place yours.', topics: ['First 30 days', 'Admin & legal', 'Making it home'], color: 'sky' },
  { id: 'grandparents', name: 'Becoming Grandparents', description: 'Find your role, your rhythm, and the joy in between.', topics: ['Being supportive', 'Staying connected', 'Family boundaries'], color: 'plum' },
  { id: 'retirement', name: 'Retirement & Later Life', description: 'Plan the next chapter with clarity and purpose.', topics: ['Financial planning', 'Health & mobility', 'Purpose & connection'], color: 'ink' }
];

const resources: Resource[] = [
  { id: '1', title: 'The calm first-month plan', summary: 'A gentle, practical checklist for the first four weeks with a new baby, covering rest, food, visitors, and asking for help.', stage: 'New Parents', type: 'Checklist', topic: 'Sleep & settling', time: '8 min', source: 'The Parent Practice', rating: 4.9, votes: 38, featured: true },
  { id: '2', title: 'A kinder conversation about money', summary: 'A guided conversation for couples building shared financial habits without turning every decision into a spreadsheet.', stage: 'Newlyweds / Early Partnership', type: 'Guide', topic: 'Money together', time: '12 min', source: 'Common Ground', rating: 4.8, votes: 24, featured: true },
  { id: '3', title: 'Your first 30 days in a new home', summary: 'The unglamorous essentials: utilities, safety checks, address changes, and the small wins that make moving feel finished.', stage: 'Moving into a New Home', type: 'Checklist', topic: 'First 30 days', time: '10 min', source: 'Homeward', rating: 4.7, votes: 19 },
  { id: '4', title: 'The retirement runway', summary: 'A plain-language guide to turning a vague retirement date into a sequence of decisions you can actually make.', stage: 'Retirement & Later Life', type: 'Article', topic: 'Financial planning', time: '15 min', source: 'Clear Money', rating: 4.6, votes: 51 },
  { id: '5', title: 'Boundaries that keep grandparents close', summary: 'Ideas for showing up generously while respecting the parents at the center of a growing family.', stage: 'Becoming Grandparents', type: 'Podcast', topic: 'Family boundaries', time: '28 min', source: 'The Family Table', rating: 4.8, votes: 16 },
  { id: '6', title: 'What to decide before baby arrives', summary: 'A short set of prompts about leave, care, visitors, and the support network you want around you.', stage: 'Preparing for Parenthood', type: 'Guide', topic: 'Before baby', time: '9 min', source: 'Good Start', rating: 4.5, votes: 12 },
  { id: '7', title: 'Finding purpose after the calendar clears', summary: 'A reflective worksheet for designing a week with movement, people, and projects that matter to you.', stage: 'Retirement & Later Life', type: 'Worksheet', topic: 'Purpose & connection', time: '20 min', source: 'Second Act', rating: 4.4, votes: 9 }
];

const icons: Record<string, string> = { Home: '01', Explore: '02', Saved: '03', Submit: '04', Profile: '05', Admin: '06' };

function submissionToResource(submission: Submission): Resource {
  return {
    id: submission.id,
    title: submission.title,
    summary: submission.summary,
    stage: submission.stage,
    type: 'Article',
    topic: submission.topic,
    time: `${submission.minutes} min`,
    source: submission.submittedBy,
    rating: 0,
    votes: 0,
    community: true
  };
}

export default function Home() {
  const [view, setView] = useState('Home');
  const [query, setQuery] = useState('');
  const [activeStage, setActiveStage] = useState('All stages');
  const [activeType, setActiveType] = useState('All types');
  const [saved, setSaved] = useState<string[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>(['New Parents', 'Retirement & Later Life']);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [communityResources, setCommunityResources] = useState<Resource[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem('lsc-saved');
    const preferences = window.localStorage.getItem('lsc-stages');
    const restored = loadDemoSession();
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) setSaved(parsed.map(String));
      } catch {
        setSaved([]);
      }
    }
    if (preferences) setSelectedStages(JSON.parse(preferences));
    if (restored) setSession(restored);
    const requestedView = new URLSearchParams(window.location.search).get('view');
    const knownViews = ['Home', 'Explore', 'Saved', 'Submit', 'Profile', 'Admin'];
    const gatedViews = ['Saved', 'Submit', 'Profile', 'Admin'];
    if (requestedView && knownViews.includes(requestedView) && (!gatedViews.includes(requestedView) || restored)) {
      setView(requestedView);
    }
  }, []);

  const syncCommunityResources = useCallback(() => {
    setCommunityResources(loadSubmissions().filter(submission => submission.status === 'approved').map(submissionToResource));
  }, []);

  useEffect(() => {
    syncCommunityResources();
    window.addEventListener('storage', syncCommunityResources);
    return () => window.removeEventListener('storage', syncCommunityResources);
  }, [view, syncCommunityResources]);

  const isLoggedIn = session !== null;
  const isAdmin = session?.role === 'admin';

  const signOut = () => {
    clearDemoSession();
    setSession(null);
    setView('Home');
  };

  const toggleSaved = (id: string) => {
    if (!isLoggedIn || !session) return;
    const isSaving = !saved.includes(id);
    const next = isSaving ? [...saved, id] : saved.filter(item => item !== id);
    setSaved(next);
    window.localStorage.setItem('lsc-saved', JSON.stringify(next));
    if (isSaving) {
      const submission = findSubmissionById(id);
      if (submission) notifyArticleSaved({ articleId: submission.id, articleTitle: submission.title, session });
    }
  };

  const matchesFilters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (resource: Resource) => {
      const haystack = `${resource.title} ${resource.summary} ${resource.topic} ${resource.source} ${resource.stage}`.toLowerCase();
      const matchesQuery = !needle || haystack.includes(needle);
      const matchesStage = activeStage === 'All stages' || resource.stage === activeStage;
      const matchesType = activeType === 'All types' || resource.type === activeType;
      return matchesQuery && matchesStage && matchesType;
    };
  }, [query, activeStage, activeType]);

  const allResources = useMemo(() => [...communityResources, ...resources], [communityResources]);

  const visibleResources = useMemo(() => {
    const base = view === 'Saved'
      ? allResources.filter(resource => saved.includes(resource.id))
      : view === 'Home'
        ? allResources.filter(resource => selectedStages.includes(resource.stage))
        : allResources;
    return base.filter(matchesFilters);
  }, [view, saved, selectedStages, matchesFilters, allResources]);

  const emptyStateMessage = query.trim()
    ? `No resources match “${query.trim()}”.`
    : view === 'Saved'
      ? 'Nothing saved yet. Save something useful and it will live here.'
      : view === 'Home'
        ? 'No resources for your selected stages yet. Try Explore or adjust your filters.'
        : 'No resources match these filters yet.';

  const updateStages = (name: string) => setSelectedStages(current => current.includes(name) ? current.filter(stage => stage !== name) : [...current, name]);
  const finishOnboarding = () => { window.localStorage.setItem('lsc-stages', JSON.stringify(selectedStages)); setShowOnboarding(false); };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">L/</span><span>LifeStage<br /><b>Curator</b></span></div>
      <p className="sidebar-label">Your library</p>
      <nav aria-label="Primary navigation">{(isLoggedIn ? ['Home', 'Explore', 'Saved', 'Submit'] : ['Home', 'Explore']).map(item => <button key={item} className={`nav-item ${view === item ? 'active' : ''}`} onClick={() => setView(item)}><span className="nav-number">{icons[item]}</span>{item}<span className="nav-arrow">{view === item ? '>' : ''}</span></button>)}</nav>
      {isLoggedIn && <><p className="sidebar-label">Account</p>
      <nav aria-label="Account navigation">{['Profile', 'Admin'].map(item => <button key={item} className={`nav-item ${view === item ? 'active' : ''}`} onClick={() => item === 'Admin' && !isAdmin ? window.location.assign('/login?next=admin') : setView(item)}><span className="nav-number">{icons[item]}</span>{item}{item === 'Admin' && !isAdmin && <span className="ml-auto font-mono text-[9px] text-muted">LOCKED</span>}<span className="nav-arrow">{view === item ? '>' : ''}</span></button>)}</nav></>}
      <div className="sidebar-note"><span className="note-dot" />Curated by people<br />who have been there.</div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="crumb">LIFE / <span>{view.toUpperCase()}</span></div><div className="top-actions"><button className="quiet-button" onClick={() => setShowOnboarding(true)}>Tune my path</button>{session && <NotificationBell session={session} />}{session ? <><button className="avatar" aria-label="Open profile" onClick={() => setView('Profile')}>{initialsFor(session.name)}</button><button className="quiet-button grid place-items-center px-2" onClick={signOut} aria-label="Sign out" title="Sign out"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></svg></button></> : <Link className="quiet-button" href="/login">Sign in</Link>}</div></header>
      {view === 'Home' && <><section className="welcome"><div><p className="eyebrow">Tuesday, 15 September</p><h1>Make room for<br /><em>what&apos;s next.</em></h1><p className="intro">A calmer way to find the practical guidance you need for life&apos;s big transitions.</p></div><div className="welcome-stamp"><span>YOUR PATH</span><strong>{selectedStages.length || 0}</strong><small>stages selected</small></div></section><section className="path-strip"><div><p className="section-kicker">Picked for your path</p><h2>Start where you are</h2></div><button className="text-button" onClick={() => setShowOnboarding(true)}>Edit stages <span>-&gt;</span></button></section></>}
      {view === 'Explore' && <section className="page-heading"><p className="eyebrow">Browse the library</p><h1>Find your next<br /><em>good step.</em></h1><p className="intro">Six life stages, thoughtfully organized. Start broad or follow a thread.</p></section>}
      {view === 'Saved' && <section className="page-heading compact"><p className="eyebrow">Your personal shelf</p><h1>Saved for<br /><em>later.</em></h1><p className="intro">{saved.length ? `${saved.length} pieces of guidance waiting for you.` : 'Save something useful and it will live here.'}</p></section>}
      {view === 'Submit' && <SubmitView isLoggedIn={isLoggedIn} />}
      {view === 'Profile' && (session ? <ProfileView session={session} selectedStages={selectedStages} onTune={() => setShowOnboarding(true)} onSignOut={signOut} onDataChanged={syncCommunityResources} /> : <SignInRequiredView eyebrow="Your account" title={<>Sign in to see<br /><em>your profile.</em></>} message="Your saved resources, stages, and contribution history live behind a profile." next="profile" />)}
      {view === 'Admin' && (isAdmin ? <AdminView adminName={session?.name ?? 'Moderator'} onSignOut={signOut} /> : <AuthRequiredView />)}
      {(view === 'Home' || view === 'Explore' || view === 'Saved') && <><section className="filters"><div className="search-wrap"><span>/</span><input aria-label="Search resources" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search guides, questions, ideas..." />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="ml-auto border-0 bg-transparent px-2 font-mono text-[10px] uppercase text-muted hover:text-coral">Clear</button>}</div><select aria-label="Filter by stage" value={activeStage} onChange={event => setActiveStage(event.target.value)}><option>All stages</option>{stages.map(stage => <option key={stage.id}>{stage.name}</option>)}</select><select aria-label="Filter by type" value={activeType} onChange={event => setActiveType(event.target.value)}><option>All types</option>{['Article', 'Checklist', 'Guide', 'Podcast', 'Worksheet'].map(type => <option key={type}>{type}</option>)}</select></section>{view === 'Home' && <div className="content-label"><span>For your selected stages</span><span className="rule" /><button onClick={() => setView('Explore')}>See all resources -&gt;</button></div>}{view !== 'Home' && <div className="content-label"><span>{visibleResources.length} resources</span><span className="rule" /></div>}<section className="resource-grid">{visibleResources.length ? visibleResources.map(resource => <ResourceCard key={resource.id} resource={resource} saved={saved.includes(resource.id)} locked={!isLoggedIn} onSave={() => toggleSaved(resource.id)} />) : <div className="empty-state">{emptyStateMessage}</div>}</section>{view === 'Home' && <section className="stage-section"><div className="content-label"><span>Explore a life stage</span><span className="rule" /><button onClick={() => setView('Explore')}>Browse all -&gt;</button></div><div className="stage-grid">{stages.map(stage => <button className={`stage-card ${stage.color}`} key={stage.id} onClick={() => { setActiveStage(stage.name); setView('Explore'); }}><span className="stage-index">0{stages.indexOf(stage) + 1}</span><strong>{stage.name}</strong><small>{stage.description}</small><span className="stage-topics">{stage.topics.slice(0, 2).join('  /  ')}</span></button>)}</div></section>}</>}
    </main>
    {showOnboarding && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="tune-title"><button className="modal-close" onClick={() => setShowOnboarding(false)} aria-label="Close">x</button><p className="eyebrow">Shape your path</p><h2 id="tune-title">What chapter are<br /><em>you in?</em></h2><p>Select everything that feels relevant. You can change this anytime.</p><div className="stage-options">{stages.map(stage => <button key={stage.id} className={selectedStages.includes(stage.name) ? 'selected' : ''} onClick={() => updateStages(stage.name)}><span>{selectedStages.includes(stage.name) ? '[x]' : '[ ]'}</span>{stage.name}</button>)}</div><button className="primary-button" onClick={finishOnboarding}>Save my path</button></div></div>}
  </div>;
}

function NotificationBell({ session }: { session: DemoSession }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    setNotifications(notificationsFor(session.email));
    setUnread(unreadCount(session.email));
  }, [session.email]);

  useEffect(() => {
    refresh();
    const sync = () => refresh();
    window.addEventListener('storage', sync);
    window.addEventListener(notificationsUpdatedEvent, sync);
    const interval = window.setInterval(sync, 5000);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(notificationsUpdatedEvent, sync);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.notify')) setOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, [open]);

  const toggle = () => {
    if (!open) refresh();
    setOpen(current => !current);
  };

  const readOne = (id: string) => {
    markNotificationRead(id);
    refresh();
  };

  const readAll = () => {
    markAllNotificationsRead(session.email);
    refresh();
  };

  const hasUnread = notifications.some(notification => !notification.read);

  return <div className="notify">
    <button type="button" className="notify-button" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      {unread > 0 && <span className="notify-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="notify-panel" role="dialog" aria-label="Notifications">
      <div className="notify-head"><strong>Notifications</strong>{hasUnread && <button type="button" className="text-button" onClick={readAll}>Mark all read</button>}</div>
      {notifications.length ? <div className="notify-list">{notifications.map(notification => <button type="button" key={notification.id} className={`notify-item ${notification.read ? '' : 'unread'}`} onClick={() => readOne(notification.id)}>
        <span className="notify-label">{notificationLabel(notification.type)}</span>
        <span className="notify-message">{notificationMessage(notification)}</span>
        {notification.commentPreview && <span className="notify-preview">&ldquo;{notification.commentPreview}&rdquo;</span>}
        <span className="notify-time">{relativeTime(notification.createdAt)}</span>
      </button>)}</div> : <p className="notify-empty">You&apos;re all caught up.</p>}
    </div>}
  </div>;
}

function ResourceCard({ resource, saved, locked, onSave }: { resource: Resource; saved: boolean; locked: boolean; onSave: () => void }) {
  return <article className={`resource-card ${resource.featured ? 'featured' : ''}`}><div className="card-top"><span className="type-label">{resource.type}{resource.community ? ' · Community' : ''}</span>{locked ? <button className="save-button cursor-not-allowed opacity-60" disabled aria-label="Sign in to save">Sign in to save</button> : <button className={`save-button ${saved ? 'saved' : ''}`} onClick={onSave} aria-label={saved ? 'Remove from saved' : 'Save resource'}>{saved ? 'Saved' : '+ Save'}</button>}</div><p className="card-stage">{resource.stage} / {resource.topic}</p><h3>{locked ? <span>{resource.title}</span> : <Link href={`/articles/${resource.id}`} className="hover:text-coral">{resource.title}</Link>}</h3><p className="card-summary">{resource.summary}</p><div className="card-footer"><span>{resource.source}</span><span>{resource.time} <b>·</b> {resource.community ? 'New addition' : `${resource.rating} / 5`}</span></div>{locked ? <p className="mt-4 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Sign in to read &amp; save this resource</p> : <Link href={`/articles/${resource.id}`} className="mt-4 font-mono text-[10px] uppercase tracking-[.08em] text-coral hover:text-ink">Read article -&gt;</Link>}</article>;
}

function SignInRequiredView({ eyebrow, title, message, next }: { eyebrow: string; title: React.ReactNode; message: string; next: string }) {
  return <section className="admin-view"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro">{message}</p><Link className="primary-button mt-8 inline-block" href={`/login?next=${next}`}>Go to sign in -&gt;</Link></section>;
}

function SubmitView({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!isLoggedIn) {
    return <SignInRequiredView eyebrow="Contributor access" title={<>Sign in to<br /><em>share something useful.</em></>} message="Submitting is limited to activated member profiles. Sign in or create a demo account to contribute." next="submit" />;
  }
  return <section className="form-view"><p className="eyebrow">Add to the commons</p><h1>Share something<br /><em>useful.</em></h1><p className="intro">Know a resource that made a real difference? Send it our way. Every submission is reviewed before it joins the library.</p><ArticleComposer /></section>;
}

const editorStarterBody = '<p>Start with the practical insight you want someone to carry into their week.</p>';

const editorTools = [
  { label: 'B', command: 'bold', title: 'Bold' },
  { label: 'I', command: 'italic', title: 'Italic' },
  { label: 'H2', command: 'formatBlock', value: 'h2', title: 'Heading' },
  { label: '• List', command: 'insertUnorderedList', title: 'Bulleted list' },
  { label: '1. List', command: 'insertOrderedList', title: 'Numbered list' },
  { label: '“ Quote', command: 'formatBlock', value: 'blockquote', title: 'Quote' }
];

function AiTag() {
  return <span className="ml-1 border border-coral px-1 py-[1px] font-mono text-[9px] text-coral">AI</span>;
}

function ArticleComposer() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [stage, setStage] = useState('');
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState('');
  const [body, setBody] = useState(editorStarterBody);
  const [preview, setPreview] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState('');
  const [enrichment, setEnrichment] = useState<EnrichmentResponse | null>(null);
  const [duplicates, setDuplicates] = useState<EnrichmentDuplicate[]>([]);
  const [aiFields, setAiFields] = useState<string[]>([]);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = body;
  }, []);

  const format = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    setBody(editorRef.current?.innerHTML || body);
  };

  const enrichFromUrl = async () => {
    if (!url.trim()) {
      setEnrichError('Paste a link first, or keep filling this in manually.');
      return;
    }
    setEnriching(true);
    setEnrichError('');
    setEnrichment(null);
    setDuplicates([]);
    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          title_hint: title || undefined,
          options: { use_llm: true, use_offline_labelling: true, generate_summary: true, detect_duplicates: true }
        })
      });
      const data = (await response.json()) as EnrichmentResponse;
      if (!response.ok || data.status === 'error') {
        setEnrichError(data.errors?.[0]?.message || 'Could not enrich this link. You can still fill this in manually.');
        return;
      }
      const applied: string[] = [];
      const suggestedTitle = data.metadata?.title;
      const suggestedSummary = data.summary;
      const suggestedStage = data.taxonomy?.primary_life_stage;
      const suggestedTopic = data.taxonomy?.sub_topics?.[0];
      const suggestedMinutes = data.taxonomy?.estimated_minutes;
      if (suggestedTitle) { setTitle(suggestedTitle); applied.push('title'); }
      if (suggestedSummary) { setSummary(suggestedSummary); applied.push('summary'); }
      if (suggestedStage && stages.some(item => item.name === suggestedStage)) { setStage(suggestedStage); applied.push('stage'); }
      if (suggestedTopic) { setTopic(suggestedTopic); applied.push('topic'); }
      if (suggestedMinutes) { setMinutes(String(suggestedMinutes)); applied.push('minutes'); }
      setAiFields(applied);
      setDuplicates(data.duplicates || []);
      setEnrichment(data);
    } catch {
      setEnrichError('Enrichment service is unreachable. You can still fill this in manually.');
    } finally {
      setEnriching(false);
    }
  };

  const submitArticle = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createSubmission({
      title: title.trim(),
      summary: summary.trim(),
      stage,
      topic: topic.trim(),
      minutes,
      body: cleanEditorHtml(body),
      url: url.trim() || undefined,
      submittedBy: loadDemoSession()?.name ?? 'Community member',
      submitterEmail: loadDemoSession()?.email
    });
    alert('Thanks. Your article is ready for editorial review.');
    setUrl('');
    setTitle('');
    setSummary('');
    setStage('');
    setTopic('');
    setMinutes('');
    setBody(editorStarterBody);
    setAiFields([]);
    setDuplicates([]);
    setEnrichment(null);
    setEnrichError('');
    setPreview(false);
    if (editorRef.current) editorRef.current.innerHTML = editorStarterBody;
  };

  return <form className="submit-form" onSubmit={submitArticle}>
    <div className="flex items-center justify-between border-b border-line pb-4"><div><p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-coral">Article composer</p><p className="m-0 mt-1 text-xs text-muted">Paste a link to auto-fill details, or write from scratch.</p></div><button type="button" className="save-button" onClick={() => setPreview(current => !current)}>{preview ? 'Edit article' : 'Preview article'}</button></div>
    <div className="grid gap-3 border border-dashed border-line bg-[#f7f8f3] p-4">
      <label className="!grid">Source URL <span className="flex gap-2"><input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/article" className="!w-full" /><button type="button" className="save-button whitespace-nowrap" onClick={enrichFromUrl} disabled={enriching}>{enriching ? 'Enriching...' : 'Fetch & suggest'}</button></span></label>
      <p className="form-note">We fetch public metadata and suggest a summary, life stage, topic, and reading time. Everything stays editable and is reviewed before publishing.</p>
      {enrichError && <p className="m-0 border border-coral bg-white p-3 text-[11px] text-coral">{enrichError}</p>}
      {duplicates.length > 0 && <div className="border border-honey bg-white p-3 text-[11px] text-ink"><strong>Possible duplicate{duplicates.length > 1 ? 's' : ''}.</strong><ul className="mt-1 list-disc pl-4">{duplicates.map(duplicate => <li key={duplicate.content_id}>{Math.round(duplicate.similarity * 100)}% match{duplicate.url ? ` — ${duplicate.url}` : ''}{duplicate.reason === 'exact_url' ? ' (same link)' : ''}</li>)}</ul></div>}
      {enrichment && <p className="form-note">Suggested via {enrichment.enrichment_meta.provider}{enrichment.enrichment_meta.model ? ` / ${enrichment.enrichment_meta.model}` : ''}{enrichment.enrichment_meta.offline_labelling_used ? ' (offline rules)' : ''}{enrichment.enrichment_meta.cached ? ' · cached' : ''}. Review before submitting.</p>}
    </div>
    <label>Article title {aiFields.includes('title') && <AiTag />}<input type="text" value={title} onChange={event => setTitle(event.target.value)} placeholder="A clear, useful title" required /></label>
    <label>Short summary {aiFields.includes('summary') && <AiTag />}<textarea value={summary} onChange={event => setSummary(event.target.value)} placeholder="What will someone get from this?" maxLength={1200} required /><span className="-mt-1 text-right font-sans text-[10px] normal-case text-[#8b938c]">{summary.length}/1200</span></label>
    <div className="form-row"><label>Life stage {aiFields.includes('stage') && <AiTag />}<select required value={stage} onChange={event => setStage(event.target.value)}><option value="">Choose one</option>{stages.map(item => <option key={item.id}>{item.name}</option>)}</select></label><label>Topic {aiFields.includes('topic') && <AiTag />}<input type="text" value={topic} onChange={event => setTopic(event.target.value)} placeholder="e.g. Sleep & settling" required /></label></div>
    <label>Estimated time (minutes) {aiFields.includes('minutes') && <AiTag />}<input type="number" min="1" value={minutes} onChange={event => setMinutes(event.target.value)} placeholder="e.g. 8" required /></label>
    <div><div className="mb-2 flex flex-wrap items-center gap-1 border border-line bg-[#f2f4ee] p-2" aria-label="Article formatting toolbar">{editorTools.map(tool => <button key={tool.command + tool.label} type="button" title={tool.title} className="border border-transparent bg-white px-2 py-1 font-mono text-[10px] text-muted hover:border-coral hover:text-ink" onMouseDown={event => event.preventDefault()} onClick={() => format(tool.command, tool.value)}>{tool.label}</button>)}<button type="button" title="Add link" className="border border-transparent bg-white px-2 py-1 font-mono text-[10px] text-muted hover:border-coral hover:text-ink" onClick={() => { const linkUrl = window.prompt('Link URL'); if (linkUrl) format('createLink', linkUrl); }}>Link</button></div><div className="mb-2 flex items-center justify-between"><label className="!block">Article body</label><span className="font-mono text-[9px] uppercase tracking-[.08em] text-[#8b938c]">Rich text</span></div>{preview ? <div className="article-preview" dangerouslySetInnerHTML={{ __html: cleanEditorHtml(body) }} /> : <div ref={editorRef} className="article-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Article body" aria-multiline="true" onInput={event => setBody(event.currentTarget.innerHTML)} />}</div>
    <button className="primary-button" type="submit">Submit article for review -&gt;</button><p className="form-note">Your article will remain unpublished until a curator reviews it. Content is practical information, not a substitute for professional advice.</p>
  </form>;
}
function ProfileView({ session, selectedStages, onTune, onSignOut, onDataChanged }: { session: DemoSession; selectedStages: string[]; onTune: () => void; onSignOut: () => void; onDataChanged: () => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    const isOwner = (item: Submission) => item.submitterEmail?.toLowerCase() === session.email.toLowerCase();
    setSubmissions(
      loadSubmissions()
        .filter(item => session.role === 'admin' || isOwner(item))
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    );
  }, [session]);

  const statusLabel: Record<Submission['status'], string> = { in_review: 'In review', approved: 'Published', rejected: 'Not accepted' };

  const remove = (item: Submission) => {
    if (!window.confirm(`Delete “${item.title}”? This also removes its likes and comments. This can’t be undone.`)) return;
    if (!canDeleteArticle(item.id, session)) return;
    if (deleteArticle({ articleId: item.id, session })) {
      setSubmissions(current => current.filter(entry => entry.id !== item.id));
      onDataChanged();
    }
  };

  return <section className="profile-view"><p className="eyebrow">Your account</p><h1>Keep it<br /><em>personal.</em></h1><div className="profile-card"><div className="profile-avatar">{initialsFor(session.name)}</div><div><h2>{session.name}</h2><p>{session.role === 'admin' ? 'Moderator account' : 'Member since September 2026'}</p></div><button className="text-button" onClick={onTune}>Edit path</button></div><div className="profile-section"><div className="content-label"><span>Your selected stages</span><span className="rule" /></div><div className="selected-pills">{selectedStages.length ? selectedStages.map(stage => <span key={stage}>{stage}</span>) : <span>No stages selected yet.</span>}</div></div><div className="profile-section"><div className="content-label"><span>{session.role === 'admin' ? 'All contributions' : 'Your contributions'}</span><span className="rule" /></div>{submissions.length ? <div className="moderation-list">{submissions.map((item, index) => <div className="moderation-row" key={item.id}><span className="queue-id">{String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{statusLabel[item.status]} · submitted {relativeTime(item.submittedAt)}{item.submitterEmail && session.role === 'admin' ? ` · by ${item.submittedBy}` : ''}</small></div><button type="button" onClick={() => remove(item)} disabled={!canDeleteArticle(item.id, session)}>Delete</button></div>)}</div> : <p className="text-[12px] text-muted">{session.role === 'admin' ? 'No community submissions yet.' : 'You have not submitted an article yet.'}</p>}</div><div className="profile-section"><div className="content-label"><span>Session</span><span className="rule" /></div><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">Signed in as {session.email}</span><button className="quiet-button" onClick={onSignOut}>Sign out</button></div></div><div className="privacy-note"><strong>Your privacy, by design.</strong><p>Your path and saved items are private by default. We never sell personal data.</p></div></section>;
}
function AuthRequiredView() { return <SignInRequiredView eyebrow="Private workspace" title={<>Sign in to<br /><em>moderate.</em></>} message="The review queue is limited to approved LifeStage Curator moderators." next="admin" />; }
function AdminView({ adminName, onSignOut }: { adminName: string; onSignOut: () => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>(() => loadSubmissions());
  const [reviewing, setReviewing] = useState<Submission | null>(null);

  const queue = submissions.filter(item => item.status === 'in_review');
  const approved = submissions.filter(item => item.status === 'approved').length;
  const reviewed = submissions.filter(item => item.status !== 'in_review').length;
  const approvalRate = reviewed ? Math.round((approved / reviewed) * 100) : 0;

  const decide = (status: 'approved' | 'rejected') => {
    if (!reviewing) return;
    pushNotification({
      recipientEmail: reviewing.submitterEmail,
      type: status,
      actorName: 'The moderator team',
      articleId: reviewing.id,
      articleTitle: reviewing.title
    });
    setSubmissions(updateSubmissionStatus(reviewing.id, status));
    setReviewing(null);
  };

  return <section className="admin-view">
    <div className="flex items-start justify-between gap-5"><div><p className="eyebrow">Operations / moderator view</p><h1>Keep the signal<br /><em>high.</em></h1></div><button className="quiet-button" onClick={onSignOut}>Sign out</button></div>
    <p className="mt-6 text-sm text-muted">Signed in as {adminName} · development moderator</p>
    <div className="admin-stats"><div><strong>{queue.length}</strong><span>in review</span></div><div><strong>{approvalRate}%</strong><span>approved so far</span></div><div><strong>4.7</strong><span>average quality</span></div></div>
    <div className="moderation-list"><div className="content-label"><span>Review queue</span><span className="rule" /><span>Newest first</span></div>
      {queue.length ? queue.map((item, index) => <div className="moderation-row" key={item.id}><span className="queue-id">{String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>Submitted by {item.submittedBy} · {relativeTime(item.submittedAt)}</small></div><button onClick={() => setReviewing(item)}>Review</button></div>) : <div className="empty-state">Nothing waiting for review. New submissions will appear here.</div>}
    </div>
    {reviewing && <ReviewModal submission={reviewing} onClose={() => setReviewing(null)} onDecide={decide} />}
  </section>;
}

function ReviewModal({ submission, onClose, onDecide }: { submission: Submission; onClose: () => void; onDecide: (status: 'approved' | 'rejected') => void }) {
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title" onClick={event => event.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">Review submission</p>
      <h2 id="review-title">{submission.title}</h2>
      <div className="review-meta"><span>{submission.stage}</span><span>{submission.topic}</span><span>{submission.minutes} min</span><span>By {submission.submittedBy}</span><span>{relativeTime(submission.submittedAt)}</span></div>
      {submission.url && <a className="mt-3 block break-all font-mono text-[11px] text-coral hover:text-ink" href={submission.url} target="_blank" rel="noreferrer noopener">{submission.url}</a>}
      <p className="mt-5">{submission.summary}</p>
      <div className="article-preview mt-5 max-h-[280px] overflow-auto" dangerouslySetInnerHTML={{ __html: cleanEditorHtml(submission.body) }} />
      <div className="review-actions"><button className="primary-button" onClick={() => onDecide('approved')}>Approve</button><button className="reject-button" onClick={() => onDecide('rejected')}>Reject</button></div>
    </div>
  </div>;
}
