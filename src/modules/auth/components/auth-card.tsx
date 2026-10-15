import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthCard({ title, description, footer, children }: AuthCardProps) {
  return (
    <div className="my-10 flex items-center justify-center md:my-16">
      <Card className="w-full max-w-sm rounded-lg border-rule shadow-none">
        <CardHeader className="border-b border-border pb-5">
          <CardTitle className="font-display text-2xl font-bold tracking-[-0.02em] font-stretch-expanded">
            {title}
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-6">{children}</CardContent>
        {footer ? <div className="px-6 pb-6">{footer}</div> : null}
      </Card>
    </div>
  );
}
