'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Sector, SECTORS, SECTOR_COLORS, Issue } from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import { useAuth } from '@/context/RoleContext';
import { getConstituencyCenter } from '@/lib/constituency-centers';
import { getZoneOptionsForConstituency } from '@/lib/geo-scope';
import { api } from '@/lib/api';
import { findSimilarIssues, SimilarIssueHint } from '@/lib/issueIntelligence';

const PinLocationMap = dynamic(() => import('./PinLocationMap'), {
    ssr: false,
    loading: () => <div className="w-full h-[180px] bg-background rounded border border-border animate-pulse" />,
});

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface PhotoUpload {
    file: File;
    previewUrl: string;
}

interface ClassificationResponse {
    sector: string;
    severity: string;
    sector_scores?: Record<string, number>;
}

// Ghana center — overridden by constituency on open
const GHANA_LAT = 7.9465;
const GHANA_LNG = -1.0232;

export default function ReportModal({ isOpen, onClose }: ReportModalProps) {
    const { addIssue, issues } = useDataStore();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [title, setTitle] = useState('');
    const [sector, setSector] = useState<Sector | null>(null);
    const [suggestedSector, setSuggestedSector] = useState<Sector | null>(null);
    const [suggestedConfidence, setSuggestedConfidence] = useState<number | null>(null);
    const [suggestedSeverity, setSuggestedSeverity] = useState<Issue['severity']>('Medium');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
    const [zone, setZone] = useState('');
    const [customZone, setCustomZone] = useState('');
    const [pinLat, setPinLat] = useState(GHANA_LAT);
    const [pinLng, setPinLng] = useState(GHANA_LNG);

    // Zones available for this user's constituency (Title Case display labels).
    const zoneOptions = useMemo(
        () => getZoneOptionsForConstituency(user?.constituency),
        [user?.constituency]
    );
    // The effective zone value sent to the API
    const effectiveZone = zone === '__other__' ? customZone : zone;
    const [photoUploads, setPhotoUploads] = useState<PhotoUpload[]>([]);
    const [photoError, setPhotoError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [classificationLoading, setClassificationLoading] = useState(false);
    const [classificationError, setClassificationError] = useState('');
    const similarIssueHints = useMemo(() => findSimilarIssues(issues, {
        title,
        description,
        address,
        zone,
        sector: sector ?? suggestedSector,
    }), [address, description, issues, sector, suggestedSector, title, zone]);

    // Fly map pin to the user's constituency center when the modal opens
    useEffect(() => {
        if (!isOpen || !user?.constituency) return;
        const entry = getConstituencyCenter(user.constituency);
        if (entry) {
            setPinLat(entry.lat);
            setPinLng(entry.lng);
        }
    }, [isOpen, user?.constituency]);

    if (!isOpen) return null;

    const totalSteps = 4;
    const progress = (step / totalSteps) * 100;

    const canProceed = () => {
        switch (step) {
            case 1: return title.trim() !== '';
            case 2: return address.trim() !== '';
            case 3: return true; // Photos are optional
            default: return true;
        }
    };

    const classifyDraft = async () => {
        if (!title.trim()) return;

        setClassificationLoading(true);
        setClassificationError('');
        try {
            const result = await api.post<ClassificationResponse>('/ml/classify', {
                title: title.trim(),
                description: description.trim(),
            });

            const normalizedSector = SECTORS.find(
                (option) => option.toLowerCase() === String(result.sector).toLowerCase()
            ) ?? 'Other';
            const normalizedSeverity = (['Low', 'Medium', 'High', 'Critical'] as const).find(
                (option) => option.toLowerCase() === String(result.severity).toLowerCase()
            ) ?? 'Medium';

            setSuggestedSector(normalizedSector);
            setSuggestedSeverity(normalizedSeverity);
            setSector((current) => current ?? normalizedSector);
            setSuggestedConfidence(
                result.sector_scores?.[String(result.sector).toLowerCase()] ?? null
            );
        } catch (err) {
            setClassificationError(err instanceof Error ? err.message : 'AI classification unavailable right now.');
            setSuggestedSector(null);
            setSuggestedConfidence(null);
        } finally {
            setClassificationLoading(false);
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
        const nextUploads: PhotoUpload[] = [];
        let nextError = '';

        for (const file of Array.from(files)) {
            if (!allowedTypes.has(file.type)) {
                nextError = 'Use JPG, PNG, or WebP images only.';
                continue;
            }
            if (file.size > 10 * 1024 * 1024) {
                nextError = 'Each image must be 10MB or smaller.';
                continue;
            }
            nextUploads.push({
                file,
                previewUrl: URL.createObjectURL(file),
            });
        }

        setPhotoUploads((prev) => {
            const merged = [...prev, ...nextUploads];
            if (merged.length > 6) {
                nextError = 'You can upload up to 6 images per report.';
            }
            const limited = merged.slice(0, 6);
            merged.slice(6).forEach((upload) => URL.revokeObjectURL(upload.previewUrl));
            return limited;
        });
        setPhotoError(nextError);
        e.target.value = '';
    };

    const removePhoto = (index: number) => {
        setPhotoUploads((prev) => {
            const target = prev[index];
            if (target) {
                URL.revokeObjectURL(target.previewUrl);
            }
            return prev.filter((_, i) => i !== index);
        });
        setPhotoError('');
    };

    const handlePinChange = (lat: number, lng: number) => {
        setPinLat(lat);
        setPinLng(lng);
    };

    const clearPhotoUploads = () => {
        photoUploads.forEach((upload) => URL.revokeObjectURL(upload.previewUrl));
        setPhotoUploads([]);
        setPhotoError('');
    };

    const resetAndClose = () => {
        setStep(1);
        setTitle('');
        setSector(null);
        setSuggestedSector(null);
        setSuggestedConfidence(null);
        setSuggestedSeverity('Medium');
        setDescription('');
        setAddress('');
        setZone('');
        setCustomZone('');
        clearPhotoUploads();
        setSubmitting(false);
        setClassificationLoading(false);
        setClassificationError('');
        // Reset to constituency center (or Ghana center if unknown)
        const entry = user?.constituency ? getConstituencyCenter(user.constituency) : null;
        setPinLat(entry?.lat ?? GHANA_LAT);
        setPinLng(entry?.lng ?? GHANA_LNG);
        onClose();
    };

    const handleContinue = async () => {
        if (step === 1) {
            await classifyDraft();
            setStep(2);
            return;
        }

        if (step !== 3) {
            setStep(step + 1);
            return;
        }

        const now = new Date().toISOString();
        setSubmitting(true);
        setPhotoError('');

        try {
            await addIssue({
                title,
                description: description || title,
                sector: sector ?? suggestedSector ?? 'Other',
                zone: effectiveZone || user?.constituency || '',
                status: 'Reported',
                severity: suggestedSeverity,
                reporter: { name: 'You', avatar: 'YO' },
                photos: [],
                photoFiles: photoUploads.map((upload) => upload.file),
                location: {
                    address: address || user?.constituency || '',
                    gps: { lat: pinLat, lng: pinLng },
                },
                submittedAt: now,
                upvotes: 0,
                comments: [],
                affectedResidents: 0,
                timeline: [
                    { status: 'Reported', date: now },
                ],
            });
            setStep(4);
        } catch (err) {
            setPhotoError(err instanceof Error ? err.message : 'Failed to submit report.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-40" onClick={resetAndClose} />

            {/* Modal */}
            <div className="relative bg-white w-full max-w-[560px] max-h-[90vh] overflow-y-auto mx-4 border border-border">
                {/* Progress bar */}
                <div className="h-1 bg-background">
                    <div
                        className="h-full bg-primary-text transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        {step > 1 && step < 4 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="text-muted-text hover:text-primary-text cursor-pointer text-sm"
                            >
                                ← Back
                            </button>
                        )}
                        <h3 className="font-display text-lg font-semibold">
                            {step === 4 ? 'Report Submitted' : 'Report an Issue'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-text">
                            {step}/{totalSteps}
                        </span>
                        <button
                            onClick={resetAndClose}
                            className="text-muted-text hover:text-primary-text cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5">

                    {/* ── Step 1: Issue Details ─────────── */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div>
                                <label className="section-label block mb-1.5">Title *</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Briefly describe the issue"
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label className="section-label block mb-2">AI-Suggested Sector</label>
                                <div className="mb-3 p-3 border border-border rounded bg-background">
                                    {classificationLoading ? (
                                        <p className="text-sm font-body text-muted-text">
                                            Classifying your issue...
                                        </p>
                                    ) : suggestedSector ? (
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-body font-medium text-primary-text">
                                                    {suggestedSector}
                                                </p>
                                                <p className="text-xs text-muted-text font-body mt-1">
                                                    Severity: {suggestedSeverity}
                                                    {suggestedConfidence !== null
                                                        ? ` · confidence ${Math.round(suggestedConfidence * 100)}%`
                                                        : ''}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void classifyDraft()}
                                                className="text-xs font-body text-primary-text hover:underline"
                                            >
                                                Refresh AI
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-body text-muted-text">
                                                GovLens will classify this issue automatically before submission.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => void classifyDraft()}
                                                className="text-xs font-body text-primary-text hover:underline"
                                            >
                                                Run AI now
                                            </button>
                                        </div>
                                    )}
                                    {classificationError && (
                                        <p className="text-xs text-status-urgent font-body mt-2">
                                            {classificationError}
                                        </p>
                                    )}
                                </div>

                                <label className="section-label block mb-2">Review or Override</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {SECTORS.map((s) => {
                                        const isSelected = sector === s;
                                        const color = SECTOR_COLORS[s];
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => setSector(s)}
                                                className={`flex items-center gap-2 px-3 py-2.5 border text-sm font-body cursor-pointer transition-all ${isSelected
                                                    ? 'bg-primary-text text-white'
                                                    : 'bg-white text-primary-text border-border hover:bg-background'
                                                    }`}
                                                style={isSelected ? { borderColor: color } : {}}
                                            >
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: isSelected ? 'white' : color }}
                                                />
                                                {s}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="section-label block mb-1.5">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="When did it start? Who is affected? Any relevant context?"
                                    className="textarea-field h-24"
                                />
                            </div>

                            <SimilarIssueHints hints={similarIssueHints} />
                        </div>
                    )}

                    {/* ── Step 2: Location ─────────────── */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div>
                                <label className="section-label block mb-1.5">Address *</label>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Street name, landmark, or area description"
                                    className="input-field"
                                />
                            </div>

                            <div>
                                <label className="section-label block mb-1.5">
                                    Area / Zone <span className="text-muted-text font-normal">(optional)</span>
                                </label>
                                {zoneOptions.length > 0 ? (
                                    <>
                                        <select
                                            value={zone}
                                            onChange={(e) => {
                                                setZone(e.target.value);
                                                if (e.target.value !== '__other__') setCustomZone('');
                                            }}
                                            title="Zone / area within your constituency"
                                            className="input-field bg-white"
                                        >
                                            <option value="">Select your area (optional)</option>
                                            {zoneOptions.map((z) => (
                                                <option key={z} value={z}>{z}</option>
                                            ))}
                                            <option value="__other__">Other / Not listed…</option>
                                        </select>
                                        {zone === '__other__' && (
                                            <input
                                                type="text"
                                                value={customZone}
                                                onChange={(e) => setCustomZone(e.target.value)}
                                                placeholder="Type your neighbourhood or landmark"
                                                className="input-field mt-2"
                                            />
                                        )}
                                    </>
                                ) : (
                                    <input
                                        type="text"
                                        value={zone}
                                        onChange={(e) => setZone(e.target.value)}
                                        placeholder="e.g. Market Area, Community Centre…"
                                        className="input-field"
                                    />
                                )}
                                <p className="text-[10px] text-muted-text font-body mt-1">
                                    Selecting a known area helps route your report to the right MP.
                                </p>
                            </div>

                            <SimilarIssueHints hints={similarIssueHints} />

                            <div>
                                <label className="section-label block mb-2">Pin Location</label>
                                <PinLocationMap
                                    lat={pinLat}
                                    lng={pinLng}
                                    onPinChange={handlePinChange}
                                    height={180}
                                />
                                <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-[10px] text-muted-text font-body">Tap or drag pin to set location</span>
                                    <span className="text-[10px] font-mono text-muted-text">
                                        {pinLat.toFixed(4)}°N, {Math.abs(pinLng).toFixed(4)}°W
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Photos ───────────────── */}
                    {step === 3 && (
                        <div className="space-y-5">
                            <div>
                                <label className="section-label block mb-2">Upload Photos</label>
                                <label className="block w-full border-2 border-dashed border-border rounded p-8 text-center cursor-pointer hover:bg-white transition-colors">
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        multiple
                                        onChange={handlePhotoUpload}
                                        className="hidden"
                                    />
                                    <div className="text-muted-text">
                                        <div className="text-2xl mb-2 opacity-40">📷</div>
                                        <p className="text-sm font-body">Drag and drop JPG, PNG, or WebP photos here</p>
                                        <p className="text-xs font-body mt-1">or click to browse · up to 6 images · max 10MB each</p>
                                    </div>
                                </label>
                            </div>

                            {photoUploads.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {photoUploads.map((photo, i) => (
                                        <div key={i} className="relative aspect-square rounded border border-border overflow-hidden">
                                            {/* Blob previews are not compatible with Next image optimization. */}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={photo.previewUrl} alt="" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => removePhoto(i)}
                                                className="absolute top-1 right-1 w-5 h-5 bg-black bg-opacity-60 text-white text-[10px] flex items-center justify-center rounded-full cursor-pointer"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {photoError && (
                                <p className="text-xs text-status-urgent font-body">{photoError}</p>
                            )}

                            <p className="text-xs text-muted-text font-body">
                                Photos speed up verification and prioritisation by the MP office. This step is optional.
                            </p>
                        </div>
                    )}

                    {/* ── Step 4: Confirmation ─────────── */}
                    {step === 4 && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-status-resolved bg-opacity-10 flex items-center justify-center">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2.5">
                                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>

                            <h3 className="font-display text-xl font-bold mb-3">Report Submitted</h3>

                            {/* Summary card */}
                            <div className="card p-4 text-left mb-4">
                                <p className="text-sm font-body font-medium mb-1">{title}</p>
                                <div className="flex items-center gap-2">
                                    {(sector ?? suggestedSector) && (
                                        <span className="pill bg-background">
                                            <span
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: SECTOR_COLORS[(sector ?? suggestedSector)!] }}
                                            />
                                            {sector ?? suggestedSector}
                                        </span>
                                    )}
                                    {effectiveZone && (
                                        <span className="text-xs text-muted-text font-body">{effectiveZone}</span>
                                    )}
                                </div>
                            </div>

                            <p className="text-sm text-muted-text font-body leading-relaxed max-w-sm mx-auto">
                                Your report is logged and will be reviewed by the MP office. You will be notified when its status changes.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border">
                    {step < 4 ? (
                        <button
                            onClick={handleContinue}
                            disabled={!canProceed() || submitting}
                            className={`btn-primary w-full ${!canProceed() || submitting ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            {step === 3 ? (submitting ? 'Submitting...' : 'Submit Report') : 'Continue'}
                        </button>
                    ) : (
                        <button
                            onClick={resetAndClose}
                            className="btn-primary w-full"
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function SimilarIssueHints({ hints }: { hints: SimilarIssueHint[] }) {
    if (hints.length === 0) return null;

    return (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <p className="text-sm font-body font-medium text-primary-text">
                        Similar issues already reported
                    </p>
                    <p className="text-xs text-muted-text font-body mt-1">
                        GovLens found nearby reports with overlapping wording or routing. You can still submit if your case adds new evidence, a new location, or a more urgent update.
                    </p>
                </div>
                <span className="pill text-[10px] bg-white text-amber-700 border border-amber-200">
                    AI hint
                </span>
            </div>

            <div className="space-y-2">
                {hints.map((hint) => (
                    <div key={hint.issue.id} className="rounded border border-white bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-body font-medium text-primary-text">
                                {hint.issue.title}
                            </p>
                            <span className="text-[10px] font-mono text-amber-700">
                                {hint.label}
                            </span>
                        </div>
                        <p className="text-xs text-muted-text font-body mt-1">
                            {hint.issue.zone || 'Unspecified zone'} - {hint.issue.status}
                        </p>
                        {hint.reason && (
                            <p className="text-[10px] text-muted-text font-body mt-1">
                                {hint.reason}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
