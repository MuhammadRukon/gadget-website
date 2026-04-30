import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
});
export type CredentialsInput = z.infer<typeof credentialsSchema>;

export const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
  phone: z.string().min(6).max(20).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8).max(72),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
