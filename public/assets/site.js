// Renders the public pages from /api/content. All text is inserted as text, never as HTML.
(() => {
  // Achievement groups shown on the home page. "honors" items appear inside Certificates instead.
  const SECTIONS = [
    { key: "programs", title: "Academic programs & fellowships" },
    { key: "leadership", title: "Leadership & activities" }
  ];
  const VISIBLE = new Set(SECTIONS.map((x) => x.key));

  // ---------- small helpers ----------
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false || kid === "") continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);
  const fileUrl = (key) => `/files/${encodeURIComponent(key)}`;
  const achUrl = (a) => `/achievements/${encodeURIComponent(a.id)}`;
  const docUrl = (d) => `/documents/${encodeURIComponent(d.id)}`;
  const projUrl = (x) => `/projects/${encodeURIComponent(x.id)}`;
  const isImage = (f) => /^image\//.test(f.type || "");
  const prettyHost = (u) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const ext = { target: "_blank", rel: "noopener" };

  // Icons are fixed strings written here, never content from the site's data.
  const ICONS = {
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    github: '<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
    linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
    download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
    doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    heart: '<path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.2 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5c3.4 0 5.4 3.6 4.1 6.8C19.5 16.4 12 21 12 21z"/>'
  };
  function icon(name, solid = false) {
    const s = document.createElement("span");
    s.className = `ic${solid ? " solid" : ""}`;
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[name]}</svg>`;
    return s;
  }

  async function loadContent() {
    const res = await fetch("/api/content", { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`The site content could not be loaded (error ${res.status}).`);
    return res.json();
  }

  function fileSummary(files) {
    const n = files.length;
    if (!n) return "Details";
    const pdfs = files.filter((f) => !isImage(f)).length;
    if (pdfs === n) return n === 1 ? "1 PDF" : `${n} PDFs`;
    if (pdfs === 0) return n === 1 ? "1 image" : `${n} images`;
    return `${n} files`;
  }

  // A small preview of a file: the image itself, or a PDF's first page (drawn later by pdf-thumb.js)
  function preview(f, cls, fallbackIcon) {
    if (!f) return h("div", { class: `${cls} ph`, "aria-hidden": "true" }, icon(fallbackIcon));
    return isImage(f)
      ? h("img", { class: cls, src: fileUrl(f.key), alt: "", loading: "lazy" })
      : h("div", { class: `${cls} pdf`, "data-pdf": fileUrl(f.key), "data-alt": "" }, "PDF");
  }

  function footer(p) {
    return h("footer", { class: "site-foot" },
      h("span", {}, `© ${new Date().getFullYear()} ${p.name || ""}`),
      h("span", { class: "love" }, "Made with ", icon("heart", true), h("span", { class: "visually-hidden" }, "love"), " with Claude"),
      h("a", { href: "/admin" }, "Admin"));
  }

  // ---------- profile ----------
  function profile(p) {
    const contactRow = (ic, content) => h("li", {}, icon(ic), content);
    const contact = h("ul", { class: "contact" },
      p.location && contactRow("pin", h("span", {}, p.location)),
      p.email && contactRow("mail", h("a", { href: `mailto:${p.email}` }, p.email)),
      p.showPhone && p.phone && contactRow("phone", h("span", {}, p.phone)),
      safeUrl(p.website) && contactRow("globe", h("a", { href: p.website, ...ext }, prettyHost(p.website))),
      safeUrl(p.github) && contactRow("github", h("a", { href: p.github, ...ext }, prettyHost(p.github))),
      safeUrl(p.linkedin) && contactRow("linkedin", h("a", { href: p.linkedin, ...ext }, prettyHost(p.linkedin))));
    const pic = p.photo
      ? h("img", { class: "avatar", src: fileUrl(p.photo), alt: `Photo of ${p.name}` })
      : h("div", { class: "avatar monogram", "aria-hidden": "true" }, p.initials || (p.name || "?").slice(0, 2));
    return h("div", { class: "profile" },
      h("div", { class: "profile-top" }, pic,
        h("div", { class: "badges" },
          p.gradYear && h("span", { class: "badge" }, p.gradYear),
          p.intendedMajor && h("span", { class: "badge accent" }, p.intendedMajor))),
      h("div", {}, h("h1", {}, p.name), p.tagline && h("p", { class: "tagline" }, p.tagline)),
      (p.resume || p.email) && h("div", { class: "actions" },
        p.resume && h("a", { class: "btn-main", href: fileUrl(p.resume), ...ext }, icon("download"), "Résumé PDF"),
        p.email && h("a", { class: "btn-ghost", href: `mailto:${p.email}` }, icon("mail"), "Email me")),
      contact);
  }

  // ---------- home page pieces ----------
  function achievementCard(a) {
    const count = (a.files || []).length;
    return h("a", { class: "card", href: achUrl(a) },
      h("div", {},
        h("div", { class: "meta" },
          a.category && h("span", { class: "pill" }, a.category),
          a.dates && h("span", { class: "when" }, a.dates),
          count > 0 && h("span", { class: "chip-files" }, `${count} ${count === 1 ? "credential" : "credentials"}`)),
        h("h3", {}, a.title),
        a.org && h("div", { class: "org" }, a.org),
        a.summary && h("p", {}, a.summary),
        h("div", { class: "more" }, "View details and credentials →")),
      (a.files || [])[0] && preview(a.files[0], "thumb"));
  }

  function projectCard(x) {
    const files = x.files || [];
    const cover = files.find(isImage) || files[0];
    return h("article", { class: "proj" },
      h("a", { class: "proj-media", href: projUrl(x), tabindex: "-1", "aria-hidden": "true" },
        cover ? preview(cover, "proj-cover", "code") : h("div", { class: "proj-cover ph" }, icon("code"))),
      h("div", { class: "proj-body" },
        h("div", { class: "meta" }, x.category && h("span", { class: "pill" }, x.category), x.date && h("span", { class: "when" }, x.date)),
        h("h3", {}, h("a", { href: projUrl(x) }, x.title)),
        x.summary && h("p", {}, x.summary),
        (x.tags || []).length > 0 && h("div", { class: "tags small" }, x.tags.slice(0, 6).map((t) => h("span", {}, t))),
        h("div", { class: "proj-links" },
          h("a", { href: projUrl(x) }, "Details →"),
          safeUrl(x.github) && h("a", { href: x.github, ...ext }, icon("github"), "Code"),
          safeUrl(x.link) && h("a", { href: x.link, ...ext }, icon("external"), "Live"))));
  }

  // One compact row with a small preview on the side
  function miniRow({ href, year, title, sub, files, fallbackIcon }) {
    return h("li", {}, h("a", { class: "mini", href },
      preview((files || [])[0], "mini-thumb", fallbackIcon),
      h("div", { class: "mini-text" },
        h("span", { class: "mini-title" }, title),
        h("small", {}, [year, ...sub].filter(Boolean).join(" · "))),
      h("span", { class: "go" }, `${fileSummary(files || [])} →`)));
  }

  function transcriptRows(c) {
    return (c.documents || [])
      .filter((d) => d.kind === "transcript" && (d.files || []).length)
      .map((d) => ({ href: docUrl(d), year: d.year, title: d.title, sub: [d.issuer, d.date], files: d.files, fallbackIcon: "doc" }));
  }

  // Certificates = certificate documents + honors (unless a certificate document already covers that honor)
  function certificateRows(c) {
    const docs = (c.documents || []).filter((d) => d.kind === "certificate" && (d.files || []).length);
    const covered = new Set(docs.map((d) => d.achievementId).filter(Boolean));
    const honors = (c.achievements || []).filter((a) => a.section === "honors" && !covered.has(a.id));
    return [
      ...docs.map((d) => ({ href: docUrl(d), year: d.year, title: d.title, sub: [d.issuer, d.date !== d.year ? d.date : ""], files: d.files, fallbackIcon: "award" })),
      ...honors.map((a) => ({ href: achUrl(a), year: a.year, title: a.title, sub: [a.org, a.dates !== a.year ? a.dates : ""], files: a.files || [], fallbackIcon: "award" }))
    ];
  }

  function renderHome(c, root) {
    const p = c.profile || {};
    document.title = p.name ? `${p.name} · Résumé` : "Résumé";
    let n = 0;
    const num = () => String(++n).padStart(2, "0");
    const nav = [];
    const sections = [];
    const section = (id, title, ...body) => {
      const nn = num();
      nav.push([id, nn, title]);
      sections.push(h("section", { id }, h("div", { class: "sec-head" }, h("span", { class: "n" }, nn), h("h2", {}, title)), ...body));
    };

    section("about", "About",
      p.about && h("p", { class: "lede" }, p.about),
      (p.facts || []).length > 0 && h("div", { class: "facts" }, p.facts.map((f) => h("div", { class: "fact" }, h("b", {}, f.value), h("span", {}, f.label)))));

    if ((c.education || []).length) {
      section("education", "Education", h("ol", { class: "timeline" }, c.education.map((e) =>
        e.kind === "note"
          ? h("li", { class: "gap" }, h("div", { class: "when" }, e.when), h("div", { class: "gapnote" }, h("h3", {}, e.title), e.text && h("p", {}, e.text)))
          : h("li", { class: e.current ? "now" : "" },
              h("div", { class: "when" }, e.when),
              h("h3", {}, e.title, e.badge ? " " : "", e.badge && h("span", { class: "pill gold" }, e.badge)),
              e.place && h("div", { class: "where" }, e.place),
              e.text && h("p", {}, e.text)))));
    }

    const programs = (c.achievements || []).filter((a) => a.section === "programs");
    if (programs.length) section("programs", SECTIONS[0].title, h("div", { class: "cards" }, programs.map(achievementCard)));

    if ((c.projects || []).length) section("projects", "Projects", h("div", { class: "projects" }, c.projects.map(projectCard)));

    const leadership = (c.achievements || []).filter((a) => a.section === "leadership");
    if (leadership.length) section("leadership", SECTIONS[1].title, h("div", { class: "cards" }, leadership.map(achievementCard)));

    const groups = [
      { id: "transcripts", title: "Transcripts", rows: transcriptRows(c) },
      { id: "certificates", title: "Certificates", rows: certificateRows(c) }
    ].filter((g) => g.rows.length);
    if (groups.length) {
      section("documents", "Transcripts & certificates", groups.map((g) =>
        h("div", { class: "subcat", id: g.id },
          h("h3", { class: "subcat-title" }, g.title, h("span", { class: "count" }, String(g.rows.length))),
          h("ul", { class: "minilist" }, g.rows.map(miniRow)))));
    }

    if ((c.skills || []).length) {
      section("skills", "Technical skills", h("div", { class: "skills" }, c.skills.map((g) =>
        h("div", { class: "skill" }, h("h3", {}, g.group), h("div", { class: "tags" }, g.items.map((t) => h("span", {}, t)))))));
    }

    root.replaceChildren(h("div", { class: "shell" },
      h("aside", { class: "id" },
        profile(p),
        h("nav", { class: "toc", "aria-label": "Sections" }, nav.map(([id, nn, label]) => h("a", { href: `#${id}` }, h("span", {}, nn), label)))),
      h("main", { id: "main" }, sections, footer(p))));
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  // ---------- file display ----------
  function lightbox() {
    let dlg = document.querySelector("dialog.lightbox");
    if (dlg) return dlg;
    dlg = h("dialog", { class: "lightbox", "aria-label": "Image preview" });
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
        h("span", {}, h("a", { href: fileUrl(f.key), ...ext }, "Open full size"), "  ", h("button", { type: "button", onclick: () => dlg.close() }, "Close"))));
    dlg.showModal();
  }

  function gallery(files, emptyText) {
    if (!files.length) return h("p", { class: "empty" }, emptyText);
    return h("div", { class: "gallery" }, files.map((f) => h("figure", { class: "doc" },
      isImage(f)
        ? h("button", { class: "open", type: "button", "aria-label": `Enlarge ${f.caption || f.name}`, onclick: () => openImage(f) }, h("img", { src: fileUrl(f.key), alt: f.caption || f.name, loading: "lazy" }))
        : h("a", { href: fileUrl(f.key), ...ext, "aria-label": `Open ${f.caption || f.name} (PDF)` }, h("div", { class: "pdfbox", "data-pdf": fileUrl(f.key), "data-alt": `First page of ${f.caption || f.name}` }, "PDF")),
      h("figcaption", {}, f.caption || f.name, h("small", {}, h("a", { href: fileUrl(f.key), ...ext }, isImage(f) ? "Open image" : "Open PDF"))))));
  }

  // Full-width viewer: each file in its own panel; PDFs are drawn page by page
  function viewer(files, emptyText) {
    if (!files.length) return h("p", { class: "empty" }, emptyText);
    const sheets = files.map((f, n) => {
      const label = f.caption || f.name;
      const body = isImage(f)
        ? h("button", { class: "sheet-open", type: "button", "aria-label": `Enlarge ${label}`, onclick: () => openImage(f) }, h("img", { class: "sheet-img", src: fileUrl(f.key), alt: label }))
        : h("div", { class: "pdf-pages", "data-pdf-pages": fileUrl(f.key) }, h("p", { class: "loading-pages" }, "Loading pages…"));
      return h("section", { class: "sheet", id: `file-${n + 1}` },
        h("header", {},
          h("div", {}, h("span", { class: "sheet-num" }, String(n + 1).padStart(2, "0")), h("strong", {}, label), " ", h("span", { class: "when" }, isImage(f) ? "Image" : "PDF")),
          h("a", { class: "sheet-link", href: fileUrl(f.key), ...ext }, "Open original ↗")),
        h("div", { class: "sheet-body" }, body));
    });
    return h("div", { class: "viewer" },
      files.length > 1 && h("nav", { class: "file-index", "aria-label": "Files" },
        h("span", { class: "when" }, `${files.length} files`),
        files.map((f, n) => h("a", { href: `#file-${n + 1}` }, f.caption || f.name))),
      sheets);
  }

  function drawPdfPages(root) {
    root.querySelectorAll("[data-pdf-pages]").forEach((box) => {
      const label = box.closest(".sheet")?.querySelector("header .when");
      window.PdfThumb?.renderPages(box, box.dataset.pdfPages)
        .then((count) => { if (label && count) label.textContent = `PDF · ${count} page${count > 1 ? "s" : ""}`; })
        .catch(() => box.replaceChildren(h("p", { class: "loading-pages" }, "This PDF can't be previewed here. ", h("a", { href: box.dataset.pdfPages, ...ext }, "Open it in a new tab."))));
    });
  }

  function notFound(root, p, what, back, backLabel) {
    document.title = `Not found · ${p.name || ""}`;
    root.replaceChildren(h("div", { class: "error-box" }, h("h1", {}, `This ${what} isn't here`), h("p", {}, "It may have been renamed, hidden or removed."), h("a", { href: back }, `← ${backLabel}`)));
  }

  const pager = (label, prev, next, url) => (prev || next) && h("nav", { class: "pager", "aria-label": label },
    prev && h("a", { href: url(prev) }, h("small", {}, "← Previous"), prev.title),
    next && h("a", { class: "next", href: url(next) }, h("small", {}, "Next →"), next.title));

  const currentId = () => decodeURIComponent(new URLSearchParams(location.search).get("id") || location.pathname.split("/").filter(Boolean).pop() || "");

  // ---------- achievement page ----------
  function renderAchievement(c, root) {
    const p = c.profile || {};
    const id = currentId();
    const all = c.achievements || [];
    const a = all.find((x) => x.id === id);
    if (!a) return notFound(root, p, "achievement", "/", "Back to the résumé");
    const isHonor = a.section === "honors";
    const list = all.filter((x) => (isHonor ? x.section === "honors" : VISIBLE.has(x.section)));
    const i = list.indexOf(a);
    document.title = `${a.title} · ${p.name}`;
    const linked = (c.documents || []).filter((d) => d.achievementId === a.id && (d.files || []).length);
    const files = [...(a.files || []), ...linked.flatMap((d) => (d.files || []).map((f) => ({ ...f, caption: f.caption || d.title })))];

    root.replaceChildren(h("div", { class: "detail" },
      h("div", { class: "crumbs" }, h("a", { href: isHonor ? "/#certificates" : `/#${a.section}` }, isHonor ? "← Certificates" : `← ${p.name}`), h("span", { class: "when" }, `${i + 1} of ${list.length}`)),
      h("header", { class: "hero" },
        h("div", { class: "meta" }, a.category && h("span", { class: "pill" }, a.category), a.dates && h("span", { class: "when" }, a.dates)),
        h("h1", {}, a.title),
        a.org && h("div", { class: "org" }, a.org),
        a.track && h("div", { class: "when" }, `Track: ${a.track}`),
        a.summary && h("p", { class: "summary" }, a.summary)),
      (a.bullets || []).length > 0 && h("section", { class: "block" }, h("h2", {}, "What I did"), h("ul", {}, a.bullets.map((b) => h("li", {}, b)))),
      (a.tags || []).length > 0 && h("section", { class: "block" }, h("h2", {}, "Skills and topics"), h("div", { class: "tags" }, a.tags.map((t) => h("span", {}, t)))),
      h("section", { class: "block" },
        h("h2", {}, "Credentials"),
        gallery(files, "Certificates for this achievement will appear here."),
        linked.length > 0 && h("p", { class: "related" }, "Also filed under ", linked.flatMap((d, j) => [j ? ", " : "", h("a", { href: docUrl(d) }, d.title)]), ".")),
      pager("More achievements", list[i - 1], list[i + 1], achUrl),
      footer(p)));
  }

  // ---------- document page ----------
  function renderDocument(c, root) {
    const p = c.profile || {};
    const id = currentId();
    const d = (c.documents || []).find((x) => x.id === id);
    if (!d) return notFound(root, p, "document", "/#documents", "Back to transcripts & certificates");
    const isT = d.kind === "transcript";
    const sameKind = (c.documents || []).filter((x) => x.kind === d.kind && ((x.files || []).length || x === d));
    const i = sameKind.indexOf(d);
    const ach = (c.achievements || []).find((a) => a.id === d.achievementId);
    document.title = `${d.title} · ${p.name}`;

    root.replaceChildren(h("div", { class: "detail" },
      h("div", { class: "crumbs" }, h("a", { href: isT ? "/#transcripts" : "/#certificates" }, isT ? "← Transcripts" : "← Certificates"), h("span", { class: "when" }, `${i + 1} of ${sameKind.length}`)),
      h("header", { class: "hero" },
        h("div", { class: "meta" }, h("span", { class: `pill${isT ? " gold" : ""}` }, isT ? "Transcript" : "Certificate"), d.date && h("span", { class: "when" }, d.date)),
        h("h1", {}, d.title),
        d.issuer && h("div", { class: "org" }, d.issuer),
        d.note && h("p", { class: "summary" }, d.note),
        ach && VISIBLE.has(ach.section) && h("p", { class: "related" }, "Related achievement: ", h("a", { href: achUrl(ach) }, ach.title))),
      viewer(d.files || [], "The file for this document will appear here."),
      pager(isT ? "More transcripts" : "More certificates", sameKind[i - 1], sameKind[i + 1], docUrl),
      footer(p)));
    drawPdfPages(root);
  }

  // ---------- project page ----------
  function githubRepo(u) {
    const m = (u || "").match(/^https?:\/\/(www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(\.git)?\/?(#.*)?$/i);
    return m ? { owner: m[2], repo: m[3] } : null;
  }

  function repoCard(url) {
    const r = githubRepo(url);
    if (!r) return null;
    const card = h("a", { class: "repo", href: url, ...ext },
      icon("github"), h("div", {}, h("strong", {}, `${r.owner}/${r.repo}`), h("small", { class: "repo-meta" }, "View the code on GitHub")));
    // Live details from GitHub's public API; the card still works as a plain link if this fails.
    fetch(`https://api.github.com/repos/${r.owner}/${r.repo}`, { headers: { accept: "application/vnd.github+json" } })
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => {
        if (!info) return;
        const bits = [info.language, `${info.stargazers_count} ${info.stargazers_count === 1 ? "star" : "stars"}`, info.pushed_at && `updated ${new Date(info.pushed_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`].filter(Boolean);
        card.querySelector(".repo-meta").textContent = bits.join(" · ");
        if (info.description) card.querySelector("div").append(h("span", { class: "repo-desc" }, info.description));
      })
      .catch(() => {});
    return card;
  }

  function renderProject(c, root) {
    const p = c.profile || {};
    const id = currentId();
    const list = c.projects || [];
    const x = list.find((y) => y.id === id);
    if (!x) return notFound(root, p, "project", "/#projects", "Back to projects");
    const i = list.indexOf(x);
    document.title = `${x.title} · ${p.name}`;

    root.replaceChildren(h("div", { class: "detail" },
      h("div", { class: "crumbs" }, h("a", { href: "/#projects" }, "← Projects"), h("span", { class: "when" }, `${i + 1} of ${list.length}`)),
      h("header", { class: "hero" },
        h("div", { class: "meta" }, x.category && h("span", { class: "pill" }, x.category), x.date && h("span", { class: "when" }, x.date)),
        h("h1", {}, x.title),
        x.summary && h("p", { class: "summary" }, x.summary),
        (safeUrl(x.github) || safeUrl(x.link)) && h("div", { class: "actions" },
          safeUrl(x.github) && h("a", { class: "btn-main", href: x.github, ...ext }, icon("github"), "View code"),
          safeUrl(x.link) && h("a", { class: "btn-ghost", href: x.link, ...ext }, icon("external"), "Open live project"))),
      safeUrl(x.github) && repoCard(x.github),
      (x.details || []).length > 0 && h("section", { class: "block" }, h("h2", {}, "About this project"), h("ul", {}, x.details.map((b) => h("li", {}, b)))),
      (x.tags || []).length > 0 && h("section", { class: "block" }, h("h2", {}, "Built with"), h("div", { class: "tags" }, x.tags.map((t) => h("span", {}, t)))),
      (x.files || []).length > 0 && h("section", { class: "block" }, h("h2", {}, "Files"), viewer(x.files, "")),
      pager("More projects", list[i - 1], list[i + 1], projUrl),
      footer(p)));
    drawPdfPages(root);
  }

  // ---------- start ----------
  const root = document.getElementById("app");
  const pages = { detail: renderAchievement, document: renderDocument, project: renderProject };
  loadContent()
    .then((c) => {
      (pages[document.body.dataset.page] || renderHome)(c, root);
      window.PdfThumb?.attachAll(root);
    })
    .catch((e) => root.replaceChildren(h("div", { class: "error-box" }, h("h1", {}, "Something went wrong"), h("p", {}, e.message), h("p", {}, "Refresh the page to try again."))));
})();
