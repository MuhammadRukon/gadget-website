import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: {
    default: 'Tecnologia',
    template: '%s | Tecnologia',
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
