export const HealthCheckStatus = {
    OK: 'ok',
    DOWN: 'down',
    NOT_CONFIGURED: 'not_configured',
} as const;

export type HealthCheckStatusType =
    (typeof HealthCheckStatus)[keyof typeof HealthCheckStatus];

export const HealthServiceName = {
    API: 'api',
    POSTGRES: 'postgres',
    REDIS: 'redis',
} as const;

export type HealthServiceNameType =
    (typeof HealthServiceName)[keyof typeof HealthServiceName];

export interface HealthCheckResult {
    status: HealthCheckStatusType;
    ms?: number;
    message?: string;
}

export interface ApiHealthResponse {
    service: typeof HealthServiceName.API;
    status: typeof HealthCheckStatus.OK;
    timestamp: string;
    uptime_ms: number;
}

export interface ServiceHealthResponse {
    service: typeof HealthServiceName.POSTGRES | typeof HealthServiceName.REDIS;
    status: HealthCheckStatusType;
    timestamp: string;
    ms?: number;
    message?: string;
}

export type HealthResponse = ApiHealthResponse | ServiceHealthResponse;
