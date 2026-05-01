'use client';

import { startTransition, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/RoleContext';

// ─── Avatar initials helper ───────────────────────────────────────────────────

function initials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase();
}

const AVATAR_COLORS: Record<string, string> = {
    citizen: 'bg-blue-600',
    mp: 'bg-green-700',
    sysadmin: 'bg-purple-700',
};

// ─── Navigation ───────────────────────────────────────────────────────────────

export default function Navigation() {
    const { user, isAuthenticated, logout } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click — must be declared before any early returns
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Don't render navbar on the login or register pages — AFTER all hooks
    if (pathname === '/login' || pathname === '/register') return null;

    const role = user?.role ?? 'citizen';

    const citizenLinks = [
        { href: '/', label: 'Issues' },
        { href: '/heatmap', label: 'Heatmap' },
        { href: '/briefings', label: 'Briefings' },
        { href: '/mp-profile', label: 'MP Profile' },
    ];

    const mpLinks = [
        { href: '/mp/dashboard', label: 'Dashboard' },
        { href: '/mp/heatmap', label: 'Heatmap' },
        { href: '/mp/briefings', label: 'Briefings' },
        { href: '/mp/analytics', label: 'Analytics' },
        { href: '/mp-profile', label: 'MP Profile' },
    ];

    const adminLinks = [
        { href: '/admin', label: 'Admin Panel' },
        { href: '/', label: 'Public Site' },
    ];

    const links =
        role === 'sysadmin' ? adminLinks : role === 'mp' ? mpLinks : citizenLinks;

    const handleLogout = async () => {
        setMenuOpen(false);
        await logout();
        startTransition(() => router.push('/login'));
    };

    const homeHref =
        role === 'sysadmin' ? '/admin' : role === 'mp' ? '/mp/dashboard' : '/';

    return (
        <nav className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-border h-[72px]">
            <div className="max-w-[1400px] mx-auto h-full px-6 flex items-center justify-between">
                {/* Logo + Constituency */}
                <div className="flex items-center gap-4">
                    <Link href={homeHref} className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary-text flex items-center justify-center">
                            <span className="text-white font-display text-sm font-bold">G</span>
                        </div>
                        <span className="font-display text-lg font-bold text-primary-text">
                            GovLens
                        </span>
                    </Link>
                    <span className="hidden md:inline text-xs text-muted-text font-body border-l border-border pl-4">
                        {user?.constituency || 'GovLens'}
                    </span>
                </div>

                {/* Nav Links */}
                <div className="hidden md:flex items-center gap-1">
                    {links.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`px-3 py-2 text-sm font-body transition-colors ${isActive
                                    ? 'text-primary-text font-medium'
                                    : 'text-muted-text hover:text-primary-text'
                                    }`}
                            >
                                {link.label}
                                {isActive && (
                                    <div className="h-0.5 bg-primary-text mt-1 rounded-full" />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Right side – user avatar (auth) or sign-in (guest) */}
                <div className="flex items-center gap-3">
                    {isAuthenticated && user ? (
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setMenuOpen((v) => !v)}
                                className="flex items-center gap-2 group"
                                aria-label="User menu"
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-opacity group-hover:opacity-80 ${AVATAR_COLORS[role]}`}
                                >
                                    {initials(user.name)}
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-xs font-medium text-primary-text leading-none">{user.name}</p>
                                    <p className="text-[10px] text-muted-text capitalize">{role}</p>
                                </div>
                                <svg className="w-3.5 h-3.5 text-muted-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {menuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-border shadow-md z-50">
                                    <div className="px-3 py-2 border-b border-border">
                                        <p className="text-xs font-medium text-primary-text">{user.email}</p>
                                        <p className="text-[10px] text-muted-text capitalize">{role}</p>
                                    </div>
                                    {role === 'sysadmin' && (
                                        <Link
                                            href="/admin"
                                            onClick={() => setMenuOpen(false)}
                                            className="block px-3 py-2 text-xs font-body text-primary-text hover:bg-background transition-colors"
                                        >
                                            Admin Panel
                                        </Link>
                                    )}
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-3 py-2 text-xs font-body text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link href="/login" className="btn-secondary text-xs px-3 py-1.5">
                            Sign in
                        </Link>
                    )}
                </div>
            </div>

            {/* Mobile Nav */}
            <div className="md:hidden border-t border-border bg-white flex overflow-x-auto">
                {links.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex-1 text-center px-2 py-2.5 text-xs font-body whitespace-nowrap ${isActive
                                ? 'text-primary-text font-medium border-b-2 border-primary-text'
                                : 'text-muted-text'
                                }`}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
