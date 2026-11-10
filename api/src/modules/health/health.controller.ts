import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import {
    HealthQuerySchema,
    type HealthQueryType,
} from './dto/health-query.schema';
import { HealthService } from './health.service';
import { HealthCheckStatus } from './interfaces/health.interface';

@ApiTags('health')
@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get()
    @ApiOperation({ summary: 'Get health status for a single service' })
    @ApiQuery({
        name: 'postgres',
        required: false,
        type: Boolean,
        description: 'Return Postgres health only',
    })
    @ApiQuery({
        name: 'redis',
        required: false,
        type: Boolean,
        description: 'Return Redis health only',
    })
    @ApiResponse({ status: 200, description: 'Health status returned' })
    @ApiResponse({ status: 503, description: 'Requested service is down' })
    async getHealth(
        @Query(new ZodValidationPipe(HealthQuerySchema)) query: HealthQueryType,
        @Res() response: Response,
    ) {
        const result = await this.healthService.check(query);
        const statusCode =
            result.service !== 'api' &&
            result.status === HealthCheckStatus.DOWN
                ? HttpStatus.SERVICE_UNAVAILABLE
                : HttpStatus.OK;

        return response.status(statusCode).json(result);
    }
}
