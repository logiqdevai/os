import { Module } from '@nestjs/common';
import { CrmDefaultsService } from './common/crm-defaults.service';
import { CrmRefsService } from './common/crm-refs.service';
import { CrmCompaniesController } from './companies/companies.controller';
import { CrmCompaniesService } from './companies/companies.service';
import { CrmCompaniesMcp } from './companies/companies.mcp';
import { CrmContactsController } from './contacts/contacts.controller';
import { CrmContactsService } from './contacts/contacts.service';
import { CrmContactsMcp } from './contacts/contacts.mcp';
import { CrmLeadsController } from './leads/leads.controller';
import { CrmLeadsService } from './leads/leads.service';
import { CrmLeadsMcp } from './leads/leads.mcp';
import { CrmDealsController } from './deals/deals.controller';
import { CrmDealsService } from './deals/deals.service';
import { CrmDealsMcp } from './deals/deals.mcp';
import { CrmPipelinesController } from './pipelines/pipelines.controller';
import { CrmPipelinesService } from './pipelines/pipelines.service';
import { CrmActivitiesController } from './activities/activities.controller';
import { CrmActivitiesService } from './activities/activities.service';
import { CrmActivitiesMcp } from './activities/activities.mcp';
import { CrmNotesController } from './notes/notes.controller';
import { CrmNotesService } from './notes/notes.service';
import { CrmSettingsController } from './settings/settings.controller';
import { CrmSettingsService } from './settings/settings.service';
import { CrmInsightsController } from './insights/insights.controller';
import { CrmInsightsService } from './insights/insights.service';
import { TagsController } from './tags/tags.controller';
import { TagsService } from './tags/tags.service';
import { SavedViewsController } from './saved-views/saved-views.controller';
import { SavedViewsService } from './saved-views/saved-views.service';
import { CrmMiscMcp } from './crm-misc.mcp';

import { CrmCustomFieldValuesService } from './custom-fields/custom-field-values.service';
import { CrmCustomFieldsService } from './custom-fields/custom-fields.service';
import { CrmCustomFieldsController } from './custom-fields/custom-fields.controller';
import { CrmCustomFieldsMcp } from './custom-fields/custom-fields.mcp';
import { CrmLeadRulesService } from './rules/lead-rules.service';
import { CrmTargetsService } from './rules/targets.service';
import { CrmRulesController } from './rules/rules.controller';
import { CrmRulesMcp } from './rules/rules.mcp';

/** Extensions (02 §22–33): custom fields, rules & targets, import, merge & duplicates, bulk actions, reports. */
const FEATURE_CONTROLLERS = [CrmCustomFieldsController, CrmRulesController];
const FEATURE_PROVIDERS = [CrmCustomFieldValuesService, CrmCustomFieldsService, CrmCustomFieldsMcp, CrmLeadRulesService, CrmTargetsService, CrmRulesMcp];

/**
 * 02 CRM & Sales (docs/features/02-crm-sales-management.md) plus the platform tags and saved views it owns.
 * Other modules import this module for `CrmCompaniesService.search` / `CrmContactsService.search` (customer pickers).
 */
@Module({
    controllers: [
        CrmCompaniesController, CrmContactsController, CrmLeadsController, CrmDealsController, CrmPipelinesController,
        CrmActivitiesController, CrmNotesController, CrmSettingsController, CrmInsightsController, TagsController, SavedViewsController,
        ...FEATURE_CONTROLLERS,
    ],
    providers: [
        CrmDefaultsService, CrmRefsService,
        CrmCompaniesService, CrmContactsService, CrmLeadsService, CrmDealsService, CrmPipelinesService,
        CrmActivitiesService, CrmNotesService, CrmSettingsService, CrmInsightsService, TagsService, SavedViewsService,
        CrmCompaniesMcp, CrmContactsMcp, CrmLeadsMcp, CrmDealsMcp, CrmActivitiesMcp, CrmMiscMcp,
        ...FEATURE_PROVIDERS,
    ],
    exports: [CrmCompaniesService, CrmContactsService, CrmDealsService, CrmDefaultsService, TagsService, CrmCustomFieldValuesService],
})
export class CrmModule { }
