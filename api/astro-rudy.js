import natalChart from './natalChart.js';

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

// 'North Node' (10 = mean node) is a transiting point: it gives the current node position and
// aspects to the natal chart. South Node is derived opposite it after the compute loop. (Added
// 2026-07-24 with Divine Feminine wiring; also enriches Priya's daily briefing.)
const PLANET_IDS = { Sun: 0, Moon: 1, Mercury: 2, Venus: 3, Mars: 4, Jupiter: 5, Saturn: 6, Uranus: 7, Neptune: 8, Pluto: 9, 'North Node': 10 };

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

function getHouse(lng, houseCusps) {
  const normalized = ((lng % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const cusp = houseCusps[i];
    const nextCusp = houseCusps[(i + 1) % 12];
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

function findAspects(transitName, transitLng, planets) {
  const isLuminary = (transitName === 'Sun' || transitName === 'Moon');
  const found = [];

  for (const natal of planets) {
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
          natalDeg: natal.degree,
          natalHouse: natal.house,
          orb: Math.round(diff * 10) / 10,
        });
      }
    }
  }

  return found;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function getTransitReport(targetDate, natalData) {
  const chart = natalData || natalChart;
  const chartLabel = chart.name || 'natal chart';

  const SwissEph = (await import('swisseph-wasm')).default;
  const swe = new SwissEph();
  await swe.initSwissEph();

  const now = targetDate ? new Date(targetDate) : new Date();
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

  for (const [name, id] of Object.entries(PLANET_IDS)) {
    const result = swe.calc_ut(jd, id, 256); // SEFLG_SPEED = 256
    const lng = result[0];
    const speed = result[3];
    const pos = lngToSign(lng);
    const house = getHouse(lng, chart.houseCusps);
    const retro = speed < 0 && !['Sun', 'Moon'].includes(name);

    transitPlanets.push({
      name, longitude: lng, sign: pos.sign, degree: pos.degree,
      house, retrograde: retro,
    });

    const aspects = findAspects(name, lng, chart.planets);
    allAspects.push(...aspects);
  }

  // Transiting South Node = opposite the (mean) North Node. Same convention as the natal chart.
  const tNN = transitPlanets.find((p) => p.name === 'North Node');
  if (tNN) {
    const snLng = (tNN.longitude + 180) % 360;
    const pos = lngToSign(snLng);
    transitPlanets.push({
      name: 'South Node', longitude: snLng, sign: pos.sign, degree: pos.degree,
      house: getHouse(snLng, chart.houseCusps), retrograde: tNN.retrograde,
    });
    allAspects.push(...findAspects('South Node', snLng, chart.planets));
  }

  let report = `CURRENT TRANSITS — ${dateStr} at ${timeStr} ET\n`;
  report += `Calculated via Swiss Ephemeris (precision: 0.001 arcseconds)\n`;
  report += `Reference: ${chartLabel}\n\n`;

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

  return { report, date: dateStr, planets: transitPlanets, aspects: allAspects };
}
