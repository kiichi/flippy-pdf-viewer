import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

const OPTIONS = {
  pdfPath: "./sample.pdf",
  renderScale: 1.35,
  keyboardNavigation: true,
  blankLabel: "Blank page",
  flipDuration: 900,
  perspective: 900,
  controlsRevealZone: 140,
  controlsRevealDelay: 1200,
};

const app = document.getElementById("app");
const book = document.getElementById("book");
const leftPage = document.getElementById("leftPage");
const rightPage = document.getElementById("rightPage");
const flipSheet = document.getElementById("flipSheet");
const flipFront = document.getElementById("flipFront");
const flipBack = document.getElementById("flipBack");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const fullscreenIcon = document.getElementById("fullscreenIcon");
const spreadSlider = document.getElementById("spreadSlider");
const statusText = document.getElementById("statusText");
const hintText = document.getElementById("hintText");
const loadingPanel = document.getElementById("loadingPanel");
const loadingText = document.getElementById("loadingText");

const state = {
  pageCanvases: [],
  spreadIndex: 0,
  spreadCount: 1,
  busy: false,
  controlsHideTimer: 0,
};

book.style.setProperty("--flip-duration", `${OPTIONS.flipDuration}ms`);
book.style.setProperty("--perspective", `${OPTIONS.perspective}px`);

bootstrap().catch((error) => {
  console.error(error);
  loadingText.textContent = "Could not load sample.pdf. Start this with Live Server.";
  leftPage.innerHTML = placeholder("Failed to load PDF.");
  rightPage.innerHTML = placeholder(error.message || "Unknown error.");
  prevButton.disabled = true;
  nextButton.disabled = true;
  spreadSlider.disabled = true;
});

async function bootstrap() {
  disableControls(true);
  loadingText.textContent = "Parsing sample.pdf...";

  const documentTask = pdfjsLib.getDocument(OPTIONS.pdfPath);
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

  bindEvents();
  renderSpread(0);
  disableControls(false);
  loadingPanel.classList.add("hidden");
}

function bindEvents() {
  prevButton.addEventListener("click", () => goTo(state.spreadIndex - 1));
  nextButton.addEventListener("click", () => goTo(state.spreadIndex + 1));
  fullscreenButton.addEventListener("click", toggleFullscreen);
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

  const visiblePages = [spread.left, spread.right].filter(Boolean).join(" - ");
  hintText.textContent = `sample.pdf • pages ${visiblePages || "blank"}`;
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
  prevButton.disabled = disabled;
  nextButton.disabled = disabled;
  fullscreenButton.disabled = disabled;
  spreadSlider.disabled = disabled;
}

function placeholder(label) {
  return `<div class="placeholder">${label}</div>`;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await app.requestFullscreen();
  } catch (error) {
    console.error(error);
    hintText.textContent = "Fullscreen is not available in this browser.";
  }
}

function syncFullscreenLabel() {
  const isFullscreen = document.fullscreenElement === app;
  fullscreenButton.setAttribute(
    "aria-label",
    isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
  );
  fullscreenButton.setAttribute(
    "title",
    isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
  );
  fullscreenIcon.textContent = isFullscreen ? "⤢" : "⛶";

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
