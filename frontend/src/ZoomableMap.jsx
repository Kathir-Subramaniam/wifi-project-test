import React, { useRef, useState, useCallback, useLayoutEffect } from 'react';

export default function ZoomableMap({ children, viewBox = { w: 1355, h: 1016 }, height = 560 }) {
  const svgRef = useRef(null);
  const homeRef = useRef({ scale: 1, translateX: 0, translateY: 0 });

  const [state, setState] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0,
    isPanning: false,
    panStart: { x: 0, y: 0 },
  });

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const wrapperRef = useRef(null);

  const computeHome = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return homeRef.current;

    const rect = wrapper.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;

    const scale = Math.min(containerW / viewBox.w, containerH / viewBox.h);

    const contentW = viewBox.w * scale;
    const contentH = viewBox.h * scale;

    const translateX = (containerW - contentW) / 2;
    const translateY = (containerH - contentH) / 2;

    return { scale, translateX, translateY };
  }, [viewBox.w, viewBox.h]);

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      const home = computeHome();
      homeRef.current = home;
      setState((s) => ({ ...s, ...home }));
    });
  }, [computeHome]);


  const onWheel = useCallback((e) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = -e.deltaY;
    const zoomFactor = Math.exp(delta * 0.0015);
    const newScale = clamp(state.scale * zoomFactor, 0.5, 6);

    // Zoom around cursor
    const vpX = (mouseX - state.translateX) / state.scale;
    const vpY = (mouseY - state.translateY) / state.scale;

    const newTranslateX = mouseX - vpX * newScale;
    const newTranslateY = mouseY - vpY * newScale;

    setState((s) => ({
      ...s,
      scale: newScale,
      translateX: newTranslateX,
      translateY: newTranslateY,
    }));
  }, [state.scale, state.translateX, state.translateY]);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    setState((s) => ({ ...s, isPanning: true, panStart: { x: e.clientX, y: e.clientY } }));
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!state.isPanning) return;
    const dx = e.clientX - state.panStart.x;
    const dy = e.clientY - state.panStart.y;
    setState((s) => ({
      ...s,
      translateX: s.translateX + dx,
      translateY: s.translateY + dy,
      panStart: { x: e.clientX, y: e.clientY },
    }));
  }, [state.isPanning, state.panStart]);

  const endPan = useCallback(() => {
    if (state.isPanning) setState((s) => ({ ...s, isPanning: false }));
  }, [state.isPanning]);

  const reset = useCallback(() => {
    const home = homeRef.current;
    setState((s) => ({ ...s, ...home }));
  }, []);

  return (
    <div
      className="map-box"
      style={{
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: state.isPanning ? 'grabbing' : 'grab',
      }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endPan}
      onMouseLeave={endPan}
      onDoubleClick={reset}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
        className="ft-map-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${state.translateX}, ${state.translateY}) scale(${state.scale})`}>
          {children}
        </g>
      </svg>

      <button
        onClick={reset}
        style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid #1F2937',
          background: '#0A1220',
          color: '#CDE8FF',
          fontSize: 12,
        }}
      >
        Reset view
      </button>
    </div>
  );
}
