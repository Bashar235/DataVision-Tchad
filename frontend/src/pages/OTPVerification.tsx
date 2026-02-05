import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { verifyOtp, generateOtp } from "@/services/api";

const OTPVerification = () => {
    const { t, isRtl } = useLanguage();
    const { toast } = useToast();
    const { refreshUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email;

    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(30);
    const [canResend, setCanResend] = useState(false);

    useEffect(() => {
        if (!email) {
            navigate("/login");
            return;
        }

        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setCanResend(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [email, navigate]);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length !== 6) return;

        setLoading(true);
        try {
            const res = await verifyOtp(email, otp);
            sessionStorage.setItem("authToken", res.token);

            const dbRole = res.user?.role || location.state?.role || "analyst";
            sessionStorage.setItem("userRole", dbRole);

            // Refresh global auth state immediately
            await refreshUser();

            const rolePathMap: Record<string, string> = {
                "administrator": "admin",
                "analyst": "analyst",
                "researcher": "researcher"
            };
            const targetPath = rolePathMap[dbRole.toLowerCase()] || dbRole.toLowerCase();

            toast({
                title: t('success'),
                description: t('login_signin_success'),
            });

            navigate(`/${targetPath}`);
        } catch (error) {
            toast({
                variant: "destructive",
                title: t('error'),
                description: t('login_invalid_credentials'),
            });
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setCanResend(false);
        setTimer(30);
        try {
            await generateOtp(email);
            toast({
                title: t('otp_sent'),
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: t('error'),
                description: t('upload_error_desc'),
            });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={isRtl ? "rtl" : "ltr"}>
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-primary/10 rounded-full overflow-hidden">
                            <img src="/logo.ico" alt="Logo" className="w-8 h-8 object-contain" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl text-center">{t('verification_code')}</CardTitle>
                    <CardDescription className="text-center">
                        {isRtl ? "تم إرسال رمز إلى" : "Un code a été envoyé à"}
                        <br />
                        <span className="font-medium text-foreground">{email}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleVerify} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="text"
                                placeholder="000000"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                                required
                                autoFocus
                            />
                        </div>
                        <Button type="submit" className="w-full h-11" disabled={loading || otp.length !== 6}>
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {t('login_signin')}
                        </Button>
                        <div className="text-center pt-2">
                            {canResend ? (
                                <Button
                                    variant="link"
                                    type="button"
                                    onClick={handleResend}
                                    className="text-primary font-medium"
                                >
                                    {t('resend_code')}
                                </Button>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {t('verification_desc')} <span className="font-mono text-primary font-medium">{timer}s</span>
                                </p>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            onClick={() => navigate("/login")}
                        >
                            <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                            {t('nav_login')}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default OTPVerification;
