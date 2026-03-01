import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { RoleProvider } from '@/context/RoleContext';
import { DataStoreProvider } from '@/context/DataStoreContext';
import Navigation from '@/components/Navigation';
import { Analytics } from '@vercel/analytics/next';

const playfair = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-playfair',
    display: 'swap',
});

const dmSans = DM_Sans({
    subsets: ['latin'],
    variable: '--font-dm-sans',
    display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '600'],
    variable: '--font-ibm-plex-mono',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'GovLens — Civic Transparency Platform',
    description:
        'Track, prioritise, and resolve community issues with your Member of Parliament. A structured governance feedback loop for Ayawaso West Wuogon.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={`${playfair.variable} ${dmSans.variable} ${ibmPlexMono.variable}`}
        >
            <body className="bg-background text-primary-text font-body antialiased min-h-screen">
                <RoleProvider>
                    <DataStoreProvider>
                        <Navigation />
                        <main className="pt-[72px]">{children}</main>
                    </DataStoreProvider>
                </RoleProvider>
                <Analytics />
            </body>
        </html>
    );
}
