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

  if (kind === OrderItemKind.VIDEO_EDIT || kind === OrderItemKind.GAMING_STREAMS) {
    const tier = params.packageTier || 'BASIC';
    if (kind === OrderItemKind.VIDEO_EDIT) {
      if (tier === 'BASIC') base = 70;
      else if (tier === 'STANDARD') base = 105;
      else if (tier === 'PREMIUM') base = 130;
      else base = 70;
    } else {
      if (tier === 'BASIC') base = 60;
      else if (tier === 'STANDARD') base = 80;
      else if (tier === 'PREMIUM') base = 100;
      else base = 60;
    }

    if (params.deliverySpeed === 'EXPRESS') {
      let delta = 20;
      let days = 2;
      if (tier === 'STANDARD') {
        delta = 30;
        days = 3;
      }
      if (tier === 'PREMIUM') {
        delta = 40;
        days = 4;
      }

      modifiers.push({
        label: `Expedite Delivery (${days}-day)`,
        delta,
      });
    }
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
