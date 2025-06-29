import { ChangeEvent } from 'react';
import { FormEvent } from 'react';

export interface AuthFormProps {
  type: 'login' | 'signup';
  formData: {
    email: string;
    password: string;
    name?: string;
    confirmPassword?: string;
  };
  isLoading?: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onGoogleClick: () => void;
}
