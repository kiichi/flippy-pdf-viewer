import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

const OPTIONS = {
  pdfPath: "./sample.pdf",
  renderScale: 1.35,
  keyboardNavigation: true,
  blankLabel: "",
  flipDuration: 560,
  perspective: 900,
  controlsRevealZone: 140,
  controlsRevealDelay: 1200,
};

const app = document.getElementById("app");
const fileInput = document.getElementById("fileInput");
const dropOverlay = document.getElementById("dropOverlay");
const book = document.getElementById("book");
const sidePanel = document.getElementById("sidePanel");
const sidePanelCloseButton = document.getElementById("sidePanelCloseButton");
const sidePanelLabel = document.getElementById("sidePanelLabel");
const fileNameText = document.getElementById("fileNameText");
const uploadButton = document.getElementById("uploadButton");
const downloadLink = document.getElementById("downloadLink");
const downloadAppLink = document.getElementById("downloadAppLink");
const leftPage = document.getElementById("leftPage");
const rightPage = document.getElementById("rightPage");
const flipSheet = document.getElementById("flipSheet");
const flipFront = document.getElementById("flipFront");
const flipBack = document.getElementById("flipBack");
const controlsToggleButton = document.getElementById("controlsToggleButton");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const spreadSlider = document.getElementById("spreadSlider");
const statusText = document.getElementById("statusText");
const loadingPanel = document.getElementById("loadingPanel");
const loadingText = document.getElementById("loadingText");
const selectFileButton = document.getElementById("selectFileButton");

const state = {
  pageCanvases: [],
  spreadIndex: 0,
  spreadCount: 1,
  busy: false,
  controlsHideTimer: 0,
  dragDepth: 0,
  sourceName: "sample.pdf",
  currentPdfBlob: null,
};

book.style.setProperty("--flip-duration", `${OPTIONS.flipDuration}ms`);
book.style.setProperty("--perspective", `${OPTIONS.perspective}px`);

bootstrap().catch((error) => {
  console.error(error);
  showFileFallback();
});

async function bootstrap() {
  bindEvents();
  disableControls(true);
  await loadPdfFromUrl(OPTIONS.pdfPath, state.sourceName);
}

function bindEvents() {
  controlsToggleButton.addEventListener("click", openSidePanel);
  sidePanelCloseButton.addEventListener("click", closeSidePanel);
  uploadButton.addEventListener("click", () => fileInput.click());
  downloadAppLink.addEventListener("click", handleDownloadAppZip);
  prevButton.addEventListener("click", () => goTo(state.spreadIndex - 1));
  nextButton.addEventListener("click", () => goTo(state.spreadIndex + 1));
  leftPage.addEventListener("click", () => goTo(state.spreadIndex - 1));
  rightPage.addEventListener("click", () => goTo(state.spreadIndex + 1));

  spreadSlider.addEventListener("input", () => {
    if (state.busy) return;
    state.spreadIndex = Number(spreadSlider.value);
    renderSpread(state.spreadIndex);
  });

  if (OPTIONS.keyboardNavigation) {
    window.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") goTo(state.spreadIndex - 1);
      if (event.key === "ArrowRight") goTo(state.spreadIndex + 1);
    });
  }

  document.addEventListener("fullscreenchange", syncFullscreenLabel);
  document.addEventListener("mousemove", handleFullscreenPointer);

  app.addEventListener("dragenter", handleDragEnter);
  app.addEventListener("dragover", handleDragOver);
  app.addEventListener("dragleave", handleDragLeave);
  app.addEventListener("drop", handleDrop);
  selectFileButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileSelect);
  document.addEventListener("click", handleDocumentClick);
}

function goTo(targetSpread) {
  if (
    state.busy ||
    targetSpread < 0 ||
    targetSpread >= state.spreadCount ||
    targetSpread === state.spreadIndex
  ) {
    return;
  }

  const direction = targetSpread > state.spreadIndex ? "next" : "prev";
  animateTurn(targetSpread, direction);
}

function animateTurn(targetSpread, direction) {
  state.busy = true;

  const current = getSpreadPages(state.spreadIndex);
  const target = getSpreadPages(targetSpread);

  if (direction === "next") {
    renderPage(leftPage, current.left);
    renderPage(rightPage, target.right);
  } else {
    renderPage(leftPage, target.left);
    renderPage(rightPage, current.right);
  }

  flipSheet.className = `flip-sheet ${direction}`;

  if (direction === "next") {
    renderPage(flipFront, current.right);
    renderPage(flipBack, target.left);
  } else {
    renderPage(flipFront, current.left);
    renderPage(flipBack, target.right);
  }

  flipSheet.offsetWidth;
  flipSheet.classList.add("flipping");

  window.setTimeout(() => {
    flipSheet.className = "flip-sheet hidden";
    state.spreadIndex = targetSpread;
    renderSpread(state.spreadIndex);
    state.busy = false;
  }, OPTIONS.flipDuration);
}

function renderSpread(spreadIndex) {
  const spread = getSpreadPages(spreadIndex);
  const isCover = spreadIndex === 0;

  renderPage(leftPage, spread.left);
  renderPage(rightPage, spread.right);

  book.classList.toggle("is-cover", isCover);
  leftPage.hidden = isCover;

  spreadSlider.value = String(spreadIndex);
  prevButton.disabled = spreadIndex === 0;
  nextButton.disabled = spreadIndex === state.spreadCount - 1;
  leftPage.classList.toggle("can-turn", spreadIndex > 0);
  rightPage.classList.toggle("can-turn", spreadIndex < state.spreadCount - 1);
  statusText.textContent = `${spreadIndex + 1} / ${state.spreadCount}`;
}

function getSpreadPages(spreadIndex) {
  if (spreadIndex === 0) {
    return { left: null, right: 1 };
  }

  const left = spreadIndex * 2;
  const right = left + 1;

  return {
    left: left <= state.pageCanvases.length ? left : null,
    right: right <= state.pageCanvases.length ? right : null,
  };
}

function renderPage(container, pageNumber) {
  if (!pageNumber) {
    container.innerHTML = placeholder(OPTIONS.blankLabel);
    return;
  }

  const sourceCanvas = state.pageCanvases[pageNumber - 1];
  const clone = sourceCanvas.cloneNode(false);
  clone.getContext("2d").drawImage(sourceCanvas, 0, 0);
  container.replaceChildren(clone);
}

function disableControls(disabled) {
  controlsToggleButton.disabled = disabled;
  prevButton.disabled = disabled;
  nextButton.disabled = disabled;
  spreadSlider.disabled = disabled;
}

async function loadPdfFromUrl(url, sourceName) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${sourceName}`);
  }
  state.currentPdfBlob = await response.blob();
  const documentTask = pdfjsLib.getDocument(url);
  updateDownloadLink(url, sourceName);
  await loadPdfDocument(documentTask, sourceName);
}

async function loadPdfFromFile(file) {
  const buffer = await file.arrayBuffer();
  const objectUrl = URL.createObjectURL(file);
  state.currentPdfBlob = file;
  updateDownloadLink(objectUrl, file.name);
  const documentTask = pdfjsLib.getDocument({ data: buffer });
  await loadPdfDocument(documentTask, file.name);
}

async function loadPdfDocument(documentTask, sourceName) {
  disableControls(true);
  loadingPanel.classList.remove("hidden");
  selectFileButton.classList.add("hidden");
  loadingText.textContent = `Parsing ${sourceName}...`;
  state.busy = true;
  state.pageCanvases = [];
  state.spreadIndex = 0;
  state.sourceName = sourceName;
  sidePanelLabel.textContent = sourceName;
  fileNameText.textContent = sourceName;
  flipSheet.className = "flip-sheet hidden";

  const pdf = await documentTask.promise;
  loadingText.textContent = `Rendering ${pdf.numPages} pages...`;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const pdfPage = await pdf.getPage(pageNumber);
    const viewport = pdfPage.getViewport({ scale: OPTIONS.renderScale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await pdfPage.render({
      canvasContext: context,
      viewport,
    }).promise;

    state.pageCanvases.push(canvas);
  }

  state.spreadCount = Math.max(1, Math.ceil((state.pageCanvases.length + 1) / 2));
  spreadSlider.max = String(state.spreadCount - 1);
  spreadSlider.value = "0";
  renderSpread(0);
  state.busy = false;
  disableControls(false);
  loadingPanel.classList.add("hidden");
}

function handleDragEnter(event) {
  if (!hasPdf(event.dataTransfer)) {
    return;
  }
  event.preventDefault();
  state.dragDepth += 1;
  app.classList.add("is-dragging");
}

function handleDragOver(event) {
  if (!hasPdf(event.dataTransfer)) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

function handleDragLeave(event) {
  if (!hasPdf(event.dataTransfer)) {
    return;
  }
  event.preventDefault();
  state.dragDepth = Math.max(0, state.dragDepth - 1);
  if (state.dragDepth === 0) {
    app.classList.remove("is-dragging");
  }
}

async function handleDrop(event) {
  if (!hasPdf(event.dataTransfer)) {
    return;
  }
  event.preventDefault();
  state.dragDepth = 0;
  app.classList.remove("is-dragging");

  const file = [...event.dataTransfer.files].find((item) =>
    item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf")
  );
  if (!file) {
    return;
  }

  try {
    await loadPdfFromFile(file);
  } catch (error) {
    console.error(error);
    showFileFallback(`Could not load ${file.name}. Drop another PDF or choose a file.`);
  }
}

async function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    await loadPdfFromFile(file);
  } catch (error) {
    console.error(error);
    showFileFallback(`Could not load ${file.name}. Drop another PDF or choose a file.`);
  } finally {
    fileInput.value = "";
  }
}

function hasPdf(dataTransfer) {
  if (!dataTransfer) {
    return false;
  }

  if ([...dataTransfer.items || []].some((item) => item.type === "application/pdf")) {
    return true;
  }

  return [...dataTransfer.files || []].some((file) =>
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function placeholder(label) {
  return `<div class="placeholder">${label}</div>`;
}

function showFileFallback(message) {
  state.busy = false;
  disableControls(true);
  loadingPanel.classList.remove("hidden");
  selectFileButton.classList.remove("hidden");
  loadingText.textContent =
    message ||
    "sample.pdf could not be loaded here. Drag and drop a PDF, or choose a file.";
  leftPage.innerHTML = placeholder("Drop a PDF here");
  rightPage.innerHTML = placeholder("Or click Choose PDF");
  statusText.textContent = "0 / 0";
}

function syncFullscreenLabel() {
  const isFullscreen = document.fullscreenElement === app;

  if (!isFullscreen) {
    app.classList.remove("show-controls");
    window.clearTimeout(state.controlsHideTimer);
  }
}

function handleFullscreenPointer(event) {
  if (document.fullscreenElement !== app) {
    return;
  }

  const rect = app.getBoundingClientRect();
  if (event.clientY < rect.bottom - OPTIONS.controlsRevealZone) {
    return;
  }

  app.classList.add("show-controls");
  window.clearTimeout(state.controlsHideTimer);
  state.controlsHideTimer = window.setTimeout(() => {
    app.classList.remove("show-controls");
  }, OPTIONS.controlsRevealDelay);
}

function openSidePanel() {
  if (document.fullscreenElement === app) {
    return;
  }

  app.classList.add("side-panel-open");
  sidePanel.setAttribute("aria-hidden", "false");
}

function closeSidePanel() {
  app.classList.remove("side-panel-open");
  sidePanel.setAttribute("aria-hidden", "true");
}

function updateDownloadLink(href, filename) {
  downloadLink.href = href;
  downloadLink.download = filename;
  sidePanelLabel.textContent = filename;
  fileNameText.textContent = filename;
}

function handleDocumentClick(event) {
  if (!app.classList.contains("side-panel-open")) {
    return;
  }

  if (sidePanel.contains(event.target) || controlsToggleButton.contains(event.target)) {
    return;
  }

  closeSidePanel();
}

async function handleDownloadAppZip(event) {
  event.preventDefault();

  try {
    downloadAppLink.textContent = "Preparing ZIP...";
    downloadAppLink.setAttribute("aria-disabled", "true");

    const zip = new window.JSZip();
    const assets = ["README.md", "index.html", "app.js", "styles.css"];

    const assetResults = await Promise.all(
      assets.map(async (path) => {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Could not fetch ${path}`);
        }
        return { path, content: await response.text() };
      })
    );

    for (const asset of assetResults) {
      zip.file(asset.path, asset.content);
    }

    if (!state.currentPdfBlob) {
      throw new Error("No PDF is currently loaded.");
    }

    zip.file(state.sourceName, state.currentPdfBlob);

    const blob = await zip.generateAsync({ type: "blob" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "flippy-webapp.zip";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    console.error(error);
  } finally {
    downloadAppLink.textContent = "Download App ZIP";
    downloadAppLink.removeAttribute("aria-disabled");
  }
}
