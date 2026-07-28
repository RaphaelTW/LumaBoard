import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { initialPublicSummary } from "./public-data";
import { PublicDataPanel } from "./public-data-panel";

describe("PublicDataPanel", () => {
  it("renders the public art card from the summary payload", () => {
    const summary = {
      ...initialPublicSummary,
      updatedAt: new Date().toISOString(),
      content: {
        ...initialPublicSummary.content,
        artwork: {
          title: "The Bedroom",
          artist: "Vincent van Gogh",
          date: "1889",
          url: "https://www.artic.edu/artworks/123",
          imageUrl: "https://www.artic.edu/iiif/2/abc123/full/843,/0/default.jpg",
          source: "Art Institute of Chicago",
        },
      },
    };

    const html = renderToStaticMarkup(
      <PublicDataPanel summary={summary} status="ready" onRefresh={vi.fn()} enabled={["art"]} />,
    );

    expect(html).toContain("Obra pública do dia");
    expect(html).toContain("The Bedroom");
    expect(html).toContain("Vincent van Gogh");
    expect(html).toContain("Art Institute of Chicago");
  });
});
