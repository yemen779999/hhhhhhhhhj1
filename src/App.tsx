/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Database } from './utils';
const DashboardTab = React.lazy(() => import('./components/DashboardTab'));
const AccountsTab = React.lazy(() => import('./components/AccountsTab'));
const LedgerTab = React.lazy(() => import('./components/LedgerTab'));
const GatewayTab = React.lazy(() => import('./components/GatewayTab'));
const ReportsTab = React.lazy(() => import('./components/ReportsTab'));
const SyncImportTab = React.lazy(() => import('./components/SyncImportTab'));
const AIControlDashboard = React.lazy(() => import('./components/AIControlDashboard'));
const InvoiceTab = React.lazy(() => import('./components/InvoiceTab'));
const RecycleBinTab = React.lazy(() => import('./components/RecycleBinTab'));
const ActivityLogTab = React.lazy(() => import('./components/ActivityLogTab'));
const SubscriptionTab = React.lazy(() => import('./components/SubscriptionTab'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const BackupCenterTab = React.lazy(() => import('./components/BackupCenterTab').then(m => ({ default: m.BackupCenterTab })));
import AIAssistantWidget from './components/AIAssistantWidget';
import VoiceAIAssistant from './components/VoiceAIAssistant';
import AgentAndVerification from './components/AgentAndVerification';
import { UserRole } from './types';
import { initAuth, auth, googleSignIn, logout, firestore } from './auth';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import FloatingCalculator from './components/FloatingCalculator';
import QuickEntryModal from './components/QuickEntryModal';
import GlobalSearchModal from './components/GlobalSearchModal';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import { 
  Building2, 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Radio, 
  Menu, 
  X, 
  Printer, 
  Layers,
  ArrowLeftRight,
  BarChart3,
  ShieldCheck,
  Lock,
  Briefcase,
  Coins,
  Activity,
  Palette,
  Sun,
  Moon,
  Wallet,
  Landmark,
  Receipt,
  Scale,
  Calculator,
  Award,
  Shield,
  Fingerprint,
  Compass,
  Gem,
  Cpu,
  RefreshCw,
  Download,
  Monitor,
  ArrowUp,
  ArrowDown,
  Zap,
  Plus,
  Trash2,
  LogIn,
  LogOut,
  Cloud,
  Settings,
  Search,
  User as UserIcon
} from 'lucide-react';

const ViewSkeleton = () => (
  <div className="w-full space-y-6 animate-pulse p-4">
    <div className="h-8 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
    </div>
    <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
  </div>
);

export default function App() {
  // Initialize standard database state
  const [db] = useState(() => new Database());
  const [dbVersion, setDbVersion] = useState(0);

  // App Lock (PIN) State
  const [isAppLocked, setIsAppLocked] = useState(() => {
    return !!localStorage.getItem('smartacc_app_pin');
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const savedPin = localStorage.getItem('smartacc_app_pin');
    if (savedPin === pinInput) {
      setIsAppLocked(false);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
    }
  };

  // Auth User
  const [authUser, setAuthUser] = useState<any>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const isImportingRef = useRef(false);
  
  // Sync Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // User role state
  const [userRole, setUserRole] = useState<UserRole>('Admin');

  // User profile state loaded from Firestore
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  // Global Announcement state
  const [announcement, setAnnouncement] = useState<{ text: string; type: 'info' | 'warning' | 'error'; active: boolean } | null>(null);

  // Local Developer Mode bypass state
  const [isDevMode, setIsDevMode] = useState(() => {
    return localStorage.getItem('smartacc_dev_mode') === 'true';
  });

  // Active view tab state (default: dashboard)
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Drill-down relational context: tracks the selected account card across tabs 
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);

  // Mobile menu control toggles
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Online status state
  const [isOnline, setIsOnline] = useState(navigator.onLine);


  // Quick Entry modal state
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntryDefaultType, setQuickEntryDefaultType] = useState<'debit' | 'credit' | undefined>(undefined);

  const handleOpenQuickEntryWithType = (type: 'debit' | 'credit') => {
    setQuickEntryDefaultType(type);
    setIsQuickEntryOpen(true);
  };

  // Global Search Modal State
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Dark/Light Mode state (الليل والنهار)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('smartacc_dark_mode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('smartacc_dark_mode', darkMode.toString());
  }, [darkMode]);

  // Simple state trigger on operations
  const handleDatabaseUpdate = () => {
    setDbVersion(v => v + 1);
    setIsDevMode(localStorage.getItem('smartacc_dev_mode') === 'true');
  };

  // State and listener for 'Back to Top' button (العودة للأعلى)
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Global Keyboard Shortcuts (اختصارات لوحة المفاتيح)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S: Click submit button of active forms
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const submitButton = document.querySelector('form button[type="submit"], button[id*="save"], button[id*="submit"], button[className*="bg-blue-650"][type="submit"], button[className*="bg-blue-600"][type="submit"]');
        if (submitButton) {
          (submitButton as HTMLButtonElement).click();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  // PWA (Progressive Web App) offline installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBadge, setShowInstallBadge] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBadge(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      setDeferredPrompt(null);
      setShowInstallBadge(false);
    });

    // Check if running in standalone window
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBadge(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA] Install choice outcome: ${outcome}`);
      } catch (e) {
        console.error('[PWA] Installation error:', e);
      }
      setDeferredPrompt(null);
      setShowInstallBadge(false);
    } else {
      // Show manual instructions help if native installation is not supported/ready
      setShowInstallHelp(true);
    }
  };

  // Listen to global announcements / warnings
  useEffect(() => {
    const announcementDocRef = doc(firestore, 'settings', 'announcement');
    const unsubscribe = onSnapshot(announcementDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.active && data.text) {
          setAnnouncement({
            text: data.text,
            type: data.type || 'warning',
            active: true
          });
        } else {
          setAnnouncement(null);
        }
      } else {
        setAnnouncement(null);
      }
    }, (err) => {
      console.error('[Announcement Listener] Error:', err);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const updateCurrentUser = () => {
      const fbUser = auth.currentUser;
      setAuthUser(fbUser);
      const roleText = userRole === 'Admin' ? 'المدير' : userRole === 'Accountant' ? 'المحاسب' : 'موظف مبيعات';
      if (fbUser) {
        db.currentUser = `${fbUser.displayName || fbUser.email} (${roleText})`;
      } else {
        db.currentUser = `${roleText}`;
      }
    };

    updateCurrentUser();

    const unsubscribe = auth.onAuthStateChanged(() => {
      updateCurrentUser();
    });

    return () => unsubscribe();
  }, [userRole, db]);

  // Real-time user profile sync & subscription
  useEffect(() => {
    if (!authUser) {
      setCurrentUserProfile(null);
      return;
    }

    const userDocRef = doc(firestore, 'users', authUser.uid);
    
    // 1. Sync local profile info with Firestore user document
    getDoc(userDocRef).then((snap) => {
      const userProfileData = {
        uid: authUser.uid,
        email: authUser.email || '',
        displayName: authUser.displayName || authUser.email?.split('@')[0] || 'مستخدم مجهول',
        photoURL: authUser.photoURL || '',
        lastSeen: new Date().toISOString()
      };

      if (!snap.exists()) {
        // Create new profile, set defaults
        return setDoc(userDocRef, {
          ...userProfileData,
          isPro: false,
          role: userRole
        });
      } else {
        // Update last seen and photo/name but preserve isPro & role!
        return setDoc(userDocRef, userProfileData, { merge: true });
      }
    }).catch(err => {
      console.error('[User Profile Registration] Error:', err);
    });

    // 2. Real-time subscription to loaded user profile
    const unsubscribeProfile = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCurrentUserProfile(data);
        if (data.role && data.role !== userRole) {
          setUserRole(data.role as UserRole);
        }
      }
    }, (err) => {
      console.error('[User Profile Subscription] Error:', err);
    });

    return () => {
      unsubscribeProfile();
    };
  }, [authUser, userRole]);

  // Global Real-time Firestore Sync Loop
  useEffect(() => {
    if (!authUser) {
      setCloudSyncStatus('idle');
      return;
    }

    // Auto Backup Check
    const performAutoBackup = async () => {
      const autoEnabled = localStorage.getItem('smartacc_auto_backup') !== 'false';
      if (!autoEnabled) return;
      
      const intervalHours = parseInt(localStorage.getItem('smartacc_backup_interval') || '48', 10);
      const lastBackupTsStr = localStorage.getItem('smartacc_last_auto_backup_ts');
      
      const now = Date.now();
      const needsBackup = !lastBackupTsStr || (now - parseInt(lastBackupTsStr, 10)) > (intervalHours * 60 * 60 * 1000);
      
      if (needsBackup && navigator.onLine) {
        try {
          console.log('[Auto Backup] Starting scheduled cloud backup...');
          // Use dynamic import so we don't break App.tsx loading
          const { BackupService } = await import('./backupService');
          const backupService = new BackupService(authUser.uid);
          
          await backupService.uploadBackup(db.exportState(), 'Full');
          localStorage.setItem('smartacc_last_auto_backup_ts', now.toString());
          console.log('[Auto Backup] Backup completed successfully.');
          
          // Cleanup old backups if limit is reached
          const keepLimit = parseInt(localStorage.getItem('smartacc_backup_keep_limit') || '10', 10);
          if (keepLimit < 999) {
            const list = await backupService.listBackups();
            if (list.length > keepLimit) {
              const toDelete = list.slice(keepLimit);
              for (const b of toDelete) {
                await backupService.deleteBackup(b.driveId);
              }
            }
          }
        } catch (err) {
          console.error('[Auto Backup] Failed:', err);
        }
      }
    };
    
    // Call it after a short delay so it doesn't block initial render
    setTimeout(() => performAutoBackup().catch(err => console.error('[Auto Backup] Top-level error:', err)), 5000);

    const handleOnline = () => {
      console.log('[Auto Backup] Back online, checking pending backups...');
      performAutoBackup().catch(err => console.error('[Auto Backup] Online handler error:', err));
      initializeCloudDb().catch(err => console.error('[Firestore Sync] Online handler error:', err));
    };
    window.addEventListener('online', handleOnline);

    setCloudSyncStatus(navigator.onLine ? 'syncing' : 'success');
    const docRef = doc(firestore, "user_databases", authUser.uid);

    // Initial check: if Firestore has no doc, upload local DB
    const initializeCloudDb = async () => {
      if (!navigator.onLine) {
        console.warn("[Firestore Sync] Client is offline, skipping initial cloud DB sync.");
        setCloudSyncStatus('success');
        return;
      }
      try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          console.log("[Firestore Sync] No cloud document found, provisioning initial copy...");
          const ts = new Date().toISOString();
          await setDoc(docRef, {
            dbState: db.exportState(),
            lastUpdated: ts,
            updatedBy: "Web Client"
          });
          localStorage.setItem("smartacc_last_cloud_sync_ts", ts);
          // Set sync setting to enabled for this user so it matches SyncImportTab expectations
          localStorage.setItem(`smartacc_sync_enabled_${authUser.uid}`, "true");
          setCloudSyncStatus('success');
        }
      } catch (e: any) {
        const errMsg = String(e?.message || e || "").toLowerCase();
        if (errMsg.includes('offline') || errMsg.includes('network') || errMsg.includes('failed to get document') || errMsg.includes('unavailable') || !navigator.onLine) {
          console.warn("[Firestore Sync] Offline during initialization, falling back gracefully:", e);
          setCloudSyncStatus('success');
        } else {
          console.error("[Firestore Sync] Initialization error:", e);
          setCloudSyncStatus('error');
        }
      }
    };
    initializeCloudDb().catch(err => console.error('[Firestore Sync] Top-level initialization error:', err));

    // Listen to real-time changes
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const remoteData = snapshot.data();
        const remoteLastUpdated = remoteData.lastUpdated || "";
        const localLastUpdated = localStorage.getItem("smartacc_last_cloud_sync_ts") || "";

        // Read excludeWindowsSync directly from local storage
        const isExcluded = localStorage.getItem("smartacc_exclude_windows_sync") === "true";
        if (isExcluded) {
          console.log("[Firestore Sync] Excluded device, skipping update.");
          setCloudSyncStatus('success');
          return;
        }

        if (remoteLastUpdated !== localLastUpdated) {
          console.log("[Firestore Sync] Remote data changed, merging with local database...");
          isImportingRef.current = true;
          db.importState(remoteData.dbState);
          localStorage.setItem("smartacc_last_cloud_sync_ts", remoteLastUpdated);
          handleDatabaseUpdate();
          setCloudSyncStatus('success');
        } else {
          setCloudSyncStatus('success');
        }
      }
    }, (err) => {
      const errMsg = String(err?.message || err || "").toLowerCase();
      if (errMsg.includes('offline') || errMsg.includes('network') || errMsg.includes('failed to get document') || errMsg.includes('unavailable') || !navigator.onLine) {
        console.warn("[Firestore Sync] Offline status in subscription, ignoring error:", err);
        setCloudSyncStatus('success');
      } else {
        console.error("[Firestore Sync] Subscription error:", err);
        setCloudSyncStatus('error');
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, [authUser, db]);

  // Push local changes to cloud on database update
  useEffect(() => {
    if (!authUser || dbVersion === 0) return;

    if (isImportingRef.current) {
      isImportingRef.current = false;
      return;
    }

    const pushData = async () => {
      setCloudSyncStatus('syncing');
      try {
        const docRef = doc(firestore, "user_databases", authUser.uid);
        const ts = new Date().toISOString();
        
        await setDoc(docRef, {
          dbState: db.exportState(),
          lastUpdated: ts,
          updatedBy: "Web Client"
        });
        
        localStorage.setItem("smartacc_last_cloud_sync_ts", ts);
        setCloudSyncStatus('success');
        console.log("[Firestore Sync] Local database update pushed successfully.");
      } catch (e: any) {
        const errMsg = String(e?.message || e || "").toLowerCase();
        if (errMsg.includes('offline') || errMsg.includes('network') || errMsg.includes('failed to get document') || errMsg.includes('unavailable') || !navigator.onLine) {
          console.warn("[Firestore Sync] Offline during push, queued locally or skipped until online:", e);
          setCloudSyncStatus('success');
        } else {
          console.error("[Firestore Sync] Push error:", e);
          setCloudSyncStatus('error');
        }
      }
    };

    // Debounce pushing to prevent rate limiting
    const timer = setTimeout(() => pushData().catch(e => console.error('[Firestore Sync] Debounced push error:', e)), 800);
    return () => clearTimeout(timer);
  }, [dbVersion, authUser, db]);

  // Dynamic Theme Customizers (Masterful visual execution)
  const accentBg = useMemo(() => {
    return 'bg-accent';
  }, []);

  const accentBorder = useMemo(() => {
    return 'border-accent';
  }, []);

  const accentHoverText = useMemo(() => {
    return 'hover:text-accent';
  }, []);

  const accentText = useMemo(() => {
    return 'text-accent';
  }, []);

  const isAdminUser = useMemo(() => {
    return userRole === 'Admin' || authUser?.email === 'guy48942@gmail.com';
  }, [userRole, authUser]);

  const isProUser = useMemo(() => {
    return currentUserProfile?.isPro === true || authUser?.email === 'guy48942@gmail.com';
  }, [currentUserProfile, authUser]);

  const BrandIconComponent = useMemo(() => {
    const iconName = db.appBrandIcon || 'Building2';
    if (iconName === 'Briefcase') return Briefcase;
    if (iconName === 'Coins') return Coins;
    if (iconName === 'Activity') return Activity;
    if (iconName === 'Wallet') return Wallet;
    if (iconName === 'Landmark') return Landmark;
    if (iconName === 'Receipt') return Receipt;
    if (iconName === 'Scale') return Scale;
    if (iconName === 'Calculator') return Calculator;
    if (iconName === 'Award') return Award;
    if (iconName === 'Shield') return Shield;
    if (iconName === 'Fingerprint') return Fingerprint;
    if (iconName === 'Compass') return Compass;
    if (iconName === 'Gem') return Gem;
    if (iconName === 'Layers') return Layers;
    if (iconName === 'ArrowLeftRight') return ArrowLeftRight;
    return Building2;
  }, [dbVersion, db.appBrandIcon]);

  // Switch tab natively & close mobile rails
  const handleNavigateToTab = (tab: string, id?: string) => {
    setActiveTab(tab);
    if (id) {
      setSelectedAccountId(id); // Using the same prop for drill down
    }
    setMobileMenuOpen(false);
  };

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
  };

  const handlePinPadClick = (num: string) => {
    setPinInput(prev => prev + num);
  };

  const handlePinPadDelete = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  if (isAppLocked) {
    return (
      <div className="min-h-screen h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 selection:bg-transparent" dir="rtl">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl max-w-sm w-full text-center shadow-xl">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">النظام مقفل</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">يرجى إدخال رمز المرور للوصول إلى بياناتك</p>
          
          <form onSubmit={handleUnlock} className="space-y-8">
            <div className="space-y-2">
              <div className={`flex justify-center gap-3 mb-8 ${pinError ? 'animate-bounce' : ''}`}>
                {Array.from({ length: Math.max(4, pinInput.length) }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${i < pinInput.length ? 'bg-indigo-600 dark:bg-indigo-400 scale-110' : 'bg-slate-200 dark:bg-slate-700'}`}
                  />
                ))}
              </div>
              {pinError && <p className="text-red-500 text-xs font-bold text-center">الرمز غير صحيح، يرجى المحاولة مجدداً</p>}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4" dir="ltr">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinPadClick(num.toString())}
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-bold text-slate-700 dark:text-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:active:bg-slate-700 transition-colors"
                >
                  {num}
                </button>
              ))}
              <div className="w-16 h-16 mx-auto"></div>
              <button
                type="button"
                onClick={() => handlePinPadClick('0')}
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-bold text-slate-700 dark:text-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:active:bg-slate-700 transition-colors"
              >
                0
              </button>
              <button
                type="button"
                onClick={handlePinPadDelete}
                disabled={pinInput.length === 0}
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-xl font-bold text-slate-600 dark:text-slate-400 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:active:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={24} />
              </button>
            </div>
            
            <button
              type="submit"
              disabled={pinInput.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold p-4 rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock size={20} />
              <span>فتح النظام</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <Login onLogin={() => {}} />;
  }

  return (
    <div 
      className={`min-h-screen h-screen text-slate-800 dark:text-slate-100 flex font-sans selection:bg-indigo-500/10 transition-colors duration-200 overflow-hidden relative ${
        announcement && announcement.active ? 'pt-[44px]' : ''
      }`} 
      dir="rtl"
    >
      {/* Animated Background Mesh & Orbs */}
      <div className="bg-gradient-mesh no-print">
        <div className="orb"></div>
      </div>
      
      {/* GLOBAL SYSTEM-WIDE ANNOUNCEMENT BANNER */}
      {announcement && announcement.active && (
        <div 
          className={`fixed top-0 left-0 right-0 z-50 py-3 px-6 text-center text-xs font-black shadow-md flex items-center justify-center gap-2.5 animate-in slide-in-from-top duration-300 no-print ${
            announcement.type === 'error' 
              ? 'bg-rose-600 text-white border-b border-rose-700/50' 
              : announcement.type === 'info'
              ? 'bg-indigo-600 text-white border-b border-indigo-700/50'
              : 'bg-amber-500 text-slate-950 border-b border-amber-600/50'
          }`}
          id="global_system_announcement_banner"
        >
          <svg className="w-4.5 h-4.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="leading-normal">{announcement.text}</span>
        </div>
      )}
      
      {/* Dynamic Qat Background Wallpaper with Custom Opacity */}
      {db.appBackgroundImage && (
        <div 
          className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center transition-all duration-300 no-print" 
          style={{ 
            backgroundImage: `url(${db.appBackgroundImage})`,
            opacity: (db.appBackgroundOpacity || 5) / 100,
            filter: 'blur(0.5px)'
          }}
        />
      )}
      
      {/* Global Style overrides to support dynamic designs and program border styles */}
      <style>{`
        .rounded-2xl {
          border-radius: ${
            db.appBorderShape === 'rounded-none' ? '0px' :
            db.appBorderShape === 'rounded-xl' ? '0.75rem' :
            db.appBorderShape === 'rounded-3xl' ? '1.75rem' :
            '1rem' // rounded-2xl default
          } !important;
        }
        .rounded-xl {
          border-radius: ${
            db.appBorderShape === 'rounded-none' ? '0px' :
            db.appBorderShape === 'rounded-xl' ? '0.75rem' :
            db.appBorderShape === 'rounded-3xl' ? '1.25rem' :
            '0.75rem' 
          } !important;
        }
      `}</style>

      {/* --- DESKTOP VERTICAL SIDEBAR --- */}
      <aside className="hidden md:flex flex-col w-[88px] xl:w-[280px] glass border-l border-white/5 z-40 transition-all duration-300 overflow-y-auto no-print flex-shrink-0" id="desktop_sidebar">
        {/* Branding Logo Area */}
        <div className="flex items-center gap-3 p-4 xl:p-6 border-b border-white/5 sticky top-0 bg-transparent backdrop-blur-md z-10">
          <div id="company_logo_box" className={`p-2.5 bg-accent text-white rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-accent/20 flex-shrink-0 mx-auto xl:mx-0`}>
            <BrandIconComponent size={24} className="stroke-[1.8]" />
          </div>
          <div className="text-right hidden xl:block">
            <span className="text-lg font-black tracking-tight text-white block" id="brand_title_ar">نظام ANAS</span>
            <span className="text-[10px] font-medium text-slate-400 block -mt-0.5" id="brand_subtitle_ar">إدارة مبیعاتك وحساباتك</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="flex-1 flex flex-col gap-2 p-3 xl:p-4" id="desktop_navbar">
          <button
            id="nav_btn_dashboard"
            onClick={() => handleNavigateToTab('dashboard')}
            title="العودة للوحة القيادة وموجز العمليات المالية وتحليل الحركة اليومية"
            className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
              activeTab === 'dashboard' 
                ? `bg-accent text-white shadow-lg shadow-accent/25` 
                : `text-slate-400 hover:text-white hover:bg-white/5`
            }`}
          >
            <LayoutDashboard size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
            <span className="hidden xl:block">الرئيسية</span>
          </button>

          <button
            id="nav_btn_accounts"
            onClick={() => {
              setSelectedAccountId(undefined);
              handleNavigateToTab('accounts');
            }}
            title="عرض وإدارة كشوف الحسابات للعملاء والموردين وتفاصيل الحركة والملخصات الشهرية"
            className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
              activeTab === 'accounts' 
                ? `bg-accent text-white shadow-lg shadow-accent/25` 
                : `text-slate-400 hover:text-white hover:bg-white/5`
            }`}
          >
            <Users size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'accounts' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
            <span className="hidden xl:block">الحسابات والكشوفات</span>
          </button>

          <button
            id="nav_btn_ledger"
            onClick={() => handleNavigateToTab('ledger')}
            title="دفتر قيود اليومية لآخر 30 يوماً وتسجيل المبيعات والمشتريات وتفاصيل الديون والمسودات"
            className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
              activeTab === 'ledger' 
                ? `bg-accent text-white shadow-lg shadow-accent/25` 
                : `text-slate-400 hover:text-white hover:bg-white/5`
            }`}
          >
            <BookOpen size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'ledger' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
            <span className="hidden xl:block">دفتر الـ 30 يوماً</span>
          </button>

          <button
            id="nav_btn_invoice"
            onClick={() => handleNavigateToTab('invoice')}
            title="إنشاء فاتورة وطباعتها وتعديل الطباعة"
            className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
              activeTab === 'invoice' 
                ? `bg-accent text-white shadow-lg shadow-accent/25` 
                : `text-slate-400 hover:text-white hover:bg-white/5`
            }`}
            
          >
            <Receipt size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'invoice' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
            <span className="hidden xl:block">الفواتير</span>
            
          </button>

          {isAdminUser && (
            <button
              id="nav_btn_subscription"
              onClick={() => handleNavigateToTab('subscription')}
              title="إدارة باقات الاشتراك والترقية للنسخة الاحترافية ومميزات الذكاء الاصطناعي"
              className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
                activeTab === 'subscription' 
                  ? `bg-accent text-white shadow-lg shadow-accent/25` 
                  : `text-accent font-black hover:bg-white/5`
              }`}
            >
              <Gem size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'subscription' ? 'text-white' : 'text-accent group-hover:text-indigo-400'}`} />
              <span className="hidden xl:block">الاشتراكات والترقية</span>
            </button>
          )}

          {isAdminUser && (
            <button
              id="nav_btn_admin"
              onClick={() => handleNavigateToTab('admin')}
              title="لوحة تحكم المدير"
              className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
                activeTab === 'admin' 
                  ? `bg-accent text-white shadow-lg shadow-accent/25` 
                  : `text-slate-400 hover:text-white hover:bg-white/5`
              }`}
            >
              <ShieldCheck size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'admin' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
              <span className="hidden xl:block">لوحة التحكم (مدير)</span>
            </button>
          )}

          {userRole !== 'Salesperson' && (
            <button
              id="nav_btn_reports"
              onClick={() => handleNavigateToTab('reports')}
              title="تحليل الحركات المالية الشاملة والرسوم البيانية وتلخيص الأرباح والخسائر ومستويات المبيعات"
              className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
                activeTab === 'reports' 
                  ? `bg-accent text-white shadow-lg shadow-accent/25` 
                  : `text-slate-400 hover:text-white hover:bg-white/5`
              }`}
            >
              <BarChart3 size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'reports' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
              <span className="hidden xl:block">التقارير المالية</span>
            </button>
          )}

          {userRole !== 'Salesperson' && (
            <button
              id="nav_btn_ai_control"
              onClick={() => handleNavigateToTab('ai-control')}
              title="مستشار الذكاء الاصطناعي الذكي لتوجيه النظام وتحليل الأداء والرد على التساؤلات"
              className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
                activeTab === 'ai-control' 
                  ? `bg-accent text-white shadow-lg shadow-accent/25` 
                  : `text-slate-400 hover:text-white hover:bg-white/5`
              }`}
            >
              <Cpu size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'ai-control' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
              <span className="hidden xl:block">مستشار الـ AI</span>
            </button>
          )}

          {userRole !== 'Salesperson' && (
            <button
              id="nav_btn_sync_import"
              onClick={() => handleNavigateToTab('sync-import')}
              title="استيراد كشوفات الحسابات والقيود من ملفات Excel والتحليل التلقائي بالفواتير بـ AI"
              className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
                activeTab === 'sync-import' 
                  ? `bg-accent text-white shadow-lg shadow-accent/25` 
                  : `text-slate-400 hover:text-white hover:bg-white/5`
              }`}
            >
              <RefreshCw size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'sync-import' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
              <span className="hidden xl:block">الاستيراد والتحليل الذكي</span>
            </button>
          )}

          {userRole !== 'Salesperson' && (
            <button
              id="nav_btn_recycle"
              onClick={() => handleNavigateToTab('recycle')}
              title="سلة المحذوفات"
              className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
                activeTab === 'recycle' 
                  ? `bg-accent text-white shadow-lg shadow-accent/25` 
                  : `text-slate-400 hover:text-white hover:bg-white/5`
              }`}
            >
              <Trash2 size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'recycle' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
              <span className="hidden xl:block">سلة المحذوفات</span>
            </button>
          )}

          {userRole !== 'Salesperson' && (
            <button
              id="nav_btn_activity_log"
              onClick={() => handleNavigateToTab('activity-log')}
              title="سجل العمليات"
              className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
                activeTab === 'activity-log' 
                  ? `bg-accent text-white shadow-lg shadow-accent/25` 
                  : `text-slate-400 hover:text-white hover:bg-white/5`
              }`}
            >
              <Activity size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'activity-log' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
              <span className="hidden xl:block">سجل العمليات</span>
            </button>
          )}

          <button
            id="nav_btn_backup"
            onClick={() => handleNavigateToTab('backup')}
            title="نظام النسخ الاحتياطي السحابي"
            className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer interactive-tap ${
              activeTab === 'backup' 
                ? `bg-accent text-white shadow-lg shadow-accent/25` 
                : `text-slate-400 hover:text-white hover:bg-white/5`
            }`}
            
          >
            <Cloud size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'backup' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`} />
            <span className="hidden xl:block text-indigo-400">النسخ الاحتياطي السحابي</span>
            
          </button>

          
          {userRole !== 'Salesperson' && (
            <button
              id="nav_btn_gateway"
              onClick={() => handleNavigateToTab('gateway')}
              title="الإعدادات"
              className={`group flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer interactive-tap ${
                activeTab === 'gateway' 
                  ? `bg-slate-800 text-white shadow-lg` 
                  : `text-slate-400 hover:text-white hover:bg-white/5`
              }`}
            >
              <Settings size={20} className={`icon-bounce transition-colors mx-auto xl:mx-0 ${activeTab === 'gateway' ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
              <span className="hidden xl:block">الإعدادات</span>
            </button>
          )}


        </nav>

        {/* Desktop Sidebar Bottom Actions */}
        <div className="p-3 xl:p-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3 flex flex-col items-center xl:items-stretch">
          
          <button
            id="day_night_mode_switcher"
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center justify-center xl:justify-start gap-3 p-2.5 xl:px-3.5 xl:py-3 rounded-xl text-[11px] font-black transition-all bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 cursor-pointer w-full mx-auto xl:mx-0"
            title={darkMode ? "التحويل للوضع النهاري" : "التحويل للوضع الليلي"}
          >
            {darkMode ? (
              <>
                <Sun size={18} className="text-amber-500 animate-[spin_10s_linear_infinite]" />
                <span className="hidden xl:block">الوضع النهاري</span>
              </>
            ) : (
              <>
                <Moon size={18} className="text-indigo-600" />
                <span className="hidden xl:block">الوضع الليلي</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT LAYOUT --- */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative" id="main_layout_container">
      
        {/* Dynamic Mobile Header (Hidden on Desktop) */}
        <header className="md:hidden glass border-b border-white/5 sticky top-0 z-40 no-print transition-colors duration-200" id="smartacc_header">
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              
              {/* Branding Logo Area */}
              <div className="flex items-center gap-3">
                <div id="company_logo_box" className={`p-2.5 ${accentBg} text-white rounded-xl flex items-center justify-center transition-colors shadow-xs`}>
                  <BrandIconComponent size={22} className="stroke-[1.8]" />
                </div>
                <div className="text-right">
                  <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white block" id="brand_title_ar">نظام ANAS المحاسبي</span>
                </div>
              </div>
              
              {/* Mobile Rail Menu Trigger Button & Auth */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl focus:outline-hidden"
                >
                  <Search size={20} />
                </button>
                {authUser ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsSyncModalOpen(true)}
                      className="p-1 flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                      title="حسابي والملف الشخصي"
                    >
                      {authUser.photoURL ? (
                        <img src={authUser.photoURL} alt="User Profile" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon size={20} className="text-slate-500" />
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => googleSignIn().catch(err => console.error('[Auth] Sign in error:', err))}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl"
                  >
                    <LogIn size={18} />
                  </button>
                )}
                <button
                  id="mobile_menu_trigger"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl focus:outline-hidden"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>

            </div>
          </div>
        </header>

        {/* Global Toolbar Header (For all views, visible on desktop) */}
        <div className="hidden md:flex justify-between items-center glass border-b border-white/5 p-4 px-6 z-30 no-print" id="desktop_top_toolbar">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black text-white">
              {activeTab === 'dashboard' ? 'الرئيسية' : 
               activeTab === 'accounts' ? 'الحسابات والكشوفات' : 
               activeTab === 'ledger' ? 'دفتر اليومية' : 
               activeTab === 'invoice' ? 'الفواتير والمبيعات' :
               activeTab === 'subscription' ? 'الاشتراكات والترقية والذكاء الاصطناعي' :
               activeTab === 'reports' ? 'التقارير المالية' :
               activeTab === 'ai-control' ? 'الذكاء الاصطناعي' :
               activeTab === 'sync-import' ? 'الاستيراد والتحليل الذكي' :
               activeTab === 'recycle' ? 'سلة المحذوفات' :
               activeTab === 'activity-log' ? 'سجل العمليات' :
               activeTab === 'gateway' ? 'الإعدادات والمظهر' : ''}
            </h1>
          </div>

          <div className="flex-1 max-w-md mx-8 relative group cursor-pointer" onClick={() => setIsSearchOpen(true)}>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
            </div>
            <input
              type="text"
              readOnly
              placeholder="بحث شامل (Ctrl+K)..."
              className="w-full bg-slate-900/50 hover:bg-slate-900/80 focus:bg-slate-900 border border-white/10 focus:border-indigo-500/50 rounded-2xl py-2 pr-10 pl-4 text-xs font-medium text-white placeholder:text-slate-500 outline-none transition-all shadow-inner cursor-pointer"
              dir="rtl"
            />
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <span className="text-[9px] font-bold bg-white/5 text-slate-500 px-1.5 py-0.5 rounded border border-white/5">Ctrl K</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {(() => {
              const isProUser = currentUserProfile?.isPro || false;
              if (isProUser) return null;
              
              const stats = db.checkLimitOrPro('operation', isProUser);
              const count = stats.count || 0;
              const limit = stats.limit || 5;
              const percentage = Math.min(100, Math.max(0, (count / limit) * 100));
              
              return (
                <div 
                  className="flex flex-col items-end gap-1 px-3 py-1 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors border border-white/10"
                  title="استهلاك العمليات المجانية اليومية"
                  onClick={() => setActiveTab('subscription')}
                >
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span className="text-[9px] font-black text-amber-400">القيود اليومية</span>
                    <span className="text-[9px] font-mono font-bold text-slate-300">{count}/{limit}</span>
                  </div>
                  <div className="w-24 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${percentage >= 100 ? 'bg-rose-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {authUser && (
              <div 
                className={`flex items-center gap-1.5 text-[10px] font-bold ${
                  cloudSyncStatus === 'success' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' :
                  cloudSyncStatus === 'syncing' ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 animate-pulse' :
                  cloudSyncStatus === 'error' ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20' :
                  'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
                } border border-transparent rounded-xl px-2.5 py-1.5`}
              >
                {cloudSyncStatus === 'syncing' ? (
                  <RefreshCw size={12} className="text-amber-500 animate-spin" />
                ) : (
                  <Cloud size={12} className={cloudSyncStatus === 'success' ? 'text-emerald-500' : cloudSyncStatus === 'error' ? 'text-red-500' : 'text-slate-500'} />
                )}
                <span>
                  {cloudSyncStatus === 'success' ? 'السحاب آمن ومزامَن ✔' :
                   cloudSyncStatus === 'syncing' ? 'جاري مزامنة السحاب...' :
                   cloudSyncStatus === 'error' ? 'عطل اتصال سحابي' :
                   'السحاب خامل'}
                </span>
              </div>
            )}

            <div 
              className={`flex items-center gap-1.5 text-[10px] font-bold ${isOnline ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20'} border border-transparent rounded-xl px-2.5 py-1.5`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
              <span>{isOnline ? 'يعمل دون اتصال' : 'وضع أوفلاين'}</span>
            </div>
            
            {db.restrictToAdmin && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl px-2.5 py-1.5 animate-pulse">
                <Lock size={12} className="text-indigo-500" />
                <span>تأمين المظهر نشط</span>
              </div>
            )}
            
            {authUser ? (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-2 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/60">
                <button 
                  onClick={() => setIsSyncModalOpen(true)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                  title="حسابي والملف الشخصي"
                >
                  {authUser.photoURL ? (
                    <img src={authUser.photoURL} alt="User Profile" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={14} className="text-slate-400" />
                  )}
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    {authUser.displayName || authUser.email?.split('@')[0]}
                  </span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => googleSignIn().catch(err => console.error('[Auth] Sign in error:', err))}
                className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-xl px-3 py-1.5 transition-colors border border-blue-100 dark:border-blue-800/50"
              >
                <LogIn size={14} />
                <span>ربط حساب Google</span>
              </button>
            )}

            <div className="text-[11px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg font-mono">
              {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

      {/* Mobile Drawer Navigation Rail Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 z-30 flex flex-col p-6 space-y-4 shadow-xl text-right no-print overflow-y-auto transition-colors duration-200" id="mobile_navbar_overlay">
          
          {/* Mobile Daily Usage Indicator */}
          {(() => {
            const isProUser = currentUserProfile?.isPro || false;
            if (isProUser) return null;
            
            const stats = db.checkLimitOrPro('operation', isProUser);
            const count = stats.count || 0;
            const limit = stats.limit || 5;
            const percentage = Math.min(100, Math.max(0, (count / limit) * 100));
            
            return (
              <div 
                className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-2 cursor-pointer border border-slate-100 dark:border-slate-800"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setActiveTab('subscription');
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400">القيود اليومية المتاحة</span>
                  <span className="text-xs font-mono font-bold text-slate-500">{count}/{limit}</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${percentage >= 100 ? 'bg-rose-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })()}

          <button
            id="mob_nav_btn_dashboard"
            onClick={() => handleNavigateToTab('dashboard')}
            className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'dashboard' 
                ? `${accentBg} text-white` 
                : 'bg-slate-50 text-slate-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <LayoutDashboard size={16} />
              <span>لوحة التحكم الرئيسية</span>
            </span>
          </button>

          <button
            id="mob_nav_btn_accounts"
            onClick={() => {
              setSelectedAccountId(undefined);
              handleNavigateToTab('accounts');
            }}
            className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all relative ${
              activeTab === 'accounts' 
                ? `${accentBg} text-white` 
                : 'bg-slate-50 text-slate-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <Users size={16} />
              <span>كشوف الحسابات كعملاء {userRole === 'Salesperson' ? 'فقط' : 'وموردين'}</span>
            </span>
          </button>

          <button
            id="mob_nav_btn_ledger"
            onClick={() => handleNavigateToTab('ledger')}
            className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'ledger' 
                ? `${accentBg} text-white` 
                : 'bg-slate-50 text-slate-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <BookOpen size={16} />
              <span>دفتر قيود الـ 30 يوماً والطباعة</span>
            </span>
          </button>

          <button
            id="mob_nav_btn_invoice"
            onClick={() => handleNavigateToTab('invoice')}
            className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'invoice' 
                ? `${accentBg} text-white` 
                : 'bg-slate-50 text-slate-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <Receipt size={16} />
              <span>إنشاء الفواتير</span>
            </span>
          </button>

          {isAdminUser && (
            <button
              id="mob_nav_btn_subscription"
              onClick={() => handleNavigateToTab('subscription')}
              className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'subscription' 
                  ? `${accentBg} text-white shadow-xs` 
                  : 'bg-slate-50 text-indigo-600'
              }`}
            >
              <span className="flex items-center gap-2">
                <Gem size={16} />
                <span>الاشتراكات والترقية</span>
              </span>
            </button>
          )}

          {isAdminUser && (
            <button
              id="mob_nav_btn_admin"
              onClick={() => handleNavigateToTab('admin')}
              className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'admin' 
                  ? `${accentBg} text-white` 
                  : 'bg-slate-50 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} />
                <span>لوحة التحكم (مدير)</span>
              </span>
            </button>
          )}

          {userRole !== 'Salesperson' && (
            <button
              id="mob_nav_btn_reports"
              onClick={() => handleNavigateToTab('reports')}
              className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'reports' 
                  ? `${accentBg} text-white shadow-xs` 
                  : 'bg-slate-50 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-2">
                <BarChart3 size={16} />
                <span>التقارير المالية والتحليلية</span>
              </span>
            </button>
          )}

          <button
            id="mob_nav_btn_backup"
            onClick={() => handleNavigateToTab('backup')}
            className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'backup' 
                ? `${accentBg} text-white shadow-xs` 
                : 'bg-slate-50 text-emerald-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Cloud size={16} />
              <span>النسخ الاحتياطي السحابي</span>
            </span>
          </button>

          {userRole !== 'Salesperson' && (
            <button
              id="mob_nav_btn_ai_control"
              onClick={() => handleNavigateToTab('ai-control')}
              className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'ai-control' 
                  ? `${accentBg} text-white shadow-xs` 
                  : 'bg-slate-50 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-2">
                <Cpu size={16} />
                <span>التحكم ومستشار الـ AI</span>
              </span>
            </button>
          )}

          {userRole !== 'Salesperson' && (
            <button
              id="mob_nav_btn_sync_import"
              onClick={() => handleNavigateToTab('sync-import')}
              className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'sync-import' 
                  ? `${accentBg} text-white shadow-xs` 
                  : 'bg-slate-50 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-2">
                <RefreshCw size={16} />
                <span>الاستيراد والتحليل الذكي</span>
              </span>
            </button>
          )}

          {userRole !== 'Salesperson' && (
            <button
              id="mob_nav_btn_recycle"
              onClick={() => handleNavigateToTab('recycle')}
              className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'recycle' 
                  ? `${accentBg} text-white` 
                  : 'bg-slate-50 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-2">
                <Trash2 size={16} />
                <span>سلة المحذوفات</span>
              </span>
            </button>
          )}

          {userRole !== 'Salesperson' && (
            <button
              id="mob_nav_btn_activity_log"
              onClick={() => handleNavigateToTab('activity-log')}
              className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'activity-log' 
                  ? `${accentBg} text-white` 
                  : 'bg-slate-50 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-2">
                <Activity size={16} />
                <span>سجل العمليات (Activity Log)</span>
              </span>
            </button>
          )}

          {userRole !== 'Salesperson' && (
            <button
              id="mob_nav_btn_gateway"
              onClick={() => handleNavigateToTab('gateway')}
              className={`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === 'gateway' 
                  ? `${accentBg} text-white` 
                  : 'bg-slate-50 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-2">
                <Radio size={16} />
                <span>إعدادات وبوابة النظام • Settings</span>
              </span>
            </button>
          )}

          {/* Mobile Offline Install Section */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">التشغيل كتطبيق مستقل / دون اتصال بالإنترنت</span>
            <button
              id="mob_install_pwa_btn"
              onClick={() => {
                setMobileMenuOpen(false);
                handleInstallApp();
              }}
              className="flex items-center justify-between p-3.5 rounded-xl text-xs font-black bg-gradient-to-l from-amber-500 to-orange-500 text-white border border-amber-600/10 cursor-pointer shadow-sm animate-pulse"
            >
              <span className="flex items-center gap-2">
                <Download size={15} className="stroke-[2.5]" />
                <span>تثبيت التطبيق على الشاشة الرئيسية</span>
              </span>
              <span className="text-[9px] text-white font-bold bg-white/20 px-2 py-0.5 rounded-md">تحميل 💾</span>
            </button>
          </div>

          {/* Mobile Day/Night Theme Switcher (الليل والنهار) */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1">سمة الألوان والإنارة</span>
            <button
              id="mob_day_night_switcher"
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center justify-between p-3.5 rounded-xl text-xs font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors duration-150"
            >
              <span className="flex items-center gap-2">
                {darkMode ? <Sun size={15} className="text-amber-500" /> : <Moon size={15} className="text-indigo-600" />}
                <span>{darkMode ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}</span>
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800">تبديل الجو</span>
            </button>
          </div>

          <div className="flex-1 flex items-end justify-center pb-8">
            <span className="text-[10px] text-slate-400 font-mono text-center">نظام ANAS المحاسبي v1.0 • صمم وبني لمقاومة الأخطاء</span>
          </div>

        </div>
      )}

  // Scrollable Content View
      <main className="flex-1 w-full overflow-y-auto p-4 sm:p-6 lg:p-12 pb-36 lg:pb-12" id="smartacc_main_view">
        
        {/* Active view Renderer switcher */}
        <div id="dynamic_view_renderer">
          <React.Suspense fallback={<ViewSkeleton />}>
          {activeTab === 'dashboard' && (
            <ErrorBoundary fallbackTitle="حدث خطأ أثناء تحميل لوحة التحكم (Dashboard)">
              <DashboardTab 
                db={db} 
                onNavigateToTab={handleNavigateToTab} 
                onSelectAccount={handleSelectAccount}
                onOpenQuickEntry={() => setIsQuickEntryOpen(true)}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'accounts' && (
            <ErrorBoundary fallbackTitle="حدث خطأ أثناء تحميل إدارة الحسابات والعملاء">
              <AccountsTab 
                db={db}
                selectedAccountId={selectedAccountId}
                onSelectAccountId={setSelectedAccountId}
                onDatabaseUpdate={handleDatabaseUpdate}
                role={userRole}
                onOpenQuickEntry={handleOpenQuickEntryWithType}
                isPro={isProUser}
                onNavigateToSubscription={() => setActiveTab('subscription')}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'ledger' && (
            <ErrorBoundary fallbackTitle="حدث خطأ أثناء تحميل دفتر القيود اليومية">
              <LedgerTab 
                db={db}
                onDatabaseUpdate={handleDatabaseUpdate}
                role={userRole}
                isPro={isProUser}
                onNavigateToSubscription={() => setActiveTab('subscription')}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'invoice' && (
            <ErrorBoundary fallbackTitle="حدث خطأ أثناء تحميل فواتير المبيعات والشراء">
              <InvoiceTab 
                db={db}
                onDatabaseUpdate={handleDatabaseUpdate}
                role={userRole}
                isPro={isProUser}
                onNavigateToSubscription={() => setActiveTab('subscription')}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'subscription' && isAdminUser && (
            <ErrorBoundary fallbackTitle="حدث خطأ أثناء تحميل صفحة الاشتراكات">
              <SubscriptionTab 
                userProfile={currentUserProfile}
                onUpgradeClick={() => setActiveTab('gateway')}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'reports' && userRole !== 'Salesperson' && (
            <ErrorBoundary fallbackTitle="حدث خطأ أثناء تحميل التقارير المالية">
              {isProUser ? (
                <ReportsTab db={db} />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm mx-auto max-w-2xl mt-12 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center relative rotate-3">
                    <BarChart3 size={40} />
                    <Lock size={20} className="absolute -bottom-2 -right-2 bg-slate-900 text-white rounded-full p-1 border-2 border-white" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">التقارير المالية المتقدمة</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed max-w-md mx-auto">
                      تحليل البيانات العميقة والرسوم البيانية وتوقعات الأرباح والخسائر متاحة فقط لمشتركي النسخة الاحترافية.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('subscription')}
                    className="px-8 py-4 bg-indigo-600 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    ترقية الحساب الآن
                  </button>
                </div>
              )}
            </ErrorBoundary>
          )}

          {activeTab === 'ai-control' && userRole !== 'Salesperson' && (
            <ErrorBoundary fallbackTitle="حدث خطأ في لوحة تحكم الذكاء الاصطناعي">
              <AIAssistantWidget 
                  isPro={isProUser} 
                  isDevMode={isDevMode} 
                  isAdmin={isAdminUser}
                  onNavigateToSubscription={() => setActiveTab('subscription')}
                  onActivateDevMode={() => {
                  localStorage.setItem('smartacc_dev_mode', 'true');
                  setIsDevMode(true);
                  handleDatabaseUpdate();
                }}
              >
                <AIControlDashboard 
                  db={db}
                  onDatabaseUpdate={handleDatabaseUpdate}
                  role={userRole}
                />
              </AIAssistantWidget>
            </ErrorBoundary>
          )}

          {activeTab === 'sync-import' && userRole !== 'Salesperson' && (
            <ErrorBoundary fallbackTitle="حدث خطأ في بوابة مزامنة واستيراد البيانات">
              {isProUser ? (
                <SyncImportTab 
                  db={db}
                  onDatabaseUpdate={handleDatabaseUpdate}
                  role={userRole}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm mx-auto max-w-2xl mt-12 animate-in fade-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center relative -rotate-3">
                    <Cloud size={40} />
                    <Lock size={20} className="absolute -bottom-2 -right-2 bg-slate-900 text-white rounded-full p-1 border-2 border-white" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">النسخ الاحتياطي والمزامنة</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed max-w-md mx-auto">
                      حماية بياناتك عبر المزامنة السحابية الفورية واستيراد البيانات من مصادر خارجية هي ميزات حصرية لمشتركي باقة Pro.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('subscription')}
                    className="px-8 py-4 bg-emerald-600 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    فتح ميزات الأمان الآن
                  </button>
                </div>
              )}
            </ErrorBoundary>
          )}

          {activeTab === 'recycle' && userRole !== 'Salesperson' && (
            <ErrorBoundary fallbackTitle="حدث خطأ في سلة المهملات والمحذوفات">
              <RecycleBinTab 
                db={db}
                onDatabaseUpdate={handleDatabaseUpdate}
                role={userRole}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'activity-log' && userRole !== 'Salesperson' && (
            <ErrorBoundary fallbackTitle="حدث خطأ في سجل العمليات">
              <ActivityLogTab 
                db={db}
                onDatabaseUpdate={handleDatabaseUpdate}
                role={userRole}
                onNavigate={handleNavigateToTab}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'admin' && isAdminUser && (
            <ErrorBoundary fallbackTitle="حدث خطأ في لوحة تحكم المدير">
              <AdminDashboard 
                db={db}
                onDatabaseUpdate={handleDatabaseUpdate}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'gateway' && userRole !== 'Salesperson' && (
            <ErrorBoundary fallbackTitle="حدث خطأ أثناء تحميل الإعدادات">
              <GatewayTab 
                db={db}
                onDatabaseUpdate={handleDatabaseUpdate}
                role={userRole}
              />
            </ErrorBoundary>
          )}


          {activeTab === 'backup' && (
            <ErrorBoundary fallbackTitle="حدث خطأ في واجهة النسخ الاحتياطي السحابي">
              <AgentAndVerification 
                isPro={isProUser} 
                isDevMode={isDevMode} 
                isAdmin={isAdminUser}
                onActivateDevMode={() => {
                  localStorage.setItem('smartacc_dev_mode', 'true');
                  setIsDevMode(true);
                  handleDatabaseUpdate();
                }}
              >
                <BackupCenterTab 
                db={db}
                authUser={authUser}
                onRestore={handleDatabaseUpdate}
                isPro={currentUserProfile?.isPro || false}
                onNavigateToSubscription={() => setActiveTab('subscription')}
              />
              </AgentAndVerification>
            </ErrorBoundary>
          )}
          </React.Suspense>
        </div>

      </main>

      {/* PWA manual installation instruction dialog modal */}
      {showInstallHelp && (
        <div id="pwa_install_help_modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal header with icon */}
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                <Monitor size={22} className="stroke-[2.2]" />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">تثبيت نظام أنس المحاسبي على سطح المكتب</h3>
                <p className="text-[10px] text-slate-400">التشغيل الفوري والمستقل دون حاجة لإنترنت</p>
              </div>
              <button 
                onClick={() => setShowInstallHelp(false)}
                className="mr-auto p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal content steps */}
            <div className="space-y-4 text-right">
              
              {/* Highlight badge about Offline capability */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/10 rounded-2xl p-3 flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mt-1 shrink-0"></div>
                <div className="text-xs">
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400 block mb-0.5">وضع العمل دون اتصال نشط ✔</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed block">
                    يتم تخزين جميع كشوفات الحسابات والعمليات والبيانات محلياً على جهازك الآن وبشكل فوري. يمكنك تصفح واستخدام النظام بالكامل بسلاسة حتى لو انقطع الإنترنت كلياً.
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">خطوات تثبيت التطبيق على جهازك:</h4>
                
                {/* Step 1: Chrome/Edge */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-1">🎮 لمتصفحات الكمبيوتر (Chrome &amp; Microsoft Edge):</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    انقر على أيقونة <strong>"تثبيت التطبيق"</strong> الصغيرة التي تظهر في شريط العنوان بالأعلى (بجوار زر المفضلة/النجمة)، أو افتح القائمة الجانبية (ثلاث نقاط <strong>⋮</strong>) واختر <strong>"تثبيت نظام أنس المحاسبي المطور"</strong>.
                  </p>
                </div>

                {/* Step 2: Safari / Apple ios */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-1">🍎 على أجهزة آيفون / متصفح Safari:</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    انقر على زر <strong>المشاركة (Share)</strong> في شريط الخيارات بالأسفل، ثم قم بالتمرير لأسفل واضغط على خيار <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong> لتشغيله كتطبيق مستقل واحترافي.
                  </p>
                </div>

                {/* Step 3: Android / Chrome */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-1">🤖 على أجهزة أندرويد:</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    اضغط على خيار <strong>"تثبيت التطبيق"</strong> من شريط التنبيهات المنبثق، أو من قائمة المتصفح العليا واختر <strong>تثبيت (Install App)</strong>.
                  </p>
                </div>

              </div>
            </div>

            {/* Modal actions close */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstallHelp(false)}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors"
              >
                حسناً، فهمت
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Simple Arabic Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 no-print mt-auto">
        <p>© {new Date().getFullYear()} نظام ANAS المحاسبي. جميع الحقوق محفوظة.</p>
        <p className="text-[10px] text-slate-350 pt-1">برمجة وإشراف انس عبد العزيز دنمه محاسبي متين متوافق مع البيئة المحملة بالأعمال والشركات الكبيرة.</p>
      </footer>

      {/* Back to Top Button (زر العودة للأعلى) */}
      {showBackToTop && (
        <button
          onClick={handleScrollToTop}
          className="fixed bottom-6 left-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 bg-slate-900 dark:bg-slate-800 text-white hover:scale-110 cursor-pointer border border-slate-700/50 flex items-center justify-center select-none animate-in fade-in zoom-in duration-200 no-print"
          title="العودة لأعلى الصفحة"
        >
          <ArrowUp size={20} className="stroke-[2.5]" />
        </button>
      )}

      {/* Floating Calculator (الآلة الحاسبة العائمة السريعة) */}
      <FloatingCalculator />

      {/* Voice AI Assistant (المساعد الصوتي الذكي المتكامل) */}
      <VoiceAIAssistant 
        db={db}
        onDatabaseUpdate={handleDatabaseUpdate}
        activeTab={activeTab}
        setActiveTab={handleNavigateToTab}
        setSelectedAccountId={setSelectedAccountId}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        handleInstallApp={handleInstallApp}
      />

      {/* Quick Credit/Debit Shortcut Buttons next to Calculator */}
      <div className="fixed bottom-6 right-24 sm:right-28 z-40 flex items-center gap-2 sm:gap-3 no-print" dir="rtl">
        <button
          onClick={() => handleOpenQuickEntryWithType('debit')}
          className="p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center cursor-pointer select-none group border bg-red-600 hover:bg-red-700 text-white border-red-700 scale-100 hover:scale-110"
          title="اسحب مبلغ دين"
        >
          <ArrowDown size={20} className="stroke-[2.2] animate-pulse" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 text-xs font-black mr-0 group-hover:mr-2 whitespace-nowrap">
            اسحب مبلغ دين
          </span>
        </button>
        <button
          onClick={() => handleOpenQuickEntryWithType('credit')}
          className="p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center cursor-pointer select-none group border bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 scale-100 hover:scale-110"
          title="تسديد مبلغ"
        >
          <ArrowUp size={20} className="stroke-[2.2] animate-pulse" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 text-xs font-black mr-0 group-hover:mr-2 whitespace-nowrap">
            تسديد مبلغ
          </span>
        </button>
      </div>

      {/* Quick Entry Floating Action Button */}
      {userRole !== 'Salesperson' && (
        <button
          onClick={() => {
            setQuickEntryDefaultType(undefined);
            setIsQuickEntryOpen(true);
          }}
          className="fixed bottom-24 right-6 z-40 p-4 rounded-full shadow-[0_8px_30px_rgb(79,70,229,0.3)] transition-all duration-300 bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-110 cursor-pointer border border-indigo-500 flex items-center justify-center select-none animate-in fade-in zoom-in duration-300 no-print group"
          title="إدخال قيد سريع (Quick Entry)"
        >
          <Zap size={22} className="stroke-[2] group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute flex h-3 w-3 top-0 right-0 -mt-1 -mr-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500 border-2 border-white dark:border-slate-900"></span>
          </span>
        </button>
      )}

      {/* Global Quick Entry Modal */}
      <GlobalSearchModal 
        db={db}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleNavigateToTab}
      />

      <QuickEntryModal 
        db={db}
        isOpen={isQuickEntryOpen}
        onClose={() => {
          setIsQuickEntryOpen(false);
          setQuickEntryDefaultType(undefined);
        }}
        onDatabaseUpdate={handleDatabaseUpdate}
        defaultType={quickEntryDefaultType}
        isPro={isProUser}
        onNavigateToSubscription={() => setActiveTab('subscription')}
      />

      {/* Sync Profile Modal */}
      {isSyncModalOpen && authUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {authUser.photoURL ? (
                  <img src={authUser.photoURL} alt="User Profile" className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                    <UserIcon size={24} />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">{authUser.displayName || 'مستخدم'}</h3>
                  <p className="text-xs text-slate-500">{authUser.email}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSyncModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 p-2 rounded-xl transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
               <button
                  onClick={() => {
                    setIsSyncModalOpen(false);
                    logout().catch(err => console.error('[Auth] Logout error:', err));
                  }}
                  className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold text-sm py-2.5 px-4 rounded-xl transition-colors"
                >
                  <LogOut size={16} />
                  <span>تسجيل الخروج من الحساب</span>
                </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

