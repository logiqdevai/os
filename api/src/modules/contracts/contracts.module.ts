import { FilesModule } from '../files/files.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResendModule } from '@/integrations/notifications/resend/resend.module';
import { NumberingModule } from '@/modules/numbering/numbering.module';
import { ContractsController } from './contracts/contracts.controller';
import { ContractsService } from './contracts/contracts.service';
import { ContractLibraryController } from './library/library.controller';
import { ContractLibraryService } from './library/library.service';
import { ContractVersionsController } from './versions/versions.controller';
import { ContractVersionsService } from './versions/versions.service';
import { ContractObligationsController } from './obligations/obligations.controller';
import { ContractObligationsService } from './obligations/obligations.service';
import { PublicSigningController, SignaturesController } from './signatures/signatures.controller';
import { SignaturesService } from './signatures/signatures.service';
import { ContractMailerService } from './shared/contract-mailer.service';
import { ContractsMcp } from './contracts.mcp';

/** 04 Contracts — records, library, versions/review/approval, obligations, in-house e-signature (also usable by 03). */
@Module({
    imports: [ConfigModule, ResendModule, NumberingModule, FilesModule],
    controllers: [ContractLibraryController, ContractsController, ContractVersionsController, ContractObligationsController, SignaturesController, PublicSigningController],
    providers: [ContractsService, ContractLibraryService, ContractVersionsService, ContractObligationsService, SignaturesService, ContractMailerService, ContractsMcp],
    exports: [ContractsService, SignaturesService],
})
export class ContractsModule { }
