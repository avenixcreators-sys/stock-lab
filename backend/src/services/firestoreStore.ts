import { randomUUID } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirestore, isFirebaseReady } from './firebase.js';
import db from '../database.js';

/**
 * Firestore data-access layer for per-user StockLab state.
 *
 * All user data lives under users/{uid}/... and is isolated by the verified
 * Firebase UID (the middleware sets req.userId from the verified ID token).
 * The StockLab backend is the ONLY writer of financial state (virtual cash,
 * holdings, transactions) so totals are computed server-side inside Firestore
 * transactions — never trusted from the client.
 *
 * The SQLite DB remains for immutable public reference data only (stocks,
 * lessons, quiz questions, market/price history).
 */

const STARTING_CASH = 500;

function guardFirestore(): Firestore {
  if (!isFirebaseReady()) {
    throw new Error('Firestore is not configured on this server.');
  }
  const fs = getFirestore();
  if (!fs) throw new Error('Firestore is not configured on this server.');
  return fs;
}

function companyName(symbol: string): string {
  const row: any = db.prepare('SELECT name FROM stocks WHERE symbol = ?').get(symbol.toUpperCase());
  return row?.name || symbol.toUpperCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// User profile / virtual cash
// ---------------------------------------------------------------------------

export interface StoreUser {
  id: string;
  email: string;
  name: string;
  displayName: string;
  avatarUrl: string | null;
  cashBalance: number;
  createdAt: string;
}

/**
 * Returns the user doc, or null. Does NOT create.
 */
export async function getUser(uid: string): Promise<StoreUser | null> {
  const fs = guardFirestore();
  const doc = await fs.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    id: doc.id,
    email: d.email || '',
    name: d.displayName || d.name || '',
    displayName: d.displayName || d.name || '',
    avatarUrl: d.photoURL || null,
    cashBalance: typeof d.virtualCash === 'number' ? d.virtualCash : STARTING_CASH,
    createdAt: d.createdAt || '',
  };
}

/**
 * Gets the user, creating their Firestore profile with ₹500 virtual cash only
 * on first creation. Existing users retain their balance (never reset).
 */
export async function getOrCreateUser(
  uid: string,
  opts: { email?: string; name?: string; photoURL?: string }
): Promise<StoreUser> {
  const fs = guardFirestore();
  const col = fs.collection('users');
  const ref = col.doc(uid);
  const doc = await ref.get();

  const existing = getUser(uid);
  const existingData = await existing;

  if (doc.exists && existingData) {
    // Update login metadata + name/avatar if we have fresher values.
    const patch: Record<string, unknown> = { updatedAt: nowIso() };
    if (opts.name) patch.displayName = opts.name;
    if (opts.name) patch.name = opts.name;
    if (opts.photoURL) patch.photoURL = opts.photoURL;
    await ref.update(patch).catch(() => {});
    return {
      ...existingData,
      name: opts.name || existingData.name,
      displayName: opts.name || existingData.name,
      avatarUrl: opts.photoURL || existingData.avatarUrl,
    };
  }

  // First creation → grant ₹500 virtual cash.
  await ref.set({
    displayName: opts.name || 'Student',
    name: opts.name || 'Student',
    email: opts.email || '',
    photoURL: opts.photoURL || null,
    virtualCash: STARTING_CASH,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  return {
    id: uid,
    email: opts.email || '',
    name: opts.name || 'Student',
    displayName: opts.name || 'Student',
    avatarUrl: opts.photoURL || null,
    cashBalance: STARTING_CASH,
    createdAt: '',
  };
}

export async function updateUserProfile(uid: string, name: string): Promise<void> {
  const fs = guardFirestore();
  await fs.collection('users').doc(uid).update({
    displayName: name,
    name,
    updatedAt: nowIso(),
  });
}

export async function getUserCash(uid: string): Promise<number> {
  const u = await getUser(uid);
  return u ? u.cashBalance : 0;
}

// ---------------------------------------------------------------------------
// Holdings
// ---------------------------------------------------------------------------

export interface StoreHolding {
  symbol: string;
  companyName: string;
  quantity: number;
  averagePrice: number;
  totalInvested: number;
  updatedAt: string;
}

export async function getHolding(uid: string, symbol: string): Promise<StoreHolding | null> {
  const fs = guardFirestore();
  const doc = await fs.collection('users').doc(uid).collection('holdings').doc(symbol).get();
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    symbol: doc.id,
    companyName: d.companyName || symbol,
    quantity: d.quantity || 0,
    averagePrice: d.averagePrice || 0,
    totalInvested: d.totalInvested || 0,
    updatedAt: d.updatedAt || '',
  };
}

export async function getHoldings(uid: string): Promise<StoreHolding[]> {
  const fs = guardFirestore();
  const snap = await fs
    .collection('users')
    .doc(uid)
    .collection('holdings')
    .where('quantity', '>', 0)
    .get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      symbol: d.id,
      companyName: x.companyName || d.id,
      quantity: x.quantity || 0,
      averagePrice: x.averagePrice || 0,
      totalInvested: x.totalInvested || 0,
      updatedAt: x.updatedAt || '',
    };
  });
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface StoreTransaction {
  id: string;
  symbol: string;
  companyName: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalValue: number;
  createdAt: string;
}

export async function getTransactions(
  uid: string,
  filter?: 'buy' | 'sell' | '',
  limit = 50
): Promise<StoreTransaction[]> {
  const fs = guardFirestore();
  let q: FirebaseFirestore.Query = fs
    .collection('users')
    .doc(uid)
    .collection('transactions')
    .orderBy('createdAt', 'desc')
    .limit(Math.min(200, Math.max(1, limit || 50)));
  if (filter === 'buy' || filter === 'sell') {
    q = q.where('type', '==', filter);
  }
  const snap = await q.get();
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      symbol: x.symbol,
      companyName: x.companyName || x.symbol,
      type: x.type as 'buy' | 'sell',
      quantity: x.quantity,
      price: x.price,
      totalValue: x.totalValue,
      createdAt: x.createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

export interface StoreWatchItem {
  symbol: string;
  companyName: string;
  addedAt: string;
}

export async function getWatchlist(uid: string): Promise<StoreWatchItem[]> {
  const fs = guardFirestore();
  const snap = await fs
    .collection('users')
    .doc(uid)
    .collection('watchlist')
    .orderBy('addedAt', 'desc')
    .get();
  return snap.docs.map((d) => {
    const x = d.data();
    return { symbol: d.id, companyName: x.companyName || d.id, addedAt: x.addedAt || '' };
  });
}

export async function addWatchItem(uid: string, symbol: string): Promise<boolean> {
  const fs = guardFirestore();
  const ref = fs.collection('users').doc(uid).collection('watchlist').doc(symbol.toUpperCase());
  const existing = await ref.get();
  if (existing.exists) return false;
  await ref.set({
    symbol: symbol.toUpperCase(),
    companyName: companyName(symbol),
    addedAt: nowIso(),
  });
  return true;
}

export async function removeWatchItem(uid: string, symbol: string): Promise<void> {
  const fs = guardFirestore();
  await fs
    .collection('users')
    .doc(uid)
    .collection('watchlist')
    .doc(symbol.toUpperCase())
    .delete();
}

export async function isInWatchlist(uid: string, symbol: string): Promise<boolean> {
  const fs = guardFirestore();
  const doc = await fs
    .collection('users')
    .doc(uid)
    .collection('watchlist')
    .doc(symbol.toUpperCase())
    .get();
  return doc.exists;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface StoreAchievement {
  badgeId: string;
  unlockedAt: string;
}

export async function getAchievements(uid: string): Promise<StoreAchievement[]> {
  const fs = guardFirestore();
  const snap = await fs.collection('users').doc(uid).collection('achievements').get();
  return snap.docs.map((d) => ({
    badgeId: d.id,
    unlockedAt: d.data().unlockedAt || '',
  }));
}

export async function hasAchievement(uid: string, badgeId: string): Promise<boolean> {
  const fs = guardFirestore();
  const doc = await fs.collection('users').doc(uid).collection('achievements').doc(badgeId).get();
  return doc.exists;
}

async function awardBadge(uid: string, badgeId: string): Promise<boolean> {
  const fs = guardFirestore();
  const ref = fs.collection('users').doc(uid).collection('achievements').doc(badgeId);
  const existing = await ref.get();
  if (existing.exists) return false;
  await ref.set({ badgeId, unlockedAt: nowIso() });
  return true;
}

export async function countCompletedLessons(uid: string): Promise<number> {
  const fs = guardFirestore();
  const snap = await fs
    .collection('users')
    .doc(uid)
    .collection('quizResults')
    .where('score', '>', 0)
    .get();
  return new Set(snap.docs.map((d) => d.id)).size;
}

export async function getQuizResult(uid: string, lessonId: string): Promise<{ score: number; total: number } | null> {
  const fs = guardFirestore();
  const doc = await fs.collection('users').doc(uid).collection('quizResults').doc(lessonId).get();
  if (!doc.exists) return null;
  const d = doc.data();
  if (!d) return null;
  return { score: d.score, total: d.total };
}

export async function saveQuizResult(
  uid: string,
  lessonId: string,
  score: number,
  total: number
): Promise<void> {
  const fs = guardFirestore();
  const ref = fs.collection('users').doc(uid).collection('quizResults').doc(lessonId);
  const existing = await ref.get();
  // Keep the best score.
  if (existing.exists && (existing.data()?.score || 0) >= score) return;
  await ref.set({ lessonId, score, total, completedAt: nowIso() });
}

// ---------------------------------------------------------------------------
// Achievements computation (mirrors previous logic, now over Firestore state)
// ---------------------------------------------------------------------------

const TOTAL_LESSONS = 12;

export async function computeAndAwardBadges(uid: string): Promise<string[]> {
  const completed = await countCompletedLessons(uid);
  const [txns, holdings, watch, hasFirstTrade, countTxns] = await Promise.all([
    getTransactions(uid, '', 200),
    getHoldings(uid),
    getWatchlist(uid),
    getTransactions(uid, '', 1).then((t) => t.length > 0),
    getTransactions(uid, '', 200).then((t) => t.length),
  ]);
  void txns;
  void hasFirstTrade;

  const distinctHoldingSymbols = new Set(holdings.map((h) => h.symbol)).size;

  const checks: Array<[string, boolean]> = [
    ['first-lesson', completed >= 1],
    ['five-lessons', completed >= 5],
    ['ten-lessons', completed >= 10],
    ['all-lessons', completed >= TOTAL_LESSONS],
    ['first-trade', countTxns >= 1],
    ['diversified', distinctHoldingSymbols >= 5],
    ['watchlist-tracker', watch.length >= 3],
    ['portfolio-builder', distinctHoldingSymbols >= 1],
  ];

  const awarded: string[] = [];
  for (const [badge, earned] of checks) {
    if (earned) {
      const created = await awardBadge(uid, badge);
      if (created) awarded.push(badge);
    }
  }
  return awarded;
}

// ---------------------------------------------------------------------------
// Atomic buy / sell (server-side validation inside a Firestore transaction)
// ---------------------------------------------------------------------------

export interface OrderResult {
  newCashBalance: number;
  holding: { symbol: string; quantity: number; averagePrice: number };
  transaction: {
    id: string;
    type: 'buy' | 'sell';
    symbol: string;
    companyName: string;
    quantity: number;
    price: number;
    totalValue: number;
    createdAt: string;
  };
}

/**
 * Buy: validate cash and apply quantities inside one Firestore transaction so
 * concurrent buys cannot both over-spend.
 *
 * @throws Error with `.status` (400) for validation/business failures, and
 *         Error with `.status` (503) if Firestore is not configured.
 */
export async function runBuy(
  uid: string,
  symbol: string,
  quantity: number,
  price: number
): Promise<OrderResult> {
  const fs = guardFirestore();
  const userRef = fs.collection('users').doc(uid);
  const holdingRef = userRef.collection('holdings').doc(symbol.toUpperCase());
  const totalCost = price * quantity;

  const result = await fs.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    const userData = userDoc.data();
    if (!userDoc.exists || !userData) {
      throw Object.assign(new Error('User profile not found. Please sign in again.'), { status: 401 });
    }
    const cash = typeof userData.virtualCash === 'number' ? userData.virtualCash : 0;
    if (cash < totalCost) {
      throw Object.assign(
        new Error('Insufficient cash'),
        { status: 400, required: totalCost, available: cash }
      );
    }

    const holdingDoc = await tx.get(holdingRef);
    const holding = holdingDoc.data() || { quantity: 0, averagePrice: 0, totalInvested: 0 };

    const newQuantity = (holding.quantity || 0) + quantity;
    const newAvg =
      newQuantity > 0
        ? ((holding.averagePrice || 0) * (holding.quantity || 0) + totalCost) / newQuantity
        : price;
    const newInvested = (holding.totalInvested || 0) + totalCost;

    const newCash = Math.round((cash - totalCost) * 100) / 100;
    tx.update(userRef, { virtualCash: newCash, updatedAt: nowIso() });
    tx.set(
      holdingRef,
      {
        symbol: symbol.toUpperCase(),
        companyName: companyName(symbol),
        quantity: newQuantity,
        averagePrice: Math.round(newAvg * 100) / 100,
        totalInvested: Math.round(newInvested * 100) / 100,
        updatedAt: nowIso(),
      },
      { merge: true }
    );

    const txn: OrderResult['transaction'] = {
      id: randomUUID(),
      type: 'buy',
      symbol: symbol.toUpperCase(),
      companyName: companyName(symbol),
      quantity,
      price,
      totalValue: Math.round(totalCost * 100) / 100,
      createdAt: nowIso(),
    };
    tx.set(userRef.collection('transactions').doc(txn.id), txn);

    return {
      newCashBalance: newCash,
      holding: {
        symbol: symbol.toUpperCase(),
        quantity: newQuantity,
        averagePrice: Math.round(newAvg * 100) / 100,
      },
      transaction: txn,
    };
  });

  return result;
}

/**
 * Sell: validate owned quantity and apply inside one Firestore transaction.
 * @throws Error with `.status` (400) for validation/business failures.
 */
export async function runSell(
  uid: string,
  symbol: string,
  quantity: number,
  price: number
): Promise<OrderResult> {
  const fs = guardFirestore();
  const userRef = fs.collection('users').doc(uid);
  const holdingRef = userRef.collection('holdings').doc(symbol.toUpperCase());
  const totalProceeds = price * quantity;

  const result = await fs.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    const userData = userDoc.data();
    if (!userDoc.exists || !userData) {
      throw Object.assign(new Error('User profile not found. Please sign in again.'), { status: 401 });
    }

    const holdingDoc = await tx.get(holdingRef);
    const holding = holdingDoc.data();
    if (!holdingDoc.exists || !holding || (holding.quantity || 0) < quantity) {
      throw Object.assign(new Error('Insufficient shares'), {
        status: 400,
        owned: holding?.quantity || 0,
        requested: quantity,
      });
    }

    const newQuantity = (holding.quantity || 0) - quantity;
    const cash = typeof userData.virtualCash === 'number' ? userData.virtualCash : 0;
    const newCash = Math.round((cash + totalProceeds) * 100) / 100;

    tx.update(userRef, { virtualCash: newCash, updatedAt: nowIso() });
    if (newQuantity <= 0) {
      tx.delete(holdingRef);
    } else {
      tx.update(holdingRef, {
        quantity: newQuantity,
        totalInvested: Math.round(((holding.totalInvested || 0) / (holding.quantity || 1)) * newQuantity * 100) / 100,
        updatedAt: nowIso(),
      });
    }

    const txn: OrderResult['transaction'] = {
      id: randomUUID(),
      type: 'sell',
      symbol: symbol.toUpperCase(),
      companyName: companyName(symbol),
      quantity,
      price,
      totalValue: Math.round(totalProceeds * 100) / 100,
      createdAt: nowIso(),
    };
    tx.set(userRef.collection('transactions').doc(txn.id), txn);

    return {
      newCashBalance: newCash,
      holding: { symbol: symbol.toUpperCase(), quantity: newQuantity, averagePrice: holding.averagePrice || 0 },
      transaction: txn,
    };
  });

  return result;
}
