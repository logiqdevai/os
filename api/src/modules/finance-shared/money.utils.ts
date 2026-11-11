import { Prisma, TaxBehavior } from 'generated/prisma';

/**
 * Decimal-safe money helpers for 08 Billing and 09 Ledger. Never use JS floats for amounts:
 * every calculation goes through Prisma.Decimal (decimal.js) and is rounded half-up to 2 places.
 */
export type DecimalLike = Prisma.Decimal | number | string | null | undefined;

export const dec = (v: DecimalLike): Prisma.Decimal => new Prisma.Decimal(v === null || v === undefined || v === '' ? 0 : v);
export const round2 = (v: DecimalLike): Prisma.Decimal => dec(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const sum = (values: DecimalLike[]): Prisma.Decimal => values.reduce<Prisma.Decimal>((acc, v) => acc.plus(dec(v)), dec(0));
export const isZero = (v: DecimalLike) => dec(v).abs().lessThan(0.005);
export const max0 = (v: DecimalLike) => (dec(v).lessThan(0) ? dec(0) : dec(v));
/** Plain number for JSON reports (2 decimals). */
export const num = (v: DecimalLike) => Number(round2(v).toFixed(2));

export interface VatInput {
    net_amount?: DecimalLike;
    gross_amount?: DecimalLike;
    vat_percent?: DecimalLike;
    pricing_mode?: TaxBehavior;
}

/**
 * 09 "VAT Management": derive net / VAT / gross from one entered amount and the VAT percentage.
 * EXCLUSIVE: the entered amount is net. INCLUSIVE: the entered amount is gross.
 */
export function computeVat(input: VatInput) {
    const pct = dec(input.vat_percent);
    if (input.pricing_mode === TaxBehavior.INCLUSIVE) {
        const gross = round2(input.gross_amount ?? input.net_amount);
        const net = round2(gross.dividedBy(dec(1).plus(pct.dividedBy(100))));
        return { net_amount: net, vat_amount: round2(gross.minus(net)), gross_amount: gross, vat_percent: pct };
    }
    const net = round2(input.net_amount ?? input.gross_amount);
    const vat = round2(net.times(pct).dividedBy(100));
    return { net_amount: net, vat_amount: vat, gross_amount: round2(net.plus(vat)), vat_percent: pct };
}

export interface LineInput {
    quantity: DecimalLike;
    unit_amount: DecimalLike;
    discount_amount?: DecimalLike;
    adjustment_amount?: DecimalLike;
    tax_percent?: DecimalLike;
    tax_behavior?: TaxBehavior;
}

export interface LineAmounts {
    net_amount: Prisma.Decimal;
    tax_amount: Prisma.Decimal;
    gross_amount: Prisma.Decimal;
}

/** 08 invoice line: (qty × unit − discount + adjustment) taxed by the line rate. Inclusive rates extract the tax. */
export function computeLine(line: LineInput): LineAmounts {
    const base = round2(dec(line.quantity).times(dec(line.unit_amount)).minus(dec(line.discount_amount)).plus(dec(line.adjustment_amount)));
    const vat = computeVat({ net_amount: base, gross_amount: base, vat_percent: line.tax_percent, pricing_mode: line.tax_behavior ?? TaxBehavior.EXCLUSIVE });
    return { net_amount: vat.net_amount, tax_amount: vat.vat_amount, gross_amount: vat.gross_amount };
}

export interface InvoiceDiscount {
    type: 'PERCENTAGE' | 'FIXED';
    value: DecimalLike;
}

/**
 * Invoice totals with an optional invoice-level discount (coupon). The discount is spread over the lines pro rata
 * before tax so the tax total stays correct per rate.
 */
export function computeInvoiceTotals(lines: (LineAmounts & { tax_percent?: DecimalLike })[], discount?: InvoiceDiscount | null) {
    const subtotal = round2(sum(lines.map((l) => l.net_amount)));
    let discountTotal = dec(0);
    if (discount && subtotal.greaterThan(0)) {
        discountTotal = discount.type === 'PERCENTAGE' ? round2(subtotal.times(dec(discount.value)).dividedBy(100)) : round2(Prisma.Decimal.min(dec(discount.value), subtotal));
    }
    const factor = subtotal.greaterThan(0) ? dec(1).minus(discountTotal.dividedBy(subtotal)) : dec(1);
    const taxTotal = round2(sum(lines.map((l) => (discountTotal.isZero() ? l.tax_amount : dec(l.net_amount).times(factor).times(dec(l.tax_percent)).dividedBy(100)))));
    const total = round2(subtotal.minus(discountTotal).plus(taxTotal));
    return { subtotal, discount_total: discountTotal, tax_total: taxTotal, total };
}

/** Add `count` billing intervals to a date (month arithmetic clamps to the end of the month). */
export function addInterval(date: Date, interval: 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR', count = 1, dayOfMonth?: number | null): Date {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    if (interval === 'DAY') d.setUTCDate(d.getUTCDate() + count);
    else if (interval === 'WEEK') d.setUTCDate(d.getUTCDate() + 7 * count);
    else {
        const months = interval === 'MONTH' ? count : interval === 'QUARTER' ? 3 * count : 12 * count;
        const day = dayOfMonth ?? d.getUTCDate();
        const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
        const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
        target.setUTCDate(Math.min(day, last));
        return target;
    }
    return d;
}

/** Monthly equivalent of an amount billed every `count` intervals (MRR). */
export function monthlyEquivalent(amount: DecimalLike, interval: string, count = 1): Prisma.Decimal {
    const perMonth: Record<string, number> = { DAY: 30.4375, WEEK: 4.348125, MONTH: 1, QUARTER: 1 / 3, YEAR: 1 / 12 };
    return dec(amount).times(perMonth[interval] ?? 1).dividedBy(count || 1);
}

/** Today at 00:00 UTC (dates in @db.Date columns). */
export const todayUtc = () => {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

export const toDateOnly = (v: string | Date | null | undefined): Date | null => {
    if (!v) return null;
    const d = typeof v === 'string' ? new Date(v.length === 10 ? `${v}T00:00:00.000Z` : v) : v;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
