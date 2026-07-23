// Mini-mapa satelitarna bez zależności: kafelki Esri World Imagery + Web Mercator.
export const TILE = 256;
export const MAX_Z = 19;
const URL_TPL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const ATTRIBUTION = "© Esri — World Imagery";

export const lonToX = (lon, z) => ((lon + 180) / 360) * TILE * 2 ** z;
export const latToY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z;
};
export const xToLon = (x, z) => (x / (TILE * 2 ** z)) * 360 - 180;
export const yToLat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / (TILE * 2 ** z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};
export const metersPerPixel = (lat, z) =>
  (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

/* HTML siatki kafelków pokrywającej wPx×hPx wokół (lat, lon). */
export function gridHtml(lat, lon, z, wPx, hPx) {
  const cx = lonToX(lon, z);
  const cy = latToY(lat, z);
  const x0 = cx - wPx / 2;
  const y0 = cy - hPx / 2;
  const max = 2 ** z;
  const parts = [];
  for (let tx = Math.floor(x0 / TILE); tx * TILE < x0 + wPx; tx++) {
    for (let ty = Math.floor(y0 / TILE); ty * TILE < y0 + hPx; ty++) {
      if (ty < 0 || ty >= max) continue;
      const wrapped = ((tx % max) + max) % max;
      const url = URL_TPL.replace("{z}", z).replace("{y}", ty).replace("{x}", wrapped);
      parts.push(
        `<img src="${url}" style="position:absolute;left:${tx * TILE - x0}px;top:${ty * TILE - y0}px;width:${TILE}px;height:${TILE}px" draggable="false" loading="lazy" alt="">`
      );
    }
  }
  return parts.join("");
}
