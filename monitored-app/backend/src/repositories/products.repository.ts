import { Product } from '../types/ecommerce';
import { SpanMeta, withBusinessSpan } from '../observability/span-utils';

class ProductsRepository {
  private db: Product[] = [
    { id: 'prod_1', name: 'TraceLens Hoodie', price: 45.0, description: 'Stay warm while debugging 500s.', image: '🧥', inStock: true },
    { id: 'prod_2', name: 'OpenTelemetry Mug', price: 15.0, description: 'Fuel for those late night pager alerts.', image: '☕', inStock: true },
    { id: 'prod_3', name: 'Distributed Chaos Button', price: 99.99, description: 'Causes random network partitions.', image: '🔴', inStock: true },
    { id: 'prod_4', name: 'Limited Edition Rubber Duck', price: 25.0, description: 'Talk to it until your code works.', image: '🦆', inStock: true }
  ];

  async getProducts(meta: SpanMeta): Promise<Product[]> {
    return withBusinessSpan('db_select_products', {
      layer: 'database',
      resource: 'products_db',
      operation: 'select',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      // Fast query
      await new Promise(r => setTimeout(r, 15));
      return this.db;
    });
  }

  // N+1 Bug Scenario
  async getProductById(id: string, meta: SpanMeta): Promise<Product | undefined> {
    return withBusinessSpan('db_select_product_by_id', {
      layer: 'database',
      resource: 'products_db',
      operation: 'select',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute,
      productId: id
    }, async () => {
      // Moderate query latency (simulates sequential N+1 pain)
      await new Promise(r => setTimeout(r, 45));
      return this.db.find(p => p.id === id);
    });
  }
}

export const productsRepository = new ProductsRepository();
