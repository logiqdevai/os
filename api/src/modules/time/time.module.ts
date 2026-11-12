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
import { FilesModule } from '@/modules/files/files.module';
import { CommunicationsModule } from '@/modules/communications/communications.module';
import { TimeSuggestionsController } from './suggestions/time-suggestions.controller';
import { TimeSuggestionsService } from './suggestions/time-suggestions.service';
import { TimeImportController } from './imports/time-import.controller';
import { TimeImportService } from './imports/time-import.service';
import { TimeReportSchedulesController } from './schedules/time-report-schedules.controller';
import { TimeReportSchedulesService } from './schedules/time-report-schedules.service';

/** 18 Time Tracking — docs/features/18-time-tracking.md. */
@Module({
    imports: [FilesModule, CommunicationsModule],
    controllers: [
        TimeSettingsController, TimersController, TimesheetsController, BillingRatesController, TimeReportsController, TimeSuggestionsController, TimeImportController,
        TimeReportSchedulesController, TimeEntriesController,
    ],
    providers: [TimeAccessService, TimeLedgerService, TimeLookupsService, TimeSettingsService, TimeEntriesService, TimersService, TimesheetsService, BillingRatesService, TimeReportsService,
        TimeSuggestionsService, TimeImportService, TimeReportSchedulesService, TimeMcp,
    ],
    exports: [TimeAccessService, TimeEntriesService, TimeReportsService],
})
export class TimeModule { }
