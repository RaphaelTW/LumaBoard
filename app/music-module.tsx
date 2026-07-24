/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ExternalLink,
  Heart,
  ListMusic,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  MUSIC_STORAGE_KEY,
  readMusicCache,
  type MusicCache,
  type MusicTrack,
  type RadioStation,
} from "./dashboard-config";
import { writeStoredValue } from "./storage";

const genres = [
  ["pop", "Pop"],
  ["rock", "Rock"],
  ["indie", "Indie"],
  ["electronic", "Eletrônica"],
  ["jazz", "Jazz"],
  ["classical", "Clássica"],
  ["lofi", "Lo-fi"],
  ["anime", "Anime"],
  ["brazilian", "Música brasileira"],
  ["gospel", "Gospel"],
  ["hiphop", "Hip-hop"],
  ["metal", "Metal"],
] as const;

type MusicResponse = Omit<MusicCache, "favorites"> & { warnings?: string[]; sources?: string[] };

function isMusicResponse(value: unknown): value is MusicResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<MusicResponse>;
  return typeof record.genre === "string" && typeof record.updatedAt === "string" && Array.isArray(record.tracks) && Array.isArray(record.stations);
}

function formatBitrate(station: RadioStation): string {
  return [station.codec, station.bitrate ? `${station.bitrate} kbps` : "", station.countryCode].filter(Boolean).join(" · ");
}

export function MusicModule({ onToast }: { onToast: (message: string) => void }) {
  const [cache, setCache] = useState<MusicCache>(() => ({ genre: "pop", updatedAt: "", tracks: [], stations: [], favorites: [] }));
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState("");
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => setCache(readMusicCache()));
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const persist = (next: MusicCache) => {
    setCache(next);
    writeStoredValue(MUSIC_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent("lumaboard:music", { detail: next }));
  };

  const loadGenre = async (genre = cache.genre) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/public/music?genre=${encodeURIComponent(genre)}`, { headers: { Accept: "application/json" } });
      const payload: unknown = await response.json();
      if (!response.ok || !isMusicResponse(payload)) throw new Error("Sugestões musicais indisponíveis.");
      const next: MusicCache = { ...payload, favorites: cache.favorites };
      persist(next);
      onToast(`${next.tracks.length} músicas e ${next.stations.length} rádios salvas no cache local.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sugestões musicais indisponíveis.");
    } finally {
      setLoading(false);
    }
  };

  const play = async (id: string, url: string | null) => {
    if (!url) {
      onToast("Esta faixa não possui prévia de áudio.");
      return;
    }
    if (playingId === id && audioRef.current) {
      audioRef.current.pause();
      setPlayingId("");
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("ended", () => setPlayingId(""), { once: true });
    audio.addEventListener("error", () => { setPlayingId(""); window.dispatchEvent(new CustomEvent("lumaboard:audio-error", { detail: { id, occurredAt: new Date().toISOString(), message: "O provedor de áudio não permitiu reproduzir esta fonte." } })); onToast("O provedor de áudio não permitiu reproduzir esta fonte."); }, { once: true });
    try {
      await audio.play();
      setPlayingId(id);
    } catch {
      onToast("O navegador bloqueou a reprodução ou a fonte não está disponível.");
    }
  };

  const toggleFavorite = (track: MusicTrack) => {
    const favorites = cache.favorites.includes(track.id)
      ? cache.favorites.filter((id) => id !== track.id)
      : [...cache.favorites, track.id];
    persist({ ...cache, favorites });
  };

  return (
    <section className="module-view music-view">
      <header className="module-heading">
        <div><span className="eyebrow">DESCOBERTA MUSICAL SEM LOGIN</span><h1>Escolha um gênero e dê o play.</h1><p>O LumaBoard combina sugestões do catálogo do iTunes, prévias de 30 segundos e rádios abertas. Nenhum token do Spotify é usado.</p></div>
        <div className="module-actions"><button className="button primary" onClick={() => void loadGenre()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> {loading ? "Buscando…" : "Atualizar gênero"}</button></div>
      </header>

      <article className="panel genre-picker-panel">
        <div><ListMusic /><span><strong>Gênero atual</strong><small>As sugestões ficam salvas no localStorage.</small></span></div>
        <select value={cache.genre} onChange={(event) => { const genre = event.target.value; persist({ ...cache, genre }); void loadGenre(genre); }}>{genres.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <a className="button secondary" href={`https://open.spotify.com/search/${encodeURIComponent(genres.find(([value]) => value === cache.genre)?.[1] ?? cache.genre)}`} target="_blank" rel="noreferrer"><Search /> Abrir busca no Spotify</a>
      </article>
      {error && <p className="music-error">{error}</p>}

      <div className="music-layout">
        <article className="panel music-tracks-panel">
          <header><div><span className="eyebrow">SUGESTÃO DE PLAYLIST</span><h2>Faixas com prévia</h2></div><span className="status-chip">APPLE ITUNES SEARCH</span></header>
          <div className="music-track-grid">
            {cache.tracks.map((track) => <article key={track.id}>
              {track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="music-placeholder"><Volume2 /></span>}
              <div><strong>{track.title}</strong><span>{track.artist}</span><small>{track.album || track.genre}</small></div>
              <div className="music-card-actions">
                <button className="icon-button" aria-label={playingId === `track-${track.id}` ? "Pausar prévia" : "Tocar prévia"} onClick={() => void play(`track-${track.id}`, track.previewUrl)}>{playingId === `track-${track.id}` ? <Pause /> : <Play />}</button>
                <button className={`icon-button ${cache.favorites.includes(track.id) ? "active" : ""}`} aria-label="Salvar faixa" onClick={() => toggleFavorite(track)}><Heart /></button>
                <a className="icon-button" href={track.storeUrl} target="_blank" rel="noreferrer" aria-label="Abrir no Apple Music"><ExternalLink /></a>
                <a className="button secondary spotify-search-button" href={track.spotifySearchUrl} target="_blank" rel="noreferrer">Spotify</a>
              </div>
            </article>)}
            {!loading && cache.tracks.length === 0 && <p className="music-empty">Escolha um gênero para montar a primeira lista.</p>}
          </div>
        </article>

        <aside className="panel radio-panel">
          <header><div><span className="eyebrow">RÁDIOS AO VIVO</span><h2>Estações por gênero</h2></div><Radio /></header>
          <div className="radio-list">
            {cache.stations.map((station) => <article key={station.id}>
              {station.favicon ? <img src={station.favicon} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span><Radio /></span>}
              <div><strong>{station.name}</strong><small>{formatBitrate(station)}</small><em>{station.tags.slice(0, 3).join(" · ")}</em></div>
              <button className="icon-button" aria-label={playingId === `station-${station.id}` ? "Pausar rádio" : "Tocar rádio"} onClick={() => void play(`station-${station.id}`, station.streamUrl)}>{playingId === `station-${station.id}` ? <Pause /> : <Play />}</button>
            </article>)}
            {!loading && cache.stations.length === 0 && <p className="music-empty">Nenhuma estação carregada.</p>}
          </div>
        </aside>
      </div>
      <footer className="music-attribution"><span>Prévia e metadados: Apple iTunes Search API · rádios: Radio Browser.</span><span>O botão Spotify abre uma busca externa; não usa a Web API do Spotify.</span></footer>
    </section>
  );
}
