(function () {
  const currentScript =
    document.currentScript ||
    [...document.querySelectorAll("script")].find((script) =>
      script.src.includes("/embed.js")
    );

  if (!currentScript) {
    return;
  }

  const scriptUrl = new URL(currentScript.src, window.location.href);
  const viewerUrl = normalizeViewerUrl(
    currentScript.dataset.viewer || scriptUrl.searchParams.get("viewer") || scriptUrl.origin + scriptUrl.pathname.replace(/\/embed\.js$/, "/")
  );
  const pdfUrl =
    currentScript.dataset.pdf ||
    scriptUrl.searchParams.get("pdf") ||
    findContainerValue(currentScript, "pdf");
  const height =
    currentScript.dataset.height ||
    scriptUrl.searchParams.get("height") ||
    findContainerValue(currentScript, "height") ||
    "800";
  const targetId = currentScript.dataset.target || scriptUrl.searchParams.get("target");
  const target =
    (targetId && document.getElementById(targetId)) ||
    findContainerElement(currentScript);

  if (!target) {
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.src = buildEmbedUrl(viewerUrl, pdfUrl);
  iframe.title = currentScript.dataset.title || "Flipbook";
  iframe.width = "100%";
  iframe.height = String(height);
  iframe.loading = "lazy";
  iframe.allowFullscreen = true;
  iframe.style.border = "0";
  iframe.style.width = "100%";

  target.replaceChildren(iframe);

  function buildEmbedUrl(baseViewerUrl, nextPdfUrl) {
    const url = new URL(baseViewerUrl, window.location.href);
    url.searchParams.set("embed", "1");

    if (nextPdfUrl) {
      url.searchParams.set("pdf", nextPdfUrl);
    }

    return url.toString();
  }

  function normalizeViewerUrl(value) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return window.location.href;
    }

    return normalized;
  }

  function findContainerElement(script) {
    const previousElement = script.previousElementSibling;
    if (previousElement?.matches?.("[data-flippy-embed], .flippy-embed")) {
      return previousElement;
    }

    return document.querySelector("[data-flippy-embed]");
  }

  function findContainerValue(script, key) {
    const container = findContainerElement(script);
    if (!container) {
      return "";
    }

    return container.dataset[key] || "";
  }
})();
