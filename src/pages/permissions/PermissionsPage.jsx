import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { permissionsApi, lookupApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import {
  Btn, Badge, StatCard, Modal, Select, Textarea, Loading, Avatar,
} from '../../components/ui';
import useAuthStore from '../../store/authStore';
import { Clock, CheckCircle, XCircle, Plus, ThumbsUp, ThumbsDown } from 'lucide-react';

// ── ثوابت ────────────────────────────────────────────────────
const STATUS_COLOR = {
  'قيد المراجعة': 'amber',
  'موافق':        'green',
  'مرفوض':        'red',
};

const TYPE_COLOR = {
  'طبي':   'blue',
  'شخصي':  'purple',
  'حكومي': 'teal',
};

const TYPE_OPTIONS = ['طبي', 'شخصي', 'حكومي'].map(v => ({ value: v, label: v }));

const STATUS_FILTER = [
  { value: '',              label: 'كل الطلبات'  },
  { value: 'قيد المراجعة', label: 'قيد المراجعة' },
  { value: 'موافق',        label: 'موافق عليها'  },
  { value: 'مرفوض',        label: 'مرفوضة'       },
];

const fmtDateTime = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleString('ar-SA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── الصفحة الرئيسية ──────────────────────────────────────────
export default function PermissionsPage() {
  const qc         = useQueryClient();
  const { can }    = useAuthStore();
  const canApprove = can('permissions', 'approve');

  const [statusFilter, setStatusFilter] = useState('');
  const [showNewForm,  setShowNewForm]  = useState(false);
  const [reviewRecord, setReviewRecord] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['permission-requests', statusFilter],
    queryFn:  () => permissionsApi.list({ status: statusFilter || undefined }).then(r => r.data),
    staleTime: 30_000,
  });

  const stats   = data?.stats || {};
  const records = data?.data?.data ?? data?.data ?? [];

  const invalidate = () => qc.invalidateQueries(['permission-requests']);

  return (
    <div>
      <PageHeader
        title="طلبات الإذونات"
        subtitle="إدارة ومتابعة طلبات إذونات الموظفين"
        actions={
          <>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-blue-500"
            >
              {STATUS_FILTER.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Btn onClick={() => setShowNewForm(true)}>
              <Plus size={14}/> طلب إذن جديد
            </Btn>
          </>
        }
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

        {/* إحصائيات */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="قيد المراجعة" value={stats.pending}  icon={<Clock size={18}/>}       color="amber" />
          <StatCard label="موافق عليها"  value={stats.approved} icon={<CheckCircle size={18}/>} color="green" />
          <StatCard label="مرفوضة"       value={stats.rejected} icon={<XCircle size={18}/>}     color="red"   />
        </div>

        {/* قائمة الطلبات */}
        {isLoading ? <Loading /> : records.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
            <p className="text-gray-500 text-sm">لا توجد طلبات</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {records.map(req => (
              <RequestCard
                key={req.id}
                req={req}
                canApprove={canApprove}
                onReview={() => setReviewRecord(req)}
              />
            ))}
          </div>
        )}
      </div>

      {showNewForm && (
        <NewPermissionForm
          onClose={() => setShowNewForm(false)}
          onSaved={() => { invalidate(); setShowNewForm(false); }}
        />
      )}

      {reviewRecord && (
        <ReviewModal
          record={reviewRecord}
          canApprove={canApprove}
          onClose={() => setReviewRecord(null)}
          onSaved={() => { invalidate(); setReviewRecord(null); }}
        />
      )}
    </div>
  );
}

// ── بطاقة الطلب ──────────────────────────────────────────────
function RequestCard({ req, canApprove, onReview }) {
  const isPending = req.status === 'قيد المراجعة';

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-600 transition-all flex flex-col">

      {/* رأس البطاقة */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <Badge label={req.status || 'قيد المراجعة'} color={STATUS_COLOR[req.status] || 'amber'} />
        <Badge label={req.type} color={TYPE_COLOR[req.type] || 'gray'} />
      </div>

      {/* بيانات الموظف */}
      <div className="flex items-center gap-3 px-4 py-2">
        <Avatar name={req.employee?.full_name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100 truncate">{req.employee?.full_name}</p>
          <p className="text-xs text-gray-500">
            <span className="font-mono">{req.employee?.employee_number}</span>
            {req.employee?.department?.name && (
              <span className="mr-2">· {req.employee.department.name}</span>
            )}
          </p>
        </div>
      </div>

      {/* تفاصيل */}
      <div className="px-4 pb-3 space-y-2 flex-1">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock size={12} className="flex-shrink-0"/>
          <span>{req.duration}</span>
          <span className="text-gray-600">·</span>
          <span className="truncate">{fmtDateTime(req.request_datetime || req.created_at)}</span>
        </div>

        {req.reason && (
          <p className="text-xs text-gray-400 bg-gray-900/60 rounded-lg px-3 py-2 line-clamp-2">
            {req.reason}
          </p>
        )}

        {req.status === 'موافق' && (
          <div className="flex gap-2 flex-wrap pt-1">
            <Badge label="موافق" color="green" />
            {req.hr_status && (
              <Badge label={`HR: ${req.hr_status}`} color="teal" />
            )}
          </div>
        )}

        {req.manager_notes && (
          <p className="text-xs text-amber-400/80 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
            <span className="font-semibold">ملاحظة: </span>{req.manager_notes}
          </p>
        )}
      </div>

      {/* زر الإجراء */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-700/50">
        {canApprove && isPending ? (
          <Btn className="w-full justify-center" onClick={onReview}>
            <ThumbsUp size={13}/> مراجعة الطلب
          </Btn>
        ) : (
          <Btn variant="outline" className="w-full justify-center" onClick={onReview}>
            عرض التفاصيل
          </Btn>
        )}
      </div>
    </div>
  );
}

// ── Modal: مراجعة الطلب ──────────────────────────────────────
function ReviewModal({ record, canApprove, onClose, onSaved }) {
  const [notes, setNotes] = useState('');
  const isPending = record.status === 'قيد المراجعة';

  const approveMut = useMutation({
    mutationFn: () => permissionsApi.approve(record.id, { notes }),
    onSuccess: () => { toast.success('تمت الموافقة على الطلب'); onSaved(); },
    onError: (err) => toast.error(err.response?.data?.message || 'حدث خطأ'),
  });

  const rejectMut = useMutation({
    mutationFn: () => permissionsApi.reject(record.id, { notes }),
    onSuccess: () => { toast.success('تم رفض الطلب'); onSaved(); },
    onError: (err) => toast.error(err.response?.data?.message || 'حدث خطأ'),
  });

  const handleReject = () => {
    if (!notes.trim()) { toast.error('يرجى كتابة سبب الرفض'); return; }
    rejectMut.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={canApprove && isPending ? 'مراجعة طلب الإذن' : 'تفاصيل طلب الإذن'}
      width="max-w-lg"
      footer={
        canApprove && isPending ? (
          <>
            <Btn variant="success" onClick={() => approveMut.mutate()} loading={approveMut.isPending}>
              <ThumbsUp size={13}/> موافقة
            </Btn>
            <Btn variant="danger" onClick={handleReject} loading={rejectMut.isPending}>
              <ThumbsDown size={13}/> رفض
            </Btn>
            <Btn variant="outline" onClick={onClose} className="mr-auto">إغلاق</Btn>
          </>
        ) : (
          <Btn variant="outline" onClick={onClose}>إغلاق</Btn>
        )
      }
    >
      <div className="space-y-4">

        {/* بطاقة الموظف */}
        <div className="flex items-center gap-3 p-4 bg-blue-600/10 border border-blue-500/20 rounded-xl">
          <Avatar name={record.employee?.full_name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-100">{record.employee?.full_name}</p>
            <p className="text-sm text-gray-400">{record.employee?.job_title}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
              <span className="font-mono">{record.employee?.employee_number}</span>
              {record.employee?.department?.name && (
                <><span>·</span><span>{record.employee.department.name}</span></>
              )}
            </div>
          </div>
          <Badge label={record.status || 'قيد المراجعة'} color={STATUS_COLOR[record.status] || 'amber'} />
        </div>

        {/* تفاصيل */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900/60 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1.5">نوع الإذن</p>
            <Badge label={record.type} color={TYPE_COLOR[record.type] || 'gray'} />
          </div>
          <div className="bg-gray-900/60 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1.5">المدة</p>
            <p className="text-sm font-semibold text-gray-200">{record.duration}</p>
          </div>
          <div className="bg-gray-900/60 rounded-xl p-3 col-span-2">
            <p className="text-xs text-gray-500 mb-1">تاريخ الطلب</p>
            <p className="text-sm text-gray-200">{fmtDateTime(record.request_datetime || record.created_at)}</p>
          </div>
        </div>

        {/* السبب */}
        <div className="bg-gray-900/60 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">سبب الطلب</p>
          <p className="text-sm text-gray-200 leading-relaxed">{record.reason || '—'}</p>
        </div>

        {/* ملاحظات سابقة */}
        {record.manager_notes && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-xs text-amber-400 font-semibold mb-1">ملاحظات سابقة</p>
            <p className="text-sm text-gray-300">{record.manager_notes}</p>
          </div>
        )}

        {/* خانة الملاحظات */}
        {canApprove && isPending && (
          <Textarea
            label="ملاحظات المراجعة (مطلوبة عند الرفض)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="اكتب ملاحظتك هنا..."
          />
        )}
      </div>
    </Modal>
  );
}

// ── Modal: طلب إذن جديد ──────────────────────────────────────
function NewPermissionForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    type:             'شخصي',
    duration:         '',
    reason:           '',
    request_datetime: new Date().toISOString().slice(0, 16),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // جلب المدد من الإعدادات
  const { data: durData, isLoading: durLoading } = useQuery({
    queryKey: ['permission-durations'],
    queryFn:  () => lookupApi.permissionDurations().then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const durationOptions = [
    { value: '', label: durLoading ? 'جارٍ التحميل...' : 'اختر المدة...' },
    ...(durData?.data || []).map(d => ({ value: d.name, label: d.name })),
  ];

  const mut = useMutation({
    mutationFn: (data) => permissionsApi.create(data),
    onSuccess: () => { toast.success('تم تقديم طلب الإذن بنجاح'); onSaved(); },
    onError: (err) => {
      const errors = err.response?.data?.errors;
      if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
      else toast.error('حدث خطأ أثناء الإرسال');
    },
  });

  const handleSave = () => {
    if (!form.duration)         { toast.error('المدة مطلوبة'); return; }
    if (!form.reason.trim())    { toast.error('سبب الطلب مطلوب'); return; }
    if (!form.request_datetime) { toast.error('تاريخ الطلب مطلوب'); return; }
    mut.mutate(form);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="طلب إذن جديد"
      footer={
        <>
          <Btn onClick={handleSave} loading={mut.isPending}>إرسال الطلب</Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="نوع الإذن *"
            value={form.type}
            onChange={e => set('type', e.target.value)}
            options={TYPE_OPTIONS}
          />
          <Select
            label="المدة *"
            value={form.duration}
            onChange={e => set('duration', e.target.value)}
            options={durationOptions}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            تاريخ ووقت الطلب *
          </label>
          <input
            type="datetime-local"
            value={form.request_datetime}
            onChange={e => set('request_datetime', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <Textarea
          label="سبب الطلب *"
          value={form.reason}
          onChange={e => set('reason', e.target.value)}
          rows={3}
          placeholder="اذكر سبب طلب الإذن..."
        />
      </div>
    </Modal>
  );
}
