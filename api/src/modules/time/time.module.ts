import { Module } from '@nestjs/common';
import { TimeAccessService } from './common/time-access.service';
import { TimeLedgerService } from './common/time-ledger.service';
import { TimeLookupsService } from './common/time-lookups.service';
import { TimeSettingsController } from './settings/time-settings.controller';
import { TimeSettingsService } from './settings/time-settings.service';
import { TimeEntriesController } from './entries/time-entries.controller';
import { TimeEntriesService } from './entries/time-entries.service';
import { TimersController } from './timers/timers.controller';
import { TimersService } from './timers/timers.service';
import { TimesheetsController } from './timesheets/timesheets.controller';
import { TimesheetsService } from './timesheets/timesheets.service';
import { BillingRatesController } from './rates/billing-rates.controller';
import { BillingRatesService } from './rates/billing-rates.service';
import { TimeReportsController } from './reports/time-reports.controller';
import { TimeReportsService } from './reports/time-reports.service';
import { TimeMcp } from './time.mcp';

/** 18 Time Tracking — docs/features/18-time-tracking.md. */
@Module({
    controllers: [TimeSettingsController, TimersController, TimesheetsController, BillingRatesController, TimeReportsController, TimeEntriesController],
    providers: [TimeAccessService, TimeLedgerService, TimeLookupsService, TimeSettingsService, TimeEntriesService, TimersService, TimesheetsService, BillingRatesService, TimeReportsService, TimeMcp],
    exports: [TimeAccessService, TimeEntriesService, TimeReportsService],
})
export class TimeModule { }
