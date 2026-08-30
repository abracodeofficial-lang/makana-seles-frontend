import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { punchApi, permissionsApi, leaveRequestsApi, lookupApi } from '../../api/services';
import { PageHeader } from '../../components/layout/Layout';
import {
  Btn, Badge, Card, Modal, Textarea, Select, Table, Tr, Td, Loading, Avatar,
} from '../../components/ui';
import {
  LogIn, LogOut, Coffee, StopCircle, FileText, Palmtree,
  Clock, CheckCircle, AlertCircle, Calendar,
} from 'lucide-react';

// ── ثوابت ────────────────────────────────────────────────────
const STATUS_COLOR = {
  'حاضر':  'green',
  'متأخر': 'amber',
  'غياب':  'red',
  'إجازة': 'blue',
};

const fmtTime = (t) => t ? t.slice(0, 5) : '—';

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-SA', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const calcHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return '—';
  const [h1, m1] = checkIn.split(':').map(Number);
  const [h2, m2] = checkOut.split(':').map(Number);
  const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

const calcBreak = (s, e) => {
  if (!s) return null;
  if (!e) return `${fmtTime(s)} — جارٍ`;
  return `${fmtTime(s)} — ${fmtTime(e)}`;
};

// ── الساعة الحية ─────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="text-center py-6 select-none">
      <div className="text-5xl font-bold font-mono text-white tracking-widest mb-1">{timeStr}</div>
      <div className="text-sm text-gray-400">{dateStr}</div>
    </div>
  );
}

// ── زر بصمة ──────────────────────────────────────────────────
function PunchBtn({ label, icon, color, onClick, loading, disabled }) {
  const colors = {
    green:  'bg-green-600 hover:bg-green-500 border-green-500 text-white shadow-green-900/40',
    red:    'bg-red-600 hover:bg-red-500 border-red-500 text-white shadow-red-900/40',
    amber:  'bg-amber-500 hover:bg-amber-400 border-amber-400 text-white shadow-amber-900/40',
    blue:   'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white shadow-blue-900/40',
    purple: 'bg-purple-600 hover:bg-purple-500 border-purple-500 text-white shadow-purple-900/40',
    gray:   'bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed',
  };
  return (
    <button
      onClick={!disabled && !loading ? onClick : undefined}
      disabled={disabled || loading}
      className={`
        flex flex-col items-center justify-center gap-2 px-6 py-4 rounded-2xl border
        font-semibold text-sm transition-all shadow-lg min-w-[110px]
        ${colors[disabled ? 'gray' : color]}
        ${!disabled && !loading ? 'active:scale-95' : ''}
      `}
    >
      {loading
        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
        : <span className="text-2xl">{icon}</span>
      }
      {label}
    </button>
  );
}

// ── الصفحة الرئيسية ──────────────────────────────────────────
export default function PunchPage() {
  const qc = useQueryClient();
  const [showLeaveForm,      setShowLeaveForm]      = useState(false);
  const [showPermissionForm, setShowPermissionForm] = useState(false);
  const [historyMonth,       setHistoryMonth]       = useState(
    new Date().toISOString().slice(0, 7)
  );

  const { data, isLoading } = useQuery({
    queryKey: ['punch-today'],
    queryFn:  () => punchApi.today().then(r => r.data.data),
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['punch-history', historyMonth],
    queryFn:  () => punchApi.history({ month: historyMonth }).then(r => r.data.data),
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries(['punch-today']);
    qc.invalidateQueries(['punch-history', historyMonth]);
  };

  const makeMutation = (fn, successMsg) => useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      toast.success(res.data?.message || successMsg);
      invalidate();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'حدث خطأ'),
  });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const checkInMut    = makeMutation(() => punchApi.checkIn(),    'تم تسجيل الحضور');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const checkOutMut   = makeMutation(() => punchApi.checkOut(),   'تم تسجيل الانصراف');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const breakStartMut = makeMutation(() => punchApi.breakStart(), 'تم تسجيل بدء الاستراحة');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const breakEndMut   = makeMutation(() => punchApi.breakEnd(),   'تم تسجيل انتهاء الاستراحة');

  const employee = data?.employee;
  const record   = data?.record;
  const stats    = data?.stats || {};
  const history  = histData || [];

  const checkedIn    = !!record?.check_in;
  const checkedOut   = !!record?.check_out;
  const onBreak      = checkedIn && !!record?.break_start && !record?.break_end;
  const breakDone    = !!record?.break_start && !!record?.break_end;

  if (isLoading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="بصمة الحضور"
        subtitle="تسجيل الحضور والانصراف الشخصي"
      />

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-2xl mx-auto">

        {/* معلومات الموظف + الشيفت */}
        <Card>
          <div className="flex items-center gap-4 p-2">
            <Avatar name={employee?.full_name} size="lg" />
            <div className="flex-1">
              <p className="font-bold text-lg text-gray-100">{employee?.full_name}</p>
              <p className="text-sm text-gray-400">{employee?.job_title || employee?.department?.name || ''}</p>
              {employee?.shift && (
                <div className="flex items-center gap-1 mt-1 text-xs text-blue-400">
                  <Clock size={12}/>
                  <span>
                    شيفت {employee.shift.name}: {fmtTime(employee.shift.start_time)} — {fmtTime(employee.shift.end_time)}
                  </span>
                  {employee.shift.late_tolerance_minutes > 0 && (
                    <span className="text-gray-500 mr-2">
                      (سماح {employee.shift.late_tolerance_minutes} دقيقة)
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* حالة اليوم */}
            {record && (
              <Badge
                label={record.status}
                color={STATUS_COLOR[record.status] || 'gray'}
              />
            )}
          </div>
        </Card>

        {/* الساعة */}
        <Card>
          <LiveClock />

          {/* حالة اليوم المفصّلة */}
          {record && (
            <div className="flex justify-center gap-6 pb-4 text-sm">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">وقت الحضور</p>
                <p className="font-mono font-bold text-green-400">{fmtTime(record.check_in)}</p>
              </div>
              {record.break_start && (
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">الاستراحة</p>
                  <p className="font-mono text-amber-400 text-xs">{calcBreak(record.break_start, record.break_end)}</p>
                </div>
              )}
              {record.check_out && (
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">وقت الانصراف</p>
                  <p className="font-mono font-bold text-blue-400">{fmtTime(record.check_out)}</p>
                </div>
              )}
              {record.check_in && record.check_out && (
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">ساعات العمل</p>
                  <p className="font-mono font-bold text-purple-400">{calcHours(record.check_in, record.check_out)}</p>
                </div>
              )}
              {record.late_minutes > 0 && (
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">تأخير</p>
                  <p className="font-mono font-bold text-red-400">{record.late_minutes} د</p>
                </div>
              )}
            </div>
          )}

          {/* أزرار البصمة */}
          <div className="flex flex-wrap justify-center gap-3 pb-6 px-4">

            {/* حضور */}
            <PunchBtn
              label="حضور"
              icon={<LogIn size={22}/>}
              color="green"
              onClick={() => checkInMut.mutate()}
              loading={checkInMut.isPending}
              disabled={checkedIn}
            />

            {/* بدء الاستراحة */}
            <PunchBtn
              label="بدء الاستراحة"
              icon={<Coffee size={22}/>}
              color="amber"
              onClick={() => breakStartMut.mutate()}
              loading={breakStartMut.isPending}
              disabled={!checkedIn || checkedOut || !!record?.break_start}
            />

            {/* انتهاء الاستراحة */}
            <PunchBtn
              label="انتهاء الاستراحة"
              icon={<StopCircle size={22}/>}
              color="amber"
              onClick={() => breakEndMut.mutate()}
              loading={breakEndMut.isPending}
              disabled={!onBreak}
            />

            {/* انصراف */}
            <PunchBtn
              label="انصراف"
              icon={<LogOut size={22}/>}
              color="red"
              onClick={() => checkOutMut.mutate()}
              loading={checkOutMut.isPending}
              disabled={!checkedIn || checkedOut}
            />

            {/* طلب إذن */}
            <PunchBtn
              label="طلب إذن"
              icon={<FileText size={22}/>}
              color="blue"
              onClick={() => setShowPermissionForm(true)}
              disabled={false}
            />

            {/* طلب إجازة */}
            <PunchBtn
              label="طلب إجازة"
              icon={<Palmtree size={22}/>}
              color="purple"
              onClick={() => setShowLeaveForm(true)}
              disabled={false}
            />
          </div>
        </Card>

        {/* إحصائيات الشهر */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gray-800 rounded-2xl p-5 text-center border border-gray-700">
            <AlertCircle size={20} className="text-amber-400 mx-auto mb-2"/>
            <p className="text-3xl font-bold text-white">{stats.open ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">معاملات مفتوحة</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-5 text-center border border-gray-700">
            <CheckCircle size={20} className="text-green-400 mx-auto mb-2"/>
            <p className="text-3xl font-bold text-white">{stats.completed ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">معاملات منجزة</p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-5 text-center border border-gray-700">
            <Calendar size={20} className="text-blue-400 mx-auto mb-2"/>
            <p className="text-3xl font-bold text-white">{stats.total ?? 0}</p>
            <p className="text-xs text-gray-400 mt-1">إجمالي هذا الشهر</p>
          </div>
        </div>

        {/* سجل الحضور الشخصي */}
        <Card
          title="سجل حضوري"
          extra={
            <input
              type="month"
              value={historyMonth}
              onChange={e => setHistoryMonth(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          }
        >
          {histLoading ? <Loading /> : history.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">لا توجد سجلات</p>
          ) : (
            <Table headers={[
              'م', 'التاريخ', 'الحضور', 'الانصراف', 'الاستراحة',
              'ساعات العمل', 'تأخير', 'خصم التأخير', 'مكافأة', 'الحالة', 'اعتماد',
            ]}>
              {history.map((rec, i) => (
                <Tr key={rec.id}>
                  <Td className="text-gray-500 text-xs">{i + 1}</Td>
                  <Td className="text-gray-300 text-xs whitespace-nowrap">{fmtDate(rec.date)}</Td>
                  <Td>
                    <span className={`font-mono text-xs font-bold ${rec.check_in ? 'text-green-400' : 'text-gray-600'}`}>
                      {fmtTime(rec.check_in)}
                    </span>
                  </Td>
                  <Td>
                    <span className={`font-mono text-xs font-bold ${rec.check_out ? 'text-blue-400' : 'text-gray-600'}`}>
                      {fmtTime(rec.check_out)}
                    </span>
                  </Td>
                  <Td className="text-xs text-amber-400 whitespace-nowrap">
                    {calcBreak(rec.break_start, rec.break_end) || '—'}
                  </Td>
                  <Td className="font-mono text-xs text-purple-400">
                    {calcHours(rec.check_in, rec.check_out)}
                  </Td>
                  <Td className="text-xs">
                    {rec.late_minutes > 0
                      ? <span className="text-red-400">{rec.late_minutes} د</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </Td>
                  <Td className="text-xs">
                    {Number(rec.late_deduction) > 0
                      ? <span className="text-red-400">{Number(rec.late_deduction).toFixed(2)}</span>
                      : <span className="text-gray-600">0.00</span>
                    }
                  </Td>
                  <Td className="text-xs">
                    {Number(rec.occupancy_allowance) > 0
                      ? <span className="text-green-400">{Number(rec.occupancy_allowance).toFixed(2)}</span>
                      : <span className="text-gray-600">0.00</span>
                    }
                  </Td>
                  <Td>
                    <Badge
                      label={rec.status}
                      color={STATUS_COLOR[rec.status] || 'gray'}
                    />
                  </Td>
                  <Td>
                    {rec.is_approved
                      ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={12}/> معتمد</span>
                      : <span className="flex items-center gap-1 text-xs text-gray-500"><AlertCircle size={12}/> غير معتمد</span>
                    }
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {/* Modal طلب إذن */}
      {showPermissionForm && (
        <QuickPermissionModal
          onClose={() => setShowPermissionForm(false)}
          onSaved={() => setShowPermissionForm(false)}
        />
      )}

      {/* Modal طلب إجازة */}
      {showLeaveForm && (
        <QuickLeaveModal
          onClose={() => setShowLeaveForm(false)}
          onSaved={() => setShowLeaveForm(false)}
        />
      )}
    </div>
  );
}

// ── Modal: طلب إذن سريع ──────────────────────────────────────
const TYPE_OPTIONS     = ['طبي', 'شخصي', 'حكومي'].map(v => ({ value: v, label: v }));
const DURATION_OPTIONS = ['ساعة واحدة', 'ساعتين', 'نصف يوم'].map(v => ({ value: v, label: v }));

function QuickPermissionModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    type: 'شخصي',
    duration: 'ساعة واحدة',
    reason: '',
    request_datetime: new Date().toISOString().slice(0, 16),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: (data) => permissionsApi.create(data),
    onSuccess: () => { toast.success('تم تقديم طلب الإذن'); onSaved(); },
    onError: (err) => toast.error(err.response?.data?.message || 'حدث خطأ'),
  });

  return (
    <Modal open onClose={onClose} title="طلب إذن"
      footer={
        <>
          <Btn onClick={() => {
            if (!form.reason.trim()) { toast.error('السبب مطلوب'); return; }
            mut.mutate(form);
          }} loading={mut.isPending}>إرسال</Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Select label="نوع الإذن" value={form.type}
            onChange={e => set('type', e.target.value)} options={TYPE_OPTIONS}/>
          <Select label="المدة" value={form.duration}
            onChange={e => set('duration', e.target.value)} options={DURATION_OPTIONS}/>
        </div>
        <input
          type="datetime-local"
          value={form.request_datetime}
          onChange={e => set('request_datetime', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Textarea label="السبب *" value={form.reason}
          onChange={e => set('reason', e.target.value)}
          rows={3} placeholder="اذكر سبب طلب الإذن..."/>
      </div>
    </Modal>
  );
}

// ── Modal: طلب إجازة سريع ────────────────────────────────────
function QuickLeaveModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    leave_type_id: '',
    from_date: new Date().toISOString().slice(0, 10),
    to_date:   new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: ltData } = useQuery({
    queryKey: ['leave-types-lookup'],
    queryFn:  () => lookupApi.leaveTypes().then(r => r.data),
  });
  const leaveTypeOptions = (ltData?.data || [])
    .filter(t => t.is_active !== false)
    .map(t => ({ value: String(t.id), label: t.name }));

  const mut = useMutation({
    mutationFn: (data) => {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => fd.append(k, v));
      return leaveRequestsApi.create(fd);
    },
    onSuccess: () => { toast.success('تم تقديم طلب الإجازة'); onSaved(); },
    onError: (err) => toast.error(err.response?.data?.message || 'حدث خطأ'),
  });

  return (
    <Modal open onClose={onClose} title="طلب إجازة"
      footer={
        <>
          <Btn onClick={() => {
            if (!form.leave_type_id) { toast.error('نوع الإجازة مطلوب'); return; }
            if (!form.from_date || !form.to_date) { toast.error('التاريخ مطلوب'); return; }
            if (!form.reason.trim()) { toast.error('السبب مطلوب'); return; }
            mut.mutate(form);
          }} loading={mut.isPending}>إرسال</Btn>
          <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
        </>
      }>
      <div className="space-y-3">
        <Select label="نوع الإجازة" value={form.leave_type_id}
          onChange={e => set('leave_type_id', e.target.value)} options={leaveTypeOptions}/>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">من تاريخ</label>
            <input type="date" value={form.from_date}
              onChange={e => set('from_date', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">إلى تاريخ</label>
            <input type="date" value={form.to_date}
              onChange={e => set('to_date', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
        </div>
        <Textarea label="سبب الإجازة *" value={form.reason}
          onChange={e => set('reason', e.target.value)}
          rows={3} placeholder="اذكر سبب طلب الإجازة..."/>
      </div>
    </Modal>
  );
}
