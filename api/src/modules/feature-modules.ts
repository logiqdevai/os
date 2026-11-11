import { TeamsModule } from './admin/teams/teams.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagingModule } from './messaging/messaging.module';
import { FilesModule } from './files/files.module';
import { ProposalsModule } from './proposals/proposals.module';
import { ContractsModule } from './contracts/contracts.module';
import { TimeModule } from './time/time.module';
import { DocsModule } from './docs/docs.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { CrmModule } from './crm/crm.module';
import { PeopleModule } from './people/people.module';
import { AutomationModule } from './automation/automation.module';
import { CommunicationsModule } from './communications/communications.module';
import { SupportModule } from './support/support.module';
import { PortalModule } from './portal/portal.module';
import { CalendarModule } from './calendar/calendar.module';
import { LedgerModule } from './ledger/ledger.module';
import { BillingModule } from './billing/billing.module';

/**
 * Every product feature module (docs/features/NN-*). Add a module here once; app.module.ts spreads this list.
 * Keep one import + one array line per module so parallel work merges cleanly.
 */
export const FEATURE_MODULES: any[] = [
    TeamsModule,
    AdminModule,
    NotificationsModule,
    MessagingModule,
    FilesModule,
    ProposalsModule,
    ContractsModule,
    TimeModule,
    DocsModule,
    CrmModule,
    ProjectsModule,
    TasksModule,
    PeopleModule,
    CommunicationsModule,
    SupportModule,
    PortalModule,
    CalendarModule,
    LedgerModule,
    BillingModule,
    AutomationModule,
];
