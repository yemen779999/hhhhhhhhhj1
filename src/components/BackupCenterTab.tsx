import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, Cloud, Download, Trash2, RefreshCw, HardDrive, ShieldCheck, 
  AlertCircle, Clock, Save, FileDown, FileJson, Upload, CheckCircle2, 
  AlertTriangle, Layers, FileText, Users, X, Database as DbIcon, Shield
} from 'lucide-react';
import { BackupService, BackupMetadata } from '../backupService';
import { Database } from '../utils';

interface BackupCenterTabProps {
  isPro?: boolean;
  onNavigateToSubscription?: () => void;
  db: Database;
  authUser: any;
  onRestore: () => void;
}

export const BackupCenterTab: React.FC<BackupCenterTabProps> = ({ 
  db, 
  authUser, 
  onRestore, 
  isPro = false, 
  onNavigateToSubscription 
}) => {
  // Cloud backups state
  const [backups, setBackups] = useState<{ driveId: string, metadata: BackupMetadata }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // Cloud Settings state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(localStorage.getItem('smartacc_auto_backup') !== 'false');
  const [backupInterval, setBackupInterval] = useState(parseInt(localStorage.getItem('smartacc_backup_interval') || '48', 10));
  const [wifiOnly, setWifiOnly] = useState(localStorage.getItem('smartacc_backup_wifi_only') === 'true');
  const [keepLimit, setKeepLimit] = useState(parseInt(localStorage.getItem('smartacc_backup_keep_limit') || '10', 10));

  // Local JSON Backup state
  const [localSuccessMsg, setLocalSuccessMsg] = useState<string | null>(null);
  const [localErrorMsg, setLocalErrorMsg] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedFileData, setImportedFileData] = useState<any | null>(null);
  const [importedFileName, setImportedFileName] = useState<string>('');
  const [importedFileSize, setImportedFileSize] = useState<string>('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [hasSafetyBackup, setHasSafetyBackup] = useState<boolean>(
    () => !!localStorage.getItem('smartacc_safety_backup_before_import')
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupService = authUser ? new BackupService(authUser.uid) : null;
  const restriction = db.checkLimitOrPro('backup', isPro);

  useEffect(() => {
    if (authUser && restriction.allowed) {
      fetchBackups();
    }
  }, [authUser, restriction.allowed]);

  useEffect(() => {
    localStorage.setItem('smartacc_auto_backup', autoBackupEnabled.toString());
    localStorage.setItem('smartacc_backup_interval', backupInterval.toString());
    localStorage.setItem('smartacc_backup_wifi_only', wifiOnly.toString());
    localStorage.setItem('smartacc_backup_keep_limit', keepLimit.toString());
  }, [autoBackupEnabled, backupInterval, wifiOnly, keepLimit]);

  const fetchBackups = async () => {
    if (!backupService) return;
    setLoading(true);
    try {
      const list = await backupService.listBackups();
      setBackups(list);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'فشل في جلب النسخ السحابية');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLog = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backups.map(b => b.metadata), null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `backup_log_${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleBackupNow = async () => {
    if (!backupService) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setProgress(20);
    try {
      const state = db.exportState();
      setProgress(50);
      await backupService.uploadBackup(state, 'Full');
      setProgress(100);
      setSuccessMsg('تم إنشاء النسخة الاحتياطية ورفعها إلى السحابة بنجاح.');
      await fetchBackups();
      localStorage.setItem('smartacc_last_auto_backup_ts', Date.now().toString());
    } catch (err: any) {
      setError(err.message || 'فشل النسخ الاحتياطي السحابي');
    } finally {
      setTimeout(() => setProgress(null), 1000);
      setLoading(false);
    }
  };

  const handleRestore = async (driveId: string) => {
    if (!backupService) return;
    const confirm = window.confirm('هل أنت متأكد من استعادة هذه النسخة؟ سيتم دمج أو استبدال البيانات الحالية.');
    if (!confirm) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setProgress(10);
    try {
      const currentState = db.exportState();
      localStorage.setItem('smartacc_safety_backup', JSON.stringify(currentState));
      setProgress(30);

      const backupData = await backupService.downloadBackup(driveId);
      setProgress(70);

      db.importState(backupData);
      onRestore();
      
      setProgress(100);
      setSuccessMsg('تمت استعادة النسخة الاحتياطية بنجاح.');
    } catch (err: any) {
      setError(err.message || 'فشلت عملية الاستعادة السحابية');
    } finally {
      setTimeout(() => setProgress(null), 1000);
      setLoading(false);
    }
  };

  const handleDelete = async (driveId: string) => {
    if (!backupService) return;
    const confirm = window.confirm('هل أنت متأكد من حذف هذه النسخة الاحتياطية نهائياً من السحابة؟');
    if (!confirm) return;

    setLoading(true);
    try {
      await backupService.deleteBackup(driveId);
      setSuccessMsg('تم حذف النسخة بنجاح.');
      await fetchBackups();
    } catch (err: any) {
      setError(err.message || 'فشل الحذف');
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalUsedSpace = backups.reduce((acc, curr) => acc + (curr.metadata.size || 0), 0);

  // -------------------------------------------------------------
  // LOCAL JSON EXPORT / IMPORT ENGINE (Local-First, Zero Cloud Dependency)
  // -------------------------------------------------------------

  const handleExportJson = () => {
    setLocalErrorMsg(null);
    setLocalSuccessMsg(null);
    try {
      const state = db.exportState();
      const now = new Date();
      
      const pad = (n: number) => n.toString().padStart(2, '0');
      const year = now.getFullYear();
      const month = pad(now.getMonth() + 1);
      const day = pad(now.getDate());
      const hours = pad(now.getHours());
      const minutes = pad(now.getMinutes());
      const seconds = pad(now.getSeconds());
      
      const fileName = `backup_${year}-${month}-${day}_${hours}${minutes}${seconds}.json`;
      
      const summary = {
        accounts: state.accounts?.length || 0,
        transactions: state.transactions?.length || 0,
        dailyEntries: state.dailyEntries?.length || 0,
        invoices: state.invoices?.length || 0,
        activityLogs: state.activityLogs?.length || 0,
        deletedRecords: (state.deletedAccounts?.length || 0) +
                        (state.deletedTransactions?.length || 0) +
                        (state.deletedDailyEntries?.length || 0) +
                        (state.deletedInvoices?.length || 0)
      };

      const backupPackage = {
        __app_backup: true,
        version: "2.5.0",
        exportDate: now.toISOString(),
        summary,
        data: state
      };

      const jsonString = JSON.stringify(backupPackage, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      db.logActivity(
        db.currentUser || 'Admin',
        'add',
        'account',
        'backup_export',
        `تصدير نسخة احتياطية محلية JSON (${fileName})`
      );

      setLocalSuccessMsg(`تم تصدير وتنزيل النسخة الاحتياطية بنجاح: ${fileName}`);
      setTimeout(() => setLocalSuccessMsg(null), 7000);
    } catch (err: any) {
      setLocalErrorMsg(err.message || 'فشل في تصدير ملف النسخة الاحتياطية');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalErrorMsg(null);
    setLocalSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || !text.trim()) {
          setLocalErrorMsg('الملف المختار فارغ تماماً.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch (jsonErr) {
          setLocalErrorMsg('الملف ليس ملف JSON صالحاً أو أنه تالف وغير قابل للقراءة.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        // Support both wrapped backup format (payload.data) and raw root object format
        let payload = parsed;
        if (parsed && typeof parsed === 'object') {
          if (parsed.data && typeof parsed.data === 'object') {
            const d = parsed.data;
            if (d.accounts || d.transactions || d.dailyEntries || d.invoices) {
              payload = d;
            }
          }
        }

        // Verify compatible accounting data structure
        const hasAccounts = Array.isArray(payload.accounts) && payload.accounts.length > 0;
        const hasTransactions = Array.isArray(payload.transactions) && payload.transactions.length > 0;
        const hasDailyEntries = Array.isArray(payload.dailyEntries) && payload.dailyEntries.length > 0;
        const hasInvoices = Array.isArray(payload.invoices) && payload.invoices.length > 0;

        if (!hasAccounts && !hasTransactions && !hasDailyEntries && !hasInvoices && !Array.isArray(payload.accounts) && !Array.isArray(payload.transactions)) {
          setLocalErrorMsg('الملف لا يحتوي على بنية بيانات محاسبية متوافقة (يجب أن يحتوي على الأقل على أحد الجداول: accounts أو transactions أو dailyEntries أو invoices).');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setImportedFileData(payload);
        setImportedFileName(file.name);
        setImportedFileSize(formatSize(file.size));
        setImportMode('merge');
        setShowImportModal(true);
      } catch (err: any) {
        setLocalErrorMsg('حدث خطأ أثناء معالجة ملف JSON: ' + (err.message || ''));
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      setLocalErrorMsg('تعذر قراءة الملف من الجهاز.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!importedFileData) return;
    try {
      // 1. Create a local emergency safety backup of current state in localStorage
      const currentState = db.exportState();
      localStorage.setItem('smartacc_safety_backup_before_import', JSON.stringify({
        timestamp: new Date().toISOString(),
        state: currentState
      }));
      setHasSafetyBackup(true);

      // 2. Perform import (merge or replace)
      db.importState(importedFileData, importMode);

      // 3. Log activity
      db.logActivity(
        db.currentUser || 'Admin',
        'restore',
        'account',
        'json_import',
        `استيراد ملف JSON (${importedFileName}) بنمط ${importMode === 'merge' ? 'الدمج مع البيانات الحالية' : 'الاستبدال الكامل'}`
      );

      // 4. Force refresh the entire UI
      onRestore();

      setShowImportModal(false);
      setImportedFileData(null);
      setLocalSuccessMsg(
        importMode === 'merge'
          ? 'تم استيراد ودمج البيانات بنجاح! تم تحديث السجلات وحفظ النسخ السابقة في سلة المحذوفات بأمان.'
          : 'تم استبدال كامل بيانات النظام بنجاح وتحديث كافة السجلات!'
      );
      setTimeout(() => setLocalSuccessMsg(null), 7000);
    } catch (err: any) {
      setLocalErrorMsg('حدث خطأ أثناء تنفيذ عملية الاستيراد: ' + (err.message || ''));
    }
  };

  const handleRestoreSafetyBackup = () => {
    const raw = localStorage.getItem('smartacc_safety_backup_before_import');
    if (!raw) return;
    const confirm = window.confirm('هل تريد استعادة نسخة الأمان التي تم أخذها تلقائياً قبل آخر عملية استيراد محلي؟');
    if (!confirm) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.state) {
        db.importState(parsed.state, 'replace');
        onRestore();
        setLocalSuccessMsg('تمت استعادة نسخة الأمان التلقائية بنجاح.');
        setTimeout(() => setLocalSuccessMsg(null), 6000);
      }
    } catch (e: any) {
      setLocalErrorMsg('فشل استعادة نسخة الأمان: ' + e.message);
    }
  };

  return (
    <div className="space-y-10 pb-24 max-w-7xl mx-auto" dir="rtl">
      
      {/* ========================================================= */}
      {/* 1. LOCAL JSON BACKUP & RESTORE SECTION (100% LOCAL-FIRST) */}
      {/* ========================================================= */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Accent ambient glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        {/* Section Header */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
              <FileJson size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-xl font-black text-white">نسخ احتياطي محلي عبر ملف JSON</h2>
                <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  محلي بالكامل (Local-First)
                </span>
                <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-800 text-slate-300 rounded-full">
                  يعمل بدون إنترنت أو تسجيل دخول
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                تصدير واستيراد قاعدة بياناتك المحاسبية بالكامل في ملف JSON واحد. يشمل كافة الحسابات، القيود، الفواتير، اليوميات، سجلات المحذوفات، والإعدادات.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".json,application/json" 
              className="hidden" 
              id="json_backup_file_input"
            />
            
            {/* Import Button */}
            <button
              id="btn_import_json_backup"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2.5 px-5 py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-sm rounded-xl border border-slate-700 transition-all cursor-pointer shadow-lg hover:border-blue-500/40"
            >
              <Upload size={18} className="text-blue-400" />
              استيراد ودمج ملف JSON
            </button>

            {/* Export Button */}
            <button
              id="btn_export_json_backup"
              onClick={handleExportJson}
              className="flex items-center gap-2.5 px-6 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer hover:shadow-blue-600/30"
            >
              <Download size={18} />
              تصدير نسخة JSON كاملة
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {localSuccessMsg && (
          <div className="mt-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
              <span className="text-sm font-semibold">{localSuccessMsg}</span>
            </div>
            <button onClick={() => setLocalSuccessMsg(null)} className="text-emerald-400/60 hover:text-emerald-300 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        )}

        {localErrorMsg && (
          <div className="mt-5 bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-red-400 shrink-0" />
              <span className="text-sm font-semibold">{localErrorMsg}</span>
            </div>
            <button onClick={() => setLocalErrorMsg(null)} className="text-red-400/60 hover:text-red-300 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Live Database Content Metrics (What's included in backup) */}
        <div className="mt-6">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <DbIcon size={14} className="text-blue-400" />
            حالة البيانات الحالية في النظام (المضمنة في النسخة المحلية):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                <Users size={14} className="text-blue-400" /> الحسابات
              </div>
              <div className="text-xl font-extrabold text-white">{db.accounts.length}</div>
            </div>

            <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-400" /> القيود المالية
              </div>
              <div className="text-xl font-extrabold text-white">{db.transactions.length}</div>
            </div>

            <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                <Layers size={14} className="text-emerald-400" /> كشوفات اليومية
              </div>
              <div className="text-xl font-extrabold text-white">{db.dailyEntries.length}</div>
            </div>

            <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                <FileDown size={14} className="text-amber-400" /> الفواتير
              </div>
              <div className="text-xl font-extrabold text-white">{db.invoices.length}</div>
            </div>

            <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                <Trash2 size={14} className="text-rose-400" /> سلة المحذوفات
              </div>
              <div className="text-xl font-extrabold text-white">
                {db.deletedAccounts.length + db.deletedTransactions.length + db.deletedDailyEntries.length + db.deletedInvoices.length}
              </div>
            </div>

            <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                <Clock size={14} className="text-violet-400" /> سجل الأنشطة
              </div>
              <div className="text-xl font-extrabold text-white">{db.activityLogs.length}</div>
            </div>
          </div>
        </div>

        {/* Emergency Safety Backup Banner */}
        {hasSafetyBackup && (
          <div className="mt-5 p-3.5 bg-indigo-950/40 border border-indigo-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-indigo-400 shrink-0" />
              <span>توجد نسخة أمان طارئة تم أخذها تلقائياً قبل آخر عملية استيراد.</span>
            </div>
            <button
              onClick={handleRestoreSafetyBackup}
              className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 rounded-lg transition-colors cursor-pointer font-bold whitespace-nowrap"
            >
              استعادة نسخة الأمان السابقة
            </button>
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* PREVIEW & IMPORT CONFIRMATION MODAL                      */}
      {/* ========================================================= */}
      {showImportModal && importedFileData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl text-right animate-in zoom-in-95 duration-200 space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl">
                  <FileJson size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">معاينة وتأكيد استيراد ملف JSON</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5" dir="ltr">
                    <span className="font-mono text-slate-300 truncate max-w-[220px]">{importedFileName}</span>
                    <span>•</span>
                    <span>{importedFileSize}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { setShowImportModal(false); setImportedFileData(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content summary grid inside the file */}
            <div>
              <div className="text-xs font-bold text-slate-400 mb-2.5">البيانات التي تم العثور عليها في الملف:</div>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">الحسابات</div>
                  <div className="text-lg font-extrabold text-blue-400">
                    {importedFileData.accounts?.length || 0}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">القيود المالية</div>
                  <div className="text-lg font-extrabold text-indigo-400">
                    {importedFileData.transactions?.length || 0}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">كشوفات اليومية</div>
                  <div className="text-lg font-extrabold text-emerald-400">
                    {importedFileData.dailyEntries?.length || 0}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">الفواتير</div>
                  <div className="text-lg font-extrabold text-amber-400">
                    {importedFileData.invoices?.length || 0}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">سجل الأنشطة</div>
                  <div className="text-lg font-extrabold text-violet-400">
                    {importedFileData.activityLogs?.length || 0}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">سجلات المحذوفات</div>
                  <div className="text-lg font-extrabold text-rose-400">
                    {(importedFileData.deletedAccounts?.length || 0) + 
                     (importedFileData.deletedTransactions?.length || 0) + 
                     (importedFileData.deletedDailyEntries?.length || 0) + 
                     (importedFileData.deletedInvoices?.length || 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Import Mode Selection */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-400">اختر طريقة تنفيذ الاستيراد:</div>
              
              {/* Option 1: Merge */}
              <label 
                onClick={() => setImportMode('merge')}
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  importMode === 'merge'
                    ? 'bg-blue-600/10 border-blue-500 shadow-md shadow-blue-500/5'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70'
                }`}
              >
                <input
                  type="radio"
                  name="import_mode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="mt-1 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">دمج مع البيانات الحالية</span>
                    <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                      الخيار الافتراضي والموصى به
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    يضيف العناصر الجديدة غير الموجودة، ويحدّث العناصر التي تحمل نفس المعرّف (ID) بعد نقل نسختها القديمة إلى سلة المحذوفات بدلاً من فقدانها نهائياً، ولا يحذف أي بيانات حالية أخرى غير موجودة في الملف.
                  </p>
                </div>
              </label>

              {/* Option 2: Replace */}
              <label 
                onClick={() => setImportMode('replace')}
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  importMode === 'replace'
                    ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/70'
                }`}
              >
                <input
                  type="radio"
                  name="import_mode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="mt-1 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <div className="space-y-1">
                  <span className="font-bold text-sm text-white">استبدال كامل للبيانات</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    يحذف جميع البيانات الحالية في النظام ويستبدلها بالكامل بمحتوى الملف المستورد فقط (استخدم هذا الخيار عند الرغبة في الاستعادة الكاملة على جهاز جديد أو البدء بقاعدة جديدة).
                  </p>
                </div>
              </label>
            </div>

            {/* Safety Backup Warning */}
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-xs text-emerald-300">
              <ShieldCheck size={18} className="shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <span className="font-bold">حماية تلقائية من الأخطاء: </span>
                سيقوم النظام تلقائياً بإنشاء وحفظ نسخة أمان طارئة من بياناتك الحالية محلياً في المتصفح قبل تنفيذ الاستيراد لحمايتك من أي فقدان غير مقصود.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowImportModal(false); setImportedFileData(null); }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                id="btn_confirm_import_json"
                onClick={handleConfirmImport}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                تأكيد واستيراد البيانات
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CLOUD BACKUP SECTION (WITH EXISTING CLOUD LOGIC)       */}
      {/* ========================================================= */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Cloud size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                نظام النسخ الاحتياطي السحابي
              </h2>
              <p className="text-xs text-slate-400">
                مزامنة مشفرة ببروتوكول AES-256 عبر Google Cloud لحفظ بياناتك سحابياً
              </p>
            </div>
          </div>

          {authUser && restriction.allowed && (
            <button
              onClick={handleBackupNow}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20 cursor-pointer font-bold text-sm"
            >
              {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              نسخ سحابي الآن
            </button>
          )}
        </div>

        {/* Cloud Pro Restriction Card */}
        {!restriction.allowed ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-6 bg-slate-900/60 rounded-[2.5rem] border border-slate-800 shadow-sm mx-auto max-w-2xl animate-in fade-in zoom-in-95 duration-500" dir="rtl">
            <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 rounded-3xl flex items-center justify-center relative rotate-3">
              <Cloud size={40} />
              <Lock size={20} className="absolute -bottom-2 -right-2 bg-slate-900 text-white rounded-full p-1 border-2 border-white" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-white">النسخ الاحتياطي السحابي</h3>
              <p className="text-slate-400 text-sm font-bold leading-relaxed max-w-md mx-auto">
                {restriction.message}
              </p>
            </div>
            <button 
              onClick={onNavigateToSubscription}
              className="px-8 py-4 bg-indigo-600 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              الترقية للنسخة العادية الآن
            </button>
          </div>
        ) : !authUser ? (
          /* Cloud Auth Required Card */
          <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl">
            <ShieldCheck size={56} className="text-slate-600 mb-3" />
            <h3 className="text-lg font-bold text-white mb-1.5">تسجيل الدخول مطلوب للنسخ السحابي</h3>
            <p className="text-slate-400 text-sm max-w-md">
              يرجى تسجيل الدخول باستخدام حساب جوجل للوصول إلى نظام النسخ الاحتياطي السحابي المشفر ومزامنته عبر الأجهزة. (يمكنك استخدام النسخ المحلي JSON أعلاه بحرية تامة دون تسجيل دخول).
            </p>
          </div>
        ) : (
          /* Full Cloud Dashboard */
          <div className="space-y-6">
            {/* Progress Bar */}
            {progress !== null && (
              <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/10">
                <div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            )}

            {/* Cloud Alerts */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
                <AlertCircle size={20} />
                {error}
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3">
                <ShieldCheck size={20} />
                {successMsg}
              </div>
            )}

            {/* Cloud Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass p-5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <Clock size={20} />
                  </div>
                  <h3 className="font-semibold text-slate-400">أحدث نسخة سحابية</h3>
                </div>
                <p className="text-xl font-bold text-white">
                  {backups.length > 0 ? backups[0].metadata.date : 'لا يوجد'}
                </p>
              </div>
              
              <div className="glass p-5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <HardDrive size={20} />
                  </div>
                  <h3 className="font-semibold text-slate-400">مساحة التخزين السحابية</h3>
                </div>
                <p className="text-xl font-bold text-white">
                  {formatSize(totalUsedSpace)}
                </p>
              </div>

              <div className="glass p-5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <ShieldCheck size={20} />
                  </div>
                  <h3 className="font-semibold text-slate-400">التشفير السحابي</h3>
                </div>
                <p className="text-xl font-bold text-white">AES-256</p>
              </div>

              <div className="glass p-5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <RefreshCw size={20} />
                  </div>
                  <h3 className="font-semibold text-slate-400">النسخ التلقائي</h3>
                </div>
                <p className="text-xl font-bold text-white">
                  {autoBackupEnabled ? `كل ${backupInterval} ساعة` : 'معطل'}
                </p>
              </div>
            </div>

            {/* Cloud Backups Table & Settings Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-white">سجل النسخ السحابية المحفوظة</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={handleDownloadLog} className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer" title="تحميل السجل">
                      <FileDown size={18} />
                    </button>
                    <button onClick={fetchBackups} className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer" title="تحديث">
                      <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>
                
                <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                  {backups.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      لا توجد نسخ سحابية محفوظة حتى الآن.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right min-w-[600px] md:min-w-full">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10 text-sm text-slate-400">
                            <th className="p-4">التاريخ والوقت</th>
                            <th className="p-4">الجهاز</th>
                            <th className="p-4">الحجم</th>
                            <th className="p-4">النوع</th>
                            <th className="p-4 text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {backups.map((backup) => (
                            <tr key={backup.driveId} className="hover:bg-white/5 transition-colors">
                              <td className="p-4">
                                <div className="font-semibold text-white" dir="ltr">{backup.metadata.date}</div>
                                <div className="text-xs text-slate-500" dir="ltr">{backup.metadata.time}</div>
                              </td>
                              <td className="p-4">
                                <div className="text-sm text-slate-300">{backup.metadata.deviceName}</div>
                                <div className="text-xs text-slate-500">{backup.metadata.os}</div>
                              </td>
                              <td className="p-4 text-sm text-slate-300">
                                {formatSize(backup.metadata.size)}
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                  backup.metadata.type === 'Full' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}>
                                  {backup.metadata.type === 'Full' ? 'شامل' : 'تزايدي'}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleRestore(backup.driveId)}
                                    className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="استعادة هذه النسخة"
                                  >
                                    <Download size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(backup.driveId)}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="حذف"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Cloud Settings Panel */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-white">إعدادات النسخ السحابي</h3>
                <div className="glass p-5 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl bg-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">النسخ التلقائي السحابي</div>
                      <div className="text-xs text-slate-500">يعمل في الخلفية عند توفر الإنترنت</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={autoBackupEnabled} 
                        onChange={e => setAutoBackupEnabled(e.target.checked)} 
                      />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-white/10 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-slate-200">تكرار النسخ</div>
                    <select
                      value={backupInterval}
                      onChange={e => setBackupInterval(parseInt(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                      disabled={!autoBackupEnabled}
                    >
                      <option value={24} className="bg-slate-900">كل 24 ساعة (يومياً)</option>
                      <option value={48} className="bg-slate-900">كل 48 ساعة (يومين)</option>
                      <option value={168} className="bg-slate-900">كل أسبوع</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-200">فقط عبر Wi-Fi</div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={wifiOnly} 
                        onChange={e => setWifiOnly(e.target.checked)} 
                      />
                      <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-white/10 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-slate-200">الاحتفاظ بآخر:</div>
                    <select
                      value={keepLimit}
                      onChange={e => setKeepLimit(parseInt(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value={10} className="bg-slate-900">10 نسخ احتياطية</option>
                      <option value={20} className="bg-slate-900">20 نسخة احتياطية</option>
                      <option value={50} className="bg-slate-900">50 نسخة احتياطية</option>
                      <option value={999} className="bg-slate-900">لا نهائي</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-white/10 text-xs text-slate-400">
                    ملاحظة: يتم تشفير البيانات باستخدام خوارزمية AES-256 قبل رفعها، مما يضمن سرية وأمان معلوماتك تماماً.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

    </div>
  );
};
