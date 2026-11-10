export const AppUrls = {
    billing: `${process.env.APP_URL}/dashboard/billing/account`,
    resetPassword: (token: string) =>
        `${process.env.APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`,
} as const;

export const ApiUrls = {
    api_url: process.env.API_URL,
} as const;