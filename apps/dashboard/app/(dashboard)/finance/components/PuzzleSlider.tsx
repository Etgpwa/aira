'use client';

import { useState, useRef, useEffect } from 'react';

interface PuzzleSliderProps {
    onSuccess: () => void;
    onReset?: () => void;
}

export default function PuzzleSlider({ onSuccess, onReset }: PuzzleSliderProps) {
    const [sliderValue, setSliderValue] = useState(0);
    const [isVerified, setIsVerified] = useState(false);
    const [targetPosition, setTargetPosition] = useState(0);
    const trackRef = useRef<HTMLDivElement>(null);

    // Randomize target position between 40% and 80% on mount
    useEffect(() => {
        setTargetPosition(Math.floor(Math.random() * 40) + 40);
        setIsVerified(false);
        setSliderValue(0);
    }, [onReset]);

    const handleRelease = () => {
        if (isVerified) return;
        
        // Cek toleransi +- 5%
        if (Math.abs(sliderValue - targetPosition) < 5) {
            setIsVerified(true);
            setSliderValue(targetPosition); // Snap to target
            onSuccess();
        } else {
            // Kembali ke 0 jika gagal
            setSliderValue(0);
        }
    };

    return (
        <div className="w-full flex flex-col items-center gap-4">
            <div className="w-full h-24 bg-surface-container-high rounded-xl relative overflow-hidden border border-surface-variant flex items-center shadow-inner">
                {/* Background Pattern (Static) */}
                <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
                    backgroundSize: '12px 12px'
                }}></div>
                
                {/* Target Hole */}
                <div 
                    className="absolute h-12 w-12 rounded-lg bg-black/40 border-2 border-dashed border-white/30 shadow-inner flex items-center justify-center"
                    style={{ left: `calc(${targetPosition}% - 24px)` }}
                >
                    <div className="w-4 h-4 bg-white/10 rounded-full"></div>
                </div>

                {/* Sliding Piece */}
                <div 
                    className={`absolute h-12 w-12 rounded-lg flex items-center justify-center cursor-pointer shadow-lg z-10 transition-colors ${isVerified ? 'bg-mint-bg border-2 border-mint-fg' : 'bg-primary border-2 border-primary-container backdrop-blur-md'}`}
                    style={{ 
                        left: `calc(${sliderValue}% - 24px)`, 
                        transition: sliderValue === 0 && !isVerified ? 'left 0.3s ease-out' : 'none'
                    }}
                >
                     <div className="w-4 h-4 bg-white/50 rounded-full"></div>
                </div>
            </div>

            {/* Slider Track */}
            <div className="w-full relative px-6" ref={trackRef}>
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={sliderValue}
                    disabled={isVerified}
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                    onMouseUp={handleRelease}
                    onTouchEnd={handleRelease}
                    className="w-full h-12 opacity-0 cursor-pointer absolute inset-0 z-20"
                />
                
                {/* Visual Track */}
                <div className="w-full h-12 bg-surface-container rounded-full border border-surface-variant flex items-center relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-primary/20" style={{ width: `${sliderValue}%`, transition: sliderValue === 0 ? 'width 0.3s ease-out' : 'none' }}></div>
                    <div 
                        className={`h-10 w-12 absolute left-1 rounded-full flex items-center justify-center shadow-sm text-on-primary pointer-events-none ${isVerified ? 'bg-mint-fg' : 'bg-primary'}`}
                        style={{ 
                            left: `calc(${sliderValue}% * (1 - 56px / 100%) + 4px)`, 
                            transition: sliderValue === 0 && !isVerified ? 'left 0.3s ease-out' : 'none' 
                        }}
                    >
                        {isVerified ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        )}
                    </div>
                    <span className="w-full text-center text-xs font-bold text-secondary pointer-events-none select-none">
                        {isVerified ? 'Terverifikasi' : 'Geser puzzle ke tempatnya'}
                    </span>
                </div>
            </div>
        </div>
    );
}
