import { Module } from '@nestjs/common';
import { McpModule } from '@/core/mcp/mcp.module';
import { McpCallsController } from './mcp-calls.controller';
import { McpCallsService } from './mcp-calls.service';

/** Confirmation is a human-only step, so there is deliberately no MCP tool for confirm / reject. */
@Module({
    imports: [McpModule],
    controllers: [McpCallsController],
    providers: [McpCallsService],
})
export class McpCallsModule { }
