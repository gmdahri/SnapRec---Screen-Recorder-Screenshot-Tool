import React, { useState, useRef, useEffect } from 'react';

interface VideoPlayerProps {
    src?: string;
    isProcessing?: boolean;
    isReady?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    src,
    isProcessing,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const controlsTimeoutRef = useRef<any>(null);

    const togglePlay = () => {
        if (!videoRef.current || isProcessing) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
        } else {
            videoRef.current.pause();
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            const d = videoRef.current.duration;
            if (isFinite(d)) {
                setDuration(d);
            } else if (d === Infinity) {
                // Trick for WebM blobs: seek to end to force duration calculation
                videoRef.current.currentTime = 1e10;
            }
        }
    };

    const handleDurationChange = () => {
        if (videoRef.current) {
            const d = videoRef.current.duration;
            if (isFinite(d)) {
                setDuration(d);
                if (videoRef.current.currentTime > 0 && !isPlaying) {
                    videoRef.current.currentTime = 0;
                }
            }
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!videoRef.current || isProcessing) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        setVolume(value);
        if (videoRef.current) {
            videoRef.current.volume = value;
            setIsMuted(value === 0);
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            const newMuted = !isMuted;
            videoRef.current.muted = newMuted;
            setIsMuted(newMuted);
            if (!newMuted && volume === 0) {
                setVolume(0.5);
                videoRef.current.volume = 0.5;
            }
        }
    };

    const handleSpeedChange = (speed: number) => {
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
            setPlaybackSpeed(speed);
            setShowSpeedMenu(false);
        }
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying && !showSpeedMenu) setShowControls(false);
        }, 3000);
    };

    const formatTime = (time: number) => {
        if (isNaN(time) || !isFinite(time)) return '--:--';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const skip = (seconds: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime += seconds;
        }
    };

    useEffect(() => {
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (src && videoRef.current && !isProcessing) {
            videoRef.current.load();
            setIsPlaying(false);

            // Fallback polling for duration if metadata event is slow
            let pollCount = 0;
            const pollDuration = setInterval(() => {
                if (videoRef.current && isFinite(videoRef.current.duration)) {
                    setDuration(videoRef.current.duration);
                    clearInterval(pollDuration);
                }
                pollCount++;
                if (pollCount > 10) clearInterval(pollDuration); // Stop after 10 attempts
            }, 500);

            return () => clearInterval(pollDuration);
        }
    }, [src, isProcessing]);

    return (
        <div
            className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && !showSpeedMenu && setShowControls(false)}
        >
            <video
                ref={videoRef}
                src={src}
                className={`w-full h-full object-contain transition-opacity duration-500 ${isProcessing ? 'opacity-30' : 'opacity-100'}`}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onDurationChange={handleDurationChange}
                onCanPlay={handleDurationChange}
                onClick={togglePlay}
                playsInline
                preload="auto"
                muted={isMuted}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            {/* Large Center Play Button */}
            {!isPlaying && !isProcessing && src && (
                <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                    <button
                        className="size-20 bg-primary/90 backdrop-blur-sm flex items-center justify-center rounded-full shadow-[0_0_30px_rgba(124,58,237,0.5)] border border-white/20 transition-transform duration-300 hover:scale-110 pointer-events-auto"
                        onClick={togglePlay}
                    >
                        <span className="material-symbols-outlined text-white text-5xl">play_arrow</span>
                    </button>
                </div>
            )}

            {/* Controls Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 z-30 flex flex-col justify-end p-4 pt-20 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

                {/* Progress Bar Container */}
                <div
                    className="group/progress relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-5 transition-all hover:h-2"
                    onClick={handleSeek}
                >
                    <div
                        className="absolute h-full bg-primary rounded-full transition-all pointer-events-none"
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 size-3.5 bg-white rounded-full shadow-lg scale-0 group-hover/progress:scale-100 transition-transform pointer-events-none" />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => skip(-10)} className="text-white/80 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-2xl">replay_10</span>
                        </button>

                        <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform flex items-center bg-white/10 p-2 rounded-full backdrop-blur-md">
                            <span className="material-symbols-outlined text-3xl">
                                {isPlaying ? 'pause' : 'play_arrow'}
                            </span>
                        </button>

                        <button onClick={() => skip(10)} className="text-white/80 hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-2xl">forward_10</span>
                        </button>

                        <span className="text-white/90 text-sm font-semibold tabular-nums ml-2 bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                            {formatTime(currentTime)} <span className="text-white/40 mx-1">/</span> {duration > 0 ? formatTime(duration) : '--:--'}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Speed Control */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                className="text-white/80 hover:text-white font-bold text-sm bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md transition-all border border-white/5 hover:border-white/20"
                            >
                                {playbackSpeed}x
                            </button>
                            {showSpeedMenu && (
                                <div className="absolute bottom-full mb-2 right-0 bg-[#1a1325]/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[100px] py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                                        <button
                                            key={speed}
                                            onClick={() => handleSpeedChange(speed)}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-primary/20 ${playbackSpeed === speed ? 'text-primary font-bold bg-primary/10' : 'text-white/70'}`}
                                        >
                                            {speed}x
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Volume Control */}
                        <div className="flex items-center gap-2 group/volume relative">
                            <button onClick={toggleMute} className="text-white/80 hover:text-white transition-colors relative z-10">
                                <span className="material-symbols-outlined text-2xl">
                                    {isMuted || volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                                </span>
                            </button>
                            <div className="w-0 group-hover/volume:w-24 overflow-hidden transition-all duration-300 h-8 flex items-center pr-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={volume}
                                    onChange={handleVolumeChange}
                                    className="w-24 h-1 accent-primary cursor-pointer opacity-0 group-hover/volume:opacity-100 transition-opacity duration-300"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => videoRef.current?.requestFullscreen()}
                            className="text-white/80 hover:text-white hover:scale-110 transition-transform"
                        >
                            <span className="material-symbols-outlined text-2xl">fullscreen</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Processing Overlay */}
            {isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md transition-all z-40">
                    <div className="relative">
                        <div className="size-20 border-4 border-primary/20 rounded-full animate-pulse shadow-[0_0_40px_rgba(124,58,237,0.2)]"></div>
                        <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin"></div>
                    </div>
                    <div className="flex flex-col items-center text-center px-6 mt-8">
                        <h3 className="text-white text-2xl font-black mb-3 tracking-tight">Polishing your video</h3>
                        <p className="text-white/60 text-base max-w-[320px] leading-relaxed">
                            Hang tight! We're making sure your recording looks perfect for everyone.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

