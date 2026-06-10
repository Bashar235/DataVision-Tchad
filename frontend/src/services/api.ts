import axios from 'axios';

// Support both React App (CRA compatibility) and Vite env vars
export const API_URL = import.meta.env.VITE_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:8000';

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

        const response = await api.post('/v1/data/predict/growth', null, {
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
        const response = await api.post('/v1/data/predict/calculate', null, {
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
        const response = await api.get('/v1/data/research/trends', { params });
        console.log(`[API] getResearchTrends response:`, response.data);
        return response.data;
    } catch (error) {
        console.error('[API] getResearchTrends error:', error);
        throw error;
    }
};

export const getResearcherViz = async (params: { 
    indicator?: string; 
    region: string; 
    start_year: number; 
    end_year: number; 
    gender?: string;
    dataset_id?: string;
    expert_mode?: boolean;
}) => {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await api.get('/v1/researcher/viz', {
            params,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] getResearcherViz error:', error);
        throw error;
    }
};

export const getResearcherAgeStats = async (params: {
    region: string;
    year: number;
    gender?: string;
    dataset_id?: string;
}) => {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await api.get('/v1/researcher/age-distribution', {
            params,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] getResearcherAgeStats error:', error);
        throw error;
    }
};

export const getResearcherOverviewStats = async () => {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await api.get('/v1/researcher/overview-stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] getResearcherOverviewStats error:', error);
        throw error;
    }
};

export const getAdminStats = async (period: string = "7d") => {
    try {
        console.log(`[API] getAdminStats called with period: ${period}`);
        const token = sessionStorage.getItem('authToken');
        const response = await api.get('/v1/admin/stats', {
            params: { period },
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`[API] getAdminStats response:`, response.data);
        return response.data;
    } catch (error) {
        console.error('[API] getAdminStats error:', error);
        throw error;
    }
};

export const getAdminProductivity = async () => {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await api.get('/v1/admin/analytics/productivity', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] getAdminProductivity error:', error);
        throw error;
    }
};


export const getAnalystOverview = async (region: string = "Tchad") => {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await api.get('/v1/analyst/overview', {
            params: { region },
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] getAnalystOverview error:', error);
        throw error;
    }
};

// Admin/Analyst Module Endpoints
export const preFlightCheck = async (file: File, category: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/analyst/pre-flight-check', formData, {
        headers: {
            'Authorization': `Bearer ${token}`,
            // @ts-ignore
            'Content-Type': undefined
        }
    });
    return response.data;
};

export const logAIRepairDecision = async (datasetId: string, filename: string, formatErrorCount: number) => {
    const formData = new FormData();
    formData.append('dataset_id', datasetId);
    formData.append('filename', filename);
    formData.append('format_error_count', formatErrorCount.toString());

    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/analyst/log-ai-repair', formData, {
        headers: {
            'Authorization': `Bearer ${token}`,
            // @ts-ignore
            'Content-Type': undefined
        }
    });
    return response.data;
};

export const adminUpload = async (file: File, category: string, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/admin/upload', formData, {
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

export const cleanDataset = async (id: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post(`/v1/admin/clean/${id}`, null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// NEW: ML-powered cleaning via clean-upload endpoint
export const cleanDatasetML = async (datasetId: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/ml/clean-upload', {
        dataset_id: datasetId,
        category: 'census' // Default or dynamic if needed
    }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getHealthStats = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/analytics/health', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getQualityReport = async (id: string | any) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/datasets/${id}/quality-report`, {
        responseType: 'blob',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data; // Blob
};

// Keep legacy for compatibility if needed, but we prefer cleanDataset
export const adminClean = async (type: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/admin/clean', null, {
        params: { type },
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getAdminAudit = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/admin/audit', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const exportAuditLog = async (format: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/admin/security/export-audit', {
        params: { format },
        responseType: 'blob',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data; // Blob
};

// Updated export function for real download with custom filename support
export const adminExport = async (format: string, dataset: string, customFilename?: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/admin/export', {
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
    const response = await api.post('/v1/admin/audit/log', null, {
        params: { action, dataset, user, payload },
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// --- NEW IAM & AUTH ---
export const generateOtp = async (email: string) => {
    const response = await api.post('/v1/auth/otp/generate', null, { params: { email } });
    return response.data;
};

export const verifyOtp = async (email: string, code: string) => {
    const response = await api.post('/v1/auth/otp/verify', null, { params: { email, code } });
    return response.data;
};

export const getAdminIssues = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/admin/issues', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getDatasets = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/admin/datasets', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getDatasetPreview = async (id: string, options?: { full?: boolean }) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/admin/preview/${id}`, {
        params: options?.full ? { full: true } : undefined,
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getDatasetComparison = async (id: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/ml/comparison/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const deleteDataset = async (id: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/v1/data/dataset/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const bulkDeleteDatasets = async (ids: string[]): Promise<{ deleted_count: number; ids: string[] }> => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/data/datasets/bulk-delete', { ids }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const downloadDatasetRaw = async (id: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/admin/download/${id}`, {
        responseType: 'blob',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data; // Blob
};

export const previewCleanedData = async (id: string | any) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/admin/preview_cleaned_data/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getDictionary = async (tableName: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/admin/dictionary/${tableName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const createUser = async (userData: any) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/admin/users', userData, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getUsers = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const login = async (email: string, password: string) => {
    const response = await api.post('/v1/auth/login', { email, password });
    return response.data;
};

export const logoutUser = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/auth/logout', null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};



export const updateUser = async (userId: number, userData: { full_name?: string; email?: string; role?: string; password?: string }) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.put(`/v1/admin/users/${userId}`, userData, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const updateUserRole = async (userId: number, role: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.put(`/v1/admin/users/${userId}`, { role }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// Current User Profile Management
export const getCurrentUser = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const updateCurrentUserProfile = async (data: { full_name?: string; email?: string }) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.patch('/v1/auth/me', data, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};


export const deleteUser = async (userId: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/v1/admin/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const toggleUserStatus = async (userId: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post(`/v1/admin/users/${userId}/toggle-status`, null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getAdminTables = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/admin/tables', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const performBackup = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/admin/backup', null, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
};

export const truncateTable = async (tableName: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/admin/truncate', null, {
        params: { table_name: tableName },
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
};

export const downloadCleaningReport = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/admin/cleaning-report', {
        responseType: 'blob',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data; // Blob
};

export const previewTable = async (tableName: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/admin/tables/${tableName}/preview`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
};

// --- NEW REPORT & EXPORT ENDPOINTS ---
export interface ReportConfig {
    template: string;
    sections?: string[];
    region?: string;
    format?: string;
    selectedCharts?: string[];
    customFilename?: string;
    includeWatermark?: boolean;
    language?: string;
}

export const generateReport = async (config: ReportConfig & { regions?: string[] }) => {
    const token = sessionStorage.getItem('authToken');
    const userIdStr = sessionStorage.getItem('userId');
    const analystId = userIdStr ? parseInt(userIdStr) : undefined;

    const response = await api.post('/v1/reports/generate', {
        type: config.template,
        template: config.template,
        sections: config.sections,
        region: config.region,
        regions: config.regions, // Added for multi-region
        format: config.format,
        selected_charts: config.selectedCharts,
        custom_filename: config.customFilename,
        report_title: config.customFilename || config.template,
        analyst_id: analystId,
        include_watermark: config.includeWatermark,
        language: config.language || 'fr'
    }, {
        responseType: 'blob',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data; // Blob
};

export interface ResearcherReportConfig {
    sections: string[];
    format: string;
    language?: string;
    filters?: {
        dataset_id?: string;
        region?: string;
        year_range?: number[];
        start_year?: number;
        end_year?: number;
    };
}

export const generateResearcherReport = async (config: ResearcherReportConfig) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/researcher/generate-report', {
        sections: config.sections,
        format: config.format,
        language: config.language || 'fr',
        filters: config.filters || {
            dataset_id: "35949ad2-8b2e-5123-bd6a-2dd65a98a9d3",
            region: "Tchad",
            year_range: [2009, 2050]
        }
    }, {
        responseType: 'blob',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data; // Blob
};


export interface AnalystReportConfig extends ReportConfig {
    dataset_id?: string;
    regions?: string[];
}


export const generateAnalystReport = async (config: AnalystReportConfig) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/analyst/reports/generate', {
        type: config.template,
        template: config.template,
        sections: config.sections,
        region: config.region,
        regions: config.regions, // Added
        format: config.format,
        dataset_id: config.dataset_id,
        custom_filename: config.customFilename,
        include_watermark: config.includeWatermark,
        language: config.language || 'fr'
    }, {
        responseType: 'blob',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data; // Blob
};

export const exportFilteredData = async (
    format: string, 
    datasetId?: string, 
    region?: string, 
    columns?: string[], 
    customFilename?: string,
    regions?: string[],
    startYear?: number,
    endYear?: number
) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/admin/export', {
        table_name: 'cleaned_data',
        format,
        dataset_id: datasetId,
        region: region === 'National' ? undefined : region,
        regions: regions, // Added
        start_year: startYear, // Added
        end_year: endYear, // Added
        columns,
        custom_filename: customFilename
    }, {
        responseType: 'blob',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data; // Blob
};

export const downloadReport = async (filename: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/reports/download/${filename}`, {
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
    const response = await api.get(`/v1/admin/tables/${tableName}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const updateTableSettings = async (tableName: string, isLocked: boolean) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.put(`/v1/admin/tables/${tableName}/settings`,
        { is_locked: isLocked },
        { headers: { 'Authorization': `Bearer ${token}` } }
    );
    return response.data;
};

// Row Deletion
export const deleteTableRow = async (tableName: string, rowId: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/v1/admin/tables/${tableName}/row/${rowId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// 2FA TOTP
export const setup2FA = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/auth/2fa/setup', null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const verify2FALogin = async (code: string) => {
    const token = sessionStorage.getItem('preAuthToken') || sessionStorage.getItem('authToken');
    const response = await api.post('/v1/auth/2fa/login', { code }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const verify2FASetup = async (code: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/auth/2fa/verify', { code }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const disable2FA = async (code: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/auth/2fa/disable', { code }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// Password Change
export const changePassword = async (currentPassword: string, newPassword: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/auth/change-password', {
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
    const response = await api.get('/v1/reports/history', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getMyReportHistory = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/reports/my-history', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// Activity Stream
export const getActivityStream = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/admin/system/activity', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// User Activity & Personal Productivity Tracking
export const getActivityStats = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/activity/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getActivityTimeline = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/activity/timeline', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// Generate Report with filters (and optional scheduling)
// Admin reports: explicitly pass sections: [] to bypass demographic/predictive analysis
export const generateFilteredReport = async (
    reportType: string,
    auditType?: string,
    dateRange?: string,
    userRole?: string,
) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/admin/reports/generate', {
        params: {
            report_type: reportType,
            audit_type: auditType || 'all',
            date_range: dateRange || 'all_time',
            role: userRole || 'all_roles',
        },
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob',
    });
    return response;
};

// Preview report inline in a new browser tab (blob URL → revoke after open)
export const previewReport = async (filename: string): Promise<void> => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/reports/preview/${encodeURIComponent(filename)}`, {
        responseType: 'blob',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const win = window.open(blobUrl, '_blank');
    // Revoke the object URL after the browser has had time to start loading it
    if (win) {
        win.addEventListener('load', () => URL.revokeObjectURL(blobUrl), { once: true });
        // Safety net: also revoke after 60 s regardless
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } else {
        // Pop-up blocked — clean up immediately
        URL.revokeObjectURL(blobUrl);
    }
};

export const getRegions = async (): Promise<string[]> => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/data/regions', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// --- NOTIFICATIONS & SCHEDULER ---
export const getNotifications = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/notifications/', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const markNotificationRead = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.put(`/v1/notifications/${id}/read`, null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const deleteNotification = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/v1/notifications/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const scheduleExport = async (scheduled_time: string, details: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/schedule-export', { scheduled_time, details }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getScheduledExports = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/schedule-export/', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const updateScheduledExport = async (id: number, scheduled_time: string, details: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.put(`/v1/schedule-export/${id}`, { scheduled_time, details }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const deleteScheduledExport = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/v1/schedule-export/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const downloadScheduledExport = async (notificationId: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/schedule-export/download/${notificationId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
    });
    return response.data;
};

// --- SUPPORT & COMMAND CENTER ---
export const getUrgentTickets = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/support/urgent', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const resolveTicket = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.patch(`/v1/support/${id}/resolve`, null, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const deleteTicket = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/v1/support/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const createSupportTicket = async (data: { subject: string, message: string, is_urgent: boolean }) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/support/', data, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// --- NEW SPATIAL ENDPOINTS ---
export const getSpatialMeta = async () => {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await api.get('/v1/spatial/meta', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] getSpatialMeta error:', error);
        throw error;
    }
};

export const getSpatialTimeseries = async (region: string) => {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await api.get(`/v1/spatial/timeseries/${encodeURIComponent(region)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] getSpatialTimeseries error:', error);
        throw error;
    }
};

export const getIndicatorMeta = async (): Promise<string[]> => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/spatial/meta/indicators', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getAnalyticsTimeseries = async (params: { 
    indicator?: string; 
    region: string; 
    start_year: number; 
    end_year: number; 
    gender?: string;
    dataset_id?: string;
    age_group?: string;
}) => {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await api.get('/v1/spatial/analytics/timeseries', {
            params,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] getAnalyticsTimeseries error:', error);
        throw error;
    }
};

export const exportCleanedData = async (params: { format: string, region?: string, indicator?: string, year?: number, category?: string, dataset_id?: string }) => {
    const token = sessionStorage.getItem('authToken');
    const formData = new FormData();
    formData.append('format', params.format);
    if (params.region) formData.append('region', params.region);
    if (params.indicator) formData.append('indicator', params.indicator);
    if (params.year) formData.append('year', params.year.toString());
    if (params.category) formData.append('category', params.category);
    if (params.dataset_id) formData.append('dataset_id', params.dataset_id);

    const response = await api.post('/v1/data/export-cleaned', formData, {
        responseType: 'blob',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data; // Blob
};

export const getCleanedPreview = async (params: { 
    region?: string, 
    regions?: string[],
    start_year?: number,
    end_year?: number,
    indicator?: string, 
    year?: number, 
    category?: string, 
    dataset_id?: string 
}) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/data/preview-cleaned', {
        params,
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const recordActivityEvent = async (activityType: string, details?: any) => {
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await api.post('/v1/activity/event', {
            activity_type: activityType,
            details: details || {}
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('[API] recordActivityEvent error:', error);
        return null;
    }
};

// --- ADMIN TABLE DOWNLOAD (raw JSON/SQL dump) ---
export const downloadTableDump = async (tableName: string): Promise<Blob> => {
    const token = sessionStorage.getItem('authToken');
    try {
        // Try dedicated download endpoint first
        const response = await api.get(`/v1/admin/tables/${tableName}/download`, {
            responseType: 'blob',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch {
        // Fallback: fetch preview data and convert to JSON blob
        const previewRes = await api.get(`/v1/admin/tables/${tableName}/preview`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const jsonStr = JSON.stringify(previewRes.data, null, 2);
        return new Blob([jsonStr], { type: 'application/json' });
    }
};

// --- EXPORT ACTIVITY STREAM AS CSV (client-side) ---
export const exportActivityStreamCSV = (activities: any[]): Blob => {
    const headers = ['id', 'analyst_name', 'role', 'file_name', 'action_type', 'status', 'progress', 'timestamp'];
    const rows = activities.map(a =>
        headers.map(h => {
            const val = a[h] ?? '';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\r\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
};

// ─── Indicator Discovery ────────────────────────────────────────────────────
/**
 * Returns all distinct indicator names with cleaned records in the DB.
 * Used by the Researcher dashboard to confirm data availability
 * and populate dropdowns dynamically.
 */
export interface AvailableIndicator {
    name: string;
    record_count: number;
    regions: string[];
    years: number[];
}

export const getAvailableIndicators = async (): Promise<{
    status: string;
    message?: string;
    total_indicators?: number;
    indicators: AvailableIndicator[];
}> => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/data/indicators', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

// --- NEW RESEARCHER TASK ENGINE & EXPORT ---
export const scheduleResearcherExport = async (format: string, datasetId: string, customFilename?: string, targetDate?: string) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.post('/v1/researcher/export/schedule', {
        format,
        dataset_id: datasetId,
        custom_filename: customFilename || undefined,
        target_date: targetDate || undefined
    }, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getResearcherPendingTasks = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/researcher/pending-tasks', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getResearcherAvailableYears = async (): Promise<number[]> => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/researcher/available-years', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return Array.isArray(response.data) ? response.data : (response.data?.years ?? []);
};

export const deleteResearcherTask = async (id: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.delete(`/v1/researcher/tasks/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const downloadResearcherTask = async (taskId: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get(`/v1/researcher/tasks/${taskId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'blob'
    });
    return {
        blob: response.data,
        contentType: response.headers['content-type'] || response.data?.type || 'application/octet-stream',
        filename: parseContentDispositionFilename(response.headers['content-disposition'])
    };
};

const parseContentDispositionFilename = (contentDisposition?: string): string | undefined => {
    if (!contentDisposition) return undefined;
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/"/g, ''));
    const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    return asciiMatch?.[1];
};

export const getResearcherActivity = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/researcher/activity', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getResearcherExportStats = async () => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/researcher/export/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
};

export const getAnalystPyramid = async (region: string, year: number) => {
    const token = sessionStorage.getItem('authToken');
    const response = await api.get('/v1/analyst/pyramid', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { region, year }
    });
    return response.data;
};

export default api;

