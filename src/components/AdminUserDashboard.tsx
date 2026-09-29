/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Sparkles, 
  ShieldAlert, 
  Bell, 
  Activity, 
  RefreshCw, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  Clock,
  UserCheck
} from 'lucide-react';
import { firestore } from '../auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  updateDoc 
} from 'firebase/firestore';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastSeen: string;
  isPro?: boolean;
  role?: string;
}

interface ActivityLogItem {
  id: string;
  timestamp: string;
  username: string;
  userId?: string;
  userEmail?: string;
  actionType: 'add' | 'edit' | 'delete' | 'restore';
  entityType: string;
  entityId: string;
  details: string;
}

interface AdminUserDashboardProps {
  onDatabaseUpdate: () => void;
}

export default function AdminUserDashboard({ onDatabaseUpdate }: AdminUserDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Announcement States
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementType, setAnnouncementType] = useState<'info' | 'warning' | 'error'>('warning');
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [announcementStatusMsg, setAnnouncementStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load registered users real-time
  useEffect(() => {
    const usersRef = collection(firestore, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const usersList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        usersList.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setUsers(usersList);
      setLoadingUsers(false);
    }, (err) => {
      console.error('[Admin] Error loading users:', err);
      setLoadingUsers(false);
    });

    return () => unsubscribe();
  }, []);

  // Load global activity logs real-time
  useEffect(() => {
    const logsRef = collection(firestore, 'activity_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(150));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsList: ActivityLogItem[] = [];
      snapshot.forEach((doc) => {
        logsList.push({ id: doc.id, ...doc.data() } as ActivityLogItem);
      });
      setActivityLogs(logsList);
      setLoadingLogs(false);
    }, (err) => {
      console.error('[Admin] Error loading activity logs:', err);
      setLoadingLogs(false);
    });

    return () => unsubscribe();
  }, []);

  // Load current announcement state
  useEffect(() => {
    const announcementDocRef = doc(firestore, 'settings', 'announcement');
    const unsubscribe = onSnapshot(announcementDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAnnouncementText(data.text || '');
        setAnnouncementType(data.type || 'warning');
        setAnnouncementActive(data.active || false);
      }
    }, (err) => {
      console.error('[Admin] Error loading announcement:', err);
    });

    return () => unsubscribe();
  }, []);

  // Toggle user subscription 'Pro' status
  const handleTogglePro = async (user: UserProfile) => {
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      const newProStatus = !user.isPro;
      await updateDoc(userDocRef, { isPro: newProStatus });
      
      // Post an activity log entry about this change
      const logId = `admin_log_${Date.now()}`;
      await setDoc(doc(firestore, 'activity_logs', logId), {
        id: logId,
        timestamp: new Date().toISOString(),
        username: 'مدير النظام (Admin)',
        actionType: 'edit',
        entityType: 'account',
        entityId: user.uid,
        details: `تعديل اشتراك المستخدم ${user.email} إلى ${newProStatus ? 'مفعّل Pro' : 'ملغي Pro'}`
      });
    } catch (err) {
      console.error('[Admin] Failed to toggle Pro status:', err);
      alert('فشل في تحديث حالة الاشتراك. تحقق من الاتصال بالإنترنت.');
    }
  };

  // Publish / Save announcement
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAnnouncement(true);
    setAnnouncementStatusMsg(null);
    try {
      const announcementDocRef = doc(firestore, 'settings', 'announcement');
      await setDoc(announcementDocRef, {
        text: announcementText,
        type: announcementType,
        active: announcementActive,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setAnnouncementStatusMsg({
        type: 'success',
        text: 'تم تحديث الإعلان العام وتعميمه على جميع التطبيقات النشطة بنجاح!'
      });
      setTimeout(() => setAnnouncementStatusMsg(null), 4000);
    } catch (err: any) {
      console.error('[Admin] Failed to save announcement:', err);
      setAnnouncementStatusMsg({
        type: 'error',
        text: `فشل في حفظ الإعلان: ${err.message || 'صلاحيات غير كافية'}`
      });
    } finally {
      setSavingAnnouncement(false);
    }
  };

  // Filter users based on query
  const filteredUsers = users.filter(user => {
    const q = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(q) ||
      user.uid.toLowerCase().includes(q) ||
      user.displayName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 text-right" dir="rtl" id="admin_dashboard_root">
      
      {/* HEADER SECTION */}
      <div className="glass rounded-3xl p-6 shadow-xl border border-white/10 relative overflow-hidden" id="admin_header_card">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-x-10 -translate-y-10 blur-3xl"></div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl">
              <Users size={24} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white">بوابة المدير والتحكم بالصلاحيات (Admin Portal)</h2>
              <p className="text-xs text-slate-400">تحكم بالاشتراكات والإعلانات التنبيهية وراقب عمليات جميع محاسبي النظام.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ANNOUNCEMENT PUBLISHING SYSTEM */}
      <div className="glass border border-white/10 rounded-3xl p-6 shadow-xl space-y-5" id="announcement_publishing_system">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Bell size={18} className="text-amber-500 animate-bounce" />
            <span>نظام البث والإعلانات التنبيهية العام</span>
          </h3>
          <p className="text-xs text-slate-400">
            أرسل إعلانًا، أو توجيهًا إداريًا، أو إشعار صيانة يظهر فوراً كشريط علوي ثابت في أعلى شاشة التطبيق لجميع المحاسبين والعملاء النشطين بالبرنامج.
          </p>
        </div>

        {announcementStatusMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
            announcementStatusMsg.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400' 
              : 'bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-400'
          }`}>
            <CheckCircle2 size={16} />
            <span>{announcementStatusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveAnnouncement} className="space-y-4 pt-3 border-t border-slate-50 dark:border-slate-800/40">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Announcement Message Text */}
            <div className="md:col-span-7 space-y-1">
              <label className="text-xs font-bold text-slate-500 block">نص الإعلان أو التحذير المقترح</label>
              <input
                type="text"
                required
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="مثال: يرجى العلم بأن النظام سيخضع لصيانة دورية اليوم من الساعة 10:00 م ولمدة ساعة واحدة..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-3.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* Announcement Alert Level Color Type */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-bold text-slate-500 block">تصنيف ونوع الخطورة (ألوان الشريط)</label>
              <select
                value={announcementType}
                onChange={(e) => setAnnouncementType(e.target.value as any)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-3.5 text-slate-800 dark:text-slate-100 font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="info">ملاحظة زرقاء هادئة (Information)</option>
                <option value="warning">تنبيه أصفر تحذيري (Warning Alert)</option>
                <option value="error">خطأ/خطر أحمر ملفت (Danger Alert)</option>
              </select>
            </div>

            {/* Switch Toggle Status */}
            <div className="md:col-span-2 flex flex-col justify-end space-y-2 pb-1.5">
              <span className="text-xs font-bold text-slate-500 block md:hidden">حالة الإعلان</span>
              <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 p-3.5 rounded-xl text-xs font-extrabold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={announcementActive}
                  onChange={(e) => setAnnouncementActive(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer"
                />
                <span>تفعيل ونشر الإعلان</span>
              </label>
            </div>

          </div>

          <div className="flex justify-start">
            <button
              type="submit"
              disabled={savingAnnouncement}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:bg-indigo-400 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {savingAnnouncement ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>جاري نشر الإعلان...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="fill-white/20" />
                  <span>تحديث وحفظ الإعلان العام</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* USER SUBSCRIPTION MANAGER GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="admin_users_and_logs_grid">
        
        {/* Users list management panel */}
        <div className="lg:col-span-7 glass border border-white/10 rounded-3xl p-6 shadow-xl space-y-5" id="user_list_management_panel">
          
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Users size={18} className="text-indigo-400" />
                <span>قائمة المحاسبين والمستخدمين المسجلين</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                قائمة متكاملة لجميع المستخدمين الذين قاموا بربط حساباتهم بجوجل، متاح لك تفعيل اشتراك Pro للوصول لخدمات AI والنسخ.
              </p>
            </div>
          </div>

          {/* Quick Search Tool */}
          <div className="relative" id="user_search_box">
            <Search size={14} className="absolute right-4 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مستخدم بالبريد الإلكتروني، الاسم، أو معرف UID الخاص به..."
              className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl pr-10 pl-4 py-3 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {loadingUsers ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <RefreshCw size={24} className="text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-400">جاري تحميل سجل المحاسبين...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl py-12 text-center text-slate-400 space-y-2">
              <p className="text-xs font-bold">لا يوجد مستخدمون متوافقون مع استعلامك حالياً</p>
              <p className="text-[10px]">تأكد من إدخال اسم أو إيميل مسجل بشكل صحيح.</p>
            </div>
          ) : (
            <div className="overflow-x-auto" id="users_table_container">
              <table className="w-full text-right text-xs min-w-[700px] md:min-w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                    <th className="pb-3 text-right">المستخدم والبريد الإلكتروني</th>
                    <th className="pb-3 text-center">باقة الاشتراك</th>
                    <th className="pb-3 text-left">تعديل التفعيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      
                      {/* Name and Email */}
                      <td className="py-3.5">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-100" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold">
                              {user.displayName.charAt(0)}
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-100 block">{user.displayName}</span>
                            <span className="text-[10px] text-slate-450 block font-mono">{user.email}</span>
                            <span className="text-[9px] text-slate-400 block font-mono">ID: {user.uid}</span>
                          </div>
                        </div>
                      </td>

                      {/* Subscription badge */}
                      <td className="py-3.5 text-center">
                        {user.isPro ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/35 rounded-full shadow-2xs">
                            <Sparkles size={11} className="fill-amber-500 animate-pulse text-amber-500" />
                            <span>مشترك Pro</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-slate-500 bg-slate-50 dark:bg-slate-850 border border-transparent rounded-full">
                            <span>مستخدم عادي</span>
                          </span>
                        )}
                      </td>

                      {/* Pro toggler */}
                      <td className="py-3.5 text-left">
                        <button
                          onClick={() => handleTogglePro(user)}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-colors active:scale-95 shadow-2xs flex items-center gap-1 mr-auto ${
                            user.isPro 
                              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/50' 
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200/50'
                          }`}
                        >
                          {user.isPro ? (
                            <>
                              <Lock size={12} />
                              <span>إلغاء تفعيل Pro</span>
                            </>
                          ) : (
                            <>
                              <Unlock size={12} />
                              <span>تفعيل Pro المطور</span>
                            </>
                          )}
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Global user activity tracker */}
        <div className="lg:col-span-5 glass border border-white/10 rounded-3xl p-6 shadow-xl space-y-4" id="system_activity_tracker">
          
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Activity size={18} className="text-rose-500" />
              <span>مراقبة العمليات الحية (Activity Log)</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              سجل تفاعلي بالزمن الحقيقي لمراقبة كافة الإضافات، التعديلات، والحذوفات التي تم تنفيذها على كافة دفاتر النظام من قبل المستخدمين.
            </p>
          </div>

          {loadingLogs ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <RefreshCw size={20} className="text-rose-500 animate-spin" />
              <span className="text-[10px] text-slate-400">تحميل حركة العمليات الحية...</span>
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl py-12 text-center text-slate-400">
              <p className="text-xs font-bold">السجل نظيف وممتلئ بالسكينة حالياً 🕊</p>
              <p className="text-[10px] pt-1">سيتم رصد أول عملية يقوم بها المستخدمون وتدوينها هنا فوراً.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1" id="admin_activity_logs_stream">
              {activityLogs.map((log) => {
                const actionColors = 
                  log.actionType === 'add' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/10' :
                  log.actionType === 'edit' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-500/10' :
                  log.actionType === 'delete' ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 border-rose-500/10' :
                  'text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-500/10';

                const actionLabel = 
                  log.actionType === 'add' ? 'إضافة ➕' :
                  log.actionType === 'edit' ? 'تعديل 📝' :
                  log.actionType === 'delete' ? 'حذف 🗑' :
                  'استعادة ↺';

                return (
                  <div 
                    key={log.id} 
                    className="p-3 border border-slate-100 dark:border-slate-800/70 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-200 dark:hover:border-slate-700 transition-all flex items-start gap-2.5 text-right font-sans"
                  >
                    <div className="space-y-1 w-full">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">{log.username}</span>
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded-md border ${actionColors}`}>
                          {actionLabel}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        {log.details}
                      </p>

                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-mono">
                        <Clock size={10} className="text-slate-350" />
                        <span>{new Date(log.timestamp)?.toLocaleString('ar-SA')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
