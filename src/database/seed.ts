/**
 * Idempotent demo seed for the Sheet Metal ERP.
 *
 *   npm run seed
 *
 * Produces a minimally demo-able environment (BACKLOG SM-023):
 *   1 org · 1 plant · permission catalogue · roles (admin, sales) ·
 *   2 users · master data (uom/tax/material/finish/work-center/operation) ·
 *   sample items, suppliers, customers.
 *
 * Safe to re-run: every insert is keyed on a natural unique key (or a fixed
 * UUID where the table has none) with ON CONFLICT, so running it twice is a
 * no-op rather than a duplicate.
 *
 * Self-contained: loads .env itself (no dotenv dependency) and connects with
 * TypeORM's DataSource so the script needs no extra typings.
 */
import { DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

// --- minimal .env loader (no dependency) ---------------------------------
function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

// --- fixed identifiers for idempotency (org/plant have no natural key) ----
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const PLANT_ID = '00000000-0000-0000-0000-0000000000a1';

// Permissions enforced by @RequirePermission across the modules built so far.
// Add new module permissions here; the admin role is granted the whole list.
const PERMISSIONS = [
  'customer.read', 'customer.write', 'customer.delete',
  'supplier.read', 'supplier.write', 'supplier.delete',
  'item.read', 'item.write', 'item.delete',
  'masterdata.read', 'masterdata.write', 'masterdata.delete',
  'docseq.read', 'docseq.write',
  'inquiry.read', 'inquiry.write',
  'quote.read', 'quote.write',
  'so.read', 'so.write',
  'part.read', 'part.write', 'part.release',
  'mrp.run', 'req.read',
  'wo.read', 'wo.write', 'wo.release',
  'po.read', 'po.write', 'po.approve',
  'grn.read', 'grn.write',
  'stock.read', 'stock.write',
  'mes.read', 'mes.clock',
  'inspection.read', 'inspection.write',
  'ncr.read', 'ncr.write',
  'dispatch.read', 'dispatch.write', 'eway.write',
  'invoice.read', 'invoice.write',
  'payment.read', 'payment.write',
  'closure.read', 'closure.write',
  'identity.read', 'identity.write',
];

const ROLES: Record<string, { name: string; perms: string[] }> = {
  admin: { name: 'Administrator', perms: PERMISSIONS },
  sales: {
    name: 'Sales',
    perms: [
      'customer.read', 'masterdata.read', 'item.read', 'supplier.read', 'docseq.read',
      'inquiry.read', 'inquiry.write', 'quote.read', 'quote.write', 'so.read', 'so.write',
    ],
  },
};

const USERS = [
  { email: 'admin@sheetmetal.local', fullName: 'Admin User', password: 'Admin@123', role: 'admin' },
  { email: 'sales@sheetmetal.local', fullName: 'Sales User', password: 'Sales@123', role: 'sales' },
];

// --- master data ---------------------------------------------------------
const UOMS = [
  ['EA', 'Each'], ['KG', 'Kilogram'], ['MM', 'Millimetre'], ['SQM', 'Square Metre'], ['HR', 'Hour'],
];
const TAX_CODES = [
  ['7308', 'Structures & parts of iron/steel', 18],
  ['7326', 'Other articles of iron/steel', 18],
  ['9988', 'Job work / manufacturing services', 18],
];
const MATERIAL_GRADES = [
  // code, name, density(kg/m3), default_rate(Rs/kg), traceable
  ['CR', 'Cold Rolled Steel', 7850, 65, false],
  ['HR', 'Hot Rolled Steel', 7850, 58, false],
  ['SS304', 'Stainless Steel 304', 8000, 250, true],
  ['AL5052', 'Aluminium 5052', 2680, 320, false],
];
const FINISHES = [
  ['RAW', 'As Fabricated', false],
  ['POWDER', 'Powder Coated', true],
  ['ZINC', 'Zinc Plated', true],
];
const WORK_CENTERS = [
  // code, name, capacity_hrs/day, hourly_rate, is_outside
  ['LASER1', 'Fiber Laser Cutter', 16, 1800, false],
  ['BRAKE1', 'CNC Press Brake', 16, 1200, false],
  ['WELD1', 'MIG Welding Bay', 8, 900, false],
  ['PAINT', 'Powder Coating Line', 8, 600, true],
];
const OPERATIONS = [
  // code, name, rate_basis, default_rate
  ['CUT', 'Laser Cutting', 'per_sec', 0.5],
  ['BEND', 'Press Brake Bending', 'per_bend', 12],
  ['WELD', 'MIG Welding', 'per_mm_weld', 0.8],
  ['DEBURR', 'Deburring', 'per_part', 5],
  ['ASSY', 'Assembly', 'per_hr', 450],
];

// items reference uom (by code) + optional material grade (by code)
const ITEMS = [
  // code, name, type, uomCode, gradeCode|null, thickness, std_cost
  ['RAW-CR-2.0', 'CR Sheet 2.0mm 2500x1250', 'raw_sheet', 'KG', 'CR', 2.0, 70],
  ['RAW-SS304-1.5', 'SS304 Sheet 1.5mm', 'raw_sheet', 'KG', 'SS304', 1.5, 255],
  ['HW-M6NUT', 'M6 Hex Nut SS', 'hardware', 'EA', null, null, 1.5],
  ['CONS-MIGWIRE', 'MIG Welding Wire 0.8mm', 'consumable', 'KG', null, null, 180],
];

const SUPPLIERS = [
  // code, name, category, lead_time, payment_terms
  ['SUP-001', 'Jindal Steel & Power', 'raw_material', 10, 45],
  ['SUP-002', 'Fastenal India', 'hardware', 5, 30],
  ['SUP-003', 'ProtoCoat Finishing', 'subcontract', 4, 30],
];

const CUSTOMERS = [
  ['CUST-001', 'Tata Motors Ltd', '27AAACT2727Q1ZW', '27', 45, 5000000],
  ['CUST-002', 'Mahindra & Mahindra', '27AAACM3025E1ZE', '27', 30, 3000000],
  ['CUST-003', 'Bharat Forge', '27AAACB0859J1Z0', '27', 60, 2000000],
];

// opening stock so MRP netting is demonstrable (itemCode, qtyOnHand, unitCost)
const STOCK = [
  ['RAW-CR-2.0', 50, 70],
  ['HW-M6NUT', 500, 1.5],
];

async function idMap(em: EntityManager, sql: string, params: unknown[]): Promise<Map<string, string>> {
  const rows: { code: string; id: string }[] = await em.query(sql, params);
  return new Map(rows.map((r) => [r.code, r.id]));
}

async function seed(): Promise<void> {
  loadEnv();

  const url = process.env.DATABASE_URL;
  const ds = new DataSource(
    url
      ? { type: 'postgres', url, entities: [], synchronize: false }
      : {
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? '',
          database: process.env.DB_NAME ?? 'sheetmetal',
          entities: [],
          synchronize: false,
        },
  );

  await ds.initialize();

  try {
    await ds.transaction(async (em) => {
      const q = (sql: string, params?: unknown[]) => em.query(sql, params);

      // 1. org
      await q(
        `INSERT INTO org (id, name, legal_name, gstin, state_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, legal_name = EXCLUDED.legal_name,
               gstin = EXCLUDED.gstin, state_code = EXCLUDED.state_code`,
        [ORG_ID, 'Sheet Metal Co', 'Sheet Metal Co Pvt Ltd', '27AAAAA0000A1Z5', '27'],
      );

      // 2. plant
      await q(
        `INSERT INTO plant (id, org_id, code, name, gstin, state_code, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (org_id, code) DO UPDATE
           SET name = EXCLUDED.name, gstin = EXCLUDED.gstin,
               state_code = EXCLUDED.state_code, address = EXCLUDED.address`,
        [
          PLANT_ID, ORG_ID, 'PLANT1', 'Pune Fabrication Plant', '27AAAAA0000A1Z5', '27',
          JSON.stringify({ line1: 'Plot 12, MIDC Bhosari', city: 'Pune', state: 'Maharashtra', pincode: '411026' }),
        ],
      );

      // 3. permissions
      for (const code of PERMISSIONS) {
        await q(`INSERT INTO permission (code) VALUES ($1) ON CONFLICT (code) DO NOTHING`, [code]);
      }
      const permId = await idMap(em, `SELECT code, id FROM permission WHERE code = ANY($1)`, [PERMISSIONS]);

      // 4. roles + role_permission
      const roleId = new Map<string, string>();
      for (const [code, def] of Object.entries(ROLES)) {
        const rows: { id: string }[] = await q(
          `INSERT INTO role (org_id, code, name) VALUES ($1, $2, $3)
           ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [ORG_ID, code, def.name],
        );
        roleId.set(code, rows[0].id);
        for (const p of def.perms) {
          await q(
            `INSERT INTO role_permission (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [rows[0].id, permId.get(p)],
          );
        }
      }

      // 5. users + user_role
      const userId = new Map<string, string>();
      for (const u of USERS) {
        const hash = await bcrypt.hash(u.password, 10);
        const rows: { id: string }[] = await q(
          `INSERT INTO app_user (org_id, email, full_name, password_hash, is_active, default_plant_id)
           VALUES ($1, $2, $3, $4, true, $5)
           ON CONFLICT (email) DO UPDATE
             SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash,
                 is_active = true, default_plant_id = EXCLUDED.default_plant_id RETURNING id`,
          [ORG_ID, u.email, u.fullName, hash, PLANT_ID],
        );
        userId.set(u.email, rows[0].id);
        await q(
          `INSERT INTO user_role (user_id, role_id, plant_id) VALUES ($1, $2, NULL)
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [rows[0].id, roleId.get(u.role)],
        );
      }
      const adminId = userId.get('admin@sheetmetal.local');

      // 6. master data
      for (const [code, name] of UOMS) {
        await q(`INSERT INTO uom (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`, [code, name]);
      }
      for (const [hsn, desc, rate] of TAX_CODES) {
        await q(`INSERT INTO tax_code (hsn_sac, description, gst_rate) VALUES ($1, $2, $3) ON CONFLICT (hsn_sac) DO NOTHING`, [hsn, desc, rate]);
      }
      for (const [code, name, density, rate, trace] of MATERIAL_GRADES) {
        await q(
          `INSERT INTO material_grade (org_id, code, name, density, default_rate, is_traceable)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (org_id, code) DO NOTHING`,
          [ORG_ID, code, name, density, rate, trace],
        );
      }
      for (const [code, name, outside] of FINISHES) {
        await q(`INSERT INTO finish_master (org_id, code, name, is_outside) VALUES ($1,$2,$3,$4) ON CONFLICT (org_id, code) DO NOTHING`, [ORG_ID, code, name, outside]);
      }
      for (const [code, name, cap, rate, outside] of WORK_CENTERS) {
        await q(
          `INSERT INTO work_center (plant_id, code, name, capacity_hrs_per_day, hourly_rate, is_outside)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (plant_id, code) DO NOTHING`,
          [PLANT_ID, code, name, cap, rate, outside],
        );
      }
      for (const [code, name, basis, rate] of OPERATIONS) {
        await q(
          `INSERT INTO operation_master (org_id, code, name, rate_basis, default_rate)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (org_id, code) DO NOTHING`,
          [ORG_ID, code, name, basis, rate],
        );
      }

      // 7. items (resolve uom + material grade ids)
      const uomId = await idMap(em, `SELECT code, id FROM uom`, []);
      const gradeId = await idMap(em, `SELECT code, id FROM material_grade WHERE org_id = $1`, [ORG_ID]);
      for (const [code, name, type, uomCode, gradeCode, thickness, cost] of ITEMS) {
        await q(
          `INSERT INTO item (org_id, code, name, item_type, uom_id, material_grade_id, thickness_mm, std_cost, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) ON CONFLICT (org_id, code) DO NOTHING`,
          [ORG_ID, code, name, type, uomId.get(uomCode as string), gradeCode ? gradeId.get(gradeCode as string) : null, thickness, cost, adminId],
        );
      }

      // 7b. opening stock (idempotent: keyed on a synthetic lot_no per item)
      const itemId = await idMap(em, `SELECT code, id FROM item WHERE org_id = $1`, [ORG_ID]);
      for (const [code, qty, cost] of STOCK) {
        const lotNo = `OPEN-${code}`;
        const exists = (await q(
          `SELECT 1 FROM stock_lot WHERE plant_id = $1 AND item_id = $2 AND lot_no = $3 LIMIT 1`,
          [PLANT_ID, itemId.get(code as string), lotNo],
        )) as unknown[];
        if (!exists.length) {
          await q(
            `INSERT INTO stock_lot (plant_id, item_id, lot_no, location, qty_on_hand, unit_cost)
             VALUES ($1, $2, $3, 'MAIN', $4, $5)`,
            [PLANT_ID, itemId.get(code as string), lotNo, qty, cost],
          );
        }
      }

      // 8. suppliers
      for (const [code, name, category, lead, terms] of SUPPLIERS) {
        await q(
          `INSERT INTO supplier (org_id, code, name, category, lead_time_days, payment_terms_days, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT (org_id, code) DO NOTHING`,
          [ORG_ID, code, name, category, lead, terms, adminId],
        );
      }

      // 9. customers
      for (const [code, name, gstin, state, terms, credit] of CUSTOMERS) {
        await q(
          `INSERT INTO customer (org_id, code, name, gstin, state_code, payment_terms_days, credit_limit, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) ON CONFLICT (org_id, code) DO NOTHING`,
          [ORG_ID, code, name, gstin, state, terms, credit, adminId],
        );
      }
    });

    // eslint-disable-next-line no-console
    console.log(
      [
        '✔ Seed complete.',
        `  org/plant:  Sheet Metal Co · Pune Fabrication Plant (PLANT1)`,
        `  rbac:       ${PERMISSIONS.length} permissions · ${Object.keys(ROLES).length} roles · ${USERS.length} users`,
        `  master:     ${UOMS.length} uom · ${TAX_CODES.length} tax · ${MATERIAL_GRADES.length} grades · ${FINISHES.length} finishes · ${WORK_CENTERS.length} work-centers · ${OPERATIONS.length} operations`,
        `  data:       ${ITEMS.length} items · ${SUPPLIERS.length} suppliers · ${CUSTOMERS.length} customers · ${STOCK.length} stock lots`,
        '  logins:',
        '    admin@sheetmetal.local / Admin@123   (admin — full access)',
        '    sales@sheetmetal.local / Sales@123   (sales — read-only)',
      ].join('\n'),
    );
  } catch (err) {
    throw err;
  } finally {
    await ds.destroy();
  }
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('✘ Seed failed:', err);
  process.exit(1);
});
