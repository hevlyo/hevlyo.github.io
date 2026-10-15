// Sun and moon ephemerides, condensed from the formulas in Vladimir Agafonkin's
// SunCalc (BSD-2-Clause) and Aart Ahlers' "Astronomy Answers". Accuracy is
// well under a degree — plenty for drawing the sky over one city.

const PI = Math.PI;
const RAD = PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

export const NATAL = {
  lat: -5.795,
  lng: -35.209,
  // Rio Grande do Norte has been on a fixed UTC−3 since Brazil dropped DST in 2019.
  offsetMinutes: -180,
};

const toDays = (date) => date / DAY_MS - 0.5 + J1970 - J2000;

const rightAscension = (l, b) =>
  Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
const declination = (l, b) =>
  Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
const azimuthOf = (H, phi, dec) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
const altitudeOf = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
const siderealTime = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw;

function refraction(h) {
  const altitude = Math.max(h, 0);
  return 0.0002967 / Math.tan(altitude + 0.00312536 / (altitude + 0.08901179));
}

function sunCoords(d) {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + PI;
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

function moonCoords(d) {
  const L = RAD * (218.316 + 13.176396 * d);
  const M = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: 385001 - 20905 * Math.cos(M) };
}

/** Altitude and azimuth in radians. Azimuth is measured from south, westward. */
export function sunPosition(ms, lat = NATAL.lat, lng = NATAL.lng) {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(ms);
  const c = sunCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  return { altitude: altitudeOf(H, phi, c.dec), azimuth: azimuthOf(H, phi, c.dec) };
}

export function moonPosition(ms, lat = NATAL.lat, lng = NATAL.lng) {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(ms);
  const c = moonCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  const h = altitudeOf(H, phi, c.dec);
  const parallacticAngle = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.dec) - Math.sin(c.dec) * Math.cos(H));
  return { altitude: h + refraction(h), azimuth: azimuthOf(H, phi, c.dec), parallacticAngle };
}

/**
 * fraction: lit share of the disc. phase: 0 new → 0.5 full → 1 new.
 * angle: position angle of the bright limb's midpoint, eastward from north.
 */
export function moonIllumination(ms) {
  const d = toDays(ms);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sunDist = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sunDist * Math.sin(phi), m.dist - sunDist * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
  );
  return {
    fraction: (1 + Math.cos(inc)) / 2,
    phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / PI,
    angle,
  };
}

/** Direction of sunlight on the moon's disc as seen from the observer (x right, y up, z towards viewer). */
export function moonLightVector(ms, lat = NATAL.lat, lng = NATAL.lng) {
  const illumination = moonIllumination(ms);
  const position = moonPosition(ms, lat, lng);
  // Position angles run counter-clockwise from "up" in the observer's view.
  const limb = illumination.angle - position.parallacticAngle;
  const inc = Math.acos(Math.min(1, Math.max(-1, 2 * illumination.fraction - 1)));
  return [Math.sin(inc) * -Math.sin(limb), Math.sin(inc) * Math.cos(limb), Math.cos(inc)];
}

function bisect(f, a, b) {
  let fa = f(a);
  for (let i = 0; i < 22; i++) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (fa < 0 === fm < 0) {
      a = mid;
      fa = fm;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}

/** Sunrise and sunset (ms) within the local day that starts at `dayStart`. */
export function sunTimes(dayStart, lat = NATAL.lat, lng = NATAL.lng) {
  const horizon = -0.833 * RAD; // refraction + solar semi-diameter
  const f = (ms) => sunPosition(ms, lat, lng).altitude - horizon;
  const step = 10 * 60000;
  let rise = null;
  let set = null;
  let previousTime = dayStart;
  let previous = f(previousTime);
  for (let time = dayStart + step; time <= dayStart + DAY_MS; time += step) {
    const value = f(time);
    if (previous < 0 && value >= 0 && rise === null) rise = bisect(f, previousTime, time);
    if (previous >= 0 && value < 0 && set === null) set = bisect(f, previousTime, time);
    previous = value;
    previousTime = time;
  }
  return { rise, set };
}

/** Moonrise / moonset within the local day, or null when they don't happen. */
export function moonTimes(dayStart, lat = NATAL.lat, lng = NATAL.lng) {
  const horizon = 0.133 * RAD;
  const f = (ms) => moonPosition(ms, lat, lng).altitude - horizon;
  const step = 10 * 60000;
  let rise = null;
  let set = null;
  let previousTime = dayStart;
  let previous = f(previousTime);
  for (let time = dayStart + step; time <= dayStart + DAY_MS; time += step) {
    const value = f(time);
    if (previous < 0 && value >= 0 && rise === null) rise = bisect(f, previousTime, time);
    if (previous >= 0 && value < 0 && set === null) set = bisect(f, previousTime, time);
    previous = value;
    previousTime = time;
  }
  return { rise, set };
}

/** 0 new · 1 waxing crescent · 2 first quarter · 3 waxing gibbous · 4 full · 5 waning gibbous · 6 last quarter · 7 waning crescent */
export const phaseIndex = (phase) => Math.floor((phase * 8 + 0.5) % 8);

/* ---------- Natal wall-clock helpers (fixed UTC−3) ---------- */

const shift = (ms) => new Date(ms + NATAL.offsetMinutes * 60000);

export function natalDayStart(ms) {
  const local = shift(ms);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - NATAL.offsetMinutes * 60000;
}

export const natalMinutes = (ms) => (ms - natalDayStart(ms)) / 60000;

export function formatClock(ms, seconds = false) {
  const local = shift(ms);
  const pad = (n) => String(n).padStart(2, '0');
  const text = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
  return seconds ? `${text}:${pad(local.getUTCSeconds())}` : text;
}

export const toDegrees = (radians) => radians / RAD;

/** Compass bearing (0 = north, clockwise) from a SunCalc azimuth (0 = south, westward). */
export const bearing = (azimuth) => (toDegrees(azimuth) + 180 + 360) % 360;
