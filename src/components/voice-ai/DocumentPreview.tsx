import React from "react";
import { FileText, Image as ImageIcon, CheckCircle2, AlertTriangle, ArrowRight, Download, Eye } from "lucide-react";
import { DocumentAnalysisResult } from "../../types";
import { motion } from "motion/react";

interface DocumentPreviewProps {
  file: { name: string; url: string; type: string } | null;
  analysis: DocumentAnalysisResult | undefined;
  onConfirm: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ file, analysis, onConfirm }) => {
  if (!file) return null;

  const isImage = file.type.startsWith("image/");

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-slate-900/60 rounded-[2.5rem] border border-slate-800/50 backdrop-blur-xl space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-slate-200 font-bold text-sm truncate max-w-[200px]">
              {file.name}
            </h3>
            <p className="text-[10px] text-slate-500">تم الرفع بنجاح</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a 
            href={file.url} 
            target="_blank" 
            rel="noreferrer"
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <Eye className="w-4 h-4" />
          </a>
        </div>
      </div>

      {isImage && (
        <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
          <img src={file.url} alt="Uploaded document" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
        </div>
      )}

      {analysis && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">تحليل الذكاء الاصطناعي</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3" />
              {(analysis.confidenceScore * 100).toFixed(0)}% دقة
            </div>
          </div>

          <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-slate-500">نوع المستند</p>
                <p className="text-sm font-bold text-white">{analysis.documentType}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500">الإجراء المقترح</p>
                <p className="text-xs font-medium text-indigo-400">{analysis.suggestedAction}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/50 grid grid-cols-2 gap-4">
              {analysis.extractedData.customerName && (
                <div>
                  <p className="text-[10px] text-slate-500">العميل</p>
                  <p className="text-xs font-bold text-slate-200">{analysis.extractedData.customerName}</p>
                </div>
              )}
              {analysis.extractedData.totalAmount !== undefined && (
                <div>
                  <p className="text-[10px] text-slate-500">المبلغ الإجمالي</p>
                  <p className="text-xs font-bold text-emerald-400">
                    {analysis.extractedData.totalAmount.toLocaleString()} {analysis.extractedData.currency || "YER"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button 
            onClick={onConfirm}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 group"
          >
            {analysis.suggestedAction === "Create Invoice" ? "تأكيد وإنشاء الفاتورة" : "تأكيد استيراد البيانات"}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      )}
    </motion.div>
  );
};
