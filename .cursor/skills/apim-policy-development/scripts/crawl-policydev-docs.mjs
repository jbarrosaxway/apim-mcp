/**
 * Crawl Axway "Develop in Policy Studio" docs (apim_policydev) via Playwright.
 * Saves one .md per page under .cursor/skills/apim-policy-development/docs/rag/
 *
 * Usage:
 *   node .cursor/skills/apim-policy-development/scripts/crawl-policydev-docs.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "docs", "rag");
const INDEX_URL =
  "https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/index.html";
const BASE = "https://docs.axway.com/bundle/axway-open-docs/page/docs/apim_policydev/";

function slugFromUrl(url) {
  const u = url.replace(/\/index\.html$/, "/").replace(/\/$/, "");
  const rel = u.replace(BASE.replace(/\/$/, ""), "").replace(/^\//, "");
  if (!rel || rel === "index.html" || url.includes("/apim_policydev/index.html")) {
    return "index";
  }
  return rel
    .replace(/\/index\.html$/, "")
    .replace(/\.html$/, "")
    .replace(/\//g, "__")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");
}

/** Convert article DOM to markdown (structure-preserving, page text as shown). */
function htmlToMarkdown(root) {
  const blocks = [];

  function walk(node) {
    if (!node || node.nodeType === 8) return; // comment
    if (node.nodeType === 3) {
      const t = node.textContent.replace(/\s+/g, " ");
      if (t.trim()) blocks.push({ type: "text", t });
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "nav", "noscript", "button"].includes(tag)) return;
    if (tag === "h1") blocks.push({ type: "h", level: 1, t: node.innerText.trim() });
    else if (tag === "h2") blocks.push({ type: "h", level: 2, t: node.innerText.trim() });
    else if (tag === "h3") blocks.push({ type: "h", level: 3, t: node.innerText.trim() });
    else if (tag === "h4") blocks.push({ type: "h", level: 4, t: node.innerText.trim() });
    else if (tag === "h5") blocks.push({ type: "h", level: 5, t: node.innerText.trim() });
    else if (tag === "h6") blocks.push({ type: "h", level: 6, t: node.innerText.trim() });
    else if (tag === "p") blocks.push({ type: "p", t: node.innerText.trim() });
    else if (tag === "pre" || tag === "code") {
      if (tag === "pre" || node.parentElement?.tagName?.toLowerCase() !== "pre") {
        blocks.push({ type: "code", t: node.innerText.replace(/\n$/, "") });
      }
    } else if (tag === "li") blocks.push({ type: "li", t: node.innerText.trim() });
    else if (tag === "table") {
      const rows = [...node.querySelectorAll("tr")].map((tr) =>
        [...tr.querySelectorAll("th,td")].map((c) => c.innerText.trim().replace(/\|/g, "\\|"))
      );
      if (rows.length) blocks.push({ type: "table", rows });
    } else if (tag === "hr") blocks.push({ type: "hr" });
    else if (tag === "a" && node.href) {
      const text = node.innerText.trim();
      if (text) blocks.push({ type: "p", t: `[${text}](${node.href})` });
    } else {
      for (const child of node.childNodes) walk(child);
    }
  }

  walk(root);

  // Flatten naive walk duplicates: prefer structural emit by direct children only
  // Re-walk only direct meaningful elements under article
  return null;
}

function articleToMarkdown(articleHtml, title, url) {
  // Use a lightweight HTML→MD on known tags via regex on serialized HTML is fragile.
  // Prefer playwright-evaluated structured markdown from the page itself.
  return null;
}

async function extractMarkdown(page) {
  return page.evaluate(() => {
    const article =
      document.querySelector("article#zDocsContent") ||
      document.querySelector("#zDocsContent") ||
      document.querySelector("article") ||
      document.querySelector("[role=main]");
    if (!article) return { title: document.title, md: "" };

    const lines = [];
    const push = (s) => {
      if (s == null) return;
      const t = String(s).trim();
      if (t) lines.push(t);
    };

    function cellText(el) {
      return (el.innerText || "").trim().replace(/\s+/g, " ").replace(/\|/g, "\\|");
    }

    function walk(el) {
      if (!el || el.nodeType !== 1) return;
      const tag = el.tagName.toLowerCase();
      if (["script", "style", "noscript", "svg", "button", "nav"].includes(tag)) return;
      // Zoomin chrome / product picker inside shell — skip known junk
      const cls = String(el.className || "");
      if (/zDocsProduct|productSelector|cookie|banner/i.test(cls)) return;

      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag[1]);
        push("#".repeat(level) + " " + (el.innerText || "").trim());
        return;
      }
      if (tag === "p") {
        push((el.innerText || "").trim());
        return;
      }
      if (tag === "pre") {
        lines.push("```");
        lines.push((el.innerText || "").replace(/\n$/, ""));
        lines.push("```");
        return;
      }
      if (tag === "ul" || tag === "ol") {
        const items = el.querySelectorAll(":scope > li");
        items.forEach((li, i) => {
          const prefix = tag === "ol" ? `${i + 1}. ` : "- ";
          push(prefix + (li.innerText || "").trim().replace(/\s+/g, " "));
        });
        return;
      }
      if (tag === "table") {
        const rows = [...el.querySelectorAll("tr")].map((tr) =>
          [...tr.querySelectorAll("th,td")].map(cellText)
        );
        if (rows.length) {
          const header = rows[0];
          lines.push("| " + header.join(" | ") + " |");
          lines.push("| " + header.map(() => "---").join(" | ") + " |");
          for (let r = 1; r < rows.length; r++) {
            lines.push("| " + rows[r].join(" | ") + " |");
          }
          lines.push("");
        }
        return;
      }
      if (tag === "hr") {
        lines.push("---");
        return;
      }
      if (tag === "blockquote") {
        (el.innerText || "")
          .trim()
          .split(/\n/)
          .forEach((l) => push("> " + l.trim()));
        return;
      }
      for (const child of el.children) walk(child);
    }

    const contentRoot =
      article.querySelector(".zDocsTopicPageBody") ||
      article.querySelector(".body") ||
      article;
    for (const child of contentRoot.children) walk(child);

    let md = lines.join("\n\n");
    if (md.length < 120) {
      md = (article.innerText || "").trim();
    }
    return { title: document.title, md };
  });
}

async function gotoTopic(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector("article#zDocsContent", { timeout: 20000 });
    await page.waitForFunction(
      () => {
        const t = document.title || "";
        const art = document.querySelector("article#zDocsContent");
        const text = art ? art.innerText || "" : "";
        return (
          t !== "Axway Documentation Portal" &&
          text.length > 200 &&
          !text.trim().startsWith("## Filters")
        );
      },
      { timeout: 25000 }
    );
  } catch {
    await page.waitForTimeout(2000);
  }
}

async function collectLinks(page) {
  return page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="apim_policydev"]')) {
      let href = a.href.split("#")[0].split("?")[0];
      if (!href || seen.has(href)) continue;
      if (!href.includes("/apim_policydev/")) continue;
      seen.add(href);
      out.push({
        href,
        text: (a.innerText || a.textContent || "").trim().replace(/\s+/g, " "),
      });
    }
    return out;
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  console.log("Opening index…", INDEX_URL);
  await gotoTopic(page, INDEX_URL);
  const links = await collectLinks(page);
  console.log("Found", links.length, "pages");

  const manifest = [];
  let i = 0;
  for (const link of links) {
    i++;
    const slug = slugFromUrl(link.href);
    const outFile = path.join(OUT_DIR, `${slug}.md`);
    try {
      console.log(`[${i}/${links.length}]`, link.text || slug);
      await gotoTopic(page, link.href);
      const { title, md } = await extractMarkdown(page);
      const body = [
        "---",
        `title: ${JSON.stringify(title || link.text || slug)}`,
        `source: ${link.href}`,
        `scrapedAt: ${new Date().toISOString()}`,
        "---",
        "",
        md || "",
        "",
      ].join("\n");
      fs.writeFileSync(outFile, body, "utf8");
      manifest.push({
        title: title || link.text,
        url: link.href,
        file: path.relative(path.resolve(__dirname, ".."), outFile).replace(/\\/g, "/"),
        bytes: Buffer.byteLength(body, "utf8"),
      });
    } catch (e) {
      console.error("FAIL", link.href, e.message);
      manifest.push({ title: link.text, url: link.href, error: String(e.message) });
    }
  }

  const indexMd = [
    "# Axway Policy Development docs (RAG corpus)",
    "",
    `Source root: ${INDEX_URL}`,
    `Scraped: ${new Date().toISOString()}`,
    `Pages: ${manifest.filter((m) => !m.error).length} / ${manifest.length}`,
    "",
    "| Title | File | URL |",
    "| --- | --- | --- |",
    ...manifest.map((m) => {
      const f = m.file || "";
      const t = (m.title || "").replace(/\|/g, "\\|");
      return `| ${t} | \`${f}\` | ${m.url} |`;
    }),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "_manifest.md"), indexMd, "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  await browser.close();
  console.log("Done. Output:", OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
