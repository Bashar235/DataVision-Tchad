import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, BarChart3, Shield, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { generateOtp, login } from "@/services/api";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t, currentLang } = useLanguage();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await login(email, password);
            const user = res.user;

            await generateOtp(user.email);

            toast({
                title: t('otp_sent'),
                description: t('verification_desc'),
            });

            navigate("/verify-otp", { state: { email: user.email, role: user.role } });
        } catch (error: any) {
            const errorMsg = error.response?.data?.detail || t('upload_error_desc');
            toast({
                variant: "destructive",
                title: t('error'),
                description: errorMsg,
            });
        } finally {
            setLoading(false);
        }
    };

    const isRTL = currentLang === 'ar';

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
                <div className="hidden lg:flex flex-col gap-8 text-foreground">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
                                <img src="/logo.ico" alt="INSEED Logo" className="h-8 w-8 object-contain" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold">{t('nav_brand')}</h1>
                                <p className="text-muted-foreground">{t('dashboard_inseed_platform')}</p>
                            </div>
                        </div>
                        <p className="text-lg text-muted-foreground">
                            {t('hero_subtitle')}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <TrendingUp className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">{t('predictive_analytics')}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {t('feature_3_desc')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border">
                            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                                <BarChart3 className="h-5 w-5 text-accent" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">{t('visualizations')}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {t('feature_1_desc')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                                <Shield className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">{t('accuracy')}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {t('security')} & {t('about_access')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors w-fit">
                        <ArrowLeft className="h-4 w-4" />
                        {t('back_to_home')}
                    </Link>
                    <Card className="shadow-lg">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl">{t('login_title')}</CardTitle>
                            <CardDescription>
                                {t('login_no_account')} {t('login_signup_link')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">{t('login_email')}</Label>
                                    <Input
                                        id="email"
                                        type="text"
                                        placeholder="admin, analyst, ou researcher"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">{t('login_password')}</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                                    {loading ? t('loading') : t('login_signin')}
                                </Button>

                                <div className="pt-4 border-t border-border">
                                    <p className="text-xs text-muted-foreground text-center">
                                        {t('footer_copyright')}
                                    </p>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Login;
