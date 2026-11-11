import { TeamsModule } from './admin/teams/teams.module';
import { AdminModule } from './admin/admin.module';
import { CrmModule } from './crm/crm.module';

/**
 * Every product feature module (docs/features/NN-*). Add a module here once; app.module.ts spreads this list.
 * Keep one import + one array line per module so parallel work merges cleanly.
 */
export const FEATURE_MODULES: any[] = [
    TeamsModule,
    AdminModule,
    CrmModule,
];
