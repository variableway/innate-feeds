import { describe, it, expect } from "vitest";
import { parseTrendingRepoPaths } from "./github.js";

describe("parseTrendingRepoPaths", () => {
  it("extracts owner/repo from Box-row articles", () => {
    const html = `
      <article class="Box-row">
        <div><a href="/sponsors/acme">Sponsor</a></div>
        <h2 class="h3 lh-condensed">
          <a href="/acme/widget">acme / widget</a>
        </h2>
      </article>
      <article class="Box-row">
        <h2 class="h3 lh-condensed">
          <a href="/beta/tool">beta / tool</a>
        </h2>
      </article>
    `;
    expect(parseTrendingRepoPaths(html)).toEqual(["acme/widget", "beta/tool"]);
  });

  it("ignores non-repo navigation links", () => {
    const html = `
      <h2>Navigation Menu</h2>
      <a href="/features/actions">Actions</a>
      <article class="Box-row">
        <h2><a href="/login/oauth">bad</a></h2>
      </article>
      <article class="Box-row">
        <h2><a href="/good/repo">good / repo</a></h2>
      </article>
    `;
    expect(parseTrendingRepoPaths(html)).toEqual(["good/repo"]);
  });

  it("falls back to h2 scanning when articles are absent", () => {
    const html = `
      <h2 class="h3"><a href="/one/repo">one / repo</a></h2>
      <h2 class="h3"><a href="/two/repo">two / repo</a></h2>
    `;
    expect(parseTrendingRepoPaths(html)).toEqual(["one/repo", "two/repo"]);
  });
});
