import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '@/services/api';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
    const location = useLocation();
    const [isValidating, setIsValidating] = useState(true);
    const [isValid, setIsValid] = useState(false);

    useEffect(() => {
        validateSession();
    }, []);

    const validateSession = async () => {
        const token = sessionStorage.getItem('authToken');
        const userRole = sessionStorage.getItem('userRole');

        // No token = redirect to login
        if (!token) {
            setIsValidating(false);
            setIsValid(false);
            return;
        }

        // Validate token with backend
        try {
            // Make a lightweight request to verify token validity
            await api.get('/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // Token is valid, check role
            if (!userRole || !allowedRoles.includes(userRole)) {
                // Role mismatch - redirect to correct dashboard
                setIsValidating(false);
                setIsValid(false);
                return;
            }

            // All checks passed
            setIsValid(true);
            setIsValidating(false);
        } catch (error: any) {
            // Token invalid or expired (401)
            if (error.response?.status === 401) {
                // Clear session and force logout
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('userRole');
                sessionStorage.removeItem('userEmail');
                setIsValid(false);
            }
            setIsValidating(false);
        }
    };

    // Show loading state while validating
    if (isValidating) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // No token - redirect to login
    const token = sessionStorage.getItem('authToken');
    if (!token || !isValid) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check role
    const userRole = sessionStorage.getItem('userRole');
    if (!userRole || !allowedRoles.includes(userRole)) {
        // Redirection logic with toast
        if (userRole === 'analyst' && location.pathname.startsWith('/admin')) {
            // We can't use useToast here easily if it's not a component rendered in the tree with Toaster available,
            // but ProtectedRoute is usually inside the tree.
            // Actually, I should probably use a redirect and handle toast in the target dashboard or use a global toast function.
            // But the instructions say: "trigger a 'Forbidden Access' toast notification".
        }

        const redirectPath = userRole === 'administrator' || userRole === 'admin'
            ? '/admin/dashboard'
            : userRole === 'analyst'
                ? '/analyst/dashboard'
                : '/researcher/dashboard';

        return <Navigate to={redirectPath} state={{ forbidden: true }} replace />;
    }

    // All checks passed - render protected content
    return <>{children}</>;
};

export default ProtectedRoute;
