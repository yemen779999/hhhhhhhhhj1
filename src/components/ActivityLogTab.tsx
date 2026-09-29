import React, { useState } from 'react';
import { Database } from '../utils';
import { UserRole, ActivityLog } from '../types';
import { LiveOperationLogger } from './LiveOperationLogger';
import { FileText, Search, Trash2, Calendar, User, Tag, Filter, CheckCircle, Edit, Trash, RotateCcw } from 'lucide-react';

interface ActivityLogTabProps {
  db: Database;
  onDatabaseUpdate: () => void;
  role: UserRole;
  onNavigate: (tab: string) => void;
}

export default function ActivityLogTab({ db, onDatabaseUpdate, role, onNavigate }: ActivityLogTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');

  // Filter logs
  const filteredLogs = db.activityLogs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = filterAction === 'all' || log.actionType === filterAction;
    const matchesEntity = filterEntity === 'all' || log.entityType === filterEntity;
    const matchesUser = filterUser === 'all' || log.username.includes(filterUser);

    return matchesSearch && matchesAction && matchesEntity && matchesUser;
  });

  // Get list of unique users who have actions logged
  const uniqueUsers = Array.from(new Set(db.activityLogs.map(l => {
    // extract base name before parentheses if any
    const match = l.username.match(/^([^\(]+)/);
    return match ? match[1].trim() : l.username;
  })));

  const handleClearLogs = () => {
    if (role !== 'Admin') {
      alert('عذراً، تصفير سجل العمليات متاح فقط للمدير العام (Admin).');
      return;
    }

    if (confirm('هل أنت متأكد من تصفير وحذف جميع سجلات العمليات؟ لا يمكن التراجع عن هذا الإجراء.')) {
      db.activityLogs = [];
      db.logActivity(db.currentUser, 'delete', 'ledger_entry', 'all', 'تم تصفير وحذف جميع سجلات العمليات السابقة من قبل المدير العام.');
      db.save();
      onDatabaseUpdate();
    }
  };

  const getActionBadge = (actionType: ActivityLog['actionType']) => {
    switch (actionType) {
      case 'add':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle size={13} />
            <span>إضافة</span>
          </span>
        );
      case 'edit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Edit size={13} />
            <span>تعديل</span>
          </span>
        );
      case 'delete':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Trash size={13} />
            <span>حذف</span>
          </span>
        );
      case 'restore':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <RotateCcw size={13} />
            <span>استعادة</span>
          </span>
        );
    }
  };

  const getEntityTypeLabel = (entityType: ActivityLog['entityType']) => {
    switch (entityType) {
      case 'account':
        return 'الحسابات';
      case 'transaction':
        return 'الحركات المالية';
      case 'ledger_entry':
        return 'قيود اليومية';
      case 'invoice':
        return 'الفواتير';
      case 'ai_operation':
        return 'عمليات الذكاء الاصطناعي';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Widget */}
      <div className="glass rounded-2xl p-6 shadow-xl border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">سجل عمليات النظام (Activity Log)</h2>
              <p className="text-sm text-slate-500 mt-1">تتبع دقيق لجميع حركات إضافة وتعديل وحذف قيود اليومية، الحركات المالية، الفواتير، والحسابات.</p>
            </div>
          </div>

          {role === 'Admin' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('backup')}
                className="inline-flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors duration-150 self-start md:self-auto border border-emerald-500/20"
              >
                <RotateCcw size={16} />
                <span>استعادة البيانات</span>
              </button>
              <button
                onClick={handleClearLogs}
                className="inline-flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors duration-150 self-start md:self-auto border border-red-500/20"
              >
                <Trash2 size={16} />
                <span>تصفير السجل</span>
              </button>
            </div>
          )}
        </div>

        {/* Filters Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <span className="absolute inset-y-0 right-3 flex items-center text-slate-500">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="البحث عن عملية أو مستخدم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-white"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 right-3 flex items-center text-slate-500 pointer-events-none">
              <Filter size={15} />
            </span>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-white appearance-none"
            >
              <option value="all">كل العمليات (إضافة/تعديل/حذف)</option>
              <option value="add">إضافة قيد/فاتورة/حساب</option>
              <option value="edit">تعديل بيانات</option>
              <option value="delete">حذف قيود/حسابات</option>
              <option value="restore">عمليات الاستعادة</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 right-3 flex items-center text-slate-500 pointer-events-none">
              <Tag size={15} />
            </span>
            <select
              value={filterEntity}
              onChange={(e) => setFilterEntity(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-white appearance-none"
            >
              <option value="all">كل الأقسام</option>
              <option value="ledger_entry">دفتر اليومية / القيود</option>
              <option value="invoice">الفواتير</option>
              <option value="account">الحسابات (عملاء/موردين)</option>
              <option value="transaction">الحركات المالية المباشرة</option>
              <option value="ai_operation">عمليات الذكاء الاصطناعي</option>
            </select>
          </div>

          {/* User Filter */}
          <div className="relative">
            <span className="absolute inset-y-0 right-3 flex items-center text-slate-500 pointer-events-none">
              <User size={15} />
            </span>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-white appearance-none"
            >
              <option value="all">كل المستخدمين والصلاحيات</option>
              {uniqueUsers.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="space-y-6">
        {filterEntity === 'ai_operation' ? (
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl p-6">
            <LiveOperationLogger logs={filteredLogs} />
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <FileText className="mx-auto text-slate-700 mb-3" size={40} />
                <p className="font-bold text-slate-300">لا توجد عمليات مسجلة تطابق عوامل التصفية</p>
                <p className="text-sm text-slate-500 mt-1">تأكد من إدخال نصوص بحث عامة أو تغيير خيارات التصفية.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse min-w-[600px] md:min-w-full">
                  <thead>
                    <tr className="bg-white/5 text-slate-400 text-xs font-bold border-b border-white/10">
                      <th className="p-4">التاريخ والوقت</th>
                      <th className="p-4">المستخدم / الصلاحية</th>
                      <th className="p-4">نوع العملية</th>
                      <th className="p-4">القسم</th>
                      <th className="p-4">تفاصيل الحركة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-sm">
                    {filteredLogs.map((log) => {
                      const logDate = new Date(log.timestamp);
                      const formattedDate = logDate.toLocaleDateString('ar-YE', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      });
                      const formattedTime = logDate.toLocaleTimeString('ar-YE', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      });

                      return (
                        <tr 
                          key={log.id} 
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="p-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                              <Calendar size={13} className="text-slate-500" />
                              <span>{formattedDate} - {formattedTime}</span>
                            </div>
                          </td>
                          <td className="p-4 font-bold text-white">
                            {log.username}
                          </td>
                          <td className="p-4">
                            {getActionBadge(log.actionType)}
                            {log.actionType === 'delete' && (
                              <button
                                onClick={() => onNavigate('recycle')}
                                className="mr-2 px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-[10px] font-bold hover:bg-purple-500/20 transition-colors"
                              >
                                استعادة
                              </button>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="text-xs font-bold px-2 py-1 bg-white/5 text-slate-400 rounded border border-white/10">
                              {getEntityTypeLabel(log.entityType)}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300 font-medium max-w-md break-words leading-relaxed">
                            {log.details}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
