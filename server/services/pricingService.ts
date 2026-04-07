import { OrderItemKind, type IPricingSnapshot } from '../models/OrderItem.js';
import { SERVICE_CATALOG } from '../config/serviceCatalog.js';

export function computePricingSnapshot(
  kind: OrderItemKind,
  params: Record<string, any>
): IPricingSnapshot {
  const def = SERVICE_CATALOG[kind];
  if (!def) throw new Error(`Unknown service kind: ${kind}`);

  let base = def.baseCredits;
  const modifiers: { label: string; delta: number }[] = [];

  if (kind === OrderItemKind.VIDEO_EDIT) {
    base = Math.max(100, (params.rawFootageLength || 0) * 20);
    
    if (params.hasRawFootage === false) {
      modifiers.push({ label: 'No raw footage provided', delta: 100 });
    }
    if (params.addBroll === true) {
      modifiers.push({ label: 'Additional B-roll footage', delta: 100 });
    }
  }

  if (kind === OrderItemKind.VOICEOVER) {
    base = Math.max(50, (params.scriptLength || 0) * 10);
  }

  if (kind === OrderItemKind.SCRIPT) {
    const words = params.wordCount || 0;
    const blocks = Math.ceil(words / 500);
    base = Math.max(100, blocks * 100);
  }

  if (kind === OrderItemKind.CONSULTATION) {
    const mins = params.duration || 15;
    const blocks = Math.ceil(mins / 15);
    base = Math.max(100, blocks * 100);
  }

  if (kind === OrderItemKind.FOOTAGE_REVIEW) {
    base = Math.max(50, (params.footageLength || 0) * 10);
  }

  const totalCredits = base + modifiers.reduce((sum, m) => sum + m.delta, 0);

  return {
    priceVersion: 'v2',
    inputs: params,
    base,
    modifiers,
    totalCredits,
  };
}
