import client from './client';

// ── AUTH
export const authApi = {
  login:          (data) => client.post('/auth/login', data),
  logout:         ()     => client.post('/auth/logout'),
  me:             ()     => client.get('/auth/me'),
  changePassword: (data) => client.post('/auth/change-password', data),
};

// ── OWNERS
export const ownersApi = {
  list:       (params)     => client.get('/owners', { params }),
  show:       (id)         => client.get(`/owners/${id}`),
  create:     (data)       => client.post('/owners', data),
  update:     (id, data)   => client.put(`/owners/${id}`, data),
  delete:     (id)         => client.delete(`/owners/${id}`),
  properties: (id)         => client.get(`/owners/${id}/properties`),
};

// ── PROPERTIES
export const propertiesApi = {
  list:           (params)     => client.get('/properties', { params }),
  show:           (id)         => client.get(`/properties/${id}`),
  create:         (data)       => client.post('/properties', data),
  update:         (id, data)   => client.put(`/properties/${id}`, data),
  delete:         (id)         => client.delete(`/properties/${id}`),
  uploadDocument: (id, formData) => client.post(`/properties/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteDocument: (id, docId) => client.delete(`/properties/${id}/documents/${docId}`),
};

// ── LEADS
export const leadsApi = {
  list:         (params)   => client.get('/leads', { params }),
  show:         (id)       => client.get(`/leads/${id}`),
  create:       (data)     => client.post('/leads', data),
  update:       (id, data) => client.put(`/leads/${id}`, data),
  delete:       (id)       => client.delete(`/leads/${id}`),
  updateStatus: (id, data) => client.patch(`/leads/${id}/status`, data),
};

// ── VISITS
export const visitsApi = {
  list:    (params)   => client.get('/visits', { params }),
  create:  (data)     => client.post('/visits', data),
  confirm: (id)       => client.patch(`/visits/${id}/confirm`),
  cancel:  (id, data) => client.patch(`/visits/${id}/cancel`, data),
};

// ── EMPLOYEES
export const employeesApi = {
  list:          (params)       => client.get('/employees', { params }),
  show:          (id)           => client.get(`/employees/${id}`),
  create:        (data)         => client.post('/employees', data),
  update:        (id, data)     => client.put(`/employees/${id}`, data),
  suspend:       (id)           => client.patch(`/employees/${id}/suspend`),
  activate:      (id)           => client.patch(`/employees/${id}/activate`),
  updateSalary:  (id, data)     => client.post(`/employees/${id}/salary`, data),
  uploadDoc:     (id, formData) => client.post(`/employees/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteDoc:     (id, docId)    => client.delete(`/employees/${id}/documents/${docId}`),
  leaveBalances: (id)           => client.get(`/employees/${id}/leave-balances`),
  updateGroup:   (id, data)     => client.patch(`/employees/${id}/permission-group`, data),
  getPermissions:(id)           => client.get(`/employees/${id}/permissions`),
  updatePermissions: (id, data) => client.put(`/employees/${id}/permissions`, data),
  sendWelcomeEmails: ()          => client.post('/employees/send-welcome-emails'),
  resetPassword:     (id, data)  => client.patch(`/employees/${id}/reset-password`, data),
};

// ── PERMISSION GROUPS (الأدوار)
export const permissionGroupsApi = {
  list:   ()       => client.get('/permission-groups'),
  show:   (id)     => client.get(`/permission-groups/${id}`),
  create: (data)   => client.post('/permission-groups', data),
  update: (id, data) => client.put(`/permission-groups/${id}`, data),
  remove: (id)     => client.delete(`/permission-groups/${id}`),
};

// ── ATTENDANCE
export const attendanceApi = {
  list:    (params) => client.get('/attendance', { params }),
  store:   (data)   => client.post('/attendance', data),
  approve: (id)     => client.patch(`/attendance/${id}/approve`),
  export:  (params) => client.get('/attendance/export', { params }),
};

// وقت/تاريخ جهاز الموظف نفسه (مو وقت السيرفر) — يُرسل مع كل بصمة
const deviceNow = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};

// ── PUNCH (بصمة الموظف)
export const punchApi = {
  today:      ()       => client.get('/punch/today', { params: deviceNow() }),
  checkIn:    ()       => client.post('/punch/check-in', deviceNow()),
  checkOut:   ()       => client.post('/punch/check-out', deviceNow()),
  breakStart: ()       => client.post('/punch/break-start', deviceNow()),
  breakEnd:   ()       => client.post('/punch/break-end', deviceNow()),
  history:    (params) => client.get('/punch/history', { params }),
};

// ── LEAVE REQUESTS
export const leaveRequestsApi = {
  list:           (params)   => client.get('/leave-requests', { params }),
  create:         (formData) => client.post('/leave-requests', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  managerApprove: (id, data) => client.patch(`/leave-requests/${id}/manager-approve`, data),
  managerReject:  (id, data) => client.patch(`/leave-requests/${id}/manager-reject`, data),
  managerInquire: (id, data) => client.patch(`/leave-requests/${id}/manager-inquire`, data),
  hrApprove:      (id, data) => client.patch(`/leave-requests/${id}/hr-approve`, data),
  hrReject:       (id, data) => client.patch(`/leave-requests/${id}/hr-reject`, data),
  hrInquire:      (id, data) => client.patch(`/leave-requests/${id}/hr-inquire`, data),
  clarify:        (id, data) => client.patch(`/leave-requests/${id}/clarify`, data),
};

// ── PERMISSIONS
export const permissionsApi = {
  list:    (params)   => client.get('/permission-requests', { params }),
  create:  (data)     => client.post('/permission-requests', data),
  approve: (id, data) => client.patch(`/permission-requests/${id}/approve`, data),
  reject:  (id, data) => client.patch(`/permission-requests/${id}/reject`, data),
  inquire: (id, data) => client.patch(`/permission-requests/${id}/inquire`, data),
  clarify: (id, data) => client.patch(`/permission-requests/${id}/clarify`, data),
};

// ── LOOKUP
export const lookupApi = {
  cities:              ()        => client.get('/lookup/cities'),
  neighborhoods:       (city_id) => client.get('/lookup/neighborhoods', { params: { city_id } }),
  hr:                  ()        => client.get('/lookup/hr'),
  leaveTypes:          ()        => client.get('/lookups/leave-types'),
  permissionDurations: ()        => client.get('/lookups/permission-durations'),
};

// ── NOTIFICATIONS
export const notificationsApi = {
  list:        (params) => client.get('/notifications', { params }),
  markRead:    (id)     => client.patch(`/notifications/${id}/read`),
  markAllRead: ()       => client.patch('/notifications/read-all'),
  delete:      (id)     => client.delete(`/notifications/${id}`),
  clearAll:    ()       => client.delete('/notifications/clear-all'),
};