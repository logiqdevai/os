import type { FC } from "react";
import { IconRefresh } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetHealth } from "@/features/health/hooks/use-health";
import {
    HealthCheckStatus,
    HealthServiceName,
    type HealthCheckStatusType,
    type HealthResponse,
} from "@/features/health/interfaces/health.interfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const checkStatusVariant: Record<HealthCheckStatusType, "success" | "secondary" | "destructive"> = {
    [HealthCheckStatus.OK]: "success",
    [HealthCheckStatus.NOT_CONFIGURED]: "secondary",
    [HealthCheckStatus.DOWN]: "destructive",
};

const formatDuration = (value?: number) => {
    if (value === undefined) {
        return "—";
    }

    return `${value} ms`;
};

const formatUptime = (value?: number) => {
    if (value === undefined) {
        return "—";
    }

    const totalSeconds = Math.floor(value / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
};

const HealthStatusCard = ({
    title,
    description,
    data,
    isLoading,
    isError,
    errorMessage,
}: {
    title: string;
    description: string;
    data?: HealthResponse;
    isLoading: boolean;
    isError: boolean;
    errorMessage?: string;
}) => {
    if (isLoading) {
        return <Skeleton className="h-44 rounded-xl" />;
    }

    if (isError) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{title}</CardTitle>
                    <CardDescription>{errorMessage ?? "Unable to load health status."}</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (!data) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{title}</CardTitle>
                    <Badge variant={checkStatusVariant[data.status]}>{data.status.replace("_", " ")}</Badge>
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last checked</span>
                    <span className="font-medium">{new Date(data.timestamp).toLocaleString()}</span>
                </div>
                {data.service === HealthServiceName.API ? (
                    <>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Uptime</span>
                            <span className="font-medium">{formatUptime(data.uptime_ms)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Uptime (ms)</span>
                            <span className="font-medium">{data.uptime_ms.toLocaleString()} ms</span>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Response time</span>
                        <span className="font-medium">{formatDuration(data.ms)}</span>
                    </div>
                )}
                {"message" in data && data.message ? (
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">{data.message}</div>
                ) : null}
            </CardContent>
        </Card>
    );
};

const HealthPage: FC = () => {
    const queryClient = useQueryClient();
    const apiHealth = useGetHealth(HealthServiceName.API);
    const postgresHealth = useGetHealth(HealthServiceName.POSTGRES);
    const redisHealth = useGetHealth(HealthServiceName.REDIS);

    const isFetching = apiHealth.isFetching || postgresHealth.isFetching || redisHealth.isFetching;

    const refreshAll = () => {
        void queryClient.invalidateQueries({ queryKey: ["health"] });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
                    <p className="text-sm text-muted-foreground">Live status for the API and connected infrastructure.</p>
                </div>
                <Button variant="outline" onClick={refreshAll} disabled={isFetching}>
                    <IconRefresh className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <HealthStatusCard
                    title="API"
                    description="Core application availability."
                    data={apiHealth.data}
                    isLoading={apiHealth.isLoading}
                    isError={apiHealth.isError}
                    errorMessage={apiHealth.error instanceof Error ? apiHealth.error.message : undefined}
                />
                <HealthStatusCard
                    title="Postgres"
                    description="Database connectivity via Prisma."
                    data={postgresHealth.data}
                    isLoading={postgresHealth.isLoading}
                    isError={postgresHealth.isError}
                    errorMessage={postgresHealth.error instanceof Error ? postgresHealth.error.message : undefined}
                />
                <HealthStatusCard
                    title="Redis"
                    description="Cache and queue connectivity."
                    data={redisHealth.data}
                    isLoading={redisHealth.isLoading}
                    isError={redisHealth.isError}
                    errorMessage={redisHealth.error instanceof Error ? redisHealth.error.message : undefined}
                />
            </div>
        </div>
    );
};

export default HealthPage;
