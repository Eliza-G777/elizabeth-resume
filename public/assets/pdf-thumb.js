// Draws the first page of a PDF as a thumbnail image. PDF.js loads only when a PDF thumbnail scrolls into view.
window.PdfThumb = (() => {
  const BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/";
  let lib = null;
  const cache = new Map();

  function load() {
    lib ||= import(BASE + "pdf.min.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = BASE + "pdf.worker.min.mjs";
      return m;
    });
    return lib;
  }

  function render(url, width) {
    const key = `${url}@${width}`;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        const pdfjs = await load();
        const task = pdfjs.getDocument({ url, disableRange: true, disableStream: true });
        try {
          const doc = await task.promise;
          const page = await doc.getPage(1);
          const base = page.getViewport({ scale: 1 });
          const scale = (width * Math.min(window.devicePixelRatio || 1, 2)) / base.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          return canvas.toDataURL("image/jpeg", 0.85);
        } finally {
          task.destroy();
        }
      })());
    }
    return cache.get(key);
  }

  // el: a placeholder element with data-pdf="<url>". Keeps the "PDF" placeholder if anything fails.
  function attach(el) {
    if (el.dataset.thumbState) return;
    el.dataset.thumbState = "waiting";
    const go = () => {
      el.dataset.thumbState = "loading";
      const width = Math.max(160, Math.min(el.clientWidth || 320, 600));
      render(el.dataset.pdf, width)
        .then((src) => {
          const img = document.createElement("img");
          img.src = src;
          img.alt = el.dataset.alt || "First page of the PDF";
          img.className = "pdf-page";
          el.replaceChildren(img);
          el.classList.add("has-thumb");
          el.dataset.thumbState = "done";
        })
        .catch(() => { el.dataset.thumbState = "failed"; });
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); go(); }
      }, { rootMargin: "300px" });
      io.observe(el);
    } else {
      go();
    }
  }

  function attachAll(root = document) {
    root.querySelectorAll("[data-pdf]").forEach(attach);
  }

  // Draws every page of a PDF (up to maxPages) into the container at its width. Resolves with the page count.
  async function renderPages(container, url, maxPages = 30) {
    const pdfjs = await load();
    const task = pdfjs.getDocument({ url, disableRange: true, disableStream: true });
    try {
      const doc = await task.promise;
      const total = doc.numPages;
      const count = Math.min(total, maxPages);
      const width = Math.max(320, Math.min(container.clientWidth || 800, 1100));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      container.replaceChildren();
      for (let i = 1; i <= count; i++) {
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (width * ratio) / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.className = "pdf-sheet";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `Page ${i} of ${total}`);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        container.append(canvas);
      }
      if (total > count) {
        const more = document.createElement("p");
        more.className = "loading-pages";
        more.textContent = `Showing the first ${count} of ${total} pages. Open the original to see the rest.`;
        container.append(more);
      }
      return total;
    } finally {
      task.destroy();
    }
  }

  return { attach, attachAll, renderPages };
})();
