export const LOCAL_CORS_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3001',
];

export function parseCorsUrls(value: unknown): string[] | undefined {
    if (typeof value !== 'string' || !value.trim()) {
        return undefined;
    }

    const urls = value.split(',').map((url) => url.trim()).filter(Boolean);
    return urls.length ? urls : undefined;
}

export function resolveCorsOrigins(options: {
    nodeEnv?: string;
    corsUrls?: string[];
    appUrl?: string;
    landingUrl?: string;
}): string[] {
    if (options.nodeEnv === 'local') {
        return LOCAL_CORS_ORIGINS;
    }

    if (options.corsUrls?.length) {
        return options.corsUrls;
    }

    return [options.appUrl, options.landingUrl].filter((url): url is string => Boolean(url));
}
