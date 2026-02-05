import { useState, useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { createArrow } from '../lib/CanvasUtils';

export const useFabricEditor = () => {
    const [activeTool, setActiveTool] = useState('select');
    const [strokeColor, setStrokeColor] = useState('#8B5CF6');
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [isCropping, setIsCropping] = useState(false);
    const [cropRect, setCropRect] = useState<fabric.Rect | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvas = useRef<fabric.Canvas | null>(null);
    const isDrawing = useRef(false);
    const startPoint = useRef<{ x: number; y: number } | null>(null);
    const activeObject = useRef<fabric.Object | null>(null);
    const history = useRef<string[]>([]);

    // Refs for listeners to avoid stale closures
    const activeToolRef = useRef(activeTool);
    const strokeColorRef = useRef(strokeColor);
    const strokeWidthRef = useRef(strokeWidth);

    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
    useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
    useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);

    // Update brush when color or width changes
    useEffect(() => {
        const canvas = fabricCanvas.current;
        if (canvas) {
            if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
                canvas.freeDrawingBrush.color = strokeColor;
                canvas.freeDrawingBrush.width = strokeWidth;
            }
            const activeObj = canvas.getActiveObject();
            if (activeObj) {
                if ('stroke' in activeObj) activeObj.set({ stroke: strokeColor });
                if ('strokeWidth' in activeObj) activeObj.set({ strokeWidth: strokeWidth });
                if (activeObj instanceof fabric.IText) activeObj.set({ fill: strokeColor });
                canvas.renderAll();
            }
        }
    }, [strokeColor, strokeWidth]);

    const saveState = () => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;
        const json = JSON.stringify(canvas.toJSON());
        if (history.current[historyIndex] === json) return;

        const newHistory = history.current.slice(0, historyIndex + 1);
        newHistory.push(json);
        if (newHistory.length > 50) newHistory.shift();

        history.current = newHistory;
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const canvas = fabricCanvas.current;
            if (!canvas) return;
            const prevState = history.current[historyIndex - 1];
            canvas.loadFromJSON(prevState, () => {
                canvas.renderAll();
                setHistoryIndex(historyIndex - 1);
            });
        }
    };

    const redo = () => {
        if (historyIndex < history.current.length - 1) {
            const canvas = fabricCanvas.current;
            if (!canvas) return;
            const nextState = history.current[historyIndex + 1];
            canvas.loadFromJSON(nextState, () => {
                canvas.renderAll();
                setHistoryIndex(historyIndex + 1);
            });
        }
    };

    const handleSetZoom = (newZoom: number) => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;
        const zoom = Math.max(0.1, Math.min(5, newZoom));
        setZoomLevel(zoom);
        canvas.setZoom(zoom);
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
        if (!canvasRef.current) return;

        // Initialize fabric canvas if not already done
        if (!fabricCanvas.current) {
            fabricCanvas.current = new fabric.Canvas(canvasRef.current, {
                width: 800,
                height: 600,
                backgroundColor: '#ffffff',
                preserveObjectStacking: true,
            });

            // Set initial tool state
            handleToolChange(activeToolRef.current);
        }

        const canvas = fabricCanvas.current;

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
            if (canvas.isDrawingMode && e.target) {
                saveState();
            }
        });
    };

    const handleToolChange = (tool: string) => {
        setActiveTool(tool);
        const canvas = fabricCanvas.current;
        if (!canvas) return;
        canvas.isDrawingMode = tool === 'pen';
        if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = strokeColor;
            canvas.freeDrawingBrush.width = strokeWidth;
        }
        canvas.selection = tool === 'select';
        canvas.forEachObject((obj) => {
            obj.selectable = tool === 'select' || (tool === 'text' && obj instanceof fabric.IText);
        });
        canvas.renderAll();
    };

    const addText = () => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;
        const text = new fabric.IText('Double click to edit', {
            left: 100,
            top: 100,
            fontFamily: 'Outfit',
            fontSize: 24,
            fill: strokeColor,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        saveState();
    };

    const handleCropConfirm = () => {
        const canvas = fabricCanvas.current;
        if (!canvas || !cropRect) return;
        const left = cropRect.left || 0;
        const top = cropRect.top || 0;
        const width = cropRect.width || 0;
        const height = cropRect.height || 0;
        const croppedDataUrl = canvas.toDataURL({ left, top, width, height, format: 'png' });
        canvas.clear();
        fabric.Image.fromURL(croppedDataUrl, (img) => {
            canvas.setDimensions({ width, height });
            canvas.setBackgroundImage(img, () => {
                canvas.renderAll();
                saveState();
            });
        }, { crossOrigin: 'anonymous' });
        setIsCropping(false);
        setCropRect(null);
        handleToolChange('select');
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

    return {
        canvasRef,
        fabricCanvas,
        activeTool,
        strokeColor,
        setStrokeColor,
        strokeWidth,
        setStrokeWidth,
        isCropping,
        zoomLevel,
        historyIndex,
        history,
        handleToolChange,
        handleSetZoom,
        undo,
        redo,
        addText,
        handleCropConfirm,
        handleCropCancel,
        setupCanvasEvents,
        saveState,
        initCanvas
    };
};
