import { ref } from 'vue';
import type { TrackPoint } from '@/composables/tracker/types';

function buildMarkerHTML(): string {
  return `
    <div class="loc-root">
      <div class="loc-accuracy"></div>
      <svg class="loc-fan" viewBox="0 0 120 120">
        <defs>
          <radialGradient id="fg" cx="50%" cy="100%" r="100%">
            <stop offset="0%" stop-color="#f97316" stop-opacity="0.7"/>
            <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <path d="M 60 60 L 25 10 A 58 58 0 0 1 95 10 Z" fill="url(#fg)"/>
      </svg>
      <div class="loc-pulse"></div>
      <div class="loc-dot"></div>
    </div>
  `;
}

export function useLeafletTrackerMap() {
  const mapLoading = ref(true);
  const mapCentered = ref(true);

  let leaflet: any = null;
  let map: any = null;
  let routePolyline: any = null;
  let walkingRoutePolyline: any = null;
  let walkingStartMarker: any = null;
  let walkingEndMarker: any = null;
  let userMarker: any = null;
  let summaryMap: any = null;

  async function loadLeaflet() {
    leaflet = await import('leaflet');
    await import('leaflet/dist/leaflet.css');
  }

  function getMap() {
    return map;
  }

  function initMap(container: HTMLElement, startLatLng: [number, number]) {
    if (!leaflet) throw new Error('Leaflet not loaded');
    map = leaflet.map(container, { zoomControl: false, attributionControl: false });
    const tiles = leaflet.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png', { maxZoom: 19 });
    tiles.addTo(map);
    tiles.on('tileload', () => { mapLoading.value = false; });
    tiles.on('tileerror', () => { mapLoading.value = false; });
    setTimeout(() => { mapLoading.value = false; }, 2500);

    map.setView(startLatLng, 17);
    leaflet.control.zoom({ position: 'bottomright' }).addTo(map);

    const icon = leaflet.divIcon({ className: '', html: buildMarkerHTML(), iconSize: [120, 120], iconAnchor: [60, 60] });
    userMarker = leaflet.marker(startLatLng, { icon }).addTo(map);

    map.on('dragstart', () => { mapCentered.value = false; });
    routePolyline = leaflet.polyline([], {
      color: '#f97316',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
  }

  function resetPolyline() {
    if (!leaflet || !map) return;
    if (routePolyline) routePolyline.remove();
    routePolyline = leaflet.polyline([], {
      color: '#f97316',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
  }

  function recenterTo(point: TrackPoint) {
    if (!map) return;
    map.panTo([point.lat, point.lng]);
    mapCentered.value = true;
  }

  function updateCurrentPosition(lat: number, lng: number, heading: number | null) {
    if (!userMarker) return;
    userMarker.setLatLng([lat, lng]);
    const iconElement = userMarker?._icon;
    const fan = iconElement?.querySelector('.loc-fan') as SVGElement | null;
    if (fan) {
      if (heading !== null && Number.isFinite(heading)) {
        fan.style.opacity = '1';
        fan.style.transform = `rotate(${heading}deg)`;
      } else {
        fan.style.opacity = '0';
      }
    }
    if (mapCentered.value && map) map.panTo([lat, lng]);
  }

  function appendTrackPoint(point: TrackPoint) {
    if (!routePolyline) return;
    routePolyline.addLatLng([point.lat, point.lng]);
  }

  function clearWalkingRoute() {
    if (walkingRoutePolyline) walkingRoutePolyline.remove();
    if (walkingStartMarker) walkingStartMarker.remove();
    if (walkingEndMarker) walkingEndMarker.remove();
    walkingRoutePolyline = null;
    walkingStartMarker = null;
    walkingEndMarker = null;
  }

  function drawWalkingRoute(path: Array<[number, number]>) {
    if (!leaflet || !map || path.length < 2) return;
    clearWalkingRoute();
    walkingRoutePolyline = leaflet.polyline(path, {
      color: '#22d3ee',
      weight: 4,
      opacity: 0.9,
      dashArray: '8 8',
    }).addTo(map);
    walkingStartMarker = leaflet.circleMarker(path[0], {
      radius: 6,
      fillColor: '#10b981',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);
    walkingEndMarker = leaflet.circleMarker(path[path.length - 1], {
      radius: 6,
      fillColor: '#ef4444',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);
    map.fitBounds(walkingRoutePolyline.getBounds(), { padding: [30, 30] });
  }

  function openSummaryMap(container: HTMLElement, points: TrackPoint[]) {
    if (!leaflet) return;
    if (summaryMap) {
      summaryMap.remove();
      summaryMap = null;
    }
    summaryMap = leaflet.map(container, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      touchZoom: false,
    });
    leaflet.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(summaryMap);

    const coords = points.map((point) => [point.lat, point.lng]);
    if (coords.length >= 2) {
      leaflet.polyline(coords, { color: '#f97316', weight: 4, opacity: 0.9 }).addTo(summaryMap);
      leaflet.circleMarker(coords[0], { radius: 7, fillColor: '#22c55e', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(summaryMap);
      leaflet.circleMarker(coords[coords.length - 1], { radius: 7, fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(summaryMap);
      summaryMap.fitBounds(leaflet.latLngBounds(coords), { padding: [20, 20] });
    }
    if (coords.length === 1) summaryMap.setView(coords[0], 15);
  }

  function destroy() {
    if (summaryMap) summaryMap.remove();
    clearWalkingRoute();
    summaryMap = null;
    if (map) map.remove();
    map = null;
    routePolyline = null;
    userMarker = null;
  }

  return {
    mapLoading,
    mapCentered,
    loadLeaflet,
    initMap,
    resetPolyline,
    recenterTo,
    updateCurrentPosition,
    appendTrackPoint,
    drawWalkingRoute,
    clearWalkingRoute,
    openSummaryMap,
    destroy,
    getMap,
  };
}
