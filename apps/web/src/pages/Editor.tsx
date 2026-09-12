import React, { useEffect } from 'react';
import { GatedButton, LoginModal, SEO, SupportButton } from '../components';
import { EditorChrome } from './Editor/components/EditorChrome';
import { Toolbar, PropertySidebar, CanvasArea } from './Editor/components';
import { EditorProvider, useEditor } from './Editor/context/EditorContext';
import { FABRIC_TOOL, type ToolKey } from './Editor/tools';
import { detectApple } from '../lib/shortcuts';
// Analytics
import { capture } from '../lib/analytics';
import { readHandoffMessage } from '../lib/handoffMessage';

/** Resolved once at the app edge rather than sniffed inside each control —
 * see lib/shortcuts. */
const isApple = detectApple();

const EditorContent: React.FC = () => {
    const {
        canvasRef, fabricCanvas, capturedImage, setCapturedImage,
        isUploaded, isUploading,
        showLoginPrompt, setShowLoginPrompt,
        setupCanvasEvents, initCanvas, isCanvasReady, isInitializing,
        undo, redo, historyIndex, history, handleActionClick,
        title, setTitle, user, loading,
        activeTool, handleToolChange
    } = useEditor();

    // Initial Setup
    useEffect(() => {
        if (canvasRef.current && !fabricCanvas.current) {
            setupCanvasEvents();
        }
    }, [canvasRef, fabricCanvas, setupCanvasEvents]);

    // Extension Message Listener & Session Fallback
    useEffect(() => {
        /** A blob: URL dies with the document, so sessionStorage cannot carry a
         * screenshot across a refresh the way a data URL did. The image is kept
         * in this origin's IndexedDB instead, and read back on mount. */
        const IMAGE_KEY = 'snaprec_editor_image_blob';

        const loadStoredBlob = (): Promise<Blob | null> => new Promise((resolve) => {
            try {
                const rq = indexedDB.open('SnapRecDB', 2);
                rq.onupgradeneeded = (e: any) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings');
                };
                rq.onsuccess = (e: any) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('recordings')) return resolve(null);
                    const g = db.transaction(['recordings'], 'readonly').objectStore('recordings').get(IMAGE_KEY);
                    g.onsuccess = () => resolve(g.result instanceof Blob ? g.result : null);
                    g.onerror = () => resolve(null);
                };
                rq.onerror = () => resolve(null);
            } catch { resolve(null); }
        });

        const storeBlob = (blob: Blob) => {
            try {
                const rq = indexedDB.open('SnapRecDB', 2);
                rq.onupgradeneeded = (e: any) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings');
                };
                rq.onsuccess = (e: any) => {
                    const db = e.target.result;
                    db.transaction(['recordings'], 'readwrite').objectStore('recordings').put(blob, IMAGE_KEY);
                };
            } catch { /* storage unavailable */ }
        };

        const savedImage = sessionStorage.getItem('snaprec_editing_image');
        if (savedImage) {
            console.log('Editor: Found image in sessionStorage');
            setCapturedImage(savedImage);
        } else {
            void loadStoredBlob().then((blob) => {
                if (blob) {
                    console.log('Editor: Restored image from IndexedDB,', blob.size, 'bytes');
                    setCapturedImage(URL.createObjectURL(blob));
                }
            });
        }

        const handleMessage = (event: MessageEvent) => {
            const payload = readHandoffMessage(event.origin, event.data, window.location.origin);
            if (!payload) return;

            if (payload.kind === 'image') {
                console.log('Editor: Received image blob,', payload.blob.size, 'bytes');
                setCapturedImage(URL.createObjectURL(payload.blob));
                storeBlob(payload.blob);
            } else if (payload.kind === 'imageDataUrl') {
                console.log('Editor: Received SNAPREC_EDIT_IMAGE (legacy data URL)');
                setCapturedImage(payload.dataUrl);
                try {
                    sessionStorage.setItem('snaprec_editing_image', payload.dataUrl);
                } catch { /* quota */ }
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
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5">
                <button
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    title="Undo (Ctrl+Z)"
                    className="p-1.5 hover:bg-[var(--sr-border-dark)] rounded-[2px] transition-all cursor-pointer disabled:opacity-30 text-[var(--sr-text-secondary-on-dark)]"
                >
                    <span className="material-symbols-outlined text-[20px]">undo</span>
                </button>
                <button
                    onClick={redo}
                    disabled={historyIndex >= history.current.length - 1}
                    title="Redo (Ctrl+Y)"
                    className="p-1.5 hover:bg-[var(--sr-border-dark)] rounded-[2px] transition-all cursor-pointer disabled:opacity-30 text-[var(--sr-text-secondary-on-dark)]"
                >
                    <span className="material-symbols-outlined text-[20px]">redo</span>
                </button>
            </div>
            <div className="h-5 w-px bg-[var(--sr-border-dark)]"></div>
            <SupportButton surface="dark" />
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
                className={`w-[196px] justify-center ${isUploading ? 'animate-pulse' : ''}`}
                disabled={isUploading || isInitializing}
                title={isUploaded && user ? 'Update the shared copy' : 'Create a link you can share'}
            >
                {isUploading ? (isUploaded && user ? 'Updating…' : 'Creating…') : (isUploaded && user ? 'Update' : 'Create share link')}
            </GatedButton>
        </div>
    );

    return (
        <>
            <SEO
                url="/editor"
                title="Screenshot & Image Editor — Free Online Annotation Tool"
                description="Free online screenshot editor. Annotate, draw, highlight, blur, and add text to your screenshots instantly. Edit and share your images with a link — no sign-up required."
                keywords="screenshot editor, image annotator, online photo editor, annotate screenshot, draw on screenshot, blur screenshot, screenshot editor online free, screenshot tool chrome, edit screenshot online, free screenshot annotation tool, screenshot extension editor"
                noIndex={true}
            />
            <EditorChrome
                title={
                    <div className="flex items-center gap-1 group/title max-w-xl">
                        {loading ? (
                            <div className="w-[124px] h-5 bg-[var(--sr-surface-panel-dark)] rounded-[2px] animate-pulse"></div>
                        ) : user ? (
                            <>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-transparent border-none outline-none text-sm font-semibold text-[var(--sr-text-faint-on-dark)] w-full focus:text-[var(--sr-text-primary-on-dark)] hover:bg-[var(--sr-surface-panel-dark)] rounded-[2px] px-1 transition-all"
                                />
                                <span className="material-symbols-outlined text-[16px] text-[var(--sr-text-faint-on-dark)] opacity-0 group-hover/title:opacity-100 transition-opacity">edit</span>
                            </>
                        ) : (
                            <div
                                onClick={() => setShowLoginPrompt(true)}
                                className="text-sm font-semibold text-[var(--sr-text-faint-on-dark)] hover:text-[var(--sr-text-primary-on-dark)] cursor-pointer flex items-center gap-1"
                                title="Login to edit title"
                            >
                                <span>{title}</span>
                                <span className="material-symbols-outlined text-[16px] text-[var(--sr-text-faint-on-dark)] opacity-0 group-hover/title:opacity-100 transition-opacity">lock</span>
                            </div>
                        )}
                    </div>
                }
                actions={EditorActions}
            >
                <div className="flex-1 flex h-full overflow-hidden">
                    <Toolbar
                        active={(Object.keys(FABRIC_TOOL) as ToolKey[])
                            .find((k) => FABRIC_TOOL[k] === activeTool) ?? 'select'}
                        onSelect={(key) => {
                            capture('screenshot_tool_used', { tool: key });
                            handleToolChange(FABRIC_TOOL[key] ?? 'select');
                        }}
                        isApple={isApple}
                    />
                    <CanvasArea />
                    <PropertySidebar
                        selection={null}
                        onChange={() => {}}
                    />
                </div>

                <LoginModal
                    isOpen={showLoginPrompt}
                    onClose={() => setShowLoginPrompt(false)}
                    actionDescription="upload and share"
                />
            </EditorChrome>
        </>
    );
};

const Editor: React.FC = () => {
    // Analytics: one event per editor open. `has_capture` separates a real
    // capture handed over by the extension from an empty editor someone landed
    // on directly — the two are very different sessions.
    useEffect(() => {
        capture('screenshot_editor_opened', {
            has_capture: Boolean(window.location.pathname.replace(/\/+$/, '').split('/')[2]),
        });
    }, []);

    return (
        <EditorProvider>
            <EditorContent />
        </EditorProvider>
    );
};

export default Editor;
