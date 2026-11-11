import { Module } from '@nestjs/common';
import { ResendModule } from '@/integrations/notifications/resend/resend.module';
import { NumberingModule } from '@/modules/numbering/numbering.module';
import { ContractsModule } from '@/modules/contracts/contracts.module';
import { ProposalsController } from './proposals.controller';
import { ProposalApprovalRulesController, ProposalTemplatesController } from './proposal-templates.controller';
import { PublicProposalsController } from './public-proposals.controller';
import { ProposalsService } from './proposals.service';
import { ProposalFlowService } from './proposal-flow.service';
import { ProposalPublicService } from './proposal-public.service';
import { ProposalTemplatesService } from './proposal-templates.service';
import { ProposalMailer } from './proposal-mailer.service';
import { ProposalsMcp } from './proposals.mcp';
import { ProposalsJobs } from './proposals.jobs';

/** 03 Proposals & Quotations (docs/features/03-proposal-quotation-generator.md). */
@Module({
    imports: [NumberingModule, ResendModule, ContractsModule],
    controllers: [ProposalsController, ProposalTemplatesController, ProposalApprovalRulesController, PublicProposalsController],
    providers: [ProposalsService, ProposalFlowService, ProposalPublicService, ProposalTemplatesService, ProposalMailer, ProposalsMcp, ProposalsJobs],
    exports: [ProposalsService],
})
export class ProposalsModule { }
