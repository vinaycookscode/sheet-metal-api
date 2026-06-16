/**
 * String-literal mirrors of the PostgreSQL enum types in SCHEMA.sql.
 * Kept as `as const` arrays so they double as: the TypeORM column `enum`,
 * the class-validator `@IsIn(...)` source, and a derived TS union type.
 */
export const ITEM_TYPES = [
  'raw_sheet',
  'hardware',
  'consumable',
  'sub_assembly',
  'finished_good',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

// operation_master.rate_basis is a free varchar in the schema; constrain it here.
export const RATE_BASES = [
  'per_sec',
  'per_bend',
  'per_mm_weld',
  'per_part',
  'per_hr',
] as const;
export type RateBasis = (typeof RATE_BASES)[number];

export const INQUIRY_STATUSES = ['new', 'estimating', 'quoted', 'won', 'lost', 'cancelled'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const SO_STATUSES = ['confirmed', 'in_production', 'dispatched', 'invoiced', 'closed', 'cancelled'] as const;
export type SoStatus = (typeof SO_STATUSES)[number];

export const SO_LINE_STATUSES = ['open', 'released_to_plan', 'in_production', 'completed', 'dispatched', 'closed'] as const;
export type SoLineStatus = (typeof SO_LINE_STATUSES)[number];

export const GST_TREATMENTS = ['intra_state', 'inter_state', 'export', 'exempt'] as const;
export type GstTreatment = (typeof GST_TREATMENTS)[number];

export const ESTIMATE_DETAIL_TYPES = ['material', 'operation', 'hardware', 'outside', 'setup'] as const;
export type EstimateDetailType = (typeof ESTIMATE_DETAIL_TYPES)[number];

export const WO_STATUSES = ['planned', 'released', 'in_progress', 'completed', 'closed', 'cancelled'] as const;
export type WoStatus = (typeof WO_STATUSES)[number];

export const OP_STATUSES = ['queued', 'in_progress', 'completed', 'skipped'] as const;
export type OpStatus = (typeof OP_STATUSES)[number];

export const PO_STATUSES = ['draft', 'approved', 'sent', 'acknowledged', 'partially_received', 'received', 'closed', 'cancelled'] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const GRN_STATUSES = ['draft', 'posted', 'cancelled'] as const;
export type GrnStatus = (typeof GRN_STATUSES)[number];

export const STOCK_TXN_TYPES = ['grn_receipt', 'wo_issue', 'remnant_return', 'adjustment', 'dispatch', 'scrap'] as const;
export type StockTxnType = (typeof STOCK_TXN_TYPES)[number];

export const INSPECTION_KINDS = ['incoming', 'in_process', 'final'] as const;
export type InspectionKind = (typeof INSPECTION_KINDS)[number];

export const INSPECTION_RESULTS = ['pass', 'fail', 'pending'] as const;
export type InspectionResult = (typeof INSPECTION_RESULTS)[number];

export const NCR_DISPOSITIONS = ['use_as_is', 'rework', 'scrap', 'return_to_supplier', 'pending'] as const;
export type NcrDisposition = (typeof NCR_DISPOSITIONS)[number];

export const NCR_STATUSES = ['open', 'dispositioned', 'closed'] as const;
export type NcrStatus = (typeof NCR_STATUSES)[number];

export const NCR_SOURCES = ['incoming', 'in_process', 'final', 'customer'] as const;
export type NcrSource = (typeof NCR_SOURCES)[number];

export const SHIPMENT_STATUSES = ['draft', 'packed', 'dispatched', 'delivered'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
