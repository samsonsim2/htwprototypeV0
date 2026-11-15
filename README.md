<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/33567f55-1097-4bef-8626-a7225521ef85

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
# htwprototypeV0

## Live bus 166 arrivals

Set `LTA_ACCOUNT_KEY` in `.env.local` (local use) or the server environment. This secret is read only by the server. Both boarding stops show the next double-decker towards Clementi: Ang Mo Kio Interchange (54009) and Mt Alvernia Hospital (51069). The display checks all three buses supplied by LTA, refreshes every 20 seconds while visible, and reports when no double-decker is listed or live data is unavailable.

Development: `npm run dev`. Production: `npm run build` followed by `npm start`. `npm run preview` also supports the arrivals endpoint. A static-only deployment needs a separate backend for `/api/bus-arrivals`; uploading `dist` alone does not provide live arrivals.

### Vercel

The `api/bus-arrivals.ts` function provides the arrivals backend on Vercel, using the same handler as local development. In the Vercel project's Settings → Environment Variables, add `LTA_ACCOUNT_KEY` for Production (and Preview if needed), then redeploy. Keep the Vite build command (`npm run build`) and output directory (`dist`); no start command is needed on Vercel. Do not expose the key through a `VITE_` variable. To check the deployment, open `/api/bus-arrivals?stop=54009`: it should return JSON with `estimatedArrival` and `updatedAt`. A 503 means the server environment variable is missing; a 502 means the LTA request failed.

## AR encounters (prototype)

## Audio transition preview

Open the top FADE button after starting the journey. Play a stop and use “Crossfade to next stop” to hear the same transition used by GPS. The graph shows outgoing (orange) and incoming (green) volume with a moving playhead. Duration (2–40 seconds), curve and shape are adjustable; the default is an 18-second smooth S-curve. Settings are saved on this browser/device and apply to subsequent transitions. Reset restores the default. Toggle FADE or use its close button to hide the controls; “Stop preview / resume GPS” stops preview and resumes GPS triggers. Restart or Exit cancels a preview. Run `npx tsx --test scripts/validate-fade.test.ts` for curve checks.

## AR encounters (prototype)

- Stop 1: two procedural animated mynas. Stop 1b: a procedural pink bun on a leaf. Stop 6 / Opp Blk 244: a ground-placed rubber tree with a tapping cut, latex drops and a filling collection cup. Tap its trunk or use “Tap the tree”.
- Stop 4 / Blk 209: a MediaPipe hand camera filter. Show one open palm for a tomato, then turn the hand over to grow red hair. The effects are illustrated camera overlays attached to tracked landmarks, with side stabilization and matching camera cropping; they are not ground-placed objects. Use the rear camera in good light with the whole hand visible.
- While any of these tracks is active (including Debug audio preview), use the black capsule above the audio player to open its camera experience. The same audio element continues playing; GPS track switching is held until AR closes. Subtitles and audio pause/resume remain available in the camera view.
- The capsule immediately requests a ground-tracked WebXR session in its original click; there is no separate tracking choice. An animated phone guide asks the visitor to move gently over the ground. Placement appears only after a horizontal hit is detected; tracking loss hides objects and restores guidance. Reposition and rotate are available; object sizes are fixed.
- There is no manual or camera-free placement mode. Unsupported devices and permission failures show an explanation and a retry/back option. No objects can be placed without a real tracked hit.
- Ground placement requires WebXR in a secure context: use HTTPS on a supported Android phone. Desktop localhost is accepted, but `http://192.168...:3000` on another device is not. The hand filter uses a regular camera stream and a worker, so does not require WebXR; it still requires HTTPS and camera permission.
- Three.js is loaded only for ground AR. The hand filter lazily loads MediaPipe Tasks Vision 1.1.1, the local WASM runtime and Google hand-landmarker model from `public/mediapipe/`. These add a first-use download (about 21 MB for model + selected runtime) only when opening the hand filter. No paid inference API is used. Do not remove those assets from deployments.
- No camera recordings, microphone requests or camera uploads are made. Closing ground AR ends XR and disposes the renderer; closing hand AR terminates the worker and stops camera tracks, including a late permission response. Ground models are procedural prototypes; hand effects are drawn on a canvas.
- Vite's cache lives in the OS temporary directory to avoid Dropbox cache-file locks.

### Device checks before release

Test on a supported Android WebXR phone over HTTPS: single-capsule startup, permission grant/denial, horizontal hit testing, moving around a placed object, tracking loss, repositioning, native XR exit and camera cleanup. Check the unavailable message on unsupported browsers. Verify that the same audio track/time and subtitles continue when entering/exiting AR, including while using Debug audio preview. Run `npm run test:ar` for lifecycle and placement guards; these mocked tests do not validate physical ground tracking.

For Blk 209, also check both hands, palm/back switching, edge-on poses, loss/recovery of hand tracking, portrait/landscape alignment, camera denial, closing during permission/model loading and repeated reopening. Hand orientation is a landmark/handedness estimate and can be less reliable with curled fingers, occlusion or poor lighting. The worker/model were exercised with Google's sample photos; physical phone testing remains necessary.
