import { fabric } from 'fabric';

export const createArrow = (points: number[], options: fabric.IObjectOptions = {}) => {
    const x1 = points[0];
    const y1 = points[1];
    const x2 = points[2];
    const y2 = points[3];

    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);

    // Arrow line
    const line = new fabric.Line([0, 0, length, 0], {
        stroke: options.stroke || '#8B5CF6',
        strokeWidth: options.strokeWidth || 3,
        originX: 'left',
        originY: 'center',
    });

    // Arrow head
    const headLength = 15;
    const head = new fabric.Triangle({
        width: headLength,
        height: headLength,
        fill: options.stroke || '#8B5CF6',
        left: length,
        top: 0,
        angle: 90,
        originX: 'center',
        originY: 'center',
    });

    const arrow = new fabric.Group([line, head], {
        left: x1,
        top: y1,
        angle: (angle * 180) / Math.PI,
        originX: 'left',
        originY: 'center',
        ...options,
    });

    return arrow;
};

// Pixelate helper
export const applyPixelate = (canvas: fabric.Canvas, rect: fabric.Rect, pixelSize: number = 10) => {
    const backgroundImage = canvas.backgroundImage as fabric.Image;
    if (!backgroundImage) return;

    // Create a temporary canvas to apply pixelate filter
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = rect.width! * (backgroundImage.scaleX || 1);
    tempCanvas.height = rect.height! * (backgroundImage.scaleY || 1);
    const tempCtx = tempCanvas.getContext('2d');

    if (tempCtx) {
        // Draw the specific portion of the background image
        tempCtx.drawImage(
            backgroundImage.getElement() as HTMLImageElement,
            rect.left! * (backgroundImage.scaleX || 1),
            rect.top! * (backgroundImage.scaleY || 1),
            rect.width! * (backgroundImage.scaleX || 1),
            rect.height! * (backgroundImage.scaleY || 1),
            0, 0, tempCanvas.width, tempCanvas.height
        );

        const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

        // Manual pixelate
        for (let y = 0; y < imgData.height; y += pixelSize) {
            for (let x = 0; x < imgData.width; x += pixelSize) {
                const i = (y * imgData.width + x) * 4;
                const r = imgData.data[i];
                const g = imgData.data[i + 1];
                const b = imgData.data[i + 2];

                for (let dy = 0; dy < pixelSize && y + dy < imgData.height; dy++) {
                    for (let dx = 0; dx < pixelSize && x + dx < imgData.width; dx++) {
                        const j = ((y + dy) * imgData.width + (x + dx)) * 4;
                        imgData.data[j] = r;
                        imgData.data[j + 1] = g;
                        imgData.data[j + 2] = b;
                    }
                }
            }
        }
        tempCtx.putImageData(imgData, 0, 0);

        fabric.Image.fromURL(tempCanvas.toDataURL(), (pixelatedImg) => {
            pixelatedImg.set({
                left: rect.left,
                top: rect.top,
                selectable: false,
            });
            canvas.add(pixelatedImg);
            canvas.remove(rect);
            canvas.renderAll();
        });
    }
};
