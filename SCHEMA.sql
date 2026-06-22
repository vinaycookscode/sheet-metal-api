-- =====================================================================
-- Sheet Metal ERP — PostgreSQL schema (MVP hot tables)
-- Scope: India GST + e-way bill · general fabrication (lean QMS) ·
--        pure make-to-order job shop · single plant (multi-plant-ready)
-- Conventions: UUID PKs (pgcrypto), audit columns, soft delete,
--   org_id/plant_id tenancy, gapless doc numbering, append-only audit_log.
-- Target: PostgreSQL 15+. Run once on an empty database.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;        -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;          -- case-insensitive emails/codes

-- ---------- enums ----------------------------------------------------
CREATE TYPE item_type        AS ENUM ('raw_sheet','hardware','consumable','sub_assembly','finished_good');
CREATE TYPE inquiry_status   AS ENUM ('new','estimating','quoted','won','lost','cancelled');
CREATE TYPE quote_status     AS ENUM ('draft','sent','accepted','rejected','expired');
CREATE TYPE so_status        AS ENUM ('confirmed','in_production','dispatched','invoiced','closed','cancelled');
CREATE TYPE so_line_status   AS ENUM ('open','released_to_plan','in_production','completed','dispatched','closed');
CREATE TYPE wo_status        AS ENUM ('planned','released','in_progress','completed','closed','cancelled');
CREATE TYPE op_status        AS ENUM ('queued','in_progress','completed','skipped');
CREATE TYPE po_status        AS ENUM ('draft','approved','sent','acknowledged','partially_received','received','closed','cancelled');
CREATE TYPE grn_status       AS ENUM ('draft','posted','cancelled');
CREATE TYPE stock_txn_type   AS ENUM ('grn_receipt','wo_issue','remnant_return','adjustment','dispatch','scrap');
CREATE TYPE inspection_kind  AS ENUM ('incoming','in_process','final');
CREATE TYPE inspection_result AS ENUM ('pass','fail','pending');
CREATE TYPE ncr_disposition  AS ENUM ('use_as_is','rework','scrap','return_to_supplier','pending');
CREATE TYPE ncr_status       AS ENUM ('open','dispositioned','closed');
CREATE TYPE invoice_status   AS ENUM ('draft','issued','partially_paid','paid','cancelled');
CREATE TYPE shipment_status  AS ENUM ('draft','packed','dispatched','delivered');
CREATE TYPE gst_treatment    AS ENUM ('intra_state','inter_state','export','exempt');

-- ---------- reusable column groups (documented, applied per table) ----
-- audit:  created_at timestamptz default now(), updated_at timestamptz default now(),
--         created_by uuid, updated_by uuid, deleted_at timestamptz null
-- tenancy: org_id uuid not null, plant_id uuid (null = org-level master)

-- =====================================================================
-- 1. TENANCY & IDENTITY
-- =====================================================================
CREATE TABLE org (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  legal_name    text,
  gstin         varchar(15),
  state_code    varchar(2),                    -- GST state code (place of supply)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plant (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  code          varchar(16) NOT NULL,
  name          text NOT NULL,
  gstin         varchar(15),
  state_code    varchar(2) NOT NULL,           -- drives intra/inter-state tax
  address       jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE TABLE app_user (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  email         citext NOT NULL UNIQUE,
  full_name     text NOT NULL,
  password_hash text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  default_plant_id uuid REFERENCES plant(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE TABLE role (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  code          varchar(40) NOT NULL,          -- sales, estimator, planner, ...
  name          text NOT NULL,
  UNIQUE (org_id, code)
);

CREATE TABLE permission (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          varchar(80) NOT NULL UNIQUE    -- e.g. 'quote.approve', 'wo.release'
);

CREATE TABLE role_permission (
  role_id       uuid NOT NULL REFERENCES role(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permission(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_role (
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role_id       uuid NOT NULL REFERENCES role(id) ON DELETE CASCADE,
  plant_id      uuid REFERENCES plant(id),     -- null = all plants
  PRIMARY KEY (user_id, role_id)
);

-- =====================================================================
-- 2. PLATFORM SERVICES (numbering, documents, audit)
-- =====================================================================
CREATE TABLE doc_sequence (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  doc_type      varchar(16) NOT NULL,          -- INQ, QT, SO, WO, PO, GRN, INV, DC
  fiscal_year   varchar(9) NOT NULL,           -- '2026-27'
  prefix        varchar(16) NOT NULL,
  next_value    bigint NOT NULL DEFAULT 1,
  pad_width     int NOT NULL DEFAULT 5,
  UNIQUE (plant_id, doc_type, fiscal_year)
);
-- allocate next number transactionally: SELECT ... FOR UPDATE; UPDATE next_value+1

CREATE TABLE document (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  entity_type   varchar(40) NOT NULL,          -- 'inquiry_line','part','grn',...
  entity_id     uuid NOT NULL,
  kind          varchar(24) NOT NULL,          -- 'drawing','cert_mtr','nc_program','attachment'
  file_name     text NOT NULL,
  storage_key   text NOT NULL,                 -- S3/MinIO object key
  mime_type     text,
  version       int NOT NULL DEFAULT 1,
  uploaded_by   uuid REFERENCES app_user(id),
  review_status varchar(12) NOT NULL DEFAULT 'pending',  -- pending|approved|rejected (drawings)
  reviewed_by   uuid REFERENCES app_user(id),
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX idx_document_entity ON document (entity_type, entity_id) WHERE deleted_at IS NULL;

-- In-app notifications (one row per recipient).
CREATE TABLE notification (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES org(id),
  user_id     uuid NOT NULL REFERENCES app_user(id),
  type        varchar(32) NOT NULL,          -- 'ncr','po_approval','qc_fail',...
  title       text NOT NULL,
  body        text,
  link        text,                          -- web route to open
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);
CREATE INDEX idx_notification_user ON notification (user_id, is_read, created_at DESC);

-- Email outbox (transactional outbox; a worker/cron drains it to SMTP/Resend).
CREATE TABLE email_outbox (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES org(id),
  to_email    text NOT NULL,
  subject     text NOT NULL,
  body        text,
  status      varchar(12) NOT NULL DEFAULT 'pending',  -- pending|sent|failed
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);

CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  org_id        uuid NOT NULL,
  actor_id      uuid,
  entity_type   varchar(40) NOT NULL,
  entity_id     uuid NOT NULL,
  action        varchar(16) NOT NULL,          -- create/update/delete/status
  before        jsonb,
  after         jsonb,
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);

-- =====================================================================
-- 3. MASTER DATA
-- =====================================================================
CREATE TABLE uom (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code  varchar(12) NOT NULL UNIQUE,           -- EA, KG, MM, SQM, HR
  name  text NOT NULL
);

CREATE TABLE tax_code (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hsn_sac     varchar(8) NOT NULL,             -- HSN for goods
  description text,
  gst_rate    numeric(5,2) NOT NULL,           -- total GST % (split CGST/SGST or IGST)
  UNIQUE (hsn_sac)
);

CREATE TABLE material_grade (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES org(id),
  code        varchar(24) NOT NULL,            -- CR, HR, SS304, SS316, AL5052
  name        text NOT NULL,
  density     numeric(8,4),                    -- kg/m^3 for weight calc
  default_rate numeric(12,4),                  -- ₹/kg baseline
  is_traceable boolean NOT NULL DEFAULT false, -- heat/lot capture required
  UNIQUE (org_id, code)
);

CREATE TABLE finish_master (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES org(id),
  code   varchar(24) NOT NULL,
  name   text NOT NULL,
  is_outside boolean NOT NULL DEFAULT false,   -- powder coat/anodize → subcontract
  UNIQUE (org_id, code)
);

CREATE TABLE work_center (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id    uuid NOT NULL REFERENCES plant(id),
  code        varchar(24) NOT NULL,            -- LASER1, BRAKE1, WELD, PAINT
  name        text NOT NULL,
  capacity_hrs_per_day numeric(6,2) NOT NULL DEFAULT 8,
  hourly_rate numeric(12,4),                   -- machine+labor burden ₹/hr
  is_outside  boolean NOT NULL DEFAULT false,
  UNIQUE (plant_id, code)
);

CREATE TABLE operation_master (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES org(id),
  code            varchar(24) NOT NULL,        -- CUT, BEND, WELD, DEBURR, ASSY
  name            text NOT NULL,
  default_work_center_id uuid REFERENCES work_center(id),
  rate_basis      varchar(16) NOT NULL,        -- 'per_sec','per_bend','per_mm_weld','per_part','per_hr'
  default_rate    numeric(12,4),
  UNIQUE (org_id, code)
);

CREATE TABLE item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  code          varchar(40) NOT NULL,
  name          text NOT NULL,
  item_type     item_type NOT NULL,
  uom_id        uuid NOT NULL REFERENCES uom(id),
  tax_code_id   uuid REFERENCES tax_code(id),
  material_grade_id uuid REFERENCES material_grade(id),  -- raw sheets
  thickness_mm  numeric(6,2),
  sheet_length_mm numeric(8,2),
  sheet_width_mm  numeric(8,2),
  is_traceable  boolean NOT NULL DEFAULT false,
  std_cost      numeric(12,4),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid, updated_by uuid,          -- audit columns (BaseEntity)
  deleted_at    timestamptz,
  UNIQUE (org_id, code)
);

CREATE TABLE customer (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  code          varchar(24) NOT NULL,
  name          text NOT NULL,
  gstin         varchar(15),
  state_code    varchar(2),                    -- place of supply for tax
  billing_address jsonb,
  shipping_address jsonb,
  payment_terms_days int NOT NULL DEFAULT 30,
  credit_limit  numeric(14,2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid, updated_by uuid,          -- audit columns (BaseEntity)
  deleted_at    timestamptz,
  UNIQUE (org_id, code)
);

CREATE TABLE customer_contact (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  name         text NOT NULL,
  role         varchar(24),                    -- buyer, qa, accounts
  email        citext,
  phone        varchar(20)
);

CREATE TABLE supplier (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  code          varchar(24) NOT NULL,
  name          text NOT NULL,
  gstin         varchar(15),
  state_code    varchar(2),
  category      varchar(24),                   -- raw_material, hardware, subcontract
  lead_time_days int NOT NULL DEFAULT 7,
  payment_terms_days int NOT NULL DEFAULT 30,
  rating        numeric(3,1),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid, updated_by uuid,          -- audit columns (BaseEntity)
  deleted_at    timestamptz,
  UNIQUE (org_id, code)
);

-- =====================================================================
-- 4. CRM / INQUIRY
-- =====================================================================
CREATE TABLE inquiry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  number        varchar(24) NOT NULL,          -- INQ-2026-27-00001
  customer_id   uuid NOT NULL REFERENCES customer(id),
  status        inquiry_status NOT NULL DEFAULT 'new',
  required_date date,
  owner_id      uuid REFERENCES app_user(id),  -- sales
  estimator_id  uuid REFERENCES app_user(id),
  lost_reason   varchar(40),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid, updated_by uuid,
  UNIQUE (plant_id, number)
);

CREATE TABLE inquiry_line (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id       uuid NOT NULL REFERENCES inquiry(id) ON DELETE CASCADE,
  line_no          int NOT NULL,
  part_name        text NOT NULL,
  qty              numeric(12,3) NOT NULL,
  material_grade_id uuid REFERENCES material_grade(id),
  thickness_mm     numeric(6,2),
  finish_id        uuid REFERENCES finish_master(id),
  target_price     numeric(12,2),
  UNIQUE (inquiry_id, line_no)
);

-- =====================================================================
-- 5. ESTIMATION & QUOTING
-- =====================================================================
CREATE TABLE quote (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  number        varchar(24) NOT NULL,          -- QT-...
  inquiry_id    uuid REFERENCES inquiry(id),
  customer_id   uuid NOT NULL REFERENCES customer(id),
  current_version int NOT NULL DEFAULT 1,
  status        quote_status NOT NULL DEFAULT 'draft',
  win_loss_reason varchar(40),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid, updated_by uuid,
  UNIQUE (plant_id, number)
);

CREATE TABLE quote_version (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      uuid NOT NULL REFERENCES quote(id) ON DELETE CASCADE,
  version_no    int NOT NULL,
  valid_until   date,
  lead_time_days int,
  markup_pct    numeric(6,2),
  terms         text,
  subtotal      numeric(14,2) NOT NULL DEFAULT 0,
  tax_total     numeric(14,2) NOT NULL DEFAULT 0,
  grand_total   numeric(14,2) NOT NULL DEFAULT 0,
  is_current    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, version_no)
);

CREATE TABLE quote_line (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_version_id uuid NOT NULL REFERENCES quote_version(id) ON DELETE CASCADE,
  inquiry_line_id uuid REFERENCES inquiry_line(id),
  line_no         int NOT NULL,
  part_name       text NOT NULL,
  primary_qty     numeric(12,3) NOT NULL,
  unit_price      numeric(12,4) NOT NULL,       -- at primary_qty
  qty_break_prices jsonb,                        -- [{qty:1,price:..},{qty:10,..}]
  material_cost   numeric(12,4) DEFAULT 0,
  process_cost    numeric(12,4) DEFAULT 0,
  hardware_cost   numeric(12,4) DEFAULT 0,
  outside_cost    numeric(12,4) DEFAULT 0,
  setup_cost      numeric(12,4) DEFAULT 0,
  margin_pct      numeric(6,2),
  tax_code_id     uuid REFERENCES tax_code(id),
  UNIQUE (quote_version_id, line_no)
);

-- granular cost build-up rows behind each quote line (material/op/hardware/outside)
CREATE TABLE estimate_detail (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_line_id uuid NOT NULL REFERENCES quote_line(id) ON DELETE CASCADE,
  detail_type   varchar(16) NOT NULL,          -- 'material','operation','hardware','outside','setup'
  ref_id        uuid,                          -- material_grade / operation_master / item / finish
  description   text,
  qty           numeric(12,4),                 -- bends, weld mm, cut sec, kg, units
  rate          numeric(12,4),
  yield_pct     numeric(6,2),                  -- material nesting yield
  amount        numeric(14,4) NOT NULL DEFAULT 0
);
CREATE INDEX idx_estimate_detail_line ON estimate_detail (quote_line_id);

-- =====================================================================
-- 6. SALES ORDERS
-- =====================================================================
CREATE TABLE sales_order (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  number        varchar(24) NOT NULL,          -- SO-...
  customer_id   uuid NOT NULL REFERENCES customer(id),
  quote_version_id uuid REFERENCES quote_version(id),
  customer_po_number text,
  vendor_code   varchar(40),
  status        so_status NOT NULL DEFAULT 'confirmed',
  gst_treatment gst_treatment,                 -- resolved at confirmation
  order_date    date NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid, updated_by uuid,
  UNIQUE (plant_id, number)
);

CREATE TABLE so_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  line_no       int NOT NULL,
  quote_line_id uuid REFERENCES quote_line(id),
  part_id       uuid,                          -- set at engineering (FK added below)
  part_name     text NOT NULL,
  qty           numeric(12,3) NOT NULL,
  unit_price    numeric(12,4) NOT NULL,
  promised_date date,
  status        so_line_status NOT NULL DEFAULT 'open',
  tax_code_id   uuid REFERENCES tax_code(id),
  UNIQUE (sales_order_id, line_no)
);

-- =====================================================================
-- 7. ENGINEERING — PART / ROUTING / BOM
-- =====================================================================
CREATE TABLE part (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  part_no       varchar(40) NOT NULL,
  rev           varchar(8) NOT NULL DEFAULT 'A',
  description   text,
  material_grade_id uuid REFERENCES material_grade(id),
  thickness_mm  numeric(6,2),
  finish_id     uuid REFERENCES finish_master(id),
  flat_length_mm numeric(8,2),
  flat_width_mm  numeric(8,2),
  bend_count    int DEFAULT 0,
  is_released   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid, updated_by uuid,          -- audit columns (AuditedEntity)
  UNIQUE (org_id, part_no, rev)
);
ALTER TABLE so_line ADD CONSTRAINT fk_so_line_part FOREIGN KEY (part_id) REFERENCES part(id);

CREATE TABLE routing_op (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id       uuid NOT NULL REFERENCES part(id) ON DELETE CASCADE,
  op_no         int NOT NULL,
  operation_id  uuid REFERENCES operation_master(id),
  work_center_id uuid REFERENCES work_center(id),
  setup_minutes numeric(8,2) DEFAULT 0,
  run_seconds_per_unit numeric(10,3) DEFAULT 0,
  is_outside    boolean NOT NULL DEFAULT false,
  instructions  text,
  UNIQUE (part_id, op_no)
);

CREATE TABLE bom_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id       uuid NOT NULL REFERENCES part(id) ON DELETE CASCADE,
  component_item_id uuid REFERENCES item(id),
  component_part_id uuid REFERENCES part(id),  -- sub-assembly (recursive)
  qty_per        numeric(12,4) NOT NULL,
  scrap_pct      numeric(6,2) NOT NULL DEFAULT 0,
  CHECK (component_item_id IS NOT NULL OR component_part_id IS NOT NULL)
);
CREATE INDEX idx_bom_parent ON bom_line (part_id);

-- =====================================================================
-- 8. PLANNING & PRODUCTION (MES)  — pure MTO: WO pegs to so_line
-- =====================================================================
CREATE TABLE work_order (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  number        varchar(24) NOT NULL,          -- WO-...
  so_line_id    uuid NOT NULL REFERENCES so_line(id),   -- demand peg (MTO)
  part_id       uuid NOT NULL REFERENCES part(id),
  qty           numeric(12,3) NOT NULL,
  qty_completed numeric(12,3) NOT NULL DEFAULT 0,
  qty_scrapped  numeric(12,3) NOT NULL DEFAULT 0,
  status        wo_status NOT NULL DEFAULT 'planned',
  due_date      date,
  released_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid, updated_by uuid,          -- audit columns (AuditedEntity)
  UNIQUE (plant_id, number)
);
CREATE INDEX idx_wo_so_line ON work_order (so_line_id);

CREATE TABLE wo_operation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_order(id) ON DELETE CASCADE,
  op_no         int NOT NULL,
  routing_op_id uuid REFERENCES routing_op(id),
  work_center_id uuid REFERENCES work_center(id),
  status        op_status NOT NULL DEFAULT 'queued',
  is_outside    boolean NOT NULL DEFAULT false,
  qty_good      numeric(12,3) NOT NULL DEFAULT 0,
  qty_scrap     numeric(12,3) NOT NULL DEFAULT 0,
  UNIQUE (work_order_id, op_no)
);

CREATE TABLE labor_entry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_operation_id uuid NOT NULL REFERENCES wo_operation(id) ON DELETE CASCADE,
  operator_id   uuid NOT NULL REFERENCES app_user(id),
  clock_in      timestamptz NOT NULL,
  clock_out     timestamptz,
  qty_good      numeric(12,3) NOT NULL DEFAULT 0,
  qty_scrap     numeric(12,3) NOT NULL DEFAULT 0,
  scrap_reason  varchar(40),
  rework        boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_labor_op ON labor_entry (wo_operation_id);

-- =====================================================================
-- 9. PROCUREMENT
-- =====================================================================
CREATE TABLE purchase_requisition (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  item_id       uuid NOT NULL REFERENCES item(id),
  qty           numeric(12,3) NOT NULL,
  required_date date,
  so_line_id    uuid REFERENCES so_line(id),   -- pegged demand
  mrp_run_id    uuid,
  is_ordered    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE purchase_order (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  number        varchar(24) NOT NULL,          -- PO-...
  supplier_id   uuid NOT NULL REFERENCES supplier(id),
  status        po_status NOT NULL DEFAULT 'draft',
  is_subcontract boolean NOT NULL DEFAULT false,
  order_date    date NOT NULL DEFAULT current_date,
  approved_by   uuid REFERENCES app_user(id),
  subtotal      numeric(14,2) DEFAULT 0,
  tax_total     numeric(14,2) DEFAULT 0,
  grand_total   numeric(14,2) DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid, updated_by uuid,          -- audit columns (AuditedEntity)
  UNIQUE (plant_id, number)
);

CREATE TABLE po_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
  line_no       int NOT NULL,
  item_id       uuid NOT NULL REFERENCES item(id),
  qty           numeric(12,3) NOT NULL,
  qty_received  numeric(12,3) NOT NULL DEFAULT 0,
  unit_price    numeric(12,4) NOT NULL,
  tax_code_id   uuid REFERENCES tax_code(id),
  requisition_id uuid REFERENCES purchase_requisition(id),
  UNIQUE (purchase_order_id, line_no)
);

CREATE TABLE grn (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  number        varchar(24) NOT NULL,          -- GRN-...
  purchase_order_id uuid NOT NULL REFERENCES purchase_order(id),
  supplier_id   uuid NOT NULL REFERENCES supplier(id),
  status        grn_status NOT NULL DEFAULT 'draft',
  received_date date NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, number)
);

CREATE TABLE grn_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id        uuid NOT NULL REFERENCES grn(id) ON DELETE CASCADE,
  po_line_id    uuid NOT NULL REFERENCES po_line(id),
  item_id       uuid NOT NULL REFERENCES item(id),
  qty_received  numeric(12,3) NOT NULL,
  qty_rejected  numeric(12,3) NOT NULL DEFAULT 0,
  heat_no       varchar(40),                   -- traceability (optional)
  lot_no        varchar(40),
  cert_document_id uuid REFERENCES document(id) -- MTR upload
);

-- =====================================================================
-- 10. INVENTORY / STORES
-- =====================================================================
-- Finished-goods inventory (MTO: pegged to the SO line that produced it).
CREATE TABLE fg_stock (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  part_id       uuid NOT NULL REFERENCES part(id),
  so_line_id    uuid REFERENCES so_line(id),
  work_order_id uuid REFERENCES work_order(id),
  qty           numeric(14,3) NOT NULL DEFAULT 0,
  qty_shipped   numeric(14,3) NOT NULL DEFAULT 0,
  location      varchar(40),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fg_stock_plant ON fg_stock (plant_id, so_line_id);

CREATE TABLE stock_lot (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  item_id       uuid NOT NULL REFERENCES item(id),
  heat_no       varchar(40),
  lot_no        varchar(40),
  location      varchar(40),
  qty_on_hand   numeric(14,3) NOT NULL DEFAULT 0,
  qty_allocated numeric(14,3) NOT NULL DEFAULT 0,
  qc_status     varchar(12) NOT NULL DEFAULT 'accepted', -- accepted|hold|rejected (incoming QC)
  unit_cost     numeric(12,4),
  is_remnant    boolean NOT NULL DEFAULT false, -- offcut returned from WO
  grn_line_id   uuid REFERENCES grn_line(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_item ON stock_lot (item_id) WHERE qty_on_hand > 0;

CREATE TABLE stock_txn (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  stock_lot_id  uuid NOT NULL REFERENCES stock_lot(id),
  txn_type      stock_txn_type NOT NULL,
  qty_delta     numeric(14,3) NOT NULL,        -- + receipt / - issue
  work_order_id uuid REFERENCES work_order(id),
  reference     text,
  at            timestamptz NOT NULL DEFAULT now(),
  by_user       uuid REFERENCES app_user(id)
);
CREATE INDEX idx_stock_txn_lot ON stock_txn (stock_lot_id);

-- material reserved for a work order
CREATE TABLE material_allocation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_order(id) ON DELETE CASCADE,
  stock_lot_id  uuid NOT NULL REFERENCES stock_lot(id),
  qty_allocated numeric(14,3) NOT NULL,
  qty_issued    numeric(14,3) NOT NULL DEFAULT 0
);

-- =====================================================================
-- 11. QUALITY (lean)
-- =====================================================================
CREATE TABLE inspection (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  kind          inspection_kind NOT NULL,
  result        inspection_result NOT NULL DEFAULT 'pending',
  work_order_id uuid REFERENCES work_order(id),
  grn_line_id   uuid REFERENCES grn_line(id),
  so_line_id    uuid REFERENCES so_line(id),
  stock_lot_id  uuid REFERENCES stock_lot(id),  -- incoming inspection target
  inspector_id  uuid REFERENCES app_user(id),
  inspected_at  timestamptz,
  notes         text
);

CREATE TABLE inspection_char (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES inspection(id) ON DELETE CASCADE,
  characteristic text NOT NULL,
  nominal       numeric(12,4),
  tolerance_plus numeric(12,4),
  tolerance_minus numeric(12,4),
  measured      numeric(12,4),
  result        inspection_result NOT NULL DEFAULT 'pending'
);

CREATE TABLE ncr (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  number        varchar(24) NOT NULL,
  source        varchar(24),                   -- incoming/in_process/final/customer
  work_order_id uuid REFERENCES work_order(id),
  stock_lot_id  uuid REFERENCES stock_lot(id),
  supplier_id   uuid REFERENCES supplier(id),
  defect        text NOT NULL,
  is_critical   boolean NOT NULL DEFAULT false,
  disposition   ncr_disposition NOT NULL DEFAULT 'pending',
  status        ncr_status NOT NULL DEFAULT 'open',
  cost_of_quality numeric(12,2),
  created_at    timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz,
  UNIQUE (plant_id, number)
);

-- =====================================================================
-- 12. DISPATCH / SHIPPING
-- =====================================================================
CREATE TABLE shipment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  number        varchar(24) NOT NULL,          -- DC-... (delivery challan)
  sales_order_id uuid NOT NULL REFERENCES sales_order(id),
  status        shipment_status NOT NULL DEFAULT 'draft',
  dispatch_date date,
  carrier       text,
  freight_cost  numeric(12,2),
  tracking_no   text,
  total_weight_kg numeric(12,3),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, number)
);

CREATE TABLE packing_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id   uuid NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  so_line_id    uuid NOT NULL REFERENCES so_line(id),
  qty           numeric(12,3) NOT NULL,
  box_no        varchar(24),
  weight_kg     numeric(12,3)
);

CREATE TABLE eway_bill (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id   uuid NOT NULL REFERENCES shipment(id),
  ewb_number    varchar(20),
  value         numeric(14,2),
  distance_km   int,
  vehicle_no    varchar(20),
  payload       jsonb,                         -- generated e-way bill JSON
  generated_at  timestamptz
);

-- =====================================================================
-- 13. FINANCE — INVOICING / PAYMENTS
-- =====================================================================
CREATE TABLE invoice (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  number        varchar(24) NOT NULL,          -- INV-...
  customer_id   uuid NOT NULL REFERENCES customer(id),
  sales_order_id uuid REFERENCES sales_order(id),
  shipment_id   uuid REFERENCES shipment(id),
  status        invoice_status NOT NULL DEFAULT 'draft',
  gst_treatment gst_treatment NOT NULL,
  invoice_date  date NOT NULL DEFAULT current_date,
  subtotal      numeric(14,2) NOT NULL DEFAULT 0,
  cgst          numeric(14,2) NOT NULL DEFAULT 0,
  sgst          numeric(14,2) NOT NULL DEFAULT 0,
  igst          numeric(14,2) NOT NULL DEFAULT 0,
  grand_total   numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid   numeric(14,2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, number)
);

CREATE TABLE invoice_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    uuid NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  line_no       int NOT NULL,
  so_line_id    uuid REFERENCES so_line(id),
  description   text NOT NULL,
  hsn_sac       varchar(8),
  qty           numeric(12,3) NOT NULL,
  unit_price    numeric(12,4) NOT NULL,
  taxable_value numeric(14,2) NOT NULL,
  gst_rate      numeric(5,2) NOT NULL,
  tax_amount    numeric(14,2) NOT NULL,
  UNIQUE (invoice_id, line_no)
);

CREATE TABLE payment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id      uuid NOT NULL REFERENCES plant(id),
  customer_id   uuid NOT NULL REFERENCES customer(id),
  invoice_id    uuid REFERENCES invoice(id),   -- null = unapplied advance
  amount        numeric(14,2) NOT NULL,
  method        varchar(24),                   -- neft, upi, cheque, cash
  reference     text,
  paid_at       timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 14. COSTING / CLOSURE  (estimate-vs-actual roll-up view)
-- =====================================================================
-- Actuals are derived; expose as a view for the closure screen.
CREATE VIEW v_wo_actual_cost AS
SELECT
  wo.id                        AS work_order_id,
  wo.so_line_id,
  COALESCE(mat.material_cost,0)  AS material_cost,
  COALESCE(lab.labor_cost,0)     AS labor_cost,
  COALESCE(lab.scrap_qty,0)      AS scrap_qty
FROM work_order wo
LEFT JOIN LATERAL (
  SELECT SUM(st.qty_delta * -1 * sl.unit_cost) AS material_cost
  FROM stock_txn st JOIN stock_lot sl ON sl.id = st.stock_lot_id
  WHERE st.work_order_id = wo.id AND st.txn_type = 'wo_issue'
) mat ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(EXTRACT(EPOCH FROM (COALESCE(le.clock_out, now()) - le.clock_in))/3600
        * COALESCE(wc.hourly_rate,0))           AS labor_cost,
    SUM(le.qty_scrap)                            AS scrap_qty
  FROM labor_entry le
  JOIN wo_operation wop ON wop.id = le.wo_operation_id
  LEFT JOIN work_center wc ON wc.id = wop.work_center_id
  WHERE wop.work_order_id = wo.id
) lab ON true;

-- =====================================================================
-- helpful indexes for hot lists
-- =====================================================================
CREATE INDEX idx_inquiry_status   ON inquiry (plant_id, status);
CREATE INDEX idx_so_status        ON sales_order (plant_id, status);
CREATE INDEX idx_wo_status        ON work_order (plant_id, status);
CREATE INDEX idx_po_status        ON purchase_order (plant_id, status);
CREATE INDEX idx_invoice_status   ON invoice (plant_id, status);
CREATE INDEX idx_so_line_status   ON so_line (status);

-- =====================================================================
-- END
-- =====================================================================
