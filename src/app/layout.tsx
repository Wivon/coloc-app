import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'ColocApp',
    template: '%s · ColocApp',
  },
  description: 'Tâches, dépenses et comptes de colocation, au même endroit.',
  applicationName: 'ColocApp',
  appleWebApp: {
    capable: true,
    title: 'ColocApp',
    // `default` garde la barre d'état lisible dans les deux thèmes.
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf8' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0e10' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Laisse le contenu passer sous l'encoche et la barre d'accueil iOS.
  viewportFit: 'cover',
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
