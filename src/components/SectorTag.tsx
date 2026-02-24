'use client';

import { Sector, SECTOR_COLORS } from '@/lib/mockData';

export default function SectorTag({ sector }: { sector: Sector }) {
    const color = SECTOR_COLORS[sector];

    return (
        <span className="pill bg-background">
            <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
            />
            <span className="text-primary-text">{sector}</span>
        </span>
    );
}
