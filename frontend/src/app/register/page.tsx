'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/RoleContext';
import { api } from '@/lib/api';

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

interface AvatarUpload {
    file: File;
    previewUrl: string;
}

// ── Register form ─────────────────────────────────────────────────────────────

function RegisterForm() {
    const { login } = useAuth();
    const router = useRouter();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'citizen' | 'mp'>('citizen');
    
    // Dynamic geographical data states
    const [regions, setRegions] = useState<{ id: string, name: string }[]>([]);
    const [districts, setDistricts] = useState<{ id: string, name: string }[]>([]);
    const [constituenciesList, setConstituenciesList] = useState<{ id: string, name: string }[]>([]);
    
    // Geographical mapping state
    const [regionId, setRegionId] = useState('');
    const [districtId, setDistrictId] = useState('');
    const [constituencyName, setConstituencyName] = useState('');
    
    // MP specific fields
    const [party, setParty] = useState('');
    const [phone, setPhone] = useState('');
    const [officeAddr, setOfficeAddr] = useState('');
    const [termStart, setTermStart] = useState('2025');
    const [termEnd, setTermEnd] = useState('2029');
    const [bio, setBio] = useState('');
    const [avatarUpload, setAvatarUpload] = useState<AvatarUpload | null>(null);
    const [avatarError, setAvatarError] = useState('');

    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (role !== 'mp' && avatarUpload) {
            setAvatarUpload(null);
            setAvatarError('');
        }
    }, [role, avatarUpload]);

    useEffect(() => {
        return () => {
            if (avatarUpload) {
                URL.revokeObjectURL(avatarUpload.previewUrl);
            }
        };
    }, [avatarUpload]);

    // Initial regions fetch
    useEffect(() => {
        api.get('/locations/regions')
            .then((res: any) => setRegions(res || []))
            .catch(err => console.error("Failed to load regions", err));
    }, []);

    // Reset downstream selections when region changes
    useEffect(() => {
        setDistrictId('');
        setConstituencyName('');
        if (regionId) {
            api.get(`/locations/regions/${regionId}/districts`)
                .then((res: any) => setDistricts(res || []))
                .catch(err => console.error("Failed to load districts", err));
        } else {
            setDistricts([]);
        }
    }, [regionId]);

    // Reset downstream selections when district changes
    useEffect(() => {
        setConstituencyName('');
        if (districtId) {
            api.get(`/locations/districts/${districtId}/constituencies`)
                .then((res: any) => setConstituenciesList(res || []))
                .catch(err => console.error("Failed to load constituencies", err));
        } else {
            setConstituenciesList([]);
        }
    }, [districtId]);

    const clearAvatarUpload = () => {
        setAvatarUpload(null);
        setAvatarError('');
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
        if (!allowedTypes.has(file.type)) {
            setAvatarError('Use JPG, PNG, or WebP for the MP profile photo.');
            e.target.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setAvatarError('MP profile photos must be 5MB or smaller.');
            e.target.value = '';
            return;
        }

        setAvatarUpload({
            file,
            previewUrl: URL.createObjectURL(file),
        });
        setAvatarError('');
        e.target.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        // Validation for shared fields
        if (!constituencyName) {
            setError('Please select your Region, Municipality, and Constituency.');
            return;
        }

        // Basic validation for MP
        if (role === 'mp' && !party) {
            setError('Political Party is required for MPs.');
            return;
        }

        setSubmitting(true);
        try {
            const registerPayload = {
                name: name.trim(),
                email: email.trim(),
                password,
                role,
                constituency: constituencyName.trim(),
                ...(role === 'mp' && {
                    party: party.trim(),
                    phone: phone.trim(),
                    office_addr: officeAddr.trim(),
                    term_start: termStart.trim(),
                    term_end: termEnd.trim(),
                    bio: bio.trim(),
                })
            };

            if (role === 'mp' && avatarUpload) {
                const formData = new FormData();
                formData.append('name', registerPayload.name);
                formData.append('email', registerPayload.email);
                formData.append('password', registerPayload.password);
                formData.append('role', registerPayload.role);
                formData.append('constituency', registerPayload.constituency);
                formData.append('party', party.trim());
                formData.append('phone', phone.trim());
                formData.append('office_addr', officeAddr.trim());
                formData.append('term_start', termStart.trim());
                formData.append('term_end', termEnd.trim());
                formData.append('bio', bio.trim());
                formData.append('avatar', avatarUpload.file);
                await api.postForm('/auth/register', formData);
            } else {
                await api.post('/auth/register', registerPayload);
            }

            // Immediately login the newly created user
            await login(email.trim(), password);
            router.replace('/');

        } catch (err: any) {
            if (err.message?.includes('conflict') || err.message?.includes('duplicate')) {
                setError('A user with this email already exists.');
            } else {
                setError(err.message || 'Registration failed');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-background flex flex-col items-center justify-center px-4 overflow-hidden">
            {/* Authentic Adinkra symbols in background */}
            <AdinkraBackground />

            {/* Card — same original color theme */}
            <div className="relative w-full max-w-md bg-white border border-border p-8 md:p-10 z-10 shadow-sm">
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

                <h1 className="text-2xl font-bold text-primary-text mb-1">Create an account</h1>
                <p className="text-sm text-muted-text font-body mb-6">
                    Join GovLens to connect directly with your community.
                </p>

                {/* Role Toggle */}
                <div className="flex bg-background border border-border p-1 mb-6 rounded-md">
                    <button
                        type="button"
                        onClick={() => setRole('citizen')}
                        className={`flex-1 py-1.5 text-sm font-bold font-body transition-colors rounded-sm ${role === 'citizen' ? 'bg-white shadow-sm text-primary-text border border-border' : 'text-muted-text hover:text-primary-text'}`}
                    >
                        Citizen
                    </button>
                    <button
                        type="button"
                        onClick={() => setRole('mp')}
                        className={`flex-1 py-1.5 text-sm font-bold font-body transition-colors rounded-sm ${role === 'mp' ? 'bg-white shadow-sm text-primary-text border border-border' : 'text-muted-text hover:text-primary-text'}`}
                    >
                        MP
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm"
                            placeholder={role === 'mp' ? "Hon. Kwame Mensah" : "Kwame Mensah"}
                            disabled={submitting}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm"
                            placeholder={role === 'mp' ? "mp@parliament.gh" : "you@example.com"}
                            disabled={submitting}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">Region</label>
                            <select
                                value={regionId}
                                onChange={(e) => setRegionId(e.target.value)}
                                required
                                title="Region filter"
                                className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm bg-white"
                                disabled={submitting}
                            >
                                <option value="" disabled>Select Region</option>
                                {regions.map((r) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">Municipality</label>
                            <select
                                value={districtId}
                                onChange={(e) => setDistrictId(e.target.value)}
                                required
                                title="Municipality filter"
                                disabled={!regionId || submitting}
                                className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
                            >
                                <option value="" disabled>Select Municipality</option>
                                {districts.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">Constituency</label>
                            <select
                                value={constituencyName}
                                onChange={(e) => setConstituencyName(e.target.value)}
                                required
                                title="Constituency filter"
                                disabled={!districtId || submitting}
                                className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400"
                            >
                                <option value="" disabled>Select Constituency</option>
                                {constituenciesList.map((c) => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {role === 'mp' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">
                                    Profile Photo <span className="normal-case font-normal">(optional)</span>
                                </label>
                                <label className="block w-full border border-dashed border-border px-4 py-5 text-center cursor-pointer hover:bg-background transition-colors">
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleAvatarUpload}
                                        className="hidden"
                                        disabled={submitting}
                                    />
                                    <div className="text-muted-text">
                                        <p className="text-sm font-body">Upload an MP avatar photo</p>
                                        <p className="text-xs font-body mt-1">JPG, PNG, or WebP - max 5MB</p>
                                    </div>
                                </label>
                                {avatarUpload && (
                                    <div className="mt-3 flex items-center gap-3 border border-border px-3 py-2">
                                        <img
                                            src={avatarUpload.previewUrl}
                                            alt="MP avatar preview"
                                            className="w-14 h-14 rounded-full object-cover border border-border"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-body text-primary-text truncate">{avatarUpload.file.name}</p>
                                            <p className="text-xs text-muted-text font-body">
                                                {(avatarUpload.file.size / (1024 * 1024)).toFixed(1)} MB
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={clearAvatarUpload}
                                            className="text-xs font-body text-primary-text hover:underline"
                                            disabled={submitting}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                                {avatarError && (
                                    <p className="text-red-500 text-xs font-body mt-2">{avatarError}</p>
                                )}
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">
                                        Party
                                    </label>
                                    <select
                                        value={party}
                                        onChange={(e) => setParty(e.target.value)}
                                        required
                                        title="Political Party"
                                        className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm bg-white"
                                        disabled={submitting}
                                    >
                                        <option value="" disabled>Select Party</option>
                                        <option value="National Democratic Congress (NDC)">NDC</option>
                                        <option value="New Patriotic Party (NPP)">NPP</option>
                                        <option value="Independent">Independent</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm"
                                        placeholder="+233 24 000 0000"
                                        disabled={submitting}
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">
                                        Office Address
                                    </label>
                                    <input
                                        type="text"
                                        value={officeAddr}
                                        onChange={(e) => setOfficeAddr(e.target.value)}
                                        className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm"
                                        placeholder="Accra, Ghana"
                                        disabled={submitting}
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">
                                        Term Start
                                    </label>
                                    <input
                                        type="text"
                                        value={termStart}
                                        onChange={(e) => setTermStart(e.target.value)}
                                        className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm"
                                        placeholder="2025"
                                        disabled={submitting}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">
                                        Term End
                                    </label>
                                    <input
                                        type="text"
                                        value={termEnd}
                                        onChange={(e) => setTermEnd(e.target.value)}
                                        className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm"
                                        placeholder="2029"
                                        disabled={submitting}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">
                                    Biography
                                </label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm min-h-[80px]"
                                    placeholder="Brief background about yourself and your political career..."
                                    disabled={submitting}
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2 font-body">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-border focus:border-primary-text focus:ring-1 focus:ring-primary-text outline-none transition-all font-body text-sm"
                            placeholder="••••••••"
                            disabled={submitting}
                        />
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm font-body bg-red-50 p-3 border border-red-100">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-primary-text text-white font-bold py-3 px-4 font-body hover:bg-black transition-colors shadow-sm disabled:opacity-50 mt-2"
                    >
                        {submitting ? 'Creating account...' : 'Sign up'}
                    </button>
                    
                    <div className="text-center mt-6">
                        <p className="text-sm text-muted-text font-body">
                            Already have an account?{' '}
                            <Link href="/login" className="text-primary-text font-medium hover:underline transition-colors">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </form>
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

export default function RegisterPage() {
    return (
        <Suspense>
            <RegisterForm />
        </Suspense>
    );
}
