'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { signupSchema, type SignupInput } from '@/contracts/auth';
import { signupAction } from '@/modules/auth/actions';
import { AuthCard } from '@/modules/auth/components/auth-card';
import { GoogleButton } from '@/modules/auth/components/google-button';
import { Loader } from '@/app/common/loader/loader';

export default function SignupPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', phone: '' },
  });

  async function onSubmit(values: SignupInput) {
    setIsSubmitting(true);
    const res = await signupAction({
      ...values,
      phone: values.phone || undefined,
    });

    if (!res.ok) {
      setIsSubmitting(false);
      if (res.fieldErrors) {
        for (const [key, message] of Object.entries(res.fieldErrors)) {
          form.setError(key as keyof SignupInput, { message });
        }
      }
      toast.error(res.message ?? 'Could not create account');
      return;
    }

    // Auto sign-in so the user lands logged in - same UX as the user just
    // walking through a single flow.
    const signin = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setIsSubmitting(false);

    if (!signin || signin.error) {
      toast.success('Account created. Please sign in.');
      router.push('/login');
      return;
    }
    toast.success('Welcome!');
    router.push('/');
    router.refresh();
  }

  return (
    <AuthCard
      title="Create an account"
      description="Enter your details below to get started."
      footer={
        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Login
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Your full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" placeholder="m@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Phone <span className="text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    autoComplete="tel"
                    placeholder="+8801XXXXXXXXX"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader /> : 'Create account'}
          </Button>
        </form>
      </Form>
      <GoogleButton callbackUrl="/" disabled={isSubmitting} label="Sign up with Google" />
    </AuthCard>
  );
}
