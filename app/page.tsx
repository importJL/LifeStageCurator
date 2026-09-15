'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { demoSessionKey } from './demo-auth';

type Stage = { id: string; name: string; description: string; topics: string[]; color: string };
type Resource = { id: number; title: string; summary: string; stage: string; type: string; topic: string; time: string; source: string; rating: number; votes: number; featured?: boolean };

const stages: Stage[] = [
  { id: 'parenthood', name: 'Preparing for Parenthood', description: 'Make room for the person and the practical life ahead.', topics: ['Before baby', 'Finances', 'Relationships'], color: 'coral' },
  { id: 'new-parents', name: 'New Parents', description: 'Steady, useful support for the first three years.', topics: ['Sleep & settling', 'Feeding', 'Returning to work'], color: 'sage' },
  { id: 'partnership', name: 'Newlyweds / Early Partnership', description: 'Build a household that works for both of you.', topics: ['Money together', 'Home rhythms', 'Communication'], color: 'honey' },
  { id: 'new-home', name: 'Moving into a New Home', description: 'The checklists and decisions that make a place yours.', topics: ['First 30 days', 'Admin & legal', 'Making it home'], color: 'sky' },
  { id: 'grandparents', name: 'Becoming Grandparents', description: 'Find your role, your rhythm, and the joy in between.', topics: ['Being supportive', 'Staying connected', 'Family boundaries'], color: 'plum' },
  { id: 'retirement', name: 'Retirement & Later Life', description: 'Plan the next chapter with clarity and purpose.', topics: ['Financial planning', 'Health & mobility', 'Purpose & connection'], color: 'ink' }
];

const resources: Resource[] = [
  { id: 1, title: 'The calm first-month plan', summary: 'A gentle, practical checklist for the first four weeks with a new baby, covering rest, food, visitors, and asking for help.', stage: 'New Parents', type: 'Checklist', topic: 'Sleep & settling', time: '8 min', source: 'The Parent Practice', rating: 4.9, votes: 38, featured: true },
  { id: 2, title: 'A kinder conversation about money', summary: 'A guided conversation for couples building shared financial habits without turning every decision into a spreadsheet.', stage: 'Newlyweds / Early Partnership', type: 'Guide', topic: 'Money together', time: '12 min', source: 'Common Ground', rating: 4.8, votes: 24, featured: true },
  { id: 3, title: 'Your first 30 days in a new home', summary: 'The unglamorous essentials: utilities, safety checks, address changes, and the small wins that make moving feel finished.', stage: 'Moving into a New Home', type: 'Checklist', topic: 'First 30 days', time: '10 min', source: 'Homeward', rating: 4.7, votes: 19 },
  { id: 4, title: 'The retirement runway', summary: 'A plain-language guide to turning a vague retirement date into a sequence of decisions you can actually make.', stage: 'Retirement & Later Life', type: 'Article', topic: 'Financial planning', time: '15 min', source: 'Clear Money', rating: 4.6, votes: 51 },
  { id: 5, title: 'Boundaries that keep grandparents close', summary: 'Ideas for showing up generously while respecting the parents at the center of a growing family.', stage: 'Becoming Grandparents', type: 'Podcast', topic: 'Family boundaries', time: '28 min', source: 'The Family Table', rating: 4.8, votes: 16 },
  { id: 6, title: 'What to decide before baby arrives', summary: 'A short set of prompts about leave, care, visitors, and the support network you want around you.', stage: 'Preparing for Parenthood', type: 'Guide', topic: 'Before baby', time: '9 min', source: 'Good Start', rating: 4.5, votes: 12 },
  { id: 7, title: 'Finding purpose after the calendar clears', summary: 'A reflective worksheet for designing a week with movement, people, and projects that matter to you.', stage: 'Retirement & Later Life', type: 'Worksheet', topic: 'Purpose & connection', time: '20 min', source: 'Second Act', rating: 4.4, votes: 9 }
];

const icons: Record<string, string> = { Home: '01', Explore: '02', Saved: '03', Submit: '04', Profile: '05', Admin: '06' };

export default function Home() {
  const [view, setView] = useState('Home');
  const [query, setQuery] = useState('');
  const [activeStage, setActiveStage] = useState('All stages');
  const [activeType, setActiveType] = useState('All types');
  const [saved, setSaved] = useState<number[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>(['New Parents', 'Retirement & Later Life']);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    const stored = window.localStorage.getItem('lsc-saved');
    const preferences = window.localStorage.getItem('lsc-stages');
    const session = window.localStorage.getItem(demoSessionKey);
    if (stored) setSaved(JSON.parse(stored));
    if (preferences) setSelectedStages(JSON.parse(preferences));
    if (session) {
      const parsedSession = JSON.parse(session) as { name?: string; role?: string };
      setIsAdmin(parsedSession.role === 'admin');
      setAdminName(parsedSession.name || 'Moderator');
    }
    if (new URLSearchParams(window.location.search).get('view') === 'Admin') setView('Admin');
  }, []);

  const toggleSaved = (id: number) => {
    const next = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id];
    setSaved(next);
    window.localStorage.setItem('lsc-saved', JSON.stringify(next));
  };

  const filteredResources = useMemo(() => resources.filter(resource => {
    const matchesQuery = `${resource.title} ${resource.summary} ${resource.topic} ${resource.source}`.toLowerCase().includes(query.toLowerCase());
    const matchesStage = activeStage === 'All stages' || resource.stage === activeStage;
    const matchesType = activeType === 'All types' || resource.type === activeType;
    return matchesQuery && matchesStage && matchesType;
  }), [query, activeStage, activeType]);

  const myPath = resources.filter(resource => selectedStages.includes(resource.stage));
  const visibleResources = view === 'Saved' ? resources.filter(resource => saved.includes(resource.id)) : view === 'Home' ? myPath : filteredResources;

  const updateStages = (name: string) => setSelectedStages(current => current.includes(name) ? current.filter(stage => stage !== name) : [...current, name]);
  const finishOnboarding = () => { window.localStorage.setItem('lsc-stages', JSON.stringify(selectedStages)); setShowOnboarding(false); };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">L/</span><span>LifeStage<br /><b>Curator</b></span></div>
      <p className="sidebar-label">Your library</p>
      <nav aria-label="Primary navigation">{['Home', 'Explore', 'Saved', 'Submit'].map(item => <button key={item} className={`nav-item ${view === item ? 'active' : ''}`} onClick={() => setView(item)}><span className="nav-number">{icons[item]}</span>{item}<span className="nav-arrow">{view === item ? '>' : ''}</span></button>)}</nav>
      <p className="sidebar-label">Account</p>
      <nav aria-label="Account navigation">{['Profile', 'Admin'].map(item => <button key={item} className={`nav-item ${view === item ? 'active' : ''}`} onClick={() => item === 'Admin' && !isAdmin ? window.location.assign('/login?next=admin') : setView(item)}><span className="nav-number">{icons[item]}</span>{item}{item === 'Admin' && !isAdmin && <span className="ml-auto font-mono text-[9px] text-muted">LOCKED</span>}<span className="nav-arrow">{view === item ? '>' : ''}</span></button>)}</nav>
      <div className="sidebar-note"><span className="note-dot" />Curated by people<br />who have been there.</div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="crumb">LIFE / <span>{view.toUpperCase()}</span></div><div className="top-actions"><button className="quiet-button" onClick={() => setShowOnboarding(true)}>Tune my path</button><button className="avatar" aria-label="Open profile" onClick={() => setView('Profile')}>JL</button></div></header>
      {view === 'Home' && <><section className="welcome"><div><p className="eyebrow">Tuesday, 15 September</p><h1>Make room for<br /><em>what&apos;s next.</em></h1><p className="intro">A calmer way to find the practical guidance you need for life&apos;s big transitions.</p></div><div className="welcome-stamp"><span>YOUR PATH</span><strong>{selectedStages.length || 0}</strong><small>stages selected</small></div></section><section className="path-strip"><div><p className="section-kicker">Picked for your path</p><h2>Start where you are</h2></div><button className="text-button" onClick={() => setShowOnboarding(true)}>Edit stages <span>-&gt;</span></button></section></>}
      {view === 'Explore' && <section className="page-heading"><p className="eyebrow">Browse the library</p><h1>Find your next<br /><em>good step.</em></h1><p className="intro">Six life stages, thoughtfully organized. Start broad or follow a thread.</p></section>}
      {view === 'Saved' && <section className="page-heading compact"><p className="eyebrow">Your personal shelf</p><h1>Saved for<br /><em>later.</em></h1><p className="intro">{saved.length ? `${saved.length} pieces of guidance waiting for you.` : 'Save something useful and it will live here.'}</p></section>}
      {view === 'Submit' && <SubmitView />}
      {view === 'Profile' && <ProfileView selectedStages={selectedStages} onTune={() => setShowOnboarding(true)} />}
      {view === 'Admin' && (isAdmin ? <AdminView adminName={adminName} onSignOut={() => { window.localStorage.removeItem(demoSessionKey); setIsAdmin(false); setView('Home'); }} /> : <AuthRequiredView />)}
      {(view === 'Home' || view === 'Explore' || view === 'Saved') && <><section className="filters"><div className="search-wrap"><span>/</span><input aria-label="Search resources" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search guides, questions, ideas..." /></div><select aria-label="Filter by stage" value={activeStage} onChange={event => setActiveStage(event.target.value)}><option>All stages</option>{stages.map(stage => <option key={stage.id}>{stage.name}</option>)}</select><select aria-label="Filter by type" value={activeType} onChange={event => setActiveType(event.target.value)}><option>All types</option>{['Article', 'Checklist', 'Guide', 'Podcast', 'Worksheet'].map(type => <option key={type}>{type}</option>)}</select></section>{view === 'Home' && <div className="content-label"><span>For your selected stages</span><span className="rule" /><button onClick={() => setView('Explore')}>See all resources -&gt;</button></div>}{view !== 'Home' && <div className="content-label"><span>{filteredResources.length} resources</span><span className="rule" /></div>}<section className="resource-grid">{visibleResources.length ? visibleResources.map(resource => <ResourceCard key={resource.id} resource={resource} saved={saved.includes(resource.id)} onSave={() => toggleSaved(resource.id)} />) : <div className="empty-state">No saved resources match this view yet.</div>}</section>{view === 'Home' && <section className="stage-section"><div className="content-label"><span>Explore a life stage</span><span className="rule" /><button onClick={() => setView('Explore')}>Browse all -&gt;</button></div><div className="stage-grid">{stages.map(stage => <button className={`stage-card ${stage.color}`} key={stage.id} onClick={() => { setActiveStage(stage.name); setView('Explore'); }}><span className="stage-index">0{stages.indexOf(stage) + 1}</span><strong>{stage.name}</strong><small>{stage.description}</small><span className="stage-topics">{stage.topics.slice(0, 2).join('  /  ')}</span></button>)}</div></section>}</>}
    </main>
    {showOnboarding && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="tune-title"><button className="modal-close" onClick={() => setShowOnboarding(false)} aria-label="Close">x</button><p className="eyebrow">Shape your path</p><h2 id="tune-title">What chapter are<br /><em>you in?</em></h2><p>Select everything that feels relevant. You can change this anytime.</p><div className="stage-options">{stages.map(stage => <button key={stage.id} className={selectedStages.includes(stage.name) ? 'selected' : ''} onClick={() => updateStages(stage.name)}><span>{selectedStages.includes(stage.name) ? '[x]' : '[ ]'}</span>{stage.name}</button>)}</div><button className="primary-button" onClick={finishOnboarding}>Save my path</button></div></div>}
  </div>;
}

function ResourceCard({ resource, saved, onSave }: { resource: Resource; saved: boolean; onSave: () => void }) {
  return <article className={`resource-card ${resource.featured ? 'featured' : ''}`}><div className="card-top"><span className="type-label">{resource.type}</span><button className={`save-button ${saved ? 'saved' : ''}`} onClick={onSave} aria-label={saved ? 'Remove from saved' : 'Save resource'}>{saved ? 'Saved' : '+ Save'}</button></div><p className="card-stage">{resource.stage} / {resource.topic}</p><h3><Link href={`/articles/${resource.id}`} className="hover:text-coral">{resource.title}</Link></h3><p className="card-summary">{resource.summary}</p><div className="card-footer"><span>{resource.source}</span><span>{resource.time} <b>·</b> {resource.rating} / 5</span></div><Link href={`/articles/${resource.id}`} className="mt-4 font-mono text-[10px] uppercase tracking-[.08em] text-coral hover:text-ink">Read article -&gt;</Link></article>;
}

function SubmitView() {
  return <section className="form-view"><p className="eyebrow">Add to the commons</p><h1>Share something<br /><em>useful.</em></h1><p className="intro">Know a resource that made a real difference? Send it our way. Every submission is reviewed before it joins the library.</p><ArticleComposer /></section>;
}

const editorTools = [
  { label: 'B', command: 'bold', title: 'Bold' },
  { label: 'I', command: 'italic', title: 'Italic' },
  { label: 'H2', command: 'formatBlock', value: 'h2', title: 'Heading' },
  { label: '• List', command: 'insertUnorderedList', title: 'Bulleted list' },
  { label: '1. List', command: 'insertOrderedList', title: 'Numbered list' },
  { label: '“ Quote', command: 'formatBlock', value: 'blockquote', title: 'Quote' }
];

function cleanEditorHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/ on[a-z]+="[^"]*"/gi, '').replace(/javascript:/gi, '');
}

function ArticleComposer() {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('<p>Start with the practical insight you want someone to carry into their week.</p>');
  const [preview, setPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = body;
  }, []);

  const format = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    setBody(editorRef.current?.innerHTML || body);
  };

  const submitArticle = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    alert('Thanks. Your article is ready for editorial review.');
  };

  return <form className="submit-form" onSubmit={submitArticle}>
    <div className="flex items-center justify-between border-b border-line pb-4"><div><p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-coral">Article composer</p><p className="m-0 mt-1 text-xs text-muted">Write, format, then preview your contribution.</p></div><button type="button" className="save-button" onClick={() => setPreview(current => !current)}>{preview ? 'Edit article' : 'Preview article'}</button></div>
    <label>Article title <input type="text" value={title} onChange={event => setTitle(event.target.value)} placeholder="A clear, useful title" required /></label>
    <label>Short summary <textarea value={summary} onChange={event => setSummary(event.target.value)} placeholder="What will someone get from this?" maxLength={1200} required /><span className="-mt-1 text-right font-sans text-[10px] normal-case text-[#8b938c]">{summary.length}/1200</span></label>
    <div className="form-row"><label>Life stage <select required defaultValue=""><option value="">Choose one</option>{stages.map(stage => <option key={stage.id}>{stage.name}</option>)}</select></label><label>Topic <input type="text" placeholder="e.g. Sleep & settling" required /></label></div>
    <div><div className="mb-2 flex flex-wrap items-center gap-1 border border-line bg-[#f2f4ee] p-2" aria-label="Article formatting toolbar">{editorTools.map(tool => <button key={tool.command + tool.label} type="button" title={tool.title} className="border border-transparent bg-white px-2 py-1 font-mono text-[10px] text-muted hover:border-coral hover:text-ink" onMouseDown={event => event.preventDefault()} onClick={() => format(tool.command, tool.value)}>{tool.label}</button>)}<button type="button" title="Add link" className="border border-transparent bg-white px-2 py-1 font-mono text-[10px] text-muted hover:border-coral hover:text-ink" onClick={() => { const url = window.prompt('Link URL'); if (url) format('createLink', url); }}>Link</button></div><div className="mb-2 flex items-center justify-between"><label className="!block">Article body</label><span className="font-mono text-[9px] uppercase tracking-[.08em] text-[#8b938c]">Rich text</span></div>{preview ? <div className="article-preview" dangerouslySetInnerHTML={{ __html: cleanEditorHtml(body) }} /> : <div ref={editorRef} className="article-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Article body" aria-multiline="true" onInput={event => setBody(event.currentTarget.innerHTML)} />}</div>
    <button className="primary-button" type="submit">Submit article for review -&gt;</button><p className="form-note">Your article will remain unpublished until a curator reviews it. Content is practical information, not a substitute for professional advice.</p>
  </form>;
}
function ProfileView({ selectedStages, onTune }: { selectedStages: string[]; onTune: () => void }) { return <section className="profile-view"><p className="eyebrow">Your account</p><h1>Keep it<br /><em>personal.</em></h1><div className="profile-card"><div className="profile-avatar">JL</div><div><h2>Jordan Lee</h2><p>Member since September 2026</p></div><button className="text-button" onClick={onTune}>Edit path</button></div><div className="profile-section"><div className="content-label"><span>Your selected stages</span><span className="rule" /></div><div className="selected-pills">{selectedStages.length ? selectedStages.map(stage => <span key={stage}>{stage}</span>) : <span>No stages selected yet.</span>}</div></div><div className="privacy-note"><strong>Your privacy, by design.</strong><p>Your path and saved items are private by default. We never sell personal data.</p></div></section>; }
function AuthRequiredView() { return <section className="admin-view"><p className="eyebrow">Private workspace</p><h1>Sign in to<br /><em>moderate.</em></h1><p className="intro">The review queue is limited to approved LifeStage Curator moderators.</p><Link className="primary-button mt-8 inline-block" href="/login?next=admin">Go to sign in -&gt;</Link></section>; }
function AdminView({ adminName, onSignOut }: { adminName: string; onSignOut: () => void }) { return <section className="admin-view"><div className="flex items-start justify-between gap-5"><div><p className="eyebrow">Operations / moderator view</p><h1>Keep the signal<br /><em>high.</em></h1></div><button className="quiet-button" onClick={onSignOut}>Sign out</button></div><p className="mt-6 text-sm text-muted">Signed in as {adminName} · development moderator</p><div className="admin-stats"><div><strong>18</strong><span>in review</span></div><div><strong>94%</strong><span>approved this month</span></div><div><strong>4.7</strong><span>average quality</span></div></div><div className="moderation-list"><div className="content-label"><span>Review queue</span><span className="rule" /><span>Newest first</span></div>{['A guide to choosing childcare', 'Downsizing without losing your footing', 'The new-parent return-to-work plan'].map((item, index) => <div className="moderation-row" key={item}><span className="queue-id">0{index + 1}</span><div><strong>{item}</strong><small>Submitted by community member · 2h ago</small></div><button>Review</button></div>)}</div></section>; }
