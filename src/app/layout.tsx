import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: {
    default: 'Techavaly',
    template: '%s | Techavaly',
  },
  description: 'Modern gadgets and electronics ecommerce platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={` antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
