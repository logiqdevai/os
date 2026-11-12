import { Module } from '@nestjs/common';
import { AiService } from './services/ai.service';
import { OrgAiService } from './services/org-ai.service';
import { AiConfig } from './utils/ai.config';

@Module({
    imports: [],
    providers: [AiService, AiConfig, OrgAiService],
    exports: [AiService, OrgAiService],
})
export class AiIntegrationModule { }
