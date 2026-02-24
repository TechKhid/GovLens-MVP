'use client';

import { Status, STATUS_COLORS } from '@/lib/mockData';

export default function StatusPill({ status }: { status: Status }) {
    const color = STATUS_COLORS[status];

    return (
        <span className="pill bg-white border border-border">
            <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
            />
            <span style={{ color }}>{status}</span>
        </span>
    );
}
