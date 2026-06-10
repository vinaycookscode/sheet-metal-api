import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DocSequenceService } from '../doc-sequence/doc-sequence.service';
import { Shipment } from './shipment.entity';
import { PackingLine } from './packing-line.entity';
import { EwayBill } from './eway-bill.entity';
import { CreateShipmentDto, DispatchShipmentDto, EwayBillDto } from './dto';

interface Scope {
  plantId: string;
  userId: string;
}

const EWB_THRESHOLD = 50000; // ₹ — e-way bill required above this consignment value

@Injectable()
export class DispatchService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly docSeq: DocSequenceService,
  ) {}

  /** Create a shipment against an SO (SM-162). Gated on QC: open critical NCRs
   *  pegged to the lines, and failed final inspections, both block dispatch. */
  async create(s: Scope, dto: CreateShipmentDto): Promise<Shipment> {
    const id = await this.db.transaction(async (em) => {
      const so = (await em.query(`SELECT id FROM sales_order WHERE id = $1 AND plant_id = $2`, [dto.salesOrderId, s.plantId])) as Array<{ id: string }>;
      if (!so[0]) throw new NotFoundException('Sales order not found');

      const soLineIds = dto.lines.map((l) => l.soLineId);
      const lines = (await em.query(`SELECT id, qty FROM so_line WHERE id = ANY($1) AND sales_order_id = $2`, [soLineIds, dto.salesOrderId])) as Array<{ id: string; qty: string }>;
      if (lines.length !== new Set(soLineIds).size) throw new BadRequestException('Some lines do not belong to this sales order');
      const lineQty = new Map(lines.map((l) => [l.id, Number(l.qty)]));

      await this.assertQcClear(em, s.plantId, soLineIds);

      // over-ship guard (partial shipments allowed)
      const shipped = (await em.query(`SELECT so_line_id, COALESCE(SUM(qty), 0) AS q FROM packing_line WHERE so_line_id = ANY($1) GROUP BY so_line_id`, [soLineIds])) as Array<{ so_line_id: string; q: string }>;
      const already = new Map(shipped.map((r) => [r.so_line_id, Number(r.q)]));
      for (const l of dto.lines) {
        if (already.get(l.soLineId) ?? 0) { /* keep accumulating below */ }
        if ((already.get(l.soLineId) ?? 0) + l.qty > (lineQty.get(l.soLineId) ?? 0) + 1e-9) {
          throw new BadRequestException(`SO line ${l.soLineId}: shipping ${l.qty} exceeds remaining quantity`);
        }
      }

      const number = await this.docSeq.allocate(s.plantId, 'DC', em);
      const shipment = em.create(Shipment, {
        plantId: s.plantId,
        number,
        salesOrderId: dto.salesOrderId,
        status: 'draft',
        dispatchDate: dto.dispatchDate,
        carrier: dto.carrier,
        totalWeightKg: dto.lines.reduce((a, l) => a + (l.weightKg ?? 0), 0) || undefined,
      });
      await em.save(shipment);
      await em.save(dto.lines.map((l) => em.create(PackingLine, { shipmentId: shipment.id, soLineId: l.soLineId, qty: l.qty, boxNo: l.boxNo, weightKg: l.weightKg })));
      return shipment.id;
    });
    return this.findOne(s.plantId, id);
  }

  async pack(s: Scope, id: string): Promise<Shipment> {
    const repo = this.db.getRepository(Shipment);
    const shipment = await repo.findOne({ where: { id, plantId: s.plantId }, relations: { lines: true } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (shipment.status !== 'draft') throw new BadRequestException(`Shipment is '${shipment.status}', expected 'draft'`);
    shipment.status = 'packed';
    shipment.totalWeightKg = shipment.lines.reduce((a, l) => a + Number(l.weightKg ?? 0), 0) || undefined;
    await repo.save(shipment);
    return this.findOne(s.plantId, id);
  }

  /** Dispatch (SM-162): mark dispatched, flip fully-shipped SO lines + order. */
  async dispatch(s: Scope, id: string, dto: DispatchShipmentDto): Promise<Shipment> {
    await this.db.transaction(async (em) => {
      const shipment = await em.getRepository(Shipment).findOne({ where: { id, plantId: s.plantId }, relations: { lines: true } });
      if (!shipment) throw new NotFoundException('Shipment not found');
      if (shipment.status !== 'packed') throw new BadRequestException(`Shipment is '${shipment.status}', expected 'packed'`);

      shipment.status = 'dispatched';
      shipment.dispatchDate = dto.dispatchDate ?? new Date().toISOString().slice(0, 10);
      if (dto.carrier) shipment.carrier = dto.carrier;
      if (dto.trackingNo) shipment.trackingNo = dto.trackingNo;
      if (dto.freightCost != null) shipment.freightCost = dto.freightCost;
      await em.save(shipment);

      const soLineIds = shipment.lines.map((l) => l.soLineId);
      // fully-shipped lines -> dispatched
      await em.query(
        `UPDATE so_line sl SET status = 'dispatched'
          WHERE sl.id = ANY($1) AND sl.status NOT IN ('dispatched', 'closed')
            AND (SELECT COALESCE(SUM(qty), 0) FROM packing_line WHERE so_line_id = sl.id) >= sl.qty`,
        [soLineIds],
      );
      // order dispatched once no open lines remain
      await em.query(
        `UPDATE sales_order SET status = 'dispatched', updated_by = $2
          WHERE id = $1 AND status NOT IN ('dispatched', 'invoiced', 'closed', 'cancelled')
            AND NOT EXISTS (SELECT 1 FROM so_line WHERE sales_order_id = $1 AND status NOT IN ('dispatched', 'closed'))`,
        [shipment.salesOrderId, s.userId],
      );
    });
    return this.findOne(s.plantId, id);
  }

  list(plantId: string, filter: { status?: string; salesOrderId?: string }): Promise<Shipment[]> {
    const where: Record<string, unknown> = { plantId };
    if (filter.status) where.status = filter.status;
    if (filter.salesOrderId) where.salesOrderId = filter.salesOrderId;
    return this.db.getRepository(Shipment).find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async findOne(plantId: string, id: string): Promise<Shipment> {
    const shipment = await this.db.getRepository(Shipment).findOne({ where: { id, plantId }, relations: { lines: true } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return shipment;
  }

  /** Printable delivery challan (SM-162). */
  async challan(plantId: string, id: string) {
    const s = (await this.db.query(
      `SELECT sh.number, sh.dispatch_date, sh.carrier, sh.total_weight_kg, so.number AS so_number,
              c.name AS customer, c.gstin AS customer_gstin
         FROM shipment sh JOIN sales_order so ON so.id = sh.sales_order_id JOIN customer c ON c.id = so.customer_id
        WHERE sh.id = $1 AND sh.plant_id = $2`,
      [id, plantId],
    )) as Array<any>;
    if (!s[0]) throw new NotFoundException('Shipment not found');
    const lines = await this.db.query(
      `SELECT pl.qty, pl.box_no, pl.weight_kg, sl.part_name FROM packing_line pl JOIN so_line sl ON sl.id = pl.so_line_id WHERE pl.shipment_id = $1`,
      [id],
    );
    return {
      challanNo: s[0].number,
      date: s[0].dispatch_date,
      salesOrder: s[0].so_number,
      customer: { name: s[0].customer, gstin: s[0].customer_gstin },
      carrier: s[0].carrier,
      totalWeightKg: s[0].total_weight_kg,
      lines,
    };
  }

  /** Full print-ready delivery challan: seller, ship-to, transport, packed lines, totals. */
  async document(plantId: string, id: string): Promise<Record<string, unknown>> {
    const head = (await this.db.query(
      `SELECT sh.number, sh.dispatch_date, sh.status, sh.carrier, sh.tracking_no, sh.total_weight_kg,
              o.legal_name AS org_legal, o.name AS org_name,
              p.name AS plant_name, p.gstin AS plant_gstin, p.state_code AS plant_state, p.address AS plant_address,
              c.name AS cust_name, c.code AS cust_code, c.gstin AS cust_gstin, c.state_code AS cust_state,
              c.billing_address AS bill_addr, c.shipping_address AS ship_addr,
              so.number AS so_number, so.customer_po_number AS cust_po,
              e.ewb_number, e.vehicle_no
         FROM shipment sh
         JOIN plant p ON p.id = sh.plant_id
         JOIN org o ON o.id = p.org_id
         JOIN sales_order so ON so.id = sh.sales_order_id
         JOIN customer c ON c.id = so.customer_id
         LEFT JOIN eway_bill e ON e.shipment_id = sh.id
        WHERE sh.id = $1 AND sh.plant_id = $2`,
      [id, plantId],
    )) as Array<Record<string, unknown>>;
    if (!head[0]) throw new NotFoundException('Shipment not found');
    const h = head[0];

    const rows = (await this.db.query(
      `SELECT pl.qty, pl.box_no, pl.weight_kg, sl.part_name
         FROM packing_line pl JOIN so_line sl ON sl.id = pl.so_line_id WHERE pl.shipment_id = $1`,
      [id],
    )) as Array<{ qty: string; box_no: string | null; weight_kg: string | null; part_name: string }>;
    const lines = rows.map((r, i) => ({
      lineNo: i + 1,
      description: r.part_name,
      qty: Number(r.qty),
      boxNo: r.box_no ?? '',
      weightKg: r.weight_kg != null ? Number(r.weight_kg) : null,
    }));

    return {
      title: 'DELIVERY CHALLAN',
      seller: { name: (h.org_legal as string) || (h.org_name as string), plant: h.plant_name, gstin: h.plant_gstin, stateCode: h.plant_state, address: h.plant_address },
      buyer: { name: h.cust_name, code: h.cust_code, gstin: h.cust_gstin, stateCode: h.cust_state, billingAddress: h.bill_addr, shippingAddress: h.ship_addr },
      challan: {
        number: h.number,
        date: h.dispatch_date,
        status: h.status,
        salesOrder: h.so_number ?? null,
        customerPo: h.cust_po ?? null,
      },
      transport: { carrier: h.carrier ?? null, trackingNo: h.tracking_no ?? null, ewbNumber: h.ewb_number ?? null, vehicleNo: h.vehicle_no ?? null },
      lines,
      totals: { totalQty: lines.reduce((a, l) => a + l.qty, 0), totalWeightKg: h.total_weight_kg != null ? Number(h.total_weight_kg) : null },
    };
  }

  /** Certificate of Conformance (SM-221): conformance statement + material heat/lot traceability + inspection results. */
  async certificate(plantId: string, id: string): Promise<Record<string, unknown>> {
    const head = (await this.db.query(
      `SELECT sh.number, sh.dispatch_date,
              o.legal_name AS org_legal, o.name AS org_name,
              p.name AS plant_name, p.gstin AS plant_gstin, p.state_code AS plant_state, p.address AS plant_address,
              c.name AS cust_name, c.gstin AS cust_gstin,
              so.number AS so_number, so.customer_po_number AS cust_po
         FROM shipment sh
         JOIN plant p ON p.id = sh.plant_id
         JOIN org o ON o.id = p.org_id
         JOIN sales_order so ON so.id = sh.sales_order_id
         JOIN customer c ON c.id = so.customer_id
        WHERE sh.id = $1 AND sh.plant_id = $2`,
      [id, plantId],
    )) as Array<Record<string, unknown>>;
    if (!head[0]) throw new NotFoundException('Shipment not found');
    const h = head[0];

    const lines = await this.db.query(
      `SELECT sl.part_name AS "partName", pl.qty FROM packing_line pl JOIN so_line sl ON sl.id = pl.so_line_id WHERE pl.shipment_id = $1`,
      [id],
    );
    const traceability = await this.db.query(
      `SELECT DISTINCT i.code AS item, lot.heat_no AS "heatNo", lot.lot_no AS "lotNo"
         FROM packing_line pl
         JOIN work_order wo ON wo.so_line_id = pl.so_line_id
         JOIN material_allocation ma ON ma.work_order_id = wo.id
         JOIN stock_lot lot ON lot.id = ma.stock_lot_id
         JOIN item i ON i.id = lot.item_id
        WHERE pl.shipment_id = $1 AND (lot.heat_no IS NOT NULL OR lot.lot_no IS NOT NULL)`,
      [id],
    );
    const inspections = await this.db.query(
      `SELECT DISTINCT insp.kind, insp.result
         FROM packing_line pl
         JOIN work_order wo ON wo.so_line_id = pl.so_line_id
         JOIN inspection insp ON (insp.work_order_id = wo.id OR insp.so_line_id = pl.so_line_id)
        WHERE pl.shipment_id = $1`,
      [id],
    );

    return {
      title: 'CERTIFICATE OF CONFORMANCE',
      number: `${h.number as string}-COC`,
      date: h.dispatch_date,
      seller: { name: (h.org_legal as string) || (h.org_name as string), plant: h.plant_name, gstin: h.plant_gstin, stateCode: h.plant_state, address: h.plant_address },
      buyer: { name: h.cust_name, gstin: h.cust_gstin },
      refs: { shipment: h.number, salesOrder: h.so_number ?? null, customerPo: h.cust_po ?? null },
      lines,
      traceability,
      inspections,
      declaration:
        'We hereby certify that the goods described above have been manufactured and inspected in accordance with the applicable drawings, specifications and purchase-order requirements, and conform thereto.',
    };
  }

  /** Quality dossier (SM-222): inspections + attached MTR/cert/drawing documents for a shipment. */
  async dossier(plantId: string, orgId: string, id: string): Promise<Record<string, unknown>> {
    const head = (await this.db.query(
      `SELECT number, sales_order_id AS "salesOrderId" FROM shipment WHERE id = $1 AND plant_id = $2`,
      [id, plantId],
    )) as Array<{ number: string; salesOrderId: string }>;
    if (!head[0]) throw new NotFoundException('Shipment not found');

    const inspections = await this.db.query(
      `SELECT id, kind, result, "at" FROM (
         SELECT DISTINCT insp.id, insp.kind, insp.result, insp.inspected_at AS "at"
           FROM packing_line pl
           JOIN work_order wo ON wo.so_line_id = pl.so_line_id
           JOIN inspection insp ON (insp.work_order_id = wo.id OR insp.so_line_id = pl.so_line_id)
          WHERE pl.shipment_id = $1
         UNION
         SELECT DISTINCT insp.id, insp.kind, insp.result, insp.inspected_at AS "at"
           FROM packing_line pl
           JOIN work_order wo ON wo.so_line_id = pl.so_line_id
           JOIN material_allocation ma ON ma.work_order_id = wo.id
           JOIN inspection insp ON insp.stock_lot_id = ma.stock_lot_id
          WHERE pl.shipment_id = $1
       ) q ORDER BY "at" DESC NULLS LAST`,
      [id],
    );

    const documents = await this.db.query(
      `SELECT d.id, d.kind, d.file_name AS "fileName", d.entity_type AS "entityType", d.version
         FROM document d
        WHERE d.deleted_at IS NULL AND d.org_id = $3 AND (
          (d.entity_type = 'sales-order' AND d.entity_id = $1)
          OR (d.entity_type = 'part' AND d.entity_id IN (
               SELECT DISTINCT sl.part_id FROM packing_line pl JOIN so_line sl ON sl.id = pl.so_line_id
                WHERE pl.shipment_id = $2 AND sl.part_id IS NOT NULL))
        )
        ORDER BY d.created_at DESC`,
      [head[0].salesOrderId, id, orgId],
    );

    return { shipment: head[0].number, inspections, documents };
  }

  /** Generate an e-way bill payload for a shipment above threshold (SM-163). */
  async generateEwayBill(s: Scope, id: string, dto: EwayBillDto): Promise<EwayBill> {
    if (dto.value <= EWB_THRESHOLD) {
      throw new BadRequestException(`Consignment value ₹${dto.value} is at/below the ₹${EWB_THRESHOLD} e-way bill threshold`);
    }
    return this.db.transaction(async (em) => {
      const rows = (await em.query(
        `SELECT sh.number, sh.dispatch_date, p.gstin AS from_gstin, p.state_code AS from_state,
                c.gstin AS to_gstin, c.state_code AS to_state
           FROM shipment sh
           JOIN plant p ON p.id = sh.plant_id
           JOIN sales_order so ON so.id = sh.sales_order_id
           JOIN customer c ON c.id = so.customer_id
          WHERE sh.id = $1 AND sh.plant_id = $2`,
        [id, s.plantId],
      )) as Array<any>;
      if (!rows[0]) throw new NotFoundException('Shipment not found');
      const r = rows[0];

      const payload = {
        supplyType: 'O',
        subSupplyType: '1',
        docType: 'CHL',
        docNo: r.number,
        docDate: r.dispatch_date,
        fromGstin: r.from_gstin,
        fromStateCode: r.from_state,
        toGstin: r.to_gstin,
        toStateCode: r.to_state,
        totalValue: dto.value,
        transDistance: String(dto.distanceKm),
        vehicleNo: dto.vehicleNo,
        vehicleType: 'R',
      };
      const ewbNumber = String(Math.floor(1e11 + Math.random() * 9e11)); // 12-digit stub
      const bill = em.create(EwayBill, { shipmentId: id, ewbNumber, value: dto.value, distanceKm: dto.distanceKm, vehicleNo: dto.vehicleNo, payload, generatedAt: new Date() });
      return em.save(bill);
    });
  }

  async getEwayBill(plantId: string, id: string): Promise<EwayBill> {
    await this.findOne(plantId, id); // ensure shipment in plant
    const bill = await this.db.getRepository(EwayBill).findOne({ where: { shipmentId: id } });
    if (!bill) throw new NotFoundException('No e-way bill generated for this shipment');
    return bill;
  }

  // --- QC gate -----------------------------------------------------------
  private async assertQcClear(em: EntityManager, plantId: string, soLineIds: string[]): Promise<void> {
    const ncr = (await em.query(
      `SELECT n.number FROM ncr n JOIN work_order wo ON wo.id = n.work_order_id
        WHERE n.plant_id = $1 AND n.status = 'open' AND n.is_critical = true AND wo.so_line_id = ANY($2) LIMIT 1`,
      [plantId, soLineIds],
    )) as Array<{ number: string }>;
    if (ncr[0]) throw new BadRequestException(`Open critical NCR ${ncr[0].number} blocks dispatch`);

    const failed = (await em.query(
      `SELECT so_line_id FROM inspection
        WHERE plant_id = $1 AND kind = 'final' AND so_line_id = ANY($2)
        GROUP BY so_line_id
       HAVING bool_or(result = 'fail') AND NOT bool_or(result = 'pass')`,
      [plantId, soLineIds],
    )) as Array<{ so_line_id: string }>;
    if (failed.length) throw new BadRequestException(`SO line ${failed[0].so_line_id} failed final inspection`);
  }
}
