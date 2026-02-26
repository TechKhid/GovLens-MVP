'use client';

import { startTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRole } from '@/context/RoleContext';

export default function Navigation() {
    const { role, setRole } = useRole();
    const pathname = usePathname();
    const router = useRouter();

    const switchRole = (newRole: 'citizen' | 'mp') => {
        setRole(newRole);
        startTransition(() => {
            if (newRole === 'citizen') {
                router.push('/');
            } else {
                router.push('/mp/dashboard');
            }
        });
    };

    const citizenLinks = [
        { href: '/', label: 'Issues' },
        { href: '/heatmap', label: 'Heatmap' },
        { href: '/briefings', label: 'Briefings' },
        { href: '/mp-profile', label: 'MP Profile' },
    ];

    const mpLinks = [
        { href: '/mp/dashboard', label: 'Dashboard' },
        { href: '/mp/briefings', label: 'Briefings' },
        { href: '/mp/analytics', label: 'Analytics' },
        { href: '/mp-profile', label: 'MP Profile' },
    ];

    const links = role === 'citizen' ? citizenLinks : mpLinks;

    return (
        <nav className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-border h-[72px]">
            <div className="max-w-[1400px] mx-auto h-full px-6 flex items-center justify-between">
                {/* Logo + Constituency */}
                <div className="flex items-center gap-4">
                    <Link href={role === 'citizen' ? '/' : '/mp/dashboard'} className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary-text flex items-center justify-center">
                            <span className="text-white font-display text-sm font-bold">G</span>
                        </div>
                        <span className="font-display text-lg font-bold text-primary-text">
                            GovLens
                        </span>
                    </Link>
                    <span className="hidden md:inline text-xs text-muted-text font-body border-l border-border pl-4">
                        Ayawaso West Wuogon
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

                {/* Role Toggle */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center border border-border bg-background">
                        <button
                            onClick={() => switchRole('citizen')}
                            className={`px-3 py-1.5 text-xs font-body font-medium transition-all cursor-pointer ${role === 'citizen'
                                ? 'bg-primary-text text-white'
                                : 'text-muted-text hover:text-primary-text'
                                }`}
                        >
                            Citizen
                        </button>
                        <button
                            onClick={() => switchRole('mp')}
                            className={`px-3 py-1.5 text-xs font-body font-medium transition-all cursor-pointer ${role === 'mp'
                                ? 'bg-briefing-blue text-white'
                                : 'text-muted-text hover:text-primary-text'
                                }`}
                        >
                            MP Office
                        </button>
                    </div>
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
