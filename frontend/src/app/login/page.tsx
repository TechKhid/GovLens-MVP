'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/RoleContext';

// ── Adinkra tiled background ──────────────────────────────────────────────────

function AdinkraBackground() {
    return (
        <div
            aria-hidden
            className="absolute pointer-events-none select-none"
            style={{
                inset: '-20%',           // oversized so rotated edges don't show gaps
                backgroundImage: 'url(/adinkra.png)',
                backgroundSize: '680px auto',
                backgroundRepeat: 'repeat',
                opacity: 0.15,
                mixBlendMode: 'multiply',
                transform: 'rotate(8deg)',
            }}
        />
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
                        <p className="text-xs text-muted-text font-body mt-0.5 italic">See it. Report it. Resolve it.</p>
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

                {/* Sign up link */}
                <div className="text-center mt-6">
                    <p className="text-sm text-muted-text font-body">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-primary-text font-medium hover:underline transition-colors">
                            Sign up
                        </Link>
                    </p>
                </div>

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

            <div className="relative mt-6 z-10">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-border text-sm font-body text-primary-text hover:bg-primary-text hover:text-white transition-colors shadow-sm"
                >
                    ← Back to public site
                </Link>
            </div>
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
