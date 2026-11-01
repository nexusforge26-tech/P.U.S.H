/**
 * @typedef {number[]} Coordinate
 * @typedef {Coordinate[]} Ring
 * @typedef {Ring[]} Polygon
 * @typedef {Polygon[]} MultiPolygon
 * @typedef {{ type: "Polygon", coordinates: Polygon } | { type: "MultiPolygon", coordinates: MultiPolygon }} GeoGeometry
 */

const EPSILON = 1e-10;

/** @param {number} x @param {number} y @param {Coordinate} a @param {Coordinate} b */
function pointOnSegment(x, y, a, b) {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  const scale = Math.max(1, Math.abs(x2 - x1), Math.abs(y2 - y1));
  if (Math.abs(cross) > EPSILON * scale) return false;
  return (
    x >= Math.min(x1, x2) - EPSILON &&
    x <= Math.max(x1, x2) + EPSILON &&
    y >= Math.min(y1, y2) - EPSILON &&
    y <= Math.max(y1, y2) + EPSILON
  );
}

/** @param {number} longitude @param {number} latitude @param {Ring} ring */
function pointInRing(longitude, latitude, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[j];
    const b = ring[i];
    if (!a || !b) continue;
    if (pointOnSegment(longitude, latitude, a, b)) return true;

    const intersects =
      (b[1] > latitude) !== (a[1] > latitude) &&
      longitude < ((a[0] - b[0]) * (latitude - b[1])) / (a[1] - b[1]) + b[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * GeoJSON positions are [longitude, latitude]. The boundary is OCHA COD-AB PSE ADM0.
 * @param {number} longitude
 * @param {number} latitude
 * @param {GeoGeometry} geometry
 */
export function isPointWithinGeometry(longitude, latitude, geometry) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  return polygons.some((polygon) => {
    const [outer, ...holes] = polygon;
    if (!outer || !pointInRing(longitude, latitude, outer)) return false;
    return !holes.some((hole) => pointInRing(longitude, latitude, hole));
  });
}

/**
 * Construct the single latest location-check row. Coordinates are supplied by the browser,
 * validated separately by the API, and overwritten on the next successful visit.
 * @param {string} userId
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} accuracyM
 * @param {GeoGeometry} geometry
 * @param {string} checkedAt
 */
export function createMemberLocationRecord(userId, latitude, longitude, accuracyM, geometry, checkedAt) {
  const inside = isPointWithinGeometry(longitude, latitude, geometry);
  return {
    user_id: userId,
    status: inside ? "inside" : "outside",
    latitude,
    longitude,
    accuracy_m: accuracyM,
    checked_at: checkedAt,
  };
}
