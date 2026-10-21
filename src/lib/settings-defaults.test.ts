import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  DEFAULT_HEADER_MENU,
  DEFAULT_FOOTER_COLUMNS,
  DEFAULT_FOOTER_BOTTOM_LINKS,
  parseLinkList,
  parseFooterColumns,
} from "./settings-defaults";

const FALLBACK = [{ name: "Fallback", href: "/fallback" }];

describe("parseLinkList", () => {
  it("returns the fallback when the raw value is missing or blank", () => {
    assert.deepEqual(parseLinkList(undefined, FALLBACK), FALLBACK);
    assert.deepEqual(parseLinkList(null, FALLBACK), FALLBACK);
    assert.deepEqual(parseLinkList("   ", FALLBACK), FALLBACK);
  });

  it("returns the fallback when the raw value is not valid JSON", () => {
    assert.deepEqual(parseLinkList("{not json", FALLBACK), FALLBACK);
  });

  it("returns the fallback when the JSON is not an array", () => {
    assert.deepEqual(parseLinkList('{"name":"x","href":"/x"}', FALLBACK), FALLBACK);
  });

  it("returns an empty list for a valid empty array so the admin can clear a list", () => {
    assert.deepEqual(parseLinkList("[]", FALLBACK), []);
  });

  it("keeps only items with string name and href, and strips extra fields", () => {
    const raw = JSON.stringify([
      { name: "Shop", href: "/shop", extra: true },
      { name: "Missing href" },
      { name: 42, href: "/bad" },
      null,
      "string",
    ]);
    assert.deepEqual(parseLinkList(raw, FALLBACK), [{ name: "Shop", href: "/shop" }]);
  });
});

describe("parseFooterColumns", () => {
  const FALLBACK_COLUMNS = [{ title: "Fallback", links: FALLBACK }];

  it("returns the fallback for missing, invalid or non-array input", () => {
    assert.deepEqual(parseFooterColumns(undefined, FALLBACK_COLUMNS), FALLBACK_COLUMNS);
    assert.deepEqual(parseFooterColumns("nope", FALLBACK_COLUMNS), FALLBACK_COLUMNS);
    assert.deepEqual(parseFooterColumns('{"title":"x"}', FALLBACK_COLUMNS), FALLBACK_COLUMNS);
  });

  it("returns an empty list for a valid empty array", () => {
    assert.deepEqual(parseFooterColumns("[]", FALLBACK_COLUMNS), []);
  });

  it("keeps columns with a string title and an array of links, filtering bad links", () => {
    const raw = JSON.stringify([
      { title: "Shop", links: [{ name: "All", href: "/shop" }, { name: "bad" }] },
      { title: "Empty", links: [] },
      { title: "No links" },
      { links: [{ name: "x", href: "/x" }] },
    ]);
    assert.deepEqual(parseFooterColumns(raw, FALLBACK_COLUMNS), [
      { title: "Shop", links: [{ name: "All", href: "/shop" }] },
      { title: "Empty", links: [] },
    ]);
  });
});

describe("DEFAULT_SETTINGS footer and header defaults", () => {
  it("stores the header menu as JSON that round-trips to DEFAULT_HEADER_MENU", () => {
    assert.deepEqual(parseLinkList(DEFAULT_SETTINGS.headerMenu, []), DEFAULT_HEADER_MENU);
    assert.equal(DEFAULT_HEADER_MENU.length, 6);
    // The blog lives in the default menu; existing sites keep whatever menu
    // they have saved, so it is added there from Settings > Navigation.
    assert.ok(DEFAULT_HEADER_MENU.some((l) => l.href === "/blog"));
  });

  it("stores footer columns as JSON matching today's Shop and Support columns", () => {
    assert.deepEqual(parseFooterColumns(DEFAULT_SETTINGS.footerColumns, []), DEFAULT_FOOTER_COLUMNS);
    assert.deepEqual(
      DEFAULT_FOOTER_COLUMNS.map((c) => c.title),
      ["Shop", "Support"]
    );
    assert.deepEqual(
      DEFAULT_FOOTER_COLUMNS[0].links.map((l) => l.href),
      ["/shop", "/about", "/product-category/new-arrivals", "/product-category/winter-collection", "/product-category/hoodie"]
    );
    assert.deepEqual(
      DEFAULT_FOOTER_COLUMNS[1].links.map((l) => l.href),
      ["/contact", "/reviews", "/shipping", "/returns", "/faq"]
    );
  });

  it("stores bottom links as JSON matching today's Privacy and Terms links", () => {
    assert.deepEqual(parseLinkList(DEFAULT_SETTINGS.footerBottomLinks, []), DEFAULT_FOOTER_BOTTOM_LINKS);
    assert.deepEqual(DEFAULT_FOOTER_BOTTOM_LINKS, [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
    ]);
  });

  it("carries today's tagline, address lines and map link as defaults", () => {
    assert.equal(
      DEFAULT_SETTINGS.footerTagline,
      "Premium clothing brand in Bangladesh. Quality fashion at affordable prices."
    );
    assert.deepEqual(DEFAULT_SETTINGS.footerAddress.split("\n"), [
      "Block #A, Muntaha Tower (Grand Floor)",
      "Behind Al Baraka Hospital, Model Town",
      "Keraniganj, Dhaka- 1310",
    ]);
    assert.equal(DEFAULT_SETTINGS.footerMapUrl, "https://maps.app.goo.gl/eva1uWFvVgVcTaKC9");
  });
});
