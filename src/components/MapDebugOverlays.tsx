import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LocationPin } from '../config';

// Both overlays use the same projection on every camera frame. No separate
// SVG-renderer zoom transform or tooltip positioning animation can lag behind.
export default function MapDebugOverlays({ pins, circles, labels, activeId }: {
  pins: LocationPin[]; circles: boolean; labels: boolean; activeId?: string;
}) {
  const map = useMap();
  useEffect(() => {
    if (!circles && !labels) return;
    const root = document.createElement('div');
    root.className = 'map-debug-overlays';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    root.appendChild(svg);
    map.getPanes().tooltipPane.appendChild(root);
    const items = pins.map(pin => {
      const circle = circles ? document.createElementNS('http://www.w3.org/2000/svg', 'ellipse') : null;
      if (circle) {
        const colour = activeId === pin.id ? '#10b981' : '#94a3b8';
        circle.setAttribute('stroke', colour);
        circle.setAttribute('stroke-width', '0.6');
        circle.setAttribute('vector-effect', 'non-scaling-stroke');
        circle.setAttribute('fill', colour);
        circle.setAttribute('fill-opacity', '0.1');
        svg.appendChild(circle);
      }
      const label = labels && pin.id !== 'pin-10b' ? document.createElement('div') : null;
      if (label) {
        label.className = 'leaflet-tooltip leaflet-tooltip-top stop-location-label';
        const name = document.createElement('div');
        name.textContent = pin.name;
        const radius = document.createElement('div');
        radius.className = 'text-[10px] opacity-70';
        radius.textContent = `${pin.radius} m radius`;
        label.append(name, radius);
        root.appendChild(label);
      }
      return { pin, circle, label };
    });
    const update = () => {
      const size = map.getSize();
      const offset = map.containerPointToLayerPoint([0, 0]);
      root.style.transition = 'none';
      root.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
      svg.setAttribute('width', String(size.x));
      svg.setAttribute('height', String(size.y));
      const origin = map.getPixelOrigin();
      const project = (position: L.LatLng) => map.project(position, map.getZoom()).subtract(origin).subtract(offset);
      for (const { pin, circle, label } of items) {
        const position = L.latLng(pin.lat, pin.lng);
        const point = project(position);
        if (circle) {
          const bounds = position.toBounds(pin.radius * 2);
          const nw = project(bounds.getNorthWest()), se = project(bounds.getSouthEast());
          circle.setAttribute('cx', String(point.x));
          circle.setAttribute('cy', String(point.y));
          circle.setAttribute('rx', String(Math.abs(se.x - nw.x) / 2));
          circle.setAttribute('ry', String(Math.abs(se.y - nw.y) / 2));
        }
        if (label) label.style.transform = `translate(${point.x}px, ${point.y - 8}px) translate(-50%, -100%)`;
      }
    };
    // Leaflet uses a single CSS transform for wheel/button zooms, unlike flyTo's
    // per-frame move/zoom events. Match that transform for those zooms as well.
    const animateZoom = (event: L.ZoomAnimEvent) => {
      const scale = map.getZoomScale(event.zoom);
      const size = map.getSize();
      const offset = map.containerPointToLayerPoint([0, 0]);
      const shift = map.project(map.getCenter(), event.zoom).subtract(map.project(event.center, event.zoom))
        .add(size.multiplyBy((1 - scale) / 2)).add(offset);
      root.style.transition = 'transform 0.25s cubic-bezier(0,0,0.25,1)';
      root.style.transform = `translate(${shift.x}px, ${shift.y}px) scale(${scale})`;
    };
    update();
    map.on('move zoom resize viewreset', update);
    map.on('zoomanim', animateZoom);
    return () => {
      map.off('move zoom resize viewreset', update);
      map.off('zoomanim', animateZoom);
      root.remove();
    };
  }, [map, pins, circles, labels, activeId]);
  return null;
}
