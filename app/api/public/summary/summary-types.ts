export type JsonRecord = Record<string, unknown>;

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  score: number;
  source: string;
  publishedAt: string | null;
  imageUrl: string | null;
};

export type AnimeItem = {
  id: number;
  title: string;
  url: string;
  score: number | null;
  imageUrl: string | null;
  detail: string;
};

export type HolidayItem = {
  date: string;
  name: string;
  type: string;
};

export type EarthquakeItem = {
  magnitude: number | null;
  place: string;
  time: string | null;
  url: string;
  distanceKm: number | null;
};

export type PublicSummary = {
  updatedAt: string;
  sources: string[];
  news: NewsItem[];
  anime: {
    news: NewsItem[];
    trending: AnimeItem[];
  };
  rates: {
    date: string | null;
    usdBrl: number | null;
    eurBrl: number | null;
  };
  nextHoliday: HolidayItem | null;
  airQuality: {
    europeanAqi: number | null;
    pm25: number | null;
    updatedAt: string | null;
  };
  economy: {
    selicAnnual: number | null;
    selicDate: string | null;
    ipcaMonthly: number | null;
    ipcaDate: string | null;
  };
  ibge: {
    municipalityCode: string | null;
    municipality: string | null;
    state: string | null;
    stateCode: string | null;
    immediateRegion: string | null;
    intermediateRegion: string | null;
    population: number | null;
    populationYear: string | null;
  };
  earthquakes: {
    count24h: number;
    strongest: EarthquakeItem | null;
    nearest: EarthquakeItem | null;
  };
  environment: {
    elevationM: number | null;
    flood: {
      date: string | null;
      discharge: number | null;
      mean: number | null;
      maximum: number | null;
    };
    marine: {
      updatedAt: string | null;
      waveHeightM: number | null;
      seaTemperatureC: number | null;
      currentVelocityKmh: number | null;
    };
    sun: {
      sunrise: string | null;
      sunset: string | null;
      goldenHourEnd: string | null;
      dayLengthSeconds: number | null;
      moonPhase: string | null;
      moonIllumination: number | null;
    };
  };
  content: {
    artwork: {
      title: string;
      artist: string;
      date: string | null;
      url: string;
      imageUrl: string | null;
      source: string;
    } | null;
    book: {
      title: string;
      author: string;
      year: number | null;
      url: string;
      coverUrl: string | null;
    } | null;
    wikipedia: {
      title: string;
      description: string;
      excerpt: string;
      url: string;
      thumbnailUrl: string | null;
    } | null;
    tv: {
      show: string;
      episode: string;
      date: string | null;
      time: string | null;
      url: string;
      network: string;
    } | null;
  };
  warnings: string[];
};
