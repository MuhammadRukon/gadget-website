import React, { JSX } from 'react';

import { ContainerProps } from './container.types';

export function Container({
  children,
  className = '',
  WrapperClassName = '',
}: ContainerProps): JSX.Element {
  return (
    <div className={`w-full ${WrapperClassName}`}>
      <div className={`container mx-auto px-4 ${className}`}>{children}</div>
    </div>
  );
}
