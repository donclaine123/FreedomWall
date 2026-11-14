import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Freedom Wall — A little more connected.',
  description: 'A little corner of the internet for your thoughts. A classic social wall, made for today.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
