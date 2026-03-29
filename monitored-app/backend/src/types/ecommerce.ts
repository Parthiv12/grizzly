export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  inStock: boolean;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface CheckoutRequest {
  cart: CartItem[];
  forceInventoryFailure: boolean;
  forcePaymentLatency: boolean;
}
