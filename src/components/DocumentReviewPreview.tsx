import React from "react";
import { 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Eye, 
  Edit3, 
  XCircle,
  Hash,
  Calendar,
  User,
  Package,
  Wallet
} from "lucide-react";
import { DocumentAnalysisResult } from "../types";
import { motion } from "motion/react";

interface DocumentReviewPreviewProps {
  file: { name: string; url: string; type: string } | null;
  analysis: DocumentAnalysisResult | undefined;
  onApprove: (updatedAnalysis: DocumentAnalysisResult) => void;
  onReject: () => void;
}

export const DocumentReviewPreview: React.FC<DocumentReviewPreviewProps> = ({ 
  file, 
  analysis, 
  onApprove, 
  onReject 
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedAnalysis, setEditedAnalysis] = React.useState<DocumentAnalysisResult | undefined>(analysis);

  React.useEffect(() => {
    if (analysis) {
      setEditedAnalysis(analysis);
    }
  }, [analysis]);

  if (!file || !editedAnalysis) return null;

  const isImage = file.type.startsWith("image/");

  const handleFieldChange = (path: string, value: any) => {
    const newAnalysis = { ...editedAnalysis };
    if (path.startsWith('extractedData.')) {
      const field = path.split('.')[1];
      newAnalysis.extractedData = { ...newAnalysis.extractedData, [field]: value };
    } else if (path.startsWith('suggestedJournalEntry.')) {
      const field = path.split('.')[1];
      newAnalysis.suggestedJournalEntry = { ...newAnalysis.suggestedJournalEntry, [field]: value };
    } else {
      (newAnalysis as any)[path] = value;
    }
    setEditedAnalysis(newAnalysis);
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    const newAnalysis = { ...editedAnalysis };
    if (newAnalysis.extractedData.items) {
      const newItems = [...newAnalysis.extractedData.items];
      newItems[idx] = { ...newItems[idx], [field]: value };
      
      // Update total if quantity or price changes
      if (field === 'quantity' || field === 'unitPrice') {
        newItems[idx].total = (newItems[idx].quantity || 0) * (newItems[idx].unitPrice || 0);
      }
      
      newAnalysis.extractedData.items = newItems;
      setEditedAnalysis(newAnalysis);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Document View */}
        <div className="p-6 border-l border-white/10 bg-black/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-white font-bold text-sm truncate max-w-[200px]">
                  {file.name}
                </h3>
                <p className="text-[10px] text-slate-500">مستند مرفوع للمراجعة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a 
                href={file.url} 
                target="_blank" 
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
              >
                <Eye className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="relative aspect-[3/4] lg:aspect-square rounded-3xl overflow-hidden border border-white/10 shadow-inner bg-slate-900">
            {isImage ? (
              <img src={file.url} alt="Document" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                <FileText size={48} className="opacity-20" />
                <span className="text-xs">معاينة PDF غير متوفرة مباشرة</span>
              </div>
            )}
          </div>
        </div>

        {/* Analysis Details */}
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-lg font-black text-white">تحليل البيانات المستخرجة</h4>
              <p className="text-xs text-slate-400">مراجعة الحقول المكتشفة بواسطة الذكاء الاصطناعي</p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              editedAnalysis.confidenceScore > 0.8 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            } text-xs font-black`}>
              <CheckCircle2 size={14} />
              <span>{(editedAnalysis.confidenceScore * 100).toFixed(0)}% ثقة</span>
            </div>
          </div>

          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Core Fields Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Hash size={12} className="text-indigo-400" />
                  <span className="text-[10px] text-slate-500">نوع المستند</span>
                </div>
                {isEditing ? (
                  <input 
                    type="text"
                    value={editedAnalysis.documentType}
                    onChange={(e) => handleFieldChange('documentType', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-sm font-bold text-white">{editedAnalysis.documentType}</p>
                )}
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={12} className="text-indigo-400" />
                  <span className="text-[10px] text-slate-500">التاريخ</span>
                </div>
                {isEditing ? (
                  <input 
                    type="date"
                    value={editedAnalysis.extractedData.date || ''}
                    onChange={(e) => handleFieldChange('extractedData.date', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-sm font-bold text-white">{editedAnalysis.extractedData.date || 'غير محدد'}</p>
                )}
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <User size={12} className="text-indigo-400" />
                  <span className="text-[10px] text-slate-500">المورد / العميل</span>
                </div>
                {isEditing ? (
                  <input 
                    type="text"
                    value={editedAnalysis.extractedData.supplierName || editedAnalysis.extractedData.customerName || ''}
                    onChange={(e) => handleFieldChange('extractedData.supplierName', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-sm font-bold text-white truncate">{editedAnalysis.extractedData.supplierName || editedAnalysis.extractedData.customerName || 'مجهول'}</p>
                )}
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={12} className="text-emerald-400" />
                  <span className="text-[10px] text-slate-500">المبلغ الإجمالي</span>
                </div>
                {isEditing ? (
                  <input 
                    type="number"
                    value={editedAnalysis.extractedData.totalAmount || 0}
                    onChange={(e) => handleFieldChange('extractedData.totalAmount', parseFloat(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-sm font-black text-emerald-400">
                    {editedAnalysis.extractedData.totalAmount?.toLocaleString() || '0'} {editedAnalysis.extractedData.currency || 'YER'}
                  </p>
                )}
              </div>
            </div>

            {/* Items List */}
            {editedAnalysis.extractedData.items && editedAnalysis.extractedData.items.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">العناصر المكتشفة</span>
                <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                  <table className="w-full text-right text-xs min-w-[700px] md:min-w-full">
                    <thead className="bg-white/5 text-slate-400">
                      <tr>
                        <th className="p-3 font-bold text-right">البيان</th>
                        <th className="p-3 font-bold text-center">الكمية</th>
                        <th className="p-3 font-bold text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {editedAnalysis.extractedData.items.map((item, idx) => (
                        <tr key={idx} className="text-slate-300">
                          <td className="p-3 font-medium">
                            {isEditing ? (
                              <input 
                                type="text"
                                value={item.description}
                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-white focus:outline-none"
                              />
                            ) : item.description}
                          </td>
                          <td className="p-3 text-center">
                            {isEditing ? (
                              <input 
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                                className="w-12 bg-transparent border-none p-0 text-center text-white focus:outline-none"
                              />
                            ) : item.quantity}
                          </td>
                          <td className="p-3 font-bold text-left">
                            {isEditing ? (
                              <input 
                                type="number"
                                value={item.total}
                                onChange={(e) => handleItemChange(idx, 'total', parseFloat(e.target.value))}
                                className="w-20 bg-transparent border-none p-0 text-left text-white focus:outline-none"
                              />
                            ) : item.total?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Suggested Entry */}
            {editedAnalysis.suggestedJournalEntry && (
              <div className="bg-indigo-500/5 rounded-2xl p-4 border border-indigo-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowRight size={14} className="text-indigo-400" />
                  <span className="text-[10px] font-black text-indigo-400 uppercase">القيد المحاسبي المقترح</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-slate-500">حـ/ المدين</p>
                    {isEditing ? (
                      <input 
                        type="text"
                        value={editedAnalysis.suggestedJournalEntry.debitAccount || ''}
                        onChange={(e) => handleFieldChange('suggestedJournalEntry.debitAccount', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none mt-1"
                      />
                    ) : (
                      <p className="font-bold text-white">{editedAnalysis.suggestedJournalEntry.debitAccount || 'المصروفات / المشتريات'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-500">حـ/ الدائن</p>
                    {isEditing ? (
                      <input 
                        type="text"
                        value={editedAnalysis.suggestedJournalEntry.creditAccount || ''}
                        onChange={(e) => handleFieldChange('suggestedJournalEntry.creditAccount', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none mt-1"
                      />
                    ) : (
                      <p className="font-bold text-white">{editedAnalysis.suggestedJournalEntry.creditAccount || 'الصندوق / المورد'}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3 pt-4">
              <button 
                onClick={onReject}
                className="py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2"
              >
                <XCircle size={16} />
                <span>رفض</span>
              </button>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border ${
                  isEditing 
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
              >
                <Edit3 size={16} />
                <span>{isEditing ? 'حفظ التعديل' : 'تعديل'}</span>
              </button>
              <button 
                onClick={() => onApprove(editedAnalysis)}
                disabled={isEditing}
                className={`py-3 rounded-2xl text-xs font-black transition-all shadow-lg flex items-center justify-center gap-2 ${
                  isEditing 
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
              >
                <CheckCircle2 size={16} />
                <span>اعتماد</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
