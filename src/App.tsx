import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { dbService } from './lib/dbService';
import { Trade, BrokerConfig, UserGoals, EMPTY_GOALS } from './types';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import TradeForm from './components/TradeForm';
import TradeList from './components/TradeList';
import BrokerSettings from './components/BrokerSettings';
import Settings from './components/Settings';
import { Button, IconButton, TabPill, TabPillGroup } from './components/ui';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  BarChart3, 
  BookOpen, 
  Briefcase, 
  Plus, 
  LogOut, 
  CloudLightning, 
  Globe, 
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export default function App() {
  const [authStateLoaded, setAuthStateLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null | undefined>(undefined); // undefined = loading, null = guest, string = logged in user
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Core collections state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [brokers, setBrokers] = useState<BrokerConfig[]>([]);
  const [goals, setGoals] = useState<UserGoals>(EMPTY_GOALS);

  // Navigation & Form control
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'TRADES_LOG' | 'BROKER_SETTINGS'>('DASHBOARD');
  const [isLoggingTrade, setIsLoggingTrade] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Timeframe and type filters passed down
  const [timeframe, setTimeframe] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'ALL'>('ALL');
  const [tradeTypeFilter, setTradeTypeFilter] = useState<'ALL' | 'LIVE' | 'DEMO'>('ALL');

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setUserEmail(user.email);
      } else {
        // If they were logged in, they are logged out. If they already had guest selected, let's keep guest.
        // Otherwise, they will go back to login screen.
        setUserId(undefined);
        setUserEmail(null);
      }
      setAuthStateLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  // Listen to Database Realtime Sync
  useEffect(() => {
    if (userId === undefined) return; // wait for auth state loaded

    // Subscription for Trades
    const unsubscribeTrades = dbService.subscribeTrades(userId, (updatedTrades) => {
      setTrades(updatedTrades);
    });

    // Subscription for Brokers
    const unsubscribeBrokers = dbService.subscribeBrokers(userId, (updatedBrokers) => {
      setBrokers(updatedBrokers);
    });

    // Subscription for User Goals
    const unsubscribeGoals = dbService.subscribeGoals(userId, (updatedGoals) => {
      setGoals(updatedGoals);
    });

    return () => {
      unsubscribeTrades();
      unsubscribeBrokers();
      unsubscribeGoals();
    };
  }, [userId]);

  // Logout / Switch Mode
  const handleSignOut = async () => {
    await signOut(auth);
    setUserId(undefined);
    setUserEmail(null);
  };

  const handleAuthSuccess = (uid: string | null) => {
    setUserId(uid);
    if (uid === null) {
      setUserEmail("Offline Sandbox Guest");
    }
  };

  const triggerEditTrade = (trade: Trade) => {
    setTradeToEdit(trade);
    setIsLoggingTrade(true);
  };

  if (!authStateLoaded && userId === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="bg-emerald-500 p-3 rounded-2xl animate-bounce shadow-lg shadow-emerald-500/20">
            <TrendingUp className="w-8 h-8 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-lg font-bold text-white">Loading Trade Ledger</h1>
            <p className="text-xs text-slate-500">Checking device session & sync status...</p>
          </div>
          <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin mt-2" />
        </div>
      </div>
    );
  }

  // If user state is undefined, show login view
  if (userId === undefined) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  const isGuest = userId === null;

  return (
    <div id="main-app-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-indigo-500 selection:text-slate-950">
      
      {/* Background radial effects */}
      <div className="absolute top-0 left-1/4 w-[50%] h-[35%] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-12 right-1/4 w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main App Bar / Header Styled as Bento Card */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <header className="bg-slate-900/50 border border-slate-800 rounded-2xl px-5 sm:px-6 py-3.5 backdrop-blur-md z-40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Logo */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-500 p-2 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <TrendingUp className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
                <div>
                  <h1 className="font-display text-base font-extrabold tracking-tight text-white leading-tight">Trading Journal</h1>
                  <span className="text-[10px] font-mono text-slate-500 block">Performance & Psychology Ledger</span>
                </div>
              </div>

              {/* Mobile quick action trigger */}
              <IconButton
                aria-label="Log a new trade"
                onClick={() => { setTradeToEdit(null); setIsLoggingTrade(true); }}
                className="sm:hidden bg-indigo-600 hover:bg-indigo-500 hover:text-white text-white border-transparent shadow-md"
              >
                <Plus className="w-4 h-4" />
              </IconButton>
            </div>

            {/* Navigation tabs & Action controls */}
            <div className="flex flex-wrap items-center gap-4 justify-between sm:justify-end">

              {/* Desktop Tabs */}
              <TabPillGroup aria-label="Main navigation">
                <TabPill
                  active={activeTab === 'DASHBOARD' && !isLoggingTrade}
                  onClick={() => { setActiveTab('DASHBOARD'); setIsLoggingTrade(false); }}
                  leadingIcon={<BarChart3 className="w-3.5 h-3.5" />}
                >
                  Dashboard
                </TabPill>
                <TabPill
                  active={activeTab === 'TRADES_LOG' && !isLoggingTrade}
                  onClick={() => { setActiveTab('TRADES_LOG'); setIsLoggingTrade(false); }}
                  leadingIcon={<BookOpen className="w-3.5 h-3.5" />}
                >
                  Journal Log
                </TabPill>
                <TabPill
                  active={activeTab === 'BROKER_SETTINGS' && !isLoggingTrade}
                  onClick={() => { setActiveTab('BROKER_SETTINGS'); setIsLoggingTrade(false); }}
                  leadingIcon={<Briefcase className="w-3.5 h-3.5" />}
                >
                  Brokers & Fees
                </TabPill>
              </TabPillGroup>

              {/* Quick entry action trigger */}
              <Button
                onClick={() => { setTradeToEdit(null); setIsLoggingTrade(true); }}
                leadingIcon={<Plus className="w-4 h-4" />}
                className="hidden sm:inline-flex"
              >
                Log Trade
              </Button>

              {/* User Profile / Logout details */}
              <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
                <div className="hidden md:block text-right">
                  <span className="block text-xs font-semibold text-slate-200 truncate max-w-[140px]" title={userEmail || ''}>
                    {userEmail}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-end gap-1 font-mono">
                    {isGuest ? (
                      <>
                        <Globe className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                        Guest Caching
                      </>
                    ) : (
                      <>
                        <CloudLightning className="w-2.5 h-2.5 text-indigo-400 animate-pulse" />
                        Live Syncing
                      </>
                    )}
                  </span>
                </div>
                <IconButton
                  aria-label="Open settings"
                  onClick={() => setIsSettingsOpen(true)}
                  title="Settings"
                >
                  <SettingsIcon className="w-4 h-4" />
                </IconButton>
                <IconButton
                  aria-label={isGuest ? 'Exit guest mode' : 'Sign out account'}
                  variant="danger"
                  onClick={handleSignOut}
                  title={isGuest ? 'Exit guest mode' : 'Sign Out Account'}
                >
                  <LogOut className="w-4 h-4" />
                </IconButton>
              </div>

            </div>

          </div>
        </header>
      </div>

      {/* Guest warning banner */}
      {isGuest && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 z-30">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                You are playing on **Offline Sandbox Mode**. All trades are cached locally. Sign up to save logs permanently in the cloud!
              </span>
            </div>
            <Button variant="warning" size="sm" onClick={handleSignOut}>
              Sync to Cloud Profile
            </Button>
          </div>
        </div>
      )}

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 z-10">
        <AnimatePresence mode="wait">
          
          {/* Slide-in Form View */}
          {isLoggingTrade ? (
            <motion.div
              key="trade-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <TradeForm
                userId={userId}
                brokers={brokers}
                tradeToEdit={tradeToEdit}
                onSuccess={() => {
                  setIsLoggingTrade(false);
                  setTradeToEdit(null);
                  setActiveTab('TRADES_LOG');
                }}
                onCancel={() => {
                  setIsLoggingTrade(false);
                  setTradeToEdit(null);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="tabs-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              
              {/* Dashboard Tab */}
              {activeTab === 'DASHBOARD' && (
                <Dashboard
                  trades={trades}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  tradeTypeFilter={tradeTypeFilter}
                  onTradeTypeFilterChange={setTradeTypeFilter}
                  goals={goals}
                  onEditGoals={() => setIsSettingsOpen(true)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              )}

              {/* Trades Log / Table Tab */}
              {activeTab === 'TRADES_LOG' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-400" />
                      Trading Log & Ledger
                    </h2>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Check execution histories, upload charts, and view psychological growth summaries. Click a trade row to expand findings.
                    </p>
                  </div>
                  <TradeList
                    userId={userId}
                    trades={trades}
                    brokers={brokers}
                    onEditTrade={triggerEditTrade}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                </div>
              )}

              {/* Brokers Configurations Tab */}
              {activeTab === 'BROKER_SETTINGS' && (
                <BrokerSettings
                  userId={userId}
                  brokers={brokers}
                />
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Core Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/40 px-6 py-6 text-center text-xs text-slate-500 z-10 space-y-2">
        <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Tax Compliance Ready
          </span>
          <span className="text-slate-800">•</span>
          <span className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            Offline Mode Active
          </span>
          <span className="text-slate-800">•</span>
          <span>Version 1.0.4 (Prod)</span>
        </div>
        <p>© 2026 Trading Journal Platform. Built with secure real-time Firestore database synchronization.</p>
      </footer>

      {/* Settings modal (mounted globally so it works from any tab) */}
      <Settings
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userId={userId}
        goals={goals}
      />

    </div>
  );
}

