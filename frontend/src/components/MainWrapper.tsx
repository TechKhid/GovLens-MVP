'use client';

import { usePathname } from 'next/navigation';

// Adds top padding for the fixed navbar on all pages except /login
export default function MainWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    return (
        <main className={isLoginPage ? '' : 'pt-[72px]'}>
            {children}
        </main>
    );
}
