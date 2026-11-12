import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsMcp } from './sessions.mcp';

@Module({
    controllers: [SessionsController],
    providers: [SessionsService, SessionsMcp],
    exports: [SessionsService],
})
export class SessionsModule { }
