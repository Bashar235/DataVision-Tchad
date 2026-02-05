import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentUser } from '@/services/api';

interface User {
    id: number;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
    last_login: string | null;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    loading: boolean;
    setUser: (user: User | null) => void;
    refreshUser: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        try {
            const token = sessionStorage.getItem('authToken');
            if (!token) {
                setUser(null);
                setLoading(false);
                return;
            }

            const userData = await getCurrentUser();
            setUser(userData);
        } catch (error) {
            console.error('Failed to fetch user:', error);
            setUser(null);
            // Clear invalid token
            sessionStorage.removeItem('authToken');
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        sessionStorage.removeItem('authToken');
    };

    // Hydrate user on mount
    useEffect(() => {
        refreshUser();
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
