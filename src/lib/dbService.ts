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
import { Trade, BrokerConfig } from '../types';

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

// Default presets for brokers to give beginners an instant setup
export const DEFAULT_BROKERS: BrokerConfig[] = [
  {
    id: 'default-zerodha',
    name: 'Zerodha (Kite)',
    brokeragePerTrade: 20.00,
    estimatedSlippagePercent: 0.02,
    customTaxes: [
      { key: 'GST & Exchange Charges', value: 4.50 },
      { key: 'STT & Stamp Duty', value: 9.50 }
    ]
  },
  {
    id: 'default-groww',
    name: 'Groww',
    brokeragePerTrade: 20.00,
    estimatedSlippagePercent: 0.03,
    customTaxes: [
      { key: 'GST & Exchange Charges', value: 4.50 },
      { key: 'STT & Stamp Duty', value: 9.50 }
    ]
  },
  {
    id: 'default-angelone',
    name: 'Angel One',
    brokeragePerTrade: 20.00,
    estimatedSlippagePercent: 0.02,
    customTaxes: [
      { key: 'GST & Exchange Charges', value: 4.50 },
      { key: 'STT & Stamp Duty', value: 9.50 }
    ]
  },
  {
    id: 'default-upstox',
    name: 'Upstox',
    brokeragePerTrade: 20.00,
    estimatedSlippagePercent: 0.02,
    customTaxes: [
      { key: 'GST & Exchange Charges', value: 4.50 },
      { key: 'STT & Stamp Duty', value: 9.50 }
    ]
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

// Helper to save trades to LocalStorage for Guest mode
const getLocalTrades = (): Trade[] => {
  const data = localStorage.getItem('tj_trades');
  return data ? JSON.parse(data) : [];
};

const setLocalTrades = (trades: Trade[]) => {
  localStorage.setItem('tj_trades', JSON.stringify(trades));
};

const getLocalBrokers = (): BrokerConfig[] => {
  const data = localStorage.getItem('tj_brokers');
  return data ? JSON.parse(data) : DEFAULT_BROKERS;
};

const setLocalBrokers = (brokers: BrokerConfig[]) => {
  localStorage.setItem('tj_brokers', JSON.stringify(brokers));
};

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

    // Clear local storage trades to keep it clean
    localStorage.removeItem('tj_trades');
  }
};
