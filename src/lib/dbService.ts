import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Trade, BrokerConfig, Strategy, UserGoals, EMPTY_GOALS } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Default presets for brokers to give beginners an instant setup.
// STT and stamp duty are stored as PERCENT_OF_TURNOVER so they scale with
// trade size — the old flat-₹ rows silently under- or over-charged. GST and
// exchange charges stay flat approximations (they depend on brokerage which
// varies).
export const DEFAULT_BROKERS: BrokerConfig[] = [
  {
    id: 'default-dhan',
    name: 'Dhan',
    presetKey: 'dhan',
    brokeragePerTrade: 20.00,
    estimatedSlippagePercent: 0.02,
    customTaxes: [
      { key: 'STT (equity delivery)', value: 0.1, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['EQUITY'] },
      { key: 'STT (options, sell side)', value: 0.0625, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['FNO'] },
      { key: 'Exchange transaction (~)', value: 0.0035, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['FNO'] },
      { key: 'GST (~18% on brokerage)', value: 7.20, mode: 'FLAT' },
      { key: 'Stamp duty (buy side, ~0.003%)', value: 0.003, mode: 'PERCENT_OF_TURNOVER' },
    ],
  },
  {
    id: 'default-zerodha',
    name: 'Zerodha (Kite)',
    presetKey: 'zerodha',
    brokeragePerTrade: 20.00,
    estimatedSlippagePercent: 0.02,
    customTaxes: [
      { key: 'STT (equity delivery)', value: 0.1, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['EQUITY'] },
      { key: 'STT (options, sell side)', value: 0.0625, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['FNO'] },
      { key: 'GST (~18% on brokerage)', value: 7.20, mode: 'FLAT' },
      { key: 'Stamp duty (~0.003%)', value: 0.003, mode: 'PERCENT_OF_TURNOVER' },
    ],
  },
  {
    id: 'default-groww',
    name: 'Groww',
    presetKey: 'groww',
    brokeragePerTrade: 20.00,
    estimatedSlippagePercent: 0.03,
    customTaxes: [
      { key: 'STT (equity delivery)', value: 0.1, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['EQUITY'] },
      { key: 'STT (options, sell side)', value: 0.0625, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['FNO'] },
      { key: 'GST (~18% on brokerage)', value: 7.20, mode: 'FLAT' },
      { key: 'Stamp duty (~0.003%)', value: 0.003, mode: 'PERCENT_OF_TURNOVER' },
    ],
  },
  {
    id: 'default-angelone',
    name: 'Angel One',
    presetKey: 'angelone',
    brokeragePerTrade: 20.00,
    estimatedSlippagePercent: 0.02,
    customTaxes: [
      { key: 'STT (equity delivery)', value: 0.1, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['EQUITY'] },
      { key: 'STT (options, sell side)', value: 0.0625, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['FNO'] },
      { key: 'GST (~18% on brokerage)', value: 7.20, mode: 'FLAT' },
      { key: 'Stamp duty (~0.003%)', value: 0.003, mode: 'PERCENT_OF_TURNOVER' },
    ],
  },
  {
    id: 'default-upstox',
    name: 'Upstox',
    presetKey: 'upstox',
    brokeragePerTrade: 20.00,
    estimatedSlippagePercent: 0.02,
    customTaxes: [
      { key: 'STT (equity delivery)', value: 0.1, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['EQUITY'] },
      { key: 'STT (options, sell side)', value: 0.0625, mode: 'PERCENT_OF_TURNOVER', appliesTo: ['FNO'] },
      { key: 'GST (~18% on brokerage)', value: 7.20, mode: 'FLAT' },
      { key: 'Stamp duty (~0.003%)', value: 0.003, mode: 'PERCENT_OF_TURNOVER' },
    ],
  },
  {
    id: 'default-manual',
    name: 'Zero Fee Custom',
    brokeragePerTrade: 0.00,
    estimatedSlippagePercent: 0.00,
    customTaxes: []
  }
];

// Helper to recursively strip undefined fields so Firestore doesn't reject them
const cleanUndefined = <T extends Record<string, any>>(obj: T): T => {
  const result = { ...obj } as any;
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) {
      delete result[key];
    } else if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = cleanUndefined(result[key]);
    }
  });
  return result as T;
};

// -------------------------------------------------------------------------
// Guest-mode localStorage namespacing.
// Each browser gets a persistent random guest id so that a shared machine
// doesn't leak trades between guest sessions. Legacy unscoped keys are
// migrated once on first access.
// -------------------------------------------------------------------------
const GUEST_ID_KEY = 'tj_guestId';
const LEGACY_KEYS = ['tj_trades', 'tj_brokers', 'tj_strategies', 'tj_goals'];

function getOrCreateGuestId(): string {
  let id: string | null = null;
  try { id = localStorage.getItem(GUEST_ID_KEY); } catch { return 'default'; }
  if (id) return id;
  id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? (crypto as Crypto).randomUUID()
    : `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    localStorage.setItem(GUEST_ID_KEY, id);
    // Migrate any pre-existing unscoped keys into the new guest namespace.
    LEGACY_KEYS.forEach((k) => {
      const v = localStorage.getItem(k);
      if (v !== null && localStorage.getItem(`${k}:${id}`) === null) {
        localStorage.setItem(`${k}:${id}`, v);
        localStorage.removeItem(k);
      }
    });
  } catch { /* ignore quota / private mode errors */ }
  return id;
}

/** Namespaced localStorage key for a guest scope. Idempotent per browser. */
function guestKey(base: string): string {
  return `${base}:${getOrCreateGuestId()}`;
}

// Helper to save trades to LocalStorage for Guest mode
const getLocalTrades = (): Trade[] => {
  const data = localStorage.getItem(guestKey('tj_trades'));
  return data ? JSON.parse(data) : [];
};

const setLocalTrades = (trades: Trade[]) => {
  localStorage.setItem(guestKey('tj_trades'), JSON.stringify(trades));
};

const getLocalBrokers = (): BrokerConfig[] => {
  const data = localStorage.getItem(guestKey('tj_brokers'));
  return data ? JSON.parse(data) : DEFAULT_BROKERS;
};

const setLocalBrokers = (brokers: BrokerConfig[]) => {
  localStorage.setItem(guestKey('tj_brokers'), JSON.stringify(brokers));
};

// --- Strategy helpers (guest mode) ------------------------------------------

/**
 * Seed strategies shown to a brand-new user so the picker isn't empty.
 * Named without any userId — the caller assigns it before persisting.
 */
export const SEED_STRATEGIES: Omit<Strategy, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Opening Range Breakout (15m)',
    description: 'Fade / follow the 15-min opening range on index F&O or high-beta equity.',
    markets: ['EQUITY', 'FNO'],
    defaultChartTimeframe: '15m',
    defaultHoldingStyle: 'INTRADAY',
    checklist: [
      'Marked the 09:15–09:30 range on the chart',
      'Confirmed a decisive break with volume',
      'Stop loss placed on the opposite side of the range',
      'Risk ≤ 1 % of capital',
    ],
    rules: {
      entry: ['Price closes 15m candle beyond the opening range', 'Volume above 20-bar average'],
      exit: ['Exit at 1.5R', 'Trail SL to breakeven after 1R', 'Full exit by 14:30'],
      risk: ['Max 2 trades a day on this setup', 'Skip if opening range > 1 %'],
    },
    tags: ['ORB', 'Momentum'],
    color: 'indigo',
  },
  {
    name: 'Support / Resistance Bounce (1h)',
    description: 'Rejection candle at pre-marked HTF support or resistance level.',
    markets: ['EQUITY', 'FNO'],
    defaultChartTimeframe: '1h',
    defaultHoldingStyle: 'SWING',
    checklist: [
      'Level marked before market open',
      'Rejection wick / engulfing at level',
      'Higher-timeframe trend agrees with the trade',
    ],
    rules: {
      entry: ['Close beyond rejection candle high/low', 'RSI diverging from price'],
      exit: ['First target: next S/R', 'Second target: 2R'],
      risk: ['No pyramiding', 'Skip on major-event days'],
    },
    tags: ['S/R', 'Reversal'],
    color: 'emerald',
  },
  {
    name: 'Nifty Option Buying — Trend Continuation (5m)',
    description: 'Buy CE / PE on pullback to 20-EMA in the direction of the 15-min trend.',
    markets: ['FNO'],
    defaultChartTimeframe: '5m',
    defaultHoldingStyle: 'INTRADAY',
    checklist: [
      '15-min trend is clearly one-directional',
      'Pullback to 20-EMA on 5-min chart',
      'ATM or ITM option — avoid deep OTM',
      'Time decay awareness (avoid last 30 min)',
    ],
    rules: {
      entry: ['5-min close back through 20-EMA in trend direction'],
      exit: ['Target 30 % move on premium', 'SL 15 % of premium'],
      risk: ['Max 2 % capital per trade', 'Stop for the day after 2 consecutive losers'],
    },
    tags: ['Options', 'Trend'],
    color: 'blue',
  },
];

const getLocalStrategies = (): Strategy[] => {
  try {
    const data = localStorage.getItem(guestKey('tj_strategies'));
    return data ? (JSON.parse(data) as Strategy[]) : [];
  } catch {
    return [];
  }
};

const setLocalStrategies = (strategies: Strategy[]) => {
  localStorage.setItem(guestKey('tj_strategies'), JSON.stringify(strategies));
};

function makeSeededStrategies(userId: string): Strategy[] {
  const now = Date.now();
  return SEED_STRATEGIES.map((s, i) => ({
    ...s,
    id: `${userId}-seed-${i}`,
    userId,
    createdAt: now,
    updatedAt: now,
  }));
}

export const dbService = {
  // Realtime subscription for Trades
  subscribeTrades(
    userId: string | null, 
    onUpdate: (trades: Trade[]) => void
  ): () => void {
    if (!userId) {
      // Guest mode: read from localStorage and call immediately
      const localTrades = getLocalTrades();
      onUpdate(localTrades);
      
      // Simulate changes by listening to local events
      const handleStorageChange = () => {
        onUpdate(getLocalTrades());
      };
      window.addEventListener('tj_trades_updated', handleStorageChange);
      return () => {
        window.removeEventListener('tj_trades_updated', handleStorageChange);
      };
    }

    // Cloud mode: subscribe to Firestore
    const tradesRef = collection(db, 'trades');
    const q = query(tradesRef, where('userId', '==', userId));

    return onSnapshot(q, (snapshot) => {
      const trades: Trade[] = [];
      snapshot.forEach((doc) => {
        trades.push({ id: doc.id, ...doc.data() } as Trade);
      });
      // Sort by timestamp desc client-side to avoid needing a composite index
      trades.sort((a, b) => b.timestamp - a.timestamp);
      onUpdate(trades);
    }, (error) => {
      console.error("Firestore trades subscription error:", error);
      // Fallback to local on error (e.g. permission or index missing initially)
      onUpdate(getLocalTrades());
    });
  },

  // Save Trade
  async saveTrade(trade: Trade, userId: string | null): Promise<void> {
    if (!userId) {
      // Guest mode
      const trades = getLocalTrades();
      const index = trades.findIndex(t => t.id === trade.id);
      if (index >= 0) {
        trades[index] = trade;
      } else {
        trades.unshift(trade);
      }
      setLocalTrades(trades);
      window.dispatchEvent(new Event('tj_trades_updated'));
      return;
    }

    // Cloud mode
    try {
      const tradeDocRef = doc(db, 'trades', trade.id);
      await setDoc(tradeDocRef, cleanUndefined({ ...trade, userId }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `trades/${trade.id}`);
    }
  },

  // Delete Trade
  async deleteTrade(tradeId: string, userId: string | null): Promise<void> {
    if (!userId) {
      // Guest mode
      const trades = getLocalTrades();
      const updated = trades.filter(t => t.id !== tradeId);
      setLocalTrades(updated);
      window.dispatchEvent(new Event('tj_trades_updated'));
      return;
    }

    // Cloud mode
    try {
      const tradeDocRef = doc(db, 'trades', tradeId);
      await deleteDoc(tradeDocRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trades/${tradeId}`);
    }
  },

  // Realtime subscription for Brokers
  subscribeBrokers(
    userId: string | null,
    onUpdate: (brokers: BrokerConfig[]) => void
  ): () => void {
    if (!userId) {
      // Guest mode: read from localStorage
      const localBrokers = getLocalBrokers();
      onUpdate(localBrokers);
      
      const handleStorageChange = () => {
        onUpdate(getLocalBrokers());
      };
      window.addEventListener('tj_brokers_updated', handleStorageChange);
      return () => {
        window.removeEventListener('tj_brokers_updated', handleStorageChange);
      };
    }

    // Cloud mode: subscribe to Firestore
    const brokersRef = collection(db, 'brokers');
    const q = query(brokersRef, where('userId', '==', userId));

    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // If firestore is empty for this user, seed with default brokers
        DEFAULT_BROKERS.forEach(async (broker) => {
          await setDoc(doc(db, 'brokers', `${userId}-${broker.id}`), cleanUndefined({
            ...broker,
            id: `${userId}-${broker.id}`,
            userId
          }));
        });
        onUpdate(DEFAULT_BROKERS);
        return;
      }
      
      const brokers: BrokerConfig[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        brokers.push({
          id: doc.id,
          name: data.name,
          brokeragePerTrade: data.brokeragePerTrade,
          estimatedSlippagePercent: data.estimatedSlippagePercent,
          customTaxes: data.customTaxes || []
        } as BrokerConfig);
      });
      onUpdate(brokers);
    }, (error) => {
      console.error("Firestore brokers subscription error:", error);
      onUpdate(getLocalBrokers());
    });
  },

  // Save Broker
  async saveBroker(broker: BrokerConfig, userId: string | null): Promise<void> {
    if (!userId) {
      // Guest mode
      const brokers = getLocalBrokers();
      const index = brokers.findIndex(b => b.id === broker.id);
      if (index >= 0) {
        brokers[index] = broker;
      } else {
        brokers.push(broker);
      }
      setLocalBrokers(brokers);
      window.dispatchEvent(new Event('tj_brokers_updated'));
      return;
    }

    // Cloud mode
    try {
      const brokerDocRef = doc(db, 'brokers', broker.id);
      await setDoc(brokerDocRef, cleanUndefined({ ...broker, userId }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `brokers/${broker.id}`);
    }
  },

  // Delete Broker
  async deleteBroker(brokerId: string, userId: string | null): Promise<void> {
    if (!userId) {
      // Guest mode
      const brokers = getLocalBrokers();
      const updated = brokers.filter(b => b.id !== brokerId);
      setLocalBrokers(updated);
      window.dispatchEvent(new Event('tj_brokers_updated'));
      return;
    }

    // Cloud mode
    try {
      const brokerDocRef = doc(db, 'brokers', brokerId);
      await deleteDoc(brokerDocRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `brokers/${brokerId}`);
    }
  },

  // Merge Guest Data to Cloud User profile upon register/login
  async syncGuestDataToCloud(userId: string): Promise<void> {
    const localTrades = getLocalTrades();
    const localBrokers = getLocalBrokers().filter(b => !b.id.startsWith('default-')); // only user custom brokers

    // Upload trades
    for (const trade of localTrades) {
      const cloudTrade = { ...trade, userId, id: `${userId}-${trade.id}` };
      await this.saveTrade(cloudTrade, userId);
    }

    // Upload custom brokers
    for (const broker of localBrokers) {
      const cloudBroker = { ...broker, userId, id: `${userId}-${broker.id}` };
      await this.saveBroker(cloudBroker, userId);
    }

    // Migrate goals if the guest set any locally.
    const localGoals = getLocalGoals();
    if (localGoals && Object.keys(localGoals).length > 0) {
      await this.saveGoals(localGoals, userId);
    }

    // Migrate any custom strategies (skip guest-seed defaults).
    const localStrategies = getLocalStrategies().filter((s) => !s.id.startsWith('guest-seed-'));
    for (const s of localStrategies) {
      await this.saveStrategy({ ...s, userId, id: `${userId}-${s.id}` }, userId);
    }

    // Clear local storage trades to keep it clean
    localStorage.removeItem(guestKey('tj_trades'));
    localStorage.removeItem(guestKey('tj_goals'));
    localStorage.removeItem(guestKey('tj_strategies'));
  },

  // Realtime subscription for User Goals.
  // Cloud mode: reads `users/{uid}` doc, extracts `goals` field.
  // Guest mode: localStorage `tj_goals`, updates via `tj_goals_updated` event.
  subscribeGoals(
    userId: string | null,
    onUpdate: (goals: UserGoals) => void,
  ): () => void {
    if (!userId) {
      onUpdate(getLocalGoals());
      const handler = () => onUpdate(getLocalGoals());
      window.addEventListener('tj_goals_updated', handler);
      return () => window.removeEventListener('tj_goals_updated', handler);
    }

    const userDocRef = doc(db, 'users', userId);
    return onSnapshot(
      userDocRef,
      (snap) => {
        const data = snap.data();
        onUpdate((data?.goals as UserGoals | undefined) ?? EMPTY_GOALS);
      },
      (error) => {
        console.error('Firestore goals subscription error:', error);
        onUpdate(getLocalGoals());
      },
    );
  },

  // Save User Goals (upserts).
  async saveGoals(goals: UserGoals, userId: string | null): Promise<void> {
    if (!userId) {
      setLocalGoals(goals);
      window.dispatchEvent(new Event('tj_goals_updated'));
      return;
    }
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, { goals: cleanUndefined(goals) }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
    }
  },

  // --- Strategies ---------------------------------------------------------

  /**
   * Realtime strategy subscription. Seeds three beginner templates on first
   * read for a new user (both cloud and guest modes) so the picker isn't
   * empty on day 1.
   */
  subscribeStrategies(
    userId: string | null,
    onUpdate: (strategies: Strategy[]) => void,
  ): () => void {
    if (!userId) {
      // Guest mode
      let local = getLocalStrategies();
      if (local.length === 0) {
        local = makeSeededStrategies('guest');
        setLocalStrategies(local);
      }
      onUpdate(local);
      const handler = () => onUpdate(getLocalStrategies());
      window.addEventListener('tj_strategies_updated', handler);
      return () => window.removeEventListener('tj_strategies_updated', handler);
    }

    // Cloud mode
    const strategiesRef = collection(db, 'strategies');
    const q = query(strategiesRef, where('userId', '==', userId));
    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          // Seed 3 beginner strategies on first read.
          const seeded = makeSeededStrategies(userId);
          seeded.forEach(async (s) => {
            try {
              await setDoc(doc(db, 'strategies', s.id), cleanUndefined(s));
            } catch (err) {
              console.error('Failed to seed strategy', s.name, err);
            }
          });
          onUpdate(seeded);
          return;
        }
        const items: Strategy[] = [];
        snapshot.forEach((d) => items.push({ id: d.id, ...(d.data() as Omit<Strategy, 'id'>) }));
        items.sort((a, b) => a.name.localeCompare(b.name));
        onUpdate(items);
      },
      (error) => {
        console.error('Firestore strategies subscription error:', error);
        onUpdate(getLocalStrategies());
      },
    );
  },

  async saveStrategy(strategy: Strategy, userId: string | null): Promise<void> {
    const next: Strategy = { ...strategy, updatedAt: Date.now() };
    if (!userId) {
      const items = getLocalStrategies();
      const idx = items.findIndex((s) => s.id === next.id);
      if (idx >= 0) items[idx] = next;
      else items.unshift(next);
      setLocalStrategies(items);
      window.dispatchEvent(new Event('tj_strategies_updated'));
      return;
    }
    try {
      await setDoc(doc(db, 'strategies', next.id), cleanUndefined({ ...next, userId }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `strategies/${next.id}`);
    }
  },

  async deleteStrategy(strategyId: string, userId: string | null): Promise<void> {
    if (!userId) {
      const items = getLocalStrategies().filter((s) => s.id !== strategyId);
      setLocalStrategies(items);
      window.dispatchEvent(new Event('tj_strategies_updated'));
      return;
    }
    try {
      await deleteDoc(doc(db, 'strategies', strategyId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `strategies/${strategyId}`);
    }
  },
};

// --- Goals helpers (guest mode) ----------------------------------------------

function getLocalGoals(): UserGoals {
  try {
    const raw = localStorage.getItem(guestKey('tj_goals'));
    return raw ? (JSON.parse(raw) as UserGoals) : EMPTY_GOALS;
  } catch {
    return EMPTY_GOALS;
  }
}

function setLocalGoals(goals: UserGoals) {
  localStorage.setItem(guestKey('tj_goals'), JSON.stringify(goals));
}
