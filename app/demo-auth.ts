export const demoAdmin = {
  email: 'admin@lifestage.test',
  password: 'Curate2026!',
  name: 'Alex Morgan'
};

export const demoMember = {
  email: 'member@lifestage.test',
  password: 'Belong2026!',
  name: 'Jordan Lee'
};

export const demoSessionKey = 'lsc-demo-session';

export type DemoRole = 'admin' | 'member';

export type DemoSession = {
  email: string;
  name: string;
  role: DemoRole;
};

export const demoAccounts: { label: string; account: { email: string; password: string; name: string }; role: DemoRole }[] = [
  { label: 'Sample member', account: demoMember, role: 'member' },
  { label: 'Sample admin', account: demoAdmin, role: 'admin' }
];

export function findDemoAccount(email: string, password: string) {
  return demoAccounts.find(
    entry => entry.account.email === email.trim().toLowerCase() && entry.account.password === password
  );
}

export function loadDemoSession(): DemoSession | null {
  const stored = window.localStorage.getItem(demoSessionKey);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<DemoSession>;
    if (!parsed.email || !parsed.name || (parsed.role !== 'admin' && parsed.role !== 'member')) return null;
    return { email: parsed.email, name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}

export function persistDemoSession(session: DemoSession): void {
  window.localStorage.setItem(demoSessionKey, JSON.stringify(session));
  document.cookie = `${demoSessionKey}=active; path=/; SameSite=Lax; max-age=604800`;
}

export function clearDemoSession(): void {
  window.localStorage.removeItem(demoSessionKey);
  document.cookie = `${demoSessionKey}=; path=/; SameSite=Lax; max-age=0`;
}

export function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}
