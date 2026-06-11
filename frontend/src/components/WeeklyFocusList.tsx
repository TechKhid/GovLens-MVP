'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/RoleContext';

export interface WeeklyTask {
    id: string;
    text: string;
    completed: boolean;
    category: 'critical' | 'citizen' | 'briefing' | 'assigned' | 'custom';
}

const CATEGORY_STYLES: Record<WeeklyTask['category'], { label: string; badgeClass: string }> = {
    critical: { label: 'High Priority', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
    citizen: { label: 'Citizen Response', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    briefing: { label: 'Briefing / Policy', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
    assigned: { label: 'Staff Oversight', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    custom: { label: 'Action Item', badgeClass: 'bg-gray-50 text-gray-700 border-gray-200' },
};

export default function WeeklyFocusList() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<WeeklyTask[]>([]);
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskCategory, setNewTaskCategory] = useState<WeeklyTask['category']>('custom');
    const [isMounted, setIsMounted] = useState(false);

    const constituency = user?.constituency || 'Ayawaso West Wuogon';

    // Load tasks from localStorage on mount
    useEffect(() => {
        setIsMounted(true);
        const stored = localStorage.getItem('govlens_mp_weekly_tasks');
        if (stored) {
            try {
                setTasks(JSON.parse(stored));
            } catch {
                setTasks(getDefaultTasks(constituency));
            }
        } else {
            setTasks(getDefaultTasks(constituency));
        }
    }, [constituency]);

    // Save tasks to localStorage when modified
    useEffect(() => {
        if (!isMounted) return;
        localStorage.setItem('govlens_mp_weekly_tasks', JSON.stringify(tasks));
    }, [tasks, isMounted]);

    const getDefaultTasks = (constituencyName: string): WeeklyTask[] => [
        {
            id: '1',
            text: `Review critical sanitation and infrastructure issues in ${constituencyName}`,
            completed: false,
            category: 'critical',
        },
        {
            id: '2',
            text: 'Verify cases pending citizen validation and reach out to reporters',
            completed: false,
            category: 'citizen',
        },
        {
            id: '3',
            text: 'Ensure all newly reported road complaints have assigned staff members',
            completed: false,
            category: 'assigned',
        },
        {
            id: '4',
            text: 'Draft the weekly constituency progress briefing for public view',
            completed: false,
            category: 'briefing',
        },
        {
            id: '5',
            text: 'Follow up with local municipal engineers regarding drainage projects',
            completed: false,
            category: 'custom',
        },
    ];

    const toggleTask = (id: string) => {
        setTasks((prev) =>
            prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
        );
    };

    const addTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskText.trim()) return;

        const newTask: WeeklyTask = {
            id: Date.now().toString(),
            text: newTaskText.trim(),
            completed: false,
            category: newTaskCategory,
        };

        setTasks((prev) => [...prev, newTask]);
        setNewTaskText('');
        setNewTaskCategory('custom');
    };

    const deleteTask = (id: string) => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
    };

    const resetTasks = () => {
        if (confirm('Are you sure you want to reset the weekly focus list to default priorities?')) {
            setTasks(getDefaultTasks(constituency));
        }
    };

    if (!isMounted) {
        return (
            <div className="card p-5 animate-pulse bg-white">
                <div className="h-6 bg-background rounded w-1/4 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-10 bg-background rounded"></div>
                    <div className="h-10 bg-background rounded"></div>
                    <div className="h-10 bg-background rounded"></div>
                </div>
            </div>
        );
    }

    const completedCount = tasks.filter((t) => t.completed).length;
    const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

    return (
        <section className="card p-5 bg-[linear-gradient(135deg,#ffffff_0%,#fffefc_60%,#fbf9f4_100%)] shadow-[0_12px_36px_rgba(17,24,39,0.04)] border border-border rounded-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <h2 className="font-display text-lg font-bold text-primary-text">Weekly Focus & Actions</h2>
                    </div>
                    <p className="text-xs text-muted-text font-body mt-0.5">
                        Track priority outcomes and operational updates for {constituency}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <div className="text-sm font-semibold font-mono text-primary-text">
                            {completedCount}/{tasks.length} Done
                        </div>
                        <div className="text-[10px] text-muted-text font-mono font-medium uppercase tracking-wider">
                            Weekly progress
                        </div>
                    </div>
                    <div className="h-9 w-[1px] bg-border hidden md:block" />
                    <button
                        onClick={resetTasks}
                        className="text-xs text-muted-text hover:text-red-600 transition-colors font-body font-medium"
                        type="button"
                    >
                        Reset List
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
                <div className="w-full bg-background rounded-full h-2 overflow-hidden border border-border/40">
                    <div
                        className="bg-primary-text h-full transition-all duration-500 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Tasks List */}
            <div className="mt-5 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-border rounded-xl">
                        <p className="text-sm text-muted-text font-body">No weekly focus items set.</p>
                        <p className="text-xs text-muted-text font-body mt-1">Add a custom action below to get started.</p>
                    </div>
                ) : (
                    tasks.map((task) => {
                        const style = CATEGORY_STYLES[task.category];
                        return (
                            <div
                                key={task.id}
                                className={`group flex items-start justify-between gap-3 p-3 rounded-xl border transition-all ${
                                    task.completed
                                        ? 'bg-background/40 border-border/50 opacity-60'
                                        : 'bg-white border-border hover:shadow-[0_4px_16px_rgba(17,24,39,0.02)] hover:border-border/80'
                                }`}
                            >
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <input
                                        type="checkbox"
                                        checked={task.completed}
                                        onChange={() => toggleTask(task.id)}
                                        className="mt-1 h-4 w-4 rounded border-border text-primary-text focus:ring-primary-text cursor-pointer"
                                        aria-label={`Mark task as ${task.completed ? 'incomplete' : 'complete'}`}
                                    />
                                    <div className="min-w-0">
                                        <p
                                            className={`text-sm font-body text-primary-text leading-relaxed break-words ${
                                                task.completed ? 'line-through text-muted-text' : ''
                                            }`}
                                        >
                                            {task.text}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-2">
                                            <span
                                                className={`pill rounded-full text-[10px] py-0.5 px-2 border font-mono tracking-normal uppercase ${style.badgeClass}`}
                                            >
                                                {style.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteTask(task.id)}
                                    className="text-muted-text hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 p-1 self-start"
                                    title="Delete task"
                                    type="button"
                                    aria-label="Delete focus item"
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Add task form */}
            <form onSubmit={addTask} className="mt-5 pt-4 border-t border-border flex flex-col md:flex-row gap-2">
                <input
                    type="text"
                    placeholder="Add a new weekly priority or action item..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    className="flex-1 input-field rounded-xl px-3.5 py-2 text-sm focus:ring-1 focus:ring-primary-text outline-none"
                    aria-label="New Task text"
                />
                <div className="flex gap-2">
                    <select
                        value={newTaskCategory}
                        onChange={(e) => setNewTaskCategory(e.target.value as WeeklyTask['category'])}
                        className="input-field rounded-xl px-3 py-2 text-xs bg-white border border-border cursor-pointer focus:ring-1 focus:ring-primary-text outline-none min-w-[120px]"
                        aria-label="New Task Category"
                    >
                        {Object.entries(CATEGORY_STYLES).map(([key, value]) => (
                            <option key={key} value={key}>
                                {value.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        className="btn-primary rounded-xl px-4 py-2 font-medium text-xs tracking-wide uppercase shrink-0"
                    >
                        Add Item
                    </button>
                </div>
            </form>
        </section>
    );
}
