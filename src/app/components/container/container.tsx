import { JSX } from 'react';
import { cn } from '@/lib/utils';

export interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  WrapperClassName?: string;
}

export function Container({
  children,
  className = '',
  WrapperClassName = '',
}: Readonly<ContainerProps>): JSX.Element {
  return (
    <main className={cn('w-full', WrapperClassName)}>
      <div className={cn('max-w-7xl mx-auto px-4 sm:px-14', className)}>{children}</div>
    </main>
  );
}
