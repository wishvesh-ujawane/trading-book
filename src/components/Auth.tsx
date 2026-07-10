import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { dbService } from '../lib/dbService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Globe, 
  CloudLightning,
  AlertCircle
} from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (userId: string | null) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (isReset) {
        await sendPasswordResetEmail(auth, email);
        setInfoMessage("Password reset email sent! Check your inbox.");
        setIsReset(false);
      } else if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        // Sync any guest data accumulated so far to cloud
        await dbService.syncGuestDataToCloud(uid);
        onAuthSuccess(uid);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(userCredential.user.uid);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = "An unexpected error occurred.";
      if (err.code === "auth/operation-not-allowed") {
        errMsg = "Email/Password sign-in is not enabled in the Firebase Console. Please use Google Sign-In or enable 'Email/Password' under Sign-in providers in your Firebase project Auth settings.";
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        errMsg = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "This email address is already in use.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Password should be at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Please enter a valid email address.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      const uid = userCredential.user.uid;
      // Sync any guest data accumulated so far to cloud
      await dbService.syncGuestDataToCloud(uid);
      onAuthSuccess(uid);
    } catch (err: any) {
      console.error(err);
      let errMsg = "An unexpected error occurred during Google Sign-In.";
      if (err.code === "auth/operation-not-allowed") {
        errMsg = "Google Sign-In is not enabled. Please enable Google Sign-In provider in the Firebase Console.";
      } else if (err.code === "auth/popup-closed-by-user") {
        errMsg = "Sign-in popup was closed before completing.";
      } else if (err.code === "auth/cancelled-popup-request") {
        errMsg = "Only one sign-in popup can be opened at a time.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    onAuthSuccess(null);
  };

  return (
    <div id="auth-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Visual background lights */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <header className="px-6 py-5 max-w-7xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 p-2 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <TrendingUp className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-white">Trading Journal</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/50 border border-slate-800 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
          <span>Cloud Sync Active</span>
        </div>
      </header>

      {/* Body content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-5xl grid md:grid-cols-12 gap-8 items-center">
          
          {/* Hero text side */}
          <div className="md:col-span-6 space-y-6 text-center md:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Beginner Friendly Trading Log
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.15]"
            >
              Analyze Your Trades, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Master Your Psychology.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-slate-400 text-base max-w-lg leading-relaxed mx-auto md:mx-0"
            >
              Log your trades on-the-go. Categorize demo vs live activities, calculate exact brokerage fees and slippage, and review structured findings to track your emotional control.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="grid grid-cols-2 gap-4 max-w-md mx-auto md:mx-0"
            >
              <div className="bg-slate-900/40 border border-slate-800/60 p-4 rounded-xl flex items-start gap-3 text-left">
                <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                  <CloudLightning className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cloud Sync</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Secure, real-time sync across devices.</p>
                </div>
              </div>
              
              <div className="bg-slate-900/40 border border-slate-800/60 p-4 rounded-xl flex items-start gap-3 text-left">
                <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Offline Sync</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Log offline, sync when connected.</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Form side */}
          <div className="md:col-span-6 w-full max-w-md mx-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl relative"
            >
              <div className="mb-6">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  {isReset ? "Reset Password" : isSignUp ? "Create Account" : "Welcome Back"}
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  {isReset 
                    ? "Enter your email to receive a password reset link." 
                    : isSignUp 
                      ? "Start logging trades with full cloud synchronization." 
                      : "Access your dashboard and historical logs."}
                </p>
              </div>

              {error && (
                <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-lg flex items-start gap-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {infoMessage && (
                <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-lg flex items-start gap-2.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{infoMessage}</span>
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" 
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                {!isReset && (
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Password</label>
                      {!isSignUp && (
                        <button 
                          type="button" 
                          onClick={() => { setIsReset(true); setError(null); }}
                          className="text-xs text-emerald-400 hover:text-emerald-300 focus:outline-none"
                        >
                          Forgot?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Processing..." : isReset ? "Send Reset Email" : isSignUp ? "Sign Up" : "Sign In"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-slate-800 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">
                    {isReset 
                      ? "Remember password?" 
                      : isSignUp 
                        ? "Already have an account?" 
                        : "New to the platform?"}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (isReset) {
                        setIsReset(false);
                      } else {
                        setIsSignUp(!isSignUp);
                      }
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold focus:outline-none"
                  >
                    {isReset 
                      ? "Back to Login" 
                      : isSignUp 
                        ? "Sign In instead" 
                        : "Create an Account"}
                  </button>
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-800/60"></div>
                  <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">or continue with</span>
                  <div className="flex-grow border-t border-slate-800/60"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full bg-white hover:bg-slate-100 text-slate-950 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-slate-200 shadow-md disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.64 0 3.12.56 4.28 1.67l3.2-3.2C17.52 1.58 14.94 1 12 1 7.24 1 3.21 3.73 1.25 7.7l3.78 2.93c.9-2.69 3.42-4.59 6.97-4.59z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.48-1.11 2.74-2.37 3.58l3.68 2.85c2.15-1.98 3.39-4.89 3.39-8.53z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.03 10.63c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.25 7.7C.45 9.3.01 11.1.01 13s.44 3.7 1.24 5.3l3.78-2.93c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.68-2.85c-1.11.74-2.53 1.18-4.28 1.18-3.55 0-6.07-1.9-6.97-4.59L1.25 16.76C3.21 20.73 7.24 23 12 23z"
                    />
                  </svg>
                  Sign in with Google (Instant Sync)
                </button>

                <button
                  type="button"
                  onClick={handleGuestMode}
                  className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Offline Sandbox Mode (No Account)
                </button>
              </div>
            </motion.div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 bg-slate-950/40 px-6 text-center text-xs text-slate-500 z-10">
        <p>© 2026 Trading Journal App. Fully encrypted local caching. Designed for on-the-go quick logging.</p>
      </footer>
    </div>
  );
}
