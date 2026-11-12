import { Module } from '@nestjs/common';
import { FilesModule } from '@/modules/files/files.module';
import { GeneratedPdfService } from './generated-pdf.service';

/** Generated PDFs with organization branding, stored through 17 Files. Used by 03, 04 and 08. */
@Module({
    imports: [FilesModule],
    providers: [GeneratedPdfService],
    exports: [GeneratedPdfService],
})
export class PdfModule { }
