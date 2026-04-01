'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/RoleContext';
import { useRouter } from 'next/navigation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
    citizen: 'Citizen',
    mp: 'MP Office',
    sysadmin: 'Sysadmin',
};

const ROLE_COLORS: Record<string, string> = {
    citizen: 'bg-blue-50 text-blue-700 border-blue-200',
    mp: 'bg-green-50 text-green-700 border-green-200',
    sysadmin: 'bg-purple-50 text-purple-700 border-purple-200',
};

function getInitials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase();
}

// ─── Mock stat cards ─────────────────────────────────────────────────────────

const STATS = [
    { label: 'Total Users', value: '1,248', delta: '+12 this week', good: true },
    { label: 'Active MPs', value: '4', delta: '1 pending approval', good: null },
    { label: 'Open Issues', value: '183', delta: '−22 from last week', good: true },
    { label: 'API Health', value: '99.8%', delta: 'All systems nominal', good: true },
];

// ─── Mock users ───────────────────────────────────────────────────────────────

type UserRow = {
    id: string;
    name: string;
    email: string;
    role: 'citizen' | 'mp' | 'sysadmin';
    status: 'Active' | 'Suspended';
};

const INITIAL_USERS: UserRow[] = [
    { id: '1', name: 'Abena Asante', email: 'citizen@test.gh', role: 'citizen', status: 'Active' },
    { id: '2', name: 'Hon. Kwame Mensah', email: 'mp@test.gh', role: 'mp', status: 'Active' },
    { id: '3', name: 'Dr. Efua Boateng', email: 'efua@parliament.gh', role: 'mp', status: 'Active' },
    { id: '4', name: 'Kofi Agyemang', email: 'kofi@example.gh', role: 'citizen', status: 'Active' },
    { id: '5', name: 'Adwoa Frimpong', email: 'adwoa@example.gh', role: 'citizen', status: 'Suspended' },
];

// ─── Mock audit log ───────────────────────────────────────────────────────────

const AUDIT_LOG = [
    { id: 1, time: '11:04 AM', actor: 'Sysadmin', action: 'Promoted efua@parliament.gh to MP role' },
    { id: 2, time: '10:52 AM', actor: 'Sysadmin', action: 'Suspended adwoa@example.gh' },
    { id: 3, time: '10:30 AM', actor: 'Sysadmin', action: 'Approved issue #182 close request from Hon. Kwame' },
    { id: 4, time: 'Yesterday', actor: 'System', action: 'Automated DB backup completed (0 errors)' },
    { id: 5, time: 'Yesterday', actor: 'Sysadmin', action: 'Reset password for citizen@test.gh' },
];

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<UserRow[]>(INITIAL_USERS);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const toggleStatus = (id: string) => {
        setUsers((prev) =>
            prev.map((u) =>
                u.id === id
                    ? { ...u, status: u.status === 'Active' ? 'Suspended' : 'Active' }
                    : u
            )
        );
    };

    const updateRole = (id: string, role: UserRow['role']) => {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
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
                {/* Page title */}
                <div className="py-6 border-b border-border mb-6">
                    <h1 className="text-2xl font-bold text-primary-text">Administrative Dashboard</h1>
                    <p className="text-sm text-muted-text font-body mt-1">
                        Manage users, roles, and platform health.
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {STATS.map((s) => (
                        <div key={s.label} className="card p-4">
                            <p className="section-label mb-1">{s.label}</p>
                            <p className="text-2xl font-bold mono-value text-primary-text">{s.value}</p>
                            <p
                                className={`text-xs font-body mt-1 ${s.good === true
                                    ? 'text-green-600'
                                    : s.good === false
                                        ? 'text-red-600'
                                        : 'text-muted-text'
                                    }`}
                            >
                                {s.delta}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* User management table */}
                    <div className="lg:col-span-2 card">
                        <div className="p-4 border-b border-border">
                            <h2 className="text-base font-semibold text-primary-text">User Management</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm font-body">
                                <thead>
                                    <tr className="border-b border-border bg-background">
                                        <th className="text-left px-4 py-2.5 section-label">Name</th>
                                        <th className="text-left px-4 py-2.5 section-label">Role</th>
                                        <th className="text-left px-4 py-2.5 section-label">Status</th>
                                        <th className="px-4 py-2.5 section-label text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id} className="border-b border-border last:border-0 hover:bg-background transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="text-primary-text font-medium">{u.name}</p>
                                                <p className="text-xs text-muted-text">{u.email}</p>
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
                                                <span
                                                    className={`pill border ${u.status === 'Active'
                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                        : 'bg-red-50 text-red-600 border-red-200'
                                                        }`}
                                                >
                                                    {u.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => toggleStatus(u.id)}
                                                    className="text-xs text-muted-text hover:text-primary-text transition-colors underline underline-offset-2"
                                                >
                                                    {u.status === 'Active' ? 'Suspend' : 'Reactivate'}
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
                        {/* Platform health */}
                        <div className="card p-4">
                            <h2 className="text-base font-semibold text-primary-text mb-3">Platform Health</h2>
                            <div className="space-y-2">
                                {[
                                    { name: 'API Gateway', value: '24 ms', ok: true },
                                    { name: 'Database', value: 'OK', ok: true },
                                    { name: 'Auth Service', value: 'OK', ok: true },
                                    { name: 'Uptime (30 d)', value: '99.8%', ok: true },
                                ].map((item) => (
                                    <div key={item.name} className="flex items-center justify-between text-sm font-body">
                                        <span className="text-muted-text">{item.name}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={`w-2 h-2 rounded-full ${item.ok ? 'bg-green-500' : 'bg-red-500'}`}
                                            />
                                            <span className="text-primary-text font-medium mono-value">{item.value}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Audit log */}
                        <div className="card p-4">
                            <h2 className="text-base font-semibold text-primary-text mb-3">Audit Log</h2>
                            <div className="space-y-3">
                                {AUDIT_LOG.map((entry) => (
                                    <div key={entry.id} className="text-sm font-body">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-primary-text leading-snug">{entry.action}</p>
                                        </div>
                                        <p className="text-xs text-muted-text mt-0.5">
                                            {entry.actor} · {entry.time}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
