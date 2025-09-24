'use client';

import { FormEvent, useState } from 'react';

import AuthForm from '@/components/auth/auth-form';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Signup form submitted:', formData);
    } catch (error) {
      console.error('Signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);

    try {
      console.log('Google signup clicked');
    } catch (error) {
      console.error('Google signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthForm
      type="signup"
      formData={formData}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      onChange={handleChange}
      onGoogleClick={handleGoogleSignup}
    />
  );
}
