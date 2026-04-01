// Meghan Gallagher — April 22, 1981, Philadelphia, PA
// Ascendant 28° Gemini, Placidus house system

const natalChart = {
  name: 'Meghan Gallagher',
  datetime: '1981-04-22T12:00:00',
  latitude: 39.9526,
  longitude: -75.1652,
  timezone: 'America/New_York',

  planets: [
    { name: 'Sun', sign: 'Taurus', degree: 2, house: 12 },
    { name: 'Moon', sign: 'Sagittarius', degree: 7, house: 7 },
    { name: 'Mercury', sign: 'Aries', degree: 26, house: 11 },
    { name: 'Venus', sign: 'Taurus', degree: 6, house: 12 },
    { name: 'Mars', sign: 'Aries', degree: 27, house: 11 },
    { name: 'Jupiter', sign: 'Libra', degree: 2, house: 5 },
    { name: 'Saturn', sign: 'Libra', degree: 4, house: 5 },
    { name: 'Uranus', sign: 'Scorpio', degree: 29, house: 6 },
    { name: 'Neptune', sign: 'Sagittarius', degree: 24, house: 7 },
    { name: 'Pluto', sign: 'Libra', degree: 22, house: 5 },
    { name: 'Chiron', sign: 'Taurus', degree: 16, house: 12 },
    { name: 'North Node', sign: 'Leo', degree: 6, house: 3 },
  ],

  longitudes: {
    Sun: 32,
    Moon: 247,
    Mercury: 356,
    Venus: 36,
    Mars: 27,
    Jupiter: 182,
    Saturn: 184,
    Uranus: 239,
    Neptune: 264,
    Pluto: 202,
    Chiron: 46,
    NorthNode: 126,
  },

  ascendant: { sign: 'Gemini', degree: 28 },
  mc: { sign: 'Pisces', degree: 4 },

  houseCusps: [88, 112, 138, 184, 210, 240, 268, 292, 318, 334, 30, 58],
};

export default natalChart;
