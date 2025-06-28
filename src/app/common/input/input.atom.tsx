import { FormEvent, forwardRef } from 'react';

import { InputProps } from './input.types';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      value,
      onChange,
      placeholder = '',
      error = '',
      type = 'string',
      className = '',
      'data-testid': dataTestId,
    },
    ref,
  ) => {
    return (
      <div>
        <input
          type={type}
          value={value || ''}
          ref={ref}
          className={`border rounded-md p-2 focus:outline-none ${
            error ? 'border-red-500 border-2' : 'border-gray-300'
          } ${className}`}
          onChange={(event: FormEvent<HTMLInputElement>) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          data-testid={dataTestId}
        />
        {!!error && <div>{error}</div>}
      </div>
    );
  },
);

Input.displayName = 'Input';
