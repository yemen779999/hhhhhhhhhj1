/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Cpu, 
  Sparkles, 
  ListTodo, 
  Send, 
  CheckCircle, 
  Settings, 
  Palette, 
  ShieldAlert,
  Loader2,
  HelpCircle,
  HelpCircleIcon,
  TrendingUp,
  CalendarDays,
  User as UserIcon,
  BellRing,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from "lucide-react";
import { Database } from "../utils";
import { Account, DailyLedgerEntry } from "../types";

function SalesPatternAnalyzer({ db }: { db: Database }) {
  const recommendations = useMemo(() => {
    // A buyer with a negative balance is a debtor.
    const customers = db.accounts.filter(a => a.type === 'buyer' && db.getAccountBalance(a.id) < 0);
    const recs: { account: Account; suggestion: string; daysUntil: number }[] = [];

    customers.forEach(customer => {
      // Find all payment entries from this customer (credit reduces debt)
      const payments = db.dailyEntries.filter(
        e => e.accountId === customer.id && e.transactionType === 'credit'
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (payments.length > 0) {
        // Simple analysis: finding average days between payments or most common day of month
        const daysOfMonth = payments.map(p => new Date(p.date).getDate());
        
        // Find most frequent payment day
        const dayCounts = daysOfMonth.reduce((acc, day) => {
          acc[day] = (acc[day] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        
        let bestDay = 1;
        let maxCount = 0;
        for (const [day, count] of Object.entries(dayCounts)) {
          if (count > maxCount) {
            maxCount = count;
            bestDay = parseInt(day);
          }
        }

        const today = new Date();
        const currentDay = today.getDate();
        let daysUntil = bestDay - currentDay;
        
        if (daysUntil < 0) {
          // It's for next month
          const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
          daysUntil = daysInMonth - currentDay + bestDay;
        }

        let suggestion = '';
        if (daysUntil <= 3) {
          suggestion = `العميل يسدد عادة يوم ${bestDay} من الشهر. الوقت مثالي لإرسال عرض ترويجي الآن (متبقي ${daysUntil} يوم)!`;
        } else {
          suggestion = `العميل يسدد عادة يوم ${bestDay} من الشهر. يفضل إرسال العروض بعد ${daysUntil - 2} أيام.`;
        }

        recs.push({ account: customer, suggestion, daysUntil });
      }
    });

    return recs.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [db.dailyEntries, db.accounts]);

  return (
    <div className="glass border border-white/10 rounded-3xl p-6 shadow-xl space-y-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
      <div className="flex items-center gap-2 pb-3 border-b border-white/10 relative z-10">
        <TrendingUp size={18} className="text-emerald-400" />
        <h3 className="text-sm font-black text-white">تحليل أنماط المبيعات ومواعيد السداد الذكية</h3>
      </div>
      
      <p className="text-[11px] text-slate-400 relative z-10">
        يقوم محرك الذكاء الاصطناعي بتحليل التواريخ السابقة لسداد العملاء المدينين، ويقترح أفضل الأوقات لإرسال عروض ترويجية لتحفيزهم على السداد أو الشراء مجدداً.
      </p>

      {recommendations.length === 0 ? (
        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center relative z-10">
          <p className="text-xs text-slate-500 font-bold">لا توجد بيانات كافية أو مدينون للتحليل حالياً.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
          {recommendations.map((rec, idx) => (
            <div key={idx} className="glass border border-white/10 rounded-2xl p-4 space-y-3 shadow-lg hover:shadow-indigo-500/10 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                    <UserIcon size={14} className="text-slate-500" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{rec.account.name}</span>
                </div>
                <div className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                  rec.daysUntil <= 3 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' 
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                }`}>
                  <BellRing size={10} />
                  <span>{rec.daysUntil <= 3 ? 'وقت مثالي' : 'مجدول'}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed bg-white/50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-white dark:border-slate-800">
                {rec.suggestion}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AIControlDashboardProps {
  isPro?: boolean;
  onNavigateToSubscription?: () => void;
  db: Database;
  onDatabaseUpdate: () => void;
  role: string;
}

export default function AIControlDashboard({ db, onDatabaseUpdate, role }: AIControlDashboardProps) {
  // Delegations state
  const [executiveMode, setExecutiveMode] = useState(true);
  const [delegateTheme, setDelegateTheme] = useState(true);
  const [delegateConstraints, setDelegateConstraints] = useState(true);
  const [delegateData, setDelegateData] = useState(true);

  // Command panel state
  const [userCommand, setUserCommand] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(
    "مرحباً بك! أنا المدير التنفيذي المدعم بالذكاء الاصطناعي لنظام ANAS المحاسبي المحمول. تم تفويضي بامتيازات التعديل الكاملة للمظهر والبيانات. اكتب طلبك هنا وسأقوم بمواءمة المظهر وتحديث الحسابات فوراً."
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Voice AI States & Refs
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [autoSpeakResponse, setAutoSpeakResponse] = useState(true);
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [isContinuousVoiceMode, setIsContinuousVoiceMode] = useState(false);

  // Thread-safe state synchronization refs
  const isListeningRef = useRef(false);
  const isPlayingSpeechRef = useRef(false);
  const isContinuousVoiceModeRef = useRef(isContinuousVoiceMode);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { isPlayingSpeechRef.current = isPlayingSpeech; }, [isPlayingSpeech]);
  useEffect(() => { isContinuousVoiceModeRef.current = isContinuousVoiceMode; }, [isContinuousVoiceMode]);

  const setListeningState = (val: boolean) => {
    setIsListening(val);
    isListeningRef.current = val;
  };
  const setPlayingSpeechState = (val: boolean) => {
    setIsPlayingSpeech(val);
    isPlayingSpeechRef.current = val;
  };

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== "undefined" ? window.speechSynthesis : null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const sampleCommands = [
    "عدل مظهر وتصميم التطبيق ليكون بلون الزمرد الأخضر Emerald الفاخر وحواف دائرية أنيقة جداً ومريحة للعين مع أيقونة جوهرة كشعار",
    "تولى تصحيح وتنسيق أرقام الهواتف اليتيمة في الحسابات لتلتزم بالصيغة الدولية فتح الخط اليمني +967",
    "اضبط مظهر النظام ليكون باللون البرتقالي الدافئ Orange وحواف حادة كلاسيكية كالتطبيقات المكتبية المرموقة",
    "تأكد من أن جميع الحسابات تمتلك عمود عملة محدد ولا توجد حقول فارغة وهمية"
  ];

  const safeStartRecognition = () => {
    if (!recognitionRef.current) return;
    if (isListeningRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn("Recognition already started or starting:", e);
    }
  };

  const safeStopRecognition = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (e) {}
  };

  // Initialize Speech Recognition
  const initSpeechRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError("متصفحك لا يدعم التعرف على الصوت. جرب متصفح Google Chrome أو Safari.");
      return null;
    }

    const rec = new SpeechRecognition();
    rec.lang = "ar-YE"; // Target Yemeni / Generic Arabic
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      setListeningState(true);
      setSpeechError(null);
    };

    rec.onend = () => {
      setListeningState(false);
    };

    rec.onerror = (event: any) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        setListeningState(false);
        return;
      }
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setSpeechError("إذن الميكروفون مرفوض أو محجوب. يرجى تفعيل الميكروفون في المتصفح، أو الضغط على زر فتح التطبيق في نافذة جديدة (Open in New Tab) في شريط الأدوات لتفادي قيود الحماية للإطارات.");
      } else {
        setSpeechError(`حدث خطأ في التعرف على الصوت (${event.error || "غير معروف"}). نصيحة: جرب فتح التطبيق في علامة تبويب جديدة لتفادي قيود أمان الإطارات.`);
      }
      setListeningState(false);
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setUserCommand(transcript);
        // Execute automatically if in continuous mode or if preferred
        executeCommandDirectly(transcript).catch(err => console.error("executeCommandDirectly error:", err));
      }
    };

    recognitionRef.current = rec;
    return rec;
  };

  const toggleListening = () => {
    const rec = initSpeechRecognition();
    if (!rec) return;

    if (isListeningRef.current) {
      safeStopRecognition();
    } else {
      stopSpeaking();
      safeStartRecognition();
    }
  };

  // Speak Text Aloud
  const speakText = (text: string) => {
    if (!synthRef.current) return;

    synthRef.current.cancel();

    // Clean text from markdown styles
    const cleanText = text
      .replace(/[*_`#]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+\.[A-Za-z]{2,4}/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ar-SA";

    const voices = synthRef.current.getVoices();
    const arabicVoice = voices.find(v => v.lang.startsWith("ar") && v.name.includes("Google")) || 
                        voices.find(v => v.lang.startsWith("ar"));
    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }

    utterance.rate = 1.05; // Slightly faster for natural Arabic cadence
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setPlayingSpeechState(true);
    };

    utterance.onend = () => {
      setPlayingSpeechState(false);
      // Continuous Conversation Mode: Re-trigger listening automatically
      if (isContinuousVoiceModeRef.current) {
        setTimeout(() => {
          const rec = initSpeechRecognition();
          if (rec && !isListeningRef.current) {
            safeStartRecognition();
          }
        }, 1200);
      }
    };

    utterance.onerror = (e) => {
      const errType = e.error as string;
      if (errType === "interrupted" || errType === "canceled" || errType === "rendering-canceled") {
        setPlayingSpeechState(false);
        return;
      }
      console.error("Speech Synthesis error:", e.error);
      setPlayingSpeechState(false);
    };

    activeUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setPlayingSpeechState(false);
    }
  };

  // Clean up speech synthesis & recognition on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const executeCommandDirectly = async (commandText: string) => {
    if (!commandText.trim() || isProcessing) return;

    stopSpeaking();
    setIsProcessing(true);
    setStatusMessage(null);
    setAiResponse(null);

    try {
      const response = await fetch("/api/ai-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: commandText,
          currentTheme: {
            accentColor: db.appAccentColor || "blue",
            borderShape: db.appBorderShape || "rounded-2xl",
            brandIcon: db.appBrandIcon || "Building2"
          },
          database: {
            accounts: db.accounts,
            dailyEntries: db.dailyEntries
          }
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "فشل الذكاء الاصطناعي في إتمام وتأويل الأمر.");
      }

      // Apply dynamic layout themes changes if returned
      if (resData.themeUpdated && delegateTheme) {
        if (resData.themeUpdated.accentColor) {
          db.appAccentColor = resData.themeUpdated.accentColor;
        }
        if (resData.themeUpdated.borderShape) {
          db.appBorderShape = resData.themeUpdated.borderShape;
        }
        if (resData.themeUpdated.brandIcon) {
          db.appBrandIcon = resData.themeUpdated.brandIcon;
        }
      }

      // Apply dynamic data updates if returned and permitted
      if (resData.databaseUpdated && delegateData) {
        if (resData.databaseUpdated.accounts && resData.databaseUpdated.accounts.length > 0) {
          db.accounts = resData.databaseUpdated.accounts;
        }
        if (resData.databaseUpdated.dailyEntries && resData.databaseUpdated.dailyEntries.length > 0) {
          db.dailyEntries = resData.databaseUpdated.dailyEntries;
        }
      }

      // Commit changes immediately and refresh parent UI state
      db.save();
      onDatabaseUpdate();

      setAiResponse(resData.responseText);
      setUserCommand("");
      setStatusMessage("تم تطبيق التعديلات المرئية وتحديث الحسابات بنجاح لحظياً!");

      // Speak response out loud if enabled
      if (autoSpeakResponse && resData.responseText) {
        speakText(resData.responseText);
      }

    } catch (err: any) {
      console.error(err);
      const errMsg = `عذرًا، حدث خطأ أثناء تنفيذ الأمر الإداري: ${err.message || "خطأ اتصال"}`;
      setAiResponse(errMsg);
      if (autoSpeakResponse) {
        speakText(errMsg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteAICommand = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeCommandDirectly(userCommand);
  };

  return (
    <div className="space-y-6" id="ai_dashboard_tab_parent">
      
      {/* Intro Header */}
      <div className="glass border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden" id="ai_dashboard_header">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="space-y-1.5 text-right relative z-10">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="p-1 px-2.5 bg-indigo-500/10 text-indigo-400 text-[10px] rounded-lg font-black border border-indigo-500/20 uppercase tracking-widest">إدارة متطورة</span>
          </div>
          <h2 className="text-xl font-black text-white flex items-center gap-1.5">
            <Cpu size={19} className="text-indigo-400" />
            <span>لوحة تفويض وذكاء النظام AI Control Dashboard</span>
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
            هنا يمكنك تفعيل نموذج المدير التنفيذي وتفويض الصلاحيات الكاملة للذكاء الاصطناعي للتحكم بمظهر التطبيق، وتنسيق كشوف الحسابات ومراجعتها آلياً وتعديل الأيقونات دون الحاجة لتدخلك البرمجي المباشر.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="ai_content_grid">
        
        {/* RIGHT BOX: Delegations Settings (4 Slots) */}
        <div className="lg:col-span-4 glass border border-white/10 rounded-3xl p-6 shadow-xl space-y-6" id="ai_delegations_config">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <Settings size={16} className="text-indigo-400" />
            <span className="text-xs font-black text-white">وثيقة تفويض صلاحيات المدير</span>
          </div>

          {/* Master mode Switch */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white">تفويض المدير التنفيذي الذكي</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={executiveMode}
                  onChange={(e) => setExecutiveMode(e.target.checked)}
                />
                <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              عند إيقاف هذا الخيار، سيتم سحب الصلاحيات من محرك الـ AI بالكامل وتحويل التطبيق للوضع اليدوي التقليدي.
            </p>
          </div>

          {/* Individual toggles */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">بنود وصلاحيات التفويض الفردية:</span>
            
            {/* 1. Theme Control */}
            <div className="flex items-start justify-between p-3.5 bg-white/5 rounded-xl border border-white/10">
              <div className="text-right ml-2 space-y-0.5">
                <span className="text-xs font-black text-white block">إدارة وتعديل السمة والمطهر</span>
                <span className="text-[9px] text-slate-500 block">يسمح لـ AI باختيار ألوان النوافذ، الأيقونات وشحنة الانحدار المرئي.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  disabled={!executiveMode}
                  checked={delegateTheme}
                  onChange={(e) => setDelegateTheme(e.target.checked)}
                />
                <div className="w-8 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* 2. Data Optimization */}
            <div className="flex items-start justify-between p-3.5 bg-white/5 rounded-xl border border-white/10">
              <div className="text-right ml-2 space-y-0.5">
                <span className="text-xs font-black text-white block">تنظيف وحراسة الحسابات والجداول</span>
                <span className="text-[9px] text-slate-500 block">يسمح لـ AI بإعادة تنسيق القيود وتصحيح الحقول والمخرجات آلياً لسلامة الكشوفات.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  disabled={!executiveMode}
                  checked={delegateData}
                  onChange={(e) => setDelegateData(e.target.checked)}
                />
                <div className="w-8 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* 3. Safety Limits & Constraints */}
            <div className="flex items-start justify-between p-3.5 bg-white/5 rounded-xl border border-white/10">
              <div className="text-right ml-2 space-y-0.5">
                <span className="text-xs font-black text-white block">ضبط القيود الائتمانية والعملات</span>
                <span className="text-[9px] text-slate-500 block">يسمح لـ AI بتقنين سقف ائتماني و تجميد العملاء المتخلفين عن السداد تلقائياً.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  disabled={!executiveMode}
                  checked={delegateConstraints}
                  onChange={(e) => setDelegateConstraints(e.target.checked)}
                />
                <div className="w-8 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-3 text-right text-amber-400 font-medium">
            <ShieldAlert size={18} className="shrink-0 mt-0.5" />
            <span className="text-[10px] leading-relaxed">
              انتبه: التعديل الذي يقوم به المدير التنفيذي للذكاء الاصطناعي يسري مفعوله فورياً على التخزين المحلي والنسخ الاحتياطي في حال تشغيل بوابة المزامنة الجوية.
            </span>
          </div>
        </div>

        {/* LEFT BOX: Interactive Command Center Prompt (8 slots) */}
        <div className="lg:col-span-8 glass border border-white/10 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col relative overflow-hidden" id="ai_command_panel">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -ml-20 -mb-20"></div>
          <div className="flex items-center gap-2 pb-2 border-b border-white/10 justify-between relative z-10">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              <span className="text-xs font-black text-white">بوابة التوجيهات والأوامر التنفيذية الفورية والتحكم الصوتي</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
              Gemini 3.5 Flash
            </span>
          </div>

          {/* Voice AI Control Panel */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl flex items-center justify-center transition-colors ${isListening ? "bg-rose-500/10 text-rose-500 animate-pulse" : "bg-indigo-500/10 text-indigo-400"}`}>
                  {isListening ? <Mic size={18} className="animate-bounce" /> : <Mic size={18} />}
                </div>
                <div className="text-right">
                  <h4 className="text-xs font-black text-white">التحكم الصوتي بالذكاء الاصطناعي (Voice AI)</h4>
                  <p className="text-[10px] text-slate-400 font-bold">تحدث للأمر أو استمع للإجابة لحظياً بالكامل</p>
                </div>
              </div>

              {/* Toggles for speech functionality */}
              <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setAutoSpeakResponse(!autoSpeakResponse)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all flex items-center gap-1.5 cursor-pointer ${
                    autoSpeakResponse 
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" 
                      : "bg-white/5 border-white/10 text-slate-400"
                  }`}
                  title="نطق الإجابة تلقائياً بعد المعالجة"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${autoSpeakResponse ? "bg-emerald-400 animate-ping" : "bg-slate-400"}`} />
                  <span>نطق تلقائي: {autoSpeakResponse ? "نشط" : "ملغى"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsContinuousVoiceMode(!isContinuousVoiceMode)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isContinuousVoiceMode 
                      ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" 
                      : "bg-white/5 border-white/10 text-slate-400"
                  }`}
                  title="الاستماع المستمر بعد الانتهاء من الإجابة لتجربة حوارية ذكية ومتكاملة بدون لمس الهاتف"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isContinuousVoiceMode ? "bg-indigo-400 animate-ping" : "bg-slate-400"}`} />
                  <span>حوار مستمر: {isContinuousVoiceMode ? "نشط" : "ملغى"}</span>
                </button>
              </div>
            </div>

            {/* Core Interactive Mic Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={toggleListening}
                className={`w-full sm:w-auto px-4 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isListening 
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 scale-[0.98]" 
                    : "bg-indigo-650 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-650/20"
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff size={15} />
                    <span>إيقاف الاستماع</span>
                  </>
                ) : (
                  <>
                    <Mic size={15} />
                    <span>اضغط للتحدث باللغة العربية 🎙</span>
                  </>
                )}
              </button>

              {/* Status or instruction text */}
              <div className="flex-1 text-right">
                {isListening ? (
                  <div className="flex items-center justify-start sm:justify-end gap-2 text-rose-400">
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                    </span>
                    <span className="text-[11px] font-black">جاري الاستماع الآن... قل طلبك بوضوح</span>
                    {/* Simulated visual audio waves */}
                    <div className="flex items-center gap-0.5 h-3">
                      <div className="w-0.5 h-full bg-rose-400 rounded-full animate-pulse [animation-duration:0.3s]"></div>
                      <div className="w-0.5 h-1/2 bg-rose-400 rounded-full animate-pulse [animation-duration:0.5s]"></div>
                      <div className="w-0.5 h-3/4 bg-rose-400 rounded-full animate-pulse [animation-duration:0.4s]"></div>
                      <div className="w-0.5 h-1/3 bg-rose-400 rounded-full animate-pulse [animation-duration:0.6s]"></div>
                    </div>
                  </div>
                ) : speechError ? (
                  <span className="text-[10px] text-rose-500 font-extrabold">{speechError}</span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold block">
                    {isContinuousVoiceMode ? "الاستماع التلقائي نشط. سيبدأ عند فراغ الذكاء من الكلام." : "يمكنك طلب تعديل ألوان السمة، فرز القيود، أو الاستفسار مباشرة بصوتك."}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Prompt text area Form */}
          <form onSubmit={handleExecuteAICommand} className="space-y-4 relative z-10">
            <div className="relative group">
              <textarea
                disabled={!executiveMode || isProcessing}
                value={userCommand}
                onChange={(e) => setUserCommand(e.target.value)}
                placeholder="اكتب توجيهاتك هنا... (مثال: 'اجعل المظهر باللون الذهبي الدافئ' أو 'أريد تعديل أسماء الحسابات لتزيل المسافات المكررة')"
                className="w-full h-28 bg-white/5 border border-white/10 rounded-2xl p-4 pr-4 pl-12 text-xs text-right text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none leading-relaxed transition-all"
              ></textarea>
              <button
                type="submit"
                disabled={!executiveMode || isProcessing || !userCommand.trim()}
                className="absolute left-3.5 bottom-4 p-2.5 bg-indigo-600 hover:bg-indigo-700 transition-all text-white rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                title="إرسال التوجيه للتنفيذ"
              >
                {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </form>

          {/* AI Response Display Block */}
          <div className="flex-1 flex flex-col justify-start rounded-2xl bg-indigo-500/5 border border-white/5 p-5 space-y-4 relative z-10" id="ai_response_box">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <Cpu size={14} className="text-indigo-400 shrink-0" />
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                  بروتوكول واستجابة الاستشارة الذكية (Executive Decision Output):
                </span>
              </div>

              {/* Voice play/stop controller on response */}
              {aiResponse && !isProcessing && (
                <div className="flex items-center gap-1.5">
                  {isPlayingSpeech ? (
                    <button
                      type="button"
                      onClick={stopSpeaking}
                      className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-[9px] font-black text-rose-400 transition-all cursor-pointer"
                      title="إيقاف قراءة الرد"
                    >
                      <VolumeX size={11} />
                      <span>إيقاف الصوت</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => speakText(aiResponse)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-[9px] font-black text-indigo-400 transition-all cursor-pointer"
                      title="قراءة الرد بصوت عالٍ"
                    >
                      <Volume2 size={11} />
                      <span>قراءة صوتية 🔊</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3 text-slate-500" id="ai_processing_output">
                <Loader2 size={24} className="animate-spin text-indigo-500" />
                <span className="text-[11px] font-black animate-pulse">جاري الاستدعاء ومزامنة التغييرات وحفظ الجداول...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {aiResponse && (
                  <p className="text-xs text-slate-300 leading-relaxed text-right font-medium">
                    {aiResponse}
                  </p>
                )}
                {statusMessage && (
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                    <CheckCircle size={12} />
                    <span>{statusMessage}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick recommendations / templates */}
          <div className="space-y-2.5" id="ai_quick_pills">
            <div className="flex items-center gap-1.5">
              <HelpCircle size={13} className="text-slate-450" />
              <span className="text-[10px] font-extrabold text-slate-400 block">أوامر وتوجيهات مقترحة للتجربة الحرة:</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {sampleCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={!executiveMode || isProcessing}
                  onClick={() => setUserCommand(cmd)}
                  className="p-3 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-[10px] leading-relaxed text-right font-bold transition-all border border-white/10 max-h-16 overflow-hidden cursor-pointer select-none"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
      
      {/* Sales Pattern Analyzer Component */}
      <SalesPatternAnalyzer db={db} />

    </div>
  );
}
