'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/RoleContext';

// ── Authentic Adinkra symbol SVGs from Wikimedia Commons ─────────────────────
// These are the real, canonical vector images of each Adinkra symbol.
const ADINKRA_SYMBOLS = [
    {
        name: 'Gye Nyame',
        url: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Adinkra_Gye_Nyame.svg',
    },
    {
        name: 'Sankofa',
        url: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Adinkra_Sankofa.svg',
    },
    {
        name: 'Dwennimmen',
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Adinkra_Dwennimmen.svg',
    },
    {
        name: 'Akoma',
        url: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Adinkra_Akoma.svg',
    },
    {
        name: 'Aya',
        url: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Adinkra_Aya.svg',
    },
    {
        name: 'Adinkrahene',
        url: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Adinkra_Adinkrahene.svg',
    },
    {
        name: 'Nyame Biribi Wo Soro',
        url: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/Adinkra_Nyame_Biribi_Wo_Soro.svg',
    },
    {
        name: 'Fawohodie',
        url: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Adinkra_Fawohodie.svg',
    },
    {
        name: 'Nkyinkyim',
        url: 'https://upload.wikimedia.org/wikipedia/commons/6/61/Adinkra_Nkyinkyim.svg',
    },
    {
        name: 'Ese Ne Tekrema',
        url: 'https://upload.wikimedia.org/wikipedia/commons/f/f4/Adinkra_Ese_Ne_Tekrema.svg',
    },
];

interface PlacedSymbol {
    url: string;
    name: string;
    x: number;
    y: number;
    size: number;
    opacity: number;
    rotate: number;
}

function AdinkraBackground() {
    const [symbols, setSymbols] = useState<PlacedSymbol[]>([]);

    useEffect(() => {
        const placed: PlacedSymbol[] = [];
        for (let i = 0; i < 28; i++) {
            const sym = ADINKRA_SYMBOLS[i % ADINKRA_SYMBOLS.length];
            placed.push({
                ...sym,
                x: Math.random() * 100,
                y: Math.random() * 100,
                size: 36 + Math.random() * 56,
                opacity: 0.04 + Math.random() * 0.07,
                rotate: Math.round(Math.random() * 4) * 90, // 0 / 90 / 180 / 270
            });
        }
        setSymbols(placed);
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
            {symbols.map((s, i) => (
                <Image
                    key={i}
                    src={s.url}
                    alt=""
                    width={s.size}
                    height={s.size}
                    unoptimized
                    className="absolute brightness-0"
                    style={{
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        width: s.size,
                        height: s.size,
                        opacity: s.opacity,
                        transform: `rotate(${s.rotate}deg)`,
                    }}
                />
            ))}
        </div>
    );
}

// ── Login form ────────────────────────────────────────────────────────────────

function LoginForm() {
    const { login, isAuthenticated, user, isLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isLoading && isAuthenticated && user) {
            const from = searchParams.get('from');
            const destination =
                from && from !== '/login'
                    ? from
                    : user.role === 'sysadmin'
                        ? '/admin'
                        : user.role === 'mp'
                            ? '/mp/dashboard'
                            : '/';
            router.replace(destination);
        }
    }, [isAuthenticated, isLoading, user, router, searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await login(email.trim(), password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid credentials');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGuestAccess = async () => {
        setError('');
        setSubmitting(true);
        try {
            await login('amina@example.com', 'password123');
        } catch {
            setError('Could not start guest session.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-background flex flex-col items-center justify-center px-4 overflow-hidden">
            {/* Authentic Adinkra symbols in background */}
            <AdinkraBackground />

            {/* Card — same original color theme */}
            <div className="relative w-full max-w-md bg-white border border-border p-8 md:p-10 z-10">
                {/* Logo */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-9 h-9 bg-primary-text flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-display text-base font-bold">G</span>
                    </div>
                    <div>
                        <p className="font-display text-xl font-bold text-primary-text leading-none">GovLens</p>
                        <p className="text-xs text-muted-text font-body mt-0.5">Ayawaso West Wuogon</p>
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-primary-text mb-1">Sign in</h1>
                <p className="text-sm text-muted-text font-body mb-7">
                    Enter your credentials to access your account.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Email */}
                    <div>
                        <label className="section-label mb-1.5 block" htmlFor="login-email">
                            Email
                        </label>
                        <input
                            id="login-email"
                            type="email"
                            autoComplete="email"
                            required
                            className="input-field"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={submitting}
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="section-label mb-1.5 block" htmlFor="login-password">
                            Password
                        </label>
                        <input
                            id="login-password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="input-field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={submitting}
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <p className="text-sm font-body text-red-600 bg-red-50 border border-red-200 px-3 py-2">
                            {error}
                        </p>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Signing in…
                            </>
                        ) : (
                            'Sign in'
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 border-t border-border" />
                    <span className="text-xs text-muted-text font-body">or</span>
                    <div className="flex-1 border-t border-border" />
                </div>

                {/* Guest access */}
                <button
                    onClick={handleGuestAccess}
                    className="btn-secondary w-full"
                    disabled={submitting}
                >
                    Continue as guest (Citizen view)
                </button>

                {/* Dev helper */}
                <div className="mt-6 p-3 bg-background border border-border">
                    <p className="section-label mb-2">Development — test accounts</p>
                    <div className="space-y-1 text-xs font-body text-muted-text">
                        <p><span className="font-medium text-primary-text">Citizen:</span> amina@example.com / password123</p>
                        <p><span className="font-medium text-primary-text">MP:</span> mp@example.com / password123</p>
                        <p><span className="font-medium text-primary-text">Admin:</span> admin@example.com / password123</p>
                    </div>
                </div>
            </div>

            <p className="relative mt-6 text-xs text-muted-text font-body z-10">
                <Link href="/" className="hover:text-primary-text transition-colors">
                    ← Back to public site
                </Link>
            </p>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
