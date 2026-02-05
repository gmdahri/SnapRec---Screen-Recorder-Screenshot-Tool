import React from 'react';
import { useEditor } from '../context/EditorContext';

export const Toolbar: React.FC = () => {
    const { activeTool, handleToolChange, addText } = useEditor();

    return (
        <aside className="w-16 border-r border-[#ece7f4] dark:border-[#2d2245] bg-white dark:bg-[#1c142b] flex flex-col items-center py-6 gap-6">
            <button
                onClick={() => handleToolChange('select')}
                title="Select (V)"
                className={`size-10 flex items-center justify-center rounded-xl transition-all ${activeTool === 'select' ? 'bg-primary/10 text-primary' : 'hover:bg-[#ece7f4] dark:hover:bg-[#2d2245]'}`}
            >
                <span className="material-symbols-outlined">near_me</span>
            </button>
            <button
                onClick={() => handleToolChange('arrow')}
                title="Arrow (A)"
                className={`size-10 flex items-center justify-center rounded-xl transition-all ${activeTool === 'arrow' ? 'bg-primary/10 text-primary' : 'hover:bg-[#ece7f4] dark:hover:bg-[#2d2245]'}`}
            >
                <span className="material-symbols-outlined">arrow_outward</span>
            </button>
            <button
                onClick={addText}
                title="Text (T)"
                className="size-10 flex items-center justify-center rounded-xl transition-all hover:bg-[#ece7f4] dark:hover:bg-[#2d2245]"
            >
                <span className="material-symbols-outlined">title</span>
            </button>
            <button
                onClick={() => handleToolChange('rectangle')}
                title="Rectangle (R)"
                className={`size-10 flex items-center justify-center rounded-xl transition-all ${activeTool === 'rectangle' ? 'bg-primary/10 text-primary' : 'hover:bg-[#ece7f4] dark:hover:bg-[#2d2245]'}`}
            >
                <span className="material-symbols-outlined">rectangle</span>
            </button>
            <button
                onClick={() => handleToolChange('pen')}
                title="Pen (P)"
                className={`size-10 flex items-center justify-center rounded-xl transition-all ${activeTool === 'pen' ? 'bg-primary/10 text-primary' : 'hover:bg-[#ece7f4] dark:hover:bg-[#2d2245]'}`}
            >
                <span className="material-symbols-outlined">draw</span>
            </button>
            <button
                onClick={() => handleToolChange('blur')}
                title="Blur (B)"
                className={`size-10 flex items-center justify-center rounded-xl transition-all ${activeTool === 'blur' ? 'bg-primary/10 text-primary' : 'hover:bg-[#ece7f4] dark:hover:bg-[#2d2245]'}`}
            >
                <span className="material-symbols-outlined">blur_on</span>
            </button>
            <button
                onClick={() => handleToolChange('crop')}
                title="Crop Area (C)"
                className={`size-10 flex items-center justify-center rounded-xl transition-all ${activeTool === 'crop' ? 'bg-primary/10 text-primary' : 'hover:bg-[#ece7f4] dark:hover:bg-[#2d2245]'}`}
            >
                <span className="material-symbols-outlined">crop</span>
            </button>
            <div className="mt-auto flex flex-col items-center gap-4">
                <button
                    title="Settings"
                    className="size-10 flex items-center justify-center rounded-xl hover:bg-[#ece7f4] dark:hover:bg-[#2d2245] transition-all cursor-pointer"
                >
                    <span className="material-symbols-outlined">settings</span>
                </button>
            </div>
        </aside>
    );
};
