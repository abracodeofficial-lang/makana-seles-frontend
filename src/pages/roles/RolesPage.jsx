import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { permissionGroupsApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import {
  Btn, Card, Modal, Input, Textarea, Loading, Table, Tr, Td,
} from '../../components/ui';
import { Plus, Pencil, Trash2, ShieldCheck, Users } from 'lucide-react';

// ── قائمة صفحات النظام القابلة للتحكم بصلاحياتها (مطابقة للباك اند) ──
const PAGE_LABELS = {
  properties:      'العقارات',
  owners:          'الملاك',
  leads:           'المهتمون',
  employees:       'الموظفون',
  attendance:      'الحضور والانصراف',
  leave_requests:  'الإجازات',
  permissions:     'الإذونات',
  salary:          'الرواتب',
  reports:         'التقارير',
  settings:        'الإعدادات',
  notifications:   'الإشعارات',
  roles:           'الأدوار والصلاحيات',
};

const ACTIONS = [
  { key: 'can_view',    label: 'عرض'    },
  { key: 'can_add',     label: 'إضافة'  },
  { key: 'can_edit',    label: 'تعديل'  },
  { key: 'can_delete',  label: 'حذف'    },
  { key: 'can_export',  label: 'تصدير'  },
  { key: 'can_approve', label: 'اعتماد' },
];

const defaultPages = () => Object.entries(PAGE_LABELS).map(([page_key, page_name]) => ({
  page_key, page_name,
  can_view: false, can_add: false, can_edit: false,
  can_delete: false, can_export: false, can_approve: false,
}));

export default function RolesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId]       = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: () => permissionGroupsApi.list().then(r => r.data.data),
  });

  const openNew  = () => { setEditId(null); setShowModal(true); };
  const openEdit = (id) => { setEditId(id); setShowModal(true); };

  const handleDelete = async (id) => {
    if (!confirm('حذف مجموعة الصلاحيات هذه؟')) return;
    try {
      await permissionGroupsApi.remove(id);
      toast.success('تم حذف المجموعة');
      qc.invalidateQueries(['permission-groups']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل حذف المجموعة');
    }
  };

  return (
    <div>
      <PageHeader
        title="الأدوار والصلاحيات"
        subtitle="تحديد صلاحيات كل مجموعة على صفحات النظام"
        actions={
          <Btn onClick={openNew}><Plus size={16}/> مجموعة جديدة</Btn>
        }
      />

      <div className="p-4 sm:p-6">
        <Card title="مجموعات الصلاحيات">
          {isLoading ? <Loading /> : (
            <Table headers={['المجموعة', 'الوصف', 'عدد الموظفين', 'إجراءات']}>
              {(data || []).map(g => (
                <Tr key={g.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck size={14} className="text-blue-400"/>
                      </div>
                      <span className="font-semibold text-gray-100 text-xs">{g.name}</span>
                    </div>
                  </Td>
                  <Td className="text-gray-400">{g.description || '—'}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-300">
                      <Users size={12}/> {g.employees_count ?? 0}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <Btn size="sm" variant="ghost" title="تعديل" onClick={() => openEdit(g.id)}>
                        <Pencil size={12}/>
                      </Btn>
                      <Btn size="sm" variant="ghost" className="hover:text-red-400" title="حذف" onClick={() => handleDelete(g.id)}>
                        <Trash2 size={12}/>
                      </Btn>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
          {!isLoading && (data || []).length === 0 && (
            <div className="text-center py-10">
              <ShieldCheck size={32} className="text-gray-600 mx-auto mb-2"/>
              <p className="text-gray-500 text-sm">لا توجد مجموعات صلاحيات بعد</p>
            </div>
          )}
        </Card>
      </div>

      {showModal && (
        <GroupModal
          id={editId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); qc.invalidateQueries(['permission-groups']); }}
        />
      )}
    </div>
  );
}

// ── نافذة إنشاء/تعديل مجموعة ─────────────────────────────────
function GroupModal({ id, onClose, onSaved }) {
  const [form, setForm]       = useState({ name: '', description: '' });
  const [pages, setPages]     = useState(defaultPages());
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['permission-group', id],
    queryFn: () => permissionGroupsApi.show(id).then(r => r.data.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (data) {
      setForm({ name: data.name, description: data.description || '' });
      setPages(data.pages);
    }
  }, [data]);

  const toggle = (pageKey, actionKey) => {
    setPages(prev => prev.map(p => p.page_key === pageKey ? { ...p, [actionKey]: !p[actionKey] } : p));
  };

  const setAll = (value) => {
    setPages(prev => prev.map(p => ({
      ...p, can_view: value, can_add: value, can_edit: value,
      can_delete: value, can_export: value, can_approve: value,
    })));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('اسم المجموعة مطلوب'); return; }
    setLoading(true);
    try {
      const payload = { ...form, pages };
      if (id) await permissionGroupsApi.update(id, payload);
      else    await permissionGroupsApi.create(payload);
      toast.success(id ? 'تم تحديث المجموعة' : 'تم إنشاء المجموعة');
      onSaved();
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
      else toast.error(err.response?.data?.message || 'فشل الحفظ');
    } finally { setLoading(false); }
  };

  return (
    <Modal open onClose={onClose} title={id ? 'تعديل مجموعة الصلاحيات' : 'مجموعة صلاحيات جديدة'} width="max-w-3xl"
      footer={
        <>
          <Btn onClick={handleSave} loading={loading}>💾 حفظ</Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }>
      {isLoading ? <Loading /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="اسم المجموعة *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="الوصف" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">صلاحيات الصفحات</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAll(true)} className="text-xs text-blue-400 hover:text-blue-300">تحديد الكل</button>
                <span className="text-gray-700">|</span>
                <button type="button" onClick={() => setAll(false)} className="text-xs text-gray-500 hover:text-gray-300">إلغاء الكل</button>
              </div>
            </div>
            <div className="overflow-x-auto border border-gray-700 rounded-xl">
              <table className="w-full border-collapse min-w-max">
                <thead>
                  <tr className="bg-gray-800/80">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400 whitespace-nowrap">الصفحة</th>
                    {ACTIONS.map(a => (
                      <th key={a.key} className="px-3 py-2.5 text-center text-xs font-semibold text-gray-400 whitespace-nowrap">{a.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pages.map(p => (
                    <tr key={p.page_key} className="border-t border-gray-800">
                      <td className="px-3 py-2 text-xs font-semibold text-gray-200 whitespace-nowrap">{PAGE_LABELS[p.page_key] || p.page_key}</td>
                      {ACTIONS.map(a => (
                        <td key={a.key} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!p[a.key]}
                            onChange={() => toggle(p.page_key, a.key)}
                            className="w-4 h-4 accent-blue-600 cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
