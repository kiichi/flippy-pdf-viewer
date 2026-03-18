import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

const OPTIONS = {
  pdfPath: "./sample.pdf",
  builderTools: true,
  renderScale: 1.35,
  keyboardNavigation: true,
  blankLabel: "",
  flipDuration: 560,
  perspective: 900,
  controlsRevealZone: 140,
  controlsRevealDelay: 1200,
};

const APP_VERSION = "v0.1.0";
const MAX_PERSISTED_PDF_BYTES = 25 * 1024 * 1024;

const app = document.getElementById("app");
const fileInput = document.getElementById("fileInput");
const dropOverlay = document.getElementById("dropOverlay");
const book = document.getElementById("book");
const sidePanel = document.getElementById("sidePanel");
const sidePanelCloseButton = document.getElementById("sidePanelCloseButton");
const sidePanelLabel = document.getElementById("sidePanelLabel");
const builderSection = document.getElementById("builderSection");
const uploadButton = document.getElementById("uploadButton");
const shareButton = document.getElementById("shareButton");
const downloadLink = document.getElementById("downloadLink");
const downloadAppLink = document.getElementById("downloadAppLink");
const resetAllButton = document.getElementById("resetAllButton");
const panelFeedback = document.getElementById("panelFeedback");
const leftPage = document.getElementById("leftPage");
const rightPage = document.getElementById("rightPage");
const flipSheet = document.getElementById("flipSheet");
const flipFront = document.getElementById("flipFront");
const flipBack = document.getElementById("flipBack");
const controlsToggleButton = document.getElementById("controlsToggleButton");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const bookmarkButton = document.getElementById("bookmarkButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const spreadSlider = document.getElementById("spreadSlider");
const statusText = document.getElementById("statusText");
const loadingPanel = document.getElementById("loadingPanel");
const loadingText = document.getElementById("loadingText");
const selectFileButton = document.getElementById("selectFileButton");
const choiceDialog = document.getElementById("choiceDialog");
const choiceDialogCloseButton = document.getElementById("choiceDialogCloseButton");
const choiceDialogTitle = document.getElementById("choiceDialogTitle");
const choiceDialogMessage = document.getElementById("choiceDialogMessage");
const choiceDialogInput = document.getElementById("choiceDialogInput");
const choiceDialogOptions = document.getElementById("choiceDialogOptions");
const choiceDialogContent = document.getElementById("choiceDialogContent");
const choiceDialogActions = document.getElementById("choiceDialogActions");
const bookmarksList = document.getElementById("bookmarksList");
const bookmarksEmpty = document.getElementById("bookmarksEmpty");
const aboutVersionText = document.getElementById("aboutVersionText");

const state = {
  pageCanvases: [],
  spreadIndex: 0,
  spreadCount: 1,
  busy: false,
  controlsHideTimer: 0,
  dragDepth: 0,
  sourceKey: createUrlSourceKey(OPTIONS.pdfPath),
  sourceName: "sample.pdf",
  currentPdfBlob: null,
  feedbackTimer: 0,
  bookmarks: [],
  sessionKind: "url",
  sessionPersisted: false,
};

const BOOKMARK_STORAGE_KEY = "flippy-bookmarks-v1";
const LAST_SESSION_STORAGE_KEY = "flippy-last-session-v1";
const PDF_DB_NAME = "flippy-storage-v1";
const PDF_STORE_NAME = "files";
const LAST_OPENED_PDF_KEY = "last-opened-pdf";
const INLINE_PDF = globalThis.FLIPPY_INLINE_PDF || null;
const EXPORTED_BOOKMARKS = globalThis.FLIPPY_EXPORTED_BOOKMARKS || null;

book.style.setProperty("--flip-duration", `${OPTIONS.flipDuration}ms`);
book.style.setProperty("--perspective", `${OPTIONS.perspective}px`);

bootstrap().catch((error) => {
  console.error(error);
  showFileFallback();
});

async function bootstrap() {
  syncEmbedMode();
  bindEvents();
  syncFullscreenLabel();
  syncAboutVersion();
  syncBuilderToolsMode();
  disableControls(true);

  if (INLINE_PDF?.dataUrl) {
    await loadPdfFromDataUrl(INLINE_PDF.dataUrl, INLINE_PDF.filename || state.sourceName, {
      sourceKey: createUrlSourceKey("inline-pdf"),
      persist: false,
    });
    return;
  }

  const restored = await restoreLastSession();
  if (restored) {
    return;
  }

  await loadPdfFromUrl(OPTIONS.pdfPath, state.sourceName);
}

function syncAboutVersion() {
  aboutVersionText.textContent = `Version ${APP_VERSION}`;
}

function syncBuilderToolsMode() {
  const isReadOnly = !OPTIONS.builderTools;
  builderSection.hidden = isReadOnly;
  builderSection.style.display = isReadOnly ? "none" : "";
  builderSection.setAttribute("aria-hidden", String(isReadOnly));
  uploadButton.hidden = !OPTIONS.builderTools;
  downloadAppLink.hidden = !OPTIONS.builderTools;
  resetAllButton.hidden = !OPTIONS.builderTools;
}

function bindEvents() {
  controlsToggleButton.addEventListener("click", openSidePanel);
  sidePanelCloseButton.addEventListener("click", closeSidePanel);
  uploadButton.addEventListener("click", () => {
    if (!OPTIONS.builderTools) {
      return;
    }

    fileInput.click();
  });
  shareButton.addEventListener("click", handleShare);
  downloadAppLink.addEventListener("click", handleDownloadAppZip);
  resetAllButton.addEventListener("click", handleResetAll);
  prevButton.addEventListener("click", () => goTo(state.spreadIndex - 1));
  nextButton.addEventListener("click", () => goTo(state.spreadIndex + 1));
  bookmarkButton.addEventListener("click", toggleCurrentBookmark);
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

  app.addEventListener("dragenter", handleDragEnter);
  app.addEventListener("dragover", handleDragOver);
  app.addEventListener("dragleave", handleDragLeave);
  app.addEventListener("drop", handleDrop);
  selectFileButton.addEventListener("click", () => {
    if (!OPTIONS.builderTools) {
      return;
    }

    fileInput.click();
  });
  fileInput.addEventListener("change", handleFileSelect);
  document.addEventListener("click", handleDocumentClick);
  bookmarksList.addEventListener("click", handleBookmarkListClick);
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
  syncBookmarkButton();
  persistCurrentSessionProgress();
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
  bookmarkButton.disabled = disabled;
  fullscreenButton.disabled = disabled;
  resetAllButton.disabled = disabled;
}

async function loadPdfFromUrl(url, sourceName, options = {}) {
  const { sourceKey = createUrlSourceKey(url), persist = true, spreadIndex = 0 } = options;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${sourceName}`);
  }
  state.currentPdfBlob = await response.blob();
  const documentTask = pdfjsLib.getDocument(url);
  updateDownloadLink(url, sourceName);
  state.sessionKind = "url";
  state.sessionPersisted = false;
  await loadPdfDocument(documentTask, sourceName, sourceKey, spreadIndex);

  if (persist) {
    persistLastSession({
      kind: "url",
      sourceKey,
      sourceName,
      spreadIndex,
    });
  }
}

async function loadPdfFromDataUrl(dataUrl, sourceName, options = {}) {
  const { sourceKey = createUrlSourceKey("inline-pdf"), persist = false, spreadIndex = 0 } = options;
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error(`Could not load ${sourceName}`);
  }

  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  state.currentPdfBlob = new File([blob], sourceName, { type: "application/pdf" });
  updateDownloadLink(dataUrl, sourceName);
  const documentTask = pdfjsLib.getDocument({ data: buffer });
  state.sessionKind = "url";
  state.sessionPersisted = false;
  await loadPdfDocument(documentTask, sourceName, sourceKey, spreadIndex);

  if (persist) {
    persistLastSession({
      kind: "url",
      sourceKey,
      sourceName,
      spreadIndex,
    });
  }
}

async function loadPdfFromFile(file, options = {}) {
  const { sourceKey = createFileSourceKey(file), persist = true, spreadIndex = 0 } = options;
  const buffer = await file.arrayBuffer();
  state.currentPdfBlob = file;
  const objectUrl = URL.createObjectURL(file);
  updateDownloadLink(objectUrl, file.name);
  const documentTask = pdfjsLib.getDocument({ data: buffer });
  state.sessionKind = "file";
  state.sessionPersisted = file.size <= MAX_PERSISTED_PDF_BYTES;
  await loadPdfDocument(documentTask, file.name, sourceKey, spreadIndex);

  if (persist) {
    if (file.size <= MAX_PERSISTED_PDF_BYTES) {
      await writeStoredPdf(file);
    } else {
      await clearStoredPdf();
      setPanelFeedback(
        `This PDF is larger than ${formatBytes(MAX_PERSISTED_PDF_BYTES)} and will only be loaded temporarily in this browser session.`
      );
    }

    persistLastSession({
      kind: "file",
      sourceKey,
      sourceName: file.name,
      persisted: file.size <= MAX_PERSISTED_PDF_BYTES,
      spreadIndex,
    });
  }
}

async function loadPdfDocument(documentTask, sourceName, sourceKey, initialSpreadIndex = 0) {
  disableControls(true);
  loadingPanel.classList.remove("hidden");
  selectFileButton.classList.add("hidden");
  loadingText.textContent = `Parsing ${sourceName}...`;
  state.busy = true;
  state.pageCanvases = [];
  state.spreadIndex = 0;
  state.sourceKey = sourceKey;
  state.sourceName = sourceName;
  ensureExportedBookmarks(sourceKey);
  state.bookmarks = getBookmarksForSource(sourceKey);
  sidePanelLabel.textContent = sourceName;
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
  state.bookmarks = state.bookmarks
    .filter((bookmark) => bookmark.spreadIndex >= 0 && bookmark.spreadIndex < state.spreadCount)
    .map((bookmark) => createNamedBookmark(bookmark.spreadIndex, bookmark.label, bookmark.note));
  persistBookmarks();
  renderBookmarks();
  spreadSlider.max = String(state.spreadCount - 1);
  const restoredSpreadIndex = clampSpreadIndex(initialSpreadIndex);
  spreadSlider.value = String(restoredSpreadIndex);
  state.busy = false;
  disableControls(false);
  renderSpread(restoredSpreadIndex);
  loadingPanel.classList.add("hidden");
  app.classList.remove("is-initializing");
}

function handleDragEnter(event) {
  if (!OPTIONS.builderTools) {
    return;
  }

  if (!hasPdf(event.dataTransfer)) {
    return;
  }
  event.preventDefault();
  state.dragDepth += 1;
  app.classList.add("is-dragging");
}

function handleDragOver(event) {
  if (!OPTIONS.builderTools) {
    return;
  }

  if (!hasPdf(event.dataTransfer)) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

function handleDragLeave(event) {
  if (!OPTIONS.builderTools) {
    return;
  }

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
  if (!OPTIONS.builderTools) {
    return;
  }

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
  if (!OPTIONS.builderTools) {
    fileInput.value = "";
    return;
  }

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
  selectFileButton.classList.toggle("hidden", !OPTIONS.builderTools);
  loadingText.textContent =
    message ||
    (OPTIONS.builderTools
      ? "sample.pdf could not be loaded here. Drag and drop a PDF, or choose a file."
      : "This flipbook is in read-only mode, and the default PDF could not be loaded.");
  leftPage.innerHTML = placeholder(
    OPTIONS.builderTools ? "Drop a PDF here" : "Read-only flipbook"
  );
  rightPage.innerHTML = placeholder(
    OPTIONS.builderTools ? "Or click Choose PDF" : "Uploads are turned off"
  );
  statusText.textContent = "0 / 0";
  state.bookmarks = [];
  renderBookmarks();
  syncBookmarkButton();
  app.classList.remove("is-initializing");
}

async function restoreLastSession() {
  const lastSession = readLastSession();
  if (!lastSession) {
    return false;
  }

  if (lastSession.kind === "file") {
    if (!OPTIONS.builderTools) {
      return false;
    }

    if (lastSession.persisted) {
      const file = await readStoredPdf();
      if (file) {
        await loadPdfFromFile(file, {
          sourceKey: lastSession.sourceKey || createFileSourceKey(file),
          persist: false,
          spreadIndex: lastSession.spreadIndex || 0,
        });
        return true;
      }
    }

    showFileFallback(
      `Previously opened: ${lastSession.sourceName || "your PDF"}. Choose that file again to restore it with its bookmarks.`
    );
    return true;
  }

  if (lastSession.kind === "url") {
    await loadPdfFromUrl(OPTIONS.pdfPath, lastSession.sourceName || state.sourceName, {
      sourceKey: lastSession.sourceKey || createUrlSourceKey(OPTIONS.pdfPath),
      persist: false,
      spreadIndex: lastSession.spreadIndex || 0,
    });
    return true;
  }

  return false;
}

function syncFullscreenLabel() {
  const isFullscreen = document.fullscreenElement === app;
  fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
  fullscreenButton.setAttribute("title", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
  fullscreenButton.innerHTML = `<span aria-hidden="true">${isFullscreen ? "⤢" : "⛶"}</span>`;

  if (!isFullscreen) {
    app.classList.remove("show-controls");
    window.clearTimeout(state.controlsHideTimer);
  } else if (app.classList.contains("side-panel-open")) {
    app.classList.add("show-controls");
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
    if (app.classList.contains("side-panel-open")) {
      return;
    }

    app.classList.remove("show-controls");
  }, OPTIONS.controlsRevealDelay);
}

function openSidePanel() {
  app.classList.add("side-panel-open");
  sidePanel.setAttribute("aria-hidden", "false");
  app.classList.add("show-controls");
}

function closeSidePanel() {
  app.classList.remove("side-panel-open");
  sidePanel.setAttribute("aria-hidden", "true");

  if (document.fullscreenElement !== app) {
    app.classList.remove("show-controls");
  }
}

function updateDownloadLink(href, filename) {
  downloadLink.href = href;
  downloadLink.download = filename;
  sidePanelLabel.textContent = filename;
}

function handleDocumentClick(event) {
  if (!choiceDialog.classList.contains("hidden")) {
    return;
  }

  if (!app.classList.contains("side-panel-open")) {
    return;
  }

  if (sidePanel.contains(event.target) || controlsToggleButton.contains(event.target)) {
    return;
  }

  closeSidePanel();
}

function toggleCurrentBookmark() {
  if (state.busy || state.spreadCount < 1) {
    return;
  }

  const existingIndex = state.bookmarks.findIndex(
    (bookmark) => bookmark.spreadIndex === state.spreadIndex
  );

  if (existingIndex >= 0) {
    state.bookmarks.splice(existingIndex, 1);
    persistBookmarks();
    renderBookmarks();
    syncBookmarkButton();
    setPanelFeedback("Bookmark removed.");
    return;
  }

  state.bookmarks.push(createBookmark(state.spreadIndex));
  state.bookmarks.sort((left, right) => left.spreadIndex - right.spreadIndex);
  persistBookmarks();
  renderBookmarks();
  syncBookmarkButton();
  setPanelFeedback("Bookmark added.");
}

function createBookmark(spreadIndex) {
  const pages = getSpreadPages(spreadIndex);

  return {
    spreadIndex,
    label: formatBookmarkLabel(spreadIndex, pages),
    note: "",
  };
}

function createNamedBookmark(spreadIndex, label, note = "") {
  return {
    spreadIndex,
    label: normalizeBookmarkLabel(label, spreadIndex),
    note: normalizeBookmarkNote(note),
  };
}

function formatBookmarkLabel(spreadIndex, pages = getSpreadPages(spreadIndex)) {
  if (spreadIndex === 0) {
    return "Cover";
  }

  if (pages.left && pages.right) {
    return `Pages ${pages.left}-${pages.right}`;
  }

  const pageNumber = pages.left || pages.right || spreadIndex + 1;
  return `Page ${pageNumber}`;
}

function normalizeBookmarkLabel(label, spreadIndex) {
  const normalized = String(label || "").trim();
  return normalized || formatBookmarkLabel(spreadIndex);
}

function normalizeBookmarkNote(note) {
  return String(note || "").trim();
}

function renderBookmarks() {
  bookmarksList.replaceChildren();
  bookmarksEmpty.hidden = state.bookmarks.length > 0;

  for (const bookmark of state.bookmarks) {
    const item = document.createElement("div");
    item.className = "bookmark-item";

    const content = document.createElement("div");
    content.className = "bookmark-content";

    const linkButton = document.createElement("button");
    linkButton.type = "button";
    linkButton.className = "bookmark-link";
    linkButton.dataset.action = "go";
    linkButton.dataset.spreadIndex = String(bookmark.spreadIndex);
    linkButton.textContent = bookmark.label;

    content.append(linkButton);

    if (bookmark.note) {
      const noteText = document.createElement("p");
      noteText.className = "bookmark-note-text";
      noteText.textContent = bookmark.note;
      content.append(noteText);
    }

    const actions = document.createElement("div");
    actions.className = "bookmark-actions";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "bookmark-remove";
    removeButton.dataset.action = "remove";
    removeButton.dataset.spreadIndex = String(bookmark.spreadIndex);
    removeButton.setAttribute("aria-label", `Remove bookmark ${bookmark.label}`);
    removeButton.title = "Remove bookmark";
    removeButton.innerHTML = '<span aria-hidden="true">✕</span>';

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "bookmark-rename";
    renameButton.dataset.action = "rename";
    renameButton.dataset.spreadIndex = String(bookmark.spreadIndex);
    renameButton.setAttribute("aria-label", `Edit bookmark ${bookmark.label}`);
    renameButton.title = "Edit bookmark";
    renameButton.innerHTML = '<span aria-hidden="true">✎</span>';

    actions.append(renameButton, removeButton);
    item.append(content, actions);
    bookmarksList.append(item);
  }
}

function handleBookmarkListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const spreadIndex = Number(button.dataset.spreadIndex);
  if (!Number.isInteger(spreadIndex)) {
    return;
  }

  if (button.dataset.action === "rename") {
    editBookmark(spreadIndex);
    return;
  }

  if (button.dataset.action === "remove") {
    removeBookmark(spreadIndex);
    return;
  }

  goTo(spreadIndex);
  closeSidePanel();
}

function removeBookmark(spreadIndex) {
  const nextBookmarks = state.bookmarks.filter(
    (bookmark) => bookmark.spreadIndex !== spreadIndex
  );

  if (nextBookmarks.length === state.bookmarks.length) {
    return;
  }

  state.bookmarks = nextBookmarks;
  persistBookmarks();
  renderBookmarks();
  syncBookmarkButton();
  setPanelFeedback("Bookmark removed.");
}

async function editBookmark(spreadIndex) {
  const bookmark = state.bookmarks.find((entry) => entry.spreadIndex === spreadIndex);
  if (!bookmark) {
    return;
  }

  const nextValues = await promptForBookmarkDetails(bookmark.label, bookmark.note);
  if (nextValues === null) {
    return;
  }

  bookmark.label = normalizeBookmarkLabel(nextValues.label, spreadIndex);
  bookmark.note = normalizeBookmarkNote(nextValues.note);
  persistBookmarks();
  renderBookmarks();
  setPanelFeedback("Bookmark updated.");
}

function syncBookmarkButton() {
  const currentSpreadIsBookmarked = state.bookmarks.some(
    (bookmark) => bookmark.spreadIndex === state.spreadIndex
  );

  bookmarkButton.classList.toggle("is-active", currentSpreadIsBookmarked);
  bookmarkButton.setAttribute(
    "aria-label",
    currentSpreadIsBookmarked ? "Remove bookmark" : "Add bookmark"
  );
  bookmarkButton.setAttribute(
    "title",
    currentSpreadIsBookmarked ? "Remove bookmark" : "Add bookmark"
  );
  bookmarkButton.innerHTML = `<span aria-hidden="true">${
    currentSpreadIsBookmarked ? "★" : "☆"
  }</span>`;
}

function getBookmarksForSource(sourceKey) {
  const bookmarkMap = readBookmarkStorage();
  const bookmarkEntries = bookmarkMap[sourceKey];

  if (!Array.isArray(bookmarkEntries)) {
    return [];
  }

  return bookmarkEntries
    .map((entry) => normalizeStoredBookmarkEntry(entry))
    .filter((entry) => Number.isInteger(entry?.spreadIndex) && entry.spreadIndex >= 0)
    .sort((left, right) => left.spreadIndex - right.spreadIndex)
    .map((entry) => createNamedBookmark(entry.spreadIndex, entry.label, entry.note));
}

function persistBookmarks() {
  const bookmarkMap = readBookmarkStorage();
  bookmarkMap[state.sourceKey] = state.bookmarks.map((bookmark) => ({
    spreadIndex: bookmark.spreadIndex,
    label: bookmark.label,
    note: bookmark.note,
  }));
  writeBookmarkStorage(bookmarkMap);
}

function ensureExportedBookmarks(sourceKey) {
  if (!EXPORTED_BOOKMARKS || typeof EXPORTED_BOOKMARKS !== "object") {
    return;
  }

  const bookmarkEntries = EXPORTED_BOOKMARKS[sourceKey];
  if (!Array.isArray(bookmarkEntries)) {
    return;
  }

  const bookmarkMap = readBookmarkStorage();
  if (Array.isArray(bookmarkMap[sourceKey]) && bookmarkMap[sourceKey].length > 0) {
    return;
  }

  bookmarkMap[sourceKey] = bookmarkEntries;
  writeBookmarkStorage(bookmarkMap);
}

function normalizeStoredBookmarkEntry(entry) {
  if (typeof entry === "number") {
    return { spreadIndex: entry, label: "", note: "" };
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  return {
    spreadIndex: Number(entry.spreadIndex),
    label: typeof entry.label === "string" ? entry.label : "",
    note: typeof entry.note === "string" ? entry.note : "",
  };
}

function readLastSession() {
  try {
    const raw = window.localStorage.getItem(LAST_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function persistLastSession(session) {
  try {
    window.localStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error(error);
  }
}

function persistCurrentSessionProgress() {
  const lastSession = readLastSession();
  if (!lastSession || lastSession.sourceKey !== state.sourceKey) {
    persistLastSession({
      kind: state.sessionKind,
      sourceKey: state.sourceKey,
      sourceName: state.sourceName,
      persisted: state.sessionKind === "file" ? state.sessionPersisted : undefined,
      spreadIndex: state.spreadIndex,
    });
    return;
  }

  persistLastSession({
    ...lastSession,
    spreadIndex: state.spreadIndex,
  });
}

function clearLastSession() {
  try {
    window.localStorage.removeItem(LAST_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error(error);
  }
}

function clampSpreadIndex(spreadIndex) {
  const numericSpreadIndex = Number(spreadIndex);
  if (!Number.isFinite(numericSpreadIndex)) {
    return 0;
  }

  return Math.max(0, Math.min(state.spreadCount - 1, Math.floor(numericSpreadIndex)));
}

function readBookmarkStorage() {
  try {
    const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error(error);
    return {};
  }
}

function writeBookmarkStorage(bookmarkMap) {
  try {
    window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarkMap));
  } catch (error) {
    console.error(error);
  }
}

function clearBookmarkStorage() {
  try {
    window.localStorage.removeItem(BOOKMARK_STORAGE_KEY);
  } catch (error) {
    console.error(error);
  }
}

function createUrlSourceKey(url) {
  return `url:${url}`;
}

function createFileSourceKey(file) {
  return `file:${file.name}:${file.size}:${file.lastModified || 0}`;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function openStorageDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(PDF_DB_NAME, 1);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PDF_STORE_NAME)) {
        database.createObjectStore(PDF_STORE_NAME);
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function writeStoredPdf(file) {
  const database = await openStorageDatabase();

  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(PDF_STORE_NAME, "readwrite");
      const store = transaction.objectStore(PDF_STORE_NAME);
      store.put(file, LAST_OPENED_PDF_KEY);

      transaction.addEventListener("complete", resolve);
      transaction.addEventListener("error", () => reject(transaction.error));
      transaction.addEventListener("abort", () => reject(transaction.error));
    });
  } finally {
    database.close();
  }
}

async function readStoredPdf() {
  const database = await openStorageDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(PDF_STORE_NAME, "readonly");
      const store = transaction.objectStore(PDF_STORE_NAME);
      const request = store.get(LAST_OPENED_PDF_KEY);

      request.addEventListener("success", () => resolve(request.result || null));
      request.addEventListener("error", () => reject(request.error));
    });
  } finally {
    database.close();
  }
}

async function clearStoredPdf() {
  const database = await openStorageDatabase();

  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(PDF_STORE_NAME, "readwrite");
      const store = transaction.objectStore(PDF_STORE_NAME);
      store.delete(LAST_OPENED_PDF_KEY);

      transaction.addEventListener("complete", resolve);
      transaction.addEventListener("error", () => reject(transaction.error));
      transaction.addEventListener("abort", () => reject(transaction.error));
    });
  } finally {
    database.close();
  }
}

async function handleDownloadAppZip(event) {
  event.preventDefault();

  try {
    const exportChoice = await chooseExportMode();
    if (!exportChoice) {
      return;
    }

    downloadAppLink.textContent = "Preparing Entire Package...";
    downloadAppLink.setAttribute("aria-disabled", "true");

    if (exportChoice.format === "single-html") {
      await downloadSingleHtml(exportChoice.accessMode, exportChoice.includeBookmarks);
      return;
    }

    const zip = new window.JSZip();
    const assets = ["README.md", "index.html", "app.js", "styles.css"];

    if (state.sourceName === "sample.pdf") {
      assets.push("sample.pdf");
    }

    const assetResults = await Promise.all(
      assets.map(async (path) => {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Could not fetch ${path}`);
        }
        const content =
          path.endsWith(".pdf") ? await response.blob() : await response.text();
        return { path, content };
      })
    );

    for (const asset of assetResults) {
      if (asset.path === "index.html") {
        zip.file(asset.path, createExportIndexHtml(asset.content, exportChoice.accessMode));
        continue;
      }

      if (asset.path === "app.js") {
        zip.file(
          asset.path,
          createPackagedAppScript(
            asset.content,
            state.sourceName,
            exportChoice.accessMode,
            exportChoice.includeBookmarks
          )
        );
        continue;
      }

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
    downloadAppLink.textContent = "Download Entire Package";
    downloadAppLink.removeAttribute("aria-disabled");
  }
}

async function downloadSingleHtml(exportMode = "readonly", includeBookmarks = false) {
  try {
    if (!state.currentPdfBlob) {
      throw new Error("No PDF is currently loaded.");
    }

    const assetResults = await Promise.all(
      ["index.html", "app.js", "styles.css"].map(async (path) => {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Could not fetch ${path}`);
        }

        return { path, content: await response.text() };
      })
    );

    const indexHtml = assetResults.find((asset) => asset.path === "index.html")?.content;
    const appSource = assetResults.find((asset) => asset.path === "app.js")?.content;
    const stylesSource = assetResults.find((asset) => asset.path === "styles.css")?.content;

    if (!indexHtml || !appSource || !stylesSource) {
      throw new Error("Could not prepare standalone HTML.");
    }

    const pdfDataUrl = await blobToDataUrl(state.currentPdfBlob);
    const standaloneHtml = createStandaloneHtml({
      indexHtml,
      appSource,
      stylesSource,
      pdfDataUrl,
      pdfFilename: state.sourceName,
      exportMode,
      includeBookmarks,
    });

    const blob = new Blob([standaloneHtml], { type: "text/html" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = createSingleHtmlFilename(state.sourceName);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    console.error(error);
    setPanelFeedback("Could not create single HTML export.");
  }
}

async function handleResetAll() {
  const confirmed = await confirmResetAll();

  if (!confirmed) {
    return;
  }

  try {
    resetAllButton.disabled = true;
    clearBookmarkStorage();
    clearLastSession();
    await clearStoredPdf();
    state.bookmarks = [];
    renderBookmarks();
    syncBookmarkButton();
    await loadPdfFromUrl(OPTIONS.pdfPath, "sample.pdf", {
      sourceKey: createUrlSourceKey(OPTIONS.pdfPath),
      persist: false,
    });
    setPanelFeedback("Bookmarks and remembered file reset.");
  } catch (error) {
    console.error(error);
    setPanelFeedback("Could not reset saved data.");
  } finally {
    resetAllButton.disabled = false;
  }
}

function createPackagedAppScript(source, pdfFilename, exportMode, includeBookmarks = false) {
  const pdfPathLiteral = JSON.stringify(`./${pdfFilename}`);
  const sourceNameLiteral = JSON.stringify(pdfFilename);
  const exportedBookmarks = includeBookmarks
    ? createExportedBookmarksPrelude(createUrlSourceKey(`./${pdfFilename}`))
    : "";

  return `${exportedBookmarks}${source}`
    .replace(/builderTools: true/, `builderTools: ${exportModeToBuilderTools(exportMode)}`)
    .replace(/pdfPath: "\.\/sample\.pdf"/, `pdfPath: ${pdfPathLiteral}`)
    .replace(/sourceName: "sample\.pdf"/, `sourceName: ${sourceNameLiteral}`);
}

function createExportIndexHtml(indexHtml, exportMode) {
  if (exportMode === "full") {
    return indexHtml;
  }

  return indexHtml.replace(
    /(<section\b[\s\S]*?\bclass="side-panel-actions side-panel-actions-secondary"[\s\S]*?\bid="builderSection")/,
    '$1 hidden'
  );
}

function createStandaloneHtml({
  indexHtml,
  appSource,
  stylesSource,
  pdfDataUrl,
  pdfFilename,
  exportMode,
  includeBookmarks = false,
}) {
  const standaloneApp = createStandaloneAppScript(
    appSource,
    pdfFilename,
    pdfDataUrl,
    exportMode,
    includeBookmarks
  ).replace(
    /<\/script>/gi,
    "<\\/script>"
  );

  return createExportIndexHtml(indexHtml, exportMode)
    .replace(
      /<link\s+rel="stylesheet"\s+href="\.\/styles\.css"\s*\/?>/,
      `<style>\n${stylesSource}\n</style>`
    )
    .replace(/^\s*<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/jszip@[^"]+"\s*><\/script>\s*$/m, "")
    .replace(
      /^\s*<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@[^"]+"\s+type="module"\s*><\/script>\s*$/m,
      ""
    )
    .replace(
      /^\s*<script\s+src="\.\/app\.js"\s+type="module"\s*><\/script>\s*$/m,
      `    <script type="module">\n${standaloneApp}\n    </script>`
    );
}

function createStandaloneAppScript(
  source,
  pdfFilename,
  pdfDataUrl,
  exportMode = "readonly",
  includeBookmarks = false
) {
  const inlinePdfLiteral = JSON.stringify({
    filename: pdfFilename,
    dataUrl: pdfDataUrl,
  });
  const sourceNameLiteral = JSON.stringify(pdfFilename);
  const exportedBookmarks = includeBookmarks
    ? createExportedBookmarksPrelude(createUrlSourceKey("inline-pdf"))
    : "";

  return `${exportedBookmarks}globalThis.FLIPPY_INLINE_PDF = ${inlinePdfLiteral};\n${source}`
    .replace(/const INLINE_PDF = globalThis\.FLIPPY_INLINE_PDF \|\| null;/, "const INLINE_PDF = globalThis.FLIPPY_INLINE_PDF || null;")
    .replace(/builderTools: true/, `builderTools: ${exportModeToBuilderTools(exportMode)}`)
    .replace(/sourceName: "sample\.pdf"/, `sourceName: ${sourceNameLiteral}`);
}

function createExportedBookmarksPrelude(sourceKey) {
  const bookmarkEntries = state.bookmarks.map((bookmark) => ({
    spreadIndex: bookmark.spreadIndex,
    label: bookmark.label,
  }));
  const bookmarkMapLiteral = JSON.stringify({ [sourceKey]: bookmarkEntries });
  return `globalThis.FLIPPY_EXPORTED_BOOKMARKS = ${bookmarkMapLiteral};\n`;
}

function createSingleHtmlFilename(pdfFilename) {
  const baseName = String(pdfFilename || "flippy")
    .replace(/\.pdf$/i, "")
    .replace(/[^\w.-]+/g, "_");

  return `${baseName}.html`;
}

async function chooseExportMode() {
  return showChoiceDialog({
    title: "Download Export",
    message: "",
    options: {
      groups: [
        {
          type: "radio",
          name: "export-access-mode",
          items: [
            { label: "Read-Only", value: "readonly" },
            { label: "Full Features", value: "full" },
          ],
          defaultValue: "readonly",
        },
        {
          type: "checkbox",
          name: "export-include-bookmarks",
          items: [
            { label: "Include bookmarks", value: "include-bookmarks" },
          ],
          defaultValue: true,
        },
      ],
    },
    choices: [
      { label: "Single File (HTML)", value: "single-html" },
      { label: "Project Folder (Zip)", value: "package" },
    ],
  });
}

function exportModeToBuilderTools(exportMode) {
  return exportMode === "full";
}

async function confirmResetAll() {
  const result = await showChoiceDialog({
    title: "Reset All",
    message:
      "Clear all bookmarks and remembered files, then return Flippy to the default sample PDF?",
    choices: [
      { label: "Reset All", value: true },
      { label: "Cancel", value: false },
    ],
  });

  return Boolean(result);
}

async function promptForBookmarkDetails(currentLabel, currentNote) {
  return showChoiceDialog({
    title: "Edit Bookmark",
    message: "",
    fields: [
      {
        name: "label",
        label: "Bookmark Name",
        value: currentLabel,
        placeholder: "Bookmark name",
      },
      {
        name: "note",
        label: "Note",
        value: currentNote,
        placeholder: "Add a short note",
        multiline: true,
      },
    ],
    choices: [
      { label: "Save", value: "submit" },
    ],
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

function showShareDialog() {
  const shareUrl = getShareUrl();
  const embedUrl = getEmbedUrl();
  const shareData = {
    title: `Flippy - ${state.sourceName}`,
    text: `Open ${state.sourceName} in Flippy`,
    url: shareUrl,
  };

  showCustomDialog({
    title: "Share",
    message: "",
    renderContent: (close) => {
      choiceDialogContent.classList.remove("hidden");

      const linkLabel = document.createElement("p");
      linkLabel.className = "choice-dialog-embed-label";
      linkLabel.textContent = "Share Link";

      const linkField = document.createElement("textarea");
      linkField.className = "choice-dialog-embed-code choice-dialog-share-link";
      linkField.readOnly = true;
      linkField.value = shareUrl;
      linkField.addEventListener("focus", () => linkField.select());

      const row = document.createElement("div");
      row.className = "choice-dialog-share-row";

      const copyLinkButton = document.createElement("button");
      copyLinkButton.type = "button";
      copyLinkButton.className = "choice-dialog-icon-button";
      copyLinkButton.setAttribute("aria-label", "Copy share link");
      copyLinkButton.title = "Copy share link";
      copyLinkButton.textContent = "⧉";
      copyLinkButton.addEventListener("click", async () => {
        const copied = await copyText(shareUrl);
        if (copied) {
          setPanelFeedback("Share link copied.");
          return;
        }

        linkField.focus();
        linkField.select();
        setPanelFeedback("Copy failed. Share link selected instead.");
      });

      const shareViaButton = document.createElement("button");
      shareViaButton.type = "button";
      shareViaButton.textContent = "Share Via";
      shareViaButton.disabled = !navigator.share;
      shareViaButton.addEventListener("click", async () => {
        try {
          if (!navigator.share) {
            return;
          }

          await navigator.share(shareData);
          close();
          setPanelFeedback("Share sheet opened.");
        } catch (error) {
          if (error?.name === "AbortError") {
            return;
          }

          console.error(error);
          setPanelFeedback("Could not share this page.");
        }
      });

      const embedLabel = document.createElement("p");
      embedLabel.className = "choice-dialog-embed-label";
      embedLabel.textContent = "Embed Code";

      const embedCode = document.createElement("textarea");
      embedCode.className = "choice-dialog-embed-code";
      embedCode.readOnly = true;
      embedCode.value = getEmbedCode(embedUrl);
      embedCode.addEventListener("focus", () => embedCode.select());

      const copyEmbedButton = document.createElement("button");
      copyEmbedButton.type = "button";
      copyEmbedButton.textContent = "Copy Embed Code";
      copyEmbedButton.addEventListener("click", async () => {
        const copied = await copyText(embedCode.value);
        if (copied) {
          setPanelFeedback("Embed code copied.");
          return;
        }

        embedCode.focus();
        embedCode.select();
        setPanelFeedback("Copy failed. Embed code selected instead.");
      });

      row.append(linkField, copyLinkButton);
      choiceDialogContent.append(linkLabel, row, shareViaButton, embedLabel, embedCode, copyEmbedButton);
    },
  });
}

function showChoiceDialog({ title, message, choices, input = null, options = null, fields = null }) {
  return new Promise((resolve) => {
    choiceDialogTitle.textContent = title;
    choiceDialogMessage.textContent = message;
    prepareDialogShell({ input, options, fields });

    if (options) {
      const groups = Array.isArray(options.groups) ? options.groups : [options];

      for (const group of groups) {
        const groupElement = document.createElement("div");
        groupElement.className = `choice-dialog-options-group choice-dialog-options-group-${group.type || "radio"}`;

        for (const item of group.items) {
          const label = document.createElement("label");
          label.className = "choice-dialog-option";

          const inputElement = document.createElement("input");
          inputElement.type = group.type || "radio";
          inputElement.name = group.name;
          inputElement.value = item.value;

          if (inputElement.type === "checkbox") {
            inputElement.checked = Boolean(group.defaultValue);
          } else {
            inputElement.checked = item.value === group.defaultValue;
          }

          const text = document.createElement("span");
          text.textContent = item.label;

          label.append(inputElement, text);
          groupElement.append(label);
        }

        choiceDialogOptions.append(groupElement);
      }
    }

    if (fields?.length) {
      choiceDialogContent.classList.remove("hidden");

      for (const field of fields) {
        const label = document.createElement("label");
        label.className = "choice-dialog-field";

        const title = document.createElement("span");
        title.className = "choice-dialog-field-label";
        title.textContent = field.label;

        const inputElement = document.createElement(field.multiline ? "textarea" : "input");
        inputElement.className = "choice-dialog-input";
        inputElement.dataset.dialogField = field.name;
        inputElement.placeholder = field.placeholder || "";
        inputElement.value = field.value || "";

        if (field.multiline) {
          inputElement.rows = field.rows || 4;
        } else {
          inputElement.type = "text";
        }

        label.append(title, inputElement);
        choiceDialogContent.append(label);
      }
    }

    choiceDialog.classList.remove("hidden");
    choiceDialog.setAttribute("aria-hidden", "false");

    const close = (value) => {
      const selectedOptions = options ? readDialogOptionValues(options) : null;
      const fieldValues = fields?.length ? readDialogFieldValues(fields) : null;
      const result =
        value === "submit" && fields?.length
          ? fieldValues
          : value === "submit"
            ? choiceDialogInput.value
          : value && options
            ? { format: value, ...selectedOptions }
            : value;
      closeDialogShell();
      resolve(result);
    };

    choiceDialogCloseButton.onclick = (event) => {
      event.stopPropagation();
      close(null);
    };
    choiceDialog.onclick = (event) => {
      if (event.target === choiceDialog) {
        event.stopPropagation();
        close(null);
      }
    };
    const dialogCard = choiceDialog.querySelector(".choice-dialog-card");
    dialogCard.onclick = (event) => {
      event.stopPropagation();
    };
    document.addEventListener("keydown", handleDialogKeydown);

    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        close(choice.value);
      });
      choiceDialogActions.append(button);
    }

    if (fields?.length) {
      window.setTimeout(() => {
        const firstField = choiceDialogContent.querySelector("[data-dialog-field]");
        firstField?.focus();
        if (typeof firstField?.select === "function") {
          firstField.select();
        }
      }, 0);
    } else if (input) {
      window.setTimeout(() => {
        choiceDialogInput.focus();
        choiceDialogInput.select();
      }, 0);
    }
  });
}

function showCustomDialog({ title, message, renderContent }) {
  choiceDialogTitle.textContent = title;
  choiceDialogMessage.textContent = message;
  prepareDialogShell({});
  choiceDialog.classList.remove("hidden");
  choiceDialog.setAttribute("aria-hidden", "false");

  const close = () => {
    closeDialogShell();
  };

  choiceDialogCloseButton.onclick = (event) => {
    event.stopPropagation();
    close();
  };
  choiceDialog.onclick = (event) => {
    if (event.target === choiceDialog) {
      event.stopPropagation();
      close();
    }
  };
  const dialogCard = choiceDialog.querySelector(".choice-dialog-card");
  dialogCard.onclick = (event) => {
    event.stopPropagation();
  };
  document.addEventListener("keydown", handleDialogKeydown);
  renderContent(close);
}

function prepareDialogShell({ input = null, options = null, fields = null }) {
  choiceDialogActions.replaceChildren();
  choiceDialogContent.replaceChildren();
  choiceDialogContent.classList.toggle("hidden", !fields);
  choiceDialogInput.classList.toggle("hidden", !input);
  choiceDialogInput.value = input?.value || "";
  choiceDialogInput.placeholder = input?.placeholder || "";
  choiceDialogInput.rows = input?.multiline ? 4 : 1;
  choiceDialogOptions.replaceChildren();
  choiceDialogOptions.classList.toggle("hidden", !options);
}

function readDialogOptionValues(options) {
  const groups = Array.isArray(options.groups) ? options.groups : [options];
  const values = {};

  for (const group of groups) {
    if (group.type === "checkbox") {
      const checkbox = choiceDialogOptions.querySelector(`input[name="${group.name}"]`);
      values[group.name] = checkbox ? checkbox.checked : Boolean(group.defaultValue);
      continue;
    }

    const selected = choiceDialogOptions.querySelector(`input[name="${group.name}"]:checked`);
    values[group.name] = selected?.value || group.defaultValue || null;
  }

  return normalizeDialogOptionValues(values);
}

function normalizeDialogOptionValues(values) {
  if ("export-access-mode" in values || "export-include-bookmarks" in values) {
    return {
      accessMode: values["export-access-mode"] || "readonly",
      includeBookmarks: Boolean(values["export-include-bookmarks"]),
    };
  }

  return values;
}

function readDialogFieldValues(fields) {
  const values = {};

  for (const field of fields) {
    const inputElement = choiceDialogContent.querySelector(`[data-dialog-field="${field.name}"]`);
    values[field.name] = inputElement?.value || "";
  }

  return values;
}

function closeDialogShell() {
  choiceDialog.classList.add("hidden");
  choiceDialog.setAttribute("aria-hidden", "true");
  choiceDialog.onclick = null;
  const dialogCard = choiceDialog.querySelector(".choice-dialog-card");
  if (dialogCard) {
    dialogCard.onclick = null;
  }
  document.removeEventListener("keydown", handleDialogKeydown);
  choiceDialogActions.replaceChildren();
  choiceDialogContent.replaceChildren();
  choiceDialogContent.classList.add("hidden");
  choiceDialogInput.classList.add("hidden");
  choiceDialogOptions.classList.add("hidden");
}

function handleDialogKeydown(event) {
  if (event.key !== "Escape" || choiceDialog.classList.contains("hidden")) {
    return;
  }

  choiceDialogCloseButton.click();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === app) {
      await document.exitFullscreen();
      return;
    }

    await app.requestFullscreen();
  } catch (error) {
    console.error(error);
    setPanelFeedback("Fullscreen is not available here.");
  }
}

async function handleShare() {
  showShareDialog();
}

function syncEmbedMode() {
  const isEmbedded = isEmbedMode();
  document.body.classList.toggle("is-embedded", isEmbedded);
  app.classList.toggle("is-embedded", isEmbedded);
}

function getEmbedCode(embedUrl = getEmbedUrl()) {
  return `<iframe src="${escapeAttribute(embedUrl)}" title="${escapeAttribute(
    `Flippy viewer for ${state.sourceName}`
  )}" width="960" height="640" style="border:0;" loading="lazy" allow="fullscreen"></iframe>`;
}

function getShareUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("embed");
  return url.toString();
}

function getEmbedUrl() {
  const url = new URL(getShareUrl());
  url.searchParams.set("embed", "1");
  return url.toString();
}

function isEmbedMode() {
  const url = new URL(window.location.href);
  return window.self !== window.top || url.searchParams.get("embed") === "1";
}

function setPanelFeedback(message) {
  window.clearTimeout(state.feedbackTimer);
  panelFeedback.textContent = message;

  if (!message) {
    return;
  }

  state.feedbackTimer = window.setTimeout(() => {
    panelFeedback.textContent = "";
  }, 2200);
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function copyText(value) {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
