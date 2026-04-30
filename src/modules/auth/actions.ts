'use server';

import { ZodError } from 'zod';

import { authService } from '@/server/auth/auth.service';
import { signOut as authSignOut } from '@/auth';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/contracts/auth';
import { AppError, toJsonError } from '@/server/common/errors';
import { log } from '@/server/common/logger';

export interface ActionResult {
  ok: boolean;
  message?: string;
  /** dev-only convenience so the reset link is testable without email setup */
  devResetUrl?: string;
  fieldErrors?: Record<string, string>;
}

function fieldErrorsFromZod(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function signupAction(input: unknown): Promise<ActionResult> {
  try {
    const data = signupSchema.parse(input);
    await authService.signup(data);
    return { ok: true, message: 'Account created' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { ok: false, message: 'Invalid signup details', fieldErrors: fieldErrorsFromZod(err) };
    }
    if (err instanceof AppError) {
      return { ok: false, message: err.message };
    }
    log.error('auth.signup.action.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, message: toJsonError(err).message };
  }
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const data = forgotPasswordSchema.parse(input);
    const result = await authService.issuePasswordReset(data);
    const devLink =
      process.env.NODE_ENV !== 'production' && result.rawToken
        ? `/reset-password?token=${result.rawToken}`
        : undefined;
    return {
      ok: true,
      message: 'If that email is registered, a reset link has been sent.',
      devResetUrl: devLink,
    };
  } catch (err) {
    if (err instanceof ZodError) {
      return { ok: false, message: 'Invalid email', fieldErrors: fieldErrorsFromZod(err) };
    }
    log.error('auth.forgot.action.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, message: 'Could not process request' };
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const data = resetPasswordSchema.parse(input);
    await authService.resetPassword(data);
    return { ok: true, message: 'Password updated. You can now sign in.' };
  } catch (err) {
    if (err instanceof ZodError) {
      return { ok: false, message: 'Invalid reset payload', fieldErrors: fieldErrorsFromZod(err) };
    }
    if (err instanceof AppError) {
      return { ok: false, message: err.message };
    }
    log.error('auth.reset.action.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, message: toJsonError(err).message };
  }
}

export async function logoutAction(): Promise<void> {
  await authSignOut({ redirectTo: '/' });
}
