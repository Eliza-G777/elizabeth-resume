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
  const docUrl = (d) => `/documents/${encodeURIComponent(d.id)}`;
  const DOC_KINDS = [
    { key: "transcript", title: "Transcripts", empty: "No transcripts added yet." },
    { key: "certificate", title: "Certificates", empty: "No certificates added yet." }
  ];
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
        : h("div", { class: "thumb pdf", "data-pdf": fileUrl(first.key), "data-alt": "" }, "PDF")
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

  function thumbFor(f, label) {
    if (!f) return h("div", { class: "docthumb empty-thumb", "aria-hidden": "true" }, "No file yet");
    return isImage(f)
      ? h("img", { class: "docthumb", src: fileUrl(f.key), alt: "", loading: "lazy" })
      : h("div", { class: "docthumb pdf", "data-pdf": fileUrl(f.key), "data-alt": "" }, "PDF");
  }

  function docCard(d) {
    const n = (d.files || []).length;
    return h("a", { class: "doccard", href: docUrl(d) },
      thumbFor((d.files || [])[0]),
      h("div", { class: "docbody" },
        h("h4", {}, d.title),
        h("small", {}, [d.issuer, d.date].filter(Boolean).join(" · ")),
        h("span", { class: "chip-files" }, n ? `${n} ${n === 1 ? "file" : "files"}` : "No files yet")));
  }

  function gallery(files, emptyText) {
    if (!files.length) return h("p", { class: "empty" }, emptyText);
    return h("div", { class: "gallery" }, files.map((f) => h("figure", { class: "doc" },
      isImage(f)
        ? h("button", { class: "open", type: "button", "aria-label": `Enlarge ${f.caption || f.name}`, onclick: () => openImage(f) }, h("img", { src: fileUrl(f.key), alt: f.caption || f.name, loading: "lazy" }))
        : h("a", { href: fileUrl(f.key), target: "_blank", rel: "noopener", "aria-label": `Open ${f.caption || f.name} (PDF)` }, h("div", { class: "pdfbox", "data-pdf": fileUrl(f.key), "data-alt": `First page of ${f.caption || f.name}` }, "PDF")),
      h("figcaption", {}, f.caption || f.name, h("small", {}, h("a", { href: fileUrl(f.key), target: "_blank", rel: "noopener" }, isImage(f) ? "Open image" : "Open PDF"))))));
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

    const docs = (c.documents || []).filter((d) => (d.files || []).length);
    if (docs.length) {
      const dN = num();
      navItems.push(["documents", dN, "Transcripts & certificates"]);
      sections.push(h("section", { id: "documents" },
        h("div", { class: "sec-head" }, h("span", { class: "n" }, dN), h("h2", {}, "Transcripts & certificates")),
        DOC_KINDS.map((k) => {
          const items = docs.filter((d) => d.kind === k.key);
          if (!items.length) return null;
          return h("div", { class: "subcat", id: `${k.key}s` },
            h("h3", { class: "subcat-title" }, k.title, h("span", { class: "count" }, String(items.length))),
            h("div", { class: "docgrid" }, items.map(docCard)));
        })));
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
    // Credentials = files uploaded to the achievement + files of documents linked to it
    const linked = (c.documents || []).filter((d) => d.achievementId === a.id && (d.files || []).length);
    const files = [...(a.files || []), ...linked.flatMap((d) => (d.files || []).map((f) => ({ ...f, caption: f.caption || d.title })))];

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
        gallery(files, "Certificates for this achievement will appear here."),
        linked.length > 0 && h("p", { class: "related" }, "Also filed under ",
          linked.flatMap((d, j) => [j ? ", " : "", h("a", { href: docUrl(d) }, d.title)]), ".")
      ),
      h("nav", { class: "pager", "aria-label": "More achievements" },
        prev && h("a", { href: achUrl(prev) }, h("small", {}, "← Previous"), prev.title),
        next && h("a", { class: "next", href: achUrl(next) }, h("small", {}, "Next →"), next.title))
    ));
  }

  function renderDocument(c, root) {
    const id = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
    const all = (c.documents || []).filter((x) => (x.files || []).length);
    const d = (c.documents || []).find((x) => x.id === id);
    const p = c.profile || {};
    if (!d) {
      document.title = `Not found · ${p.name || ""}`;
      root.replaceChildren(h("div", { class: "error-box" }, h("h1", {}, "This document isn't here"), h("p", {}, "It may have been renamed, hidden or removed."), h("a", { href: "/#documents" }, "← Back to transcripts & certificates")));
      return;
    }
    const kind = DOC_KINDS.find((k) => k.key === d.kind) || DOC_KINDS[1];
    const sameKind = all.filter((x) => x.kind === d.kind);
    if (!sameKind.includes(d)) sameKind.push(d);
    const i = sameKind.indexOf(d);
    const prev = sameKind[i - 1], next = sameKind[i + 1];
    const ach = (c.achievements || []).find((a) => a.id === d.achievementId);
    document.title = `${d.title} · ${p.name}`;

    root.replaceChildren(h("div", { class: "detail" },
      h("div", { class: "crumbs" }, h("a", { href: `/#${d.kind}s` }, `← ${kind.title}`), h("span", { class: "when" }, `${i + 1} of ${sameKind.length}`)),
      h("header", { class: "hero" },
        h("div", { class: "meta" }, h("span", { class: `pill${d.kind === "transcript" ? " gold" : ""}` }, d.kind === "transcript" ? "Transcript" : "Certificate"), d.date && h("span", { class: "when" }, d.date)),
        h("h1", {}, d.title),
        d.issuer && h("div", { class: "org" }, d.issuer),
        d.note && h("p", { class: "summary" }, d.note),
        ach && h("p", { class: "related" }, "Related achievement: ", h("a", { href: achUrl(ach) }, ach.title))
      ),
      h("section", { class: "block" }, h("h2", {}, (d.files || []).length > 1 ? "Files" : "File"), gallery(d.files || [], "The file for this document will appear here.")),
      h("nav", { class: "pager", "aria-label": `More ${kind.title.toLowerCase()}` },
        prev && h("a", { href: docUrl(prev) }, h("small", {}, "← Previous"), prev.title),
        next && h("a", { class: "next", href: docUrl(next) }, h("small", {}, "Next →"), next.title))
    ));
  }

  const root = document.getElementById("app");
  loadContent()
    .then((c) => {
      const page = document.body.dataset.page;
      if (page === "detail") renderDetail(c, root);
      else if (page === "document") renderDocument(c, root);
      else renderHome(c, root);
      window.PdfThumb?.attachAll(root);
    })
    .catch((e) => root.replaceChildren(h("div", { class: "error-box" }, h("h1", {}, "Something went wrong"), h("p", {}, e.message), h("p", {}, "Refresh the page to try again."))));
})();
