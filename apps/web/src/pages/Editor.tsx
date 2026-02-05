import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Logo, LoginModal, GatedButton, UserMenu } from '../components';
import { api } from '../lib/api';
import { fabric } from 'fabric';
import { createArrow } from '../lib/CanvasUtils';

const Editor: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { id } = useParams();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [hasAutoUploaded, setHasAutoUploaded] = useState(false);
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [activeTool, setActiveTool] = useState('select');
    const [strokeColor, setStrokeColor] = useState('#8B5CF6');
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [isCropping, setIsCropping] = useState(false);
    const [cropRect, setCropRect] = useState<fabric.Rect | null>(null);

    // Update brush when color or width changes
    useEffect(() => {
        const canvas = fabricCanvas.current;
        if (canvas) {
            if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
                canvas.freeDrawingBrush.color = strokeColor;
                canvas.freeDrawingBrush.width = strokeWidth;
            }
            // Update active object style if something is selected
            const activeObj = canvas.getActiveObject();
            if (activeObj) {
                if ('stroke' in activeObj) activeObj.set({ stroke: strokeColor });
                if ('strokeWidth' in activeObj) activeObj.set({ strokeWidth: strokeWidth });
                if (activeObj instanceof fabric.IText) activeObj.set({ fill: strokeColor });
                canvas.renderAll();
            }
        }
    }, [strokeColor, strokeWidth]);

    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const fabricCanvas = React.useRef<fabric.Canvas | null>(null);
    const isDrawing = React.useRef(false);
    const startPoint = React.useRef<{ x: number; y: number } | null>(null);
    const activeObject = React.useRef<fabric.Object | null>(null);
    const history = React.useRef<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [zoomLevel, setZoomLevel] = useState(1);

    // Refs for listeners to avoid stale closures
    const activeToolRef = React.useRef(activeTool);
    const strokeColorRef = React.useRef(strokeColor);
    const strokeWidthRef = React.useRef(strokeWidth);

    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
    useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
    useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);

    // Fetch existing recording if ID is in URL
    useEffect(() => {
        const fetchRecording = async () => {
            if (id) {
                try {
                    console.log('Fetching existing recording:', id);
                    const recording = await api.recordings.get(id);
                    if (recording && recording.fileUrl) {
                        setCapturedImage(recording.fileUrl);
                        setHasAutoUploaded(true); // Don't re-upload if we already have an ID
                    }
                } catch (error) {
                    console.error('Failed to fetch recording:', error);
                }
            }
        };
        fetchRecording();
    }, [id]);

    // Auto-upload when image is received
    useEffect(() => {
        if (capturedImage && !hasAutoUploaded && !isUploading) {
            handleUploadToCloud();
            setHasAutoUploaded(true);
        }
    }, [capturedImage, hasAutoUploaded]);

    useEffect(() => {
        // Listen for message from extension
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'SNAPREC_EDIT_IMAGE') {
                console.log('Received image from extension');
                const dataUrl = event.data.dataUrl;
                setCapturedImage(dataUrl);
            }
        };

        window.addEventListener('message', handleMessage);

        // Initialize Fabric Canvas
        if (canvasRef.current && !fabricCanvas.current) {
            fabricCanvas.current = new fabric.Canvas(canvasRef.current, {
                width: 800,
                height: 600,
                backgroundColor: '#ffffff',
            });
            setupCanvasEvents();
        }

        // Initialize from capturedImage when ready
        if (capturedImage && fabricCanvas.current && !fabricCanvas.current.backgroundImage) {
            initCanvas(capturedImage);
        }

        return () => window.removeEventListener('message', handleMessage);
    }, [capturedImage]);

    const initCanvas = (dataUrl: string) => {
        if (!fabricCanvas.current) return;
        const canvas = fabricCanvas.current;

        fabric.Image.fromURL(dataUrl, (img) => {
            if (!img) {
                console.error('Failed to load image into fabric:', dataUrl);
                return;
            }
            const imgWidth = img.width || 800;
            const imgHeight = img.height || 600;

            canvas.setDimensions({
                width: imgWidth,
                height: imgHeight,
            });

            canvas.setBackgroundImage(img, () => {
                // Calculate initial fit zoom
                const container = document.querySelector('.canvas-bg');
                if (container) {
                    const padding = 100;
                    const availableWidth = container.clientWidth - padding;
                    const availableHeight = container.clientHeight - padding;
                    const scaleX = availableWidth / imgWidth;
                    const scaleY = availableHeight / imgHeight;
                    const fitZoom = Math.min(scaleX, scaleY, 1);
                    handleSetZoom(fitZoom);
                }

                canvas.renderAll();
                saveState(); // Save initial state
            });
        }, { crossOrigin: 'anonymous' });
    };

    const handleSetZoom = (newZoom: number) => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;

        const zoom = Math.max(0.1, Math.min(5, newZoom));
        setZoomLevel(zoom);
        canvas.setZoom(zoom);

        // Resize canvas container to match zoomed dimensions
        const bgImg = canvas.backgroundImage as fabric.Image;
        if (bgImg) {
            canvas.setDimensions({
                width: (bgImg.width || 800) * zoom,
                height: (bgImg.height || 600) * zoom,
            });
        }
        canvas.renderAll();
    };

    const setupCanvasEvents = () => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;

        canvas.on('mouse:down', (options) => {
            const tool = activeToolRef.current;
            if (tool === 'select') return;

            isDrawing.current = true;
            const pointer = canvas.getPointer(options.e);
            startPoint.current = { x: pointer.x, y: pointer.y };

            if (tool === 'rectangle' || tool === 'blur' || tool === 'pixelate' || tool === 'crop') {
                const rect = new fabric.Rect({
                    left: pointer.x,
                    top: pointer.y,
                    width: 0,
                    height: 0,
                    fill: tool === 'blur' || tool === 'pixelate' ? 'rgba(0,0,0,0.1)' : 'transparent',
                    stroke: tool === 'blur' || tool === 'pixelate' ? '#ccc' : (tool === 'crop' ? '#8B5CF6' : strokeColorRef.current),
                    strokeWidth: tool === 'blur' || tool === 'pixelate' ? 1 : (tool === 'crop' ? 2 : strokeWidthRef.current),
                    strokeDashArray: tool === 'blur' || tool === 'pixelate' || tool === 'crop' ? [5, 5] : undefined,
                });
                canvas.add(rect);
                activeObject.current = rect;
            } else if (tool === 'arrow') {
                const arrow = createArrow([pointer.x, pointer.y, pointer.x, pointer.y], {
                    stroke: strokeColorRef.current,
                    strokeWidth: strokeWidthRef.current,
                });
                canvas.add(arrow);
                activeObject.current = arrow;
            }
        });

        canvas.on('mouse:move', (options) => {
            if (!isDrawing.current || !activeObject.current || !startPoint.current) return;
            const canvas = fabricCanvas.current!;
            const pointer = canvas.getPointer(options.e);
            const tool = activeToolRef.current;

            if (tool === 'rectangle' || tool === 'blur' || tool === 'pixelate' || tool === 'crop') {
                const rect = activeObject.current as fabric.Rect;
                rect.set({
                    width: Math.abs(pointer.x - startPoint.current.x),
                    height: Math.abs(pointer.y - startPoint.current.y),
                    left: Math.min(pointer.x, startPoint.current.x),
                    top: Math.min(pointer.y, startPoint.current.y),
                });
            } else if (tool === 'arrow') {
                canvas.remove(activeObject.current);
                const arrow = createArrow([startPoint.current.x, startPoint.current.y, pointer.x, pointer.y], {
                    stroke: strokeColorRef.current,
                    strokeWidth: strokeWidthRef.current,
                });
                canvas.add(arrow);
                activeObject.current = arrow;
            }
            canvas.renderAll();
        });

        canvas.on('mouse:up', () => {
            const tool = activeToolRef.current;
            if ((tool === 'blur' || tool === 'pixelate') && activeObject.current) {
                import('../lib/CanvasUtils').then(({ applyPixelate }) => {
                    applyPixelate(canvas, activeObject.current as fabric.Rect, tool === 'pixelate' ? 20 : 8);
                    saveState();
                });
            } else if (tool === 'crop' && activeObject.current) {
                setCropRect(activeObject.current as fabric.Rect);
                setIsCropping(true);
            } else if (tool !== 'select' && tool !== 'text') {
                saveState();
            }
            isDrawing.current = false;
            activeObject.current = null;
            startPoint.current = null;
        });

        canvas.on('object:modified', () => saveState());
        canvas.on('object:added', (e: any) => {
            // Only save state for pen tool or programmatic additions (not interactive shapes handled by mouse:up)
            if (canvas.isDrawingMode && e.target) {
                saveState();
            }
        });
    };

    const saveState = () => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;

        const json = JSON.stringify(canvas.toJSON());
        const newHistory = history.current.slice(0, historyIndex + 1);
        newHistory.push(json);

        // Limit history
        if (newHistory.length > 50) newHistory.shift();

        history.current = newHistory;
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            loadFromHistory(newIndex);
        }
    };

    const redo = () => {
        if (historyIndex < history.current.length - 1) {
            const newIndex = historyIndex + 1;
            loadFromHistory(newIndex);
        }
    };

    const loadFromHistory = (index: number) => {
        const canvas = fabricCanvas.current;
        if (!canvas || !history.current[index]) return;

        canvas.loadFromJSON(history.current[index], () => {
            canvas.renderAll();
            setHistoryIndex(index);
        });
    };

    const handleCropConfirm = () => {
        const canvas = fabricCanvas.current;
        if (!canvas || !cropRect) return;

        const left = cropRect.left || 0;
        const top = cropRect.top || 0;
        const width = cropRect.width || 0;
        const height = cropRect.height || 0;

        // Create new canvas size
        const croppedDataUrl = canvas.toDataURL({
            left,
            top,
            width,
            height,
            format: 'png',
        });

        canvas.clear();
        fabric.Image.fromURL(croppedDataUrl, (img) => {
            canvas.setDimensions({ width, height });
            canvas.setBackgroundImage(img, () => {
                canvas.renderAll();
                saveState();
            });
        });

        setIsCropping(false);
        setCropRect(null);
        setActiveTool('select');
    };

    const handleCropCancel = () => {
        const canvas = fabricCanvas.current;
        if (canvas && cropRect) {
            canvas.remove(cropRect);
            canvas.renderAll();
        }
        setIsCropping(false);
        setCropRect(null);
        handleToolChange('select');
    };

    const handleToolChange = (tool: string) => {
        setActiveTool(tool);
        const canvas = fabricCanvas.current;
        if (!canvas) return;

        canvas.isDrawingMode = tool === 'pen';
        canvas.selection = tool === 'select';

        if (canvas.isDrawingMode) {
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.color = strokeColor;
            canvas.freeDrawingBrush.width = strokeWidth;
        }

        if (tool === 'select') {
            canvas.forEachObject(obj => obj.selectable = true);
        } else {
            canvas.forEachObject(obj => obj.selectable = false);
            canvas.discardActiveObject();
        }
        canvas.renderAll();
    };

    const addText = () => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;

        const text = new fabric.IText('Double click to edit', {
            left: 100,
            top: 100,
            fontFamily: 'Inter',
            fontSize: 30,
            fill: strokeColor,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        setActiveTool('select');
    };

    // Handle action button clicks - gate behind auth
    const handleActionClick = (action: string) => {
        // Allow 'share' (upload) for guests, store ID locally
        if (action === 'share' || action === 'export') {
            executeAction(action);
            return;
        }

        if (!user && action !== 'share') {
            setPendingAction(action);
            setShowLoginPrompt(true);
            return;
        }
        executeAction(action);
    };

    const executeAction = (action: string) => {
        switch (action) {
            case 'export':
                if (fabricCanvas.current) {
                    const dataUrl = fabricCanvas.current.toDataURL({ format: 'png' });
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    link.download = `SnapRec_Edited_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
                break;
            case 'share':
                handleUploadToCloud();
                break;
        }
    };

    const handleUploadToCloud = async () => {
        if (!fabricCanvas.current || isUploading) return;

        const canvasDataUrl = fabricCanvas.current.toDataURL({ format: 'png' });
        console.log('Starting cloud upload for edited image...');
        setIsUploading(true);
        try {
            // Get upload URL
            console.log('Getting presigned upload URL...');
            const { url, fileName } = await api.recordings.getUploadUrl(
                `screenshot_${Date.now()}.png`,
                'image/png'
            );
            console.log('Presigned URL received:', url ? 'Success' : 'Failed');

            // Convert data URL to blob
            const res = await fetch(canvasDataUrl);
            const blob = await res.blob();

            // Upload to R2
            console.log('Uploading to R2 via PUT...');
            const uploadRes = await fetch(url, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/png' }
            });

            if (!uploadRes.ok) {
                const errorText = await uploadRes.text();
                throw new Error(`R2 Upload failed: ${uploadRes.status} ${errorText}`);
            }
            console.log('R2 Upload successful');

            // Create recording entry
            console.log('Creating database entry...');
            const recording = await api.recordings.create({
                title: `Screenshot ${new Date().toLocaleString()}`,
                type: 'screenshot',
                fileName
            });
            console.log('Database entry created:', recording.id);

            // If guest, store ID to claim later
            if (!user) {
                const guestIds = JSON.parse(localStorage.getItem('guestRecordingIds') || '[]');
                if (!guestIds.includes(recording.id)) {
                    guestIds.push(recording.id);
                    localStorage.setItem('guestRecordingIds', JSON.stringify(guestIds));
                    console.log('Saved guest recording ID for claiming:', recording.id);
                }
            }

            // Update URL instead of just navigating away
            navigate(`/editor/${recording.id}`, { replace: true });
            console.log('Editor URL updated to:', `/editor/${recording.id}`);
        } catch (error) {
            console.error('UPLOAD ERROR:', error);
            alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-[#130d1c] dark:text-[#faf8fc] antialiased min-h-screen flex flex-col overflow-hidden">
            {/* Login Prompt Modal */}
            <LoginModal
                isOpen={showLoginPrompt}
                onClose={() => setShowLoginPrompt(false)}
                actionDescription={pendingAction === 'export' ? 'download your screenshot' : 'share your screenshot'}
            />

            {/* Global Header */}
            <header className="h-16 border-b border-[#ece7f4] dark:border-[#2d2245] bg-white dark:bg-[#1c142b] px-6 flex items-center justify-between z-30">
                <div className="flex items-center gap-6">
                    <Logo size="md" />
                    <div className="h-6 w-[1px] bg-[#ece7f4] dark:border-[#2d2245]"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium opacity-70">Project /</span>
                        <span className="text-sm font-semibold hover:bg-[#ece7f4] dark:hover:bg-[#2d2245] px-2 py-1 rounded cursor-pointer">Untitled Screenshot</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 bg-[#ece7f4] dark:bg-[#2d2245] rounded-lg p-1">
                        <button
                            onClick={undo}
                            disabled={historyIndex <= 0}
                            title="Undo (Ctrl+Z)"
                            className="p-1.5 hover:bg-white dark:hover:bg-[#1c142b] rounded-md transition-all cursor-pointer disabled:opacity-30"
                        >
                            <span className="material-symbols-outlined text-[20px]">undo</span>
                        </button>
                        <button
                            onClick={redo}
                            disabled={historyIndex >= history.current.length - 1}
                            title="Redo (Ctrl+Y)"
                            className="p-1.5 hover:bg-white dark:hover:bg-[#1c142b] rounded-md transition-all cursor-pointer disabled:opacity-30"
                        >
                            <span className="material-symbols-outlined text-[20px]">redo</span>
                        </button>
                    </div>
                    <div className="h-6 w-[1px] bg-[#ece7f4] dark:bg-[#2d2245]"></div>
                    <GatedButton
                        onClick={() => handleActionClick('export')}
                        icon="download"
                        variant="secondary"
                        title="Download to your computer"
                    >
                        Export
                    </GatedButton>
                    <GatedButton
                        onClick={() => handleActionClick('share')}
                        icon={isUploading ? 'sync' : 'cloud_upload'}
                        variant="primary"
                        className={`px-5 ${isUploading ? 'animate-pulse' : ''}`}
                        disabled={isUploading}
                        title="Upload and share a link"
                    >
                        {isUploading ? 'Uploading...' : 'Share to SnapRec'}
                    </GatedButton>
                    <UserMenu onSignIn={() => setShowLoginPrompt(true)} />
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex overflow-hidden">
                {/* ToolBar (Left Floating or Docked) */}
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
                        className={`size-10 flex items-center justify-center rounded-xl transition-all hover:bg-[#ece7f4] dark:hover:bg-[#2d2245]`}
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

                {/* Canvas Area */}
                <section className="flex-1 bg-background-light dark:bg-background-dark p-12 overflow-auto relative canvas-bg">
                    <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-full">
                        {/* Screenshot Preview */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/5 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative bg-white dark:bg-[#1c142b] rounded-lg shadow-2xl border border-[#ece7f4] dark:border-[#2d2245]">
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
                                {!capturedImage && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-50 bg-background-light dark:bg-background-dark">
                                        <span className="material-symbols-outlined text-6xl">image_not_supported</span>
                                        <p className="font-medium">Waiting for image from extension...</p>
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
                                // Reset to fit
                                if (capturedImage) initCanvas(capturedImage);
                            }}
                            className="p-1 hover:bg-[#ece7f4] dark:hover:bg-[#2d2245] rounded-full cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-[20px]">fullscreen</span>
                        </button>
                    </div>
                </section>

                {/* Right SideNavBar / Properties */}
                <aside className="w-72 border-l border-[#ece7f4] dark:border-[#2d2245] bg-white dark:bg-[#1c142b] flex flex-col overflow-y-auto">
                    <div className="p-5 border-b border-[#ece7f4] dark:border-[#2d2245]">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#6c499c]">Properties</h3>
                    </div>
                    {/* Tool Group: Annotations */}
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
                                    <div className="size-6 rounded-full border border-[#ece7f4] dark:border-[#2d2245] flex items-center justify-center cursor-pointer">
                                        <span className="material-symbols-outlined text-[14px]">add</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="h-[1px] bg-[#ece7f4] dark:bg-[#2d2245] mx-5"></div>
                    {/* Tool Group: Privacy */}
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
                    <div className="h-[1px] bg-[#ece7f4] dark:bg-[#2d2245] mx-5"></div>
                    {/* Footer Stats */}
                    <div className="mt-auto p-4 bg-background-light dark:bg-[#1c142b]/50 border-t border-[#ece7f4] dark:border-[#2d2245]">
                        <div className="flex items-center justify-between text-[11px] font-medium opacity-60">
                            <span>Captured just now</span>
                            <span>{capturedImage ? `${(capturedImage.length / 1024 / 1.33).toFixed(1)} KB` : '0 KB'}</span>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default Editor;
