import { afterEach, describe, expect, it, vi } from "vitest";
import { loadArtwork } from "./content";

describe("public summary content sources", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes an Art Institute public-domain artwork without requiring an API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      body: null,
      text: async () => JSON.stringify({
        data: [{
          id: 123,
          title: "The Bedroom",
          artist_display: "Vincent van Gogh",
          date_display: "1889",
          image_id: "abc123",
        }],
      }),
      json: async () => ({
        data: [{
          id: 123,
          title: "The Bedroom",
          artist_display: "Vincent van Gogh",
          date_display: "1889",
          image_id: "abc123",
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const artwork = await loadArtwork();

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("api.artic.edu/api/v1/artworks/search");
    expect(options).toMatchObject({ headers: { Accept: "application/json" } });
    expect(artwork).toEqual({
      title: "The Bedroom",
      artist: "Vincent van Gogh",
      date: "1889",
      url: "https://www.artic.edu/artworks/123",
      imageUrl: "https://www.artic.edu/iiif/2/abc123/full/843,/0/default.jpg",
      source: "Art Institute of Chicago",
    });
  });
});
