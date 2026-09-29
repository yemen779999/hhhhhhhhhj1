/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  FileSpreadsheet, 
  FileText, 
  Image as ImageIcon, 
  UploadCloud, 
  Smartphone, 
  Monitor, 
  Database as DbIcon, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Trash2, 
  HelpCircle,
  Sparkles,
  SmartphoneIcon,
  LogOut,
  LogIn,
  Camera,
  Plus,
  SlidersHorizontal,
  ShieldCheck,
  Calendar,
  Layers,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Scale,
  Coins,
  CheckCircle2,
  Save,
  RotateCcw,
  Bookmark,
  Users,
  Briefcase,
  Hash,
  Tag,
  Calculator,
  Eye,
  Info,
  PlusCircle,
  Copy,
  Edit2,
  ArrowUpDown,
  TrendingUp,
  Wallet
} from "lucide-react";
import { Database } from "../utils";
import { Account, Transaction, DailyLedgerEntry, DocumentAnalysisResult, InvoiceRecord } from "../types";
import { auth, googleSignIn, logout, getAccessToken, firestore } from "../auth";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { DocumentReviewPreview } from "./DocumentReviewPreview";

interface SyncImportTabProps {
  db: Database;
  onDatabaseUpdate: () => void;
  role: string;
}

interface StructuredPreviewRow {
  id: string;
  accountName: string;
  accountType: "supplier" | "buyer";
  date: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extraCharges: number;
  total: number;
  currency: string;
  isEdited?: boolean;
  matchConfidence?: "high" | "medium" | "low";
  isVerified?: boolean;
}

export interface CalculatedPreviewRow extends StructuredPreviewRow {
  calculatedTotal: number;
  runningBalance: number;
  cumulativeTotal: number;
}

interface ColumnMapping {
  accountName: string;
  accountType: string;
  date: string;
  description: string;
  quantity: string;
  unitPrice: string;
  extraCharges: string;
  total: string;
  currency: string;
}

export interface SavedMappingPreset {
  id: string;
  name: string;
  mapping: ColumnMapping;
  headers: string[];
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

const SAVED_MAPPINGS_KEY = "smartacc_saved_column_mappings";

const getStoredPresets = (): SavedMappingPreset[] => {
  try {
    const raw = localStorage.getItem(SAVED_MAPPINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredPresets = (presets: SavedMappingPreset[]) => {
  try {
    localStorage.setItem(SAVED_MAPPINGS_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error("Error saving presets to localStorage", err);
  }
};

const findMatchingPreset = (headers: string[], presets: SavedMappingPreset[]): { preset: SavedMappingPreset; matchCount: number } | null => {
  if (!presets || presets.length === 0 || !headers || headers.length === 0) return null;

  let bestMatch: { preset: SavedMappingPreset; matchCount: number } | null = null;

  for (const preset of presets) {
    const mappedCols = Object.values(preset.mapping).filter(col => typeof col === "string" && col.trim() !== "");
    if (mappedCols.length === 0) continue;

    const matchedCols = mappedCols.filter(col => headers.includes(col));
    const matchCount = matchedCols.length;
    const headerOverlap = preset.headers ? preset.headers.filter(h => headers.includes(h)).length : 0;

    if (matchCount >= 2 && (matchCount / mappedCols.length >= 0.4 || headerOverlap >= 3)) {
      if (!bestMatch || matchCount > bestMatch.matchCount) {
        bestMatch = { preset, matchCount };
      }
    }
  }

  if (!bestMatch) {
    const defaultPreset = presets.find(p => p.isDefault);
    if (defaultPreset) {
      const mappedCols = Object.values(defaultPreset.mapping).filter(col => typeof col === "string" && col.trim() !== "");
      const matched = mappedCols.filter(c => headers.includes(c));
      if (matched.length >= 2) {
        bestMatch = { preset: defaultPreset, matchCount: matched.length };
      }
    }
  }

  return bestMatch;
};

const SYSTEM_FIELDS_META: {
  key: keyof ColumnMapping;
  label: string;
  badge: "إلزامي" | "اختياري" | "محسوب";
  badgeColor: string;
  description: string;
  accountingRule: string;
  fallbackHint: string;
  iconType: "users" | "briefcase" | "calendar" | "fileText" | "hash" | "tag" | "plusCircle" | "calculator" | "coins";
}[] = [
  {
    key: "accountName",
    label: "اسم الحساب (العميل / المورد)",
    badge: "إلزامي",
    badgeColor: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    description: "اسم الطرف المالي المرتبط بالقيد في كشف الحسابات",
    accountingRule: "إذا تُرك فارغاً يُسند القيد للحساب المستهدف المحدد في بوابة الاستيراد",
    fallbackHint: "(تلقائي من الحساب المحدد)",
    iconType: "users"
  },
  {
    key: "accountType",
    label: "نوع الحساب (مورد / عميل)",
    badge: "اختياري",
    badgeColor: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    description: "تصنيف طبيعة الحساب كمدين (عميل) أو دائن (مورد)",
    accountingRule: "الافتراضي عميل، ويتم التعرف تلقائياً على نصوص 'مورد' أو 'supplier'",
    fallbackHint: "(افتراضي: عميل)",
    iconType: "briefcase"
  },
  {
    key: "date",
    label: "تاريخ القيد / الحركة",
    badge: "اختياري",
    badgeColor: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    description: "تاريخ نشوء المعاملة المالية أو الفاتورة",
    accountingRule: "يدعم صيغ التواريخ المختلفة، وافتراضياً يُسجل بتاريخ اليوم الحالي",
    fallbackHint: "(تاريخ اليوم الحالي)",
    iconType: "calendar"
  },
  {
    key: "description",
    label: "البيان / تفاصيل القيد",
    badge: "اختياري",
    badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
    description: "شرح الحركة أو الصنف أو تفاصيل السند الدفتري",
    accountingRule: "إذا كان فارغاً يُدرج بيان تلقائي 'قيد مستورد من Excel'",
    fallbackHint: "(قيد مستورد من Excel)",
    iconType: "fileText"
  },
  {
    key: "quantity",
    label: "الكمية / العدد",
    badge: "اختياري",
    badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
    description: "عدد الوحدات المباعة أو المشتراة",
    accountingRule: "إذا لم يُحدد عمود للكمية يُفترض تلقائياً (1)",
    fallbackHint: "(افتراضي: 1)",
    iconType: "hash"
  },
  {
    key: "unitPrice",
    label: "سعر الوحدة",
    badge: "اختياري",
    badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
    description: "سعر المفرد للوحدة الواحدة",
    accountingRule: "يُستخدم لحساب الإجمالي إذا لم يكن الإجمالي مسجلاً صراحة في الملف",
    fallbackHint: "(افتراضي: 0)",
    iconType: "tag"
  },
  {
    key: "extraCharges",
    label: "المصاريف والزيادات",
    badge: "اختياري",
    badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
    description: "تكاليف إضافية (أجور نقل، ضرائب، رسوم إضافية)",
    accountingRule: "تُضاف إلى ناتج (الكمية × السعر) عند الاحتساب التلقائي",
    fallbackHint: "(افتراضي: 0)",
    iconType: "plusCircle"
  },
  {
    key: "total",
    label: "المبلغ الإجمالي للقيد",
    badge: "محسوب",
    badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    description: "المبلغ المالي المؤثر على رصيد الحساب",
    accountingRule: "إذا تُرك فارغاً يُحسب تلقائياً: (الكمية × سعر الوحدة) + المصاريف",
    fallbackHint: "(الكمية × السعر + المصاريف)",
    iconType: "calculator"
  },
  {
    key: "currency",
    label: "العملة",
    badge: "اختياري",
    badgeColor: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    description: "رمز العملة (YER, SAR, USD, EUR)",
    accountingRule: "الافتراضي عملة الحساب المستهدف المحدد أو الريال اليمني YER",
    fallbackHint: "(عملة الحساب المحدد)",
    iconType: "coins"
  }
];

export default function SyncImportTab({ db, onDatabaseUpdate, role }: SyncImportTabProps) {
  // Navigation / Active Portal Section
  const [activePortalSection, setActivePortalSection] = useState<"structured" | "ai_vision" | "cloud_sync">("structured");
  const [structuredType, setStructuredType] = useState<"excel" | "pdf">("excel");

  // Auth & Cloud Sync States
  const [user, setUser] = useState<User | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [isSimulatingAndroid, setIsSimulatingAndroid] = useState(false);

  // Exclude Windows / Web from auto cloud sync
  const [excludeWindowsSync, setExcludeWindowsSync] = useState(() => {
    return localStorage.getItem("smartacc_exclude_windows_sync") === "true";
  });

  // Google Cloud backups state
  const [googleBackupList, setGoogleBackupList] = useState<{ id: string; name: string; date: string; size: string; data?: any; driveFileId?: string }[]>(() => {
    const saved = localStorage.getItem("smartacc_google_backups");
    return saved ? JSON.parse(saved) : [
      { id: "backup_g_1", name: "نسخة سحابية مرجعية تلقائية", date: "2026-06-16 12:45", size: "110 KB" }
    ];
  });
  const [isDriveBackingUp, setIsDriveBackingUp] = useState(false);
  const [googleBackupSuccess, setGoogleBackupSuccess] = useState(false);

  // Structured File Import (Excel / PDF) States
  const [rawSheetRows, setRawSheetRows] = useState<any[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    accountName: "",
    accountType: "",
    date: "",
    description: "",
    quantity: "",
    unitPrice: "",
    extraCharges: "",
    total: "",
    currency: ""
  });
  const [showMappingConfig, setShowMappingConfig] = useState(true);
  const [savedPresets, setSavedPresets] = useState<SavedMappingPreset[]>(getStoredPresets);
  const [activePresetId, setActivePresetId] = useState<string>("auto");
  const [mappingNotification, setMappingNotification] = useState<{
    type: "saved" | "auto" | "updated";
    message: string;
  } | null>(null);
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [customPresetName, setCustomPresetName] = useState("");
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<StructuredPreviewRow[]>([]);
  const [editingModalRow, setEditingModalRow] = useState<StructuredPreviewRow | null>(null);
  const [importedFileName, setImportedFileName] = useState<string>("");

  // Loading & Multi-stage AI States
  const [importLoading, setImportLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [loadingDetail, setLoadingDetail] = useState<string>("");
  const [progressPhase, setProgressPhase] = useState<"idle" | "reading" | "analyzing" | "validating" | "ready" | "error">("idle");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Target Account & Currency Validation States
  const [targetAccountId, setTargetAccountId] = useState<string>("auto");
  const [currencyConflict, setCurrencyConflict] = useState<{
    detected: boolean;
    docCurrencies: string[];
    accountCurrency: string;
    accountName: string;
    mismatchedRowCount: number;
    totalRows: number;
  } | null>(null);
  const [currencyMismatchAcknowledged, setCurrencyMismatchAcknowledged] = useState<boolean>(false);
  const [showCurrencyConfirmModal, setShowCurrencyConfirmModal] = useState<boolean>(false);

  // AI Document Analysis States
  const [analyzedFile, setAnalyzedFile] = useState<{ name: string; url: string; type: string } | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisResult | undefined>(undefined);

  // File Input Refs
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const cameraFileInputRef = useRef<HTMLInputElement>(null);

  // Track Firebase Authenticated User
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        addLog(`تم التحقق من هوية المستخدم: ${currentUser.displayName || currentUser.email}`);
        const savedSync = localStorage.getItem(`smartacc_sync_enabled_${currentUser.uid}`) === "true";
        if (savedSync) {
          setSyncEnabled(true);
        }
      } else {
        setSyncEnabled(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Log Helper
  const addLog = (message: string) => {
    const timeStr = new Date().toLocaleTimeString("ar-SA", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSyncLogs(prev => [`[${timeStr}] ${message}`, ...prev.slice(0, 49)]);
  };

  // Firestore Real-time Synchronization Loop
  useEffect(() => {
    if (!user || !syncEnabled) return;

    setSyncStatus("syncing");
    addLog("جاري الاتصال بقاعدة بيانات Cloud Firestore السحابية للمزامنة...");

    const docRef = doc(firestore, "user_databases", user.uid);

    const initSync = async () => {
      if (!navigator.onLine) {
        addLog("العميل حالياً غير متصل بالإنترنت. سيتم تفعيل المزامنة التلقائية بمجرد عودة الاتصال.");
        return;
      }
      try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          addLog("لم يتم العثور على قاعدة بيانات سحابية سابقة. رفع البيانات المحلية الحالية...");
          await setDoc(docRef, {
            accounts: db.accounts,
            transactions: db.transactions,
            dailyEntries: db.dailyEntries,
            lastUpdated: new Date().toISOString(),
            updatedBy: "Web Client"
          });
          addLog("تم رفع البيانات المحلية وتأمينها بنجاح!");
        }
      } catch (e: any) {
        const errMsg = String(e?.message || e || "").toLowerCase();
        if (errMsg.includes('offline') || errMsg.includes('network') || errMsg.includes('failed to get document') || errMsg.includes('unavailable') || !navigator.onLine) {
          addLog("تنبيه: أنت تعمل حالياً دون اتصال بالإنترنت. سيتم حفظ التغييرات محلياً.");
        } else {
          console.error("Firestore init error", e);
          addLog(`خطأ في تهيئة الارتباط: ${e.message || "صلاحيات غير كافية"}`);
        }
      }
    };
    initSync();

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const remoteData = snapshot.data();
        addLog(`إشارة مزامنة واردة من المصدر: ${remoteData.updatedBy || "جهاز آخر"}`);
        setSyncStatus("success");
      }
    }, (error) => {
      console.warn("Firestore onSnapshot:", error);
      setSyncStatus("error");
    });

    return () => unsubscribe();
  }, [user, syncEnabled]);

  const toggleSync = (enable: boolean) => {
    setSyncEnabled(enable);
    if (user) {
      localStorage.setItem(`smartacc_sync_enabled_${user.uid}`, enable ? "true" : "false");
    }
    if (enable) {
      addLog("تم تفعيل خدمة المزامنة السحابية الميدانية.");
    } else {
      addLog("تم إيقاف المزامنة السحابية.");
      setSyncStatus("idle");
    }
  };

  const toggleExcludeWindowsSync = (exclude: boolean) => {
    setExcludeWindowsSync(exclude);
    localStorage.setItem("smartacc_exclude_windows_sync", exclude ? "true" : "false");
    if (exclude) {
      addLog("تم استثناء جهاز الويندوز الحالي من المزامنة الفورية.");
    } else {
      addLog("تم تضمين جهاز الويندوز في شبكة المزامنة السحابية.");
    }
  };

  const pushLocalDataToCloud = async () => {
    if (!user || !syncEnabled) return;
    setSyncStatus("syncing");
    addLog("جاري رفع التعديلات المحاسبية المحلية إلى سحابة Firestore...");
    try {
      const docRef = doc(firestore, "user_databases", user.uid);
      await setDoc(docRef, {
        accounts: db.accounts,
        transactions: db.transactions,
        dailyEntries: db.dailyEntries,
        lastUpdated: new Date().toISOString(),
        updatedBy: "Web Client"
      }, { merge: true });
      setSyncStatus("success");
      addLog("تمت مزامنة ورفع البيانات بنجاح إلى السحابة.");
    } catch (e: any) {
      setSyncStatus("error");
      addLog(`خطأ في الرفع: ${e.message}`);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setErrorMessage(null);
      await googleSignIn();
      addLog("تم تسجيل الدخول بنجاح عبر حساب Google.");
    } catch (e: any) {
      setErrorMessage(`تعذر تسجيل الدخول بـ Google: ${e.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setSyncEnabled(false);
      addLog("تم تسجيل الخروج بنجاح.");
    } catch (e: any) {
      setErrorMessage(`خطأ أثناء تسجيل الخروج: ${e.message}`);
    }
  };

  // Download official Excel template
  const downloadExcelTemplate = () => {
    try {
      const accountsData = [
        {
          "اسم الحساب": "مؤسسة الأمل لمواد البناء",
          "نوع الحساب": "مورد",
          "التاريخ": new Date().toISOString().split("T")[0],
          "البيان": "رصيد افتتاحي وتوريد مواد",
          "الكمية": 10,
          "سعر الوحدة": 45000,
          "الزيادات": 0,
          "الإجمالي": 450000,
          "العملة": "YER"
        },
        {
          "اسم الحساب": "شركة أنس للتوريدات الذكية",
          "نوع الحساب": "مورد",
          "التاريخ": new Date().toISOString().split("T")[0],
          "البيان": "شراء حزمة مستلزمات مكتبية",
          "الكمية": 5,
          "سعر الوحدة": 12000,
          "الزيادات": 1500,
          "الإجمالي": 61500,
          "العملة": "YER"
        },
        {
          "اسم الحساب": "العميل علي أحمد صالح",
          "نوع الحساب": "عميل",
          "التاريخ": new Date().toISOString().split("T")[0],
          "البيان": "مبيعات بضاعة بالأجل",
          "الكمية": 25,
          "سعر الوحدة": 6000,
          "الزيادات": 0,
          "الإجمالي": 150000,
          "العملة": "YER"
        }
      ];

      const ws = XLSX.utils.json_to_sheet(accountsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "القيود والحسابات");
      XLSX.writeFile(wb, "نموذج_استيراد_نظام_أنس_المحاسبي.xlsx");
      setSuccessMessage("تم تنزيل نموذج Excel المعتمد بنجاح.");
    } catch (err: any) {
      setErrorMessage("فشل إنشاء ملف النموذج: " + err.message);
    }
  };

  // -------------------------------------------------------------
  // ASYNC FILE HELPERS & SAFE NUMERICAL UTILITIES
  // -------------------------------------------------------------

  const readFileAsArrayBufferPromise = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error("تعذر قراءة بايتات الملف كمصفوفة ثنائية."));
        }
      };
      reader.onerror = () => reject(new Error("فشلت قراءة الملف من الجهاز."));
      reader.readAsArrayBuffer(file);
    });
  };

  const readFileAsBase64Promise = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (!result) {
          reject(new Error("الملف فارغ أو تعذر تحويله إلى Base64."));
          return;
        }
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("تعذر قراءة الملف وترميزه."));
      reader.readAsDataURL(file);
    });
  };

  const parseAccountingNumber = (val: any, fallback = 0): number => {
    if (val === null || val === undefined || val === "") return fallback;
    if (typeof val === "number") return isNaN(val) ? fallback : val;
    let str = String(val).trim();
    // Convert Arabic-Indic digits ٠-٩ to 0-9
    str = str.replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    // Convert Eastern Persian digits ۰-۹ to 0-9
    str = str.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
    // Handle accounting parentheses (500) -> -500
    if (str.startsWith("(") && str.endsWith(")")) {
      str = "-" + str.slice(1, -1);
    }
    // Strip commas, spaces, currency symbols
    str = str.replace(/[,،\sYERUSDSAREURريالدرهم$]/gi, "").trim();
    const num = parseFloat(str);
    return isNaN(num) ? fallback : num;
  };

  // -------------------------------------------------------------
  // STRUCTURED FILE IMPORT (EXCEL & PDF)
  // -------------------------------------------------------------

  // Auto detect columns from Excel
  const detectColumnMapping = (headers: string[]): ColumnMapping => {
    const findMatch = (patterns: RegExp[]): string => {
      for (const p of patterns) {
        const found = headers.find(h => p.test(h.trim().toLowerCase()));
        if (found) return found;
      }
      return "";
    };

    return {
      accountName: findMatch([/اسم\s*الحساب/, /العميل/, /المورد/, /^الاسم$/, /الحساب/, /الطرف/, /الجهة/, /account/, /customer/, /supplier/, /client/, /name/, /entity/]),
      accountType: findMatch([/نوع\s*الحساب/, /^النوع$/, /تصنيف/, /الفئة/, /type/, /category/]),
      date: findMatch([/^التاريخ$/, /تاريخ\s*القيد/, /تاريخ\s*الحركة/, /تاريخ/, /يوم/, /date/, /day/]),
      description: findMatch([/^البيان$/, /الوصف/, /تفاصيل/, /شرح/, /بيان\s*الحركة/, /الصنف/, /desc/, /description/, /item/, /details/]),
      quantity: findMatch([/^الكمية$/, /الكميه/, /العدد/, /عدد/, /qty/, /quantity/, /count/]),
      unitPrice: findMatch([/^السعر$/, /سعر\s*الوحدة/, /سعر\s*المفرد/, /سعر/, /price/, /rate/, /unit/]),
      extraCharges: findMatch([/الزيادات/, /مصاريف/, /رسوم/, /إضافي/, /اضافي/, /extra/, /charge/, /tax/]),
      total: findMatch([/^الإجمالي$/, /^الاجمالي$/, /^المبلغ$/, /^القيمة$/, /^صافي$/, /^مدين$/, /^دائن$/, /^له$/, /^عليه$/, /total/, /amount/, /net/]),
      currency: findMatch([/^العملة$/, /^عملة$/, /الرمز/, /currency/, /curr/])
    };
  };

  // Check currency conflict against selected account or database accounts
  const checkCurrencyConflict = (rows: StructuredPreviewRow[], targetAccId: string) => {
    if (rows.length === 0) return null;

    if (targetAccId !== "auto") {
      const selectedAcc = db.accounts.find(a => a.id === targetAccId);
      if (selectedAcc && selectedAcc.currency) {
        const accCurrency = selectedAcc.currency.toUpperCase();
        const mismatched = rows.filter(r => (r.currency || "YER").toUpperCase() !== accCurrency);
        if (mismatched.length > 0) {
          const docCurrs = Array.from(new Set(mismatched.map(r => r.currency || "YER")));
          return {
            detected: true,
            docCurrencies: docCurrs,
            accountCurrency: selectedAcc.currency,
            accountName: selectedAcc.name,
            mismatchedRowCount: mismatched.length,
            totalRows: rows.length
          };
        }
      }
    } else {
      // Multi-account auto mode: check against existing accounts in DB
      const mismatchedRows: StructuredPreviewRow[] = [];
      let conflictAccName = "";
      let conflictCurrency = "";
      const docCurrs = new Set<string>();

      for (const row of rows) {
        const existing = db.accounts.find(a => a.name.trim().toLowerCase() === row.accountName.trim().toLowerCase());
        if (existing && existing.currency) {
          const existingCurr = existing.currency.toUpperCase();
          const rowCurr = (row.currency || "YER").toUpperCase();
          if (rowCurr !== existingCurr) {
            mismatchedRows.push(row);
            if (!conflictAccName) conflictAccName = existing.name;
            if (!conflictCurrency) conflictCurrency = existing.currency;
            docCurrs.add(row.currency || "YER");
          }
        }
      }

      if (mismatchedRows.length > 0) {
        return {
          detected: true,
          docCurrencies: Array.from(docCurrs),
          accountCurrency: conflictCurrency || "YER",
          accountName: conflictAccName || "الحسابات المسجلة",
          mismatchedRowCount: mismatchedRows.length,
          totalRows: rows.length
        };
      }
    }
    return null;
  };

  const validateCurrencies = (rows: StructuredPreviewRow[], targetAccId: string) => {
    const conflict = checkCurrencyConflict(rows, targetAccId);
    setCurrencyConflict(conflict);
    if (!conflict) {
      setCurrencyMismatchAcknowledged(false);
    }
  };

  const isRowCurrencyMismatched = (row: StructuredPreviewRow) => {
    if (targetAccountId !== "auto") {
      const acc = db.accounts.find(a => a.id === targetAccountId);
      if (acc && acc.currency) {
        return (row.currency || "YER").toUpperCase() !== acc.currency.toUpperCase();
      }
    } else {
      const existing = db.accounts.find(a => a.name.trim().toLowerCase() === row.accountName.trim().toLowerCase());
      if (existing && existing.currency) {
        return (row.currency || "YER").toUpperCase() !== existing.currency.toUpperCase();
      }
    }
    return false;
  };

  const handleUnifyCurrency = (unifiedCurrency: string) => {
    setPreviewRows(prev => prev.map(r => ({ ...r, currency: unifiedCurrency })));
    if (analysisResult) {
      setAnalysisResult(prev => prev ? {
        ...prev,
        extractedData: {
          ...prev.extractedData,
          currency: unifiedCurrency
        }
      } : undefined);
    }
    setCurrencyConflict(null);
    setCurrencyMismatchAcknowledged(true);
    setShowCurrencyConfirmModal(false);
    setSuccessMessage(`تم توحيد العملة لكافة القيود إلى (${unifiedCurrency}) بنجاح.`);
  };

  const handleAcknowledgeCurrencyMismatch = () => {
    setCurrencyMismatchAcknowledged(true);
    setShowCurrencyConfirmModal(false);
    setSuccessMessage("تم تأكيد الاستيراد بالعملات الأصلية للمستند.");
  };

  // Build preview rows from raw rows and active mapping
  const buildPreviewRows = (rows: any[], mapping: ColumnMapping): StructuredPreviewRow[] => {
    const selectedAcc = targetAccountId !== "auto" ? db.accounts.find(a => a.id === targetAccountId) : undefined;

    return rows.map((row, index) => {
      const getVal = (col: string, fallback: any = "") => (col && row[col] !== undefined && row[col] !== null) ? row[col] : fallback;

      const rawType = String(getVal(mapping.accountType, selectedAcc?.type || "buyer")).toLowerCase();
      const accountType: "supplier" | "buyer" = (rawType.includes("مورد") || rawType.includes("supplier")) ? "supplier" : "buyer";

      const qty = parseAccountingNumber(getVal(mapping.quantity, 1), 1);
      const price = parseAccountingNumber(getVal(mapping.unitPrice, 0), 0);
      const extra = parseAccountingNumber(getVal(mapping.extraCharges, 0), 0);
      
      let tot = parseAccountingNumber(getVal(mapping.total, 0), 0);
      if (tot === 0 && (qty * price > 0)) {
        tot = (qty * price) + extra;
      }

      let dateVal = String(getVal(mapping.date, new Date().toISOString().split("T")[0])).trim();
      // Handle Excel numerical date serialization if any
      if (/^\d{5}$/.test(dateVal)) {
        const parsedDate = new Date((parseInt(dateVal) - (25567 + 2)) * 86400 * 1000);
        if (!isNaN(parsedDate.getTime())) {
          dateVal = parsedDate.toISOString().split("T")[0];
        }
      } else if (dateVal.includes("/")) {
        const parts = dateVal.split(/[/ -]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            dateVal = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
          } else if (parts[2].length === 4) {
            dateVal = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }
      }

      const defaultAccName = selectedAcc ? selectedAcc.name : "حساب مستورد";
      const defaultCurr = selectedAcc ? (selectedAcc.currency || "YER") : "YER";
      
      const parsedAccName = String(getVal(mapping.accountName, defaultAccName)).trim() || defaultAccName;
      let confidence: "high" | "medium" | "low" = "low";
      const existingAccount = db.accounts.find(a => a.name.trim().toLowerCase() === parsedAccName.toLowerCase());
      if (existingAccount) {
        confidence = "high";
      } else if (db.accounts.some(a => a.name.includes(parsedAccName) || parsedAccName.includes(a.name))) {
        confidence = "medium";
      }

      return {
        id: `row_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 4)}`,
        accountName: parsedAccName,
        accountType,
        date: dateVal || new Date().toISOString().split("T")[0],
        description: String(getVal(mapping.description, "قيد مستورد")).trim() || "قيد مستورد",
        quantity: qty,
        unitPrice: price,
        extraCharges: extra,
        total: tot,
        currency: String(getVal(mapping.currency, defaultCurr)).trim().toUpperCase() || defaultCurr,
        matchConfidence: confidence,
        isVerified: confidence === "high"
      };
    });
  };

  // Handle Excel file reading using Promise and detailed step progression
  const handleExcelUpload = async (file: File) => {
    try {
      setImportLoading(true);
      setProgressPhase("reading");
      setProgressPercent(20);
      setLoadingStep("جاري قراءة وفحص ملف Excel...");
      setLoadingDetail("التحقق من سلامة الجداول وترميز البيانات المحاسبية");
      setErrorMessage(null);
      setSuccessMessage(null);
      setImportedFileName(file.name);

      const buffer = await readFileAsArrayBufferPromise(file);

      setProgressPhase("analyzing");
      setProgressPercent(55);
      setLoadingStep("جاري استخراج السجلات ومطابقة الأعمدة المحاسبية...");
      setLoadingDetail("فحص كافة الصفحات واكتشاف الحقول الرقمية والبيانات");

      const workbook = XLSX.read(buffer, { type: "array" });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("ملف Excel لا يحتوي على أي صفحات صالحة.");
      }

      // Search for relevant sheet or fallback to first sheet
      let selectedSheet = workbook.Sheets[workbook.SheetNames[0]];
      for (const name of workbook.SheetNames) {
        const lower = name.toLowerCase();
        if (lower.includes("قيد") || lower.includes("حساب") || lower.includes("حركات") || lower.includes("بيانات") || lower.includes("كشف") || lower.includes("journal") || lower.includes("ledger")) {
          selectedSheet = workbook.Sheets[name];
          break;
        }
      }

      const jsonRows = XLSX.utils.sheet_to_json(selectedSheet, { defval: "" }) as any[];
      if (!jsonRows || jsonRows.length === 0) {
        throw new Error("الصفحة المحددة في ملف Excel فارغة تماماً.");
      }

      // Collect all unique column headers across all rows
      const headerSet = new Set<string>();
      jsonRows.forEach(r => {
        Object.keys(r).forEach(k => {
          const trimmed = k.trim();
          if (trimmed && !trimmed.startsWith("__EMPTY")) headerSet.add(trimmed);
        });
      });
      const headers = Array.from(headerSet);

      setAvailableColumns(headers);
      setRawSheetRows(jsonRows);

      // Check if there is a saved preset in localStorage matching these headers!
      const currentPresets = getStoredPresets();
      const matched = findMatchingPreset(headers, currentPresets);

      let finalMapping: ColumnMapping;
      if (matched) {
        // Merge matched preset with smart detection for any missing fields
        const smartFallback = detectColumnMapping(headers);
        finalMapping = { ...smartFallback };
        (Object.keys(matched.preset.mapping) as (keyof ColumnMapping)[]).forEach(k => {
          const colVal = matched.preset.mapping[k];
          if (colVal && headers.includes(colVal)) {
            finalMapping[k] = colVal;
          }
        });
        setActivePresetId(matched.preset.id);
        setMappingNotification({
          type: "saved",
          message: `تم التعرف على بنية الأعمدة وتطبيق التنسيق المحفوظ بالمتصفح (${matched.preset.name}) تلقائياً.`
        });
      } else {
        finalMapping = detectColumnMapping(headers);
        setActivePresetId("auto");
        setMappingNotification({
          type: "auto",
          message: "تم الكشف التلقائي عن الأعمدة. سيتم حفظ أي تعديل تجريه تلقائياً في المتصفح للملفات المشابهة مستقبلاً."
        });
      }

      setColumnMapping(finalMapping);
      setShowMappingConfig(true);

      const rows = buildPreviewRows(jsonRows, finalMapping);
      setPreviewRows(rows);
      setStructuredType("excel");

      // Validation stage
      setProgressPhase("validating");
      setProgressPercent(85);
      setLoadingStep("جاري فحص مطابقة العملات والحسابات...");
      setLoadingDetail("التحقق من تطابق العملات وتفادي أي تضارب محاسبي");

      validateCurrencies(rows, targetAccountId);

      setProgressPhase("ready");
      setProgressPercent(100);
      setLoadingStep("تم استيراد الملف وجاهز للمراجعة");
      setLoadingDetail(`تم تجهيز ${rows.length} سجلاً محاسبياً بنجاح`);

      setSuccessMessage(`تمت قراءة ${rows.length} سجلاً بنجاح من ملف Excel! يمكنك مراجعة وتعديل البيانات أدناه قبل التأكيد النهائي.`);
    } catch (err: any) {
      setProgressPhase("error");
      setErrorMessage(err.message || "فشل تحليل ملف Excel.");
    } finally {
      setImportLoading(false);
    }
  };

  // Handle PDF file reading via backend AI parser using Promise and detailed step progression
  const handlePDFUpload = async (file: File) => {
    try {
      setImportLoading(true);
      setProgressPhase("reading");
      setProgressPercent(20);
      setLoadingStep("جاري قراءة ملف PDF وتجهيز التشفير...");
      setLoadingDetail("استخراج بايتات الملف وترميز Base64 بأمان");
      setErrorMessage(null);
      setSuccessMessage(null);
      setImportedFileName(file.name);

      const base64 = await readFileAsBase64Promise(file);

      setProgressPhase("analyzing");
      setProgressPercent(55);
      setLoadingStep("جاري إرسال المستند للتحليل عبر الذكاء الاصطناعي...");
      setLoadingDetail("استخراج الجداول، التواريخ، البنود، والمبالغ الإجمالية");

      const selectedAcc = targetAccountId !== "auto" ? db.accounts.find(a => a.id === targetAccountId) : undefined;

      const response = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64,
          mimeType: "application/pdf",
          fileName: file.name,
          accountContext: selectedAcc ? {
            name: selectedAcc.name,
            type: selectedAcc.type,
            currency: selectedAcc.currency || "YER",
            openingBalance: selectedAcc.openingBalance || 0
          } : undefined
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "فشل الذكاء الاصطناعي في تحليل مستند الـ PDF.");
      }

      setProgressPhase("validating");
      setProgressPercent(85);
      setLoadingStep("جاري تجهيز جدول القيود والتحقق من العملات...");
      setLoadingDetail("مطابقة العملة المكتشفة مع الحسابات وتفادي التكرار");

      const parsed = resData.data;
      const ext = parsed.extractedData || {};

      const entityName = (selectedAcc ? selectedAcc.name : (ext.customerName || ext.supplierName || ext.companyName || "حساب من مستند PDF")).trim();
      const docDate = ext.issueDate || ext.date || new Date().toISOString().split("T")[0];
      const docCurrency = ext.currency || (selectedAcc ? (selectedAcc.currency || "YER") : "YER");

      const generatedRows: StructuredPreviewRow[] = [];

      // Check if ledger entries were extracted
      if (Array.isArray(ext.ledgerEntries) && ext.ledgerEntries.length > 0) {
        ext.ledgerEntries.forEach((entry: any, idx: number) => {
          const qty = parseAccountingNumber(entry.quantity, 1);
          const unitP = parseAccountingNumber(entry.unitPrice || entry.total, 0);
          const extra = parseAccountingNumber(entry.extraCharges, 0);
          const totalVal = parseAccountingNumber(entry.total, (qty * unitP) + extra);

          generatedRows.push({
            id: `pdf_row_${idx}_${Date.now()}`,
            accountName: entityName,
            accountType: ext.supplierName ? "supplier" : (selectedAcc?.type || "buyer"),
            date: entry.date || docDate,
            description: entry.description || "بند من مستند PDF",
            quantity: qty,
            unitPrice: unitP,
            extraCharges: extra,
            total: totalVal,
            currency: entry.currency || docCurrency
          });
        });
      } 
      // Else check if line items exist
      else if (Array.isArray(ext.items) && ext.items.length > 0) {
        ext.items.forEach((item: any, idx: number) => {
          const qty = parseAccountingNumber(item.quantity, 1);
          const price = parseAccountingNumber(item.unitPrice || (item.total ? item.total / qty : 0), 0);
          const tot = parseAccountingNumber(item.total, qty * price);

          generatedRows.push({
            id: `pdf_item_${idx}_${Date.now()}`,
            accountName: entityName,
            accountType: ext.supplierName ? "supplier" : (selectedAcc?.type || "buyer"),
            date: docDate,
            description: item.description || "صنف من مستند PDF",
            quantity: qty,
            unitPrice: price,
            extraCharges: 0,
            total: tot,
            currency: docCurrency
          });
        });
      } 
      // Fallback single summary row if grand total exists
      else {
        const tot = parseAccountingNumber(ext.grandTotal || ext.totalAmount || ext.subtotal, 0);
        generatedRows.push({
          id: `pdf_summary_${Date.now()}`,
          accountName: entityName,
          accountType: ext.supplierName ? "supplier" : (selectedAcc?.type || "buyer"),
          date: docDate,
          description: `فاتورة / مستند ${parsed.documentType || ""}`.trim() || "مستند PDF مستورد",
          quantity: 1,
          unitPrice: tot,
          extraCharges: parseAccountingNumber(ext.taxAmount, 0),
          total: tot,
          currency: docCurrency
        });
      }

      setPreviewRows(generatedRows);
      setStructuredType("pdf");

      validateCurrencies(generatedRows, targetAccountId);

      setProgressPhase("ready");
      setProgressPercent(100);
      setLoadingStep("جاهز للمراجعة والمصادقة");
      setLoadingDetail(`تم استخراج ${generatedRows.length} سجلاً بنجاح من مستند الـ PDF`);
      setSuccessMessage(`تم استخراج ${generatedRows.length} سجلاً بنجاح من مستند الـ PDF! يمكنك التعديل والمراجعة قبل الحفظ النهائي.`);
    } catch (err: any) {
      setProgressPhase("error");
      setErrorMessage(err.message || "حدث خطأ أثناء معالجة ملف الـ PDF.");
    } finally {
      setImportLoading(false);
    }
  };

  // Helper to auto-save mapping to localStorage for similar future files
  const autoSaveCurrentMapping = (mappingToSave: ColumnMapping) => {
    try {
      const currentPresets = getStoredPresets();
      const now = new Date().toISOString();
      const timeStr = new Date().toLocaleTimeString("ar-YE", { hour: "2-digit", minute: "2-digit" });
      
      let updatedPresets = [...currentPresets];
      const existingIdx = updatedPresets.findIndex(p => p.id === activePresetId && p.id !== "auto");
      
      if (existingIdx >= 0) {
        updatedPresets[existingIdx] = {
          ...updatedPresets[existingIdx],
          mapping: mappingToSave,
          headers: availableColumns.length > 0 ? availableColumns : updatedPresets[existingIdx].headers,
          updatedAt: now
        };
      } else {
        const matched = findMatchingPreset(availableColumns, updatedPresets);
        if (matched) {
          const idx = updatedPresets.findIndex(p => p.id === matched.preset.id);
          if (idx >= 0) {
            updatedPresets[idx] = {
              ...updatedPresets[idx],
              mapping: mappingToSave,
              headers: availableColumns,
              updatedAt: now
            };
          }
        } else {
          const newPreset: SavedMappingPreset = {
            id: `preset_${Date.now()}`,
            name: importedFileName ? `تنسيق: ${importedFileName.replace(/\.[^/.]+$/, "")}` : "التنسيق الافتراضي للملفات",
            mapping: mappingToSave,
            headers: availableColumns,
            createdAt: now,
            updatedAt: now,
            isDefault: updatedPresets.length === 0
          };
          updatedPresets.unshift(newPreset);
          setActivePresetId(newPreset.id);
        }
      }

      saveStoredPresets(updatedPresets);
      setSavedPresets(updatedPresets);
      setLastAutoSavedTime(timeStr);
      setMappingNotification({
        type: "updated",
        message: `تم حفظ هذا التنسيق في المتصفح (${timeStr}) لاستخدامه تلقائياً في الملفات المشابهة مستقبلاً.`
      });
    } catch (e) {
      console.error("Failed to auto-save column mapping:", e);
    }
  };

  // Re-map columns and rebuild preview
  const handleMappingChange = (field: keyof ColumnMapping, selectedCol: string) => {
    const updated = { ...columnMapping, [field]: selectedCol };
    setColumnMapping(updated);
    if (rawSheetRows.length > 0) {
      const rows = buildPreviewRows(rawSheetRows, updated);
      setPreviewRows(rows);
      validateCurrencies(rows, targetAccountId);
    }
    autoSaveCurrentMapping(updated);
  };

  // Explicit Save as Named Preset
  const handleSaveAsPreset = (presetName: string, asDefault: boolean = false) => {
    if (!presetName.trim()) return;
    const now = new Date().toISOString();
    const newPreset: SavedMappingPreset = {
      id: `preset_${Date.now()}`,
      name: presetName.trim(),
      mapping: { ...columnMapping },
      headers: availableColumns,
      createdAt: now,
      updatedAt: now,
      isDefault: asDefault
    };

    let updated = [newPreset, ...savedPresets.filter(p => !asDefault || !p.isDefault)];
    if (asDefault) {
      updated = updated.map(p => p.id === newPreset.id ? { ...p, isDefault: true } : { ...p, isDefault: false });
    }

    saveStoredPresets(updated);
    setSavedPresets(updated);
    setActivePresetId(newPreset.id);
    setShowSavePresetDialog(false);
    setCustomPresetName("");
    setSuccessMessage(`تم حفظ قالب التنسيق "${newPreset.name}" في المتصفح بنجاح! سيتم اعتماده تلقائياً.`);
    setMappingNotification({
      type: "saved",
      message: `تم حفظ القالب "${newPreset.name}" في المتصفح بنجاح.`
    });
  };

  // Apply a saved preset
  const handleApplyPreset = (preset: SavedMappingPreset) => {
    const smartFallback = detectColumnMapping(availableColumns);
    const merged: ColumnMapping = { ...smartFallback };
    (Object.keys(preset.mapping) as (keyof ColumnMapping)[]).forEach(k => {
      const colVal = preset.mapping[k];
      if (colVal && availableColumns.includes(colVal)) {
        merged[k] = colVal;
      }
    });

    setColumnMapping(merged);
    setActivePresetId(preset.id);
    if (rawSheetRows.length > 0) {
      const rows = buildPreviewRows(rawSheetRows, merged);
      setPreviewRows(rows);
      validateCurrencies(rows, targetAccountId);
    }
    setMappingNotification({
      type: "saved",
      message: `تم تطبيق التنسيق المحفوظ (${preset.name}) بنجاح.`
    });
  };

  // Reset to smart auto-detect
  const handleResetToSmartDetect = () => {
    if (availableColumns.length === 0) return;
    const detected = detectColumnMapping(availableColumns);
    setColumnMapping(detected);
    setActivePresetId("auto");
    if (rawSheetRows.length > 0) {
      const rows = buildPreviewRows(rawSheetRows, detected);
      setPreviewRows(rows);
      validateCurrencies(rows, targetAccountId);
    }
    setMappingNotification({
      type: "auto",
      message: "تمت استعادة التخمين الذكي الافتراضي لأعمدة الملف."
    });
  };

  // Delete a saved preset from browser
  const handleDeletePreset = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedPresets.filter(p => p.id !== presetId);
    saveStoredPresets(updated);
    setSavedPresets(updated);
    if (activePresetId === presetId) {
      handleResetToSmartDetect();
    }
    setSuccessMessage("تم حذف القالب المحفوظ من المتصفح.");
  };

  // Edit preview row inline with auto-calculation
  const updatePreviewRow = (id: string, field: keyof StructuredPreviewRow, value: any) => {
    setPreviewRows(prev => {
      const next = prev.map(row => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value, isEdited: true };
        if (field === "quantity" || field === "unitPrice" || field === "extraCharges") {
          const qty = Number(updated.quantity) || 0;
          const price = Number(updated.unitPrice) || 0;
          const extra = Number(updated.extraCharges) || 0;
          updated.total = Math.round(((qty * price) + extra) * 100) / 100;
        } else if (field === "total") {
          updated.total = Math.round(Number(value || 0) * 100) / 100;
        }
        return updated;
      });
      validateCurrencies(next, targetAccountId);
      return next;
    });
  };

  // Duplicate preview row (تكرار الصف)
  const duplicatePreviewRow = (id: string) => {
    setPreviewRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const source = prev[idx];
      const clone: StructuredPreviewRow = {
        ...source,
        id: `row_${Date.now()}_dup_${Math.random().toString(36).substr(2, 4)}`,
        description: source.description.includes("(مكرر)") ? source.description : `${source.description} (مكرر)`,
        isEdited: true
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      validateCurrencies(next, targetAccountId);
      return next;
    });
    setSuccessMessage("تم تكرار الصف بنجاح مع تحديث الإجماليات والرصيد التراكمي.");
  };

  // Sort rows chronologically by date
  const sortPreviewRowsByDate = () => {
    setPreviewRows(prev => {
      const sorted = [...prev].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      return sorted;
    });
    setSuccessMessage("تم فرز القيود تصاعدياً وتحديث الرصيد التراكمي.");
  };

  // Open modal editor for a row
  const handleOpenEditModal = (row: StructuredPreviewRow) => {
    setEditingModalRow({ ...row });
  };

  // Save changes from modal editor
  const handleSaveEditedModalRow = (updatedRow: StructuredPreviewRow) => {
    setPreviewRows(prev => {
      const next = prev.map(r => r.id === updatedRow.id ? { ...updatedRow, isEdited: true } : r);
      validateCurrencies(next, targetAccountId);
      return next;
    });
    setEditingModalRow(null);
    setSuccessMessage("تم حفظ تعديلات القيد وتحديث الإجماليات المحسوبة.");
  };

  // Target account computation for running balance
  const targetAccountForBalance = useMemo(() => {
    return targetAccountId !== "auto" ? db.accounts.find(a => a.id === targetAccountId) : undefined;
  }, [targetAccountId, db.accounts]);

  // Initial balance for target account
  const initialTargetBalance = useMemo(() => {
    if (!targetAccountForBalance) return 0;
    const existingTxs = db.transactions.filter(t => t.accountId === targetAccountForBalance.id && !t.deletedAt);
    let bal = targetAccountForBalance.openingBalance || 0;
    existingTxs.forEach(t => {
      if (targetAccountForBalance.type === "supplier") {
        bal += (t.type === "credit" ? t.amount : -t.amount);
      } else {
        bal += (t.type === "debit" ? t.amount : -t.amount);
      }
    });
    return bal;
  }, [targetAccountForBalance, db.transactions]);

  // Calculated Preview Rows with Running Cumulative Balance
  const parsedPreviewRows = useMemo((): CalculatedPreviewRow[] => {
    let running = initialTargetBalance;
    let runningCumulativeTotal = 0;

    return previewRows.map((row) => {
      const qty = Number(row.quantity) || 0;
      const price = Number(row.unitPrice) || 0;
      const extra = Number(row.extraCharges) || 0;
      
      const computedTotal = (row.total !== undefined && row.total !== null && !isNaN(row.total))
        ? Number(row.total)
        : ((qty * price) + extra);
      const rowTotal = Math.round(computedTotal * 100) / 100;

      runningCumulativeTotal += rowTotal;

      if (targetAccountForBalance) {
        if (targetAccountForBalance.type === "supplier") {
          running += (row.accountType === "supplier" ? rowTotal : -rowTotal);
        } else {
          running += (row.accountType === "buyer" ? rowTotal : -rowTotal);
        }
      } else {
        if (row.accountType === "supplier") {
          running -= rowTotal;
        } else {
          running += rowTotal;
        }
      }

      return {
        ...row,
        total: rowTotal,
        calculatedTotal: rowTotal,
        runningBalance: Math.round(running * 100) / 100,
        cumulativeTotal: Math.round(runningCumulativeTotal * 100) / 100
      };
    });
  }, [previewRows, targetAccountForBalance, initialTargetBalance]);

  // Summary metrics dynamically updated on any row change
  const previewTotals = useMemo(() => {
    let totalQty = 0;
    let totalExtra = 0;
    let grandTotal = 0;
    const currencyMap: Record<string, { amount: number; extra: number; count: number }> = {};
    const accountsSet = new Set<string>();

    previewRows.forEach(r => {
      const q = Number(r.quantity) || 0;
      const ext = Number(r.extraCharges) || 0;
      const tot = Number(r.total) || 0;

      totalQty += q;
      totalExtra += ext;
      grandTotal += tot;

      if (r.accountName?.trim()) {
        accountsSet.add(r.accountName.trim());
      }

      const cur = (r.currency || "YER").toUpperCase();
      if (!currencyMap[cur]) {
        currencyMap[cur] = { amount: 0, extra: 0, count: 0 };
      }
      currencyMap[cur].amount += tot;
      currencyMap[cur].extra += ext;
      currencyMap[cur].count += 1;
    });

    const finalBalance = parsedPreviewRows.length > 0 
      ? parsedPreviewRows[parsedPreviewRows.length - 1].runningBalance 
      : initialTargetBalance;

    return {
      rowCount: previewRows.length,
      totalQty: Math.round(totalQty * 100) / 100,
      totalExtra: Math.round(totalExtra * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      finalBalance: Math.round(finalBalance * 100) / 100,
      uniqueAccounts: accountsSet.size,
      currencyMap
    };
  }, [previewRows, parsedPreviewRows, initialTargetBalance]);

  // Delete preview row
  const deletePreviewRow = (id: string) => {
    setPreviewRows(prev => {
      const next = prev.filter(r => r.id !== id);
      validateCurrencies(next, targetAccountId);
      return next;
    });
    setSuccessMessage("تم حذف الصف وتحديث الإجماليات المحسوبة.");
  };

  // Add new blank row to preview
  const addNewPreviewRow = () => {
    const selectedAcc = targetAccountId !== "auto" ? db.accounts.find(a => a.id === targetAccountId) : undefined;
    const newRow: StructuredPreviewRow = {
      id: `manual_row_${Date.now()}`,
      accountName: selectedAcc ? selectedAcc.name : "حساب جديد",
      accountType: selectedAcc?.type || "buyer",
      date: new Date().toISOString().split("T")[0],
      description: "قيد جديد",
      quantity: 1,
      unitPrice: 0,
      extraCharges: 0,
      total: 0,
      currency: selectedAcc?.currency || "YER",
      isEdited: true
    };
    setPreviewRows(prev => {
      const next = [newRow, ...prev];
      validateCurrencies(next, targetAccountId);
      return next;
    });
    setSuccessMessage("تمت إضافة سطر جديد للمعاينة.");
  };

  // Final confirmation: Commit to local Database with de-duplication and currency validation check
  const confirmFinalStructuredImport = (forceCurrencyProceed = false) => {
    if (previewRows.length === 0) return;

    // Currency mismatch validation check
    if (!forceCurrencyProceed && !currencyMismatchAcknowledged) {
      const conflict = checkCurrencyConflict(previewRows, targetAccountId);
      if (conflict && conflict.detected) {
        setCurrencyConflict(conflict);
        setShowCurrencyConfirmModal(true);
        return;
      }
    }

    try {
      let accountsAdded = 0;
      let entriesAdded = 0;
      let duplicatesSkipped = 0;

      previewRows.forEach(row => {
        // 1. Account handling & de-duplication
        let targetAccount = db.accounts.find(a => a.name.trim().toLowerCase() === row.accountName.trim().toLowerCase());
        
        if (!targetAccount && row.accountName.trim()) {
          targetAccount = {
            id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: row.accountName.trim(),
            phone: "",
            address: "",
            openingBalance: 0,
            type: row.accountType,
            currency: row.currency || "YER",
            status: "active",
            createdAt: new Date().toISOString()
          };
          db.accounts.push(targetAccount);
          accountsAdded++;
        }

        // 2. Daily Entry handling & de-duplication
        // Match duplicate if: same date AND exact description AND matching total
        const isDuplicate = db.dailyEntries.some(e => 
          e.date === row.date && 
          e.description.trim().toLowerCase() === row.description.trim().toLowerCase() && 
          Math.abs((e.total || 0) - row.total) < 0.01
        );

        if (isDuplicate) {
          duplicatesSkipped++;
        } else {
          const entryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const newEntry: DailyLedgerEntry = {
            id: entryId,
            dayNumber: 1,
            date: row.date || new Date().toISOString().split("T")[0],
            description: row.description || "قيد مستورد",
            quantity: row.quantity || 1,
            unitPrice: row.unitPrice || 0,
            extraCharges: row.extraCharges || 0,
            total: row.total,
            currency: row.currency || "YER",
            accountId: targetAccount ? targetAccount.id : undefined,
            accountType: row.accountType,
            transactionType: row.accountType === "supplier" ? "credit" : "debit"
          };
          db.dailyEntries.push(newEntry);
          entriesAdded++;

          // Also generate linked transaction if linked to an account
          if (targetAccount) {
            const newTx: Transaction = {
              id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              accountId: targetAccount.id,
              date: newEntry.date,
              description: newEntry.description,
              type: newEntry.transactionType || "debit",
              amount: newEntry.total,
              quantity: newEntry.quantity,
              unitPrice: newEntry.unitPrice,
              extraCharges: newEntry.extraCharges,
              currency: newEntry.currency,
              sourceEntryId: newEntry.id
            };
            db.transactions.push(newTx);
          }
        }
      });

      // Save locally to localStorage
      db.save();
      onDatabaseUpdate();

      // Log activity
      db.logActivity(
        db.currentUser || "Admin",
        "add",
        "account",
        "smart_import",
        `استيراد ذكي من ${importedFileName || "ملف خارجي"}: تم إضافة (${accountsAdded}) حساب جديد، (${entriesAdded}) قيد، وتجاوز (${duplicatesSkipped}) سجل مكرر.`
      );

      // If cloud sync active, push to remote
      if (syncEnabled) {
        pushLocalDataToCloud();
      }

      setSuccessMessage(
        `تم استيراد وحفظ البيانات محلياً بنجاح! تم إضافة (${accountsAdded}) حساب، (${entriesAdded}) قيد يومي، وتم تخطي (${duplicatesSkipped}) سجل مكرر تلقائياً.`
      );
      setPreviewRows([]);
      setRawSheetRows([]);
      setImportedFileName("");
      setCurrencyConflict(null);
      setCurrencyMismatchAcknowledged(false);
      setShowCurrencyConfirmModal(false);
    } catch (err: any) {
      setErrorMessage(`حدث خطأ أثناء ترحيل البيانات: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // AI AUTOMATIC ANALYSIS FOR PHOTO INVOICES & CAMERA
  // -------------------------------------------------------------

  const handleAIPhotoUpload = async (file: File) => {
    try {
      setImportLoading(true);
      setProgressPhase("reading");
      setProgressPercent(20);
      setLoadingStep("جاري فحص وقراءة الصورة...");
      setLoadingDetail("تجهيز الصورة واستخراج التشفير البصري الآمن");
      setErrorMessage(null);
      setSuccessMessage(null);
      setAnalysisResult(undefined);

      const objectUrl = URL.createObjectURL(file);
      setAnalyzedFile({
        name: file.name,
        url: objectUrl,
        type: file.type
      });

      const base64 = await readFileAsBase64Promise(file);

      setProgressPhase("analyzing");
      setProgressPercent(60);
      setLoadingStep("جاري استخراج البيانات والأرقام بواسطة محرك الذكاء الاصطناعي...");
      setLoadingDetail("التعرف على النصوص، المورد، الأصناف، والعملة");

      const selectedAcc = targetAccountId !== "auto" ? db.accounts.find(a => a.id === targetAccountId) : undefined;

      const response = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64,
          mimeType: file.type || "image/jpeg",
          fileName: file.name,
          accountContext: selectedAcc ? {
            name: selectedAcc.name,
            type: selectedAcc.type,
            currency: selectedAcc.currency || "YER",
            openingBalance: selectedAcc.openingBalance || 0
          } : undefined
        })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "فشل الذكاء الاصطناعي في تحليل الفاتورة المصورة.");
      }

      setProgressPhase("validating");
      setProgressPercent(85);
      setLoadingStep("جاري تجهيز القيد المحاسبي ومطابقة العملات...");
      setLoadingDetail("مقارنة العملة مع الحساب المستهدف والتأكد من الأرصدة");

      const rawData = resData.data;
      const ext = rawData.extractedData || {};

      const docCurrency = ext.currency || (selectedAcc ? (selectedAcc.currency || "YER") : "YER");

      const mappedAnalysis: DocumentAnalysisResult = {
        documentType: rawData.documentType || "فاتورة ضريبية",
        confidenceScore: rawData.confidenceScore || 0.94,
        suggestedAction: "تأكيد واعتماد القيد المحاسبي",
        extractedData: {
          customerName: ext.customerName || (selectedAcc && selectedAcc.type === "buyer" ? selectedAcc.name : ""),
          supplierName: ext.supplierName || ext.companyName || (selectedAcc && selectedAcc.type === "supplier" ? selectedAcc.name : ""),
          invoiceNumber: ext.invoiceNumber || ext.referenceNumber || "",
          date: ext.issueDate || ext.date || new Date().toISOString().split("T")[0],
          totalAmount: parseAccountingNumber(ext.grandTotal || ext.totalAmount || ext.subtotal, 0),
          taxAmount: parseAccountingNumber(ext.taxAmount, 0),
          currency: docCurrency,
          items: ext.items || []
        },
        suggestedJournalEntry: {
          debitAccount: rawData.accountingIntelligence?.suggestedDebitAccount || "المشتريات / المصروفات",
          creditAccount: rawData.accountingIntelligence?.suggestedCreditAccount || ext.supplierName || "الصندوق",
          amount: parseAccountingNumber(ext.grandTotal || ext.totalAmount, 0),
          date: ext.issueDate || ext.date || new Date().toISOString().split("T")[0]
        }
      };

      setAnalysisResult(mappedAnalysis);
      setActivePortalSection("ai_vision");

      // Check currency against target account
      if (selectedAcc && selectedAcc.currency && selectedAcc.currency.toUpperCase() !== docCurrency.toUpperCase()) {
        setCurrencyConflict({
          detected: true,
          docCurrencies: [docCurrency],
          accountCurrency: selectedAcc.currency,
          accountName: selectedAcc.name,
          mismatchedRowCount: 1,
          totalRows: 1
        });
        setCurrencyMismatchAcknowledged(false);
      } else {
        const entityName = (mappedAnalysis.extractedData.supplierName || mappedAnalysis.extractedData.customerName || "").trim();
        const existing = db.accounts.find(a => a.name.trim().toLowerCase() === entityName.toLowerCase());
        if (existing && existing.currency && existing.currency.toUpperCase() !== docCurrency.toUpperCase()) {
          setCurrencyConflict({
            detected: true,
            docCurrencies: [docCurrency],
            accountCurrency: existing.currency,
            accountName: existing.name,
            mismatchedRowCount: 1,
            totalRows: 1
          });
          setCurrencyMismatchAcknowledged(false);
        } else {
          setCurrencyConflict(null);
        }
      }

      setProgressPhase("ready");
      setProgressPercent(100);
      setLoadingStep("تم التحليل بنجاح وجاهز للمراجعة");
      setLoadingDetail("مراجعة بيانات الفاتورة المصورة قبل الاعتماد النهائي");

      setSuccessMessage("تم تحليل الفاتورة بنجاح عبر الذكاء الاصطناعي! يرجى مراجعة الحقول وتأكيد الحفظ.");
    } catch (err: any) {
      setProgressPhase("error");
      setErrorMessage(err.message || "حدث خطأ أثناء معالجة صورة الفاتورة.");
    } finally {
      setImportLoading(false);
    }
  };

  // Commit AI analyzed invoice to Database with currency check
  const handleApproveAIAnalysis = (approved: DocumentAnalysisResult, forceCurrencyProceed = false) => {
    try {
      const ext = approved.extractedData;
      const totalAmt = ext.totalAmount || 0;
      const isSupplier = !!ext.supplierName;
      const entityName = (ext.supplierName || ext.customerName || "حساب من فاتورة مصورة").trim();
      const docDate = ext.date || new Date().toISOString().split("T")[0];
      const currency = ext.currency || "YER";

      let targetAccount = db.accounts.find(a => a.name.trim().toLowerCase() === entityName.toLowerCase());

      // Currency check for AI analysis
      if (targetAccount && targetAccount.currency && targetAccount.currency.toUpperCase() !== currency.toUpperCase() && !forceCurrencyProceed && !currencyMismatchAcknowledged) {
        setCurrencyConflict({
          detected: true,
          docCurrencies: [currency],
          accountCurrency: targetAccount.currency,
          accountName: targetAccount.name,
          mismatchedRowCount: 1,
          totalRows: 1
        });
        setShowCurrencyConfirmModal(true);
        return;
      }

      // 1. Account creation if doesn't exist
      if (!targetAccount) {
        targetAccount = {
          id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: entityName,
          phone: "",
          address: "",
          openingBalance: 0,
          type: isSupplier ? "supplier" : "buyer",
          currency,
          status: "active",
          createdAt: new Date().toISOString()
        };
        db.accounts.push(targetAccount);
      }

      // 2. Create Daily Ledger Entry
      const entryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const newEntry: DailyLedgerEntry = {
        id: entryId,
        dayNumber: 1,
        date: docDate,
        description: `فاتورة ${approved.documentType} ${ext.invoiceNumber ? '#' + ext.invoiceNumber : ''} - ${entityName}`,
        quantity: 1,
        unitPrice: totalAmt,
        extraCharges: ext.taxAmount || 0,
        total: totalAmt,
        currency,
        accountId: targetAccount.id,
        accountType: targetAccount.type,
        transactionType: isSupplier ? "credit" : "debit"
      };
      db.dailyEntries.push(newEntry);

      // 3. Create Linked Transaction
      const newTx: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        accountId: targetAccount.id,
        date: docDate,
        description: newEntry.description,
        type: newEntry.transactionType || "debit",
        amount: totalAmt,
        quantity: 1,
        unitPrice: totalAmt,
        extraCharges: ext.taxAmount || 0,
        currency,
        sourceEntryId: entryId
      };
      db.transactions.push(newTx);

      // 4. Also create Invoice record if items exist
      if (Array.isArray(ext.items) && ext.items.length > 0) {
        const invRecord: InvoiceRecord = {
          id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          invoiceNumber: ext.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
          accountId: targetAccount.id,
          date: docDate,
          items: ext.items.map(it => ({
            id: `item_${Math.random().toString(36).substr(2, 4)}`,
            description: it.description || "بند فاتورة",
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || (it.total ? it.total / (it.quantity || 1) : 0),
            additions: 0
          })),
          total: totalAmt,
          currency,
          type: isSupplier ? 'purchase' : 'sale',
          notes: `تم تفريغها آلياً بواسطة محرك الذكاء الاصطناعي من صورة مستند (${approved.documentType})`
        };
        db.invoices.push(invRecord);
      }

      // Save locally
      db.save();
      onDatabaseUpdate();

      // Log activity
      db.logActivity(
        db.currentUser || "Admin",
        "add",
        "account",
        "ai_invoice_parse",
        `اعتماد وتفريغ فاتورة مصورة عبر الذكاء الاصطناعي (${entityName} - بمبلغ ${totalAmt?.toLocaleString()} ${currency})`
      );

      // Cloud push if sync is on
      if (syncEnabled) {
        pushLocalDataToCloud();
      }

      setSuccessMessage(`تم اعتماد وحفظ القيد والمستند بنجاح للحساب (${entityName}) بمبلغ ${totalAmt?.toLocaleString()} ${currency}!`);
      setAnalyzedFile(null);
      setAnalysisResult(undefined);
      setCurrencyConflict(null);
      setCurrencyMismatchAcknowledged(false);
      setShowCurrencyConfirmModal(false);
    } catch (err: any) {
      setErrorMessage(`حدث خطأ أثناء حفظ القيد المحاسبي: ${err.message}`);
    }
  };

  // Reject AI analysis and cancel
  const handleRejectAIAnalysis = () => {
    setAnalyzedFile(null);
    setAnalysisResult(undefined);
    setSuccessMessage("تم إلغاء المستند دون حفظ أي بيانات.");
  };

  // Drag and drop handler
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      routeFile(file);
    }
  };

  const routeFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      setActivePortalSection("structured");
      setStructuredType("excel");
      handleExcelUpload(file);
    } else if (ext === "pdf") {
      setActivePortalSection("structured");
      setStructuredType("pdf");
      handlePDFUpload(file);
    } else if (file.type.startsWith("image/")) {
      setActivePortalSection("ai_vision");
      handleAIPhotoUpload(file);
    } else {
      setErrorMessage("نوع الملف غير مدعوم. يرجى اختيار ملف Excel أو PDF أو صورة فاتورة.");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-24" dir="rtl" id="smart_import_portal">
      
      {/* ========================================================= */}
      {/* 1. ONBOARDING HERO CARD                                  */}
      {/* ========================================================= */}
      <div 
        id="hero_onboarding_card"
        className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-slate-900 via-indigo-950/80 to-slate-900 p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
      >
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Sparkles size={14} className="text-amber-400 animate-pulse" />
                مدعوم بالذكاء الاصطناعي
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800/80 text-slate-300 border border-slate-700">
                الجيل الجديد لنظام ANAS
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                أمان وتخزين محلي 100%
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              بوابة الاستيراد الذكي والتحليل التلقائي
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              أهلاً بك في الجيل الجديد لنظام ANAS المحاسبي المحمول. استورد بياناتك بنقرة واحدة من ملفات Excel و PDF، أو ارفع مستندات وفواتير مصورة ليتولى محرك الذكاء الاصطناعي تفريغ القيود نيابة عنك مباشرة وتخزينها محلياً بأمان كامل.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full sm:w-auto shrink-0">
            <button
              onClick={downloadExcelTemplate}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/10 active:scale-95 whitespace-nowrap"
            >
              <FileSpreadsheet size={16} className="text-emerald-400" />
              <span>تحميل نموذج Excel المعتمد</span>
            </button>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 justify-center">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>لا يُحفظ أي سجل دون مراجعتك</span>
            </div>
          </div>
        </div>

        {/* Modern Segmented Navigation Tabs */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActivePortalSection("structured")}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activePortalSection === "structured"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-102"
                : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <FileSpreadsheet size={16} />
            <span>استيراد الجداول المنظمة (Excel & PDF)</span>
          </button>

          <button
            onClick={() => setActivePortalSection("ai_vision")}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activePortalSection === "ai_vision"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-102"
                : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Camera size={16} />
            <span>التحليل التلقائي للفواتير المصورة والكاميرا</span>
          </button>

          <button
            onClick={() => setActivePortalSection("cloud_sync")}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activePortalSection === "cloud_sync"
                ? "bg-slate-700 text-white shadow-lg scale-102"
                : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Smartphone size={16} />
            <span>المزامنة السحابية وأجهزة أندرويد</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-rose-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400/60 hover:text-rose-300 p-1 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400/60 hover:text-emerald-300 p-1 cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. SECTION 1: STRUCTURED FILES (EXCEL / PDF)              */}
      {/* ========================================================= */}
      {activePortalSection === "structured" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* File Picker & Format Selector */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-400" size={20} />
                  استيراد الملفات المنظمة (Excel و PDF)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  اختر نوع الملف، وسيتم استخراج الحسابات والقيود تلقائياً وعرضها في جدول تفاعلي للمراجعة قبل الاستيراد.
                </p>
              </div>

              {/* Format Toggle */}
              <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setStructuredType("excel")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    structuredType === "excel" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileSpreadsheet size={14} />
                  <span>ملفات Excel (.xlsx / .csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStructuredType("pdf")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    structuredType === "pdf" ? "bg-rose-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText size={14} />
                  <span>مستندات PDF (.pdf)</span>
                </button>
              </div>
            </div>

            {/* Hidden native inputs */}
            <input 
              type="file" 
              ref={excelFileInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) handleExcelUpload(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <input 
              type="file" 
              ref={pdfFileInputRef}
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) handlePDFUpload(e.target.files[0]);
                e.target.value = "";
              }}
            />

            {/* Target Account & Currency Validation Selector */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Scale size={16} className="text-amber-400" />
                  <span className="text-xs font-black text-white">الحساب المستهدف وفحص مطابقة العملة:</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">قبل الاستيراد</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  حدد حساباً معيناً لمطابقة عملته تلقائياً مع المستند والتنبيه قبل الترحيل، أو اختر التحديد التلقائي لترحيل القيود بحسب أسماء الحسابات في الملف.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <select
                  value={targetAccountId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setTargetAccountId(newId);
                    if (previewRows.length > 0) {
                      validateCurrencies(previewRows, newId);
                    }
                  }}
                  className="w-full sm:w-72 bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="auto">تحديد تلقائي من أسماء الحسابات في الملف (Auto)</option>
                  <optgroup label="الحسابات المسجلة في النظام">
                    {db.accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency || "YER"}) - {acc.type === "supplier" ? "مورد" : "عميل"}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {targetAccountId !== "auto" && (
                  <span className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-black shrink-0">
                    {db.accounts.find(a => a.id === targetAccountId)?.currency || "YER"}
                  </span>
                )}
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => {
                if (importLoading) return;
                if (structuredType === "excel") excelFileInputRef.current?.click();
                else pdfFileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-3xl p-6 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                dragActive 
                  ? "border-indigo-500 bg-indigo-500/10 scale-99 shadow-2xl" 
                  : "border-slate-750 hover:border-indigo-400/80 bg-slate-950/40 hover:bg-slate-900/60"
              }`}
            >
              {importLoading ? (
                <div className="w-full max-w-md mx-auto py-3 px-2 space-y-5 animate-in fade-in">
                  {/* Header with spinning indicator and percentage */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl animate-pulse">
                        <RefreshCw size={24} className="animate-spin" />
                      </div>
                      <div className="text-right">
                        <h4 className="text-sm font-extrabold text-white">{loadingStep || "جاري معالجة المستند..."}</h4>
                        <p className="text-[11px] text-slate-400">{loadingDetail || "نظام ANAS المحاسبي يضمن سلامة القيود وعدم تكرارها"}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      {progressPercent}%
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* 4-Stage Stepper Track */}
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] pt-1">
                    {/* Stage 1: Reading */}
                    <div className={`flex flex-col items-center gap-1.5 transition-colors ${
                      progressPhase === "reading" ? "text-indigo-300 font-bold" : (progressPercent > 20 ? "text-emerald-400 font-semibold" : "text-slate-500")
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border transition-all ${
                        progressPhase === "reading" ? "border-indigo-400 bg-indigo-500/30 text-white animate-bounce" : (progressPercent > 20 ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-slate-800 bg-slate-900 text-slate-500")
                      }`}>
                        {progressPercent > 20 ? <Check size={12} /> : "1"}
                      </div>
                      <span>قراءة الملف</span>
                    </div>

                    {/* Stage 2: Analyzing */}
                    <div className={`flex flex-col items-center gap-1.5 transition-colors ${
                      progressPhase === "analyzing" ? "text-indigo-300 font-bold" : (progressPercent > 55 ? "text-emerald-400 font-semibold" : "text-slate-500")
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border transition-all ${
                        progressPhase === "analyzing" ? "border-indigo-400 bg-indigo-500/30 text-white animate-bounce" : (progressPercent > 55 ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-slate-800 bg-slate-900 text-slate-500")
                      }`}>
                        {progressPercent > 55 ? <Check size={12} /> : "2"}
                      </div>
                      <span>التحليل والاستخراج</span>
                    </div>

                    {/* Stage 3: Validating */}
                    <div className={`flex flex-col items-center gap-1.5 transition-colors ${
                      progressPhase === "validating" ? "text-amber-300 font-bold" : (progressPercent > 85 ? "text-emerald-400 font-semibold" : "text-slate-500")
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border transition-all ${
                        progressPhase === "validating" ? "border-amber-400 bg-amber-500/30 text-white animate-bounce" : (progressPercent > 85 ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-slate-800 bg-slate-900 text-slate-500")
                      }`}>
                        {progressPercent > 85 ? <Check size={12} /> : "3"}
                      </div>
                      <span>فحص العملات</span>
                    </div>

                    {/* Stage 4: Ready */}
                    <div className={`flex flex-col items-center gap-1.5 transition-colors ${
                      progressPhase === "ready" || progressPercent === 100 ? "text-emerald-300 font-bold" : "text-slate-500"
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border transition-all ${
                        progressPhase === "ready" || progressPercent === 100 ? "border-emerald-400 bg-emerald-500/30 text-emerald-300" : "border-slate-800 bg-slate-900 text-slate-500"
                      }`}>
                        {progressPercent === 100 ? <Check size={12} /> : "4"}
                      </div>
                      <span>جاهز للمراجعة</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
                    <UploadCloud size={32} />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-bold text-white">
                      اسحب وأفلت ملف {structuredType === "excel" ? "Excel" : "PDF"} هنا، أو انقر للاختيار من جهازك
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {structuredType === "excel" 
                        ? "ندعم صيغ .xlsx و .xls و .csv مع مطابقة تلقائية لكافة الأعمدة وتعديلها بسهولة" 
                        : "يتم استخراج الجداول والنصوص المالية بذكاء وتحويلها لنفس جدول المعاينة"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-3 py-1 text-[11px] font-bold rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      {structuredType === "excel" ? "XLSX, XLS, CSV" : "PDF"}
                    </span>
                    <span className="px-3 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      معاينة وتعديل قبل التأكيد
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Column Mapping Customizer & Saved Browser Templates */}
            {availableColumns.length > 0 && (
              <div className="border border-indigo-500/30 rounded-3xl p-5 sm:p-6 bg-slate-900/90 shadow-xl space-y-5 animate-in fade-in">
                {/* Header & Status */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl">
                        <SlidersHorizontal size={18} />
                      </div>
                      <h3 className="text-sm sm:text-base font-black text-white">
                        جدول اختيار العمود المطابق لكل حقل (Column Mapping Table)
                      </h3>
                      {activePresetId !== "auto" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          <Bookmark size={12} />
                          <span>قالب محفوظ في المتصفح</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                          <Sparkles size={12} />
                          <span>تخمين ذكي تلقائي</span>
                        </span>
                      )}
                      {lastAutoSavedTime && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                          <Save size={11} className="text-emerald-400" />
                          <span>حُفِظ بالمتصفح ({lastAutoSavedTime})</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      اختر العمود المناسب من ملفك لكل حقل بالنظام. <strong className="text-indigo-300 font-bold">سيتم حفظ هذا التنسيق في المتصفح لاستخدامه تلقائياً في الملفات المشابهة مستقبلاً</strong>.
                    </p>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={handleResetToSmartDetect}
                      title="استعادة التخمين الذكي الأصلي للأعمدة"
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer transition-all"
                    >
                      <RotateCcw size={13} className="text-slate-400" />
                      <span>استعادة التخمين الأصلي</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowSavePresetDialog(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer transition-all"
                    >
                      <Bookmark size={13} />
                      <span>حفظ كقالب دائم...</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowMappingConfig(!showMappingConfig)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl cursor-pointer"
                      title={showMappingConfig ? "طي الجدول" : "توسيع الجدول"}
                    >
                      {showMappingConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Mapping Notification / Feedback Banner */}
                {mappingNotification && (
                  <div className={`p-3 rounded-2xl flex items-center justify-between text-xs gap-2 border animate-in fade-in ${
                    mappingNotification.type === "saved" 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" 
                      : mappingNotification.type === "updated"
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                      : "bg-slate-800/80 border-slate-700 text-slate-300"
                  }`}>
                    <div className="flex items-center gap-2">
                      {mappingNotification.type === "saved" ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : mappingNotification.type === "updated" ? (
                        <Save size={16} className="text-indigo-400 shrink-0" />
                      ) : (
                        <Sparkles size={16} className="text-purple-400 shrink-0" />
                      )}
                      <span>{mappingNotification.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMappingNotification(null)}
                      className="text-slate-400 hover:text-white p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Saved Presets Quick Selector */}
                {savedPresets.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                    <span className="text-slate-400 font-bold flex items-center gap-1">
                      <Bookmark size={12} className="text-indigo-400" />
                      <span>القوالب المحفوظة في هذا المتصفح:</span>
                    </span>

                    <button
                      type="button"
                      onClick={handleResetToSmartDetect}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        activePresetId === "auto"
                          ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
                          : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white"
                      }`}
                    >
                      تخمين ذكي (تلقائي)
                    </button>

                    {savedPresets.map((preset) => (
                      <div
                        key={preset.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                          activePresetId === preset.id
                            ? "bg-indigo-600/30 text-indigo-200 border-indigo-500 shadow-sm"
                            : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleApplyPreset(preset)}
                          className="cursor-pointer hover:underline"
                        >
                          {preset.name}
                          {preset.isDefault && <span className="text-[10px] text-amber-400 mr-1 font-mono">(افتراضي)</span>}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          title="حذف هذا القالب من المتصفح"
                          className="text-slate-500 hover:text-rose-400 cursor-pointer p-0.5 rounded"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dialog to Save Preset Name */}
                {showSavePresetDialog && (
                  <div className="p-4 bg-slate-950/80 border border-indigo-500/40 rounded-2xl space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                        <Bookmark size={14} className="text-indigo-400" />
                        <span>حفظ هذا التنسيق في المتصفح لاستخدامه في الملفات المشابهة مستقبلاً</span>
                      </h4>
                      <button 
                        type="button" 
                        onClick={() => setShowSavePresetDialog(false)}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="text"
                        value={customPresetName}
                        onChange={(e) => setCustomPresetName(e.target.value)}
                        placeholder="أدخل اسماً للقالب (مثال: فواتير المشتريات، كشف بنك الكريمي...)"
                        className="flex-1 w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                        autoFocus
                      />
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleSaveAsPreset(customPresetName || (importedFileName ? `تنسيق ${importedFileName}` : "تنسيق مخصص"), true)}
                          className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all whitespace-nowrap"
                        >
                          حفظ واعتماد كافتراضي
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveAsPreset(customPresetName || "تنسيق مخصص", false)}
                          className="flex-1 sm:flex-none px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all whitespace-nowrap"
                        >
                          حفظ كقالب إضافي
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* The Full Column Mapping Table */}
                {showMappingConfig && (
                  <div className="space-y-4 pt-2">
                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner">
                      <table className="w-full text-right text-xs min-w-[760px]">
                        <thead>
                          <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                            <th className="p-3.5 font-bold">حقل النظام</th>
                            <th className="p-3.5 font-bold">الأهمية والقاعدة المحاسبية</th>
                            <th className="p-3.5 font-bold w-64">العمود المطابق في ملفك</th>
                            <th className="p-3.5 font-bold">معاينة أول قيمة في الملف</th>
                            <th className="p-3.5 font-bold text-center">حالة الربط</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {SYSTEM_FIELDS_META.map((meta) => {
                            const selectedCol = columnMapping[meta.key] || "";
                            const sampleVal = selectedCol && rawSheetRows.length > 0 ? rawSheetRows[0]?.[selectedCol] : undefined;
                            const isMapped = Boolean(selectedCol && selectedCol.trim() !== "");

                            return (
                              <tr key={meta.key} className="hover:bg-slate-900/40 transition-colors">
                                {/* System Field */}
                                <td className="p-3.5">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-slate-800/80 shrink-0">
                                      {meta.iconType === "users" && <Users size={15} className="text-rose-400" />}
                                      {meta.iconType === "briefcase" && <Briefcase size={15} className="text-blue-400" />}
                                      {meta.iconType === "calendar" && <Calendar size={15} className="text-indigo-400" />}
                                      {meta.iconType === "fileText" && <FileText size={15} className="text-slate-400" />}
                                      {meta.iconType === "hash" && <Hash size={15} className="text-emerald-400" />}
                                      {meta.iconType === "tag" && <Tag size={15} className="text-amber-400" />}
                                      {meta.iconType === "plusCircle" && <PlusCircle size={15} className="text-violet-400" />}
                                      {meta.iconType === "calculator" && <Calculator size={15} className="text-teal-400" />}
                                      {meta.iconType === "coins" && <Coins size={15} className="text-yellow-400" />}
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-200">{meta.label}</div>
                                      <div className="text-[10px] text-slate-500 font-mono">{meta.key}</div>
                                    </div>
                                  </div>
                                </td>

                                {/* Accounting Rule / Behavior */}
                                <td className="p-3.5">
                                  <div className="space-y-1">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeColor}`}>
                                      {meta.badge}
                                    </span>
                                    <p className="text-[11px] text-slate-400 leading-snug">
                                      {meta.accountingRule}
                                    </p>
                                  </div>
                                </td>

                                {/* Column Selector */}
                                <td className="p-3.5">
                                  <select
                                    value={selectedCol}
                                    onChange={(e) => handleMappingChange(meta.key, e.target.value)}
                                    className={`w-full rounded-xl p-2.5 text-xs outline-none cursor-pointer transition-all font-medium ${
                                      isMapped
                                        ? "bg-slate-900 border-2 border-indigo-500/60 text-white focus:border-indigo-400"
                                        : "bg-slate-900/80 border border-slate-700 text-slate-400 focus:border-slate-500"
                                    }`}
                                  >
                                    <option value="">(تجاهل - غير موجود في الملف)</option>
                                    {availableColumns.map((col) => (
                                      <option key={col} value={col}>
                                        {col}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                {/* Sample Value from 1st Row */}
                                <td className="p-3.5">
                                  {isMapped ? (
                                    sampleVal !== undefined && sampleVal !== null && String(sampleVal).trim() !== "" ? (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px] max-w-[220px] truncate" title={String(sampleVal)}>
                                        <Eye size={12} className="text-emerald-400 shrink-0" />
                                        <span className="truncate">{String(sampleVal)}</span>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-slate-500 italic">
                                        (فارغ في السطر الأول)
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[11px] text-slate-500">
                                      {meta.fallbackHint}
                                    </span>
                                  )}
                                </td>

                                {/* Mapping Status */}
                                <td className="p-3.5 text-center">
                                  {isMapped ? (
                                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-bold">
                                      <CheckCircle2 size={12} />
                                      <span>مرتبط</span>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium border border-slate-700">
                                      افتراضي
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Auto-Persistence Footer Note */}
                    <div className="p-3.5 bg-gradient-to-r from-indigo-950/40 to-slate-900/80 border border-indigo-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-indigo-200">
                      <div className="flex items-center gap-2">
                        <Bookmark size={15} className="text-indigo-400 shrink-0" />
                        <span>
                          <strong>تذكير ذكي:</strong> يتم حفظ مطابقة الأعمدة في ذاكرة المتصفح (LocalStorage) فوراً. سيتم تطبيق نفس التنسيق تلقائياً عند استيراد أي ملف Excel مشابه مستقبلاً.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            autoSaveCurrentMapping(columnMapping);
                            setSuccessMessage("تم حفظ التنسيق الحالي في المتصفح كقالب للملفات القادمة!");
                          }}
                          className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white font-bold rounded-xl border border-indigo-500/30 cursor-pointer transition-all"
                        >
                          تأكيد حفظ التنسيق الآن
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Unified Editable Preview Table */}
          {previewRows.length > 0 && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-5 animate-in fade-in">
              
              {/* Currency Conflict Banner */}
              {currencyConflict && currencyConflict.detected && (
                <div className="p-4 sm:p-5 bg-amber-500/10 border-2 border-amber-500/40 rounded-3xl space-y-3 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="p-2.5 bg-amber-500/20 text-amber-300 rounded-2xl shrink-0 mt-0.5 sm:mt-0">
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-amber-200 flex items-center gap-2">
                          <span>تنبيه: تم اكتشاف اختلاف في العملات بين المستند والحساب المحدد</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {currencyConflict.mismatchedRowCount} قيد مختلف
                          </span>
                        </h4>
                        <p className="text-xs text-amber-300/80 mt-1">
                          عملة المستند: <strong className="text-white font-black">({currencyConflict.docCurrencies.join(', ')})</strong> بينما عملة الحساب {currencyConflict.accountName ? `(${currencyConflict.accountName})` : ''} هي: <strong className="text-white font-black">({currencyConflict.accountCurrency})</strong>. يُرجى اختيار إجراء المعالجة قبل الترحيل التلقائي لتفادي أي خطأ محاسبي.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleUnifyCurrency(currencyConflict.accountCurrency)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        <Coins size={14} />
                        <span>توحيد العملة إلى ({currencyConflict.accountCurrency})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAcknowledgeCurrencyMismatch}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
                      >
                        <span>الإبقاء على عملات المستند</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white">جدول المعاينة المحاسبي القابل للتعديل</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {previewRows.length} سجلاً
                    </span>
                    {currencyConflict && currencyConflict.detected && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        تنبيه العملة
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    يمكنك تعديل أي قيمة مباشرة بالجدول، أو حذف صفوف غير مرغوبة، أو إضافة صفوف جديدة قبل التأكيد.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={addNewPreviewRow}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-700 hover:border-slate-600"
                  >
                    <Plus size={14} className="text-indigo-400" />
                    <span>إضافة سطر</span>
                  </button>
                  <button
                    type="button"
                    onClick={sortPreviewRowsByDate}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-700 hover:border-slate-600"
                    title="ترتيب السجلات زمنياً حسب التاريخ لتسلسل تراكمي منضبط"
                  >
                    <ArrowUpDown size={14} className="text-blue-400" />
                    <span>فرز بالتاريخ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPreviewRows([]); setRawSheetRows([]); setImportedFileName(""); setCurrencyConflict(null); }}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-500/20"
                    title="إلغاء المعاينة"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmFinalStructuredImport(false)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <Check size={16} />
                    <span>استيراد نهائي ({previewTotals.rowCount} سجل)</span>
                  </button>
                </div>
              </div>

              {/* Enhanced Dynamic Table Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/90 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-medium">إجمالي القيود:</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black text-white">{previewTotals.rowCount}</span>
                    <span className="text-[10px] text-slate-400">سجل</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/90 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-medium">إجمالي الكميات:</span>
                  <span className="text-lg font-black text-indigo-400 block mt-0.5">
                    {previewTotals.totalQty?.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/90 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-medium">الزيادات والمصاريف (+):</span>
                  <span className="text-lg font-black text-amber-400 block mt-0.5">
                    {previewTotals.totalExtra?.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/90 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-medium">إجمالي المبالغ المحسوبة:</span>
                  <span className="text-lg font-black text-emerald-400 block mt-0.5">
                    {previewTotals.grandTotal?.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/90 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-medium">الرصيد التراكمي النهائي:</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className={`text-base font-black ${
                      previewTotals.finalBalance > 0 
                        ? "text-emerald-400" 
                        : previewTotals.finalBalance < 0 
                        ? "text-amber-400" 
                        : "text-slate-300"
                    }`}>
                      {previewTotals.finalBalance?.toLocaleString()}
                    </span>
                    <span className="text-[9px] px-1 py-0.5 rounded font-bold bg-slate-900 text-slate-400">
                      {previewTotals.finalBalance > 0 ? "مدين" : previewTotals.finalBalance < 0 ? "دائن" : "متزن"}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/90 shadow-xs">
                  <span className="text-[10px] text-slate-400 block font-medium">الحسابات والعملات:</span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400">
                      {previewTotals.uniqueAccounts} حساب
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      currencyConflict?.detected ? "bg-amber-500/10 text-amber-300 border border-amber-500/30" : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    }`}>
                      {Object.keys(previewTotals.currencyMap).length > 1 
                        ? `${Object.keys(previewTotals.currencyMap).length} عملات` 
                        : Object.keys(previewTotals.currencyMap)[0] || "YER"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-currency breakdown pill if multiple currencies exist */}
              {Object.keys(previewTotals.currencyMap).length > 1 && (
                <div className="flex items-center gap-2 p-2.5 bg-slate-950/40 border border-slate-800/70 rounded-xl text-xs text-slate-300 overflow-x-auto">
                  <span className="text-[11px] font-bold text-slate-400 shrink-0">تفصيل الإجماليات حسب العملة:</span>
                  {Object.entries(previewTotals.currencyMap).map(([cur, data]: [string, { amount: number; extra: number; count: number }]) => (
                    <span key={cur} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] shrink-0">
                      <span className="font-bold text-white">{data.amount?.toLocaleString()}</span>
                      <span className="text-indigo-400">{cur}</span>
                      <span className="text-slate-400 text-[10px]">({data.count} قيد)</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Formula and Help Banner */}
              <div className="flex items-center justify-between px-3.5 py-2 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-xs text-indigo-300">
                <div className="flex items-center gap-2">
                  <Calculator size={14} className="text-indigo-400 shrink-0" />
                  <span>
                    <strong>المعادلة المحاسبية المطبقة تلقائياً:</strong> الإجمالي = (الكمية × سعر الوحدة) + الزيادات والمصاريف. يتم تحديث الرصيد التراكمي تسلسلياً فور تعديل أي قيمة.
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 hidden md:inline">
                  يدعم التعديل السريع في الخلية أو نافذة التعديل التفصيلية ✏️
                </span>
              </div>

              {/* Editable Table with Running Balance and Action Buttons */}
              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/50 shadow-inner">
                <table className="w-full text-right text-xs min-w-[1150px]">
                  <thead className="bg-slate-900/90 text-slate-400 text-[11px] font-bold border-b border-slate-800 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3 w-44">اسم الحساب</th>
                      <th className="p-3 w-24">النوع</th>
                      <th className="p-3 w-32">التاريخ</th>
                      <th className="p-3 min-w-[180px]">البيان والتفاصيل</th>
                      <th className="p-3 w-20 text-center">الكمية</th>
                      <th className="p-3 w-24 text-center">سعر الوحدة</th>
                      <th className="p-3 w-24 text-center">الزيادات (+)</th>
                      <th className="p-3 w-28 text-center">الإجمالي المحسوب</th>
                      <th className="p-3 w-24 text-center">العملة</th>
                      <th className="p-3 w-32 text-center bg-slate-900/95 border-x border-slate-800">الرصيد التراكمي</th>
                      <th className="p-3 w-24 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {parsedPreviewRows.map((row, idx) => {
                      const hasCurrencyIssue = isRowCurrencyMismatched(row);
                      return (
                        <tr 
                          key={row.id} 
                          className={`transition-colors ${
                            row.isEdited 
                              ? "bg-indigo-500/5 hover:bg-indigo-500/10" 
                              : hasCurrencyIssue 
                              ? "bg-amber-500/5 hover:bg-amber-500/10" 
                              : "hover:bg-slate-850/60"
                          }`}
                        >
                          {/* Index with edit indicator */}
                          <td className="p-3 text-slate-400 font-mono text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span>{idx + 1}</span>
                              {row.isEdited && (
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="تم تعديل هذا السطر" />
                              )}
                            </div>
                          </td>

                          {/* Account Name */}
                          <td className="p-2">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <input 
                                  type="text" 
                                  value={row.accountName} 
                                  onChange={(e) => updatePreviewRow(row.id, "accountName", e.target.value)}
                                  className={`w-full bg-slate-900 border ${row.matchConfidence === 'high' || row.isVerified ? 'border-emerald-500/30 focus:border-emerald-500' : row.matchConfidence === 'medium' ? 'border-amber-500/30 focus:border-amber-500' : 'border-rose-500/30 focus:border-rose-500'} rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold outline-none`}
                                  placeholder="اسم الحساب"
                                />
                                {row.matchConfidence === 'high' || row.isVerified ? (
                                  <span className="shrink-0 p-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20" title="High Confidence Match (Verified)">
                                    <Check size={14} />
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => updatePreviewRow(row.id, "isVerified", true)}
                                    className="shrink-0 px-2 py-1 text-[10px] font-bold rounded-md bg-slate-800 text-slate-300 border border-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all cursor-pointer"
                                  >
                                    Verify
                                  </button>
                                )}
                              </div>
                              {!row.isVerified && row.matchConfidence && row.matchConfidence !== 'high' && (
                                <span className={`text-[9.5px] font-bold ${row.matchConfidence === 'medium' ? 'text-amber-400' : 'text-rose-400'}`}>
                                  {row.matchConfidence === 'medium' ? 'Medium Confidence Match' : 'Low Confidence Match'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Account Type */}
                          <td className="p-2">
                            <select
                              value={row.accountType}
                              onChange={(e) => updatePreviewRow(row.id, "accountType", e.target.value as "supplier" | "buyer")}
                              className={`w-full rounded-lg px-2 py-1.5 text-xs font-bold outline-none cursor-pointer border ${
                                row.accountType === "supplier"
                                  ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                  : "bg-blue-500/10 text-blue-300 border-blue-500/30"
                              }`}
                            >
                              <option value="buyer" className="bg-slate-900 text-white">عميل</option>
                              <option value="supplier" className="bg-slate-900 text-white">مورد</option>
                            </select>
                          </td>

                          {/* Date */}
                          <td className="p-2">
                            <input 
                              type="date" 
                              value={row.date} 
                              onChange={(e) => updatePreviewRow(row.id, "date", e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none font-mono"
                            />
                          </td>

                          {/* Description */}
                          <td className="p-2">
                            <input 
                              type="text" 
                              value={row.description} 
                              onChange={(e) => updatePreviewRow(row.id, "description", e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                              placeholder="تفاصيل القيد"
                            />
                          </td>

                          {/* Calculated Field: Quantity */}
                          <td className="p-2">
                            <input 
                              type="number" 
                              step="any"
                              value={row.quantity} 
                              onChange={(e) => updatePreviewRow(row.id, "quantity", parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-center focus:border-indigo-500 outline-none"
                              title="الكمية"
                            />
                          </td>

                          {/* Calculated Field: Unit Price */}
                          <td className="p-2">
                            <input 
                              type="number" 
                              step="any"
                              value={row.unitPrice} 
                              onChange={(e) => updatePreviewRow(row.id, "unitPrice", parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-center focus:border-indigo-500 outline-none"
                              title="سعر المفرد"
                            />
                          </td>

                          {/* Calculated Field: Extra Charges */}
                          <td className="p-2">
                            <input 
                              type="number" 
                              step="any"
                              value={row.extraCharges} 
                              onChange={(e) => updatePreviewRow(row.id, "extraCharges", parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-amber-300 font-mono text-center focus:border-indigo-500 outline-none"
                              title="المصاريف والزيادات الإضافية"
                            />
                          </td>

                          {/* Calculated Field: Total (with formula auto-sync or manual override) */}
                          <td className="p-2">
                            <div className="relative">
                              <input 
                                type="number" 
                                step="any"
                                value={row.total} 
                                onChange={(e) => updatePreviewRow(row.id, "total", parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-900 border border-emerald-500/40 focus:border-emerald-400 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-emerald-400 text-center outline-none"
                                title="الإجمالي المحسوب = (الكمية × السعر) + الزيادات"
                              />
                            </div>
                          </td>

                          {/* Currency */}
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <select
                                value={row.currency || "YER"}
                                onChange={(e) => updatePreviewRow(row.id, "currency", e.target.value)}
                                className={`w-full rounded-lg px-2 py-1.5 text-xs font-mono font-bold outline-none cursor-pointer border ${
                                  hasCurrencyIssue
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    : "bg-slate-900 text-slate-200 border-slate-800"
                                }`}
                              >
                                <option value="YER">YER</option>
                                <option value="SAR">SAR</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                              </select>
                              {hasCurrencyIssue && (
                                <span title="عملة القيد تختلف عن عملة الحساب المحدد" className="text-amber-400 shrink-0">
                                  <AlertTriangle size={13} />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Cumulative Running Balance per row */}
                          <td className="p-2 bg-slate-900/40 border-x border-slate-800/80 font-mono text-center whitespace-nowrap">
                            <div className="flex flex-col items-center justify-center">
                              <span className={`text-xs font-black ${
                                row.runningBalance > 0
                                  ? "text-emerald-400"
                                  : row.runningBalance < 0
                                  ? "text-amber-400"
                                  : "text-slate-400"
                              }`}>
                                {row.runningBalance?.toLocaleString()}
                              </span>
                              <span className="text-[9px] text-slate-500 font-sans">
                                {row.runningBalance > 0 ? "مدين (+)" : row.runningBalance < 0 ? "دائن (-)" : "متزن"}
                              </span>
                            </div>
                          </td>

                          {/* Action Buttons: Edit Modal, Duplicate, Delete */}
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Edit Modal Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(row)}
                                className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                                title="تعديل تفصيلي مع الحاسبة"
                              >
                                <Edit2 size={13} />
                              </button>

                              {/* Duplicate Row Button */}
                              <button
                                type="button"
                                onClick={() => duplicatePreviewRow(row.id)}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                title="تكرار هذا الصف"
                              >
                                <Copy size={13} />
                              </button>

                              {/* Delete Row Button */}
                              <button
                                type="button"
                                onClick={() => deletePreviewRow(row.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="حذف هذا السطر"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Summary Footer Row */}
                  <tfoot className="bg-slate-900/95 border-t-2 border-slate-700 text-slate-200 font-bold text-xs sticky bottom-0">
                    <tr>
                      <td colSpan={5} className="p-3 text-right">
                        <span className="font-extrabold text-white">إجمالي كافة القيود المستوردة ({previewTotals.rowCount} سجل):</span>
                      </td>
                      <td className="p-3 text-center font-mono text-indigo-400">
                        {previewTotals.totalQty?.toLocaleString()}
                      </td>
                      <td className="p-3 text-center text-slate-500 text-[10px]">
                        -
                      </td>
                      <td className="p-3 text-center font-mono text-amber-400">
                        {previewTotals.totalExtra?.toLocaleString()}
                      </td>
                      <td className="p-3 text-center font-mono text-emerald-400 text-sm">
                        {previewTotals.grandTotal?.toLocaleString()}
                      </td>
                      <td className="p-3 text-center text-slate-400 text-[10px]">
                        {Object.keys(previewTotals.currencyMap).join(" / ") || "YER"}
                      </td>
                      <td className="p-3 text-center font-mono bg-slate-900 border-x border-slate-800">
                        <span className={`text-sm ${
                          previewTotals.finalBalance > 0 
                            ? "text-emerald-400" 
                            : previewTotals.finalBalance < 0 
                            ? "text-amber-400" 
                            : "text-slate-300"
                        }`}>
                          {previewTotals.finalBalance?.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={addNewPreviewRow}
                          className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-md transition-colors"
                        >
                          + إضافة
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Edit Row Modal */}
              {editingModalRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl space-y-5 text-right">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <Edit2 size={18} />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white">تعديل القيد المالي المحسوب</h3>
                          <p className="text-[11px] text-slate-400">تحديث البيانات مع الاحتساب الفوري للرصيد والإجمالي</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingModalRow(null)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="space-y-4 text-xs">
                      {/* Account and Type */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-bold mb-1.5">اسم الحساب:</label>
                          <input
                            type="text"
                            value={editingModalRow.accountName}
                            onChange={(e) => setEditingModalRow({ ...editingModalRow, accountName: e.target.value })}
                            list="modal-existing-accounts"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold outline-none focus:border-indigo-500"
                            placeholder="حدد أو اكتب الحساب"
                          />
                          <datalist id="modal-existing-accounts">
                            {db.accounts.map(a => (
                              <option key={a.id} value={a.name} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1.5">نوع الحساب:</label>
                          <select
                            value={editingModalRow.accountType}
                            onChange={(e) => setEditingModalRow({ ...editingModalRow, accountType: e.target.value as "supplier" | "buyer" })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-indigo-500"
                          >
                            <option value="buyer">عميل (مدين / عليه)</option>
                            <option value="supplier">مورد (دائن / له)</option>
                          </select>
                        </div>
                      </div>

                      {/* Date & Currency */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 font-bold mb-1.5">تاريخ القيد:</label>
                          <input
                            type="date"
                            value={editingModalRow.date}
                            onChange={(e) => setEditingModalRow({ ...editingModalRow, date: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1.5">العملة:</label>
                          <select
                            value={editingModalRow.currency || "YER"}
                            onChange={(e) => setEditingModalRow({ ...editingModalRow, currency: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-indigo-500"
                          >
                            <option value="YER">YER (ريال يمني)</option>
                            <option value="SAR">SAR (ريال سعودي)</option>
                            <option value="USD">USD (دولار أمريكي)</option>
                            <option value="EUR">EUR (يورو)</option>
                          </select>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-slate-300 font-bold mb-1.5">البيان والتفاصيل:</label>
                        <input
                          type="text"
                          value={editingModalRow.description}
                          onChange={(e) => setEditingModalRow({ ...editingModalRow, description: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                          placeholder="وصف العملية المالية"
                        />
                      </div>

                      {/* Calculated Fields: Quantity, Unit Price, Extra Charges */}
                      <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                        <div>
                          <label className="block text-slate-400 text-[11px] mb-1">الكمية:</label>
                          <input
                            type="number"
                            step="any"
                            value={editingModalRow.quantity}
                            onChange={(e) => {
                              const q = parseFloat(e.target.value) || 0;
                              const p = Number(editingModalRow.unitPrice) || 0;
                              const ex = Number(editingModalRow.extraCharges) || 0;
                              setEditingModalRow({
                                ...editingModalRow,
                                quantity: q,
                                total: Math.round(((q * p) + ex) * 100) / 100
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-center outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[11px] mb-1">سعر الوحدة:</label>
                          <input
                            type="number"
                            step="any"
                            value={editingModalRow.unitPrice}
                            onChange={(e) => {
                              const p = parseFloat(e.target.value) || 0;
                              const q = Number(editingModalRow.quantity) || 0;
                              const ex = Number(editingModalRow.extraCharges) || 0;
                              setEditingModalRow({
                                ...editingModalRow,
                                unitPrice: p,
                                total: Math.round(((q * p) + ex) * 100) / 100
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono text-center outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[11px] mb-1">الزيادات (+):</label>
                          <input
                            type="number"
                            step="any"
                            value={editingModalRow.extraCharges}
                            onChange={(e) => {
                              const ex = parseFloat(e.target.value) || 0;
                              const q = Number(editingModalRow.quantity) || 0;
                              const p = Number(editingModalRow.unitPrice) || 0;
                              setEditingModalRow({
                                ...editingModalRow,
                                extraCharges: ex,
                                total: Math.round(((q * p) + ex) * 100) / 100
                              });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-amber-300 font-mono text-center outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Live Formula Indicator & Total Override */}
                      <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">معادلة الاحتساب:</span>
                          <span className="text-emerald-400 font-mono font-bold text-xs">
                            ({editingModalRow.quantity} × {editingModalRow.unitPrice}) + {editingModalRow.extraCharges} = {Math.round(((Number(editingModalRow.quantity) * Number(editingModalRow.unitPrice)) + Number(editingModalRow.extraCharges)) * 100) / 100}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                          <div className="flex-1">
                            <label className="block text-emerald-300 font-bold mb-1">الإجمالي النهائي:</label>
                            <input
                              type="number"
                              step="any"
                              value={editingModalRow.total}
                              onChange={(e) => setEditingModalRow({
                                ...editingModalRow,
                                total: parseFloat(e.target.value) || 0
                              })}
                              className="w-full bg-slate-900 border border-emerald-500/50 rounded-xl px-3 py-2 text-emerald-400 font-mono font-black text-sm outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const q = Number(editingModalRow.quantity) || 0;
                              const p = Number(editingModalRow.unitPrice) || 0;
                              const ex = Number(editingModalRow.extraCharges) || 0;
                              setEditingModalRow({
                                ...editingModalRow,
                                total: Math.round(((q * p) + ex) * 100) / 100
                              });
                            }}
                            className="px-3 py-2 mt-5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                            title="إعادة تطبيق المعادلة (الكمية × السعر + الزيادات)"
                          >
                            تطبيق المعادلة
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setEditingModalRow(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEditedModalRow(editingModalRow)}
                        className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                      >
                        <Check size={15} />
                        <span>حفظ التعديلات</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SECTION 2: AI VISION & CAMERA ANALYSIS                 */}
      {/* ========================================================= */}
      {activePortalSection === "ai_vision" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Camera className="text-blue-400" size={20} />
                  التحليل التلقائي بالذكاء الاصطناعي للمستندات والفواتير المصورة
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  التقط صورة بالكاميرا أو ارفع فاتورة، ليتكفل محرك الرؤية الذكي باستخراج الأسماء، التواريخ، البنود، والمبالغ.
                </p>
              </div>

              {/* Action Buttons for Camera & Gallery */}
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <input 
                  type="file" 
                  ref={cameraFileInputRef}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) handleAIPhotoUpload(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
                <input 
                  type="file" 
                  ref={imageFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) handleAIPhotoUpload(e.target.files[0]);
                    e.target.value = "";
                  }}
                />

                <button
                  type="button"
                  onClick={() => cameraFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Camera size={16} />
                  <span>التقاط بكاميرا الهاتف</span>
                </button>

                <button
                  type="button"
                  onClick={() => imageFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
                >
                  <ImageIcon size={16} className="text-indigo-400" />
                  <span>اختيار صورة من الجهاز</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop Area for Images */}
            {!analyzedFile && (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => {
                  if (importLoading) return;
                  imageFileInputRef.current?.click();
                }}
                className={`border-2 border-dashed rounded-3xl p-6 sm:p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                  dragActive 
                    ? "border-blue-500 bg-blue-500/10 scale-99 shadow-2xl" 
                    : "border-slate-750 hover:border-blue-400/80 bg-slate-950/40 hover:bg-slate-900/60"
                }`}
              >
                {importLoading ? (
                  <div className="w-full max-w-md mx-auto py-3 px-2 space-y-5 animate-in fade-in">
                    {/* Header with spinning indicator and percentage */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl animate-pulse">
                          <RefreshCw size={24} className="animate-spin" />
                        </div>
                        <div className="text-right">
                          <h4 className="text-sm font-extrabold text-white">{loadingStep || "جاري معالجة الفاتورة..."}</h4>
                          <p className="text-[11px] text-slate-400">{loadingDetail || "الذكاء الاصطناعي يستخرج الحسابات والبنود في ثوانٍ"}</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                        {progressPercent}%
                      </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div 
                        className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* 4-Stage Stepper Track */}
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] pt-1">
                      {/* Stage 1: Reading */}
                      <div className={`flex flex-col items-center gap-1.5 transition-colors ${
                        progressPhase === "reading" ? "text-blue-300 font-bold" : (progressPercent > 20 ? "text-emerald-400 font-semibold" : "text-slate-500")
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border transition-all ${
                          progressPhase === "reading" ? "border-blue-400 bg-blue-500/30 text-white animate-bounce" : (progressPercent > 20 ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-slate-800 bg-slate-900 text-slate-500")
                        }`}>
                          {progressPercent > 20 ? <Check size={12} /> : "1"}
                        </div>
                        <span>قراءة الصورة</span>
                      </div>

                      {/* Stage 2: Analyzing */}
                      <div className={`flex flex-col items-center gap-1.5 transition-colors ${
                        progressPhase === "analyzing" ? "text-blue-300 font-bold" : (progressPercent > 55 ? "text-emerald-400 font-semibold" : "text-slate-500")
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border transition-all ${
                          progressPhase === "analyzing" ? "border-blue-400 bg-blue-500/30 text-white animate-bounce" : (progressPercent > 55 ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-slate-800 bg-slate-900 text-slate-500")
                        }`}>
                          {progressPercent > 55 ? <Check size={12} /> : "2"}
                        </div>
                        <span>تحليل الذكاء</span>
                      </div>

                      {/* Stage 3: Validating */}
                      <div className={`flex flex-col items-center gap-1.5 transition-colors ${
                        progressPhase === "validating" ? "text-amber-300 font-bold" : (progressPercent > 85 ? "text-emerald-400 font-semibold" : "text-slate-500")
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border transition-all ${
                          progressPhase === "validating" ? "border-amber-400 bg-amber-500/30 text-white animate-bounce" : (progressPercent > 85 ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-slate-800 bg-slate-900 text-slate-500")
                        }`}>
                          {progressPercent > 85 ? <Check size={12} /> : "3"}
                        </div>
                        <span>فحص العملات</span>
                      </div>

                      {/* Stage 4: Ready */}
                      <div className={`flex flex-col items-center gap-1.5 transition-colors ${
                        progressPhase === "ready" || progressPercent === 100 ? "text-emerald-300 font-bold" : "text-slate-500"
                      }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border transition-all ${
                          progressPhase === "ready" || progressPercent === 100 ? "border-emerald-400 bg-emerald-500/30 text-emerald-300" : "border-slate-800 bg-slate-900 text-slate-500"
                        }`}>
                          {progressPercent === 100 ? <Check size={12} /> : "4"}
                        </div>
                        <span>جاهز للمراجعة</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
                      <Camera size={32} />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-bold text-white">
                        اسحب وأفلت صورة الفاتورة هنا، أو استخدم أزرار الكاميرا والمعرض بالأعلى
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        ندعم الفواتير الورقية، السندات المطبوعة واليدوية، وصور الشاشات (JPG, PNG, WEBP)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Currency Conflict Banner for AI Vision */}
          {analyzedFile && currencyConflict && currencyConflict.detected && (
            <div className="p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-3xl space-y-2 animate-in fade-in">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-amber-400 shrink-0" />
                <div className="text-right">
                  <h4 className="text-xs sm:text-sm font-black text-amber-200">
                    تنبيه تعارض العملات: عملة الفاتورة المكتشفة ({currencyConflict.docCurrencies.join(', ')}) تختلف عن عملة الحساب ({currencyConflict.accountCurrency})
                  </h4>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    تم رصد اختلاف العملات لحماية الدفاتر المحاسبية. سيتم طلب تأكيدك وتخييرك بين توحيد العملة أو الإبقاء عليها عند الضغط على "اعتماد القيد المحاسبي".
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Document Review Preview using existing component */}
          {analyzedFile && analysisResult && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <DocumentReviewPreview
                file={analyzedFile}
                analysis={analysisResult}
                onApprove={handleApproveAIAnalysis}
                onReject={handleRejectAIAnalysis}
              />
            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* 4. SECTION 3: CLOUD SYNC & MULTI-DEVICE (PRESERVED)       */}
      {/* ========================================================= */}
      {activePortalSection === "cloud_sync" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT / MAIN COLUMN: Cloud Auth & Pairing Guide */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Cloud Connector Box */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-md space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <DbIcon className="text-indigo-400" size={20} />
                    <span className="text-sm font-black text-white">بوابة الربط السحابي (Android / Windows / Web)</span>
                  </div>
                  <span className={`w-3 h-3 rounded-full ${syncEnabled ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                </div>

                {!user ? (
                  <div className="text-center py-6 space-y-4">
                    <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                      سجل الدخول بـ Google لإنشاء جسر مزامنة فوري يربط قيودك مباشرة عبر هاتفك الأندرويد، اللابتوب المكتبي والويب.
                    </p>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95 inline-flex items-center gap-2"
                    >
                      <LogIn size={16} />
                      <span>تسجيل الدخول وربط السحاب بـ Google</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* User profile */}
                    <div className="flex items-center justify-between bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                      <div>
                        <span className="text-sm font-black text-white block">{user.displayName || "مستعمل نظام ANAS"}</span>
                        <span className="text-xs text-slate-400 block font-mono">{user.email}</span>
                      </div>
                      <button 
                        onClick={handleLogout}
                        className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors rounded-xl cursor-pointer"
                        title="تسجيل الخروج"
                      >
                        <LogOut size={16} />
                      </button>
                    </div>

                    {/* Sync switch */}
                    <div className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                      <div>
                        <span className="text-xs sm:text-sm font-black text-white block">تشغيل مزامنة البيانات السحابية</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">ربط فوري وحقن تلقائي للقيود بين الويب والويندوز والموبايل.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={syncEnabled}
                          onChange={(e) => toggleSync(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    {/* Windows Exclude Toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                      <div>
                        <span className="text-xs sm:text-sm font-black text-rose-400 block">استثناء جهاز الويندوز الحالي من المزامنة</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">يقوم بالمزامنة تلقائياً لجميع مستخدمي هواتف الأندرويد لسلامتك.</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={excludeWindowsSync}
                          onChange={(e) => toggleExcludeWindowsSync(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                      </label>
                    </div>

                    {/* Push button */}
                    {syncEnabled && (
                      <button
                        type="button"
                        disabled={syncStatus === "syncing"}
                        onClick={pushLocalDataToCloud}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                      >
                        <RefreshCw size={14} className={syncStatus === "syncing" ? "animate-spin" : ""} />
                        <span>دفع وتحديث البيانات المحاسبية يدوياً للسحابة</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Hardware Pairing Guide */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <Monitor className="text-indigo-400" size={18} />
                  <span className="text-xs sm:text-sm font-black text-white">كيفية ربط الموبايل (Android) بنسخة الكمبيوتر (Windows)؟</span>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                    <p>من هاتفك الأندرويد، اذهب إلى شاشة المزامنة والربط وسجل دخول بنفس حساب Google.</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                    <p>انسخ رمز الاقتران الموضح بالأسفل أو امسح الباركود للربط اللحظي المشفر.</p>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2 mt-2">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">رمز الاقتران السحابي الآمن (Secure Pair Code)</span>
                    <div className="font-mono text-sm font-black tracking-widest text-indigo-400 bg-slate-900 py-2 rounded-xl border border-slate-800">
                      {user ? `ANAS-${user.uid.substring(0, 5).toUpperCase()}-${user.uid.substring(user.uid.length - 4).toUpperCase()}` : "ANAS-DEMO-AUTH-REQUIRED"}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Simulator & Live Console */}
            <div className="lg:col-span-4 space-y-6">
              
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <SmartphoneIcon className="text-indigo-400" size={18} />
                  <span className="text-xs sm:text-sm font-black text-white">محاكي منصات أندرويد</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  محاكي عملي متصل بقناة المزامنة. جرب إرسال قيد وستشاهد كيف ينعكس فورياً في كشوفاتك!
                </p>

                <button
                  type="button"
                  disabled={!user || !syncEnabled || isSimulatingAndroid}
                  onClick={async () => {
                    if (!user || !syncEnabled) return;
                    setIsSimulatingAndroid(true);
                    addLog("جاري محاكاة: إدخال قيد مبيعات فوري من تطبيق Android...");
                    try {
                      const docRef = doc(firestore, "user_databases", user.uid);
                      const randomId = `entry_android_${Date.now()}`;
                      const androidEntry: DailyLedgerEntry = {
                        id: randomId,
                        dayNumber: 1,
                        date: new Date().toISOString().split("T")[0],
                        description: "مبيعات فورية مستلمة [تطبيق أندرويد المحمول]",
                        quantity: 1,
                        unitPrice: 5000,
                        extraCharges: 0,
                        total: 5000,
                        transactionType: "debit"
                      };
                      db.dailyEntries.push(androidEntry);
                      db.save();
                      onDatabaseUpdate();
                      addLog("تم استقبال القيد من هاتف الأندرويد وحفظه محلياً بنجاح!");
                    } catch (e: any) {
                      addLog(`خطأ في المحاكاة: ${e.message}`);
                    } finally {
                      setIsSimulatingAndroid(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Smartphone size={16} className="text-indigo-400" />
                  <span>{isSimulatingAndroid ? "بث إشارة أندرويد..." : "محاكاة قيد من تطبيق Android"}</span>
                </button>

                {/* Console Logs */}
                <div className="space-y-1 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 block font-mono">سجلات المزامنة الحية:</span>
                  <div className="bg-slate-950 p-3 rounded-2xl font-mono text-[10px] text-emerald-400 border border-slate-800 max-h-48 overflow-y-auto space-y-1" dir="ltr">
                    {syncLogs.length === 0 ? (
                      <span className="text-slate-500 block text-center">لا توجد حركات مزامنة مسجلة حالياً...</span>
                    ) : (
                      syncLogs.map((log, idx) => <div key={idx}>{log}</div>)
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Guidelines info card for file preparation */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 flex gap-4 text-right">
        <HelpCircle size={22} className="text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <span className="font-black text-white">إرشادات تنسيق ملفات الاستيراد والعمل أوفلاين:</span>
          <ul className="text-slate-400 space-y-1 list-disc list-inside text-[11px] leading-relaxed">
            <li><strong className="text-emerald-400">التشغيل الكامل بدون اتصال (Offline-first):</strong> استيراد ملفات Excel ومعاينة الحسابات يعمل محلياً 100% دون الحاجة لأي اتصال بالإنترنت أو تسجيل دخول.</li>
            <li>تحميل <strong className="text-emerald-400">نموذج Excel المعتمد</strong> يمنحك الهيكلة القياسية المعتمدة للأعمدة (اسم الحساب، النوع، التاريخ، البيان، الكمية، السعر، الإجمالي).</li>
            <li>تدعم بوابة الذكاء الاصطناعي تفريغ الفواتير الورقية والمصورة مباشرة عبر كاميرا الهاتف مع فحص درجة الثقة ومراجعة الحقول قبل الاعتماد.</li>
            <li>يتم فحص وتجاوز السجلات المكررة آلياً لمنع تكرار القيود أو تضارب الحسابات.</li>
          </ul>
        </div>
      </div>

      {/* Currency Confirmation Modal */}
      {showCurrencyConfirmModal && currencyConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 max-w-lg w-full rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle size={22} />
                <h3 className="text-base font-black text-white">تأكيد معالجة تعارض العملات</h3>
              </div>
              <button 
                onClick={() => setShowCurrencyConfirmModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">عملة المستند المكتشفة:</span>
                  <span className="font-mono font-black text-amber-300 text-sm">{currencyConflict.docCurrencies.join(', ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">عملة الحساب {currencyConflict.accountName ? `(${currencyConflict.accountName})` : ''}:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">{currencyConflict.accountCurrency}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-amber-500/20">
                  <span className="text-slate-400">القيود المتأثرة باختلاف العملة:</span>
                  <span className="font-bold text-white">{currencyConflict.mismatchedRowCount} من أصل {currencyConflict.totalRows}</span>
                </div>
              </div>

              <p className="text-slate-400">
                نظام ANAS المحاسبي ينبهك بأن ترحيل مبالغ بعملة مختلفة إلى هذا الحساب قد يؤثر على صحة الأرصدة والدفاتر. يُرجى اختيار طريقة المعالجة المعتمدة:
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleUnifyCurrency(currencyConflict.accountCurrency);
                  setShowCurrencyConfirmModal(false);
                  if (activePortalSection === "structured") {
                    confirmFinalStructuredImport(true);
                  } else if (analysisResult) {
                    handleApproveAIAnalysis(analysisResult, true);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 p-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-2xl shadow-lg shadow-indigo-600/20 cursor-pointer transition-all"
              >
                <Coins size={16} />
                <span>توحيد العملة إلى ({currencyConflict.accountCurrency}) وترحيل القيود</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrencyMismatchAcknowledged(true);
                  setShowCurrencyConfirmModal(false);
                  if (activePortalSection === "structured") {
                    confirmFinalStructuredImport(true);
                  } else if (analysisResult) {
                    handleApproveAIAnalysis(analysisResult, true);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl border border-slate-700 cursor-pointer transition-all"
              >
                <span>متابعة الترحيل بالعملات الأصلية المسجلة في المستند</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCurrencyConfirmModal(false)}
                className="w-full py-2.5 text-center text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                إلغاء والعودة لجدول المراجعة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
