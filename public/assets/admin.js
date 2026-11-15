// Admin editor. The password check and every save happen on the server; this page only edits a copy of the content.
(() => {
  const root = document.getElementById("admin");
  const SECTION_LABELS = { programs: "Programs & fellowships", leadership: "Leadership & activities", honors: "Honors (shown under Certificates)" };
  const TABS = [["profile", "Profile & photo"], ["education", "Education"], ["achievements", "Achievements"], ["projects", "Projects"], ["documents", "Transcripts & certificates"], ["skills", "Skills"], ["settings", "Backup & security"]];

  const state = { content: null, dirty: false, saving: false, tab: "achievements", achIndex: 0, eduIndex: 0, docIndex: 0, projIndex: 0, pendingDeletes: new Set() };

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
    for (const k of ["education", "achievements", "projects", "documents", "skills"]) state.content[k] ||= [];
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
      const stillUsed = new Set([state.content.profile.photo, state.content.profile.resume, ...[...state.content.achievements, ...(state.content.projects || []), ...(state.content.documents || [])].flatMap((x) => x.files.map((f) => f.key))]);
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
    const views = { profile: profileView, education: educationView, achievements: achievementsView, projects: projectsView, documents: documentsView, skills: skillsView, settings: settingsView };
    panel.replaceChildren(...views[state.tab]());
    window.PdfThumb?.attachAll(panel);
  }

  // Upload, caption, reorder and remove files in one list (used by achievements and documents)
  function filesEditor(list, dropLabel) {
    const progress = h("div", { class: "progress" });
    const cards = h("div", { class: "files" }, list.map((f, i) => h("div", { class: "fcard" },
      /^image\//.test(f.type) ? h("img", { src: fileUrl(f.key), alt: f.caption || f.name, loading: "lazy" }) : h("a", { href: fileUrl(f.key), target: "_blank", rel: "noopener", "aria-label": `Open ${f.name}` }, h("div", { class: "pdf", "data-pdf": fileUrl(f.key) }, "PDF")),
      h("div", { class: "body" },
        h("div", { class: "name" }, f.name),
        h("input", { type: "text", "aria-label": `Caption for ${f.name}`, placeholder: "Caption (e.g. Certificate of completion)", value: f.caption, oninput: (e) => { f.caption = e.target.value; markDirty(); } }),
        h("div", { class: "row" },
          h("button", { type: "button", class: "btn small", "aria-label": "Move file earlier", onclick: () => { move(list, i, -1); renderTab(); } }, "←"),
          h("button", { type: "button", class: "btn small", "aria-label": "Move file later", onclick: () => { move(list, i, 1); renderTab(); } }, "→"),
          deleteButton("Remove", () => { state.pendingDeletes.add(f.key); list.splice(i, 1); markDirty(); renderTab(); }))))));
    const onFiles = async (picked) => {
      let done = 0;
      for (const file of picked) {
        progress.textContent = `Uploading ${done + 1} of ${picked.length}: ${file.name}…`;
        try { list.push(await uploadOne(file)); done++; markDirty(); }
        catch (e) { toast(e.message, true); }
      }
      progress.textContent = "";
      if (done) toast(`${done} file${done > 1 ? "s" : ""} uploaded. Select Save changes to publish.`);
      renderTab();
    };
    return h("div", { class: "panel" },
      dropZone({ multiple: true, accept: "image/jpeg,image/png,image/webp,image/gif,application/pdf", label: dropLabel, onFiles }),
      progress,
      list.length > 0 && cards);
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
      resumeBox(p),
      h("div", { class: "box" }, h("h3", {}, "Name and introduction"),
        h("div", { class: "grid2" }, field("Full name", p, "name"), field("Initials", p, "initials", { hint: "Shown when there's no photo." })),
        field("Tagline", p, "tagline", { hint: "One sentence under your name." }),
        h("div", { class: "grid2" },
          field("Intended major", p, "intendedMajor", { placeholder: "Computer Science major · Mathematics minor", hint: "Shown as a badge beside the photo." }),
          field("Class year", p, "gradYear", { placeholder: "Class of 2027" })),
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
      const linkedDocs = (state.content.documents || []).filter((d) => d.achievementId === a.id);
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
          h("small", { class: "field" }, "Photos or PDFs shown on this achievement's own page. To also list them under Transcripts & certificates, move them there; they will still show on this page."),
          filesEditor(a.files, "Drop certificate photos or PDFs here"),
          a.files.length > 0 && h("div", { class: "row" }, h("button", { type: "button", class: "btn small", onclick: () => {
            const docs = state.content.documents;
            docs.push({ id: `${slugify(a.title)}-certificate`, kind: "certificate", title: `${a.title} certificate`, issuer: a.org, date: a.dates, year: a.year, note: "", public: true, achievementId: a.id, files: a.files.splice(0) });
            state.docIndex = docs.length - 1; markDirty(); toast("Moved to Certificates. Select Save changes to publish."); renderTab();
          } }, "Move these files to Certificates")),
          linkedDocs.length > 0 && h("p", { class: "note" }, "Also showing files from: ", linkedDocs.flatMap((d, j) => [j ? ", " : "", h("b", {}, d.title)]), ". Edit them in the Transcripts & certificates tab.")),
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

  // Résumé PDF: one file, shown as a "Résumé PDF" button on the profile
  function resumeBox(p) {
    const progress = h("div", { class: "progress" });
    return h("div", { class: "box" }, h("h3", {}, "Résumé PDF"),
      h("small", { class: "field" }, "Optional. Adds a Résumé PDF button under the name, so colleges can download a one-page résumé."),
      p.resume
        ? h("div", { class: "row" }, h("a", { class: "btn", href: fileUrl(p.resume), target: "_blank", rel: "noopener" }, "Open current résumé ↗"),
            deleteButton("Remove résumé", () => { state.pendingDeletes.add(p.resume); p.resume = null; markDirty(); renderTab(); }))
        : null,
      dropZone({ multiple: false, accept: "application/pdf", label: p.resume ? "Drop a new résumé PDF to replace it" : "Drop the résumé PDF here", onFiles: async ([file]) => {
        if (file.type !== "application/pdf") { toast("The résumé must be a PDF.", true); return; }
        progress.textContent = `Uploading ${file.name}…`;
        try {
          const saved = await uploadOne(file);
          if (p.resume) state.pendingDeletes.add(p.resume);
          p.resume = saved.key; markDirty(); renderTab();
          toast("Résumé uploaded. Select Save changes to publish it.");
        } catch (e) { progress.textContent = ""; toast(e.message, true); }
      } }), progress);
  }

  // ---------- Projects ----------
  function parseRepo(u) {
    const m = (u || "").trim().match(/^https?:\/\/(www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(\.git)?\/?$/i);
    return m ? { owner: m[2], repo: m[3] } : null;
  }

  async function fillFromGitHub(x) {
    const r = parseRepo(x.github);
    if (!r) { toast("Paste a repository link like https://github.com/name/project first.", true); return; }
    try {
      const res = await fetch(`https://api.github.com/repos/${r.owner}/${r.repo}`, { headers: { accept: "application/vnd.github+json" } });
      if (res.status === 404) throw new Error("GitHub can't find that repository. Check the link and that the repo is public.");
      if (!res.ok) throw new Error(`GitHub didn't answer (error ${res.status}). Try again in a few minutes.`);
      const info = await res.json();
      const filled = [];
      if (!x.title || /^New project/.test(x.title)) { x.title = info.name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); filled.push("title"); }
      if (!x.summary && info.description) { x.summary = info.description; filled.push("summary"); }
      if (!x.link && info.homepage) { x.link = info.homepage; filled.push("live link"); }
      if (!x.date && info.created_at) { x.date = String(new Date(info.created_at).getFullYear()); filled.push("year"); }
      const tags = [...new Set([info.language, ...(info.topics || [])].filter(Boolean))];
      if (!x.tags.length && tags.length) { x.tags = tags.slice(0, 8); filled.push("tags"); }
      if (!filled.length) { toast("Everything was already filled in, so nothing changed."); return; }
      markDirty(); renderTab();
      toast(`Filled ${filled.join(", ")} from GitHub. Review it, then save.`);
    } catch (e) { toast(e.message, true); }
  }

  function projectsView() {
    const list = state.content.projects;
    state.projIndex = Math.min(state.projIndex, Math.max(0, list.length - 1));
    const x = list[state.projIndex];

    const itemsBox = h("div", { class: "list" }, list.map((y, i) => h("button", { type: "button", class: "item", "aria-current": String(i === state.projIndex), onclick: () => { state.projIndex = i; renderTab(); } },
      h("span", { "data-proj-title": i }, y.title || "Untitled"),
      h("small", {}, [y.category, y.date, y.github ? "GitHub" : "", y.files.length ? `${y.files.length} file${y.files.length > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ")))));

    let form = h("p", { class: "empty" }, "No projects yet. Add one, or paste a GitHub link and fill it in automatically.");
    if (x) {
      form = h("div", { class: "panel" },
        h("div", { class: "box" },
          h("div", { class: "row end" },
            h("a", { class: "btn small", href: `/projects/${encodeURIComponent(x.id)}`, target: "_blank", rel: "noopener" }, "View page ↗"),
            h("button", { type: "button", class: "btn small", onclick: () => { state.projIndex = move(list, state.projIndex, -1); renderTab(); } }, "↑ Move up"),
            h("button", { type: "button", class: "btn small", onclick: () => { state.projIndex = move(list, state.projIndex, 1); renderTab(); } }, "↓ Move down"),
            deleteButton("Delete project", () => { x.files.forEach((f) => state.pendingDeletes.add(f.key)); list.splice(state.projIndex, 1); markDirty(); renderTab(); })),
          h("div", { class: "github-row" },
            field("GitHub repository", x, "github", { type: "url", placeholder: "https://github.com/elsabetgenetu/project-name", hint: "Optional. Public repos show live details (language, stars, last update) on the project page." }),
            h("button", { type: "button", class: "btn", onclick: () => fillFromGitHub(x) }, "Fill in from GitHub")),
          field("Title", x, "title", { onChange: (v) => { const el = itemsBox.querySelector(`[data-proj-title="${state.projIndex}"]`); if (el) el.textContent = v || "Untitled"; } }),
          h("div", { class: "grid2" },
            field("Type", x, "category", { placeholder: "School project, Research, Personal, Club…" }),
            field("Date", x, "date", { placeholder: "2025, or Mar – May 2026" }),
            field("Live link", x, "link", { type: "url", placeholder: "https://…", hint: "Optional: a website, video or demo." })),
          field("Summary", x, "summary", { type: "textarea", rows: 3, hint: "One or two sentences: what it is and why it matters." }),
          field("About this project", x, "details", { type: "textarea", rows: 5, list: true, hint: "One point per line: the problem, what you built, what you learned, results." }),
          tagField("Built with", x, "tags", "Languages, tools and topics, separated with commas.")),
        h("div", { class: "box" },
          h("h3", {}, `Files (${x.files.length})`),
          h("small", { class: "field" }, "Screenshots, photos, a poster or a report PDF. The first image becomes the card picture."),
          filesEditor(x.files, "Drop project screenshots, photos or PDFs here")),
        h("div", { class: "box" },
          field("Page address", x, "id", { hint: "Used in the link /projects/… Changing it breaks links you've already shared.", onChange: (v) => { x.id = slugify(v); } })));
    }

    return [
      h("h2", {}, "Projects"),
      h("p", { class: "intro" }, "School, club, research or personal projects. Each one gets a card on the home page and its own page with files and a GitHub link."),
      h("div", { class: "row" }, h("button", { type: "button", class: "btn", onclick: () => {
        list.unshift({ id: `project-${Date.now().toString(36)}`, title: "New project", category: "", date: "", summary: "", details: [], tags: [], github: "", link: "", files: [] });
        state.projIndex = 0; markDirty(); renderTab();
      } }, "+ Add project")),
      h("div", { class: "split" }, itemsBox, form)
    ];
  }

  // ---------- Transcripts & certificates ----------
  const DOC_KIND_LABELS = { transcript: "Transcripts", certificate: "Certificates" };

  function suggestedDocuments() {
    const achIds = new Set(state.content.achievements.map((a) => a.id));
    const link = (id) => (achIds.has(id) ? id : "");
    return [
      { kind: "transcript", title: "Grade 12 transcript (in progress)", issuer: "Dangila General Secondary School", date: "2026 – 2027", year: "Gr 12" },
      { kind: "transcript", title: "Grade 11 transcript", issuer: "Dangila General Secondary School", date: "2025 – 2026", year: "Gr 11" },
      { kind: "transcript", title: "Grade 10 transcript", issuer: "Lemlem Academy", date: "2024 – 2025", year: "Gr 10" },
      { kind: "transcript", title: "Grade 9 transcript", issuer: "Hidasie Dangila School", date: "2023 – 2024", year: "Gr 9" },
      { kind: "transcript", title: "Grade 8 regional exam result", issuer: "Amen Elementary and Middle School", date: "2022", year: "2022" },
      { kind: "certificate", title: "Yale Young Global Scholars certificate", issuer: "Yale University", date: "2026", year: "2026", achievementId: link("yale-young-global-scholars-2026") },
      { kind: "certificate", title: "Yale Entrepreneurial Society Fellowship certificate", issuer: "Yale University", date: "2026", year: "2026", achievementId: link("yale-entrepreneurial-society-2026") },
      { kind: "certificate", title: "Yale Young African Scholars certificate", issuer: "Yale University", date: "2025", year: "2025", achievementId: link("yale-young-african-scholars-2025") },
      { kind: "certificate", title: "AddisCoder certificate", issuer: "Addis Ababa Institute of Technology", date: "2023", year: "2023", achievementId: link("addiscoder-2023") },
      { kind: "certificate", title: "Fundamental Programming certificate", issuer: "Udemy", date: "2025", year: "2025", achievementId: link("udemy-fundamental-programming") },
      { kind: "certificate", title: "Grade 11 completion certificate", issuer: "Dangila General Secondary School", date: "With High Distinction", year: "Gr 11", achievementId: link("grade-11-certificate") },
      { kind: "certificate", title: "Grade 9 and 10 completion certificates", issuer: "Hidasie Dangila School and Lemlem Academy", date: "With High Distinction", year: "Gr 9–10", achievementId: link("grade-9-10-certificates") },
      { kind: "certificate", title: "Grade 8 regional excellence certificate", issuer: "Amen Elementary and Middle School", date: "1st Place Zonal Ranking", year: "2022", achievementId: link("grade-8-regional-excellence") }
    ].map((d) => ({ id: slugify(d.title), note: "", public: true, achievementId: "", files: [], ...d }));
  }

  function documentsView() {
    const list = state.content.documents;
    state.docIndex = Math.min(state.docIndex, Math.max(0, list.length - 1));
    const d = list[state.docIndex];

    const add = (kind) => {
      const title = kind === "transcript" ? "New transcript" : "New certificate";
      list.push({ id: `${slugify(title)}-${Date.now().toString(36)}`, kind, title, issuer: "", date: "", year: "", note: "", public: true, achievementId: "", files: [] });
      state.docIndex = list.length - 1; markDirty(); renderTab();
    };

    const itemsBox = h("div", { class: "list" });
    for (const kind of Object.keys(DOC_KIND_LABELS)) {
      const inKind = list.map((x, i) => [x, i]).filter(([x]) => x.kind === kind);
      itemsBox.append(h("div", { class: "group" }, `${DOC_KIND_LABELS[kind]} (${inKind.length})`));
      for (const [x, i] of inKind) {
        itemsBox.append(h("button", { type: "button", class: "item", "aria-current": String(i === state.docIndex), onclick: () => { state.docIndex = i; renderTab(); } },
          h("span", { "data-doc-title": i }, x.title || "Untitled"),
          h("small", {}, [x.public === false ? "Hidden" : "", x.files.length ? `${x.files.length} file${x.files.length > 1 ? "s" : ""}` : "No file yet"].filter(Boolean).join(" · "))));
      }
      if (!inKind.length) itemsBox.append(h("small", { class: "item" }, "None yet"));
    }

    let form = h("p", { class: "empty" }, "No documents yet. Add a transcript or certificate, or start with the suggested list.");
    if (d) {
      const sameKind = list.map((x, i) => [x, i]).filter(([x]) => x.kind === d.kind).map(([, i]) => i);
      const pos = sameKind.indexOf(state.docIndex);
      const moveWithin = (dir) => {
        const j = sameKind[pos + dir];
        if (j === undefined) return;
        [list[state.docIndex], list[j]] = [list[j], list[state.docIndex]];
        state.docIndex = j; markDirty(); renderTab();
      };
      form = h("div", { class: "panel" },
        h("div", { class: "box" },
          h("div", { class: "row end" },
            h("a", { class: "btn small", href: `/documents/${encodeURIComponent(d.id)}`, target: "_blank", rel: "noopener" }, "View page ↗"),
            h("button", { type: "button", class: "btn small", onclick: () => moveWithin(-1) }, "↑ Move up"),
            h("button", { type: "button", class: "btn small", onclick: () => moveWithin(1) }, "↓ Move down"),
            deleteButton("Delete document", () => { d.files.forEach((f) => state.pendingDeletes.add(f.key)); list.splice(state.docIndex, 1); markDirty(); renderTab(); })),
          h("div", { class: "grid2" },
            field("Subcategory", d, "kind", { type: "select", options: [["transcript", "Transcript"], ["certificate", "Certificate"]], onChange: renderTab }),
            field("Title", d, "title", { onChange: (v) => { const el = itemsBox.querySelector(`[data-doc-title="${state.docIndex}"]`); if (el) el.textContent = v || "Untitled"; } }),
            field("Issued by", d, "issuer", { placeholder: "School or organization" }),
            field("Date or note", d, "date", { placeholder: "2025 – 2026, or With High Distinction" }),
            field("Related achievement", d, "achievementId", { type: "select", options: [["", "None"], ...state.content.achievements.map((a) => [a.id, a.title])], hint: "Its files also appear on that achievement's page." })),
          field("Description", d, "note", { type: "textarea", rows: 2, hint: "Optional, e.g. what the transcript covers or the grading scale." }),
          check("Show on the public site", d, "public"),
          d.kind === "transcript" && h("p", { class: "note" }, "Transcripts show grades and personal details. Untick ", h("b", {}, "Show on the public site"), " to keep one visible only to you; its files are then blocked for everyone who isn't logged in as admin.")),
        h("div", { class: "box" },
          h("h3", {}, `Files (${d.files.length})`),
          h("small", { class: "field" }, "Scan or photograph every page. Multi-page transcripts work best as a single PDF."),
          filesEditor(d.files, d.kind === "transcript" ? "Drop transcript pages or a PDF here" : "Drop the certificate photo or PDF here")),
        h("div", { class: "box" },
          field("Page address", d, "id", { hint: "Used in the link /documents/… Changing it breaks links you've already shared.", onChange: (v) => { d.id = slugify(v); } })));
    }

    return [
      h("h2", {}, "Transcripts & certificates"),
      h("p", { class: "intro" }, "Shown on the home page as two groups, each document with its own page. Documents without a file stay off the public site until one is uploaded."),
      h("div", { class: "row" },
        h("button", { type: "button", class: "btn", onclick: () => add("transcript") }, "+ Add transcript"),
        h("button", { type: "button", class: "btn", onclick: () => add("certificate") }, "+ Add certificate"),
        h("button", { type: "button", class: "btn", onclick: () => {
          // Skip suggestions already covered: same title, or a certificate already linked to that achievement
          const have = new Set(list.map((x) => x.title.toLowerCase()));
          const linkedCerts = new Set(list.filter((x) => x.kind === "certificate" && x.achievementId).map((x) => x.achievementId));
          const fresh = suggestedDocuments().filter((x) => !have.has(x.title.toLowerCase()) && !(x.achievementId && linkedCerts.has(x.achievementId)));
          if (!fresh.length) { toast("All suggested documents are already in the list."); return; }
          list.push(...fresh); markDirty(); toast(`Added ${fresh.length} suggested documents. Upload a file to each, then save.`); renderTab();
        } }, "Add suggested list")),
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
