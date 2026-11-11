import { Module } from '@nestjs/common';
import { FinanceSharedModule } from '@/modules/finance-shared/finance-shared.module';
import { LedgerRecordsController, LedgerRecurringController, LedgerReportsController, LedgerSetupController } from './ledger.controller';
import { LedgerConfigService } from './services/ledger-config.service';
import { LedgerRecordsService } from './services/ledger-records.service';
import { LedgerSyncService } from './services/ledger-sync.service';
import { LedgerSuppliersService } from './services/ledger-suppliers.service';
import { RecurringExpensesService } from './services/recurring-expenses.service';
import { ExpenseClaimsService } from './services/expense-claims.service';
import { LedgerReportsService } from './services/ledger-reports.service';
import { LedgerPlanningService } from './services/ledger-planning.service';
import { LedgerMcp } from './ledger.mcp';

/**
 * 09 Income & Expense Management (docs/features/09-income-expense-management.md). Owns the ledger; 08 Billing calls
 * LedgerSyncService so every invoice and payment has exactly one income record here.
 */
@Module({
    imports: [FinanceSharedModule],
    controllers: [LedgerRecordsController, LedgerSetupController, LedgerRecurringController, LedgerReportsController],
    providers: [LedgerConfigService, LedgerRecordsService, LedgerSyncService, LedgerSuppliersService, RecurringExpensesService, ExpenseClaimsService, LedgerReportsService, LedgerPlanningService, LedgerMcp],
    exports: [LedgerConfigService, LedgerRecordsService, LedgerSyncService, LedgerReportsService],
})
export class LedgerModule { }
