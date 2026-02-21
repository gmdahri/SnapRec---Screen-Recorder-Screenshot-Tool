import React from 'react';
import { useEditor } from '../context/EditorContext';

export const CanvasArea: React.FC = () => {
    const {
        canvasRef, isCropping, capturedImage, zoomLevel,
        handleSetZoom, initCanvas, handleCropConfirm, handleCropCancel,
        isInitializing
    } = useEditor();

    return (
        <section className="flex-1 bg-background-light dark:bg-background-dark p-12 overflow-auto relative canvas-bg">
            <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-full">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative bg-white dark:bg-[#1c142b] rounded-lg shadow-2xl border border-[#ece7f4] dark:border-[#2d2245] min-h-[400px] min-w-[400px] overflow-hidden">
                        <canvas ref={canvasRef} />
                        {isCropping && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 bg-white dark:bg-[#1c142b] p-2 rounded-xl shadow-2xl border border-primary z-30">
                                <button
                                    onClick={handleCropConfirm}
                                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[18px]">check</span>
                                    Confirm Crop
                                </button>
                                <button
                                    onClick={handleCropCancel}
                                    className="px-4 py-2 bg-[#ece7f4] dark:bg-[#2d2245] rounded-lg text-sm font-bold flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                    Cancel
                                </button>
                            </div>
                        )}
                        {!capturedImage && !isInitializing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-50 bg-background-light dark:bg-background-dark">
                                <span className="material-symbols-outlined text-6xl">image_not_supported</span>
                                <p className="font-medium">Waiting for image from extension...</p>
                            </div>
                        )}
                        {isInitializing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background-light/50 dark:bg-background-dark/50 backdrop-blur-sm z-40">
                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <p className="font-bold text-primary">Loading screenshot...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Zoom Controls */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white dark:bg-[#1c142b] border border-[#ece7f4] dark:border-[#2d2245] px-4 py-2 rounded-full shadow-xl flex items-center gap-4 z-20">
                <button
                    onClick={() => handleSetZoom(zoomLevel - 0.1)}
                    className="p-1 hover:bg-[#ece7f4] dark:hover:bg-[#2d2245] rounded-full cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[20px]">remove</span>
                </button>
                <span className="text-xs font-bold w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <button
                    onClick={() => handleSetZoom(zoomLevel + 0.1)}
                    className="p-1 hover:bg-[#ece7f4] dark:hover:bg-[#2d2245] rounded-full cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
                <div className="h-4 w-[1px] bg-[#ece7f4] dark:bg-[#2d2245]"></div>
                <button
                    onClick={() => {
                        if (capturedImage) initCanvas(capturedImage);
                    }}
                    className="p-1 hover:bg-[#ece7f4] dark:hover:bg-[#2d2245] rounded-full cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[20px]">fullscreen</span>
                </button>
            </div>
        </section>
    );
};
