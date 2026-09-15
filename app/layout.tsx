import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LifeStage Curator',
  description: 'Practical guidance for the transitions that shape adult life.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
