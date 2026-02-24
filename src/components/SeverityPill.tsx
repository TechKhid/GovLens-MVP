'use client';

import { Severity, SEVERITY_COLORS } from '@/lib/mockData';

export default function SeverityPill({ severity }: { severity: Severity }) {
    const color = SEVERITY_COLORS[severity];

    return (
        <span className="pill bg-white border border-border">
            <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
            />
            <span style={{ color }}>{severity}</span>
        </span>
    );
}
