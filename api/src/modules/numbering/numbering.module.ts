import { Module } from '@nestjs/common';
import { NumberingService } from './numbering.service';

/** Shared document numbering (NumberSequence). Import NumberingModule and inject NumberingService. */
@Module({
    providers: [NumberingService],
    exports: [NumberingService],
})
export class NumberingModule { }
