'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/RoleContext';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { getToken } from '@/lib/auth';

// ─── API Helpers ──────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const fetcher = async (url: string) => {
    const token = getToken();
    const res = await fetch(BASE_URL + url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('API Error');
    return res.json();
};

const apiCall = async (url: string, method: string, body?: any) => {
    const token = getToken();
    const res = await fetch(BASE_URL + url, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
        },
        body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined)
    });
    if (!res.ok) throw new Error('API Error');
    return res.json();
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Stats = {
    total_users: number;
    active_mps: number;
    total_issues: number;
    system_health: string;
};

type UserRow = {
    id: string;
    name: string;
    email: string;
    role: 'citizen' | 'mp' | 'sysadmin';
    constituency: string | null;
    login_suspended: boolean;
    content_hidden: boolean;
    created_at: string;
};

type AuditLog = {
    id: string;
    action: string;
    created_at: string;
    actor_name: string;
    actor_email: string;
    target_name: string | null;
    target_email: string | null;
};

const ROLE_COLORS: Record<string, string> = {
    citizen: 'bg-blue-50 text-blue-700 border-blue-200',
    mp: 'bg-green-50 text-green-700 border-green-200',
    sysadmin: 'bg-purple-50 text-purple-700 border-purple-200',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const { data: stats, mutate: mutateStats } = useSWR<Stats>('/admin/stats', fetcher);
    const { data: users, mutate: mutateUsers } = useSWR<UserRow[]>('/admin/users', fetcher);
    const { data: auditLogs, mutate: mutateAudit } = useSWR<AuditLog[]>('/admin/audit-logs', fetcher);

    const [suspendModalUserId, setSuspendModalUserId] = useState<string | null>(null);
    const [loginSuspended, setLoginSuspended] = useState(false);
    const [contentHidden, setContentHidden] = useState(false);

    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const updateRole = async (id: string, role: string) => {
        try {
            await apiCall(`/admin/users/${id}/role`, 'PATCH', { role });
            mutateUsers();
            mutateAudit();
            mutateStats();
        } catch (e) {
            console.error(e);
        }
    };

    const openSuspendModal = (u: UserRow) => {
        setSuspendModalUserId(u.id);
        setLoginSuspended(u.login_suspended);
        setContentHidden(u.content_hidden);
    };

    const closeSuspendModal = () => {
        setSuspendModalUserId(null);
    };

    const applySuspension = async () => {
        if (!suspendModalUserId) return;
        try {
            await apiCall(`/admin/users/${suspendModalUserId}/suspend`, 'PATCH', {
                login_suspended: loginSuspended,
                content_hidden: contentHidden
            });
            mutateUsers();
            mutateAudit();
            closeSuspendModal();
        } catch (e) {
            console.error(e);
        }
    };

    const handleImportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importFile) return;
        setImporting(true);
        const formData = new FormData();
        formData.append('file', importFile);
        
        try {
            await apiCall('/admin/users/bulk-import', 'POST', formData);
            setImportFile(null);
            setImportModalOpen(false);
            mutateUsers();
            mutateStats();
            mutateAudit();
        } catch (e) {
            alert('Import failed. Please check the CSV format.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Top bar */}
            <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-white border-b border-border flex items-center px-6 gap-4">
                <Link href="/" className="flex items-center gap-2 mr-4">
                    <div className="w-8 h-8 bg-primary-text flex items-center justify-center">
                        <span className="text-white font-display text-sm font-bold">G</span>
                    </div>
                    <span className="font-display text-lg font-bold text-primary-text">GovLens</span>
                </Link>

                <div className="flex-1" />

                <span className="pill border border-purple-200 bg-purple-50 text-purple-700">
                    System Administration
                </span>

                <div className="flex items-center gap-2">
                    <span className="text-sm font-body text-muted-text">{user?.name}</span>
                    <button
                        onClick={handleLogout}
                        className="btn-secondary text-xs px-3 py-1.5"
                    >
                        Sign out
                    </button>
                </div>
            </header>

            <main className="pt-[72px] px-6 max-w-7xl mx-auto pb-12">
                {/* Page title & Actions */}
                <div className="py-6 border-b border-border mb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold text-primary-text">Administrative Dashboard</h1>
                        <p className="text-sm text-muted-text font-body mt-1">
                            Manage users, roles, and platform health.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            className="btn-secondary text-sm"
                            onClick={() => {
                                if (!users) return;
                                const csvContent = "data:text/csv;charset=utf-8," 
                                    + "ID,Name,Email,Role,Constituency\n"
                                    + users.map(u => `${u.id},${u.name},${u.email},${u.role},${u.constituency || 'N/A'}`).join("\n");
                                const encodedUri = encodeURI(csvContent);
                                const link = document.createElement("a");
                                link.setAttribute("href", encodedUri);
                                link.setAttribute("download", "govlens_users.csv");
                                document.body.appendChild(link);
                                link.click();
                            }}
                        >
                            Export CSV
                        </button>
                        <button 
                            className="btn-primary text-sm"
                            onClick={() => setImportModalOpen(true)}
                        >
                            Bulk Import Users
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="card p-4">
                        <p className="section-label mb-1">Total Users</p>
                        <p className="text-2xl font-bold mono-value text-primary-text">{stats?.total_users ?? '-'}</p>
                    </div>
                    <div className="card p-4">
                        <p className="section-label mb-1">Active MPs</p>
                        <p className="text-2xl font-bold mono-value text-primary-text">{stats?.active_mps ?? '-'}</p>
                    </div>
                    <div className="card p-4">
                        <p className="section-label mb-1">Total Issues</p>
                        <p className="text-2xl font-bold mono-value text-primary-text">{stats?.total_issues ?? '-'}</p>
                    </div>
                    <div className="card p-4">
                        <p className="section-label mb-1">Platform Health</p>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-primary-text font-medium mono-value">{stats?.system_health ?? '-'}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* User management table */}
                    <div className="lg:col-span-2 card overflow-hidden">
                        <div className="p-4 border-b border-border bg-[#F5F5F7]">
                            <h2 className="text-base font-semibold text-primary-text">User Management</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm font-body">
                                <thead>
                                    <tr className="border-b border-border bg-white">
                                        <th className="text-left px-4 py-2.5 section-label">Name</th>
                                        <th className="text-left px-4 py-2.5 section-label">Role</th>
                                        <th className="text-left px-4 py-2.5 section-label">Status</th>
                                        <th className="px-4 py-2.5 section-label text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users?.map((u) => (
                                        <tr key={u.id} className="border-b border-border last:border-0 hover:bg-background transition-colors bg-white">
                                            <td className="px-4 py-3">
                                                <p className="text-primary-text font-medium">{u.name}</p>
                                                <p className="text-xs text-muted-text">{u.email}</p>
                                                {u.constituency && <p className="text-xs text-purple-600 mt-1">{u.constituency}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={u.role}
                                                    onChange={(e) => updateRole(u.id, e.target.value as UserRow['role'])}
                                                    className={`pill border text-xs cursor-pointer ${ROLE_COLORS[u.role]}`}
                                                >
                                                    <option value="citizen">Citizen</option>
                                                    <option value="mp">MP</option>
                                                    <option value="sysadmin">Sysadmin</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                {!u.login_suspended && !u.content_hidden ? (
                                                    <span className="pill border bg-green-50 text-green-700 border-green-200">Active</span>
                                                ) : (
                                                    <span className="pill border bg-red-50 text-red-600 border-red-200">Suspended</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => openSuspendModal(u)}
                                                    className="text-xs text-muted-text hover:text-primary-text transition-colors underline underline-offset-2"
                                                >
                                                    Manage Access
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right column */}
                    <div className="space-y-6">
                        {/* Audit log */}
                        <div className="card p-4">
                            <h2 className="text-base font-semibold text-primary-text mb-3">Audit Log</h2>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                {auditLogs?.map((entry) => (
                                    <div key={entry.id} className="text-sm font-body border-b border-border last:border-0 pb-2">
                                        <p className="text-primary-text leading-snug">{entry.action}</p>
                                        {entry.target_name && (
                                            <p className="text-xs text-purple-600 mt-0.5">Target: {entry.target_name}</p>
                                        )}
                                        <p className="text-xs text-muted-text mt-0.5">
                                            {entry.actor_name} · {new Date(entry.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Suspend Modal */}
            {suspendModalUserId && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg border border-border">
                        <h2 className="text-xl font-bold text-primary-text mb-2">Manage User Access</h2>
                        <p className="text-sm text-muted-text mb-4">Set granular suspension overrides for this account.</p>
                        
                        <div className="space-y-3 mb-6">
                            <label className="flex items-start gap-3 p-3 border border-border rounded-md hover:bg-background cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    className="mt-1"
                                    checked={loginSuspended}
                                    onChange={e => setLoginSuspended(e.target.checked)}
                                />
                                <div>
                                    <p className="text-sm font-medium text-primary-text">Block Login</p>
                                    <p className="text-xs text-muted-text mt-0.5">User will be completely prevented from authenticating.</p>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 border border-border rounded-md hover:bg-background cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    className="mt-1"
                                    checked={contentHidden}
                                    onChange={e => setContentHidden(e.target.checked)}
                                />
                                <div>
                                    <p className="text-sm font-medium text-primary-text">Hide Public Content</p>
                                    <p className="text-xs text-muted-text mt-0.5">Omits all of this user's issues and comments from public APIs.</p>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-3 justify-end mt-6">
                            <button className="btn-secondary" onClick={closeSuspendModal}>Cancel</button>
                            <button className="btn-primary" onClick={applySuspension}>Apply Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {importModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg border border-border">
                        <h2 className="text-xl font-bold text-primary-text mb-2">Bulk Import</h2>
                        <p className="text-sm text-muted-text mb-4">Upload a CSV file to mass-create users.</p>
                        
                        <form onSubmit={handleImportSubmit}>
                            <div className="p-4 border-2 border-dashed border-border rounded-md text-center bg-background mb-4">
                                <input 
                                    type="file" 
                                    accept=".csv"
                                    className="text-sm"
                                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                                    required
                                />
                            </div>
                            <div className="text-xs text-muted-text bg-blue-50 p-3 rounded mb-4">
                                <p className="font-medium text-blue-800 mb-1">Expected CSV Format:</p>
                                <code>Name,Email,Role,Constituency</code><br/>
                                <span className="opacity-70">Example: Kwame,kwame@gh.com,citizen,Biakoye</span>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button type="button" className="btn-secondary" onClick={() => setImportModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={!importFile || importing}>
                                    {importing ? "Importing..." : "Upload & Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

