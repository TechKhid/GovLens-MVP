'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Sector, SECTORS, SECTOR_COLORS, Issue } from '@/lib/mockData';
import { useDataStore } from '@/context/DataStoreContext';
import { useAuth } from '@/context/RoleContext';
import { getConstituencyCenter } from '@/lib/constituency-centers';

const PinLocationMap = dynamic(() => import('./PinLocationMap'), {
    ssr: false,
    loading: () => <div className="w-full h-[180px] bg-background rounded border border-border animate-pulse" />,
});

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Ghana center — overridden by constituency on open
const GHANA_LAT = 7.9465;
const GHANA_LNG = -1.0232;

export default function ReportModal({ isOpen, onClose }: ReportModalProps) {
    const { addIssue } = useDataStore();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [title, setTitle] = useState('');
    const [sector, setSector] = useState<Sector | null>(null);
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
    const [zone, setZone] = useState('');
    const [pinLat, setPinLat] = useState(GHANA_LAT);
    const [pinLng, setPinLng] = useState(GHANA_LNG);
    const [photos, setPhotos] = useState<string[]>([]);

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
            case 1: return title.trim() !== '' && sector !== null;
            case 2: return address.trim() !== '';
            case 3: return true; // Photos are optional
            default: return true;
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const newPhotos = Array.from(files).map((f) => URL.createObjectURL(f));
        setPhotos((prev) => [...prev, ...newPhotos].slice(0, 6));
    };

    const removePhoto = (index: number) => {
        setPhotos((prev) => prev.filter((_, i) => i !== index));
    };

    const handlePinChange = (lat: number, lng: number) => {
        setPinLat(lat);
        setPinLng(lng);
    };

    const resetAndClose = () => {
        setStep(1);
        setTitle('');
        setSector(null);
        setDescription('');
        setAddress('');
        setZone('');
        setPhotos([]);
        // Reset to constituency center (or Ghana center if unknown)
        const entry = user?.constituency ? getConstituencyCenter(user.constituency) : null;
        setPinLat(entry?.lat ?? GHANA_LAT);
        setPinLng(entry?.lng ?? GHANA_LNG);
        onClose();
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
                                <label className="section-label block mb-2">Sector *</label>
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
                                <label className="section-label block mb-1.5">Zone / Area <span className="text-muted-text font-normal">(optional)</span></label>
                                <input
                                    type="text"
                                    value={zone}
                                    onChange={(e) => setZone(e.target.value)}
                                    placeholder="e.g. Nkonya Ahenkro, Market Area…"
                                    className="input-field"
                                />
                                <p className="text-[10px] text-muted-text font-body mt-1">Enter any local area, neighbourhood or landmark name</p>
                            </div>

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
                                        accept="image/jpeg,image/png,image/heic"
                                        multiple
                                        onChange={handlePhotoUpload}
                                        className="hidden"
                                    />
                                    <div className="text-muted-text">
                                        <div className="text-2xl mb-2 opacity-40">📷</div>
                                        <p className="text-sm font-body">Drag and drop photos here</p>
                                        <p className="text-xs font-body mt-1">or click to browse · JPG, PNG, HEIC · max 10MB each</p>
                                    </div>
                                </label>
                            </div>

                            {photos.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {photos.map((photo, i) => (
                                        <div key={i} className="relative aspect-square rounded border border-border overflow-hidden">
                                            <img src={photo} alt="" className="w-full h-full object-cover" />
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
                                    {sector && (
                                        <span className="pill bg-background">
                                            <span
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: SECTOR_COLORS[sector] }}
                                            />
                                            {sector}
                                        </span>
                                    )}
                                    {zone && (
                                        <span className="text-xs text-muted-text font-body">{zone}</span>
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
                            onClick={() => {
                                if (step === 3) {
                                    // Build and submit the issue
                                    const now = new Date().toISOString();
                                    addIssue({
                                        title,
                                        description: description || title,
                                        sector: sector!,
                                        zone: zone || user?.constituency || '',
                                        status: 'Reported',
                                        severity: 'Medium',
                                        reporter: { name: 'You', avatar: 'YO' },
                                        photos,
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
                                }
                                setStep(step + 1);
                            }}
                            disabled={!canProceed()}
                            className={`btn-primary w-full ${!canProceed() ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            {step === 3 ? 'Submit Report' : 'Continue'}
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
