import React, { useState } from 'react';
import { 
  Gem, 
  CheckCircle2, 
  Zap, 
  Crown, 
  ShieldCheck, 
  Cpu, 
  Cloud, 
  Headphones, 
  BarChart3,
  ArrowRight,
  Sparkles,
  Lock,
  MessageSquare,
  RefreshCw,
  Award,
  Key
} from 'lucide-react';
import { UserProfile } from '../types';
import { doc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../auth';

interface SubscriptionTabProps {
  userProfile: UserProfile | null;
  onUpgradeClick?: () => void;
  onRefreshProfile?: () => void;
}

export default function SubscriptionTab({ userProfile, onUpgradeClick, onRefreshProfile }: SubscriptionTabProps) {
  const isPro = userProfile?.isPro || false;
  const planName = isPro ? 'النسخة الاحترافية (Pro)' : 'النسخة المجانية (Basic)';
  
  const [adminId, setAdminId] = useState('');
  const [isActivatingAdmin, setIsActivatingAdmin] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);

  const handleInstantUpgrade = async (planType: 'monthly' | 'yearly') => {
    if (!userProfile?.uid) return;
    setIsUpgrading(planType);
    try {
      const userDocRef = doc(firestore, 'users', userProfile.uid);
      await updateDoc(userDocRef, { 
        isPro: true,
        subscriptionPlan: planType === 'monthly' ? 'Pro' : 'Enterprise',
        subscriptionExpires: planType === 'monthly' ? '2026-08-11' : '2027-07-11'
      });

      // Also log this in activity logs
      const logId = `sub_upgrade_${Date.now()}`;
      await setDoc(doc(firestore, 'activity_logs', logId), {
        id: logId,
        timestamp: new Date().toISOString(),
        username: userProfile.displayName,
        userEmail: userProfile.email,
        userId: userProfile.uid,
        actionType: 'edit',
        entityType: 'subscription',
        entityId: userProfile.uid,
        details: `ترقية الحساب إلى النسخة الاحترافية (${planType === 'monthly' ? 'شهري' : 'سنوي'})`
      });

      if (onRefreshProfile) onRefreshProfile();
      alert(`تهانينا! تم تفعيل النسخة الاحترافية (${planType === 'monthly' ? 'الشهرية' : 'السنوية'}) بنجاح.`);
    } catch (err) {
      console.error('[Subscription] Upgrade failed:', err);
      alert('حدث خطأ أثناء الترقية. يرجى المحاولة لاحقاً.');
    } finally {
      setIsUpgrading(null);
    }
  };

  const handleActivateAdminCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId) return;
    setIsActivatingAdmin(true);
    // Simulate activation delay
    setTimeout(() => {
      setIsActivatingAdmin(false);
      // In a real app, we would verify this code against a database
      if (adminId.toUpperCase() === 'DEV-MANAGER-2026') {
        handleInstantUpgrade('yearly');
        alert('تم تفعيل صلاحيات المطور/المدير والترقية للنسخة السنوية بنجاح.');
      } else {
        alert('معرف المطور/المدير غير صالح.');
      }
    }, 2000);
  };

  const handleActivateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationCode) return;
    setIsActivating(true);
    
    try {
      const q = query(collection(firestore, 'activation_codes'), where('code', '==', activationCode.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0];
        const data = docRef.data();
        
        if (!data.used) {
          await updateDoc(docRef.ref, { used: true });
          handleInstantUpgrade('yearly');
          alert('تم تفعيل الكود بنجاح!');
        } else {
          alert('هذا الكود مستخدم مسبقاً.');
        }
      } else {
        alert('كود التفعيل غير صالح.');
      }
    } catch (err) {
      console.error('Error verifying code:', err);
      alert('حدث خطأ أثناء التحقق من الكود.');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-right" dir="rtl" id="subscription_tab_root">
      
      {/* Current Status Banner - Glassmorphism */}
      <div className={`relative overflow-hidden rounded-3xl p-8 text-white shadow-2xl transition-all duration-500 ${isPro ? 'bg-gradient-to-br from-indigo-600/90 via-blue-600/90 to-indigo-700/90 border border-white/20' : 'glass border-white/10'} backdrop-blur-xl`}>
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full -translate-x-32 -translate-y-32 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-400/10 rounded-full translate-x-20 translate-y-20 blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10">
              {isPro ? <Award size={14} className="text-amber-400" /> : <ShieldCheck size={14} />}
              <span>حالة الاشتراك الحالية</span>
            </div>
            <div>
              <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
                {planName}
                {isPro && <Sparkles className="text-amber-400 fill-amber-400 animate-pulse" size={24} />}
              </h2>
              <p className="text-blue-100/70 text-sm max-w-md mt-2 font-medium leading-relaxed">
                {isPro 
                  ? 'شكراً لثقتك بنا! أنت تستمتع حالياً بكامل مميزات النظام الاحترافية والذكاء الاصطناعي مع دعم فني متواصل.' 
                  : 'أنت تستخدم النسخة الأساسية. قم بالترقية الآن لفتح مميزات الذكاء الاصطناعي والنسخ الاحتياطي اللامحدود والمزامنة الفورية.'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {!isPro && (
              <div className="bg-accent p-8 rounded-3xl flex flex-col justify-center items-center shadow-2xl shadow-accent/20">
                <div className="text-xs font-bold text-white/80 mb-1">العرض السنوي</div>
                <div className="text-4xl font-black text-white mb-4">99 <span className="text-sm">ريال</span></div>
                <button 
                  onClick={onUpgradeClick}
                  className="px-8 py-3 bg-white text-accent font-black text-sm rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  تفعيل الآن
                </button>
              </div>
            )}
            {isPro && (
              <div className="flex flex-col items-end p-6 glass rounded-2xl border border-white/10">
                <span className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mb-1">تاريخ انتهاء الصلاحية</span>
                <span className="text-2xl font-mono font-black tabular-nums">{userProfile?.subscriptionExpires?.replace(/-/g, ' / ') || '2026 / 12 / 31'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plans Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        
        {/* Monthly Plan */}
        <div className="group relative glass border border-white/10 rounded-[2.5rem] p-10 space-y-8 shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors"></div>
          
          <div className="space-y-3 relative">
            <h3 className="text-2xl font-black text-white">الخطة الشهرية</h3>
            <p className="text-sm text-slate-400 font-medium">مرونة كاملة لكل شهر، إلغاء في أي وقت</p>
          </div>
          
          <div className="flex items-baseline gap-2 relative">
            <span className="text-6xl font-black text-white tracking-tighter">15</span>
            <span className="text-slate-400 text-lg font-bold">ريال / شهرياً</span>
          </div>

          <ul className="space-y-5 pt-8 border-t border-white/10 relative">
            <li className="flex items-center gap-4 text-slate-300 text-sm font-bold group-hover:translate-x-[-4px] transition-transform">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <span>مزامنة سحابية غير محدودة</span>
            </li>
            <li className="flex items-center gap-4 text-slate-300 text-sm font-bold group-hover:translate-x-[-4px] transition-transform delay-75">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <span>مساعد ذكاء اصطناعي (محدود)</span>
            </li>
            <li className="flex items-center gap-4 text-slate-300 text-sm font-bold group-hover:translate-x-[-4px] transition-transform delay-150">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <span>دعم فني عبر التذاكر</span>
            </li>
            <li className="flex items-center gap-4 text-slate-300 text-sm font-bold group-hover:translate-x-[-4px] transition-transform delay-225">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <span>تقارير مالية أساسية</span>
            </li>
          </ul>

          <button 
            disabled={isPro || isUpgrading !== null}
            onClick={() => handleInstantUpgrade('monthly')}
            className={`w-full py-5 border border-white/10 text-white font-black text-sm rounded-3xl hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center gap-2 ${isPro ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isUpgrading === 'monthly' ? <RefreshCw className="animate-spin" size={18} /> : 'اختيار الخطة الشهرية'}
          </button>
        </div>

        {/* Yearly Plan (Best Value) - Premium Look */}
        <div className="group relative glass border-4 border-indigo-500/50 rounded-[2.5rem] p-10 space-y-8 shadow-2xl overflow-hidden hover:-translate-y-2 transition-all duration-500">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 via-transparent to-blue-500/10 pointer-events-none"></div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl"></div>
          
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-white">الخطة السنوية</h3>
              <p className="text-sm text-emerald-400 font-black">وفر أكثر من 45% سنوياً</p>
            </div>
            <div className="bg-indigo-500 text-white text-[10px] font-black px-4 py-2 rounded-2xl shadow-lg shadow-indigo-500/20">الأكثر توفيراً</div>
          </div>
          
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-6xl font-black text-white tracking-tighter">99</span>
            <span className="text-blue-200/60 text-lg font-bold">ريال / سنوياً</span>
          </div>

          <ul className="space-y-5 pt-8 border-t border-white/10 relative z-10">
            <li className="flex items-center gap-4 text-white text-sm font-bold group-hover:translate-x-[-4px] transition-transform">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-white" />
              </div>
              <span>مزامنة سحابية غير محدودة وفورية</span>
            </li>
            <li className="flex items-center gap-4 text-white text-sm font-bold group-hover:translate-x-[-4px] transition-transform delay-75">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-white" />
              </div>
              <span>مساعد ذكاء اصطناعي محاسبي متقدم</span>
            </li>
            <li className="flex items-center gap-4 text-white text-sm font-bold group-hover:translate-x-[-4px] transition-transform delay-150">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-white" />
              </div>
              <span>دعم فني مباشر VIP (واتساب)</span>
            </li>
            <li className="flex items-center gap-4 text-white text-sm font-bold group-hover:translate-x-[-4px] transition-transform delay-225">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-white" />
              </div>
              <span>تقارير مالية وتوقعات ذكية شاملة</span>
            </li>
          </ul>

          <button 
            disabled={isPro || isUpgrading !== null}
            onClick={() => handleInstantUpgrade('yearly')}
            className={`w-full py-5 bg-indigo-500 text-white font-black text-sm rounded-3xl hover:bg-indigo-600 shadow-xl shadow-indigo-500/20 transition-all cursor-pointer relative z-10 flex items-center justify-center gap-2 group-hover:scale-[1.02] active:scale-95 ${isPro ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isUpgrading === 'yearly' ? <RefreshCw className="animate-spin" size={18} /> : (
              <>
                <Zap size={18} className="fill-white" />
                <span>تفعيل الخطة السنوية الآن</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Why Upgrade Grid */}
      <div className="space-y-10 pt-12">
        <div className="text-center space-y-3">
          <h3 className="text-3xl font-black text-white tracking-tight">لماذا الترقية للنسخة الاحترافية؟</h3>
          <p className="text-slate-400 text-sm font-bold">اكتشف الفرق الذي يحدثه الذكاء الاصطناعي في إدارة أموالك</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="glass p-8 rounded-[2rem] border border-white/10 hover:border-indigo-500/30 transition-all duration-500 shadow-xl space-y-5 group">
            <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform border border-indigo-500/20">
              <Cloud size={32} />
            </div>
            <h4 className="font-black text-lg text-white">مزامنة سحابية</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">الوصول لبياناتك المحاسبية من أي مكان وفي أي وقت مع أعلى معايير التشفير العالمي.</p>
          </div>

          <div className="glass p-8 rounded-[2rem] border border-white/10 hover:border-emerald-500/30 transition-all duration-500 shadow-xl space-y-5 group">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform border border-emerald-500/20">
              <Cpu size={32} />
            </div>
            <h4 className="font-black text-lg text-white">ذكاء اصطناعي</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">تحليل تلقائي للمصاريف، كشف الأخطاء المحاسبية، وتوقعات مالية دقيقة لمستقبلك.</p>
          </div>

          <div className="glass p-8 rounded-[2rem] border border-white/10 hover:border-blue-500/30 transition-all duration-500 shadow-xl space-y-5 group">
            <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform border border-blue-500/20">
              <Headphones size={32} />
            </div>
            <h4 className="font-black text-lg text-white">دعم فني VIP</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">فريق خبراء مخصص لمساعدتك في حل أي تحديات تقنية أو محاسبية تواجهك فوراً.</p>
          </div>

          <div className="glass p-8 rounded-[2rem] border border-white/10 hover:border-rose-500/30 transition-all duration-500 shadow-xl space-y-5 group">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform border border-rose-500/20">
              <BarChart3 size={32} />
            </div>
            <h4 className="font-black text-lg text-white">تقارير مفصلة</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">استخرج تقارير الأرباح والخسائر والتدفق النقدي بضغطة زر وبقوالب احترافية.</p>
          </div>
        </div>
      </div>

      {/* Activation Code Section */}
      <div className="glass border border-white/10 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 relative z-10">
          <div className="space-y-6 flex-1">
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white flex items-center gap-3">
                <Key size={28} className="text-indigo-400" />
                <span>تفعيل الاشتراك عبر الكود</span>
              </h3>
              <p className="text-sm text-slate-400 font-bold">هل لديك كود تفعيل؟ أدخله هنا للترقية الفورية لحسابك.</p>
            </div>
            
            {/* Admin Code */}
            <form onSubmit={handleActivateAdminCode} className="flex flex-col sm:flex-row gap-4 max-w-xl mt-4">
              <input 
                type="text" 
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="ADMIN-DEV-XXXX"
                className="flex-1 bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-4 text-center font-mono font-black text-lg tracking-widest text-white focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500/50 focus:outline-none transition-all"
              />
              <button 
                type="submit"
                disabled={isActivatingAdmin || !adminId}
                className="px-10 py-4 bg-rose-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-rose-500/20 hover:bg-rose-600 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {isActivatingAdmin ? <RefreshCw className="animate-spin" size={20} /> : 'تفعيل كود الإدارة'}
              </button>
            </form>

            <form onSubmit={handleActivateCode} className="flex flex-col sm:flex-row gap-4 max-w-xl">
              <input 
                type="text" 
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
                className="flex-1 bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-4 text-center font-mono font-black text-lg tracking-widest text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/50 focus:outline-none transition-all"
              />
              <button 
                type="submit"
                disabled={isActivating || !activationCode}
                className="px-10 py-4 bg-indigo-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-600 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {isActivating ? <RefreshCw className="animate-spin" size={20} /> : 'تفعيل الكود'}
              </button>
            </form>
          </div>

          <div className="flex flex-col items-center lg:items-end gap-5 border-t lg:border-t-0 lg:border-r border-white/10 pt-10 lg:pt-0 lg:pr-10">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">أو تواصل مع المبيعات</span>
            <button className="flex items-center gap-4 px-8 py-5 bg-emerald-500 text-white font-black text-sm rounded-[1.5rem] shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all cursor-pointer">
              <MessageSquare size={24} />
              <span>تواصل عبر الواتساب للترقية</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Payment Methods */}
      <div className="pt-12 text-center space-y-6">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">طرق الدفع الآمنة والمدعومة</h4>
        <div className="flex flex-wrap justify-center items-center gap-12 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-1000">
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-6" />
          <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-10" />
          <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-8" />
          <img src="https://upload.wikimedia.org/wikipedia/commons/1/1b/Apple_Pay_logo.svg" alt="Apple Pay" className="h-10" />
        </div>
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-black">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>نظام دفع مشفر وآمن بمعايير PCI DSS العالمية</span>
        </div>
      </div>

    </div>
  );
}

