import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './use-toast';

export const useSessionTimeout = (timeoutInMinutes: number = 15) => {
    const navigate = useNavigate();
    const { toast } = useToast();

    const logout = useCallback(() => {
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('userRole');
        sessionStorage.removeItem('userEmail');

        toast({
            title: "Session Expired",
            description: "You have been logged out due to inactivity.",
            variant: "destructive"
        });

        navigate('/login');
    }, [navigate, toast]);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(logout, timeoutInMinutes * 60 * 1000);
        };

        // Events that reset the timer
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

        events.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        resetTimer();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [logout, timeoutInMinutes]);
};
