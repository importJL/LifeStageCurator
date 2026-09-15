'use client';

import Link from 'next/link';
import { useState } from 'react';
import { demoAdmin, demoSessionKey } from '../demo-auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showDemoCredentials, setShowDemoCredentials] = useState(true);

  const signIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim().toLowerCase() !== demoAdmin.email || password !== demoAdmin.password) {
      setError('That email and password do not match the development account.');
      return;
    }

    window.localStorage.setItem(demoSessionKey, JSON.stringify({ email: demoAdmin.email, name: demoAdmin.name, role: 'admin' }));
    const destination = new URLSearchParams(window.location.search).get('next') || '/';
    window.location.assign(destination === 'admin' ? '/?view=Admin' : destination);
  };

  const useDemoAccount = () => {
    setEmail(demoAdmin.email);
    setPassword(demoAdmin.password);
    setError('');
  };

  return <main className="min-h-screen bg-paper">
    <div className="mx-auto flex min-h-screen max-w-[1120px] flex-col px-5 pb-12 sm:px-8">
      <header className="flex h-[82px] items-center justify-between border-b border-line">
        <Link href="/" className="flex items-center gap-[10px] text-[13px] leading-[1.05] tracking-[.02em] text-ink"><span className="grid h-8 w-8 place-items-center bg-coral text-[17px] font-bold text-white">L/</span><span>LifeStage<br /><b>Curator</b></span></Link>
        <Link href="/" className="font-mono text-[10px] uppercase tracking-[.08em] text-muted hover:text-coral">Back to library -&gt;</Link>
      </header>

      <div className="grid flex-1 place-items-center py-16">
        <section className="w-full max-w-[450px]">
          <p className="eyebrow">Welcome back</p>
          <h1 className="m-0 text-[clamp(46px,7vw,72px)] font-medium leading-[.98] tracking-[-.04em] text-ink">Come back to<br /><em className="font-display font-medium">your path.</em></h1>
          <p className="mt-6 max-w-[380px] text-[15px] leading-[1.6] text-muted">Sign in to keep your saved resources, preferences, and curator tools together.</p>

          <form className="mt-9 grid gap-5 border border-line bg-white p-6 sm:p-8" onSubmit={signIn}>
            <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[.06em] text-muted">Email address<input className="border border-line bg-[#fafbf8] p-[13px] font-sans text-[13px] outline-coral" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label className="grid gap-2 font-mono text-[10px] uppercase tracking-[.06em] text-muted">Password<input className="border border-line bg-[#fafbf8] p-[13px] font-sans text-[13px] outline-coral" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Your password" required /></label>
            {error && <p className="m-0 border-l-[3px] border-coral bg-[#f0e7dc] p-3 text-xs leading-[1.5] text-ink" role="alert">{error}</p>}
            <button className="primary-button" type="submit">Sign in -&gt;</button>
            <p className="m-0 text-center text-xs text-muted">New here? <button type="button" className="border-0 bg-transparent p-0 text-coral hover:text-ink">Create a demo account</button></p>
          </form>

          {showDemoCredentials && <div className="mt-5 border border-coral bg-[#f1e8dd] p-5"><div className="flex items-start justify-between gap-4"><div><p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-coral">Development access</p><p className="mb-0 mt-2 text-xs leading-[1.5] text-muted">Use the sample moderator account to preview the admin dashboard.</p></div><button type="button" className="border-0 bg-transparent font-mono text-[10px] text-muted" onClick={() => setShowDemoCredentials(false)} aria-label="Hide development credentials">x</button></div><button type="button" className="mt-4 w-full border border-line bg-white p-3 text-left hover:border-coral" onClick={useDemoAccount}><span className="block font-mono text-[10px] uppercase tracking-[.06em] text-muted">Sample admin</span><strong className="mt-1 block font-mono text-xs font-normal text-ink">{demoAdmin.email}</strong><span className="mt-1 block font-mono text-xs text-ink">{demoAdmin.password}</span></button></div>}
        </section>
      </div>
    </div>
  </main>;
}
