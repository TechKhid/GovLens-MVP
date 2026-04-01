'use client';

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from 'react';
import {
    type Role,
    type TokenPayload,
    setToken,
    clearToken,
    getCurrentUser,
} from '@/lib/auth';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type { Role };

interface LoginResponse {
    access_token: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: Role;
        constituency?: string;
    };
}

interface AuthContextType {
    user: TokenPayload | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    /** Call after receiving a JWT from the backend. */
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Mock credentials for development/demo ──────────────────────────────────
// Remove once the Go backend /api/auth/login endpoint is live.

const MOCK_USERS: Record<string, { password: string; role: Role; name: string }> = {
    'citizen@test.gh': { password: 'password', role: 'citizen', name: 'Abena Asante' },
    'mp@test.gh': { password: 'password', role: 'mp', name: 'Hon. Kwame Mensah' },
    'admin@test.gh': { password: 'password', role: 'sysadmin', name: 'Sysadmin' },
};

function buildMockJwt(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload));
    return `${header}.${body}.mock_signature`;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<TokenPayload | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Rehydrate from localStorage on mount
    useEffect(() => {
        const current = getCurrentUser();
        setUser(current);
        setIsLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const mock = MOCK_USERS[email.toLowerCase()];

        let tokenPayload: TokenPayload;

        if (mock && mock.password === password) {
            // ── Mock path (development) ──
            const now = Math.floor(Date.now() / 1000);
            const payload = {
                sub: crypto.randomUUID(),
                name: mock.name,
                email,
                role: mock.role,
                constituency: 'Ayawaso West Wuogon',
                iat: now,
                exp: now + 3600,
            };
            const fakeToken = buildMockJwt(payload);
            setToken(fakeToken);
            tokenPayload = payload as TokenPayload;
        } else {
            // ── Real API path ──
            const data = await api.post<LoginResponse>('/auth/login', { email, password });
            setToken(data.access_token);
            // Decode the real token so we have claims
            const { getCurrentUser: getCU } = await import('@/lib/auth');
            const decoded = getCU();
            if (!decoded) throw new Error('Invalid token received from server');
            tokenPayload = decoded;
        }

        setUser(tokenPayload);
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.delete('/auth/logout');
        } catch {
            // best-effort
        }
        clearToken();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}

/** Legacy shim – keeps existing components that imported useRole working. */
export function useRole() {
    const { user } = useAuth();
    return {
        role: (user?.role ?? 'citizen') as Role,
        // setRole is a no-op; real role comes from the JWT
        setRole: (_: Role) => { },
    };
}
