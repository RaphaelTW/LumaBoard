import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OfflinePage from "./page";

describe("offline page", () => {
  it("explains which local features remain available", () => {
    const markup = renderToStaticMarkup(<OfflinePage />);
    expect(markup).toContain("LUMABOARD OFFLINE");
    expect(markup).toContain("Layouts salvos");
    expect(markup).toContain("Agenda local");
    expect(markup).toContain("Pomodoro");
  });
});
