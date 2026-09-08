import { doc, getDoc, setDoc, getDocs, collection, query, where, orderBy, limit, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from 'firebase/auth';

const USERS = 'users';

function usersRef(uid: string) { return doc(db!, USERS, uid); }
function colRef(uid: string, name: string) { return collection(doc(db!, USERS, uid), name); }

export interface Portfolio {
  cashBalance: number;
}
export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  avgPurchasePrice: number;
  currentValue: number;
  profitLoss: number;
}
export interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  totalValue: number;
  createdAt: string;
}
export interface WatchlistEntry {
  symbol: string;
  name: string;
}
export interface Profile {
  name: string;
  email: string;
}

export async function getPortfolio(uid: string): Promise<Portfolio> {
  const snap = await getDoc(usersRef(uid));
  if (!snap.exists()) return { cashBalance: 1000 };
  const d = snap.data() as Portfolio;
  return { cashBalance: d.cashBalance ?? 1000 };
}

export async function savePortfolio(uid: string, cashBalance: number) {
  await setDoc(usersRef(uid), { cashBalance }, { merge: true });
}

export async function getHoldings(uid: string): Promise<Holding[]> {
  const snap = await getDocs(colRef(uid, 'holdings'));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as unknown as Holding) } as unknown as Holding));
}

export async function getTransactions(uid: string, lim = 100): Promise<Transaction[]> {
  const q = query(colRef(uid, 'transactions'), orderBy('createdAt', 'desc'), limit(lim));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data() as any;
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || '');
    return { id: d.id, ...data, createdAt } as Transaction;
  });
}

export async function getTransactionCount(uid: string): Promise<number> {
  const snap = await getDocs(colRef(uid, 'transactions'));
  return snap.size;
}

export async function getWatchlist(uid: string): Promise<WatchlistEntry[]> {
  const snap = await getDocs(colRef(uid, 'watchlist'));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as unknown as WatchlistEntry) } as unknown as WatchlistEntry));
}

export async function addToWatchlist(uid: string, entry: WatchlistEntry) {
  await addDoc(colRef(uid, 'watchlist'), { ...entry });
}

export async function removeFromWatchlist(uid: string, symbol: string) {
  const q = query(colRef(uid, 'watchlist'), where('symbol', '==', symbol));
  const snap = await getDocs(q);
  for (const d of snap.docs) await deleteDoc(doc(colRef(uid, 'watchlist'), d.id));
}

export async function getProfile(uid: string): Promise<Profile> {
  const snap = await getDoc(usersRef(uid));
  if (!snap.exists()) return { name: '', email: '' };
  const d = snap.data() as Profile;
  return { name: d.name ?? '', email: d.email ?? '' };
}

export async function saveProfile(uid: string, profile: Partial<Profile>) {
  await setDoc(usersRef(uid), profile, { merge: true });
}

export async function executeTrade(uid: string, trade: { type: 'buy' | 'sell'; symbol: string; name: string; quantity: number; price: number }) {
  const portfolio = await getPortfolio(uid);
  const holdings = await getHoldings(uid);
  const totalValue = trade.price * trade.quantity;

  if (trade.type === 'buy') {
    if (totalValue > portfolio.cashBalance) throw new Error('Insufficient virtual cash.');
  } else {
    const h = holdings.find(x => x.symbol === trade.symbol);
    if (!h || h.quantity < trade.quantity) throw new Error('Not enough shares to sell.');
  }

  const newCash = trade.type === 'buy' ? portfolio.cashBalance - totalValue : portfolio.cashBalance + totalValue;
  await savePortfolio(uid, newCash);

  const existing = holdings.find(h => h.symbol === trade.symbol);
  if (trade.type === 'buy') {
    if (existing) {
      const totalQty = existing.quantity + trade.quantity;
      const avgPrice = (existing.avgPurchasePrice * existing.quantity + totalValue) / totalQty;
      await setDoc(doc(colRef(uid, 'holdings'), trade.symbol), { name: trade.name, quantity: totalQty, avgPurchasePrice: avgPrice, currentValue: totalValue, profitLoss: 0 }, { merge: true });
    } else {
      await addDoc(colRef(uid, 'holdings'), { symbol: trade.symbol, name: trade.name, quantity: trade.quantity, avgPurchasePrice: trade.price, currentValue: totalValue, profitLoss: 0 });
    }
  } else {
    if (!existing) throw new Error('Not enough shares to sell.');
    if (existing.quantity === trade.quantity) {
      await deleteDoc(doc(colRef(uid, 'holdings'), trade.symbol));
    } else {
      await setDoc(doc(colRef(uid, 'holdings'), trade.symbol), { quantity: existing.quantity - trade.quantity }, { merge: true });
    }
  }

  await addDoc(colRef(uid, 'transactions'), {
    type: trade.type, symbol: trade.symbol, name: trade.name,
    quantity: trade.quantity, price: trade.price, totalValue,
    createdAt: serverTimestamp(),
  });
  return { success: true, newCash };
}
