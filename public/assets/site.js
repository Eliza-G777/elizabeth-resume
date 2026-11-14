// Renders the public pages from /api/content. All text is inserted as text, never as HTML.
(() => {
  const SECTIONS = [
    { key: "programs", title: "Academic programs & fellowships" },
    { key: "leadership", title: "Leadership & activities" },
    { key: "honors", title: "Honors & certificates" }
  ];

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false || kid === "") continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);
  const fileUrl = (key) => `/files/${encodeURIComponent(key)}`;
  const achUrl = (a) => `/achievements/${encodeURIComponent(a.id)}`;
  const isImage = (f) => /^image\//.test(f.type || "");
  const prettyHost = (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

  async function loadContent() {
    const res = await fetch("/api/content", { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`The site content could not be loaded (error ${res.status}).`);
    return res.json();
  }

  function identity(p) {
    const contact = h("ul", { class: "contact" },
      p.location && h("li", {}, h("span", { class: "k" }, "Base"), h("span", { class: "v" }, p.location)),
      p.email && h("li", {}, h("span", { class: "k" }, "Email"), h("a", { href: `mailto:${p.email}` }, p.email)),
      p.showPhone && p.phone && h("li", {}, h("span", { class: "k" }, "Phone"), h("span", { class: "v" }, p.phone)),
      safeUrl(p.website) && h("li", {}, h("span", { class: "k" }, "Web"), h("a", { href: p.website, target: "_blank", rel: "noopener" }, prettyHost(p.website))),
      safeUrl(p.github) && h("li", {}, h("span", { class: "k" }, "Code"), h("a", { href: p.github, target: "_blank", rel: "noopener" }, prettyHost(p.github))),
      safeUrl(p.linkedin) && h("li", {}, h("span", { class: "k" }, "Link"), h("a", { href: p.linkedin, target: "_blank", rel: "noopener" }, prettyHost(p.linkedin)))
    );
    const pic = p.photo
      ? h("img", { class: "avatar", src: fileUrl(p.photo), alt: `Photo of ${p.name}` })
      : h("div", { class: "monogram", "aria-hidden": "true" }, p.initials || (p.name || "?").slice(0, 2));
    return { pic, contact };
  }

  function achievementCard(a) {
    const first = (a.files || [])[0];
    const thumb = first
      ? isImage(first)
        ? h("img", { class: "thumb", src: fileUrl(first.key), alt: "", loading: "lazy" })
        : h("div", { class: "thumb pdf", "aria-hidden": "true" }, "PDF")
      : null;
    const count = (a.files || []).length;
    return h("a", { class: "card", href: achUrl(a) },
      h("div", {},
        h("div", { class: "meta" },
          a.category && h("span", { class: "pill" }, a.category),
          a.dates && h("span", { class: "when" }, a.dates),
          count > 0 && h("span", { class: "chip-files" }, `${count} ${count === 1 ? "credential" : "credentials"}`)
        ),
        h("h3", {}, a.title),
        a.org && h("div", { class: "org" }, a.org),
        a.summary && h("p", {}, a.summary),
        h("div", { class: "more" }, "View details and credentials →")
      ),
      thumb
    );
  }

  function renderHome(c, root) {
    const p = c.profile || {};
    document.title = p.name || "Résumé";
    const { pic, contact } = identity(p);
    const ach = c.achievements || [];
    let n = 0;
    const num = () => String(++n).padStart(2, "0");
    const navItems = [];
    const sections = [];

    const aboutN = num();
    navItems.push(["about", aboutN, "About"]);
    sections.push(h("section", { id: "about" },
      h("div", { class: "sec-head" }, h("span", { class: "n" }, aboutN), h("h2", {}, "About")),
      p.about && h("p", { class: "lede" }, p.about),
      (p.facts || []).length > 0 && h("div", { class: "facts" }, p.facts.map((f) => h("div", { class: "fact" }, h("b", {}, f.value), h("span", {}, f.label))))
    ));

    if ((c.education || []).length) {
      const eN = num();
      navItems.push(["education", eN, "Education"]);
      sections.push(h("section", { id: "education" },
        h("div", { class: "sec-head" }, h("span", { class: "n" }, eN), h("h2", {}, "Education")),
        h("ol", { class: "timeline" }, c.education.map((e) =>
          e.kind === "note"
            ? h("li", { class: "gap" }, h("div", { class: "when" }, e.when), h("div", { class: "gapnote" }, h("h3", {}, e.title), e.text && h("p", {}, e.text)))
            : h("li", { class: e.current ? "now" : "" },
                h("div", { class: "when" }, e.when),
                h("h3", {}, e.title, e.badge ? " " : "", e.badge && h("span", { class: "pill gold" }, e.badge)),
                e.place && h("div", { class: "where" }, e.place),
                e.text && h("p", {}, e.text))
        ))
      ));
    }

    for (const s of SECTIONS) {
      const items = ach.filter((a) => a.section === s.key);
      if (!items.length) continue;
      const sN = num();
      navItems.push([s.key, sN, s.title]);
      const body = s.key === "honors"
        ? h("ul", { class: "honors" }, items.map((a) => h("li", {}, h("a", { href: achUrl(a) },
            h("span", { class: "yr" }, a.year),
            h("div", {}, a.title, h("small", {}, [a.org, a.dates].filter(Boolean).join(" · "))),
            h("span", { class: "go" }, (a.files || []).length ? `${a.files.length} file${a.files.length > 1 ? "s" : ""} →` : "→")))))
        : h("div", { class: "cards" }, items.map(achievementCard));
      sections.push(h("section", { id: s.key },
        h("div", { class: "sec-head" }, h("span", { class: "n" }, sN), h("h2", {}, s.title), h("span", { class: "hint" }, "Select any item for details")),
        body));
    }

    if ((c.skills || []).length) {
      const kN = num();
      navItems.push(["skills", kN, "Technical skills"]);
      sections.push(h("section", { id: "skills" },
        h("div", { class: "sec-head" }, h("span", { class: "n" }, kN), h("h2", {}, "Technical skills")),
        h("div", { class: "skills" }, c.skills.map((g) => h("div", { class: "skill" }, h("h3", {}, g.group), h("div", { class: "tags" }, g.items.map((t) => h("span", {}, t))))))
      ));
    }

    const year = (c.updatedAt || "").slice(0, 4) || new Date().getFullYear();
    root.replaceChildren(h("div", { class: "shell" },
      h("aside", { class: "id" },
        pic,
        h("div", {}, h("h1", {}, p.name), p.tagline && h("p", { class: "tagline" }, p.tagline)),
        contact,
        h("nav", { class: "toc", "aria-label": "Sections" }, navItems.map(([id, nn, label]) => h("a", { href: `#${id}` }, h("span", {}, nn), label)))
      ),
      h("main", {}, sections, h("footer", {}, h("span", {}, `${p.name} · Résumé, ${year}`), h("a", { href: "/admin" }, "Admin")))
    ));
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  function lightbox() {
    let dlg = document.querySelector("dialog.lightbox");
    if (dlg) return dlg;
    dlg = h("dialog", { class: "lightbox", "aria-label": "Credential preview" });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
    return dlg;
  }
  function openImage(f) {
    const dlg = lightbox();
    dlg.replaceChildren(
      h("img", { src: fileUrl(f.key), alt: f.caption || f.name }),
      h("div", { class: "bar" },
        h("span", {}, f.caption || f.name),
        h("span", {}, h("a", { href: fileUrl(f.key), target: "_blank", rel: "noopener" }, "Open full size"), "  ",
          h("button", { type: "button", onclick: () => dlg.close() }, "Close")))
    );
    dlg.showModal();
  }

  function renderDetail(c, root) {
    const params = new URLSearchParams(location.search);
    const id = params.get("id") || decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
    const list = c.achievements || [];
    const i = list.findIndex((a) => a.id === id);
    const p = c.profile || {};
    if (i < 0) {
      document.title = `Not found · ${p.name || ""}`;
      root.replaceChildren(h("div", { class: "error-box" }, h("h1", {}, "This achievement isn't here"), h("p", {}, "It may have been renamed or removed."), h("a", { href: "/" }, "← Back to the résumé")));
      return;
    }
    const a = list[i];
    document.title = `${a.title} · ${p.name}`;
    const prev = list[i - 1], next = list[i + 1];
    const files = a.files || [];

    root.replaceChildren(h("div", { class: "detail" },
      h("div", { class: "crumbs" }, h("a", { href: `/#${a.section}` }, `← ${p.name}`), h("span", { class: "when" }, `${i + 1} of ${list.length}`)),
      h("header", { class: "hero" },
        h("div", { class: "meta" }, a.category && h("span", { class: "pill" }, a.category), a.dates && h("span", { class: "when" }, a.dates)),
        h("h1", {}, a.title),
        a.org && h("div", { class: "org" }, a.org),
        a.track && h("div", { class: "when" }, `Track: ${a.track}`),
        a.summary && h("p", { class: "summary" }, a.summary)
      ),
      (a.bullets || []).length > 0 && h("section", { class: "block" }, h("h2", {}, "What I did"), h("ul", {}, a.bullets.map((b) => h("li", {}, b)))),
      (a.tags || []).length > 0 && h("section", { class: "block" }, h("h2", {}, "Skills and topics"), h("div", { class: "tags" }, a.tags.map((t) => h("span", {}, t)))),
      h("section", { class: "block" },
        h("h2", {}, "Credentials"),
        files.length
          ? h("div", { class: "gallery" }, files.map((f) => h("figure", { class: "doc" },
              isImage(f)
                ? h("button", { class: "open", type: "button", "aria-label": `Enlarge ${f.caption || f.name}`, onclick: () => openImage(f) }, h("img", { src: fileUrl(f.key), alt: f.caption || f.name, loading: "lazy" }))
                : h("a", { href: fileUrl(f.key), target: "_blank", rel: "noopener", "aria-label": `Open ${f.name}` }, h("div", { class: "pdfbox" }, "PDF")),
              h("figcaption", {}, f.caption || f.name, h("small", {}, h("a", { href: fileUrl(f.key), target: "_blank", rel: "noopener" }, isImage(f) ? "Open image" : "Open PDF"))))))
          : h("p", { class: "empty" }, "Certificates for this achievement will appear here.")
      ),
      h("nav", { class: "pager", "aria-label": "More achievements" },
        prev && h("a", { href: achUrl(prev) }, h("small", {}, "← Previous"), prev.title),
        next && h("a", { class: "next", href: achUrl(next) }, h("small", {}, "Next →"), next.title))
    ));
  }

  const root = document.getElementById("app");
  loadContent()
    .then((c) => (document.body.dataset.page === "detail" ? renderDetail(c, root) : renderHome(c, root)))
    .catch((e) => root.replaceChildren(h("div", { class: "error-box" }, h("h1", {}, "Something went wrong"), h("p", {}, e.message), h("p", {}, "Refresh the page to try again."))));
})();
