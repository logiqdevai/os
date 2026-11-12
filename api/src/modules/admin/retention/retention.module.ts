import { Module } from '@nestjs/common';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';
import { RetentionMcp } from './retention.mcp';

@Module({
    controllers: [RetentionController],
    providers: [RetentionService, RetentionMcp],
})
export class RetentionModule { }
