'use client';

import { usePathname } from 'next/navigation';

// Adds top padding for the fixed navbar on all pages except /login and /register
export default function MainWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuthPage = pathname === '/login' || pathname === '/register';

    return (
        <main className={isAuthPage ? '' : 'pt-[72px]'}>
            {children}
        </main>
    );
}
