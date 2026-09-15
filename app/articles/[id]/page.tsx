import Link from 'next/link';
import { notFound } from 'next/navigation';
import TypeExperience from './TypeExperience';

type Article = {
  id: string;
  type: string;
  stage: string;
  topic: string;
  title: string;
  dek: string;
  source: string;
  reviewed: string;
  time: string;
  takeaways: string[];
  sections: { heading: string; paragraphs: string[] }[];
  related: { id: string; title: string; type: string }[];
};

const articles: Article[] = [
  {
    id: '1', type: 'Checklist', stage: 'New Parents', topic: 'Sleep & settling', title: 'The calm first-month plan',
    dek: 'A gentle, practical checklist for the first four weeks with a new baby, covering rest, food, visitors, and asking for help.', source: 'The Parent Practice', reviewed: 'September 12, 2026', time: '8 min read',
    takeaways: ['Protect one reliable rest window for each adult.', 'Make feeding and hydration visible and easy.', 'Decide in advance who can help and what “help” means.'],
    sections: [
      { heading: 'Lower the bar on purpose', paragraphs: ['The first month is not a performance review. Your job is to keep a small household fed, rested where possible, and connected enough to ask for help.', 'Choose three daily essentials: food, rest, and one moment of fresh air or human contact. Everything else is a bonus. A short list makes it easier to notice what is going right.'] },
      { heading: 'Build a handoff rhythm', paragraphs: ['Talk with your partner about the next 24 hours rather than trying to solve the next year. Who gets the first rest window? When will meals appear? Who is the point person for messages and visitors?', 'Write the plan somewhere visible. It can change tomorrow. The value is not precision; it is removing decisions when everyone is tired.'] },
      { heading: 'Let support be specific', paragraphs: ['“Let me know if you need anything” is kind but hard to act on. Give trusted people a menu: bring dinner, hold the baby while someone showers, run a pharmacy errand, or take out the bins.', 'You are allowed to accept help that does not look perfect. A useful meal and a clean-enough kitchen are more valuable than a beautifully executed visit.'] }
    ],
    related: [{ id: '6', title: 'What to decide before baby arrives', type: 'Guide' }, { id: '5', title: 'Boundaries that keep grandparents close', type: 'Podcast' }]
  },
  {
    id: '2', type: 'Guide', stage: 'Newlyweds / Early Partnership', topic: 'Money together', title: 'A kinder conversation about money',
    dek: 'A guided conversation for couples building shared financial habits without turning every decision into a spreadsheet.', source: 'Common Ground', reviewed: 'September 8, 2026', time: '12 min read',
    takeaways: ['Start with what money means to each of you, not only what it buys.', 'Choose a small shared experiment before merging every account.', 'Schedule money conversations so they do not only happen during conflict.'],
    sections: [
      { heading: 'Begin with stories, not numbers', paragraphs: ['People rarely enter a household with the same money story. One person may associate saving with safety; another may associate it with missing out. Neither story needs to win before you can make a plan.', 'Ask: What did money feel like growing up? What does “enough” mean this year? What financial decision are you proud of? Listen for the values underneath the answers.'] },
      { heading: 'Create a shared baseline', paragraphs: ['List the recurring costs that keep the household running, then agree on a simple way to cover them. This might be proportional contributions, a shared account, or a hybrid approach.', 'Keep personal spending room in the plan. Autonomy is not evidence that you are pulling apart; it can make shared decisions feel more generous.'] },
      { heading: 'Make the next conversation easy', paragraphs: ['Put a 25-minute check-in on the calendar once a month. Bring one number, one question, and one small decision. End by naming what is already working.', 'The goal is a household language for money, not a perfect system on the first try.'] }
    ],
    related: [{ id: '3', title: 'Your first 30 days in a new home', type: 'Checklist' }, { id: '4', title: 'The retirement runway', type: 'Article' }]
  },
  {
    id: '3', type: 'Checklist', stage: 'Moving into a New Home', topic: 'First 30 days', title: 'Your first 30 days in a new home',
    dek: 'The unglamorous essentials: utilities, safety checks, address changes, and the small wins that make moving feel finished.', source: 'Homeward', reviewed: 'September 5, 2026', time: '10 min read',
    takeaways: ['Handle safety and essential services before cosmetic projects.', 'Keep one “still to decide” list instead of carrying everything in your head.', 'Create one comfortable corner early. It helps the whole place feel livable.'],
    sections: [
      { heading: 'Days one through three: make it safe', paragraphs: ['Locate the water shutoff, electrical panel, smoke alarms, and spare keys. Test the locks and replace batteries where needed. Photograph the meter readings and any existing damage.', 'Set up the services you depend on daily: power, water, internet, rubbish collection, and medication delivery. The goal is a functioning base camp, not a finished home.'] },
      { heading: 'Week one: make the admin boring', paragraphs: ['Update your address with the people and services that matter. Keep a single note with confirmation numbers, appointment dates, and questions for the landlord, agent, or utility provider.', 'Unpack the items that support sleep, meals, work, and washing first. Those four categories make the biggest difference to daily steadiness.'] },
      { heading: 'Weeks two through four: add belonging', paragraphs: ['Choose one small area to make distinctly yours: a reading chair, a breakfast shelf, an entryway, or a wall for photographs. A home becomes familiar through repeated rituals more than one large decorating day.', 'Keep a running list of future projects and choose only one for this month. The rest can wait.'] }
    ],
    related: [{ id: '2', title: 'A kinder conversation about money', type: 'Guide' }, { id: '6', title: 'What to decide before baby arrives', type: 'Guide' }]
  },
  {
    id: '4', type: 'Article', stage: 'Retirement & Later Life', topic: 'Financial planning', title: 'The retirement runway',
    dek: 'A plain-language guide to turning a vague retirement date into a sequence of decisions you can actually make.', source: 'Clear Money', reviewed: 'September 1, 2026', time: '15 min read',
    takeaways: ['Separate the date you want to stop working from the decisions that make it possible.', 'Build a current picture before chasing an ideal forecast.', 'Plan for identity, time, and relationships alongside money.'],
    sections: [
      { heading: 'Start with the shape of the life', paragraphs: ['A retirement plan is more useful when it describes the life your money needs to support. Sketch an ordinary Tuesday: where are you, who do you see, what costs money, and what gives the day purpose?', 'This is not a forecast. It is a way to turn an abstract milestone into choices that can be reviewed.'] },
      { heading: 'Work backward in three horizons', paragraphs: ['Use three horizons: the next 12 months, the first five years after work, and later life. The first horizon is for concrete actions and conversations. The second is for spending patterns and experiments. The third is for care, housing, and resilience.', 'Keep the first version simple. A clear list of questions for a qualified financial professional is more valuable than false precision.'] },
      { heading: 'Practice the transition', paragraphs: ['Try a smaller version of retirement before the date arrives. Take a longer break, volunteer, join a class, or redesign one weekly routine. Notice what gives the time structure and what leaves you feeling connected.', 'Financial readiness matters, but so does having a life you are moving toward.'] }
    ],
    related: [{ id: '7', title: 'Finding purpose after the calendar clears', type: 'Worksheet' }, { id: '3', title: 'Your first 30 days in a new home', type: 'Checklist' }]
  },
  {
    id: '5', type: 'Podcast', stage: 'Becoming Grandparents', topic: 'Family boundaries', title: 'Boundaries that keep grandparents close',
    dek: 'Ideas for showing up generously while respecting the parents at the center of a growing family.', source: 'The Family Table', reviewed: 'August 28, 2026', time: '28 min listen',
    takeaways: ['Ask what kind of support is welcome before arriving with a solution.', 'A boundary is information about how to stay connected, not a rejection.', 'Build trust through consistency rather than one perfect gesture.'],
    sections: [
      { heading: 'Take your cue from the parents', paragraphs: ['The new family is learning its own rhythms. Before offering advice or making plans, ask what would make this week easier. Sometimes the answer is a meal; sometimes it is a quiet visit; sometimes it is space.', 'Specific questions make support easier to receive: “Would tomorrow afternoon or next Saturday be more useful?”'] },
      { heading: 'Stay curious as things change', paragraphs: ['Guidance about babies, screens, food, and sleep changes over time. You do not need to agree with every choice to respect the people responsible for making it.', 'Try asking what they have learned recently. Curiosity keeps a relationship open when certainty would create distance.'] },
      { heading: 'Make connection repeatable', paragraphs: ['A short weekly call, a photo ritual, or a predictable helping day can matter more than occasional grand plans. Reliable presence gives everyone less to coordinate.', 'The role is not to be the expert in the room. It is to be a safe, generous person to have in the family.'] }
    ],
    related: [{ id: '1', title: 'The calm first-month plan', type: 'Checklist' }, { id: '6', title: 'What to decide before baby arrives', type: 'Guide' }]
  },
  {
    id: '6', type: 'Guide', stage: 'Preparing for Parenthood', topic: 'Before baby', title: 'What to decide before baby arrives',
    dek: 'A short set of prompts about leave, care, visitors, and the support network you want around you.', source: 'Good Start', reviewed: 'August 25, 2026', time: '9 min read',
    takeaways: ['Discuss the first two weeks, not only the birth plan.', 'Name your default decision-makers for health and admin questions.', 'Make a list of help you can request without explaining the whole situation.'],
    sections: [
      { heading: 'Talk about the first two weeks', paragraphs: ['Birth preparation often focuses on one important day. Make room for the ordinary days immediately after: who will be home, how meals happen, what visitors are welcome, and what happens when plans change.', 'Write down the version you currently imagine. Treat it as a starting point, not a promise.'] },
      { heading: 'Choose your support circle', paragraphs: ['List the people you can call for emotional support, practical tasks, professional questions, and emergency backup. One person does not need to fill every role.', 'Share the list with your partner or trusted person. Asking for help works better when the next step is already clear.'] },
      { heading: 'Leave room for revision', paragraphs: ['New information will arrive. A plan that changes is doing its job. Set a weekly check-in during the final month to update logistics and talk about how each of you is feeling.', 'Preparation is less about controlling the experience than making it easier to adapt together.'] }
    ],
    related: [{ id: '1', title: 'The calm first-month plan', type: 'Checklist' }, { id: '5', title: 'Boundaries that keep grandparents close', type: 'Podcast' }]
  },
  {
    id: '7', type: 'Worksheet', stage: 'Retirement & Later Life', topic: 'Purpose & connection', title: 'Finding purpose after the calendar clears',
    dek: 'A reflective worksheet for designing a week with movement, people, and projects that matter to you.', source: 'Second Act', reviewed: 'August 20, 2026', time: '20 min read',
    takeaways: ['Notice the activities that leave you feeling more like yourself.', 'Design a week before trying to design a whole new identity.', 'Make connection a calendar item, not a hopeful side effect.'],
    sections: [
      { heading: 'Map the energy of a week', paragraphs: ['Draw seven columns and write down the activities you already do. Mark which ones give energy, use energy, or connect you to people. Patterns often appear before answers do.', 'Do not judge the list. It is a map of your current life, not a verdict on it.'] },
      { heading: 'Choose three anchors', paragraphs: ['Pick one anchor for movement, one for connection, and one for contribution or learning. Keep each small enough to repeat. A weekly walk, a standing lunch, and an afternoon project are enough to begin.', 'The anchors create shape while leaving room for spontaneity.'] },
      { heading: 'Run a two-week experiment', paragraphs: ['Try the new rhythm for two weeks, then ask: What did I look forward to? What felt forced? Who did I see? What would I keep if the week became difficult?', 'Purpose is often discovered through participation. Let the experiment teach you what matters.'] }
    ],
    related: [{ id: '4', title: 'The retirement runway', type: 'Article' }, { id: '5', title: 'Boundaries that keep grandparents close', type: 'Podcast' }]
  }
];

export function generateStaticParams() {
  return articles.map(article => ({ id: article.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const article = articles.find(item => item.id === params.id);
  return { title: article ? `${article.title} | LifeStage Curator` : 'Article | LifeStage Curator', description: article?.dek };
}

export default function ArticlePage({ params }: { params: { id: string } }) {
  const article = articles.find(item => item.id === params.id);
  if (!article) notFound();

  return <main className="min-h-screen bg-paper">
    <div className="mx-auto max-w-[1120px] px-5 pb-20 sm:px-8">
      <header className="flex h-[82px] items-center justify-between border-b border-line">
        <Link href="/" className="flex items-center gap-[10px] text-[13px] leading-[1.05] tracking-[.02em] text-ink"><span className="grid h-8 w-8 place-items-center bg-coral text-[17px] font-bold text-white">L/</span><span>LifeStage<br /><b>Curator</b></span></Link>
        <Link href="/" className="font-mono text-[10px] uppercase tracking-[.08em] text-muted hover:text-coral">Back to library -&gt;</Link>
      </header>

      <article className="mx-auto max-w-[820px] pt-16 sm:pt-24">
        <div className="mb-5 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[.08em] text-coral"><span>{article.type}</span><span className="text-line">/</span><span className="text-muted">{article.stage}</span><span className="text-line">/</span><span className="text-muted">{article.topic}</span></div>
        <h1 className="max-w-[780px] text-[clamp(44px,7vw,78px)] font-medium leading-[.98] tracking-[-.04em] text-ink">{article.title}</h1>
        <p className="mt-7 max-w-[650px] text-[18px] leading-[1.55] text-muted">{article.dek}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4 border-y border-line py-4 font-mono text-[10px] uppercase tracking-[.06em] text-muted"><span>By {article.source}</span><span className="text-coral">{article.time}</span><span>Reviewed {article.reviewed}</span></div>

        <div className="mt-12 grid gap-5 border-l-[3px] border-coral bg-[#f0e7dc] p-6 sm:grid-cols-[150px_1fr] sm:p-8"><strong className="font-display text-[21px] font-medium text-ink">In brief</strong><ul className="m-0 grid gap-3 pl-5 text-[14px] leading-[1.55] text-ink">{article.takeaways.map(takeaway => <li key={takeaway}>{takeaway}</li>)}</ul></div>

        <TypeExperience article={article} />

        <div className="mt-16 border-t border-line pt-8"><p className="font-mono text-[10px] uppercase tracking-[.08em] text-muted">Keep exploring</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{article.related.map(related => <Link href={`/articles/${related.id}`} key={related.id} className="group border border-line bg-white p-5 hover:-translate-y-0.5 hover:border-coral"><span className="font-mono text-[10px] uppercase tracking-[.08em] text-coral">{related.type}</span><strong className="mt-3 block font-display text-[21px] font-medium leading-tight text-ink group-hover:text-coral">{related.title}</strong><span className="mt-5 block font-mono text-[10px] uppercase tracking-[.08em] text-muted">Read next -&gt;</span></Link>)}</div></div>

        <aside className="mt-12 border-t border-line pt-6 text-[12px] leading-[1.6] text-muted"><strong className="text-ink">A note on professional advice.</strong> LifeStage Curator shares practical information and community resources. This article is not medical, legal, financial, or mental-health advice. Seek a qualified professional for guidance about your situation.</aside>
      </article>
    </div>
  </main>;
}
