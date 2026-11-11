import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MembersMcp } from './members.mcp';
import { AdminAccessService } from '../shared/admin-access.service';

@Module({
    controllers: [MembersController],
    providers: [MembersService, MembersMcp, AdminAccessService],
    exports: [MembersService],
})
export class MembersModule { }
