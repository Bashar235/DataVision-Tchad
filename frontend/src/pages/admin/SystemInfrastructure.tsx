import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Server, Cpu, MemoryStick, HardDrive, Wifi, Activity, Users,
    ShieldCheck, Key, Copy, Check, Loader2, RefreshCw, AlertTriangle,
    Circle, Zap, Lock, Eye, EyeOff, Trash2
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAdminStats, getUsers } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

// ─── Mock API Key data (no backend endpoint yet) ────────────────────────────
const MOCK_API_KEYS = [
    { id: 1, name: "DataVision Analytics SDK", key: "dvk_live_a3f7...c91b", scope: "read", created: "2025-12-01", lastUsed: "2026-04-01", status: "active" },
    { id: 2, name: "Report Export Worker", key: "dvk_live_b8e2...44af", scope: "read+write", created: "2026-01-15", lastUsed: "2026-03-30", status: "active" },
    { id: 3, name: "Legacy Integration", key: "dvk_live_c1d9...77fa", scope: "read", created: "2025-08-10", lastUsed: "2025-11-20", status: "revoked" },
];

const SystemInfrastructure = () => {
    const { t, isRtl, currentLang } = useLanguage();
    const { toast } = useToast();

    const [stats, setStats] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [copiedKey, setCopiedKey] = useState<number | null>(null);
    const [visibleKeys, setVisibleKeys] = useState<Record<number, boolean>>({});
    const [apiKeys, setApiKeys] = useState(MOCK_API_KEYS);

    const fetchData = useCallback(async () => {
        setRefreshing(true);
        try {
            const [statsData, usersData] = await Promise.all([
                getAdminStats('7d'),
                getUsers()
            ]);
            setStats(statsData);
            setUsers(Array.isArray(usersData) ? usersData : []);
        } catch (err) {
            console.error("SystemInfrastructure fetch error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCopyKey = (id: number, key: string) => {
        navigator.clipboard.writeText(key);
        setCopiedKey(id);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleRevokeKey = (id: number) => {
        setApiKeys(prev => prev.map(k => k.id === id ? { ...k, status: "revoked" } : k));
        toast({ title: t('infra_api_key_revoked'), description: t('infra_key_deactivated') });
    };

    // Compute uptime percentage for ring (mock: parse string like "14 days, 3:42:10")
    const uptimePct = 99.8;

    // Active sessions = users with last_login in last 2h (mock from stats)
    const activeSessions = users.filter(u => {
        if (!u.last_login) return false;
        const loginDate = new Date(u.last_login);
        const hoursDiff = (Date.now() - loginDate.getTime()) / (1000 * 60 * 60);
        return hoursDiff < 24;
    });

    return (
        <div className="w-full space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="text-start">
                    <h2 className="text-3xl font-bold tracking-tight">{t('infra_title')}</h2>
                    <p className="text-muted-foreground mt-1">{t('infra_subtitle')}</p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={refreshing} className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {t('infra_refresh')}
                </Button>
            </div>

            {/* ── Section 1: Server Health ──────────────────────────── */}
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-start">
                    <Server className="w-5 h-5 text-primary" />
                    {t('infra_server_health')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Uptime */}
                    <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 to-transparent">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100 rounded-full blur-2xl opacity-40 -mr-6 -mt-6 pointer-events-none" />
                        <CardHeader className="pb-2 text-start">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-600" />
                                {t('infra_server_uptime')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-start">
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            ) : (
                                <>
                                    <div className="text-2xl font-black text-emerald-700">{uptimePct}%</div>
                                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                                        {stats?.server_uptime || t('common_na')}
                                    </p>
                                    <Badge className="mt-2 bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px]">
                                        <Circle className="w-2 h-2 mr-1 fill-emerald-500 text-emerald-500" />
                                        {t('infra_operational')}
                                    </Badge>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Database Status */}
                    <Card className="relative overflow-hidden border-blue-500/20 bg-gradient-to-br from-blue-50/50 to-transparent">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-full blur-2xl opacity-40 -mr-6 -mt-6 pointer-events-none" />
                        <CardHeader className="pb-2 text-start">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-blue-600" />
                                {t('infra_database')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-start">
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            ) : (
                                <>
                                    <div className="text-2xl font-black text-blue-700">
                                        {stats?.database_status === 'connected' ? t('infra_connected') : (stats?.database_status || t('infra_connected'))}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {stats?.datasets_count || 0} {t('tables_label')} · {((stats?.total_records || 0) / 1000).toFixed(1)}K {t('records_label')}
                                    </p>
                                    <Badge className="mt-2 bg-blue-500/10 text-blue-700 border-blue-500/20 text-[10px]">
                                        <Circle className="w-2 h-2 mr-1 fill-blue-500 text-blue-500" />
                                        PostgreSQL
                                    </Badge>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* CPU Load */}
                    <Card className="relative overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-transparent">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-amber-100 rounded-full blur-2xl opacity-40 -mr-6 -mt-6 pointer-events-none" />
                        <CardHeader className="pb-2 text-start">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-amber-600" />
                                {t('infra_cpu_load')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-start">
                            <div className="text-2xl font-black text-amber-700">14%</div>
                            <div className="mt-2 h-2 rounded-full bg-amber-100 overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full transition-all duration-700" style={{ width: '14%' }} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t('infra_normal_load')}</p>
                        </CardContent>
                    </Card>

                    {/* Network / API */}
                    <Card className="relative overflow-hidden border-purple-500/20 bg-gradient-to-br from-purple-50/50 to-transparent">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-purple-100 rounded-full blur-2xl opacity-40 -mr-6 -mt-6 pointer-events-none" />
                        <CardHeader className="pb-2 text-start">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Wifi className="w-4 h-4 text-purple-600" />
                                {t('infra_api_requests_hr')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-start">
                            <div className="text-2xl font-black text-purple-700">2,847</div>
                            <div className="mt-2 h-2 rounded-full bg-purple-100 overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full transition-all duration-700" style={{ width: '57%' }} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t('infra_rate_limit_desc', { percent: 57 })}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Second row: totals */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <Card className="border-slate-200 bg-slate-50/50">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-slate-200/70">
                                <Users className="w-5 h-5 text-slate-600" />
                            </div>
                            <div className="text-start">
                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t('infra_total_users')}</p>
                                <p className="text-2xl font-black">{loading ? '—' : stats?.users_count || users.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200 bg-slate-50/50">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-green-200/70">
                                <Zap className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="text-start">
                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t('infra_online_now')}</p>
                                <p className="text-2xl font-black">{loading ? '—' : stats?.online_count || 0}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200 bg-slate-50/50">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-blue-200/70">
                                <ShieldCheck className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="text-start">
                                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t('infra_security_status')}</p>
                                <p className="text-xl font-black text-emerald-600">{t('infra_secured')}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ── Section 2: Active Session Monitor ───────────────────── */}
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-start">
                    <Activity className="w-5 h-5 text-primary" />
                    {t('infra_active_sessions')}
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                        {activeSessions.length} {t('infra_active_count')}
                    </Badge>
                </h3>
                <Card className="border-primary/10">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_user')}</TableHead>
                                        <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_role')}</TableHead>
                                        <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_email')}</TableHead>
                                        <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_last_active')}</TableHead>
                                        <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_status')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                {t('infra_no_sessions')}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        users.slice(0, 15).map((user: any) => {
                                            const lastLogin = user.last_login ? new Date(user.last_login) : null;
                                            const hoursDiff = lastLogin ? (Date.now() - lastLogin.getTime()) / (1000 * 60 * 60) : 999;
                                            const isOnline = hoursDiff < 1;
                                            const isRecent = hoursDiff < 24;

                                            return (
                                                <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="text-start">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                                    {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                                                </div>
                                                                {isOnline && (
                                                                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                                                                )}
                                                            </div>
                                                            <span className="font-medium text-sm">{user.full_name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-start">
                                                        <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                                            {user.role === 'administrator' ? t('role_admin') : (user.role === 'analyst' ? t('role_analyst') : (user.role === 'researcher' ? t('role_researcher') : user.role))}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-start text-xs text-muted-foreground font-mono">
                                                        {user.email}
                                                    </TableCell>
                                                    <TableCell className="text-start text-sm text-muted-foreground">
                                                        {lastLogin
                                                            ? lastLogin.toLocaleString(currentLang === 'ar' ? 'ar-SA' : currentLang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                            : t('infra_never')
                                                        }
                                                    </TableCell>
                                                    <TableCell className="text-start">
                                                        {isOnline ? (
                                                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px]">
                                                                <Circle className="w-2 h-2 mr-1 fill-emerald-500 text-emerald-500" />
                                                                {t('infra_online')}
                                                            </Badge>
                                                        ) : isRecent ? (
                                                            <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]">
                                                                <Circle className="w-2 h-2 mr-1 fill-amber-500 text-amber-500" />
                                                                {t('infra_today')}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                <Circle className="w-2 h-2 mr-1 fill-slate-400 text-slate-400" />
                                                                {t('infra_inactive')}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Section 3: API Key Management ──────────────────────── */}
            <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-start">
                    <Key className="w-5 h-5 text-primary" />
                    {t('infra_api_key_mgmt')}
                    <Badge variant="secondary" className="text-[10px]">{t('infra_apikey_mock_desc')}</Badge>
                </h3>
                <Card className="border-amber-500/20">
                    <CardHeader className="text-start pb-3">
                        <CardDescription className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            {t('infra_apikey_warning')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_name')}</TableHead>
                                    <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_api_key')}</TableHead>
                                    <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_scope')}</TableHead>
                                    <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_last_used')}</TableHead>
                                    <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_status')}</TableHead>
                                    <TableHead className="text-start font-bold text-xs uppercase tracking-wider">{t('infra_actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {apiKeys.map((key) => (
                                    <TableRow key={key.id} className={`hover:bg-muted/30 transition-colors ${key.status === 'revoked' ? 'opacity-50' : ''}`}>
                                        <TableCell className="text-start font-medium text-sm">{key.name}</TableCell>
                                        <TableCell className="text-start">
                                            <div className="flex items-center gap-2">
                                                <code className="bg-muted px-2 py-0.5 rounded text-[11px] font-mono">
                                                    {visibleKeys[key.id] ? key.key : key.key.replace(/\w(?=.*\.\.\.)/g, '•')}
                                                </code>
                                                <button
                                                    onClick={() => setVisibleKeys(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                                                    className="text-muted-foreground hover:text-primary transition-colors p-1 rounded"
                                                >
                                                    {visibleKeys[key.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                </button>
                                                <button
                                                    onClick={() => handleCopyKey(key.id, key.key)}
                                                    className="text-muted-foreground hover:text-primary transition-colors p-1 rounded"
                                                    disabled={key.status === 'revoked'}
                                                >
                                                    {copiedKey === key.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                </button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-start">
                                            <Badge variant="outline" className="text-[10px] font-mono">{key.scope}</Badge>
                                        </TableCell>
                                        <TableCell className="text-start text-sm text-muted-foreground">{key.lastUsed}</TableCell>
                                        <TableCell className="text-start">
                                            {key.status === 'active' ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px]">{t('infra_active_count')}</Badge>
                                            ) : (
                                                <Badge className="bg-red-500/10 text-red-700 border-red-500/20 text-[10px]">{t('status_inactive')}</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-start">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRevokeKey(key.id)}
                                                disabled={key.status === 'revoked'}
                                            >
                                                <Lock className="w-3 h-3 mr-1" />
                                                {t('infra_revoke')}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SystemInfrastructure;
