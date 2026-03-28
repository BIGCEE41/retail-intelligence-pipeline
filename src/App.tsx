import { useEffect, useState, useMemo, FormEvent } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  limit, 
  Timestamp,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Plus, 
  Trash2, 
  LogOut, 
  LogIn,
  AlertCircle,
  Loader2,
  ChevronRight,
  DollarSign,
  BarChart3,
  Users
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';

// --- Types ---
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  sku: string;
}

interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  timestamp: Timestamp;
  sellerId: string;
}

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// --- Error Handling ---
function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error?.message || String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  // In a real app, we'd show a toast or alert
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'sales'>('dashboard');
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create profile
        const profileDoc = await getDoc(doc(db, 'users', u.uid));
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            displayName: u.displayName || 'User',
            email: u.email || '',
            role: u.email === 'bigcee30@gmail.com' ? 'admin' : 'staff'
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setIsAuthReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubSales = onSnapshot(
      query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(100)),
      (snapshot) => {
        setSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sale)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'sales')
    );

    return () => {
      unsubProducts();
      unsubSales();
    };
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Login Error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Actions ---
  const addProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newProduct = {
      name: formData.get('name') as string,
      price: parseFloat(formData.get('price') as string),
      category: formData.get('category') as string,
      stock: parseInt(formData.get('stock') as string),
      sku: formData.get('sku') as string,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'products'), newProduct);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products');
    }
  };

  const recordSale = async (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock < quantity) return;

    const totalAmount = product.price * quantity;
    const saleData = {
      productId,
      productName: product.name,
      quantity,
      totalAmount,
      timestamp: serverTimestamp(),
      sellerId: user?.uid
    };

    try {
      await addDoc(collection(db, 'sales'), saleData);
      await updateDoc(doc(db, 'products', productId), {
        stock: product.stock - quantity
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sales');
    }
  };

  // --- Analytics ---
  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalSales = sales.length;
    const lowStockItems = products.filter(p => p.stock < 10).length;
    
    // Chart data: Revenue by day
    const revenueByDay: Record<string, number> = {};
    sales.forEach(s => {
      const date = format(s.timestamp.toDate(), 'MMM dd');
      revenueByDay[date] = (revenueByDay[date] || 0) + s.totalAmount;
    });
    const chartData = Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount })).reverse();

    return { totalRevenue, totalSales, lowStockItems, chartData };
  }, [sales, products]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Retail Analytics</h1>
          <p className="text-slate-500 mb-8 text-sm">Sign in to access your sales dashboard and inventory management system.</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <span className="font-bold text-lg">RetailPro</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'inventory' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Package className="w-5 h-5" />
            Inventory
          </button>
          <button 
            onClick={() => setActiveTab('sales')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'sales' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <ShoppingCart className="w-5 h-5" />
            Sales Log
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img src={user.photoURL || ''} className="w-8 h-8 rounded-full" alt="" />
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
            <p className="text-slate-500 text-sm">Welcome back, {user.displayName?.split(' ')[0]}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded uppercase">{format(new Date(), 'MMM dd, yyyy')}</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Revenue</p>
                    <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
                  </div>
                </div>
                <div className="card flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Sales</p>
                    <p className="text-2xl font-bold">{stats.totalSales}</p>
                  </div>
                </div>
                <div className="card flex items-center gap-4">
                  <div className="p-3 bg-amber-100 rounded-xl">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Low Stock Items</p>
                    <p className="text-2xl font-bold">{stats.lowStockItems}</p>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="card">
                  <h3 className="font-bold mb-6">Revenue Trend</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.chartData}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="amount" stroke="#3B82F6" fillOpacity={1} fill="url(#colorRev)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card">
                  <h3 className="font-bold mb-6">Recent Transactions</h3>
                  <div className="space-y-4">
                    {sales.slice(0, 5).map(sale => (
                      <div key={sale.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{sale.productName}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{format(sale.timestamp.toDate(), 'HH:mm')}</p>
                          </div>
                        </div>
                        <p className="font-bold text-green-600">+${sale.totalAmount}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Add Product Form */}
              {(profile?.role === 'admin' || profile?.role === 'manager') && (
                <div className="card">
                  <h3 className="font-bold mb-4">Add New Product</h3>
                  <form onSubmit={addProduct} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <input name="name" placeholder="Product Name" required className="input-field md:col-span-2" />
                    <input name="price" type="number" step="0.01" placeholder="Price" required className="input-field" />
                    <input name="stock" type="number" placeholder="Stock" required className="input-field" />
                    <input name="sku" placeholder="SKU" required className="input-field" />
                    <select name="category" className="input-field">
                      <option value="Electronics">Electronics</option>
                      <option value="Clothing">Clothing</option>
                      <option value="Home">Home</option>
                      <option value="Food">Food</option>
                    </select>
                    <button type="submit" className="btn-primary flex items-center justify-center gap-2 md:col-span-1">
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </form>
                </div>
              )}

              {/* Inventory Table */}
              <div className="card overflow-hidden p-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => (
                      <tr key={product.id}>
                        <td className="font-bold">{product.name}</td>
                        <td className="text-slate-400 font-mono text-xs">{product.sku}</td>
                        <td><span className="px-2 py-1 bg-slate-100 rounded-full text-[10px] font-bold uppercase">{product.category}</span></td>
                        <td className="font-bold">${product.price}</td>
                        <td>
                          <span className={`font-bold ${product.stock < 10 ? 'text-red-500' : 'text-slate-700'}`}>
                            {product.stock}
                          </span>
                        </td>
                        <td>
                          <button 
                            onClick={() => recordSale(product.id, 1)}
                            disabled={product.stock === 0}
                            className="text-blue-600 hover:text-blue-800 disabled:opacity-30 flex items-center gap-1 font-bold text-xs"
                          >
                            <ShoppingCart className="w-3 h-3" /> Sell
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'sales' && (
            <motion.div 
              key="sales"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="card p-0 overflow-hidden"
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Total</th>
                    <th>Seller</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <tr key={sale.id}>
                      <td className="text-slate-400 text-xs">{format(sale.timestamp.toDate(), 'MMM dd, HH:mm')}</td>
                      <td className="font-bold">{sale.productName}</td>
                      <td>{sale.quantity}</td>
                      <td className="font-bold text-green-600">${sale.totalAmount}</td>
                      <td className="text-slate-500 text-xs">{sale.sellerId === user.uid ? 'You' : 'Other'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
