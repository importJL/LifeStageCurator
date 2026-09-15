'use client';

import { useState } from 'react';

type Section = { heading: string; paragraphs: string[] };
type Article = { type: string; sections: Section[]; takeaways: string[] };

export default function TypeExperience({ article }: { article: Article }) {
  if (article.type === 'Checklist') return <ChecklistExperience article={article} />;
  if (article.type === 'Worksheet') return <WorksheetExperience article={article} />;
  if (article.type === 'Guide') return <GuideExperience article={article} />;
  return <ArticleExperience article={article} />;
}

function ExperienceShell({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mt-14 grid gap-12 sm:grid-cols-[150px_1fr] sm:gap-16"><div className="font-mono text-[10px] uppercase tracking-[.08em] text-coral">{label}</div><div>{children}</div></div>;
}

function ArticleExperience({ article }: { article: Article }) {
  return <ExperienceShell label="The article"><div className="grid gap-12">{article.sections.map(section => <section key={section.heading}><h2 className="mb-4 font-display text-[30px] font-medium leading-tight text-ink">{section.heading}</h2>{section.paragraphs.map(paragraph => <p className="mb-4 text-[16px] leading-[1.75] text-[#424a44]" key={paragraph}>{paragraph}</p>)}</section>)}</div></ExperienceShell>;
}

function GuideExperience({ article }: { article: Article }) {
  return <ExperienceShell label="Work through it"><div className="grid gap-4">{article.sections.map((section, index) => <section className="border border-line bg-white p-6 sm:p-7" key={section.heading}><div className="mb-5 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-coral font-mono text-[11px] text-white">{String(index + 1).padStart(2, '0')}</span><h2 className="m-0 font-display text-[27px] font-medium leading-tight text-ink">{section.heading}</h2></div>{section.paragraphs.map(paragraph => <p className="mb-4 text-[15px] leading-[1.7] text-[#424a44] last:mb-0" key={paragraph}>{paragraph}</p>)}<div className="mt-5 border-t border-line pt-4 font-mono text-[10px] uppercase tracking-[.08em] text-coral">Next step: talk it through</div></section>)}</div></ExperienceShell>;
}

function ChecklistExperience({ article }: { article: Article }) {
  const items = article.sections.flatMap(section => section.paragraphs.slice(0, 1).map(paragraph => ({ label: section.heading, detail: paragraph })));
  const [checked, setChecked] = useState<boolean[]>(items.map(() => false));
  const completed = checked.filter(Boolean).length;

  return <ExperienceShell label="Work through it"><div><div className="mb-5 flex items-end justify-between"><div><h2 className="m-0 font-display text-[30px] font-medium text-ink">Your working checklist</h2><p className="mb-0 mt-2 text-sm text-muted">Tick off what is useful today. You can leave the rest for later.</p></div><span className="font-mono text-[10px] uppercase tracking-[.08em] text-coral">{completed}/{items.length} done</span></div><div className="mb-6 h-1 bg-line"><div className="h-1 bg-coral transition-all" style={{ width: `${items.length ? completed / items.length * 100 : 0}%` }} /></div><div className="grid gap-3">{items.map((item, index) => <label className={`flex cursor-pointer gap-4 border p-5 transition ${checked[index] ? 'border-sage bg-[#f0f5ee]' : 'border-line bg-white hover:border-coral'}`} key={item.label}><input className="mt-1 h-4 w-4 accent-coral" type="checkbox" checked={checked[index]} onChange={() => setChecked(current => current.map((value, itemIndex) => itemIndex === index ? !value : value))} /><span><strong className={`block font-display text-[21px] font-medium ${checked[index] ? 'text-muted line-through' : 'text-ink'}`}>{item.label}</strong><span className="mt-1 block text-[13px] leading-[1.55] text-muted">{item.detail}</span></span></label>)}</div></div></ExperienceShell>;
}

function WorksheetExperience({ article }: { article: Article }) {
  const [responses, setResponses] = useState<string[]>(article.sections.map(() => ''));
  return <ExperienceShell label="Make it yours"><div><div className="mb-6"><h2 className="m-0 font-display text-[30px] font-medium text-ink">A page to come back to</h2><p className="mb-0 mt-2 text-sm leading-[1.6] text-muted">There is no right answer. Use these prompts to notice what feels energising, possible, or worth exploring.</p></div><div className="grid gap-5">{article.sections.map((section, index) => <label className="grid gap-3 border border-line bg-white p-5 sm:p-6" key={section.heading}><span className="font-display text-[22px] font-medium text-ink">{section.heading}</span><span className="text-[13px] leading-[1.55] text-muted">{section.paragraphs[0]}</span><textarea className="min-h-[112px] resize-y border border-line bg-[#fafbf8] p-3 text-sm leading-[1.6] text-ink outline-coral" placeholder="Write a few thoughts..." value={responses[index]} onChange={event => setResponses(current => current.map((value, responseIndex) => responseIndex === index ? event.target.value : value))} /></label>)}</div><p className="mt-4 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Your responses stay in this page for this demo session.</p></div></ExperienceShell>;
}
