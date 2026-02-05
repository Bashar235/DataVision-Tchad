import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, Search, ShieldAlert, UserCog, MoreHorizontal, Loader2, RefreshCw, Trash2, Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { getUsers, createUser, updateUser, updateUserRole, toggleUserStatus, deleteUser } from "@/services/api";
import LanguageSwitcher from "@/components/dashboard/LanguageSwitcher";
import { useNavigate } from "react-router-dom";

const UserManagement = () => {
    const { t, isRtl } = useLanguage();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newUser, setNewUser] = useState({ full_name: "", email: "", password: "", role: "analyst" });
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [editForm, setEditForm] = useState({ full_name: "", email: "", role: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            toast({ variant: "destructive", title: t('common_error'), description: t('user_fetch_failed') });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async () => {
        if (!newUser.full_name || !newUser.email || !newUser.password) {
            toast({ variant: "destructive", title: t('common_error'), description: t('all_fields_mandatory') });
            return;
        }
        setLoading(true);
        try {
            await createUser(newUser);
            toast({ title: t('common_success'), description: t('user_created_credentials_sent') });
            setIsCreateOpen(false);
            fetchUsers();
        } catch (error) {
            toast({ variant: "destructive", title: t('common_error'), description: t('user_create_failed') });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (userId: number) => {
        setActionLoading(userId);
        try {
            await toggleUserStatus(userId);
            toast({ title: t('common_success'), description: t('user_status_updated') });
            fetchUsers();
        } catch (error) {
            toast({ variant: "destructive", title: t('common_error'), description: t('user_update_status_failed') });
        } finally {
            setActionLoading(null);
        }
    };

    const handleRoleChange = async (userId: number, role: string) => {
        setActionLoading(userId);
        try {
            await updateUserRole(userId, role);
            toast({ title: t('common_success'), description: t('role_updated_success') });
            fetchUsers();
        } catch (error) {
            toast({ variant: "destructive", title: t('common_error'), description: t('role_update_failed') });
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm(t('confirm_delete_user'))) return;
        setActionLoading(userId);
        try {
            await deleteUser(userId);
            toast({ title: t('common_success'), description: t('user_permanently_removed') });
            fetchUsers();
        } catch (error) {
            toast({ variant: "destructive", title: t('common_error'), description: t('user_delete_failed') });
        } finally {
            setActionLoading(null);
        }
    };

    const handleRowDoubleClick = (user: any) => {
        setSelectedUser(user);
        setEditForm({
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            password: "" // Leave empty - only update if user enters a new password
        });
        setIsEditOpen(true);
    };

    const handleUpdateUser = async () => {
        if (!editForm.full_name || !editForm.email) {
            toast({ variant: "destructive", title: t('common_error'), description: t('all_fields_mandatory') });
            return;
        }
        setLoading(true);
        try {
            const updateData: any = {
                full_name: editForm.full_name,
                email: editForm.email,
                role: editForm.role
            };
            // Only include password if user entered one
            if (editForm.password) {
                updateData.password = editForm.password;
            }
            await updateUser(selectedUser.id, updateData);
            toast({ title: t('common_success'), description: t('success_user_updated') });
            setIsEditOpen(false);
            setShowPassword(false); // Reset password visibility
            fetchUsers();
        } catch (error: any) {
            // Handle specific 409 Conflict for email already in use
            if (error.response?.status === 409) {
                toast({
                    variant: "destructive",
                    title: t('common_error'),
                    description: t('error_email_exists')
                });
            } else {
                const errorMsg = error.response?.data?.detail || t('user_update_status_failed');
                toast({ variant: "destructive", title: t('common_error'), description: errorMsg });
            }
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/admin")}>
                        <div className="p-2 bg-primary/10 rounded-lg overflow-hidden">
                            <img src="/logo.ico" alt="Logo" className="w-6 h-6 object-contain" />
                        </div>
                        <div className="text-start">
                            <h1 className="text-xl font-bold">{t('nav_brand')}</h1>
                            <p className="text-sm text-muted-foreground">{t('user_control_center')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                            {t('nav_home')}
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="text-start">
                        <h2 className="text-3xl font-bold tracking-tight">{t('user_control_center')}</h2>
                        <p className="text-muted-foreground">{t('manage_access_desc')}</p>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <UserPlus className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                                {t('create_user')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader className="text-start">
                                <DialogTitle>{t('users_create_user')}</DialogTitle>
                                <DialogDescription>
                                    {t('enter_user_details')}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4 text-start">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className={isRtl ? "text-left" : "text-right"}>{t('label_name')}</Label>
                                    <Input id="name" className="col-span-3" value={newUser.full_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUser({ ...newUser, full_name: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="email" className={isRtl ? "text-left" : "text-right"}>{t('label_email')}</Label>
                                    <Input id="email" type="email" className="col-span-3" placeholder={t('label_email_placeholder')} value={newUser.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUser({ ...newUser, email: e.target.value })} required />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="password" className={isRtl ? "text-left" : "text-right"}>{t('label_password')}</Label>
                                    <Input id="password" type="password" className="col-span-3" value={newUser.password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUser({ ...newUser, password: e.target.value })} required />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="role" className={isRtl ? "text-left" : "text-right"}>{t('label_role')}</Label>
                                    <Select value={newUser.role} onValueChange={(val: string) => setNewUser({ ...newUser, role: val })}>
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="administrator">{t('role_admin')}</SelectItem>
                                            <SelectItem value="analyst">{t('role_analyst')}</SelectItem>
                                            <SelectItem value="researcher">{t('role_researcher')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter className="text-start">
                                <Button onClick={handleCreateUser} disabled={loading}>
                                    {loading && <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} />}
                                    {t('create_user')}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardHeader className="text-start">
                        <div className="flex items-center justify-between">
                            <div className="relative w-full max-w-sm">
                                <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                                <Input
                                    placeholder={t('search_users_placeholder')}
                                    className={isRtl ? "pr-10" : "pl-10"}
                                    value={searchTerm}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-start">{t('table_user')}</TableHead>
                                        <TableHead className="text-start">{t('table_email')}</TableHead>
                                        <TableHead className="text-start">{t('table_role')}</TableHead>
                                        <TableHead className="text-start">{t('table_status')}</TableHead>
                                        <TableHead className="text-start">{t('table_last_login')}</TableHead>
                                        <TableHead className="text-end">{t('table_actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => (
                                        <TableRow
                                            key={user.id}
                                            onDoubleClick={() => handleRowDoubleClick(user)}
                                            className="hover:bg-muted/50 cursor-pointer transition-colors"
                                        >
                                            <TableCell className="text-start">
                                                <span className="font-medium text-sm">{user.full_name}</span>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground text-start">{user.email}</TableCell>
                                            <TableCell className="text-start">
                                                <Select
                                                    defaultValue={user.role}
                                                    onValueChange={(val: string) => handleRoleChange(user.id, val)}
                                                    disabled={actionLoading === user.id}
                                                >
                                                    <SelectTrigger className="w-[130px] h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="administrator">{t('role_admin')}</SelectItem>
                                                        <SelectItem value="analyst">{t('role_analyst')}</SelectItem>
                                                        <SelectItem value="researcher">{t('role_researcher')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell className="text-start">
                                                <Badge variant={user.is_active ? "secondary" : "destructive"} className="gap-1">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? "bg-green-500" : "bg-red-500"}`} />
                                                    {user.is_active ? t('status_active') : t('status_inactive')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground text-start">
                                                {user.last_login}
                                            </TableCell>
                                            <TableCell className="text-end">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleToggleStatus(user.id)}
                                                        disabled={actionLoading === user.id}
                                                        title={user.is_active ? t('block_user') : t('user_unblock')}
                                                    >
                                                        <ShieldAlert className={`h-4 w-4 ${user.is_active ? "text-destructive" : "text-green-600"}`} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive"
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        disabled={actionLoading === user.id}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Edit User Dialog */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent className="sm:max-w-[500px] bg-white border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl">
                        <DialogHeader className="text-start">
                            <DialogTitle className="text-slate-950 text-2xl font-bold">{t('users_edit_user')}</DialogTitle>
                            <DialogDescription className="text-slate-700 leading-relaxed">
                                {t('users_edit_user_desc')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-5 py-4 text-start">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-name" className={`${isRtl ? "text-left" : "text-right"} text-slate-950 font-semibold`}>{t('label_name')}</Label>
                                <Input
                                    id="edit-name"
                                    className="col-span-3 h-11 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/10"
                                    value={editForm.full_name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, full_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-email" className={`${isRtl ? "text-left" : "text-right"} text-slate-950 font-semibold`}>{t('label_email')}</Label>
                                <Input
                                    id="edit-email"
                                    type="email"
                                    className="col-span-3 h-11 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/10"
                                    value={editForm.email}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-role" className={`${isRtl ? "text-left" : "text-right"} text-slate-950 font-semibold`}>{t('label_role')}</Label>
                                <Select value={editForm.role} onValueChange={(val: string) => setEditForm({ ...editForm, role: val })}>
                                    <SelectTrigger className="col-span-3 h-11 rounded-xl border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="administrator">{t('role_admin')}</SelectItem>
                                        <SelectItem value="analyst">{t('role_analyst')}</SelectItem>
                                        <SelectItem value="researcher">{t('role_researcher')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-password" className={`${isRtl ? "text-left" : "text-right"} text-slate-950 font-semibold`}>{t('users_new_password')}</Label>
                                <div className="col-span-3 space-y-2">
                                    <div className="relative">
                                        <Input
                                            id="edit-password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder={t('users_leave_blank_password')}
                                            className="h-11 rounded-xl border-slate-200 focus:border-primary focus:ring-primary/10 pr-10"
                                            value={editForm.password}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, password: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-600 italic flex items-center gap-1">
                                        <span className="inline-block w-1 h-1 rounded-full bg-slate-400"></span>
                                        {t('users_leave_blank_password_desc')}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="text-start gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setIsEditOpen(false)}
                                disabled={loading}
                                className="h-11 px-6 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                            >
                                {t('common_cancel')}
                            </Button>
                            <Button
                                onClick={handleUpdateUser}
                                disabled={loading}
                                className="h-11 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20"
                            >
                                {loading && <Loader2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'} animate-spin`} />}
                                {t('common_save')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
};

export default UserManagement;
