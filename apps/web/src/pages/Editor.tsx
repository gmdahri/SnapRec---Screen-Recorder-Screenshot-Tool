import React, { useEffect } from 'react';
import { MainLayout, GatedButton, LoginModal } from '../components';
import { Toolbar, PropertySidebar, CanvasArea } from './Editor/components';
import { EditorProvider, useEditor } from './Editor/context/EditorContext';

const EditorContent: React.FC = () => {
    const {
        canvasRef, fabricCanvas, capturedImage, setCapturedImage,
        isUploaded, isUploading,
        showLoginPrompt, setShowLoginPrompt,
        setupCanvasEvents, initCanvas, isCanvasReady, isInitializing,
        undo, redo, historyIndex, history, handleActionClick,
        title, setTitle, user
    } = useEditor();

    // Initial Setup
    useEffect(() => {
        if (canvasRef.current && !fabricCanvas.current) {
            setupCanvasEvents();
        }
    }, [canvasRef, fabricCanvas, setupCanvasEvents]);

    // Extension Message Listener & Session Fallback
    useEffect(() => {
        // 1. Check if there's an image in sessionStorage (from extension injection)
        const savedImage = sessionStorage.getItem('snaprec_editing_image');
        if (savedImage) {
            console.log('Editor: Found image in sessionStorage');
            setCapturedImage(savedImage);
            // Don't clear immediately, we might need it on refresh if not saved yet
        }

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SNAPREC_EDIT_IMAGE') {
                console.log('Editor: Received message SNAPREC_EDIT_IMAGE');
                setCapturedImage(event.data.dataUrl);
                sessionStorage.setItem('snaprec_editing_image', event.data.dataUrl);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [setCapturedImage]);

    // No auto-upload!

    const lastInitImage = React.useRef<string | null>(null);
    useEffect(() => {
        if (capturedImage && isCanvasReady && fabricCanvas.current && capturedImage !== lastInitImage.current) {
            console.log('Editor: Initializing canvas with new capturedImage');
            lastInitImage.current = capturedImage;
            initCanvas(capturedImage);
        }
    }, [capturedImage, isCanvasReady, initCanvas]);

    const EditorActions = (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                <button
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    title="Undo (Ctrl+Z)"
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-900 rounded-md transition-all cursor-pointer disabled:opacity-30"
                >
                    <span className="material-symbols-outlined text-[20px]">undo</span>
                </button>
                <button
                    onClick={redo}
                    disabled={historyIndex >= history.current.length - 1}
                    title="Redo (Ctrl+Y)"
                    className="p-1.5 hover:bg-white dark:hover:bg-slate-900 rounded-md transition-all cursor-pointer disabled:opacity-30"
                >
                    <span className="material-symbols-outlined text-[20px]">redo</span>
                </button>
            </div>
            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
            <GatedButton
                onClick={() => handleActionClick('export')}
                icon="download"
                variant="secondary"
                title="Download to your computer"
                disabled={isInitializing}
            >
                Download
            </GatedButton>
            <GatedButton
                onClick={() => handleActionClick('share')}
                icon={isUploading ? 'sync' : (isUploaded && user ? 'save' : 'cloud_upload')}
                variant="primary"
                className={`px-5 ${isUploading ? 'animate-pulse' : ''}`}
                disabled={isUploading || isInitializing}
                title={isUploaded && user ? 'Update recording' : 'Generate shareable link'}
            >
                {isUploading ? (isUploaded && user ? 'Updating...' : 'Generating...') : (isUploaded && user ? 'Update' : 'Generate Shareable Link')}
            </GatedButton>
        </div>
    );

    return (
        <MainLayout
            title={
                <div className="flex items-center gap-1 group/title max-w-xl">
                    {user ? (
                        <>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm font-semibold text-slate-500 w-full focus:text-slate-900 dark:focus:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1 transition-all"
                            />
                            <span className="material-symbols-outlined text-[16px] text-slate-300 opacity-0 group-hover/title:opacity-100 transition-opacity">edit</span>
                        </>
                    ) : (
                        <div
                            onClick={() => setShowLoginPrompt(true)}
                            className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer flex items-center gap-1"
                            title="Login to edit title"
                        >
                            <span>{title}</span>
                            <span className="material-symbols-outlined text-[16px] text-slate-300 opacity-0 group-hover/title:opacity-100 transition-opacity">lock</span>
                        </div>
                    )}
                </div>
            }
            showBackButton={true}
            headerActions={EditorActions}
            noScroll={true}
        >
            <div className="flex-1 flex h-full overflow-hidden">
                <Toolbar />
                <CanvasArea />
                <PropertySidebar />
            </div>

            <LoginModal
                isOpen={showLoginPrompt}
                onClose={() => setShowLoginPrompt(false)}
                actionDescription="upload and share"
            />
        </MainLayout>
    );
};

const Editor: React.FC = () => {
    return (
        <EditorProvider>
            <EditorContent />
        </EditorProvider>
    );
};

export default Editor;
