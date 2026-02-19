import React from 'react';
import { useEditor } from '../context/EditorContext';
import { GoogleAd } from '../../../components';

export const PropertySidebar: React.FC = () => {
    const {
        activeTool, strokeColor, setStrokeColor, strokeWidth,
        setStrokeWidth, handleToolChange, capturedImage
    } = useEditor();

    return (
        <aside className="w-72 border-l border-[#ece7f4] dark:border-[#2d2245] bg-white dark:bg-[#1c142b] flex flex-col overflow-y-auto">
            <div className="p-5 border-b border-[#ece7f4] dark:border-[#2d2245]">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#6c499c]">Properties</h3>
            </div>

            <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[20px]">draw</span>
                    </div>
                    <span className="text-sm font-semibold">Arrow Style</span>
                </div>
                <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-xs font-medium opacity-60">Stroke Weight</label>
                            <span className="text-xs font-bold">{strokeWidth}px</span>
                        </div>
                        <input
                            className="w-full h-1.5 bg-[#ece7f4] dark:bg-[#2d2245] rounded-full appearance-none accent-primary"
                            type="range"
                            min="1"
                            max="20"
                            value={strokeWidth}
                            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium opacity-60">Color</label>
                        <div className="grid grid-cols-6 gap-2">
                            {['#8B5CF6', '#ef4444', '#10b981', '#f59e0b', '#3b82f6'].map(color => (
                                <div
                                    key={color}
                                    onClick={() => setStrokeColor(color)}
                                    className={`size-6 rounded-full cursor-pointer transition-all ${strokeColor === color ? 'border-2 border-white dark:border-[#1c142b] ring-2 ring-primary' : ''}`}
                                    style={{ backgroundColor: color }}
                                ></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-[1px] bg-[#ece7f4] dark:bg-[#2d2245] mx-5"></div>

            <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                        <span className="material-symbols-outlined text-[20px]">privacy_tip</span>
                    </div>
                    <span className="text-sm font-semibold">Privacy Tools</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => handleToolChange('blur')}
                        title="Blur sensitive areas"
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${activeTool === 'blur' ? 'bg-primary/10 border-primary text-primary' : 'border-[#ece7f4] dark:border-[#2d2245] hover:bg-background-light dark:hover:bg-background-dark'}`}
                    >
                        <span className="material-symbols-outlined">blur_on</span>
                        <span className="text-[10px] font-bold">Blur</span>
                    </button>
                    <button
                        onClick={() => handleToolChange('pixelate')}
                        title="Pixelate sensitive areas"
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${activeTool === 'pixelate' ? 'bg-primary/10 border-primary text-primary' : 'border-[#ece7f4] dark:border-[#2d2245] hover:bg-background-light dark:hover:bg-background-dark'}`}
                    >
                        <span className="material-symbols-outlined">grid_view</span>
                        <span className="text-[10px] font-bold">Pixelate</span>
                    </button>
                </div>
            </div>

            <div className="p-4 border-t border-[#ece7f4] dark:border-[#2d2245]">
                <GoogleAd
                    className="scale-90 origin-top"
                    style={{ minHeight: '200px' }}
                    slotId={import.meta.env.VITE_ADSENSE_EDITOR_SLOT}
                />
            </div>

            <div className="h-[1px] bg-[#ece7f4] dark:bg-[#2d2245] mx-5"></div>

            <div className="mt-auto p-4 bg-background-light dark:bg-[#1c142b]/50 border-t border-[#ece7f4] dark:border-[#2d2245]">
                <div className="flex items-center justify-between text-[11px] font-medium opacity-60">
                    <span>Captured just now</span>
                    <span>{capturedImage ? `${(capturedImage.length / 1024 / 1.33).toFixed(1)} KB` : '0 KB'}</span>
                </div>
            </div>
        </aside>
    );
};
