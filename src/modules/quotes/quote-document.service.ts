import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { Customer } from '../customers/customer.entity';
import { Org } from '../../common/tenancy/org.entity';
import { Plant } from '../../common/tenancy/plant.entity';
import { rupeesInWords } from '../../common/amount-in-words';
import { QuotesService } from './quotes.service';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface QuoteDocModel {
  title: string;
  number: string;
  date: string;
  validUntil?: string | null;
  leadTimeDays?: number | null;
  terms?: string | null;
  seller: { name: string; plant?: string; gstin?: string; stateCode?: string };
  buyer: { name: string; email?: string; gstin?: string; stateCode?: string };
  lines: Array<{ lineNo: number; description: string; qty: number; unitPrice: number; amount: number }>;
  totals: { subtotal: number; taxTotal: number; grandTotal: number };
  amountInWords: string;
}

/** Builds the quote read-model and renders it to a PDF (for preview + email attachment). */
@Injectable()
export class QuoteDocumentService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Org) private readonly orgs: Repository<Org>,
    @InjectRepository(Plant) private readonly plants: Repository<Plant>,
    private readonly quotes: QuotesService,
  ) {}

  async model(plantId: string, quoteId: string): Promise<QuoteDocModel> {
    const quote = await this.quotes.findOne(plantId, quoteId);
    const versions = quote.versions ?? [];
    const version = versions.find((v) => v.isCurrent) ?? versions[versions.length - 1];
    if (!version) throw new NotFoundException('Quote has no version to document');

    const [customer, plant] = await Promise.all([
      this.customers.findOne({ where: { id: quote.customerId } }),
      this.plants.findOne({ where: { id: plantId } }),
    ]);
    const org = plant ? await this.orgs.findOne({ where: { id: plant.orgId } }) : null;

    const lines = (version.lines ?? []).map((l, i) => {
      const qty = Number(l.primaryQty);
      const unitPrice = Number(l.unitPrice);
      return { lineNo: l.lineNo ?? i + 1, description: l.partName, qty, unitPrice, amount: round2(qty * unitPrice) };
    });

    return {
      title: 'QUOTATION',
      number: quote.number,
      date: (quote.createdAt instanceof Date ? quote.createdAt.toISOString() : String(quote.createdAt)).slice(0, 10),
      validUntil: version.validUntil ?? null,
      leadTimeDays: version.leadTimeDays ?? null,
      terms: version.terms ?? null,
      seller: { name: org?.legalName || org?.name || 'Our Company', plant: plant?.name, gstin: plant?.gstin, stateCode: plant?.stateCode },
      buyer: { name: customer?.name ?? '—', email: customer?.email, gstin: customer?.gstin, stateCode: customer?.stateCode },
      lines,
      totals: {
        subtotal: Number(version.subtotal ?? 0),
        taxTotal: Number(version.taxTotal ?? 0),
        grandTotal: Number(version.grandTotal ?? 0),
      },
      amountInWords: rupeesInWords(Number(version.grandTotal ?? 0)),
    };
  }

  async renderPdf(plantId: string, quoteId: string): Promise<{ buffer: Buffer; model: QuoteDocModel }> {
    const model = await this.model(plantId, quoteId);
    const buffer = await this.draw(model);
    return { buffer, model };
  }

  private draw(m: QuoteDocModel): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = 50;
      const right = 545;

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text(m.title, left, 50);
      doc.fontSize(10).font('Helvetica')
        .text(`No: ${m.number}`, left, 78)
        .text(`Date: ${m.date}`, left, 92);
      if (m.validUntil) doc.text(`Valid until: ${m.validUntil}`, left, 106);

      // Seller / Buyer
      let y = 135;
      doc.fontSize(9).font('Helvetica-Bold').text('FROM', left, y).text('TO', 310, y);
      y += 14;
      doc.font('Helvetica-Bold').fontSize(11).text(m.seller.name, left, y, { width: 240 });
      doc.text(m.buyer.name, 310, y, { width: 235 });
      y += 16;
      doc.font('Helvetica').fontSize(9);
      const sellerSub = [m.seller.plant, m.seller.gstin ? `GSTIN: ${m.seller.gstin}` : null].filter(Boolean).join('  ·  ');
      const buyerSub = [m.buyer.email, m.buyer.gstin ? `GSTIN: ${m.buyer.gstin}` : null].filter(Boolean).join('  ·  ');
      doc.text(sellerSub, left, y, { width: 240 });
      doc.text(buyerSub, 310, y, { width: 235 });

      // Line table
      y += 36;
      const cols = { no: left, desc: left + 30, qty: 330, price: 400, amt: 480 };
      doc.font('Helvetica-Bold').fontSize(9);
      doc.text('#', cols.no, y).text('Description', cols.desc, y).text('Qty', cols.qty, y, { width: 50, align: 'right' })
        .text('Unit', cols.price, y, { width: 60, align: 'right' }).text('Amount', cols.amt, y, { width: 65, align: 'right' });
      y += 4;
      doc.moveTo(left, y + 10).lineTo(right, y + 10).strokeColor('#cccccc').stroke();
      y += 16;
      doc.font('Helvetica').fontSize(9);
      for (const l of m.lines) {
        doc.fillColor('#111').text(String(l.lineNo), cols.no, y)
          .text(l.description, cols.desc, y, { width: 290 })
          .text(String(l.qty), cols.qty, y, { width: 50, align: 'right' })
          .text(inr(l.unitPrice), cols.price, y, { width: 60, align: 'right' })
          .text(inr(l.amount), cols.amt, y, { width: 65, align: 'right' });
        y += Math.max(16, doc.heightOfString(l.description, { width: 290 }));
      }
      doc.moveTo(left, y + 2).lineTo(right, y + 2).strokeColor('#cccccc').stroke();

      // Totals
      y += 12;
      const totalRow = (label: string, val: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9)
          .text(label, 360, y, { width: 100, align: 'right' })
          .text(val, cols.amt, y, { width: 65, align: 'right' });
        y += bold ? 20 : 15;
      };
      totalRow('Subtotal', inr(m.totals.subtotal));
      totalRow('Tax', inr(m.totals.taxTotal));
      totalRow('Grand Total', inr(m.totals.grandTotal), true);

      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#444')
        .text(`Amount in words: ${m.amountInWords}`, left, y + 4, { width: right - left });

      // Footer
      y += 40;
      if (m.leadTimeDays) { doc.font('Helvetica').fontSize(9).fillColor('#111').text(`Lead time: ${m.leadTimeDays} days`, left, y); y += 14; }
      if (m.terms) doc.font('Helvetica').fontSize(9).fillColor('#444').text(`Terms: ${m.terms}`, left, y, { width: right - left });

      doc.end();
    });
  }
}
