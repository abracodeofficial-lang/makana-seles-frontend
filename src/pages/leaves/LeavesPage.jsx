import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { leaveRequestsApi, lookupApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import {
  Btn, Badge, StatCard, Table, Tr, Td, Modal,
  Input, Select, Textarea, Card, Loading, Avatar,
} from '../../components/ui';
import useAuthStore from '../../store/authStore';
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

const FINAL_COLOR = { 'قيد المراجعة': 'amber', 'معتمدة': 'green', 'مرفوضة': 'red', 'إرجاع': 'purple' };

const fmtDate = (iso) => iso ? String(iso).slice(0, 10) : '—';

export default function LeavesPage() {
  const qc = useQueryClient();
  const { can, employee } = useAuthStore();
  const canApprove = can('leave_requests', 'approve');

  const [showRequest, setShowRequest]     = useState(false);
  const [actionModal, setActionModal]     = useState(null);
  const [notes, setNotes]                 = useState('');
  const [clarifyModal, setClarifyModal]   = useState(null); // { id, note }
  const [clarifyText, setClarifyText]     = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => leaveRequestsApi.list().then(r => r.data),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, role, notes }) =>
      role === 'manager'
        ? leaveRequestsApi.managerApprove(id, { notes })
        : leaveRequestsApi.hrApprove(id, { notes }),
    onSuccess: () => {
      toast.success('تمت الموافقة');
      qc.invalidateQueries(['leave-requests']);
      setActionModal(null);
      setNotes('');
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, role, notes }) =>
      role === 'manager'
        ? leaveRequestsApi.managerReject(id, { notes })
        : leaveRequestsApi.hrReject(id, { notes }),
    onSuccess: () => {
      toast.success('تم الرفض');
      qc.invalidateQueries(['leave-requests']);
      setActionModal(null);
      setNotes('');
    },
  });

  const inquireMut = useMutation({
    mutationFn: ({ id, role, notes }) =>
      role === 'manager'
        ? leaveRequestsApi.managerInquire(id, { notes })
        : leaveRequestsApi.hrInquire(id, { notes }),
    onSuccess: () => {
      toast.success('تم إرسال الاستفسار للموظف');
      qc.invalidateQueries(['leave-requests']);
      setActionModal(null);
      setNotes('');
    },
  });

  const clarifyMut = useMutation({
    mutationFn: ({ id, clarification }) => leaveRequestsApi.clarify(id, { clarification }),
    onSuccess: () => {
      toast.success('تم إرسال التوضيح، الطلب أصبح قيد المراجعة مجدداً');
      qc.invalidateQueries(['leave-requests']);
      setClarifyModal(null);
      setClarifyText('');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'فشل إرسال التوضيح'),
  });

  const stats = data?.stats || {};

  return (
    <div>
      <PageHeader
        title="الإجازات"
        subtitle="طلبات الإجازات واعتمادها"
        actions={
          <Btn onClick={() => setShowRequest(true)}>
            <Calendar size={16}/> طلب إجازة جديدة
          </Btn>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="إجمالي الطلبات" value={stats.total}    icon={<Calendar size={18}/>}    color="blue" />
          <StatCard label="قيد المراجعة"   value={stats.pending}  icon={<Clock size={18}/>}       color="amber" />
          <StatCard label="معتمدة"         value={stats.approved} icon={<CheckCircle size={18}/>} color="green" />
          <StatCard label="مرفوضة"         value={stats.rejected} icon={<XCircle size={18}/>}     color="red" />
        </div>

        <Card title="طلبات الإجازات">
          {isLoading ? <Loading /> : (
            <Table headers={['رقم الطلب','الموظف','نوع الإجازة','من','إلى','الأيام','السبب','حالة المدير','حالة HR','الحالة النهائية','المحادثة','إجراء']}>
              {data?.data?.data?.map(req => (
                <Tr key={req.id}>
                  <Td><span className="font-mono text-xs text-blue-400">{req.request_number}</span></Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={req.employee?.full_name} size="sm"/>
                      <div>
                        <p className="text-xs font-semibold text-gray-100">{req.employee?.full_name}</p>
                        <p className="text-xs text-gray-500">{req.employee?.employee_number}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{req.leave_type?.name}</Td>
                  <Td className="text-gray-400 text-xs">{fmtDate(req.from_date)}</Td>
                  <Td className="text-gray-400 text-xs">{fmtDate(req.to_date)}</Td>
                  <Td className="font-bold text-center">{req.days_count}</Td>
                  <Td className="text-gray-400 text-xs max-w-[120px] truncate">{req.reason}</Td>
                  <Td><Badge label={req.manager_status} color={FINAL_COLOR[req.manager_status] || 'gray'}/></Td>
                  <Td><Badge label={req.hr_status}      color={FINAL_COLOR[req.hr_status]      || 'gray'}/></Td>
                  <Td><Badge label={req.final_status}   color={FINAL_COLOR[req.final_status]}/></Td>
                  <Td className="max-w-[180px] space-y-1">
                    {req.manager_notes && (
                      <p className="text-xs text-purple-300 truncate" title={req.manager_notes}>🗨️ المدير: {req.manager_notes}</p>
                    )}
                    {req.hr_notes && (
                      <p className="text-xs text-purple-300 truncate" title={req.hr_notes}>🗨️ HR: {req.hr_notes}</p>
                    )}
                    {req.clarification && (
                      <p className="text-xs text-blue-300 truncate" title={req.clarification}>↩️ رد الموظف: {req.clarification}</p>
                    )}
                    {!req.manager_notes && !req.hr_notes && !req.clarification && '—'}
                  </Td>
                  <Td>
                    {canApprove && req.final_status === 'قيد المراجعة' && (
                      <div className="flex gap-1">
                        <Btn size="sm" variant="success"
                          onClick={() => setActionModal({
                            id:   req.id,
                            type: 'approve',
                            role: req.manager_status !== 'موافق' ? 'manager' : 'hr',
                          })}>✓</Btn>
                        <Btn size="sm" variant="danger"
                          onClick={() => setActionModal({
                            id:   req.id,
                            type: 'reject',
                            role: req.manager_status !== 'موافق' ? 'manager' : 'hr',
                          })}>✗</Btn>
                        <Btn size="sm" variant="outline" title="طلب توضيح من الموظف"
                          onClick={() => setActionModal({
                            id:   req.id,
                            type: 'inquire',
                            role: req.manager_status !== 'موافق' ? 'manager' : 'hr',
                          })}>؟</Btn>
                      </div>
                    )}
                    {req.employee_id === employee?.id && (req.manager_status === 'إرجاع' || req.hr_status === 'إرجاع') && (
                      <Btn size="sm" variant="outline"
                        onClick={() => setClarifyModal({ id: req.id, note: req.manager_status === 'إرجاع' ? req.manager_notes : req.hr_notes })}>
                        💬 الرد على الاستفسار
                      </Btn>
                    )}
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {/* طلب إجازة جديدة */}
      <NewLeaveRequest open={showRequest} onClose={() => setShowRequest(false)} />

      {/* Action Modal */}
      <Modal
        open={!!actionModal}
        onClose={() => { setActionModal(null); setNotes(''); }}
        title={
          actionModal?.type === 'approve' ? '✅ الموافقة على الإجازة' :
          actionModal?.type === 'inquire' ? '❓ طلب توضيح من الموظف' : '❌ رفض الإجازة'
        }
        footer={
          <>
            <Btn
              variant={actionModal?.type === 'approve' ? 'success' : actionModal?.type === 'inquire' ? 'outline' : 'danger'}
              loading={approveMut.isPending || rejectMut.isPending || inquireMut.isPending}
              onClick={() => {
                if (actionModal.type === 'inquire' && !notes.trim()) { toast.error('نص الاستفسار مطلوب'); return; }
                if (actionModal.type === 'reject'  && !notes.trim()) { toast.error('سبب الرفض مطلوب'); return; }
                if (actionModal.type === 'approve') approveMut.mutate({ ...actionModal, notes });
                else if (actionModal.type === 'inquire') inquireMut.mutate({ ...actionModal, notes });
                else rejectMut.mutate({ ...actionModal, notes });
              }}>
              {actionModal?.type === 'approve' ? '✓ موافقة' : actionModal?.type === 'inquire' ? '❓ إرسال الاستفسار' : '✗ رفض'}
            </Btn>
            <Btn variant="outline" onClick={() => { setActionModal(null); setNotes(''); }}>إلغاء</Btn>
          </>
        }>
        <Textarea
          label={
            actionModal?.type === 'approve' ? 'ملاحظة (اختياري)' :
            actionModal?.type === 'inquire' ? 'نص الاستفسار *' : 'سبب الرفض *'
          }
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="اكتب ملاحظتك أو سبب الرفض أو الاستفسار..."
        />
      </Modal>

      {/* الرد على استفسار المدير/HR على نفس الطلب */}
      <Modal
        open={!!clarifyModal}
        onClose={() => { setClarifyModal(null); setClarifyText(''); }}
        title="💬 الرد على الاستفسار"
        footer={
          <>
            <Btn
              loading={clarifyMut.isPending}
              onClick={() => {
                if (!clarifyText.trim()) { toast.error('التوضيح مطلوب'); return; }
                clarifyMut.mutate({ id: clarifyModal.id, clarification: clarifyText });
              }}>
              📤 إرسال التوضيح
            </Btn>
            <Btn variant="outline" onClick={() => { setClarifyModal(null); setClarifyText(''); }}>إلغاء</Btn>
          </>
        }>
        {clarifyModal?.note && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-3">
            <p className="text-xs text-purple-300 font-semibold mb-1">استفسار المسؤول:</p>
            <p className="text-sm text-gray-200">{clarifyModal.note}</p>
          </div>
        )}
        <Textarea
          label="توضيحك *"
          value={clarifyText}
          onChange={e => setClarifyText(e.target.value)}
          placeholder="اكتب ردك على الاستفسار..."
        />
      </Modal>
    </div>
  );
}

function NewLeaveRequest({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm]       = useState({ leave_type_id: '', from_date: '', to_date: '', reason: '' });
  const [attachment, setAttachment] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // أنواع الإجازات من API
  const { data: ltData, isLoading: ltLoading } = useQuery({
    queryKey: ['leave-types-lookup'],
    queryFn:  () => lookupApi.leaveTypes().then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const leaveTypes = ltData?.data || [];
  const selectedType = leaveTypes.find(t => String(t.id) === String(form.leave_type_id));
  const leaveTypeOptions = [
    { value: '', label: ltLoading ? 'جارٍ التحميل...' : 'اختر نوع الإجازة...' },
    ...leaveTypes.filter(t => t.is_active !== false).map(t => ({
      value: String(t.id),
      label: `${t.name} (${t.total_days} يوم)`,
    })),
  ];

  // حساب عدد الأيام تلقائياً
  const daysCount = useMemo(() => {
    if (!form.from_date || !form.to_date) return 0;
    const from = new Date(form.from_date);
    const to   = new Date(form.to_date);
    if (to < from) return 0;
    return Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
  }, [form.from_date, form.to_date]);

  const handleSend = async () => {
    if (!form.leave_type_id) { toast.error('نوع الإجازة مطلوب'); return; }
    if (!form.from_date)     { toast.error('تاريخ البداية مطلوب'); return; }
    if (!form.to_date)       { toast.error('تاريخ النهاية مطلوب'); return; }
    if (!form.reason.trim()) { toast.error('سبب الإجازة مطلوب'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('leave_type_id', form.leave_type_id);
      fd.append('from_date',     form.from_date);
      fd.append('to_date',       form.to_date);
      fd.append('reason',        form.reason);
      if (attachment) fd.append('attachment', attachment);

      await leaveRequestsApi.create(fd);
      toast.success('تم إرسال طلب الإجازة');
      qc.invalidateQueries(['leave-requests']);
      onClose();
      setForm({ leave_type_id: '', from_date: '', to_date: '', reason: '' });
      setAttachment(null);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
      else toast.error(err.response?.data?.message || 'حدث خطأ أثناء الإرسال');
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="طلب إجازة جديدة"
      footer={
        <>
          <Btn onClick={handleSend} loading={loading}>إرسال الطلب</Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }>
      <div className="space-y-4">

        {/* نوع الإجازة */}
        <Select
          label="نوع الإجازة *"
          value={form.leave_type_id}
          onChange={e => set('leave_type_id', e.target.value)}
          options={leaveTypeOptions}
        />

        {/* التواريخ */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="من تاريخ *"  type="date" value={form.from_date} onChange={e => set('from_date', e.target.value)} />
          <Input label="إلى تاريخ *" type="date" value={form.to_date}   onChange={e => set('to_date',   e.target.value)} />
        </div>

        {/* عداد الأيام */}
        {daysCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5">
            <Calendar size={14} className="flex-shrink-0" />
            <span>عدد الأيام: <strong>{daysCount}</strong> {daysCount === 1 ? 'يوم' : 'أيام'}</span>
          </div>
        )}

        {/* السبب */}
        <Textarea
          label="سبب الإجازة *"
          value={form.reason}
          onChange={e => set('reason', e.target.value)}
          placeholder="اكتب سبب طلب الإجازة..."
        />

        {/* المرفق */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            مرفق <span className="text-gray-600 normal-case font-normal">(اختياري — PDF أو صورة، بحجم أقصاه 5MB)</span>
          </label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => setAttachment(e.target.files?.[0] || null)}
            className="w-full text-xs text-gray-400 bg-gray-900/60 border border-gray-700 rounded-xl px-3 py-2.5 outline-none cursor-pointer
              file:ml-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          />
          {selectedType?.requires_attachment && (
            <p className="text-xs text-amber-400 mt-1.5">يُنصح بإرفاق مستند لهذا النوع من الإجازات.</p>
          )}
        </div>

      </div>
    </Modal>
  );
}