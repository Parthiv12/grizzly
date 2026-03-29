import { SpanMeta, withBusinessSpan } from '../observability/span-utils';

class PaymentService {
  async processPayment(amount: number, forceLatency: boolean, meta: SpanMeta): Promise<{ transactionId: string }> {
    return withBusinessSpan('stripe_create_charge', {
      layer: 'external',
      resource: 'stripe_api',
      operation: 'charge',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute,
      chargeAmount: amount
    }, async () => {
      // 3rd Party API Network Delay
      if (forceLatency) {
        // Massive Stripe API delay
        await new Promise(r => setTimeout(r, 3500));
      } else {
        await new Promise(r => setTimeout(r, 250)); // Normal stripe latency
      }

      return { transactionId: `ch_${Math.random().toString(36).substring(7)}` };
    });
  }
}

export const paymentService = new PaymentService();
