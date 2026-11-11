import { Module } from '@nestjs/common';
import { NumberingModule } from '@/modules/numbering/numbering.module';
import { FinanceApprovalsService } from './finance-approvals.service';

/** Shared finance building blocks for 08 Billing and 09 Ledger: approval policy, numbering (re-exported), money helpers. */
@Module({
    imports: [NumberingModule],
    providers: [FinanceApprovalsService],
    exports: [FinanceApprovalsService, NumberingModule],
})
export class FinanceSharedModule { }
