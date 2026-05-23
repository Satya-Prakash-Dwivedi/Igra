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
    const tier = params.packageTier || 'BASIC';
    if (tier === 'BASIC') {
      base = 30;
    } else if (tier === 'STANDARD') {
      base = 60;
    } else if (tier === 'PREMIUM') {
      base = 100;
    } else {
      base = 30;
    }

    if (params.deliverySpeed === 'EXPRESS') {
      let delta = 10;
      if (tier === 'STANDARD') delta = 20;
      if (tier === 'PREMIUM') delta = 30;

      modifiers.push({
        label: 'Express Delivery (24 Hours)',
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
