import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { BranchesMcp } from './branches.mcp';

@Module({
    controllers: [BranchesController],
    providers: [BranchesService, BranchesMcp],
    exports: [BranchesService],
})
export class BranchesModule { }
