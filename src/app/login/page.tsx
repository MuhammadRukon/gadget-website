'use client';

import { FormEvent, useState } from 'react';

import AuthForm from '@/components/auth/auth-form';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Add your login logic here
      console.log('Login form submitted:', formData);
    } catch (error) {
      console.error('Login error:', error);
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

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      // Add your Google login logic here
      console.log('Google login clicked');
    } catch (error) {
      console.error('Google login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthForm
      type="login"
      formData={formData}
      isLoading={isLoading}
      onSubmit={handleSubmit}
      onChange={handleChange}
      onGoogleClick={handleGoogleLogin}
    />
  );
}
