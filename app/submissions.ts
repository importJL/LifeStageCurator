export type SubmissionStatus = 'in_review' | 'approved' | 'rejected';

export type Submission = {
  id: string;
  title: string;
  summary: string;
  stage: string;
  topic: string;
  minutes: string;
  body: string;
  url?: string;
  submittedBy: string;
  submitterEmail?: string;
  submittedAt: string;
  status: SubmissionStatus;
  reviewedAt?: string;
};

export const submissionsKey = 'lsc-submissions';

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

const seedSubmissions: Submission[] = [
  {
    id: 'seed-childcare',
    title: 'A guide to choosing childcare',
    summary: 'A short walkthrough of the questions that matter when comparing nurseries, childminders, and nannies — cost, ratios, settling-in, and how to trust your read of a place.',
    stage: 'New Parents',
    topic: 'Returning to work',
    minutes: '11',
    body: '<p>Choosing childcare is less about finding the perfect option and more about finding one that fits your week and your child.</p><h2>Start with the shape of your week</h2><p>Write down the hours you actually need covered, including travel and a buffer. That single number rules out more options than any review score.</p><h2>Visit twice</h2><p>One visit is a performance; two visits show you the ordinary rhythm. Ask what happens when a child is unsettled or unwell.</p>',
    submittedBy: 'Jordan Lee',
    submitterEmail: 'member@lifestage.test',
    submittedAt: hoursAgo(2),
    status: 'in_review'
  },
  {
    id: 'seed-downsizing',
    title: 'Downsizing without losing your footing',
    summary: 'A practical sequence for deciding what to keep, what to pass on, and how to make a smaller home feel like home rather than a compromise.',
    stage: 'Retirement & Later Life',
    topic: 'Downsizing',
    minutes: '14',
    body: '<p>Downsizing works best as a series of small decisions rather than one overwhelming clear-out.</p><h2>Sort by use, not by memory</h2><p>Keep what you reached for this year. Photograph the rest before it goes — the memory travels with the picture.</p><h2>Measure before you promise</h2><p>Check the new rooms against your largest pieces first. It is easier to rehome furniture than to regret it.</p>',
    submittedBy: 'Jordan Lee',
    submitterEmail: 'member@lifestage.test',
    submittedAt: hoursAgo(5),
    status: 'in_review'
  },
  {
    id: 'seed-return-to-work',
    title: 'The new-parent return-to-work plan',
    summary: 'A gentle checklist for the month before returning to work: childcare, handovers, what to say at work, and how to protect the first tired weeks.',
    stage: 'New Parents',
    topic: 'Returning to work',
    minutes: '9',
    body: '<p>Returning to work is a logistics problem wrapped in a feelings problem. Plan both.</p><h2>Run a practice week</h2><p>Do a trial run of the morning routine before it counts. You will find the gaps in an hour.</p><h2>Agree the handover</h2><p>Write down feeds, naps, and comfort routines for whoever takes over. It lowers the mental load on everyone.</p>',
    submittedBy: 'Jordan Lee',
    submitterEmail: 'member@lifestage.test',
    submittedAt: hoursAgo(9),
    status: 'in_review'
  }
];

function isSubmission(value: unknown): value is Submission {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Submission>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.summary === 'string' &&
    typeof candidate.stage === 'string' &&
    typeof candidate.topic === 'string' &&
    typeof candidate.minutes === 'string' &&
    typeof candidate.body === 'string' &&
    typeof candidate.submittedBy === 'string' &&
    (candidate.submitterEmail === undefined || typeof candidate.submitterEmail === 'string') &&
    typeof candidate.submittedAt === 'string' &&
    (candidate.status === 'in_review' || candidate.status === 'approved' || candidate.status === 'rejected')
  );
}

export function persistSubmissions(submissions: Submission[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(submissionsKey, JSON.stringify(submissions));
}

export function loadSubmissions(): Submission[] {
  if (typeof window === 'undefined') return [];
  const stored = window.localStorage.getItem(submissionsKey);
  if (!stored) {
    persistSubmissions(seedSubmissions);
    return seedSubmissions;
  }
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSubmission);
  } catch {
    return [];
  }
}

function newSubmissionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `sub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createSubmission(input: {
  title: string;
  summary: string;
  stage: string;
  topic: string;
  minutes: string;
  body: string;
  url?: string;
  submittedBy: string;
  submitterEmail?: string;
}): Submission {
  const submission: Submission = {
    id: newSubmissionId(),
    ...input,
    submittedAt: new Date().toISOString(),
    status: 'in_review'
  };
  persistSubmissions([submission, ...loadSubmissions()]);
  return submission;
}

export function findSubmissionById(id: string): Submission | null {
  return loadSubmissions().find(submission => submission.id === id) ?? null;
}

export function updateSubmissionStatus(id: string, status: 'approved' | 'rejected'): Submission[] {
  const next = loadSubmissions().map(submission =>
    submission.id === id ? { ...submission, status, reviewedAt: new Date().toISOString() } : submission
  );
  persistSubmissions(next);
  return next;
}

export function removeSubmissionById(id: string): Submission[] {
  const next = loadSubmissions().filter(submission => submission.id !== id);
  persistSubmissions(next);
  return next;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
