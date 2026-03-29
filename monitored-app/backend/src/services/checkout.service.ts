import { SpanMeta, trace, withBusinessSpan } from '../observability/span-utils';
import { CheckoutRequest } from '../types/ecommerce';
import { inventoryService } from './inventory.service';
import { paymentService } from './payment.service';
import { shippingService } from './shipping.service';

class CheckoutService {
  private orders: any[] = [];

  async processCheckout(body: CheckoutRequest, meta: SpanMeta): Promise<{ orderId: string, status: string }> {
    return withBusinessSpan('process_checkout', {
      layer: 'service',
      resource: 'checkout',
      operation: 'process',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      
      const cartTotalItems = body.cart.reduce((sum, item) => sum + item.quantity, 0);

      try {
        // 1. Reserve Inventory (might throw 500)
        await inventoryService.reserveInventory(body.cart, body.forceInventoryFailure || false, meta);

        // 2. Calc Shipping
        const shipping = await shippingService.calculateShippingRates(cartTotalItems, meta);

        // 3. Process Stripe Payment (might be very slow)
        // Hardcode dummy amount for demo: $150.00
        const charge = await paymentService.processPayment(150.0 + shipping.rate, body.forcePaymentLatency || false, meta);

        const orderId = `ORD-${Math.floor(Math.random() * 90000) + 10000}`;

        // 4. Create Shipping label
        await shippingService.createLabel(orderId, meta);

        // Give the trace a nice attribute success true
        const span = trace.getActiveSpan();
        if (span) {
           span.setAttribute('order.status', 'success');
           span.setAttribute('order.id', orderId);
           span.setAttribute('stripe.transaction', charge.transactionId);
        }

        this.orders.unshift({
          id: orderId,
          status: 'Completed',
          total: (150.0 + shipping.rate).toFixed(2),
          items: cartTotalItems,
          date: new Date().toISOString()
        });

        return { orderId, status: 'Success! Order placed.' };
      } catch (err: any) {
        // Attach explicit bug tag so it renders easily in TraceLens
        const span = trace.getActiveSpan();
        if (span) {
          span.setAttribute('order.status', 'failed');
          span.setAttribute('error.type', 'checkout_failure');
        }
        throw err;
      }
    });
  }

  async getRecentOrders() {
    // We intentionally DO NOT wrap this in a span, so the 2-second UI polling 
    // doesn't spam the TraceLens presentation with 100s of 'fetch_recent_orders' traces!
    await new Promise(r => setTimeout(r, 15)); 
    return this.orders.slice(0, 5);
  }
}

export const checkoutService = new CheckoutService();
