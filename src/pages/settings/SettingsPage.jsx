import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { PageHeader } from '../../components/layout/Layout';
import { Btn, Badge, Card, Modal, Input, Select, Table, Tr, Td, Loading } from '../../components/ui';
import { Plus, Pencil, Trash2, MapPin, Building2, Clock, Calendar, Settings, Timer } from 'lucide-react';

// ── التبويبات ─────────────────────────────────────────────────
const TABS = [
  { id: 'cities',          label: 'المدن والأحياء',   icon: MapPin      },
  { id: 'prop-types',      label: 'أنواع العقارات',   icon: Building2   },
  { id: 'shifts',          label: 'الشفتات',           icon: Clock       },
  { id: 'leave-types',     label: 'أنواع الإجازات',   icon: Calendar    },
  { id: 'perm-durations',  label: 'مدد الإذونات',     icon: Timer       },
  { id: 'attendance',      label: 'إعدادات الدوام',   icon: Settings    },
];

// ── الصفحة الرئيسية ──────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState('cities');

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="إدارة إعدادات النظام العامة" />

      <div className="p-4 sm:p-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">

          {/* رأس التبويبات */}
          <div className="flex border-b border-gray-700 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border-b-2 -mb-px flex-shrink-0
                  ${tab === t.id
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-700/30'
                  }`}
              >
                <t.icon size={14}/>
                {t.label}
              </button>
            ))}
          </div>

          {/* محتوى التبويب */}
          <div className="p-4 sm:p-6">
            {tab === 'cities'         && <TabCities />}
            {tab === 'prop-types'     && <TabPropertyTypes />}
            {tab === 'shifts'         && <TabShifts />}
            {tab === 'leave-types'    && <TabLeaveTypes />}
            {tab === 'perm-durations' && <TabPermissionDurations />}
            {tab === 'attendance'     && <TabAttendanceSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// تبويب 1: المدن والأحياء
// ══════════════════════════════════════════════════════════════
function TabCities() {
  const qc = useQueryClient();
  const [showCityForm, setShowCityForm]     = useState(false);
  const [editCity,     setEditCity]         = useState(null);
  const [showNHForm,   setShowNHForm]       = useState(false);
  const [editNH,       setEditNH]           = useState(null);
  const [selectedCity, setSelectedCity]     = useState('');

  // جلب المدن
  const { data: citiesData, isLoading: citiesLoading } = useQuery({
    queryKey: ['cities'],
    queryFn:  () => client.get('/lookups/cities').then(r => r.data),
  });
  const cities = citiesData?.data || [];

  // جلب أحياء المدينة المختارة
  const { data: nhData, isLoading: nhLoading } = useQuery({
    queryKey: ['neighborhoods', selectedCity],
    queryFn:  () => client.get(`/lookups/cities/${selectedCity}/neighborhoods`).then(r => r.data),
    enabled:  !!selectedCity,
  });
  const neighborhoods = nhData?.data || [];

  const invalidateCities = () => qc.invalidateQueries({ queryKey: ['cities'] });
  const invalidateNH     = () => qc.invalidateQueries({ queryKey: ['neighborhoods'] });

  const deleteCityMut = useMutation({
    mutationFn: (id) => client.delete(`/lookups/cities/${id}`),
    onSuccess:  () => { toast.success('تم حذف المدينة'); invalidateCities(); },
    onError:    () => toast.error('فشل الحذف'),
  });

  const deleteNHMut = useMutation({
    mutationFn: (id) => client.delete(`/lookups/neighborhoods/${id}`),
    onSuccess:  () => { toast.success('تم حذف الحي'); invalidateNH(); },
    onError:    () => toast.error('فشل الحذف'),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ── المدن ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
            <MapPin size={14} className="text-blue-400"/> المدن
          </h3>
          <Btn size="sm" onClick={() => { setEditCity(null); setShowCityForm(true); }}>
            <Plus size={12}/> إضافة مدينة
          </Btn>
        </div>

        {citiesLoading ? <Loading /> : cities.length === 0 ? (
          <EmptyState msg="لا توجد مدن مسجّلة" />
        ) : (
          <Table headers={['المدينة', 'الرمز', 'إجراءات']}>
            {cities.map(city => (
              <Tr key={city.id}>
                <Td className="font-semibold text-gray-200">{city.name}</Td>
                <Td className="font-mono text-xs text-blue-400">{city.code || '—'}</Td>
                <Td>
                  <RowActions
                    onEdit={() => { setEditCity(city); setShowCityForm(true); }}
                    onDelete={() => {
                      if (confirm('هل أنت متأكد من حذف المدينة؟')) deleteCityMut.mutate(city.id);
                    }}
                  />
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </div>

      {/* ── الأحياء ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
            <MapPin size={14} className="text-green-400"/> الأحياء
          </h3>
          <Btn size="sm" onClick={() => { setEditNH(null); setShowNHForm(true); }}>
            <Plus size={12}/> إضافة حي
          </Btn>
        </div>

        {/* فلتر المدينة */}
        <select
          value={selectedCity}
          onChange={e => setSelectedCity(e.target.value)}
          className="w-full mb-4 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">اختر مدينة لعرض أحيائها...</option>
          {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {!selectedCity ? (
          <EmptyState msg="اختر مدينة من القائمة أعلاه" />
        ) : nhLoading ? <Loading /> : neighborhoods.length === 0 ? (
          <EmptyState msg="لا توجد أحياء لهذه المدينة" />
        ) : (
          <Table headers={['الحي', 'المدينة', 'إجراءات']}>
            {neighborhoods.map(nh => (
              <Tr key={nh.id}>
                <Td className="font-semibold text-gray-200">{nh.name}</Td>
                <Td className="text-xs text-gray-400">
                  {nh.city?.name || cities.find(c => String(c.id) === selectedCity)?.name || '—'}
                </Td>
                <Td>
                  <RowActions
                    onEdit={() => { setEditNH(nh); setShowNHForm(true); }}
                    onDelete={() => {
                      if (confirm('هل أنت متأكد من حذف الحي؟')) deleteNHMut.mutate(nh.id);
                    }}
                  />
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </div>

      {/* Modals */}
      {showCityForm && (
        <CityFormModal
          city={editCity}
          onClose={() => { setShowCityForm(false); setEditCity(null); }}
          onSaved={() => { invalidateCities(); setShowCityForm(false); setEditCity(null); }}
        />
      )}
      {showNHForm && (
        <NeighborhoodFormModal
          nh={editNH}
          cities={cities}
          defaultCityId={selectedCity}
          onClose={() => { setShowNHForm(false); setEditNH(null); }}
          onSaved={() => { invalidateNH(); setShowNHForm(false); setEditNH(null); }}
        />
      )}
    </div>
  );
}

function CityFormModal({ city, onClose, onSaved }) {
  const isEdit = !!city;
  const [form, setForm] = useState({ name: city?.name || '', code: city?.code || '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: (d) => isEdit
      ? client.put(`/lookups/cities/${city.id}`, d)
      : client.post('/lookups/cities', d),
    onSuccess: () => { toast.success(isEdit ? 'تم تعديل المدينة' : 'تمت إضافة المدينة'); onSaved(); },
    onError:   (err) => handleFormError(err),
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'تعديل مدينة' : 'إضافة مدينة'}
      footer={<FormFooter onSave={() => {
        if (!form.name.trim()) { toast.error('اسم المدينة مطلوب'); return; }
        mut.mutate(form);
      }} loading={mut.isPending} onClose={onClose} />}
    >
      <div className="space-y-4">
        <Input label="اسم المدينة *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="مثال: الرياض" />
        <Input label="الرمز"         value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="مثال: RN" />
      </div>
    </Modal>
  );
}

function NeighborhoodFormModal({ nh, cities, defaultCityId, onClose, onSaved }) {
  const isEdit = !!nh;
  const [form, setForm] = useState({
    name:    nh?.name    || '',
    city_id: nh?.city_id || defaultCityId || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const cityOptions = [
    { value: '', label: 'اختر المدينة...' },
    ...cities.map(c => ({ value: String(c.id), label: c.name })),
  ];

  const mut = useMutation({
    mutationFn: (d) => isEdit
      ? client.put(`/lookups/neighborhoods/${nh.id}`, d)
      : client.post('/lookups/neighborhoods', d),
    onSuccess: () => { toast.success(isEdit ? 'تم تعديل الحي' : 'تمت إضافة الحي'); onSaved(); },
    onError:   (err) => handleFormError(err),
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'تعديل حي' : 'إضافة حي'}
      footer={<FormFooter onSave={() => {
        if (!form.city_id)      { toast.error('المدينة مطلوبة'); return; }
        if (!form.name.trim())  { toast.error('اسم الحي مطلوب'); return; }
        mut.mutate(form);
      }} loading={mut.isPending} onClose={onClose} />}
    >
      <div className="space-y-4">
        <Select label="المدينة *" value={form.city_id} onChange={e => set('city_id', e.target.value)} options={cityOptions} />
        <Input  label="اسم الحي *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="مثال: حي النزهة" />
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// تبويب 2: أنواع العقارات
// ══════════════════════════════════════════════════════════════
function TabPropertyTypes() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['property-types'],
    queryFn:  () => client.get('/lookups/property-types').then(r => r.data),
  });
  const items = data?.data || [];

  const deleteMut = useMutation({
    mutationFn: (id) => client.delete(`/lookups/property-types/${id}`),
    onSuccess:  () => { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['property-types'] }); },
    onError:    () => toast.error('فشل الحذف'),
  });

  const close = () => { setShowForm(false); setEditItem(null); };

  return (
    <div>
      <SectionHeader label="أنواع العقارات" onAdd={() => { setEditItem(null); setShowForm(true); }} addLabel="إضافة نوع" />

      {isLoading ? <Loading /> : items.length === 0 ? <EmptyState msg="لا توجد أنواع عقارات" /> : (
        <Table headers={['النوع', 'الحالة', 'إجراءات']}>
          {items.map(item => (
            <Tr key={item.id}>
              <Td className="font-semibold text-gray-200">{item.name}</Td>
              <Td>
                <Badge label={item.is_active ? 'نشط' : 'غير نشط'} color={item.is_active ? 'green' : 'red'} />
              </Td>
              <Td>
                <RowActions
                  onEdit={() => { setEditItem(item); setShowForm(true); }}
                  onDelete={() => { if (confirm('هل أنت متأكد من الحذف؟')) deleteMut.mutate(item.id); }}
                />
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {showForm && (
        <PropertyTypeFormModal
          item={editItem}
          onClose={close}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['property-types'] }); close(); }}
        />
      )}
    </div>
  );
}

function PropertyTypeFormModal({ item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({ name: item?.name || '', is_active: item?.is_active ?? true });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: (d) => isEdit
      ? client.put(`/lookups/property-types/${item.id}`, d)
      : client.post('/lookups/property-types', d),
    onSuccess: () => { toast.success(isEdit ? 'تم التعديل' : 'تمت الإضافة'); onSaved(); },
    onError:   (err) => handleFormError(err),
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'تعديل نوع عقار' : 'إضافة نوع عقار'}
      footer={<FormFooter onSave={() => {
        if (!form.name.trim()) { toast.error('اسم النوع مطلوب'); return; }
        mut.mutate(form);
      }} loading={mut.isPending} onClose={onClose} />}
    >
      <div className="space-y-4">
        <Input label="اسم النوع *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="مثال: شقة" />
        <CheckboxField
          label="نشط"
          checked={form.is_active}
          onChange={v => set('is_active', v)}
        />
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// تبويب 3: الشفتات
// ══════════════════════════════════════════════════════════════
function TabShifts() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn:  () => client.get('/lookups/shifts').then(r => r.data),
  });
  const items = data?.data || [];

  const deleteMut = useMutation({
    mutationFn: (id) => client.delete(`/lookups/shifts/${id}`),
    onSuccess:  () => { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['shifts'] }); },
    onError:    () => toast.error('فشل الحذف'),
  });

  const close = () => { setShowForm(false); setEditItem(null); };

  return (
    <div>
      <SectionHeader label="الشفتات" onAdd={() => { setEditItem(null); setShowForm(true); }} addLabel="إضافة شفت" />

      {isLoading ? <Loading /> : items.length === 0 ? <EmptyState msg="لا توجد شفتات مسجّلة" /> : (
        <Table headers={['الشفت', 'البداية', 'النهاية', 'سماح التأخير', 'إجراءات']}>
          {items.map(item => (
            <Tr key={item.id}>
              <Td className="font-semibold text-gray-200">{item.name}</Td>
              <Td className="font-mono text-green-400 text-xs">{(item.start_time || '').slice(0, 5)}</Td>
              <Td className="font-mono text-red-400 text-xs">{(item.end_time   || '').slice(0, 5)}</Td>
              <Td className="text-gray-400 text-xs">{item.late_tolerance_minutes ?? 0} دقيقة</Td>
              <Td>
                <RowActions
                  onEdit={() => { setEditItem(item); setShowForm(true); }}
                  onDelete={() => { if (confirm('هل أنت متأكد من حذف الشفت؟')) deleteMut.mutate(item.id); }}
                />
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {showForm && (
        <ShiftFormModal
          shift={editItem}
          onClose={close}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['shifts'] }); close(); }}
        />
      )}
    </div>
  );
}

function ShiftFormModal({ shift, onClose, onSaved }) {
  const isEdit = !!shift;
  const [form, setForm] = useState({
    name:                   shift?.name                   || '',
    start_time:             (shift?.start_time  || '').slice(0, 5),
    end_time:               (shift?.end_time    || '').slice(0, 5),
    late_tolerance_minutes: shift?.late_tolerance_minutes ?? 15,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: (d) => isEdit
      ? client.put(`/lookups/shifts/${shift.id}`, d)
      : client.post('/lookups/shifts', d),
    onSuccess: () => { toast.success(isEdit ? 'تم تعديل الشفت' : 'تمت إضافة الشفت'); onSaved(); },
    onError:   (err) => handleFormError(err),
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'تعديل شفت' : 'إضافة شفت'}
      footer={<FormFooter onSave={() => {
        if (!form.name.trim())  { toast.error('اسم الشفت مطلوب'); return; }
        if (!form.start_time)   { toast.error('وقت البداية مطلوب'); return; }
        if (!form.end_time)     { toast.error('وقت النهاية مطلوب'); return; }
        mut.mutate(form);
      }} loading={mut.isPending} onClose={onClose} />}
    >
      <div className="space-y-4">
        <Input
          label="اسم الشفت *"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="مثال: الشفت الصباحي"
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="وقت البداية *" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
          <Input label="وقت النهاية *" type="time" value={form.end_time}   onChange={e => set('end_time',   e.target.value)} />
        </div>
        <Input
          label="فترة السماح بالتأخير (دقيقة) *"
          type="number" min="0"
          value={form.late_tolerance_minutes}
          onChange={e => set('late_tolerance_minutes', Number(e.target.value))}
        />
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// تبويب 4: أنواع الإجازات
// ══════════════════════════════════════════════════════════════
function TabLeaveTypes() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leave-types'],
    queryFn:  () => client.get('/lookups/leave-types').then(r => r.data),
  });
  const items = data?.data || [];

  const deleteMut = useMutation({
    mutationFn: (id) => client.delete(`/lookups/leave-types/${id}`),
    onSuccess:  () => { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['leave-types'] }); },
    onError:    () => toast.error('فشل الحذف'),
  });

  const close = () => { setShowForm(false); setEditItem(null); };

  return (
    <div>
      <SectionHeader label="أنواع الإجازات" onAdd={() => { setEditItem(null); setShowForm(true); }} addLabel="إضافة نوع" />

      {isLoading ? <Loading /> : items.length === 0 ? <EmptyState msg="لا توجد أنواع إجازات" /> : (
        <Table headers={['النوع', 'الرصيد (يوم)', 'مرفق', 'الحالة', 'إجراءات']}>
          {items.map(item => (
            <Tr key={item.id}>
              <Td className="font-semibold text-gray-200">{item.name}</Td>
              <Td className="font-mono text-center text-blue-400">{item.total_days}</Td>
              <Td>
                <Badge
                  label={item.requires_attachment ? 'مطلوب' : 'اختياري'}
                  color={item.requires_attachment ? 'amber' : 'gray'}
                />
              </Td>
              <Td>
                <Badge label={item.is_active ? 'نشط' : 'غير نشط'} color={item.is_active ? 'green' : 'red'} />
              </Td>
              <Td>
                <RowActions
                  onEdit={() => { setEditItem(item); setShowForm(true); }}
                  onDelete={() => { if (confirm('هل أنت متأكد من الحذف؟')) deleteMut.mutate(item.id); }}
                />
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {showForm && (
        <LeaveTypeFormModal
          item={editItem}
          onClose={close}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['leave-types'] }); close(); }}
        />
      )}
    </div>
  );
}

function LeaveTypeFormModal({ item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    name:                item?.name                || '',
    total_days:          item?.total_days          ?? 30,
    requires_attachment: item?.requires_attachment ?? false,
    is_active:           item?.is_active           ?? true,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: (d) => isEdit
      ? client.put(`/lookups/leave-types/${item.id}`, d)
      : client.post('/lookups/leave-types', d),
    onSuccess: () => { toast.success(isEdit ? 'تم التعديل' : 'تمت الإضافة'); onSaved(); },
    onError:   (err) => handleFormError(err),
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'تعديل نوع إجازة' : 'إضافة نوع إجازة'}
      footer={<FormFooter onSave={() => {
        if (!form.name.trim())           { toast.error('الاسم مطلوب'); return; }
        if (!form.total_days || form.total_days < 1) { toast.error('الرصيد الإجمالي مطلوب (أيام)'); return; }
        mut.mutate(form);
      }} loading={mut.isPending} onClose={onClose} />}
    >
      <div className="space-y-4">
        <Input
          label="اسم نوع الإجازة *"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="مثال: إجازة سنوية"
        />
        <Input
          label="الرصيد الإجمالي (أيام) *"
          type="number" min="1"
          value={form.total_days}
          onChange={e => set('total_days', Number(e.target.value))}
        />
        <div className="grid grid-cols-2 gap-3">
          <CheckboxField
            label="تستلزم مرفقاً"
            checked={form.requires_attachment}
            onChange={v => set('requires_attachment', v)}
          />
          <CheckboxField
            label="نشط"
            checked={form.is_active}
            onChange={v => set('is_active', v)}
          />
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// تبويب 5: مدد الإذونات
// ══════════════════════════════════════════════════════════════
function TabPermissionDurations() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['permission-durations'],
    queryFn:  () => client.get('/lookups/permission-durations').then(r => r.data),
  });
  const items = data?.data || [];

  const deleteMut = useMutation({
    mutationFn: (id) => client.delete(`/lookups/permission-durations/${id}`),
    onSuccess:  () => { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['permission-durations'] }); },
    onError:    () => toast.error('فشل الحذف'),
  });

  const close = () => { setShowForm(false); setEditItem(null); };

  return (
    <div>
      <SectionHeader label="مدد الإذونات" onAdd={() => { setEditItem(null); setShowForm(true); }} addLabel="إضافة مدة" />
      <p className="text-xs text-gray-500 mb-4">تظهر هذه الخيارات للموظف عند تقديم طلب إذن جديد.</p>

      {isLoading ? <Loading /> : items.length === 0 ? <EmptyState msg="لا توجد مدد مضافة — أضف مدة أولى" /> : (
        <Table headers={['المدة', 'الترتيب', 'إجراءات']}>
          {items.map(item => (
            <Tr key={item.id}>
              <Td className="font-semibold text-gray-200">{item.name}</Td>
              <Td className="text-center text-gray-500 text-xs">{item.sort_order}</Td>
              <Td>
                <RowActions
                  onEdit={() => { setEditItem(item); setShowForm(true); }}
                  onDelete={() => { if (confirm('هل أنت متأكد من حذف هذه المدة؟')) deleteMut.mutate(item.id); }}
                />
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {showForm && (
        <PermissionDurationFormModal
          item={editItem}
          onClose={close}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['permission-durations'] }); close(); }}
        />
      )}
    </div>
  );
}

function PermissionDurationFormModal({ item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    name:       item?.name       || '',
    sort_order: item?.sort_order ?? 0,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: (d) => isEdit
      ? client.put(`/lookups/permission-durations/${item.id}`, d)
      : client.post('/lookups/permission-durations', d),
    onSuccess: () => { toast.success(isEdit ? 'تم التعديل' : 'تمت الإضافة'); onSaved(); },
    onError:   (err) => handleFormError(err),
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? 'تعديل مدة إذن' : 'إضافة مدة إذن'}
      footer={<FormFooter onSave={() => {
        if (!form.name.trim()) { toast.error('اسم المدة مطلوب'); return; }
        mut.mutate(form);
      }} loading={mut.isPending} onClose={onClose} />}
    >
      <div className="space-y-4">
        <Input
          label="اسم المدة *"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="مثال: ساعة واحدة"
        />
        <Input
          label="الترتيب في القائمة"
          type="number" min="0"
          value={form.sort_order}
          onChange={e => set('sort_order', Number(e.target.value))}
        />
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// تبويب 6: إعدادات الدوام
// ══════════════════════════════════════════════════════════════
function TabAttendanceSettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    late_tolerance_minutes:    15,
    overtime_multiplier:       1.5,
    deduction_after_late_days: 3,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data, isLoading } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn:  () => client.get('/lookups/attendance-settings').then(r => r.data),
  });

  useEffect(() => {
    if (!data) return;
    const s = data?.data || data;
    setForm({
      late_tolerance_minutes:    s.late_tolerance_minutes    ?? 15,
      overtime_multiplier:       s.overtime_multiplier       ?? 1.5,
      deduction_after_late_days: s.deduction_after_late_days ?? 3,
    });
  }, [data]);

  const mut = useMutation({
    mutationFn: (d) => client.put('/lookups/attendance-settings', d),
    onSuccess:  () => { toast.success('تم حفظ الإعدادات'); qc.invalidateQueries({ queryKey: ['attendance-settings'] }); },
    onError:    () => toast.error('فشل الحفظ'),
  });

  if (isLoading) return <Loading />;

  return (
    <div className="max-w-md space-y-5">
      <h3 className="text-sm font-bold text-gray-200 mb-5">إعدادات الدوام والحضور</h3>

      <Input
        label="فترة السماح بالتأخير (دقيقة)"
        type="number" min="0"
        value={form.late_tolerance_minutes}
        onChange={e => set('late_tolerance_minutes', Number(e.target.value))}
      />
      <Input
        label="معامل حساب الساعة الإضافية"
        type="number" min="1" step="0.1"
        value={form.overtime_multiplier}
        onChange={e => set('overtime_multiplier', Number(e.target.value))}
      />
      <Input
        label="عدد أيام التأخير قبل تطبيق الخصم"
        type="number" min="0"
        value={form.deduction_after_late_days}
        onChange={e => set('deduction_after_late_days', Number(e.target.value))}
      />

      <Btn onClick={() => mut.mutate(form)} loading={mut.isPending}>
        💾 حفظ الإعدادات
      </Btn>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// مكوّنات مساعدة مشتركة
// ══════════════════════════════════════════════════════════════

function SectionHeader({ label, onAdd, addLabel }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-bold text-gray-200">{label}</h3>
      <Btn size="sm" onClick={onAdd}>
        <Plus size={12}/> {addLabel}
      </Btn>
    </div>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1">
      <Btn size="sm" variant="ghost" onClick={onEdit} title="تعديل">
        <Pencil size={12}/>
      </Btn>
      <Btn size="sm" variant="ghost" onClick={onDelete} title="حذف"
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
        <Trash2 size={12}/>
      </Btn>
    </div>
  );
}

function FormFooter({ onSave, loading, onClose }) {
  return (
    <>
      <Btn onClick={onSave} loading={loading}>حفظ</Btn>
      <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
    </>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 p-3 bg-gray-900/60 border border-gray-700 rounded-xl cursor-pointer hover:border-gray-600 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-blue-500"
      />
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

function EmptyState({ msg }) {
  return (
    <div className="text-center py-10 text-gray-500 text-sm bg-gray-900/30 rounded-xl border border-gray-700/50">
      {msg}
    </div>
  );
}

function handleFormError(err) {
  const errors = err.response?.data?.errors;
  if (errors) Object.values(errors).flat().forEach(e => toast.error(e));
  // client interceptor already shows generic messages
}
