import { SpanMeta, withBusinessSpan } from '../observability/span-utils';
import { productsRepository } from '../repositories/products.repository';
import { CartItem } from '../types/ecommerce';

class InventoryService {
  async reserveInventory(cart: CartItem[], forceFailure: boolean, meta: SpanMeta): Promise<void> {
    return withBusinessSpan('inventory_reserve', {
      layer: 'service',
      resource: 'inventory',
      operation: 'reserve',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute,
      cartSize: cart.length
    }, async () => {
      // Simulate remote API call to warehouse
      await new Promise(r => setTimeout(r, 120));

      if (forceFailure) {
        throw new Error('Inventory lock failed: Item prod_3 is currently out of stock in warehouse.');
      }

      // Check N+1 scenario (fetching product details individually)
      for (const item of cart) {
        // N+1 DB CALL CAUGHT IN TRACE
        await productsRepository.getProductById(item.productId, meta);
      }
    });
  }
}

export const inventoryService = new InventoryService();
