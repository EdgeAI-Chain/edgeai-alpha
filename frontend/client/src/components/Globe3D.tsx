import createGlobe from "cobe";
import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

interface MarkerData {
  location: [number, number];
  size: number;
  tooltip?: React.ReactNode;
  [key: string]: any;
}

interface Connection {
  start: [number, number];
  end: [number, number];
}

interface HeatmapPoint {
  lat: number;
  lon: number;
  value: number; // 0 to 1 intensity
}

interface Globe3DProps {
  className?: string;
  markers?: MarkerData[];
  connections?: Connection[];
  heatmapPoints?: HeatmapPoint[];
  onMarkerClick?: (marker: MarkerData) => void;
  scale?: number;
  sizingMode?: 'fit' | 'cover'; // New prop: 'fit' (default) or 'cover'
}

export function Globe3D({ className, markers = [], connections = [], heatmapPoints = [], onMarkerClick, scale = 1.5, sizingMode = 'fit' }: Globe3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phi = useRef(0);
  const theta = useRef(0.4);
  const [hoveredMarker, setHoveredMarker] = useState<{ x: number; y: number; content: React.ReactNode; marker?: MarkerData } | null>(null);
  const widthRef = useRef(0);
  const renderWidthRef = useRef(0); // Actual WebGL render width (clamped)
  const { theme } = useTheme();
  
  // Physics state for inertia
  const velocity = useRef(0);
  const lastTime = useRef(Date.now());
  const isDragging = useRef(false);

  // Mutable state for markers to avoid re-creating globe on every update
  const markersRef = useRef(markers);
  
  // Update markers ref when props change
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // Helper function to project 3D coordinates to 2D screen space
  const projectToScreen = (lat: number, lon: number, currentPhi: number, currentTheta: number, width: number) => {
    const cx = width / 2;
    const cy = width / 2;
    const r = width / 2;

    // Convert lat/lon to radians
    const phiRad = lat * Math.PI / 180;
    const lambdaRad = lon * Math.PI / 180;

    // 3D position on unit sphere
    const lambda = lambdaRad + currentPhi;
    
    // Position on sphere
    const x0 = Math.cos(phiRad) * Math.sin(lambda);
    const y0 = Math.sin(phiRad);
    const z0 = Math.cos(phiRad) * Math.cos(lambda);
    
    // Tilt
    const y1 = y0 * Math.cos(currentTheta) - z0 * Math.sin(currentTheta);
    const z1 = y0 * Math.sin(currentTheta) + z0 * Math.cos(currentTheta);
    const x1 = x0;
    
    // Projection
    const screenX = cx + x1 * r;
    const screenY = cy - y1 * r;
    
    return { x: screenX, y: screenY, z: z1 };
  };

  // State to trigger re-render when width changes
  const [globeWidth, setGlobeWidth] = useState(0);

  useEffect(() => {
    let width = 0;
    
    const onResize = () => {
      if (containerRef.current) {
        // Get container dimensions
        const rect = containerRef.current.getBoundingClientRect();
        
        // Calculate base width based on sizing mode
        let baseSize;
        if (sizingMode === 'cover') {
          // In cover mode, use the larger dimension to ensure filling
          // But we still want to respect the scale prop
          baseSize = Math.max(rect.width, rect.height);
        } else {
          // In fit mode (default), use the smaller dimension to ensure containment
          baseSize = Math.min(rect.width, rect.height);
        }
        
        // Fallback if measurement is 0 (e.g. initial render in hidden tab or collapsed container)
        if (baseSize === 0) {
          baseSize = 300; // Default fallback size
        }
        
        width = baseSize * scale;
        widthRef.current = width;
        setGlobeWidth(width);
        
        // Clamp render resolution to prevent WebGL context loss on high-res screens
        // Max texture size is usually 4096 or 8192, but we want to be safe
        // We force devicePixelRatio to 1, so we can use up to 2048px width (2048x2048 canvas)
        // This is extremely safe for all devices
        const MAX_RENDER_WIDTH = 2048;
        const renderWidth = Math.min(width, MAX_RENDER_WIDTH);
        renderWidthRef.current = renderWidth;
        
        // Update canvas sizes
        if (canvasRef.current) {
          // CSS size (display size) - can be very large
          canvasRef.current.style.width = `${width}px`;
          canvasRef.current.style.height = `${width}px`;
          // Render size (internal buffer) - clamped for safety
          // Force 1:1 pixel mapping for safety
          canvasRef.current.width = renderWidth;
          canvasRef.current.height = renderWidth;
        }
        
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.style.width = `${width}px`;
          overlayCanvasRef.current.style.height = `${width}px`;
          overlayCanvasRef.current.width = renderWidth;
          overlayCanvasRef.current.height = renderWidth;
        }
      }
    };
    
    // Use ResizeObserver instead of window.resize for more robust container tracking
    const resizeObserver = new ResizeObserver(() => {
      onResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    // Initial size calculation
    onResize();
    
    // Force a second check after a short delay to catch layout shifts
    const timer = setTimeout(onResize, 100);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timer);
    };
  }, [scale, sizingMode]); // Only re-run resize logic when scale or sizingMode changes

  // Separate effect for Globe initialization that depends on globeWidth
  useEffect(() => {
    // Wait for valid width before initializing globe
    // Relaxed check: allow initialization if we have a fallback width
    if (!canvasRef.current || globeWidth === 0 || renderWidthRef.current === 0) return;

    // Pre-calculate random phases for breathing effect
    const markerPhases = new Map<string, number>();
    
    const getMarkerPhase = (index: number) => {
      const key = index.toString();
      if (!markerPhases.has(key)) {
        markerPhases.set(key, Math.random() * Math.PI * 2);
      }
      return markerPhases.get(key)!;
    };
    
    // Helper to project 3D coordinates to 2D screen space (duplicated for use inside onRender)
    const project = (lat: number, lon: number, currentPhi: number, currentTheta: number, w: number) => {
      const cx = w / 2;
      const cy = w / 2;
      const r = w / 2;

      const phiRad = lat * Math.PI / 180;
      const lambdaRad = lon * Math.PI / 180;
      const lambda = lambdaRad + currentPhi;
      
      const x0 = Math.cos(phiRad) * Math.sin(lambda);
      const y0 = Math.sin(phiRad);
      const z0 = Math.cos(phiRad) * Math.cos(lambda);
      
      const y1 = y0 * Math.cos(currentTheta) - z0 * Math.sin(currentTheta);
      const z1 = y0 * Math.sin(currentTheta) + z0 * Math.cos(currentTheta);
      const x1 = x0;
      
      return { x: cx + x1 * r, y: cy - y1 * r, z: z1 };
    };

    // Determine colors based on theme
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    const globeConfig = isDark ? {
      baseColor: [0.05, 0.05, 0.1], // Darker base for more contrast
      markerColor: [0.2, 0.8, 1],
      glowColor: [0.1, 0.3, 0.7], // Richer glow
      dark: 1,
      mapBrightness: 8, // Brighter map lines against dark background
      diffuse: 2, // More pronounced lighting
    } : {
      baseColor: [0.92, 0.92, 0.98], // Very light cool gray
      markerColor: [0.1, 0.3, 0.9], // Deep blue markers
      glowColor: [0.7, 0.8, 1], // Subtle daylight glow
      dark: 0,
      mapBrightness: 1.5,
      diffuse: 1.5,
    };

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 1, // Force 1 to avoid high-DPI scaling issues
      width: renderWidthRef.current, // Match canvas width exactly
      height: renderWidthRef.current, // Match canvas height exactly
      phi: 0,
      theta: theta.current,
      dark: globeConfig.dark,
      diffuse: globeConfig.diffuse,
      mapSamples: 16000,
      mapBrightness: globeConfig.mapBrightness,
      baseColor: globeConfig.baseColor as [number, number, number],
      markerColor: globeConfig.markerColor as [number, number, number],
      glowColor: globeConfig.glowColor as [number, number, number],
      markers: [], // Start empty, we'll inject markers in onRender
      onRender: (state) => {
        // Physics-based inertia logic
        if (!isDragging.current) {
          // Apply damping to velocity
          velocity.current *= 0.95;
          
          // Minimum rotation speed (auto-rotate)
          if (Math.abs(velocity.current) < 0.003) {
            velocity.current = 0.003; // Faster constant rotation
          }
          
          phi.current += velocity.current;
        }
        
        state.phi = phi.current;
        // Use clamped render width for internal state
        state.width = renderWidthRef.current;
        state.height = renderWidthRef.current;

        // Get current markers from ref
        const currentMarkers = markersRef.current;
        const time = Date.now() / 1000;

        // Update markers state directly
        state.markers = currentMarkers.map((marker, i) => {
          const baseSize = marker.size;
          // Sine wave breathing: size varies between 80% and 120%
          // Different phase for each marker creates "twinkling" effect
          const phase = getMarkerPhase(i);
          
          // If marker has a "pulse" property (added by simulator), make it flash
          const pulse = marker.pulse ? Math.sin(time * 10) * 0.5 + 0.5 : 0;
          const scale = 1 + Math.sin(time * 2 + phase) * 0.3 + pulse;
          
          return {
            location: marker.location,
            size: baseSize * scale
          };
        });

        // Draw connections on overlay canvas
        if (overlayCanvasRef.current) {
          const ctx = overlayCanvasRef.current.getContext('2d');
          if (ctx) {
            // Use clamped render width for clearing and drawing
            const rw = renderWidthRef.current;
            ctx.clearRect(0, 0, rw, rw);
            ctx.lineWidth = 1;
            
            // Draw Heatmap Points
            if (heatmapPoints.length > 0) {
              ctx.globalCompositeOperation = 'lighter'; // Additive blending for heatmap effect
              
              heatmapPoints.forEach(point => {
                const pos = project(point.lat, point.lon, state.phi, state.theta, rw);
                
                // Only draw if visible (front side of globe)
                if (pos.z > 0) {
                  const dist = Math.sqrt(pos.x*pos.x + pos.y*pos.y); // simple culling if needed, but z check is mostly enough
                  
                  // Create radial gradient for soft glow
                  // Size depends on value
                  const radius = 15 * point.value * (rw / 400); // Scale with globe size
                  if (radius < 1) return;

                  const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
                  gradient.addColorStop(0, `rgba(255, 100, 50, ${0.8 * point.value})`); // Hot center
                  gradient.addColorStop(0.5, `rgba(255, 50, 0, ${0.3 * point.value})`); // Mid glow
                  gradient.addColorStop(1, 'rgba(255, 0, 0, 0)'); // Transparent edge

                  ctx.fillStyle = gradient;
                  ctx.beginPath();
                  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
                  ctx.fill();
                }
              });
              
              ctx.globalCompositeOperation = 'source-over'; // Reset blending
            }

            // Draw connections
            connections.forEach((conn, i) => {
              const start = project(conn.start[0], conn.start[1], state.phi, state.theta, rw);
              const end = project(conn.end[0], conn.end[1], state.phi, state.theta, rw);

              // Only draw if both points are somewhat visible or close to visible
              // Simple visibility check: z > -0.2 (allow slightly behind horizon for continuity)
              if (start.z > -0.5 && end.z > -0.5) {
                // Calculate control point for curve (midpoint elevated)
                // Simple quadratic bezier: midpoint of straight line
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                
                // Add some curvature based on distance
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // Perpendicular vector
                const perpX = -dy / dist;
                const perpY = dx / dist;
                
                // Curve height depends on distance
                const curveHeight = dist * 0.3;
                
                const cpX = midX + perpX * curveHeight;
                const cpY = midY + perpY * curveHeight;

                ctx.beginPath();
                ctx.strokeStyle = isDark ? `rgba(100, 200, 255, 0.3)` : `rgba(50, 100, 255, 0.3)`;
                ctx.moveTo(start.x, start.y);
                ctx.quadraticCurveTo(cpX, cpY, end.x, end.y);
                ctx.stroke();

                // Draw moving particle
                const period = 2000; // 2 seconds per trip
                const offset = (Date.now() + i * 100) % period / period;
                
                // Calculate point on bezier
                const t = offset;
                const invT = 1 - t;
                const pX = invT * invT * start.x + 2 * invT * t * cpX + t * t * end.x;
                const pY = invT * invT * start.y + 2 * invT * t * cpY + t * t * end.y;

                ctx.beginPath();
                ctx.fillStyle = isDark ? '#00ffff' : '#0055ff'; // Darker particle for light mode
                ctx.arc(pX, pY, 2, 0, Math.PI * 2);
                ctx.fill();
              }
            });
          }
        }
      },
    });

    return () => {
      globe.destroy();
    };
  }, [theme, globeWidth]); // Re-run when theme or globeWidth changes (which happens after resize)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      const delta = e.clientX - (pointerInteracting.current || 0);
      pointerInteracting.current = e.clientX;
      
      // Update velocity based on drag speed
      velocity.current = delta * 0.005;
      phi.current += velocity.current;
      return;
    }

    // Hover detection logic
    if (!canvasRef.current) return;
    
    // Get canvas rect to calculate relative position
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // For hit testing, we need to map the mouse position (relative to CSS size)
    // to the render coordinate space
    const renderWidth = renderWidthRef.current;
    const displayWidth = widthRef.current;
    
    // Scale factor between display and render size
    const scaleFactor = renderWidth / displayWidth;
    
    // Center of the globe in render space
    const cx = renderWidth / 2;
    const cy = renderWidth / 2;
    const r = renderWidth / 2;

    // Current rotation
    const currentPhi = phi.current;
    const currentTheta = theta.current;

    let found = null;

    // Use ref for markers to get latest state
    for (const marker of markersRef.current) {
      if (!marker.tooltip) continue;

      const { x: screenX, y: screenY, z: z1 } = projectToScreen(
        marker.location[0], 
        marker.location[1], 
        currentPhi, 
        currentTheta, 
        renderWidth
      );

      // Check if marker is visible (front side)
      if (z1 > 0) {
        // Mouse position in render space
        const mouseXInRender = x * scaleFactor;
        const mouseYInRender = y * scaleFactor;
        
        // Distance check (hit radius)
        const dx = mouseXInRender - screenX; // No divide by 2 since we use 1:1 pixel ratio
        const dy = mouseYInRender - screenY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Hit radius depends on marker size but at least 10px (scaled)
        const hitRadius = Math.max(10 * scaleFactor, marker.size * 200 * scaleFactor); 
        
        if (dist < hitRadius) {
          // Store position relative to canvas for tooltip (convert back to display space)
          found = { 
            x: screenX / scaleFactor, 
            y: screenY / scaleFactor, 
            content: marker.tooltip, 
            marker 
          };
          break; // Found top-most marker
        }
      }
    }

    setHoveredMarker(found);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    pointerInteracting.current = e.clientX;
    isDragging.current = true;
    velocity.current = 0; // Stop auto-rotation while dragging
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = () => {
    pointerInteracting.current = null;
    isDragging.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }
    
    // Handle click on marker
    if (hoveredMarker && hoveredMarker.marker && onMarkerClick) {
      onMarkerClick(hoveredMarker.marker);
    }
  };

  const handleMouseOut = () => {
    pointerInteracting.current = null;
    isDragging.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }
    setHoveredMarker(null);
  };

  return (
    <div 
      ref={containerRef}
      className={cn("relative w-full h-full cursor-grab touch-none flex items-center justify-center overflow-hidden", className)}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseOut}
      onTouchStart={(e) => {
        pointerInteracting.current = e.touches[0].clientX;
        isDragging.current = true;
        velocity.current = 0;
      }}
      onTouchMove={(e) => {
        if (isDragging.current) {
          const delta = e.touches[0].clientX - (pointerInteracting.current || 0);
          pointerInteracting.current = e.touches[0].clientX;
          velocity.current = delta * 0.005;
          phi.current += velocity.current;
        }
      }}
      onTouchEnd={() => {
        pointerInteracting.current = null;
        isDragging.current = false;
      }}
    >
      {/* Wrapper to enforce square aspect ratio for the globe */}
      <div className="relative" style={{ width: globeWidth || '100%', height: globeWidth || '100%', minHeight: '300px' }}>
        {/* Atmospheric Glow Effect */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none z-0"
          style={{
            background: theme === 'dark' 
              ? 'radial-gradient(circle at 50% 50%, rgba(50, 100, 255, 0.15) 0%, rgba(0, 0, 0, 0) 70%)'
              : 'radial-gradient(circle at 50% 50%, rgba(50, 100, 255, 0.1) 0%, rgba(255, 255, 255, 0) 70%)',
            filter: 'blur(20px)',
            transform: 'scale(1.2)'
          }}
        />
        
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full opacity-100 transition-opacity duration-1000 ease-in-out z-10"
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
        />
        
        {/* Tooltip */}
        {hoveredMarker && (
          <div 
            className="absolute z-50 pointer-events-none"
            style={{ 
              left: hoveredMarker.x, 
              top: hoveredMarker.y,
              transform: 'translate(-50%, -100%) translateY(-10px)'
            }}
          >
            <div className="bg-popover/90 backdrop-blur-sm text-popover-foreground text-xs rounded-md px-2 py-1 shadow-lg border border-border whitespace-nowrap">
              {hoveredMarker.content}
              <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-popover/90 border-r border-b border-border"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
