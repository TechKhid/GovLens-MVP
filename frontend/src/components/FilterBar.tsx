'use client';

import { Status, STATUS_COLORS, STATUSES } from '@/lib/mockData';

interface FilterBarProps {
    activeFilter: Status | 'All';
    onFilterChange: (filter: Status | 'All') => void;
    counts?: Record<string, number>;
}

export default function FilterBar({ activeFilter, onFilterChange, counts }: FilterBarProps) {
    const filters: (Status | 'All')[] = ['All', ...STATUSES];

    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => {
                const isActive = activeFilter === filter;
                const color = filter === 'All' ? '#111111' : STATUS_COLORS[filter as Status];
                const count = counts?.[filter];

                return (
                    <button
                        key={filter}
                        onClick={() => onFilterChange(filter)}
                        className={`filter-pill whitespace-nowrap ${isActive ? 'filter-pill-active' : ''}`}
                        style={isActive ? { borderColor: color, color: color } : {}}
                    >
                        {filter}
                        {count !== undefined && (
                            <span className="ml-1.5 font-mono text-xs opacity-60">{count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
