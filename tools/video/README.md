# Tutorial video

Rebuilds `Jetty_Letters_How_To.mp4`, a narrated walkthrough of the app in phone format (1080×1920).

Needs Google Chrome, macOS `say` (voice "Daniel"), and Python with `websocket-client`, `pillow`, `numpy` and `imageio-ffmpeg`:
```bash
python3 -m venv .venv && .venv/bin/pip install websocket-client pillow numpy imageio-ffmpeg
python3 -m http.server 8765 &        # serve the app from the project root
.venv/bin/python tools/video/capture.py   # screenshots via headless Chrome
.venv/bin/python tools/video/build.py     # narration + video
```
Edit the narration and captions in `SCENES` in `build.py`.
