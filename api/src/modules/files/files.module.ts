import { Module } from '@nestjs/common';
import { GcsIntegrationModule } from '@/integrations/storage/gcs/gcs.module';
import { DocumentsController } from './controllers/documents.controller';
import { FoldersController } from './controllers/folders.controller';
import { SharesController } from './controllers/shares.controller';
import { ApprovalsController } from './controllers/approvals.controller';
import { RetentionController } from './controllers/retention.controller';
import { VaultController } from './controllers/vault.controller';
import { FileSettingsController } from './controllers/settings.controller';
import { PublicFilesController } from './controllers/public-files.controller';
import { DocumentsService } from './services/documents.service';
import { FoldersService } from './services/folders.service';
import { SharesService } from './services/shares.service';
import { ApprovalsService } from './services/approvals.service';
import { RetentionService } from './services/retention.service';
import { VaultService } from './services/vault.service';
import { FileSettingsService } from './services/file-settings.service';
import { StorageService, isGcsConfigured } from './storage/storage.service';
import { FilesMcp } from './files.mcp';

/**
 * 17 Documents & File Management + credential vault.
 * Other modules import FilesModule and call `DocumentsService.upload()` / `attachToEntity()` to store files.
 * GCS is used only when GCS_PROJECT_ID + GCS_BUCKET_NAME are set; otherwise bytes go to `api/storage/`.
 */
@Module({
    imports: [...(isGcsConfigured() ? [GcsIntegrationModule] : [])],
    controllers: [PublicFilesController, DocumentsController, FoldersController, SharesController, ApprovalsController, RetentionController, VaultController, FileSettingsController],
    providers: [StorageService, FileSettingsService, DocumentsService, FoldersService, SharesService, ApprovalsService, RetentionService, VaultService, FilesMcp],
    exports: [DocumentsService, StorageService, FoldersService],
})
export class FilesModule { }
