import type { Response } from 'express';
import { CsvExport } from './csv.utils';

/** Write a CSV export as a download (UTF-8 BOM so spreadsheets detect the encoding). */
export function sendCsv(res: Response, file: CsvExport) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('X-Record-Count', String(file.count));
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Record-Count');
    res.send(`﻿${file.content}`);
}
