import React, { useRef, useState, useEffect } from 'react';
import { RefreshCcw, Check, Trash2, Undo, Redo, Pen, Minus, Circle } from 'lucide-react';
import { Layer } from '../types';
import socketService from '../services/socketService';

interface CanvasProps {
  roomCode: string;
  onConfirm: (imageData: string) => void;
  disabled: boolean;
  strokeColor: string;
  previousLayers: Layer[];
  zoom: number;
}

const Canvas: React.FC<CanvasProps> = ({ roomCode, onConfirm, disabled, strokeColor, previousLayers, zoom }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Local zoom state for mobile pinch-to-zoom
  const [localZoom, setLocalZoom] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const lastTouchDistance = useRef<number>(0);

  // Pan state for mouse wheel scrolling
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Tool state
  const [tool, setTool] = useState<'PEN' | 'LINE' | 'CIRCLE'>('PEN');
  const dragStartImageData = useRef<ImageData | null>(null);
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);

  const loadedImagesRef = useRef<(HTMLImageElement | null)[]>([]);

  // Undo/Redo state
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);
  const MAX_HISTORY = 50;

  // Remote drawing handling - REMOVED for privacy
  useEffect(() => {
    // We intentionally do NOT listen for draw_stroke events anymore.
    // Real-time drawing is disabled.
    return () => {
      socketService.socket?.off('draw_stroke');
    };
  }, []);

  useEffect(() => {
    // Preload previous layer images for composite operations
    loadedImagesRef.current = new Array(previousLayers.length).fill(null);
    previousLayers.forEach((layer, index) => {
      const img = new Image();
      img.src = layer.imageUrl;
      img.onload = () => {
        loadedImagesRef.current[index] = img;
      };
    });
  }, [previousLayers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set resolution - Even larger canvas!
    canvas.width = 1200;
    canvas.height = 900;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Initialize with transparent background (or white if preferred, but transparent allows layers)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;

      // Save initial empty state
      saveState();
    }
  }, []);

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY)
    };
  };

  // Save canvas state to history
  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(dataUrl);

    // Limit history size
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  // Undo function
  const undo = () => {
    if (historyStep <= 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const newStep = historyStep - 1;
    const img = new Image();
    img.src = history[newStep];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setHistoryStep(newStep);
    };
  };

  // Redo function
  const redo = () => {
    if (historyStep >= history.length - 1) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const newStep = historyStep + 1;
    const img = new Image();
    img.src = history[newStep];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setHistoryStep(newStep);
    };
  };

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only on desktop (not disabled mode)
      if (disabled) return;

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStep, history, disabled]);

  // --- FLOOD FILL ALGORITHM ---
  const floodFill = (startX: number, startY: number, fillHex: string, isRemote = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!isRemote) {
      // socketService.emitDrawStroke(roomCode, { x: startX, y: startY, type: 'fill', color: fillHex, tool: 'FILL' });
    }

    // 1. Create composite canvas for boundary checking
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = canvas.width;
    compositeCanvas.height = canvas.height;
    const compositeCtx = compositeCanvas.getContext('2d');
    if (!compositeCtx) return;

    // Draw all previous layers first
    previousLayers.forEach((_, index) => {
      const img = loadedImagesRef.current[index];
      if (img) {
        compositeCtx.drawImage(img, 0, 0);
      }
    });
    // Draw current canvas on top
    compositeCtx.drawImage(canvas, 0, 0);

    // Get image data from both composite (for reading) and current (for writing)
    const compositeImageData = compositeCtx.getImageData(0, 0, canvas.width, canvas.height);
    const targetImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const { width, height, data: prevData } = compositeImageData; // Read from here
    const { data: targetData } = targetImageData; // Write to here

    // 2. Parse target color (hex to rgba)
    const rFill = parseInt(fillHex.slice(1, 3), 16);
    const gFill = parseInt(fillHex.slice(3, 5), 16);
    const bFill = parseInt(fillHex.slice(5, 7), 16);
    const aFill = 255; // Always fill with full opacity

    // 3. Get start color from COMPOSITE
    const startPos = (startY * width + startX) * 4;
    const rStart = prevData[startPos];
    const gStart = prevData[startPos + 1];
    const bStart = prevData[startPos + 2];
    const aStart = prevData[startPos + 3];

    // If trying to fill with the exact same color, do nothing
    if (rStart === rFill && gStart === gFill && bStart === bFill && aStart === aFill) {
      return;
    }

    // 4. Stack-based recursive fill
    const stack = [[startX, startY]];

    const matchStartColor = (pos: number) => {
      return (
        prevData[pos] === rStart &&
        prevData[pos + 1] === gStart &&
        prevData[pos + 2] === bStart &&
        prevData[pos + 3] === aStart
      );
    };

    const colorPixel = (pos: number) => {
      // Update composite (so we don't revisit)
      prevData[pos] = rFill;
      prevData[pos + 1] = gFill;
      prevData[pos + 2] = bFill;
      prevData[pos + 3] = aFill;

      // Update target (actual canvas)
      targetData[pos] = rFill;
      targetData[pos + 1] = gFill;
      targetData[pos + 2] = bFill;
      targetData[pos + 3] = aFill;
    };

    while (stack.length) {
      let [x, y] = stack.pop()!;
      let pixelPos = (y * width + x) * 4;

      // Move up as long as we match start color
      while (y >= 0 && matchStartColor(pixelPos)) {
        y--;
        pixelPos -= width * 4;
      }

      // Move down one step to get back to a valid pixel
      pixelPos += width * 4;
      y++;

      let reachLeft = false;
      let reachRight = false;

      // Move down, coloring and scanning left/right
      while (y < height && matchStartColor(pixelPos)) {
        colorPixel(pixelPos);

        if (x > 0) {
          if (matchStartColor(pixelPos - 4)) {
            if (!reachLeft) {
              stack.push([x - 1, y]);
              reachLeft = true;
            }
          } else if (reachLeft) {
            reachLeft = false;
          }
        }

        if (x < width - 1) {
          if (matchStartColor(pixelPos + 4)) {
            if (!reachRight) {
              stack.push([x + 1, y]);
              reachRight = true;
            }
          } else if (reachRight) {
            reachRight = false;
          }
        }

        y++;
        pixelPos += width * 4;
      }
    }

    // 5. Put updated TARGET image data back
    ctx.putImageData(targetImageData, 0, 0);
    setHasDrawn(true);

    // Save state after fill operation
    if (!isRemote) {
      saveState();
    }
  };

  // Pinch-to-zoom handlers
  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Two fingers - pinch to zoom
      setIsPinching(true);
      lastTouchDistance.current = getTouchDistance(e.touches);
      e.preventDefault();
    } else if (e.touches.length === 1 && !disabled) {
      // Single finger - draw
      startDrawing(e);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinching) {
      // Pinch zoom
      const currentDistance = getTouchDistance(e.touches);
      if (lastTouchDistance.current > 0) {
        const delta = currentDistance - lastTouchDistance.current;
        const zoomDelta = delta * 0.005; // Sensitivity
        setLocalZoom(prev => Math.max(0.5, Math.min(3, prev + zoomDelta)));
      }
      lastTouchDistance.current = currentDistance;
      e.preventDefault();
    } else if (e.touches.length === 1 && !isPinching && !disabled) {
      // Continue drawing
      draw(e);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPinching(false);
      lastTouchDistance.current = 0;
    }
    if (e.touches.length === 0 && !disabled) {
      stopDrawing(e);
    }
  };

  // Mouse wheel handler for zoom (Alt+wheel) and scroll
  const handleWheel = (e: React.WheelEvent) => {
    console.log('🖱️ Wheel event:', { altKey: e.altKey, deltaY: e.deltaY });

    if (e.altKey) {
      // Alt + wheel = zoom
      e.preventDefault();
      const delta = -e.deltaY * 0.003; // Increased sensitivity
      const newZoom = Math.max(0.5, Math.min(3, localZoom + delta));
      console.log('🔍 Zooming:', { from: localZoom, to: newZoom, delta });
      setLocalZoom(newZoom);
    } else {
      // Regular wheel = pan canvas
      e.preventDefault();
      setPanY(prev => prev - e.deltaY);
      setPanX(prev => prev - e.deltaX);
      console.log('🖐️ Panning:', { x: -e.deltaX, y: -e.deltaY });
    }
  };


  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;

    setIsDrawing(true);
    const { x, y } = getPointerPos(e);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    if (tool === 'PEN') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      // Draw a single dot immediately so taps work
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      setHasDrawn(true);

      console.log('🟢 Emitting draw_stroke START at', x, y);
      // socketService.emitDrawStroke(roomCode, { x, y, type: 'start', color: strokeColor, tool: 'PEN' });
    } else {
      // For Line and Circle, we save the state to restore it during drag
      dragStartImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setStartPos({ x, y });
    }
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDrawing) {
      setIsDrawing(false);
      const { x, y } = getPointerPos(e);

      console.log('🔴 Emitting draw_stroke END');
      // socketService.emitDrawStroke(roomCode, { x, y, type: 'end', color: strokeColor, tool: 'PEN' });

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.beginPath(); // Reset path locally

        // If we were drawing a shape, finalize it (it's already drawn in the last draw call, 
        // effectively we just need to ensure we mark as drawn and clear temp state)
        if (tool !== 'PEN' && startPos) {
          setHasDrawn(true);
          setStartPos(null);
          dragStartImageData.current = null;
        }
      }

      // Save state after completing a stroke
      saveState();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Force strict pen color
    ctx.strokeStyle = strokeColor;

    // Smooth lines
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;

    const { x, y } = getPointerPos(e);

    if (tool === 'PEN') {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      setHasDrawn(true);
      // socketService.emitDrawStroke(roomCode, { x, y, type: 'draw', color: strokeColor, tool: 'PEN' });
    } else if (startPos && dragStartImageData.current) {
      // Restore original state
      ctx.putImageData(dragStartImageData.current, 0, 0);

      ctx.beginPath();
      if (tool === 'LINE') {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(x, y);
      } else if (tool === 'CIRCLE') {
        const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
      }
      ctx.stroke();
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
      saveState();
    }
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onConfirm(canvas.toDataURL('image/png'));
      // Clear after confirm so user can't double submit easily
      clear();
    }
  };

  // Dimensions for the wrapper - use localZoom for responsive sizing
  const effectiveZoom = localZoom;
  const wrapperWidth = 800 * effectiveZoom;
  const wrapperHeight = 600 * effectiveZoom;

  return (
    <div className="flex flex-col items-center gap-2 select-none w-full h-full relative">

      {/* Floating Toolbar at Top (if it's my turn) */}
      {!disabled && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 landscape:top-1/2 landscape:left-4 landscape:-translate-x-0 landscape:-translate-y-1/2 lg:landscape:top-2 lg:landscape:left-1/2 lg:landscape:-translate-x-1/2 lg:landscape:-translate-y-0 flex flex-col landscape:flex-row lg:landscape:flex-col items-center gap-1 sm:gap-2 z-40 w-[98%] sm:w-auto max-w-[95vw] landscape:w-auto landscape:max-h-[95vh] lg:landscape:w-[98%] lg:landscape:max-w-[95vw] lg:landscape:max-h-none">

          {/* Tool Selector & Color Picker Container */}
          <div className="flex flex-col landscape:flex-col-reverse lg:landscape:flex-col items-center gap-2">



            {/* Main Tools & Actions Group */}
            <div className="flex flex-col sm:flex-row landscape:flex-col lg:landscape:flex-row items-center gap-1 sm:gap-2 bg-white/95 backdrop-blur-sm border-2 border-black p-2 rounded-lg shadow-xl w-full sm:w-auto landscape:w-auto lg:landscape:w-auto">

              {/* Tool Selection */}
              <div className="flex gap-1.5 landscape:gap-2 landscape:flex-col lg:landscape:flex-row border-r-2 border-gray-200 pr-2">
                <button
                  onClick={() => setTool('PEN')}
                  className={`flex items-center justify-center p-2.5 sm:p-2 border-2 text-sm rounded-md transition shadow-sm active:translate-y-px min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 ${tool === 'PEN' ? 'bg-black text-white border-black' : 'bg-gray-100 border-gray-900 text-black hover:bg-gray-200'}`}
                  title="Pen Tool"
                >
                  <Pen size={20} className="sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={() => setTool('LINE')}
                  className={`flex items-center justify-center p-2.5 sm:p-2 border-2 text-sm rounded-md transition shadow-sm active:translate-y-px min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 ${tool === 'LINE' ? 'bg-black text-white border-black' : 'bg-gray-100 border-gray-900 text-black hover:bg-gray-200'}`}
                  title="Line Tool"
                >
                  <Minus size={20} className="sm:w-4 sm:h-4 transform -rotate-45" />
                </button>
                <button
                  onClick={() => setTool('CIRCLE')}
                  className={`flex items-center justify-center p-2.5 sm:p-2 border-2 text-sm rounded-md transition shadow-sm active:translate-y-px min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 ${tool === 'CIRCLE' ? 'bg-black text-white border-black' : 'bg-gray-100 border-gray-900 text-black hover:bg-gray-200'}`}
                  title="Circle Tool"
                >
                  <Circle size={20} className="sm:w-4 sm:h-4" />
                </button>
              </div>

              {/* Undo/Redo/Clear/Submit */}
              <div className="flex flex-wrap landscape:flex-col lg:landscape:flex-row justify-center gap-1.5 landscape:gap-2">
                <div className="flex gap-1.5 landscape:gap-2 landscape:flex-col lg:landscape:flex-row">
                  <button
                    onClick={undo}
                    disabled={historyStep <= 0}
                    className="flex items-center justify-center p-2.5 sm:p-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border-2 border-gray-900 text-black text-sm rounded-md transition shadow-sm active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo size={20} className="sm:w-4 sm:h-4" />
                  </button>
                  <button
                    onClick={redo}
                    disabled={historyStep >= history.length - 1}
                    className="flex items-center justify-center p-2.5 sm:p-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border-2 border-gray-900 text-black text-sm rounded-md transition shadow-sm active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <Redo size={20} className="sm:w-4 sm:h-4" />
                  </button>
                </div>

                <button
                  onClick={clear}
                  className="flex items-center gap-1.5 px-3 py-2.5 sm:px-3 sm:py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border-2 border-gray-900 text-black text-sm rounded-md transition shadow-sm active:translate-y-px justify-center min-h-[44px] sm:min-h-0 landscape:w-full landscape:h-10 lg:landscape:w-auto lg:landscape:h-auto"
                  title="Clear Canvas"
                >
                  <Trash2 size={18} className="sm:w-4 sm:h-4" />
                  <span className="text-sm font-medium landscape:hidden lg:landscape:inline">Clear</span>
                </button>

                <button
                  onClick={handleConfirm}
                  disabled={!hasDrawn}
                  className="flex items-center gap-1.5 px-4 py-2.5 sm:px-4 sm:py-2 bg-black hover:bg-gray-900 active:bg-gray-800 border-2 border-black text-white text-sm font-bold rounded-md disabled:opacity-50 disabled:grayscale transition shadow-sm active:translate-y-px justify-center min-h-[44px] sm:min-h-0 landscape:w-full landscape:h-10 landscape:mt-2 lg:landscape:w-auto lg:landscape:h-auto lg:landscape:mt-0"
                  title="Submit Drawing"
                >
                  <Check size={18} className="sm:w-4 sm:h-4" />
                  <span className="font-semibold lg:landscape:inline hidden sm:block">Submit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )
      }

      {/* Canvas Area - Full Height */}
      <div ref={containerRef} className="bg-gray-200 shadow-inner overflow-auto w-full flex-1 flex items-center justify-center border-2 border-black p-2 sm:p-4" onWheel={handleWheel}>

        {/* Zoom Wrapper with Pan */}
        <div style={{
          width: wrapperWidth,
          height: wrapperHeight,
          flexShrink: 0,
          position: 'relative',
          transform: `translate(${panX}px, ${panY}px)`,
          transition: 'transform 0.1s ease-out'
        }}>
          <div
            className="relative shadow-lg bg-white origin-top-left transition-transform duration-75"
            style={{
              width: '800px',
              height: '600px',
              transform: `scale(${effectiveZoom})`,
              cursor: 'default',
            }}
          >

            {/* Previous Layers (Background) */}
            {previousLayers.map((layer, idx) => (
              <img
                key={idx}
                src={layer.imageUrl}
                alt="layer"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-multiply"
              />
            ))}

            {/* Active Canvas (Foreground) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 z-10 w-full h-full"
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseMove={draw}
              onMouseLeave={stopDrawing}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
            />

            {disabled && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-transparent text-black/50 font-bold text-2xl select-none pointer-events-none uppercase tracking-widest">
                {/* Overlay intentionally mostly transparent to see drawing */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
};


export default Canvas;
