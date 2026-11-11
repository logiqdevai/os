import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** The authenticated principal (`request.user`, set by JwtGuard) or one of its fields. */
export const CurrentUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user;
    return data ? user?.[data] : user;
});
