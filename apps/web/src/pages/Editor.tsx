import React, { useEffect } from 'react';
import { MainLayout, GatedButton, LoginModal } from '../components';
import { Toolbar, PropertySidebar, CanvasArea } from './Editor/components';
import { EditorProvider, useEditor } from './Editor/context/EditorContext';

const EditorContent: React.FC = () => {
    const {
        canvasRef, fabricCanvas, capturedImage, setCapturedImage,
        hasAutoUploaded, setHasAutoUploaded, isUploading, isProcessing, isReady, isImageReady,
        showLoginPrompt, setShowLoginPrompt,
        handleUploadToCloud, setupCanvasEvents, initCanvas,
        undo, redo, historyIndex, history, handleActionClick,
        id, title, setTitle, user
    } = useEditor();

    // Initial Setup
    useEffect(() => {
        if (canvasRef.current && !fabricCanvas.current) {
            setupCanvasEvents();
        }
    }, [canvasRef, fabricCanvas, setupCanvasEvents]);

    // Extension Message Listener
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'SNAPREC_EDIT_IMAGE') {
                setCapturedImage(event.data.dataUrl);
                if (event.data.uploadStarted) {
                    setHasAutoUploaded(true);
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [setCapturedImage, setHasAutoUploaded]);

    // Auto-upload when image is received
    useEffect(() => {
        if (capturedImage && !hasAutoUploaded && !isUploading) {
            handleUploadToCloud();
            setHasAutoUploaded(true);
        }
    }, [capturedImage, hasAutoUploaded, isUploading, handleUploadToCloud, setHasAutoUploaded]);

    // Initialize from capturedImage when ready
    useEffect(() => {
        console.log('--- Editor Init Check ---', {
            isReady,
            hasCapturedImage: !!capturedImage,
            hasCanvas: !!fabricCanvas.current,
            hasBg: !!fabricCanvas.current?.backgroundImage,
            capturedImage
        });
        if (isReady && capturedImage && fabricCanvas.current && !fabricCanvas.current.backgroundImage) {
            console.log('Triggering initCanvas with:', capturedImage);
            initCanvas(capturedImage);
        }
    }, [isReady, capturedImage, fabricCanvas, initCanvas]);

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
            >
                Download
            </GatedButton>
            <GatedButton
                onClick={() => handleActionClick('share')}
                icon={isUploading ? 'sync' : ((id && user) ? 'save' : 'cloud_upload')}
                variant="primary"
                className={`px-5 ${isUploading ? 'animate-pulse' : ''}`}
                disabled={isUploading}
                title={(id && user) ? 'Update recording' : 'Save to your account'}
            >
                {isUploading ? ((id && user) ? 'Updating...' : 'Saving...') : ((id && user) ? 'Update' : 'Save to your account')}
            </GatedButton>
        </div>
    );

    return (
        <MainLayout
            title={
                <div className="flex items-center gap-1 group/title max-w-xl">
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm font-semibold text-slate-500 w-full focus:text-slate-900 dark:focus:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1 transition-all"
                    />
                    <span className="material-symbols-outlined text-[16px] text-slate-300 opacity-0 group-hover/title:opacity-100 transition-opacity">edit</span>
                </div>
            }
            showBackButton={true}
            headerActions={EditorActions}
            noScroll={true}
        >
            <div className="flex-1 flex h-full overflow-hidden relative">
                {(isProcessing || (capturedImage && !isImageReady)) && (
                    <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                        <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <div className="flex flex-col items-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {isProcessing ? 'Processing your screenshot...' : 'Loading image into editor...'}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400">This will only take a moment.</p>
                        </div>
                    </div>
                )}
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
