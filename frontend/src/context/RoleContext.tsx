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
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<TokenPayload | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const current = getCurrentUser();
        setUser(current);
        setIsLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const data = await api.post<LoginResponse>('/auth/login', { email, password });
        setToken(data.access_token);

        const { getCurrentUser: getCU } = await import('@/lib/auth');
        const tokenPayload = getCU();
        if (!tokenPayload) {
            throw new Error('Invalid token received from server');
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

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
}

export function useRole() {
    const { user } = useAuth();
    return {
        role: (user?.role ?? 'citizen') as Role,
        setRole: (_: Role) => { },
    };
}
