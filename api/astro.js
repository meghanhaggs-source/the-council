const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

const PLANET_IDS = { Sun: 0, Moon: 1, Mercury: 2, Venus: 3, Mars: 4, Jupiter: 5, Saturn: 6, Uranus: 7, Neptune: 8, Pluto: 9 };

const NATAL = {
  Sun: 32, Moon: 247, Mercury: 356, Venus: 36, Mars: 27,
  Jupiter: 182, Saturn: 184, Uranus: 239, Neptune: 264, Pluto: 202,
  Chiron: 46, NorthNode: 126
};

const NATAL_PLANETS = [
  { name: 'Sun', lng: 32, sign: 'Taurus', deg: 2, house: 12 },
  { name: 'Moon', lng: 247, sign: 'Sagittarius', deg: 7, house: 7 },
  { name: 'Mercury', lng: 356, sign: 'Aries', deg: 26, house: 11 },
  { name: 'Venus', lng: 36, sign: 'Taurus', deg: 6, house: 12 },
  { name: 'Mars', lng: 27, sign: 'Aries', deg: 27, house: 11 },
  { name: 'Jupiter', lng: 182, sign: 'Libra', deg: 2, house: 5 },
  { name: 'Saturn', lng: 184, sign: 'Libra', deg: 4, house: 5 },
  { name: 'Uranus', lng: 239, sign: 'Scorpio', deg: 29, house: 6 },
  { name: 'Neptune', lng: 264, sign: 'Sagittarius', deg: 24, house: 7 },
  { name: 'Pluto', lng: 202, sign: 'Libra', deg: 22, house: 5 },
  { name: 'Chiron', lng: 46, sign: 'Taurus', deg: 16, house: 12 },
  { name: 'North Node', lng: 126, sign: 'Leo', deg: 6, house: 3 },
  { name: 'South Node', lng: 306, sign: 'Aquarius', deg: 6, house: 9 },
];

const HOUSE_CUSPS = [88, 112, 138, 184, 210, 240, 268, 292, 318, 334, 30, 58];

const ASPECTS = [
  { name: 'conjunct', angle: 0, orbLum: 2, orbPlan: 1 },
  { name: 'opposite', angle: 180, orbLum: 2, orbPlan: 1 },
  { name: 'square', angle: 90, orbLum: 2, orbPlan: 1 },
  { name: 'trine', angle: 120, orbLum: 2, orbPlan: 1 },
  { name: 'sextile', angle: 60, orbLum: 1.5, orbPlan: 1 },
  { name: 'quincunx', angle: 150, orbLum: 1, orbPlan: 1 },
];

function lngToSign(lng) {
  const normalized = ((lng % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const degree = Math.floor(normalized % 30);
  return { sign: SIGNS[signIndex], degree, longitude: normalized };
}

const ASC_SIGN_INDEX = 2; // Gemini rising. Whole sign houses: house = signs counted from the rising sign
function getHouse(lng) {
  const normalized = ((lng % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  return ((signIndex - ASC_SIGN_INDEX + 12) % 12) + 1;
}

function angleBetween(a, b) {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

function findAspects(transitName, transitLng) {
  const isLuminary = (transitName === 'Sun' || transitName === 'Moon');
  const found = [];

  for (const natal of NATAL_PLANETS) {
    for (const asp of ASPECTS) {
      const orb = isLuminary || natal.name === 'Sun' || natal.name === 'Moon'
        ? asp.orbLum : asp.orbPlan;
      const angle = angleBetween(transitLng, natal.lng);
      const diff = Math.abs(angle - asp.angle);
      if (diff <= orb) {
        found.push({
          transitPlanet: transitName,
          aspect: asp.name,
          natalPlanet: natal.name,
          natalSign: natal.sign,
          natalDeg: natal.deg,
          natalHouse: natal.house,
          orb: Math.round(diff * 10) / 10,
        });
      }
    }
  }

  return found;
}

function isRetrograde(speed) {
  return speed < 0;
}

function jdToDate(jd) { return new Date((jd - 2440587.5) * 86400000); }
function fmtET(d) {
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
}
function aspectText(list) {
  return list.map(a => `${a.who ? a.who + ' ' : ''}${a.aspect} natal ${a.natalPlanet} (orb ${a.orb}°)`).join(', ') || 'no tight contacts to the natal chart';
}
function buildUpcoming(swe, jd0) {
  const lines = [];
  let prev = null;
  for (let m = 0; m <= 14 * 24 * 60; m += 5) {
    const jd = jd0 + m / 1440;
    const sun = swe.calc_ut(jd, 0, 256)[0];
    const moon = swe.calc_ut(jd, 1, 256)[0];
    const el = (((moon - sun) % 360) + 360) % 360;
    if (prev !== null) {
      let label = null;
      if (prev > 350 && el < 10) label = 'New Moon';
      if (prev < 180 && el >= 180) label = 'Full Moon';
      if (label) {
        const pos = lngToSign(moon);
        const house = getHouse(moon);
        const asp = findAspects('Moon', moon).map(a => ({...a, who: 'Moon'})).concat(label === 'Full Moon' ? findAspects('Sun', sun).map(a => ({...a, who: 'Sun'})) : []);
        lines.push(`${label}: ${fmtET(jdToDate(jd))} ET at ${pos.degree}° ${pos.sign}, in the ${ordinal(house)} house. Contacts: ${aspectText(asp)}`);
      }
    }
    prev = el;
  }
  for (const [name, id] of Object.entries(PLANET_IDS)) {
    if (name === 'Sun' || name === 'Moon') continue;
    let prevSpeed = null;
    for (let h = 0; h <= 30 * 24; h += 6) {
      const jd = jd0 + h / 24;
      const r = swe.calc_ut(jd, id, 256);
      const speed = r[3];
      if (prevSpeed !== null && Math.sign(speed) !== Math.sign(prevSpeed)) {
        const pos = lngToSign(r[0]);
        const dir = speed < 0 ? 'stations retrograde' : 'stations direct';
        lines.push(`${name} ${dir}: ${fmtET(jdToDate(jd))} ET at ${pos.degree}° ${pos.sign}, in the ${ordinal(getHouse(r[0]))} house`);
      }
      prevSpeed = speed;
    }
  }
  return lines;
}


export default async function handler(req, res) {
  try {
    const SwissEph = (await import('swisseph-wasm')).default;
    const swe = new SwissEph();
    await swe.initSwissEph();

    const requested = req && req.query && req.query.date ? new Date(req.query.date) : null;
    const now = requested && !isNaN(requested) ? requested : new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();
    const hour = now.getUTCHours() + now.getUTCMinutes() / 60;

    const jd = swe.julday(year, month, day, hour);

    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      timeZone: 'America/New_York'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York'
    });

    const transitPlanets = [];
    const allAspects = [];

    // Calculate positions for Sun through Pluto
    for (const [name, id] of Object.entries(PLANET_IDS)) {
      const result = swe.calc_ut(jd, id, 256); // SEFLG_SPEED = 256
      const lng = result[0];
      const speed = result[3];
      const pos = lngToSign(lng);
      const house = getHouse(lng);
      const retro = isRetrograde(speed) && !['Sun', 'Moon'].includes(name);

      transitPlanets.push({
        name, longitude: lng, sign: pos.sign, degree: pos.degree,
        house, retrograde: retro,
      });

      const aspects = findAspects(name, lng);
      allAspects.push(...aspects);
    }

    // Build the transit report text
    let report = `CURRENT TRANSITS — ${dateStr} at ${timeStr} ET\n`;
    report += `Calculated via Swiss Ephemeris (precision: 0.001 arcseconds)\n`;
    report += `Reference: Meghan's natal chart (April 22, 1981, Philadelphia PA, 28° Gemini rising)\n\n`;

    const upcoming = buildUpcoming(swe, jd);
    if (upcoming.length) report += `UPCOMING (next 14 days for lunations, 30 for stations):\n  ` + upcoming.join('\n  ') + `\n\n`;
    report += `PLANETARY POSITIONS:\n`;
    for (const p of transitPlanets) {
      const retro = p.retrograde ? ' Rx' : '';
      const aspectsForPlanet = allAspects.filter(a => a.transitPlanet === p.name);
      let line = `${p.name}: ${p.degree}° ${p.sign}${retro} (transiting ${ordinal(p.house)} house)`;

      if (aspectsForPlanet.length > 0) {
        const aspStr = aspectsForPlanet
          .map(a => `${a.aspect} natal ${a.natalPlanet} ${a.natalDeg}° ${a.natalSign} in ${ordinal(a.natalHouse)} house (orb ${a.orb}°, ${a.orb <= 0.5 ? 'EXACT' : 'close'}${a.transitPlanet === a.natalPlanet ? ', PRIORITY: planet contacting its own natal position' : ''})`)
          .join(', ');
        line += ` — ${aspStr}`;
      }

      report += `  ${line}\n`;
    }

    // Summary of significant aspects
    const significant = allAspects.filter(a =>
      ['conjunct', 'opposite', 'square'].includes(a.aspect) && a.orb <= 3
    );

    if (significant.length > 0) {
      report += `\nSIGNIFICANT ASPECTS (tight orbs):\n`;
      for (const a of significant) {
        report += `  Transit ${a.transitPlanet} ${a.aspect} natal ${a.natalPlanet} (orb ${a.orb}°, ${a.orb <= 0.5 ? 'EXACT' : 'close'}${a.transitPlanet === a.natalPlanet ? ', PRIORITY: planet contacting its own natal position' : ''}) — this is active and significant right now\n`;
      }
    }

    swe.close();

    res.json({ report, date: dateStr, planets: transitPlanets, aspects: allAspects });
  } catch (err) {
    console.error('Astro calculation error:', err);
    res.status(500).json({ error: err.message });
  }
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
