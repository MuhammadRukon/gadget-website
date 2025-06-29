import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthFormProps } from './auth-form.types';
import { Loader } from '@/app/common/loader/loader';

export default function AuthForm({
  type,
  formData,
  isLoading = false,
  onSubmit,
  onChange,
  onGoogleClick,
}: AuthFormProps) {
  const isLogin = type === 'login';

  return (
    <div className="flex justify-center items-center mt-10 sm:mt-20">
      <Card className="w-full max-w-sm rounded-none">
        <CardHeader className="text-center">
          <CardTitle>{isLogin ? 'Login to your account' : 'Create an account'}</CardTitle>
          <CardDescription>
            {isLogin
              ? 'Enter your email below to login to your account'
              : 'Enter your details below to create your account'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-6">
              {!isLogin && (
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name || ''}
                    onChange={onChange}
                    required
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  value={formData.email}
                  onChange={onChange}
                  required
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  {isLogin && (
                    <a
                      href="#"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Forgot your password?
                    </a>
                  )}
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={onChange}
                  required
                />
              </div>

              {!isLogin && (
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword || ''}
                    onChange={onChange}
                    required
                  />
                </div>
              )}
            </div>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-2">
          <Button
            type="submit"
            className="w-full dark:bg-[#49494c] dark:text-white "
            disabled={isLoading}
          >
            {isLoading ? <Loader /> : isLogin ? 'Login' : 'Sign up'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onGoogleClick}
            disabled={isLoading}
          >
            {isLogin ? 'Login' : 'Sign up'} with Google
          </Button>

          <CardAction className="mx-auto">
            <Link
              href={isLogin ? '/signup' : '/login'}
              className="text-sm text-gray-500 text-center"
            >
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <span className="underline">{isLogin ? 'Sign up' : 'Login'}</span>
            </Link>
          </CardAction>
        </CardFooter>
      </Card>
    </div>
  );
}
