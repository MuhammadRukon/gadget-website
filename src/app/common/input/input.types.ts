export interface InputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
  type?: 'text' | 'number' | 'email';
  'data-testid'?: string;
}
