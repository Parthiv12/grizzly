import { SpanMeta, withBusinessSpan } from '../observability/span-utils';

class ShippingService {
  async calculateShippingRates(cartSize: number, meta: SpanMeta): Promise<{ rate: number, carrier: string }> {
    return withBusinessSpan('calc_shipping_rates', {
      layer: 'service',
      resource: 'shipping',
      operation: 'calculate',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute,
      cartSize
    }, async () => {
      // Simulate remote API
      await new Promise(r => setTimeout(r, 180));
      return { rate: cartSize * 2.5 + 5.0, carrier: 'FedEx' };
    });
  }

  async createLabel(orderId: string, meta: SpanMeta): Promise<void> {
    return withBusinessSpan('create_shipping_label', {
      layer: 'external',
      resource: 'easypost_api',
      operation: 'create_label',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute,
      orderId
    }, async () => {
      await new Promise(r => setTimeout(r, 400));
    });
  }
}

export const shippingService = new ShippingService();
