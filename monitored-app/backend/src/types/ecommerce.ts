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

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | string;

export interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string | null;
  status?: IssueStatus | null;
  priority?: 'low' | 'medium' | 'high' | null;
}

export interface RequestTraceMeta {
  httpMethod?: string;
  httpRoute?: string;
  forceSlow?: boolean;
  forceDbError?: boolean;
}
