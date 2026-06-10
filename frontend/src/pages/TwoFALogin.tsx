import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2, ArrowLeft, Fingerprint } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { verify2FALogin } from "@/services/api";

/**
 * TwoFALogin — Admin-only 2FA verification during the login flow.
 *
 * Navigation flow:
 *  Login → /verify-otp (email OTP) → /auth/2fa (TOTP, admins only) → /admin
 *
 * Required router state (passed via navigate):
 *   { email, role, token }
 */
const TwoFALogin = () => {
    const { t, isRtl } = useLanguage();
    const { toast } = useToast();
    const { refreshUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const email = location.state?.email as string | undefined;

    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);

    // If arrived without state, redirect to login
    if (!email) {
        navigate("/login");
        return null;
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) return;

        setLoading(true);
        try {
            const res = await verify2FALogin(code);
            
            // Set the final verified auth token
            sessionStorage.setItem("authToken", res.token);
            sessionStorage.removeItem("preAuthToken");

            // Refresh global auth state so dashboard picks up the user
            await refreshUser();

            toast({
                title: "2FA Verified",
                description: "Welcome to the Admin Dashboard.",
            });

            navigate("/admin");
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Verification Failed",
                description: error.response?.data?.detail || "Invalid or expired 2FA code. Please try again.",
            });
            setCode("");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4"
            dir={isRtl ? "rtl" : "ltr"}
        >
            {/* Subtle background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <Card className="border-primary/20 bg-slate-900/90 backdrop-blur-sm shadow-2xl shadow-black/40">
                    <CardHeader className="text-center space-y-4 pb-2">
                        {/* Icon */}
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                            <Fingerprint className="w-8 h-8 text-primary" />
                        </div>

                        <div>
                            <CardTitle className="text-2xl font-bold text-white">
                                Admin 2FA Verification
                            </CardTitle>
                            <CardDescription className="text-slate-400 mt-2">
                                Enter the 6-digit code from your authenticator app.
                                <br />
                                <span className="font-medium text-slate-300">{email}</span>
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                        <form onSubmit={handleVerify} className="space-y-5">
                            {/* TOTP Code Input */}
                            <div className="space-y-2">
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="000000"
                                    maxLength={6}
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                                    className="text-center text-3xl tracking-[0.6em] font-mono h-16 bg-slate-800/80 border-slate-700 text-white focus:border-primary/60 focus:ring-primary/20 placeholder:text-slate-600"
                                    autoFocus
                                    required
                                />
                                <p className="text-xs text-slate-500 text-center">
                                    Open your authenticator app (Google Authenticator, Authy, etc.)
                                </p>
                            </div>

                            {/* Verify Button */}
                            <Button
                                type="submit"
                                className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                disabled={loading || code.length !== 6}
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                ) : (
                                    <ShieldCheck className="w-5 h-5 mr-2" />
                                )}
                                {loading ? "Verifying..." : "Verify & Enter Dashboard"}
                            </Button>

                            {/* Security note */}
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400 flex items-start gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span>
                                    This is a mandatory security step for administrator accounts.
                                    All access attempts are logged in the Security Audit trail.
                                </span>
                            </div>

                            {/* Back link */}
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-slate-400 hover:text-white hover:bg-slate-800/50"
                                onClick={() => navigate("/login")}
                            >
                                <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                                Back to Login
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Footer */}
                <p className="text-center text-xs text-slate-600 mt-4">
                    DataVision Tchad · Admin Portal · Secured by TOTP
                </p>
            </div>
        </div>
    );
};

export default TwoFALogin;
