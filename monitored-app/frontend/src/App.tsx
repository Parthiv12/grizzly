import { useEffect, useState } from 'react';

type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  inStock: boolean;
};

type CartItem = {
  productId: string;
  product: Product;
  quantity: number;
};

export function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  
  const [forceInventoryFailure, setForceInventoryFailure] = useState(false);
  const [forcePaymentLatency, setForcePaymentLatency] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auth States
  const [showLogin, setShowLogin] = useState(false);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('admin@tracelens.com');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginLoading, setLoginLoading] = useState(false);
  const [forceSlowDb, setForceSlowDb] = useState(false);

  useEffect(() => {
    loadProducts();
    loadOrders();

    // Auto-refresh orders every 2 seconds so Postman changes instantly appear in UI
    const interval = setInterval(() => {
      loadOrders();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  async function loadOrders() {
    try {
      const resp = await fetch('/api/checkout/orders');
      if (resp.ok) setRecentOrders(await resp.json());
    } catch (e) {}
  }

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to load products');
      const data = await response.json();
      setProducts(data ?? []);
    } catch (e: any) {
      setError(e.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId: product.id, product, quantity: 1 }];
    });
  }

  function clearCart() {
    setCart([]);
  }

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.product.price), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  async function onCheckout() {
    if (cart.length === 0) return;

    setError(null);
    setSuccess(null);
    setCheckoutLoading(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
          forceInventoryFailure,
          forcePaymentLatency
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `500: Server crashed during checkout`);
      }

      setSuccess('Successfully placed order!');
      clearCart();
      loadOrders();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-dot" />
          <div>
            <p className="brand-name">Mock-azon</p>
            <p className="brand-subtitle">E-Commerce Monitored App</p>
          </div>
        </div>

        <div className="topbar-controls" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {activeUser ? (
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>Hello, {activeUser.name}</span>
                <button type="button" className="button" style={{ background: '#f8fafc', fontWeight: 600, padding: '6px 12px' }} onClick={() => setActiveUser(null)}>Sign Out</button>
             </div>
          ) : (
            <button type="button" className="button button-primary" style={{ fontWeight: 600 }} onClick={() => setShowLogin(true)}>
              Sign In
            </button>
          )}

          <button type="button" className="button" style={{ background: '#f8fafc', fontWeight: 600 }}>
            🛒 Cart ({cartItemCount})
          </button>
        </div>
      </header>

      <main className="layout-grid" style={{ gridTemplateColumns: '1fr 360px', alignItems: 'stretch' }}>
        <section className="panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
             <h2 style={{ fontSize: '24px', fontWeight: 600, color: '#0f172a', margin: 0 }}>Developer Swag Store</h2>
             <button type="button" className="button" onClick={loadProducts} disabled={loading}>
                Refresh Catalog
             </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px', width: '100%' }}>
            {loading ? <div className="empty-state" style={{ gridColumn: '1 / -1' }}>Loading products...</div> : null}
            {!loading && products.map((p) => (
              <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>{p.image}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#0f172a', fontWeight: 600 }}>{p.name}</h3>
                <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b', flex: 1, lineHeight: 1.5 }}>{p.description}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span style={{ fontWeight: 700, fontSize: '18px', color: '#10b981' }}>${p.price.toFixed(2)}</span>
                  <button type="button" className="button button-primary" style={{ padding: '8px 16px', fontSize: '14px', fontWeight: 600, borderRadius: '8px' }} onClick={() => addToCart(p)}>
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="panel" style={{ height: 'max-content', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header" style={{ padding: '16px 24px', background: '#fbfcfd' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: 0 }}>Your Cart</h2>
          </div>

          <div style={{ padding: '24px' }}>
            {cart.length === 0 ? (
              <div className="empty-state" style={{ margin: 0, padding: '40px 20px' }}>Your cart is empty. Add some swag!</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {cart.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>{item.quantity}x</span>
                      <span>{item.product.name}</span>
                    </div>
                    <span style={{ fontWeight: 500 }}>${(item.quantity * item.product.price).toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '16px', fontWeight: 700, paddingTop: '8px' }}>
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>Demo Bug Toggles (Trace Config)</div>
              
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px', color: '#ef4444', fontWeight: 500 }}>
                <input type="checkbox" checked={forceInventoryFailure} onChange={(e) => setForceInventoryFailure(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                Force Out-of-Stock (500 Error)
              </label>

              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#d97706', fontWeight: 500 }}>
                <input type="checkbox" checked={forcePaymentLatency} onChange={(e) => setForcePaymentLatency(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                Force Stripe Delay (3.5s)
              </label>
            </div>

            <button 
              type="button" 
              className="button button-primary" 
              style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: 600, borderRadius: '8px' }} 
              disabled={cart.length === 0 || checkoutLoading}
              onClick={onCheckout}
            >
              {checkoutLoading ? 'Processing Order...' : 'Submit Checkout'}
            </button>
            <p style={{ textAlign: 'center', margin: '14px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Submitting checkout will generate a massive trace!
            </p>

            {recentOrders.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '16px' }}>Recent Orders</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {recentOrders.map(order => (
                    <div key={order.id} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{order.id}</span>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>${order.total}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                        <span>{order.items} items</span>
                        <span>{new Date(order.date).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </aside>
      </main>

      {showLogin && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="panel" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', margin: '0 0 24px' }}>Sign In to Mock-azon</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setError(null); setSuccess(null); setLoginLoading(true);
              try {
                const response = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: loginEmail, password: loginPassword, forceSlowDb })
                });
                if (!response.ok) {
                  const errData = await response.json().catch(() => null);
                  throw new Error(errData?.error || `401: Invalid Credentials`);
                }
                const data = await response.json();
                setSuccess(`Welcome back, ${data.name}!`);
                setActiveUser(data);
                setShowLogin(false);
              } catch (err: any) {
                setError(err.message);
              } finally {
                setLoginLoading(false);
              }
            }} className="form-stack">
              <label className="field-label">Email Address</label>
              <input className="input" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
              
              <label className="field-label">Password</label>
              <input className="input" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '16px', color: '#f59e0b', fontWeight: 500 }}>
                <input type="checkbox" checked={forceSlowDb} onChange={(e) => {
                  setForceSlowDb(e.target.checked);
                  if (e.target.checked) alert('Demo: The login will intentionally hang for 2.5s to trace a DB bottleneck!');
                }} name="forceSlowDb" style={{ width: '16px', height: '16px' }} />
                Force Slow Database Query (2.5s)
              </label>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" className="button button-primary" style={{ flex: 1, padding: '10px' }} disabled={loginLoading}>
                  {loginLoading ? 'Authenticating...' : 'Sign In'}
                </button>
                <button type="button" className="button" style={{ flex: 1, padding: '10px' }} onClick={() => setShowLogin(false)} disabled={loginLoading}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error ? <div className="toast-error">🚨 {error}</div> : null}
      {success ? (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div className="panel" style={{ width: '100%', maxWidth: '440px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', marginBottom: '20px' }}>
              🎉
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>Order Confirmed!</h2>
            <p style={{ color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
              Your trace has successfully propagated through the microservices.
            </p>
            <button type="button" className="button button-primary" style={{ padding: '12px 24px', fontSize: '16px', fontWeight: 600, borderRadius: '8px' }} onClick={() => setSuccess(null)}>
              Continue Shopping
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
