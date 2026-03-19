# Flippy

Flippy is a lightweight PDF flipbook viewer and builder for the web. It renders PDF pages into a two-page book layout, adds a page-turn animation, and lets you open your own PDF, edit page order, remove pages, add bookmarks, and re-export the result as a shareable package or single HTML file.

Live demo: https://kiichi.github.io/flippy-pdf-viewer/

Version: `v0.2.0`

## Features

- Realistic flipbook-style PDF reading experience
- Two-page spread layout with cover-style opening page
- Smooth animated page turns
- Previous/next navigation buttons
- Click-to-turn pages
- Keyboard navigation with left and right arrow keys
- Slider to jump between spreads
- Bookmark the current spread
- Rename bookmarks and add short bookmark notes
- Resume the last opened spread when reopening the same PDF
- Fullscreen reading mode
- Auto-hiding controls in fullscreen
- Open a local PDF from the side panel
- Drag and drop a PDF directly onto the app
- Edit pages in a thumbnail grid with reordering, delete, undo, and redo
- Download the currently loaded PDF
- Native share support when available
- Copyable iframe embed code
- `Single File (HTML)` export
- `Project Folder (Zip)` export
- Optional bookmark inclusion during export
- Optional read-only mode that hides builder tools and disables drag-and-drop uploads
- Responsive layout for desktop and mobile
- Embedded mode detection for iframe usage

## How To Use

### Open a PDF

You can use Flippy in three ways:

1. Let it load the included `sample.pdf`
2. Click `Open PDF` or `Choose PDF`
3. Drag and drop a `.pdf` file onto the app

Uploading a PDF in Flippy does not upload it to a server. The file stays in your own browser so you can preview and read it locally.

### Create Your Own Flipbook

Use the `Create Your Own Flipbook` section in the side panel to:

- Open a different PDF
- Reorder or delete pages with `Edit Pages`
- Download the entire app package
- Reset saved local state

### Navigate

- Click the right page or `▶` to move forward
- Click the left page or `◀` to move backward
- Use the spread slider to jump
- Use `Left Arrow` and `Right Arrow` on your keyboard

### Bookmarks

Click the bookmark button next to fullscreen to save the current spread. Saved bookmarks appear in the side panel, where you can:

- Jump back to a saved spread
- Edit the bookmark name
- Add a short note below the bookmark title
- Remove the bookmark later

Flippy also remembers bookmarks for the same PDF source and restores them when that PDF is reopened.

### Edit Pages

Use `Edit Pages` in the builder section to open a page editor with thumbnails.

Inside the editor you can:

- Drag pages to reorder them
- Select one or many pages
- Delete selected pages
- Use `Undo` and `Redo` before applying changes

Selection supports:

- Click to select a page
- `Shift` + click to select a range
- `Ctrl` + click or `Cmd` + click to toggle pages
- `Delete` or `Backspace` to remove selected pages

### Fullscreen

Click the fullscreen button to enter immersive reading mode. In fullscreen, the controls appear near the bottom and hide automatically until you move the pointer near the lower edge.

### Download

From the side panel, you can:

- Download the currently loaded PDF
- Download the entire web app as a zip package

### Share

Use the `Share` button to:

- Copy the current page URL
- Open the native browser share sheet when supported
- Copy an iframe embed snippet that uses the embed URL

### Embed

The share dialog includes a ready-to-copy iframe snippet so you can embed the viewer in another page.

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

## Export

`Download Entire Package` opens an export dialog with:

- `Single File (HTML)`
- `Project Folder (Zip)`
- `Read-Only` or `Full Features`
- Optional `Include bookmarks`

Export modes:

- `Full Features`: keeps upload tools, drag and drop, reset, and page editing available
- `Read-Only`: hides the builder section and disables uploads, drag and drop, and editing tools

The zip export includes:

- `README.md`
- `index.html`
- `app.js`
- `styles.css`
- The currently loaded PDF

When a package is created, Flippy rewrites the default PDF path inside `app.js` so the exported app opens that PDF immediately. The single-file export inlines the app and the current PDF into one HTML file.

Both export formats are ready to share on your own website.

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
- `builderTools`: show or hide the `Create Your Own Flipbook` section and disable or allow uploads and drag and drop
- `renderScale`: PDF render resolution
- `keyboardNavigation`: enable or disable arrow-key navigation
- `blankLabel`: label used for empty pages
- `flipDuration`: page-turn animation timing
- `perspective`: 3D flip depth
- `controlsRevealZone`: pointer zone for showing controls in fullscreen
- `controlsRevealDelay`: delay before fullscreen controls hide again

To use a different default PDF, replace `sample.pdf` and update `pdfPath` if needed.

To turn Flippy into a read-only viewer, set `builderTools` to `false` in [`app.js`](/Users/kiichitakeuchi/work/web/prj/flip-book-pdf/app.js). That hides the builder section, disables drag and drop, and prevents users from opening a different local PDF.

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
- Large local PDFs may only be remembered temporarily depending on browser storage limits

## Project Structure

```text
.
├── app.js
├── index.html
├── styles.css
├── sample.pdf
└── README.md
```
