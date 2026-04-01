# Voyager — Product Journey Context Extractor

A Chrome extension that turns manual exploration of a SaaS product into a structured Markdown report describing its screens, flows, UI patterns, visual design system, and interaction model.

Built for founders, developers, PMs, and designers who study competitor or reference products and want structured context they can use for PRDs, technical specs, UX critiques, or LLM prompts.

## What It Does

1. **Record** — Open any web app, start recording, and explore it manually
2. **Capture** — The extension observes navigation, clicks, modals, state changes, and visual styles
3. **Generate** — Stop recording and get a structured Markdown report with:
   - Navigation structure
   - Visual design system (colors, typography, buttons, inputs, spacing, animations)
   - Journey steps and screen breakdown
   - UI patterns detected
   - Event summary
   - LLM-ready context block

## Example Output

A 2-minute exploration of a SaaS dashboard produces a ~1000-line report with sections like:

```markdown
## Visual Design System

### Color Palette
| Role | Color | Usage |
|------|-------|-------|
| background | `#000000` | body |
| button-primary | `#006aff` | primary button |
| success | `#29a383` | success state |

### Button Styles
**Save** (primary)
- Background: `#006aff`, Text: `#ffffff`
- Border radius: 6px, Padding: 8px 16px
- Has hover effect

### Animations & Transitions
| Element | Type | Property | Duration | Easing |
|---------|------|----------|----------|--------|
| button | transition | background-color, color | 0.15s | ease |
```

## Install

### Option 1: From GitHub Releases (recommended)

1. Go to [Releases](https://github.com/h3mantD/voyager/releases)
2. Download `voyager-chrome-mv3.zip` from the latest release
3. Unzip the downloaded file
4. Open `chrome://extensions` in Chrome
5. Enable **Developer mode** (toggle in top-right)
6. Click **Load unpacked** and select the unzipped folder

### Option 2: Build from Source

```bash
# Clone the repo
git clone https://github.com/h3mantD/voyager.git
cd voyager

# Install dependencies
pnpm install

# Build for Chrome
pnpm build

# The extension is in .output/chrome-mv3/
```

Then load `.output/chrome-mv3` as an unpacked extension in `chrome://extensions`.

### Option 3: Chrome Web Store

Not available yet. Use Option 1 or 2 for now.

## Usage

1. Navigate to any web app you want to analyze
2. Click the Voyager extension icon to open the side panel
3. Enter a session name (e.g., "Stripe checkout flow")
4. Click **Start Recording**
5. Explore the product — click through pages, open modals, fill forms
6. Add quick notes during recording for anything notable
7. Click **Stop Recording**
8. Click **Generate Report**
9. **Copy Markdown** or **Download .md**

### Viewing Past Sessions

Click **View Past Sessions** on the idle screen to see all previous recordings. You can view their events, download reports, or delete them.

## Privacy

Voyager is designed to be privacy-safe:

- **Never captures** input values, passwords, or typed text
- **Redacts** sensitive URL parameters (tokens, API keys, OAuth codes)
- **Skips** password fields and sensitive inputs entirely
- **Does not embed** screenshots in exported reports (stored locally only)
- **Detects** modals containing API keys/secrets and sanitizes their labels
- **No network calls** — all data stays in your browser's local IndexedDB
- **No analytics or telemetry**

## Development

```bash
# Start dev mode with HMR
pnpm dev

# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Type check
pnpm typecheck

# Production build
pnpm build
```

### Project Structure

```
src/
  entrypoints/
    background/          # Service worker: session lifecycle, screenshots, messages
    content/             # Content script: DOM observers + extractors
      observers/         # Navigation, interaction, mutation, modal observers
      extractors/        # Labels, screen state, UI patterns, visual styles, nav structure
    sidepanel/           # React UI: recording controls, timeline, report, history
      components/
      hooks/
  lib/
    types.ts             # Shared TypeScript types
    constants.ts         # Thresholds, selectors, pattern names
    privacy.ts           # URL sanitization, sensitive element detection
    storage/             # IndexedDB via idb
    markdown/            # Report generator
```

### Tech Stack

- [WXT](https://wxt.dev/) — Chrome extension framework (Vite-powered, auto-manifest)
- React 19 + TypeScript
- Tailwind CSS v4
- IndexedDB via [idb](https://github.com/jakearchibald/idb)
- [Vitest](https://vitest.dev/) for testing

## How It Works

```
[Side Panel]                    [Background SW]                [Content Script]
     |                                |                              |
     |-- START_RECORDING ------------>|                              |
     |                                |-- inject + START_RECORDING ->|
     |                                |                              |-- observe DOM
     |                                |                              |-- detect clicks
     |                                |                              |-- detect navigations
     |                                |                              |-- detect modals
     |                                |                              |-- extract visual styles
     |                                |<-- CAPTURE_EVENT ------------|
     |<-- CAPTURE_EVENT (forward) ----|                              |
     |   (live timeline)              |<-- CAPTURE_STATE ------------|
     |                                |   (screen state + styles)    |
     |                                |<-- REQUEST_SCREENSHOT -------|
     |                                |   (captureVisibleTab)        |
     |                                |                              |
     |-- STOP_RECORDING ------------->|-- STOP_RECORDING ----------->|
     |-- GENERATE_REPORT ------------>|                              |
     |                                |-- read IndexedDB             |
     |                                |-- deduplicate events         |
     |                                |-- group into screens         |
     |                                |-- merge visual styles        |
     |                                |-- generate Markdown          |
     |<-- REPORT_GENERATED -----------|                              |
```

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run `pnpm typecheck && pnpm test` to verify
5. Commit and push
6. Open a PR

## License

MIT
