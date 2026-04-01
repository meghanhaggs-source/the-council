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
];

const HOUSE_CUSPS = [88, 112, 138, 184, 210, 240, 268, 292, 318, 334, 30, 58];

const ASPECTS = [
  { name: 'conjunct', angle: 0, orbLum: 8, orbPlan: 6 },
  { name: 'opposite', angle: 180, orbLum: 8, orbPlan: 6 },
  { name: 'square', angle: 90, orbLum: 7, orbPlan: 5 },
  { name: 'trine', angle: 120, orbLum: 8, orbPlan: 6 },
  { name: 'sextile', angle: 60, orbLum: 4, orbPlan: 4 },
  { name: 'quincunx', angle: 150, orbLum: 3, orbPlan: 3 },
];

function lngToSign(lng) {
  const normalized = ((lng % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const degree = Math.floor(normalized % 30);
  return { sign: SIGNS[signIndex], degree, longitude: normalized };
}

function getHouse(lng) {
  const normalized = ((lng % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const cusp = HOUSE_CUSPS[i];
    const nextCusp = HOUSE_CUSPS[(i + 1) % 12];
    if (nextCusp > cusp) {
      if (normalized >= cusp && normalized < nextCusp) return i + 1;
    } else {
      if (normalized >= cusp || normalized < nextCusp) return i + 1;
    }
  }
  return 1;
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

export default async function handler(req, res) {
  try {
    const SwissEph = (await import('swisseph-wasm')).default;
    const swe = new SwissEph();
    await swe.initSwissEph();

    const now = new Date();
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

    report += `PLANETARY POSITIONS:\n`;
    for (const p of transitPlanets) {
      const retro = p.retrograde ? ' Rx' : '';
      const aspectsForPlanet = allAspects.filter(a => a.transitPlanet === p.name);
      let line = `${p.name}: ${p.degree}° ${p.sign}${retro} (transiting ${ordinal(p.house)} house)`;

      if (aspectsForPlanet.length > 0) {
        const aspStr = aspectsForPlanet
          .map(a => `${a.aspect} natal ${a.natalPlanet} ${a.natalDeg}° ${a.natalSign} in ${ordinal(a.natalHouse)} house (orb ${a.orb}°)`)
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
        report += `  Transit ${a.transitPlanet} ${a.aspect} natal ${a.natalPlanet} (orb ${a.orb}°) — this is active and significant right now\n`;
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
