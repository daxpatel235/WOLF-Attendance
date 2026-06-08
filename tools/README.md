# tools/ — build helpers

## 7za wrapper (only needed to build the installer on a non-admin Windows account)

electron-builder downloads `winCodeSign`, whose archive contains macOS symlinks.
Extracting them needs symlink-create privilege; a standard Windows user without
Developer Mode can't, so the build fails. `wrapper_7za.py` is a drop-in `7za`
that appends `-xr!darwin` on extraction (skipping those mac-only files — not used
for a Windows build).

### Apply (after a fresh `npm install`)
```bash
pip install pyinstaller
cd tools
pyinstaller --onefile --console --name 7za --distpath out --workpath work --specpath spec wrapper_7za.py

# swap it in (PowerShell or shell):
cd ../node_modules/7zip-bin/win/x64
#   rename the real one, then drop the wrapper in:
mv 7za.exe _7za-real.exe
cp ../../../../tools/out/7za.exe 7za.exe
```
Then `npm run dist` works.

**Alternative (no wrapper needed):** enable **Windows Developer Mode**
(Settings → Privacy & security → For developers) or run the terminal as
Administrator, then `npm run dist` directly.
