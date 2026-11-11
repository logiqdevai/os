import { Module } from '@nestjs/common';
import { DocsAccessService } from './docs-access.service';
import { DocsSpacesService } from './services/spaces.service';
import { DocsPagesService } from './services/pages.service';
import { DocsTemplatesService } from './services/templates.service';
import { DocsChecklistsService } from './services/checklists.service';
import { DocsFormsService } from './services/forms.service';
import { DocsSpacesController } from './controllers/spaces.controller';
import { DocsPagesController } from './controllers/pages.controller';
import { DocsTemplatesController } from './controllers/templates.controller';
import { DocsChecklistsController } from './controllers/checklists.controller';
import { DocsFormsController } from './controllers/forms.controller';
import { DocsPublicFormsController } from './controllers/public-forms.controller';
import { DocsMcp } from './docs.mcp';

/** 15 Business Docs — spaces, pages, templates, checklists, forms. Services are exported for automation (20) and other modules. */
@Module({
    controllers: [DocsSpacesController, DocsPagesController, DocsTemplatesController, DocsChecklistsController, DocsFormsController, DocsPublicFormsController],
    providers: [DocsAccessService, DocsSpacesService, DocsPagesService, DocsTemplatesService, DocsChecklistsService, DocsFormsService, DocsMcp],
    exports: [DocsAccessService, DocsSpacesService, DocsPagesService, DocsTemplatesService, DocsChecklistsService, DocsFormsService],
})
export class DocsModule { }
