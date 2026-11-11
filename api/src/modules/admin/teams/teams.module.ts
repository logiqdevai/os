import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { TeamsMcp } from './teams.mcp';

@Module({
    controllers: [TeamsController],
    providers: [TeamsService, TeamsMcp],
    exports: [TeamsService],
})
export class TeamsModule { }
