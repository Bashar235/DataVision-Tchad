/**
 * Routing Helper Utility
 * Provides dynamic path resolution based on user role to prevent hardcoded navigation
 */

export const getDashboardBase = (): string => {
    const userRole = sessionStorage.getItem('userRole');

    switch (userRole) {
        case 'admin':
        case 'administrator':
            return '/admin';
        case 'analyst':
            return '/analyst';
        case 'researcher':
            return '/researcher';
        default:
            return '/';
    }
};

export const getDashboardPath = (page?: string): string => {
    const base = getDashboardBase();
    return page ? `${base}/${page}` : `${base}/dashboard`;
};

export const navigateToDashboard = (page?: string) => {
    window.location.href = getDashboardPath(page);
};

export const isAuthenticated = (): boolean => {
    return !!sessionStorage.getItem('authToken');
};

export const getUserRole = (): string | null => {
    return sessionStorage.getItem('userRole');
};

export const clearSession = () => {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('userEmail');
};
