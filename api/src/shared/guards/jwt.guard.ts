import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CredentialsService } from '@/shared/authorization/credentials.service';
import { PUBLIC_METADATA } from '@/shared/authorization/decorators/require-permission.decorator';

/**
 * Authenticates the request with a user JWT (`Authorization: Bearer <jwt>`) or an API key
 * (`Authorization: Bearer lqk_…` or `X-Api-Key`). Sets `request.user` to a RequestPrincipal.
 * Endpoints marked @Public() pass without a credential (a credential, if sent, is still resolved).
 */
@Injectable()
export class JwtGuard implements CanActivate {
    constructor(
        private readonly credentials: CredentialsService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, [context.getHandler(), context.getClass()]);

        const header: string | undefined = request.headers['authorization'];
        const apiKeyHeader: string | undefined = request.headers['x-api-key'];
        const token = apiKeyHeader || (header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined);

        if (!token) {
            if (isPublic) return true;
            throw new UnauthorizedException({ message: 'Authentication required', code: 'authentication_required' });
        }

        try {
            request.user = await this.credentials.resolve(token, request.ip);
            return true;
        } catch (error) {
            if (isPublic) return true;
            throw error;
        }
    }
}
