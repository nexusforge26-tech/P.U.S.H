import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createMemberLocationRecord, isPointWithinGeometry } from "../lib/geofence.mjs";

const boundary = JSON.parse(
  await readFile(new URL("../data/geofences/pse-admin0-ocha.json", import.meta.url), "utf8")
);
const geometry = boundary.features[0].geometry;

test("OCHA Palestine ADM0 includes Gaza, Ramallah, and East Jerusalem", () => {
  assert.equal(isPointWithinGeometry(34.4668, 31.5017, geometry), true, "Gaza City");
  assert.equal(isPointWithinGeometry(35.2062, 31.9023, geometry), true, "Ramallah");
  assert.equal(isPointWithinGeometry(35.2357, 31.7776, geometry), true, "East Jerusalem");
});

test("OCHA Palestine ADM0 excludes nearby locations outside the territory", () => {
  assert.equal(isPointWithinGeometry(34.7818, 32.0853, geometry), false, "Tel Aviv");
  assert.equal(isPointWithinGeometry(35.9106, 31.9539, geometry), false, "Amman");
});

test("the member record stores the last reported coordinates and the derived region status", () => {
  const checkedAt = "2026-11-01T00:00:00.000Z";
  const outside = createMemberLocationRecord(
    "member-1", 32.0853, 34.7818, 82.5, geometry, checkedAt
  );
  assert.deepEqual(outside, {
    user_id: "member-1",
    status: "outside",
    latitude: 32.0853,
    longitude: 34.7818,
    accuracy_m: 82.5,
    checked_at: checkedAt,
  });

  const inside = createMemberLocationRecord(
    "member-2", 31.7776, 35.2357, 24, geometry, checkedAt
  );
  assert.equal(inside.status, "inside");
  assert.equal(inside.latitude, 31.7776);
  assert.equal(inside.longitude, 35.2357);
});

test("points on a polygon edge count as inside", () => {
  const square = {
    type: "Polygon",
    coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
  };
  assert.equal(isPointWithinGeometry(0, 0.5, square), true);
});

test("location writes are authenticated and precise coordinates stay out of the bulk export", async () => {
  const locationRoute = await readFile(
    new URL("../app/api/location/check/route.ts", import.meta.url),
    "utf8"
  );
  const adminRoute = await readFile(
    new URL("../app/api/admin/users/route.ts", import.meta.url),
    "utf8"
  );
  const exportRoute = await readFile(
    new URL("../app/api/admin/users/export/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(locationRoute, /getRequestUser\(req\)/);
  assert.match(locationRoute, /trustedOrigin\(req\)/);
  assert.match(locationRoute, /account\.profile\.role !== "user"/);
  assert.match(locationRoute, /upsert\(record, \{ onConflict: "user_id" \}\)/);
  assert.match(adminRoute, /actor\.profile\.role === "admin" \|\| actor\.profile\.role === "owner"/);
  assert.match(adminRoute, /\.select\("user_id,status,latitude,longitude,accuracy_m,checked_at"\)/);
  assert.doesNotMatch(exportRoute, /member_location_checks|accuracy_m|latitude|longitude/);
});

test("geolocation is allowed only for the same origin while other sensitive browser permissions stay blocked", async () => {
  const config = await readFile(new URL("../next.config.js", import.meta.url), "utf8");
  assert.match(config, /geolocation=\(self\)/);
  assert.doesNotMatch(config, /geolocation=\(\)/);
  assert.match(config, /camera=\(\), microphone=\(\)/);
});
