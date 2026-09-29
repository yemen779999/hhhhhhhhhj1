import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../auth';
import { ShieldCheck, User as UserIcon, RefreshCw, PlusCircle, Trash2, Key } from 'lucide-react';

export default function AdminDashboard({ db, onDatabaseUpdate }: { db: any, onDatabaseUpdate: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [activationCodes, setActivationCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersCol = collection(firestore, 'users');
        const userSnapshot = await getDocs(usersCol);
        const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(userList);

        const codesCol = collection(firestore, 'activation_codes');
        const codesSnapshot = await getDocs(codesCol);
        const codesList = codesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActivationCodes(codesList);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleProStatus = async (userId: string, currentStatus: boolean) => {
    setUpdating(userId);
    try {
      const userDocRef = doc(firestore, 'users', userId);
      await updateDoc(userDocRef, { isPro: !currentStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, isPro: !currentStatus } : u));
      onDatabaseUpdate();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('حدث خطأ أثناء تحديث حالة المستخدم.');
    } finally {
      setUpdating(null);
    }
  };

  const generateCode = async () => {
    if (!newCode) return;
    setGenerating(true);
    try {
      await addDoc(collection(firestore, 'activation_codes'), {
        code: newCode.toUpperCase(),
        createdAt: new Date().toISOString(),
        used: false
      });
      setActivationCodes([...activationCodes, { code: newCode.toUpperCase(), createdAt: new Date().toISOString(), used: false }]);
      setNewCode('');
      alert('تم إنشاء الكود بنجاح');
    } catch (err) {
      console.error('Error generating code:', err);
      alert('حدث خطأ أثناء إنشاء الكود');
    } finally {
      setGenerating(false);
    }
  };

  const deleteCode = async (id: string) => {
    try {
      await deleteDoc(doc(firestore, 'activation_codes', id));
      setActivationCodes(activationCodes.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting code:', err);
      alert('حدث خطأ أثناء حذف الكود');
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">جاري تحميل البيانات...</div>;

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-800 space-y-8">
      <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">لوحة تحكم المطور/المدير</h2>
      
      {/* Code Generator */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">إنشاء كود تفعيل جديد</h3>
        <div className="flex gap-4">
          <input 
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="أدخل كود التفعيل"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2"
          />
          <button 
            onClick={generateCode}
            disabled={generating || !newCode}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl disabled:opacity-50"
          >
            <PlusCircle size={18} />
            إنشاء الكود
          </button>
        </div>

        {/* Existing Codes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {activationCodes.map((code, index) => (
                <div key={code.id || `code-${index}`} className="bg-slate-50 p-3 rounded-xl flex items-center justify-between border">
                    <span className="font-mono font-bold text-sm">{code.code}</span>
                    <button onClick={() => deleteCode(code.id)} className="text-red-500">
                        <Trash2 size={16} />
                    </button>
                </div>
            ))}
        </div>
      </div>

      <div className="overflow-x-auto border-t pt-6">
        <h3 className="text-lg font-bold mb-4">قائمة المستخدمين</h3>
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500">
              <th className="p-3">المستخدم</th>
              <th className="p-3">البريد الإلكتروني</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.id || `user-${index}`} className="border-b border-slate-50 dark:border-slate-800">
                <td className="p-3 font-bold text-slate-900 dark:text-white">{user.displayName || 'مستخدم غير معروف'}</td>
                <td className="p-3 font-mono text-slate-500">{user.email || 'بدون بريد'}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.isPro ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {user.isPro ? 'احترافي' : 'مجاني'}
                  </span>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => toggleProStatus(user.id, !!user.isPro)}
                    disabled={updating === user.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-all disabled:opacity-50"
                  >
                    {updating === user.id ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    {user.isPro ? 'إلغاء الترقية' : 'ترقية'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
