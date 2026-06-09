import { GstTreatment } from './enums';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * GST tax engine (SM-020). Place of supply: same state as the plant → intra-state
 * (CGST + SGST, each half the rate); different state → inter-state (IGST).
 */
export function resolveTreatment(plantState?: string, customerState?: string): GstTreatment {
  if (!customerState || !plantState) return 'intra_state';
  return plantState === customerState ? 'intra_state' : 'inter_state';
}

export interface LineTax {
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export function computeLineTax(taxableValue: number, ratePct: number, treatment: GstTreatment): LineTax {
  const total = round2((taxableValue * ratePct) / 100);
  if (treatment === 'intra_state') {
    const cgst = round2(total / 2);
    return { cgst, sgst: round2(total - cgst), igst: 0, total };
  }
  if (treatment === 'inter_state') {
    return { cgst: 0, sgst: 0, igst: total, total };
  }
  return { cgst: 0, sgst: 0, igst: 0, total: 0 }; // export / exempt
}

export { round2 as round2Money };
