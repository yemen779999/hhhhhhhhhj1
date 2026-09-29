import React from "react";
import { AccountingPreviewData } from "../../types";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

interface AccountingPreviewProps {
  data?: AccountingPreviewData;
}

export const AccountingPreview: React.FC<AccountingPreviewProps> = ({ data }) => {
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4 p-6 bg-slate-900/60 rounded-3xl border border-slate-800/50 backdrop-blur-xl">
      <h3 className="text-slate-200 font-bold mb-4 flex items-center justify-between">
        <span>تفاصيل القيد الجاري إنشاؤه</span>
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          data.validationStatus === 'valid' ? 'bg-emerald-500/20 text-emerald-400' :
          data.validationStatus === 'invalid' ? 'bg-rose-500/20 text-rose-400' :
          'bg-indigo-500/20 text-indigo-400 animate-pulse'
        }`}>
          {data.validationStatus === 'valid' ? 'جاهز للحفظ' : 
           data.validationStatus === 'invalid' ? 'بيانات غير مكتملة' : 'جاري التحقق...'}
        </div>
      </h3>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
          <span className="text-slate-500 text-sm">الحساب المدين:</span>
          <span className="text-slate-200 font-medium">{data.debitAccount || "—"}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
          <span className="text-slate-500 text-sm">الحساب الدائن:</span>
          <span className="text-slate-200 font-medium">{data.creditAccount || "—"}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
          <span className="text-slate-500 text-sm">المبلغ:</span>
          <span className="text-emerald-400 font-mono font-bold text-lg">
            {data.amount?.toLocaleString() || "0.00"}
          </span>
        </div>
        <div className="flex justify-between items-start py-2 border-b border-slate-800/50">
          <span className="text-slate-500 text-sm">البيان:</span>
          <span className="text-slate-300 text-sm text-left flex-1 pl-4">{data.description || "—"}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
          <span className="text-slate-500 text-sm">التاريخ:</span>
          <span className="text-slate-200 font-mono text-sm">{data.date || "—"}</span>
        </div>
      </div>

      {data.warnings && data.warnings.length > 0 && (
        <div className="mt-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="space-y-1">
            {data.warnings.map((w, i) => (
              <p key={i} className="text-amber-200 text-xs">{w}</p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs">
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: data.validationStatus === 'valid' ? '100%' : '60%' }}
          />
        </div>
        <span className="text-slate-500 font-mono">
          {data.validationStatus === 'valid' ? '100%' : '60%'}
        </span>
      </div>
    </div>
  );
};
