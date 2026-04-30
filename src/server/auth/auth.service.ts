import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '@/server/common/errors';
import { log } from '@/server/common/logger';

import { hashPassword } from './password';
import { hashResetToken, issueResetToken } from './tokens';
import type { ForgotPasswordInput, ResetPasswordInput, SignupInput } from '@/contracts/auth';

export const authService = {
  async signup(input: SignupInput) {
    const passwordHash = await hashPassword(input.password);
    try {
      const user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          phone: input.phone,
          passwordHash,
          role: UserRole.CUSTOMER,
        },
        select: { id: true, email: true, name: true, role: true },
      });
      return user;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('An account with this email already exists', { field: 'email' });
      }
      throw err;
    }
  },

  /**
   * Issue a reset token. We always return success to the caller so that
   * the public response cannot be used to enumerate registered emails.
   * The raw token is returned only inside this server-side function;
   * the caller (a server action or API route) is responsible for
   * delivering it to the user (email, etc).
   */
  async issuePasswordReset(input: ForgotPasswordInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      log.info('auth.passwordReset.unknownEmail', { email: input.email });
      return { rawToken: null as string | null };
    }
    const issued = issueResetToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: issued.tokenHash,
        expiresAt: issued.expiresAt,
      },
    });
    return { rawToken: issued.raw };
  },

  async resetPassword(input: ResetPasswordInput) {
    if (!input.token) throw new BadRequestError('Token is required');
    const tokenHash = hashResetToken(input.token);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record) throw new NotFoundError('Reset token');
    if (record.usedAt) throw new ValidationError('This reset link has already been used');
    if (record.expiresAt.getTime() < Date.now()) {
      throw new ValidationError('This reset link has expired');
    }

    const passwordHash = await hashPassword(input.password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
    ]);
  },
};
