import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentUser, logoutUser } from '@/services/api';

interface User {
    id: number;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    is_2fa_enabled: boolean;
    created_at: string;
    last_login: string | null;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    setUser: (user: User | null) => void;
    refreshUser: () => Promise<User | null>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async (): Promise<User | null> => {
        try {
            const token = sessionStorage.getItem('authToken');
            if (!token) {
                setUser(null);
                setLoading(false);
                return null;
            }

            const userData = await getCurrentUser();
            console.log('[AuthContext] refreshUser payload:', userData);
            setUser(userData);
            return userData;
        } catch (error) {
            console.error('Failed to fetch user:', error);
            setUser(null);
            // Clear invalid token
            sessionStorage.removeItem('authToken');
            return null;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await logoutUser();
        } catch (error) {
            console.error('Logout API failed:', error);
        } finally {
            setUser(null);
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('userRole'); // Clear role as well
        }
    };

    // Hydrate user on mount
    useEffect(() => {
        refreshUser();

        // Best-effort logout on window close
        const handleBeforeUnload = () => {
            const token = sessionStorage.getItem('authToken');
            if (token) {
                // Use navigator.sendBeacon for a best-effort async request on close
                const API_URL = import.meta.env.VITE_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:8000';
                const blob = new Blob([], { type: 'application/json' });
                const url = `${API_URL}/api/v1/auth/logout`;
                // sendBeacon does not support setting Authorization header easily,
                // so we might need a fetch with keepalive: true instead.
                fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    keepalive: true
                }).catch(() => { });
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        loading,
        setUser,
        refreshUser,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
