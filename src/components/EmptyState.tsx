'use client';

interface EmptyStateProps {
    icon?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
}

export default function EmptyState({ icon = '📭', message, actionLabel, onAction }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-8">
            <span className="text-4xl mb-4 opacity-40">{icon}</span>
            <p className="text-muted-text font-body text-sm text-center max-w-xs">
                {message}
            </p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="mt-4 text-sm font-body font-medium text-briefing-blue hover:underline cursor-pointer"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
