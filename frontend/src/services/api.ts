import axios from 'axios';

// Support both React App (CRA compatibility) and Vite env vars
const API_URL = import.meta.env.VITE_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Response interceptor for global 401 handling (session persistence)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Check if we can "fetch" a new token (e.g., from a refresh flow if implemented, 
            // but here we check if one exists in session to avoid endless loop)
            const token = sessionStorage.getItem('authToken');
            if (!token) {
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('userRole');
                sessionStorage.removeItem('userEmail');
                window.location.href = '/login';
                return Promise.reject(error);
            }

            // If we have a token but got 401, it might be expired. 
            // Typically we'd call /refresh here. For now, we force logout if it fails twice.
            sessionStorage.removeItem('authToken');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export interface PredictionParams {
    year: number;
    birth_rate?: number;
    mortality_rate?: number;
    migration?: number;
}

export const predictGrowth = async (year: number, birthRate?: number, mortalityRate?: number, migration?: number) => {
    try {
        const token = sessionStorage.getItem('authToken');
        const params: any = { year };
        if (birthRate) params.birth_rate = birthRate;
        if (mortalityRate) params.mortality_rate = mortalityRate;
        if (migration) params.migration = migration;

        const response = await api.post('/predict/growth', null, {
            params,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] predictGrowth error:', error);
        throw error;
    }
};

export const calculatePrediction = async (region: string, year: number, indicator: string) => {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await api.post('/predict/calculate', null, {
            params: { region, year, indicator },
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] calculatePrediction error:', error);
        throw error;
    }
};

export const getResearchTrends = async (region?: string | null) => {
    try {
        console.log(`[API] getResearchTrends called for region: ${region || 'ALL'}`);
        const params = region ? { region } : {};
        const response = await api.get('/research/trends', { params });
        console.log(`[API] getResearchTrends response:`, response.data);
        return response.data;
    } catch (error) {
        console.error('[API] getResearchTrends error:', error);
        throw error;
    }
};

export const getAdminStats = async (period: string = "7d") => {
    try {
        console.log(`[API] getAdminStats called with period: ${period}`);
        const response = await api.get('/admin/stats', {
            params: { period }
        });
        console.log(`[API] getAdminStats response:`, response.data);
        return response.data;
    } catch (error) {
        console.error('[API] getAdminStats error:', error);
        throw error;
    }
};

// Admin Module Endpoints
export const adminUpload = async (file: File, category: string, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/admin/upload', formData, {
        headers: {
            'Authorization': `Bearer ${token}`,
            // @ts-ignore
            'Content-Type': undefined
        },
        onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onProgress(percentCompleted);
            }
        }
    });
    return response.data;
};

export const cleanDataset = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post(`/admin/clean/${id}`, null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getHealthStats = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/analytics/health', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getQualityReport = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/datasets/${id}/quality-report`, {
        responseType: 'blob',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data; // Blob
};

// Keep legacy for compatibility if needed, but we prefer cleanDataset
export const adminClean = async (type: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/admin/clean', null, {
        params: { type },
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getAdminAudit = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/admin/audit', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// Updated export function for real download with custom filename support
export const adminExport = async (format: string, dataset: string, customFilename?: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/admin/export', {
        table_name: dataset,
        format,
        custom_filename: customFilename
    }, {
        responseType: 'blob',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data; // Blob
};

export const logAction = async (action: string, dataset: string, user: string = "analyst@inseed.td", payload?: string | null) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/admin/audit/log', null, {
        params: { action, dataset, user, payload },
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// --- NEW IAM & AUTH ---
export const generateOtp = async (email: string) => {
    const response = await api.post('/auth/otp/generate', null, { params: { email } });
    return response.data;
};

export const verifyOtp = async (email: string, code: string) => {
    const response = await api.post('/auth/otp/verify', null, { params: { email, code } });
    return response.data;
};

export const getAdminIssues = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/admin/issues', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getDatasets = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/admin/datasets', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getDatasetPreview = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/admin/preview/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getDictionary = async (tableName: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/admin/dictionary/${tableName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const createUser = async (userData: any) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/admin/users', userData, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getUsers = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
};



export const updateUser = async (userId: number, userData: { full_name?: string; email?: string; role?: string; password?: string }) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.put(`/admin/users/${userId}`, userData, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const updateUserRole = async (userId: number, role: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.put(`/admin/users/${userId}`, { role }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// Current User Profile Management
export const getCurrentUser = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const updateCurrentUserProfile = async (data: { full_name?: string; email?: string }) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.patch('/auth/me', data, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};


export const deleteUser = async (userId: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/admin/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const toggleUserStatus = async (userId: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post(`/admin/users/${userId}/toggle-status`, null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getAdminTables = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/admin/tables', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const performBackup = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/admin/backup', null, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
};

export const truncateTable = async (tableName: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/admin/truncate', null, {
        params: { table_name: tableName },
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
};

export const downloadCleaningReport = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/admin/cleaning-report', {
        responseType: 'blob',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data; // Blob
};

export const previewTable = async (tableName: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/admin/tables/${tableName}/preview`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
};

// --- NEW REPORT & EXPORT ENDPOINTS ---
export const generateReport = async (template: string, selectedCharts: string[], customFilename?: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/reports/generate', {
        template,
        selected_charts: selectedCharts,
        custom_filename: customFilename
    }, {
        responseType: 'blob',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data; // Blob
};

export const downloadReport = async (filename: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/reports/download/${filename}`, {
        responseType: 'blob',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data; // Blob
};

// Table Settings
export const getTableSettings = async (tableName: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/admin/tables/${tableName}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const updateTableSettings = async (tableName: string, isLocked: boolean) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.put(`/admin/tables/${tableName}/settings`,
        { is_locked: isLocked },
        { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.data;
};

// Row Deletion
export const deleteTableRow = async (tableName: string, rowId: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/admin/tables/${tableName}/row/${rowId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// 2FA TOTP
export const setup2FA = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/auth/2fa/setup', null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const verify2FASetup = async (code: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/auth/2fa/verify', { code }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const disable2FA = async (code: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/auth/2fa/disable', { code }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// Password Change
export const changePassword = async (currentPassword: string, newPassword: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
    }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// Report History
export const getReportHistory = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/admin/reports/history', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// Activity Stream
export const getActivityStream = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/admin/system/activity', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// Generate Report with filters
export const generateFilteredReport = async (type: string, auditType?: string, dateRange?: string, userRole?: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/admin/reports/generate', {
        type,
        audit_type: auditType,
        date_range: dateRange,
        user_role: userRole
    }, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
    });
    return response.data;
};

// --- NOTIFICATIONS & SCHEDULER ---
export const getNotifications = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/notifications/', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const markNotificationRead = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.put(`/notifications/${id}/read`, null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const deleteNotification = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/notifications/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const scheduleExport = async (scheduled_time: string, details: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/schedule-export', { scheduled_time, details }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getScheduledExports = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/schedule-export/', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const updateScheduledExport = async (id: number, scheduled_time: string, details: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.put(`/schedule-export/${id}`, { scheduled_time, details }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const deleteScheduledExport = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/schedule-export/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const downloadScheduledExport = async (notificationId: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/schedule-export/download/${notificationId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
    });
    return response.data;
};

// --- SUPPORT & COMMAND CENTER ---
export const getUrgentTickets = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/support/urgent', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const resolveTicket = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.patch(`/support/${id}/resolve`, null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const deleteTicket = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/support/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const createSupportTicket = async (data: { subject: string, message: string, is_urgent: boolean }) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/support/', data, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export default api;
