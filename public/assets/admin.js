// Admin editor. The password check and every save happen on the server; this page only edits a copy of the content.
(() => {
  const root = document.getElementById("admin");
  const SECTION_LABELS = { programs: "Programs & fellowships", leadership: "Leadership & activities", honors: "Honors & certificates" };
  const TABS = [["profile", "Profile & photo"], ["education", "Education"], ["achievements", "Achievements"], ["skills", "Skills"], ["settings", "Backup & security"]];

  const state = { content: null, dirty: false, saving: false, tab: "achievements", achIndex: 0, eduIndex: 0, pendingDeletes: new Set() };

  // ---------- helpers ----------
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = Boolean(v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false || kid === "") continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  let uid = 0;
  const nextId = () => `f${++uid}`;
  const slugify = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 70) || "item";
  const fileUrl = (k) => `/files/${encodeURIComponent(k)}`;

  let toastTimer;
  function toast(msg, bad = false) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = `show${bad ? " bad" : ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ""), bad ? 6000 : 2800);
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      ...opts,
      headers: { "x-admin-request": "1", ...(opts.body && !(opts.body instanceof FormData) ? { "content-type": "application/json" } : {}), ...(opts.headers || {}) }
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (res.status === 401 && path !== "/api/login") {
      toast("Your session ended. Log in again; your unsaved edits are kept on this page.", true);
      showLogin();
      throw new Error(data.error || "Not logged in");
    }
    if (res.status === 429) throw new Error("Too many attempts. Wait a minute, then try again.");
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
    return data;
  }

  function markDirty() {
    state.dirty = true;
    const s = document.getElementById("status");
    if (s) { s.textContent = "Unsaved changes"; s.classList.add("dirty"); }
    const b = document.getElementById("saveBtn");
    if (b) b.disabled = false;
  }
  function markClean() {
    state.dirty = false;
    const s = document.getElementById("status");
    if (s) { s.textContent = "All changes saved"; s.classList.remove("dirty"); }
    const b = document.getElementById("saveBtn");
    if (b) b.disabled = true;
  }
  window.addEventListener("beforeunload", (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  // A text/textarea/select bound to obj[key]
  function field(label, obj, key, { type = "text", rows, hint, options, placeholder, onChange, list = false } = {}) {
    const id = nextId();
    const val = list ? (obj[key] || []).join("\n") : obj[key] ?? "";
    const update = (e) => {
      const v = e.target.value;
      obj[key] = list ? v.split("\n").map((s) => s.trim()).filter(Boolean) : v;
      markDirty();
      onChange?.(obj[key]);
    };
    let input;
    if (type === "textarea") input = h("textarea", { id, rows: rows || 4, placeholder, oninput: update }, val);
    else if (type === "select") input = h("select", { id, onchange: update }, options.map(([v, l]) => h("option", { value: v, selected: v === val ? true : null }, l)));
    else input = h("input", { id, type, value: val, placeholder, oninput: update });
    return h("label", { class: "field", for: id }, h("span", {}, label), input, hint && h("small", {}, hint));
  }
  function tagField(label, obj, key, hint) {
    const id = nextId();
    return h("label", { class: "field", for: id }, h("span", {}, label),
      h("input", { id, type: "text", value: (obj[key] || []).join(", "), oninput: (e) => { obj[key] = e.target.value.split(",").map((s) => s.trim()).filter(Boolean); markDirty(); } }),
      hint && h("small", {}, hint));
  }
  function check(label, obj, key) {
    const id = nextId();
    return h("label", { class: "check", for: id }, h("input", { id, type: "checkbox", checked: obj[key], onchange: (e) => { obj[key] = e.target.checked; markDirty(); } }), label);
  }
  // Two-click delete so nothing disappears by accident
  function deleteButton(label, onConfirm) {
    let armed = false, timer;
    const b = h("button", { type: "button", class: "btn small danger", onclick: () => {
      if (!armed) {
        armed = true; b.textContent = "Click again to delete"; b.classList.add("armed");
        timer = setTimeout(() => { armed = false; b.textContent = label; b.classList.remove("armed"); }, 3500);
      } else { clearTimeout(timer); onConfirm(); }
    } }, label);
    return b;
  }
  function move(arr, i, d) {
    const j = i + d;
    if (j < 0 || j >= arr.length) return i;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    markDirty();
    return j;
  }

  // ---------- uploads ----------
  async function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    const MAX_SIDE = 2400;
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { return file; }
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  }
  async function uploadOne(file) {
    const ready = await shrinkImage(file);
    if (ready.size > 4 * 1024 * 1024) throw new Error(`${file.name} is over 4 MB. Compress it or split the PDF, then try again.`);
    const fd = new FormData();
    fd.append("file", ready, ready.name);
    const { file: saved } = await api("/api/upload", { method: "POST", body: fd });
    return { ...saved, name: file.name };
  }
  function dropZone({ multiple, accept, label, onFiles }) {
    const id = nextId();
    const input = h("input", { id, type: "file", class: "visually-hidden", multiple: multiple || null, accept, onchange: (e) => { onFiles([...e.target.files]); e.target.value = ""; } });
    const zone = h("div", { class: "drop" },
      h("div", {}, label),
      h("label", { class: "btn", for: id }, multiple ? "Choose files" : "Choose file"), input,
      h("small", {}, "JPG, PNG, WebP, GIF or PDF · up to 4 MB each · large photos are resized automatically"));
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); const fl = [...e.dataTransfer.files]; if (fl.length) onFiles(multiple ? fl : fl.slice(0, 1)); });
    return zone;
  }

  // ---------- screens ----------
  function showSetupProblem(msg) {
    root.replaceChildren(h("div", { class: "login" },
      h("h1", {}, "Admin isn't set up yet"),
      h("p", {}, msg),
      h("p", {}, "In Netlify, open this site's Project configuration → Environment variables, add the missing value (scope: Functions), then redeploy.")));
  }

  function showLogin() {
    const err = h("p", { class: "err", role: "alert" });
    const pw = h("input", { id: "pw", type: "password", autocomplete: "current-password", required: true });
    const btn = h("button", { class: "btn primary", type: "submit" }, "Log in");
    const form = h("form", { onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = ""; btn.disabled = true; btn.textContent = "Checking…";
      try {
        await api("/api/login", { method: "POST", body: JSON.stringify({ password: pw.value }) });
        pw.value = "";
        if (state.content) renderEditor(); else await loadEditor();
      } catch (ex) {
        err.textContent = ex.message; pw.select();
      } finally { btn.disabled = false; btn.textContent = "Log in"; }
    } }, h("label", { class: "field", for: "pw" }, h("span", {}, "Admin password"), pw), err, btn);
    root.replaceChildren(h("div", { class: "login" },
      h("h1", {}, "Site admin"),
      h("p", {}, "Log in to edit the résumé, upload credentials and change the profile photo."),
      form,
      h("a", { href: "/" }, "← Back to the public site")));
    pw.focus();
  }

  async function loadEditor() {
    root.replaceChildren(h("p", { class: "loading" }, "Loading content…"));
    const res = await fetch("/api/content", { cache: "no-store" });
    state.content = await res.json();
    for (const k of ["education", "achievements", "skills"]) state.content[k] ||= [];
    state.content.profile ||= {};
    state.content.profile.facts ||= [];
    renderEditor();
    markClean();
  }

  async function save() {
    if (state.saving) return;
    state.saving = true;
    const b = document.getElementById("saveBtn");
    if (b) { b.disabled = true; b.textContent = "Saving…"; }
    try {
      const { content } = await api("/api/content", { method: "PUT", body: JSON.stringify(state.content) });
      state.content = content;
      // Files removed in the editor are deleted only once the save has succeeded.
      const stillUsed = new Set([state.content.profile.photo, ...state.content.achievements.flatMap((a) => a.files.map((f) => f.key))]);
      for (const key of [...state.pendingDeletes]) {
        if (stillUsed.has(key)) { state.pendingDeletes.delete(key); continue; }
        try { await api(`/api/files/${encodeURIComponent(key)}`, { method: "DELETE" }); state.pendingDeletes.delete(key); } catch { /* retried on next save */ }
      }
      markClean();
      toast("Saved. The public site is updated.");
      renderTab();
    } catch (e) {
      if (!/Not logged in/.test(e.message)) toast(e.message, true);
      if (b) b.disabled = false;
    } finally {
      state.saving = false;
      if (b) b.textContent = "Save changes";
    }
  }
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && state.content) { e.preventDefault(); if (state.dirty) save(); }
  });

  function renderEditor() {
    const tabs = h("div", { class: "tabs", role: "tablist", "aria-label": "Editor sections" },
      TABS.map(([key, label]) => h("button", { type: "button", role: "tab", "aria-selected": String(state.tab === key), onclick: () => { state.tab = key; renderEditor(); } }, label)));
    root.replaceChildren(
      h("header", { class: "topbar" }, h("div", { class: "in" },
        h("h1", {}, "Site admin"),
        h("span", { id: "status", class: `status${state.dirty ? " dirty" : ""}` }, state.dirty ? "Unsaved changes" : "All changes saved"),
        h("button", { id: "saveBtn", class: "btn primary", type: "button", disabled: state.dirty ? null : true, onclick: save }, "Save changes"),
        h("a", { class: "btn", href: "/", target: "_blank", rel: "noopener" }, "View site ↗"),
        h("button", { class: "btn", type: "button", onclick: async () => {
          if (state.dirty) { toast("Save or export your changes before logging out.", true); return; }
          await api("/api/logout", { method: "POST" }).catch(() => {});
          state.content = null; showLogin();
        } }, "Log out"))),
      h("div", { class: "layout" }, tabs, h("div", { id: "panel", class: "panel", role: "tabpanel" })));
    renderTab();
  }

  function renderTab() {
    const panel = document.getElementById("panel");
    if (!panel) return;
    const views = { profile: profileView, education: educationView, achievements: achievementsView, skills: skillsView, settings: settingsView };
    panel.replaceChildren(...views[state.tab]());
  }

  // ---------- Profile ----------
  function profileView() {
    const p = state.content.profile;
    const progress = h("div", { class: "progress" });
    const photo = p.photo ? h("img", { src: fileUrl(p.photo), alt: "Current profile photo" }) : h("div", { class: "ph", "aria-hidden": "true" }, p.initials || "?");
    const facts = h("div", { class: "box" }, h("h3", {}, "Quick facts"),
      h("small", { class: "field" }, "Short highlight tiles under the About text. Keep the number or word short (1st, 3, Python)."),
      p.facts.map((f, i) => h("div", { class: "factrow" },
        h("input", { type: "text", "aria-label": `Fact ${i + 1} value`, value: f.value, oninput: (e) => { f.value = e.target.value; markDirty(); } }),
        h("input", { type: "text", "aria-label": `Fact ${i + 1} label`, value: f.label, oninput: (e) => { f.label = e.target.value; markDirty(); } }),
        deleteButton("Remove", () => { p.facts.splice(i, 1); markDirty(); renderTab(); }))),
      p.facts.length < 6 && h("div", {}, h("button", { type: "button", class: "btn small", onclick: () => { p.facts.push({ value: "", label: "" }); markDirty(); renderTab(); } }, "+ Add fact")));

    return [
      h("h2", {}, "Profile & photo"),
      h("p", { class: "intro" }, "Your name, contact details and introduction appear at the top of every page."),
      h("div", { class: "box" }, h("h3", {}, "Profile photo"),
        h("div", { class: "photo" }, photo,
          h("div", { class: "row" },
            p.photo && deleteButton("Remove photo", () => { state.pendingDeletes.add(p.photo); p.photo = null; markDirty(); renderTab(); }))),
        dropZone({ multiple: false, accept: "image/jpeg,image/png,image/webp", label: "Drop a new photo here", onFiles: async ([file]) => {
          if (!/^image\//.test(file.type)) { toast("The profile photo must be an image.", true); return; }
          progress.textContent = `Uploading ${file.name}…`;
          try {
            const saved = await uploadOne(file);
            if (p.photo) state.pendingDeletes.add(p.photo);
            p.photo = saved.key; markDirty(); renderTab();
            toast("Photo uploaded. Select Save changes to publish it.");
          } catch (e) { progress.textContent = ""; toast(e.message, true); }
        } }), progress),
      h("div", { class: "box" }, h("h3", {}, "Name and introduction"),
        h("div", { class: "grid2" }, field("Full name", p, "name"), field("Initials", p, "initials", { hint: "Shown when there's no photo." })),
        field("Tagline", p, "tagline", { hint: "One sentence under your name." }),
        field("About", p, "about", { type: "textarea", rows: 7 })),
      h("div", { class: "box" }, h("h3", {}, "Contact and links"),
        h("div", { class: "grid2" },
          field("Location", p, "location"), field("Email", p, "email", { type: "email" }),
          field("Phone", p, "phone"), h("div", { class: "field" }, h("span", {}, "Phone visibility"), check("Show phone number on the public site", p, "showPhone")),
          field("Website", p, "website", { type: "url", placeholder: "https://…" }), field("GitHub", p, "github", { type: "url", placeholder: "https://github.com/…" }),
          field("LinkedIn", p, "linkedin", { type: "url", placeholder: "https://linkedin.com/in/…" }))),
      facts
    ];
  }

  // ---------- Education ----------
  function educationView() {
    const list = state.content.education;
    state.eduIndex = Math.min(state.eduIndex, Math.max(0, list.length - 1));
    const e = list[state.eduIndex];
    const items = h("div", { class: "list" }, list.map((x, i) => h("button", { type: "button", class: "item", "aria-current": String(i === state.eduIndex), onclick: () => { state.eduIndex = i; renderTab(); } },
      x.title || "Untitled", h("small", {}, `${x.kind === "note" ? "Note · " : ""}${x.when}`))));
    const form = e ? h("div", { class: "box" },
      h("div", { class: "row end" },
        h("button", { type: "button", class: "btn small", onclick: () => { state.eduIndex = move(list, state.eduIndex, -1); renderTab(); } }, "↑ Move up"),
        h("button", { type: "button", class: "btn small", onclick: () => { state.eduIndex = move(list, state.eduIndex, 1); renderTab(); } }, "↓ Move down"),
        deleteButton("Delete", () => { list.splice(state.eduIndex, 1); markDirty(); renderTab(); })),
      field("Type", e, "kind", { type: "select", options: [["school", "School"], ["note", "Highlighted note (e.g. a gap or interruption)"]], onChange: renderTab }),
      h("div", { class: "grid2" }, field(e.kind === "note" ? "Heading" : "School", e, "title"), field("Dates", e, "when", { placeholder: "2023 – 2024" })),
      e.kind === "school" && h("div", { class: "grid2" }, field("Place", e, "place"), field("Badge", e, "badge", { hint: "Optional, e.g. 1st place" })),
      field("Description", e, "text", { type: "textarea", rows: 3 }),
      e.kind === "school" && check("Currently attending", e, "current"))
      : h("p", { class: "empty" }, "No entries yet.");
    return [
      h("h2", {}, "Education"),
      h("p", { class: "intro" }, "Shown newest first as a timeline. Use the move buttons to change the order."),
      h("div", { class: "row" }, h("button", { type: "button", class: "btn", onclick: () => {
        list.unshift({ id: `edu-${Date.now()}`, kind: "school", when: "", title: "New school", place: "", text: "", badge: "", current: false });
        state.eduIndex = 0; markDirty(); renderTab();
      } }, "+ Add school or note")),
      h("div", { class: "split" }, items, form)
    ];
  }

  // ---------- Achievements ----------
  function achievementsView() {
    const list = state.content.achievements;
    state.achIndex = Math.min(state.achIndex, Math.max(0, list.length - 1));
    const a = list[state.achIndex];

    const itemsBox = h("div", { class: "list" });
    for (const sec of Object.keys(SECTION_LABELS)) {
      const inSec = list.map((x, i) => [x, i]).filter(([x]) => x.section === sec);
      if (!inSec.length) continue;
      itemsBox.append(h("div", { class: "group" }, SECTION_LABELS[sec]));
      for (const [x, i] of inSec) {
        itemsBox.append(h("button", { type: "button", class: "item", "aria-current": String(i === state.achIndex), onclick: () => { state.achIndex = i; renderTab(); } },
          h("span", { "data-title": i }, x.title || "Untitled"), h("small", {}, `${x.dates || x.year || ""}${x.files.length ? ` · ${x.files.length} file${x.files.length > 1 ? "s" : ""}` : ""}`)));
      }
    }

    let form = h("p", { class: "empty" }, "No achievements yet. Add one to get started.");
    if (a) {
      const progress = h("div", { class: "progress" });
      const files = h("div", { class: "files" }, a.files.map((f, i) => h("div", { class: "fcard" },
        /^image\//.test(f.type) ? h("img", { src: fileUrl(f.key), alt: f.caption || f.name, loading: "lazy" }) : h("a", { href: fileUrl(f.key), target: "_blank", rel: "noopener" }, h("div", { class: "pdf" }, "PDF")),
        h("div", { class: "body" },
          h("div", { class: "name" }, f.name),
          h("input", { type: "text", "aria-label": `Caption for ${f.name}`, placeholder: "Caption (e.g. Certificate of completion)", value: f.caption, oninput: (e) => { f.caption = e.target.value; markDirty(); } }),
          h("div", { class: "row" },
            h("button", { type: "button", class: "btn small", "aria-label": "Move file earlier", onclick: () => { move(a.files, i, -1); renderTab(); } }, "←"),
            h("button", { type: "button", class: "btn small", "aria-label": "Move file later", onclick: () => { move(a.files, i, 1); renderTab(); } }, "→"),
            deleteButton("Remove", () => { state.pendingDeletes.add(f.key); a.files.splice(i, 1); markDirty(); renderTab(); }))))));

      const onFiles = async (picked) => {
        let done = 0;
        for (const file of picked) {
          progress.textContent = `Uploading ${done + 1} of ${picked.length}: ${file.name}…`;
          try { a.files.push(await uploadOne(file)); done++; markDirty(); }
          catch (e) { toast(e.message, true); }
        }
        progress.textContent = "";
        if (done) toast(`${done} file${done > 1 ? "s" : ""} uploaded. Select Save changes to publish.`);
        renderTab();
      };

      form = h("div", { class: "panel" },
        h("div", { class: "box" },
          h("div", { class: "row end" },
            h("a", { class: "btn small", href: `/achievements/${encodeURIComponent(a.id)}`, target: "_blank", rel: "noopener" }, "View page ↗"),
            h("button", { type: "button", class: "btn small", onclick: () => { state.achIndex = move(list, state.achIndex, -1); renderTab(); } }, "↑ Move up"),
            h("button", { type: "button", class: "btn small", onclick: () => { state.achIndex = move(list, state.achIndex, 1); renderTab(); } }, "↓ Move down"),
            deleteButton("Delete achievement", () => { a.files.forEach((f) => state.pendingDeletes.add(f.key)); list.splice(state.achIndex, 1); markDirty(); renderTab(); })),
          field("Title", a, "title", { onChange: (v) => { const s = itemsBox.querySelector(`[data-title="${state.achIndex}"]`); if (s) s.textContent = v || "Untitled"; } }),
          h("div", { class: "grid2" },
            field("Organization", a, "org"),
            field("Shown under", a, "section", { type: "select", options: Object.entries(SECTION_LABELS), onChange: renderTab }),
            field("Category label", a, "category", { placeholder: "Fellowship, Certificate, Summer program…" }),
            field("Dates", a, "dates", { placeholder: "Jul – Aug 2026" }),
            field("Year (short)", a, "year", { hint: "Shown beside honors, e.g. 2026" }),
            field("Track or focus", a, "track", { hint: "Optional" })),
          field("Summary", a, "summary", { type: "textarea", rows: 3, hint: "One or two sentences shown on the card and at the top of the page." }),
          field("What I did", a, "bullets", { type: "textarea", rows: 5, list: true, hint: "One point per line." }),
          tagField("Skills and topics", a, "tags", "Separate with commas.")),
        h("div", { class: "box" },
          h("h3", {}, `Credentials (${a.files.length})`),
          h("small", { class: "field" }, "Certificates, award letters, transcripts or photos. They appear on this achievement's own page."),
          dropZone({ multiple: true, accept: "image/jpeg,image/png,image/webp,image/gif,application/pdf", label: "Drop certificate photos or PDFs here", onFiles }),
          progress,
          a.files.length > 0 && files),
        h("div", { class: "box" },
          field("Page address", a, "id", { hint: "Used in the link /achievements/… (lowercase letters, numbers and dashes). Changing it breaks links you've already shared.", onChange: (v) => { a.id = slugify(v); } })));
    }

    return [
      h("h2", {}, "Achievements"),
      h("p", { class: "intro" }, "Every achievement gets its own page with its credentials. Upload certificate photos or PDFs to each one."),
      h("div", { class: "row" }, h("button", { type: "button", class: "btn", onclick: () => {
        const title = "New achievement";
        list.unshift({ id: `${slugify(title)}-${Date.now().toString(36)}`, section: "honors", category: "Certificate", title, org: "", dates: "", year: String(new Date().getFullYear()), track: "", summary: "", bullets: [], tags: [], files: [] });
        state.achIndex = 0; markDirty(); renderTab();
      } }, "+ Add achievement")),
      h("div", { class: "split" }, itemsBox, form)
    ];
  }

  // ---------- Skills ----------
  function skillsView() {
    const groups = state.content.skills;
    return [
      h("h2", {}, "Skills"),
      h("p", { class: "intro" }, "Groups of skills shown as tags on the home page."),
      ...groups.map((g, i) => h("div", { class: "box" },
        h("div", { class: "row end" },
          h("button", { type: "button", class: "btn small", onclick: () => { move(groups, i, -1); renderTab(); } }, "↑"),
          h("button", { type: "button", class: "btn small", onclick: () => { move(groups, i, 1); renderTab(); } }, "↓"),
          deleteButton("Delete group", () => { groups.splice(i, 1); markDirty(); renderTab(); })),
        field("Group name", g, "group"),
        tagField("Skills", g, "items", "Separate with commas."))),
      h("div", {}, h("button", { type: "button", class: "btn", onclick: () => { groups.push({ id: `skills-${Date.now()}`, group: "New group", items: [] }); markDirty(); renderTab(); } }, "+ Add skill group"))
    ];
  }

  // ---------- Settings ----------
  function settingsView() {
    const importId = nextId();
    return [
      h("h2", {}, "Backup & security"),
      h("div", { class: "box" }, h("h3", {}, "Back up your content"),
        h("p", {}, "Download everything you've written as one file. Uploaded files stay on the site and are referenced by name."),
        h("div", { class: "row" },
          h("button", { type: "button", class: "btn", onclick: () => {
            const blob = new Blob([JSON.stringify(state.content, null, 2)], { type: "application/json" });
            const a = h("a", { href: URL.createObjectURL(blob), download: `resume-content-${new Date().toISOString().slice(0, 10)}.json` });
            document.body.append(a); a.click(); a.remove();
          } }, "Download backup"),
          h("label", { class: "btn", for: importId }, "Restore from backup…"),
          h("input", { id: importId, type: "file", accept: "application/json,.json", class: "visually-hidden", onchange: async (e) => {
            const f = e.target.files[0]; e.target.value = "";
            if (!f) return;
            try {
              const data = JSON.parse(await f.text());
              if (!data.profile || !Array.isArray(data.achievements)) throw new Error("That file isn't a résumé backup.");
              state.content = data; markDirty(); toast("Backup loaded. Select Save changes to publish it."); renderTab();
            } catch (ex) { toast(ex.message, true); }
          } }))),
      h("div", { class: "box" }, h("h3", {}, "Password"),
        h("p", { class: "note" }, "The admin password is stored on Netlify, not in this page's code, and is checked on the server. To change it: in Netlify open ", h("b", {}, "Project configuration → Environment variables"), ", edit ", h("code", {}, "ADMIN_PASSWORD"), ", then redeploy. Changing it signs out every device."),
        h("p", {}, "Login sessions last 8 hours. After 8 failed attempts in a minute, logins from that address are paused briefly."))
    ];
  }

  // ---------- start ----------
  (async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      const s = await res.json();
      if (s.setupProblem) return showSetupProblem(s.setupProblem);
      if (s.admin) await loadEditor(); else showLogin();
    } catch {
      root.replaceChildren(h("div", { class: "login" }, h("h1", {}, "Can't reach the server"), h("p", {}, "The admin page only works on the live Netlify site. Refresh to try again.")));
    }
  })();
})();
