# Flippy

Flippy is a lightweight PDF flipbook viewer for the web. It renders PDF pages into a two-page book layout, adds a page-turn animation, and includes sharing, embedding, fullscreen reading, drag-and-drop uploads, and one-click package export.

Live demo: https://kiichi.github.io/flippy-pdf-viewer/

## Features

- Realistic flipbook-style PDF reading experience
- Two-page spread layout with cover-style opening page
- Smooth animated page turns
- Previous/next navigation buttons
- Click-to-turn pages
- Keyboard navigation with left and right arrow keys
- Slider to jump between spreads
- Bookmark the current spread
- Fullscreen reading mode
- Auto-hiding controls in fullscreen
- Open a local PDF from the side panel
- Drag and drop a PDF directly onto the app
- Download the currently loaded PDF
- Native share support when available
- Copyable iframe embed code
- "Download Entire Package" export as a self-contained zip
- Responsive layout for desktop and mobile
- Embedded mode detection for iframe usage

## How It Works

Flippy uses `pdf.js` to render each PDF page onto a canvas, then arranges those canvases into left/right spreads. The first spread behaves like a book cover, and later spreads show two pages at a time with a flipping animation between them.

The app ships as a simple static web project:

- `index.html` contains the UI structure
- `app.js` handles PDF loading, rendering, navigation, sharing, and packaging
- `styles.css` contains the flipbook layout and animations
- `sample.pdf` is the default document loaded on startup

## Getting Started

### 1. Open the project

Clone or download this repository, then move into the project folder.

### 2. Run it from a local web server

Because the app uses ES modules and loads `sample.pdf` with `fetch`, it should be served over HTTP rather than opened directly as a `file://` page.

Examples:

```bash
python3 -m http.server 8000
```

or

```bash
npx serve .
```

Then open:

```text
http://localhost:8000
```

## How To Use

### Open a PDF

You can use Flippy in three ways:

1. Let it load the included `sample.pdf`
2. Click `Open PDF` or `Choose PDF`
3. Drag and drop a `.pdf` file onto the app

Uploading a PDF in Flippy does not upload it to a server. The file stays in your own browser so you can preview and read it locally.

### Navigate

- Click the right page or `▶` to move forward
- Click the left page or `◀` to move backward
- Use the spread slider to jump
- Use `Left Arrow` and `Right Arrow` on your keyboard

### Bookmarks

Click the bookmark button next to fullscreen to save the current spread. Saved bookmarks appear in the side panel, where you can jump back to them or remove them later.

### Fullscreen

Click the fullscreen button to enter immersive reading mode. In fullscreen, the controls appear near the bottom and hide automatically until you move the pointer near the lower edge.

### Download

From the side panel, you can:

- Download the currently loaded PDF
- Download the entire web app as a zip package

### Share

Use the `Share` button to:

- Open the native browser share sheet when supported
- Fall back to copying the current page URL when native sharing is unavailable

### Embed

The side panel includes a ready-to-copy iframe snippet so you can embed the viewer in another page.

Example:

```html
<iframe
  src="https://kiichi.github.io/flippy-pdf-viewer/"
  title="Flippy viewer for sample.pdf"
  width="960"
  height="640"
  style="border:0;"
  loading="lazy"
  allow="fullscreen"
></iframe>
```

Deployed embed example page:

```text
https://kiichit.neocities.org/test
```

## Download Entire Package

`Download Entire Package` creates a zip that includes:

- `README.md`
- `index.html`
- `app.js`
- `styles.css`
- The currently loaded PDF

When the packaged zip is created, Flippy rewrites the default PDF path inside `app.js` so the exported app opens that PDF immediately. That package is ready to upload to your own website and share with others.

## Create And Publish Your Own Flip Book

You can turn any PDF into your own hosted flip book directly from the web app. The PDF upload happens only in your local browser, but `Download Entire Package` gives you a publishable version of the app that you can host anywhere.

1. Open Flippy in your browser
2. Upload your PDF
3. Click `Download Entire Package`
4. Unzip the downloaded package
5. Upload the extracted files to Neocities

Once uploaded, your site will open with your PDF as the default flip book.

## Customization

The main app options live near the top of [`app.js`](/Users/kiichitakeuchi/work/web/prj/flip-book-pdf/app.js):

- `pdfPath`: default PDF loaded on startup
- `renderScale`: PDF render resolution
- `keyboardNavigation`: enable or disable arrow-key navigation
- `blankLabel`: label used for empty pages
- `flipDuration`: page-turn animation timing
- `perspective`: 3D flip depth
- `controlsRevealZone`: pointer zone for showing controls in fullscreen
- `controlsRevealDelay`: delay before fullscreen controls hide again

To use a different default PDF, replace `sample.pdf` and update `pdfPath` if needed.

## Tech Stack

- Vanilla HTML, CSS, and JavaScript
- [`pdf.js`](https://mozilla.github.io/pdf.js/) for PDF rendering
- [`JSZip`](https://stuk.github.io/jszip/) for package export

Both libraries are loaded from CDN, so there is no build step required.

## Notes

- The app is designed as a static site with no backend
- The default document is loaded with `fetch`, so local server hosting is recommended
- Sharing and clipboard behavior depend on browser support
- Fullscreen behavior may vary slightly across browsers

## Project Structure

```text
.
├── app.js
├── index.html
├── styles.css
├── sample.pdf
└── README.md
```
