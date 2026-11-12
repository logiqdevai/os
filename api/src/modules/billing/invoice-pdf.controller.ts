import { Controller, Get, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { PermissionsGuard } from '@/shared/authorization/guards/permissions.guard';
import { CurrentOrg, RequirePermission } from '@/shared/authorization/decorators/require-permission.decorator';
import { OrgContext } from '@/shared/authorization/interfaces/org-context.interface';
import { streamable } from '@/modules/files/utils/streamable.utils';
import { InvoicePdfService } from './services/invoice-pdf.service';

/** 08 — invoice PDF (scope-checked through InvoicesService.findOne). */
@ApiTags('Billing · Invoices')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtGuard, PermissionsGuard)
export class InvoicePdfController {
    constructor(private readonly pdf: InvoicePdfService) { }

    @Get('invoices/:id/pdf')
    @RequirePermission('finance.invoices.read')
    @ApiOperation({ summary: 'Invoice as a branded PDF (finalized invoices are stored once in Files: Invoice.pdf_document_id)' })
    async download(@CurrentOrg() ctx: OrgContext, @Param('id') id: string): Promise<StreamableFile> {
        return streamable(await this.pdf.download(ctx, id));
    }
}
