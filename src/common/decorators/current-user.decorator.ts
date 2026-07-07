import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SupabaseJwtPayload } from '../guards/supabase-auth.guard';

/**
 * @CurrentUser() – injects the decoded Supabase JWT payload into a controller handler.
 * Optionally accepts a key to pluck a single property:
 *   @CurrentUser('sub') userId: string
 */
export const CurrentUser = createParamDecorator(
  (key: keyof SupabaseJwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: SupabaseJwtPayload = request.user;
    return key ? user?.[key] : user;
  },
);
