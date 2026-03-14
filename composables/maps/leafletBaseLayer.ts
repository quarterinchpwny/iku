type BaseLayerOptions = {
  offline?: boolean;
  onReady?: () => void;
  onError?: () => void;
};

export function isOfflineClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.onLine !== 'boolean') return false;
  return !navigator.onLine;
}

function buildOfflineLayer(leaflet: any) {
  const layer = leaflet.gridLayer({ tileSize: 256 });
  layer.createTile = () => {
    const tile = document.createElement('div');
    tile.style.background = 'linear-gradient(135deg, #0f172a 0%, #0b1020 100%)';
    tile.style.border = '1px solid rgba(255, 255, 255, 0.03)';
    tile.style.boxSizing = 'border-box';
    return tile;
  };
  return layer;
}

export function addLeafletBaseLayer(
  leaflet: any,
  map: any,
  url: string,
  options: BaseLayerOptions = {}
) {
  const offline = options.offline ?? isOfflineClient();
  if (offline) {
    const layer = buildOfflineLayer(leaflet);
    layer.addTo(map);
    if (options.onReady) options.onReady();
    return { layer, offline: true };
  }

  const layer = leaflet.tileLayer(url, { maxZoom: 19 });
  if (options.onReady) layer.on('tileload', options.onReady);
  if (options.onError) layer.on('tileerror', options.onError);
  layer.addTo(map);
  return { layer, offline: false };
}
