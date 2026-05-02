import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { Analytics } from '@vercel/analytics/next';
import localFont from 'next/font/local';

const googleSans = localFont({
  src: [
    {
      path: './fonts/GoogleSans-Regular.ttf',
      weight: '400',
    },
    {
      path: './fonts/GoogleSans-Medium.ttf',
      weight: '500',
    },
    {
      path: './fonts/GoogleSans-SemiBold.ttf',
      weight: '600',
    },
    {
      path: './fonts/GoogleSans-Bold.ttf',
      weight: '700',
    },
    {
      path: './fonts/GoogleSans-Italic.ttf',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-google-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'Cryptech',
    template: '%s | Cryptech',
  },
  description: 'Modern gadgets and electronics ecommerce platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${googleSans.variable}`}>
      <body suppressHydrationWarning className="antialiased">
        <Providers>
          {children}
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
