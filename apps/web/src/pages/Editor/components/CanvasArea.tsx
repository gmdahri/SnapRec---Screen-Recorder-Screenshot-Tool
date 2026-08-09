import React from 'react';
import { useEditor } from '../context/EditorContext';

/** The canvas sits in a well, not on paper.
 *
 * There was a floating "SnapRec is free for your whole team" pill pinned over
 * the canvas here, plus a violet glow around the artboard. Both are gone: an
 * editor is a Technical workspace, and an install ad covering the work is the
 * one thing it must not do. The purple was left from before the plate palette
 * — the accent here is cyan, and only on focus. */
export const CanvasArea: React.FC = () => {
    const {
        canvasRef, isCropping, capturedImage, zoomLevel,
        handleSetZoom, initCanvas, handleCropConfirm, handleCropCancel,
        isInitializing
    } = useEditor();

    return (
        <section className="flex-1 min-w-0 bg-[var(--sr-surface-well)] overflow-auto relative flex flex-col">
            <div className="flex-1 px-12 pt-10 pb-12 overflow-auto">
                <div className="max-w-5xl mx-auto flex flex-col items-center pb-24 min-h-full">
                    {/* Media: radius 0, no glow. The border is the frame. */}
                    <div
                        style={{ contain: 'layout' }}
                        className={`relative bg-[var(--sr-surface-panel-dark)] border border-[var(--sr-border-dark)] shadow-[0_2px_24px_var(--sr-scrim-dark)] min-h-[400px] min-w-[400px] overflow-hidden transition-opacity duration-300 ${isInitializing ? 'opacity-0' : 'opacity-100'}`}
                    >
                        <canvas ref={canvasRef} />

                        {isCropping && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 bg-[var(--sr-surface-panel-dark)] border border-[var(--sr-border-dark-strong)] p-2 rounded-[2px] shadow-2xl z-30">
                                <button
                                    onClick={handleCropConfirm}
                                    className="h-[30px] px-3 bg-[var(--sr-cyan)] text-white rounded-[2px] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[16px]">check</span>
                                    Confirm crop
                                </button>
                                <button
                                    onClick={handleCropCancel}
                                    className="h-[30px] px-3 border border-[var(--sr-border-dark)] text-[var(--sr-text-secondary-on-dark)] rounded-[2px] text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:text-[var(--sr-text-primary-on-dark)]"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {!capturedImage && !isInitializing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--sr-surface-panel-dark)] text-[var(--sr-text-faint-on-dark)]">
                                <span className="material-symbols-outlined text-5xl">image_not_supported</span>
                                <p className="text-[13px]">Waiting for an image from the extension</p>
                            </div>
                        )}
                    </div>
                </div>

                {isInitializing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-40 bg-[var(--sr-surface-well)]/70 backdrop-blur-sm">
                        <div className="w-8 h-8 border-2 border-[var(--sr-cyan)] border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[13px] text-[var(--sr-text-secondary-on-dark)]">Loading screenshot…</p>
                    </div>
                )}

                {/* Zoom: a control cluster, so 2px and a control height. */}
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 h-[34px] bg-[var(--sr-surface-panel-dark)] border border-[var(--sr-border-dark)] px-2 rounded-[2px] shadow-lg flex items-center gap-1 z-20">
                    <button
                        onClick={() => handleSetZoom(zoomLevel - 0.1)}
                        title="Zoom out"
                        className="p-1 text-[var(--sr-text-secondary-on-dark)] hover:bg-[var(--sr-border-dark)] rounded-[2px] cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                    <span className="font-[family-name:var(--sr-font-mono)] text-[11px] w-12 text-center text-[var(--sr-text-secondary-on-dark)]">
                        {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                        onClick={() => handleSetZoom(zoomLevel + 0.1)}
                        title="Zoom in"
                        className="p-1 text-[var(--sr-text-secondary-on-dark)] hover:bg-[var(--sr-border-dark)] rounded-[2px] cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                    <div className="h-4 w-px bg-[var(--sr-border-dark)] mx-1"></div>
                    <button
                        onClick={() => { if (capturedImage) initCanvas(capturedImage); }}
                        title="Fit to view"
                        className="p-1 text-[var(--sr-text-secondary-on-dark)] hover:bg-[var(--sr-border-dark)] rounded-[2px] cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[18px]">fit_screen</span>
                    </button>
                </div>
            </div>
        </section>
    );
};
