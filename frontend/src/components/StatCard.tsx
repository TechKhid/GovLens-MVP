'use client';

interface StatCardProps {
    label: string;
    value: string | number;
    color?: string;
    subtitle?: string;
}

export default function StatCard({ label, value, color, subtitle }: StatCardProps) {
    return (
        <div
            className="card p-4"
            style={{ borderTopWidth: '3px', borderTopColor: color || '#E5E5E3' }}
        >
            <p className="section-label mb-1">{label}</p>
            <p className="mono-value text-2xl font-semibold text-primary-text">
                {value}
            </p>
            {subtitle && (
                <p className="text-xs text-muted-text mt-1 font-body">{subtitle}</p>
            )}
        </div>
    );
}
