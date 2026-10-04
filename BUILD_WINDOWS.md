# Building the WOLF Attendance `.exe` on Windows

This produces the installer (`…_x64-setup.exe`), the `.msi`, and the raw app
executable. Everything below runs in **PowerShell** or **Command Prompt**.

## 1. Install the tools (one time)

| Tool | Where | Notes |
|---|---|---|
| **Node.js 22 LTS** (22.12 or newer) | https://nodejs.org | Tick "Add to PATH". |
| **Microsoft C++ Build Tools** | https://visualstudio.microsoft.com/visual-cpp-build-tools/ | In the installer select **"Desktop development with C++"** (MSVC + Windows SDK). |
| **Rust (stable, MSVC)** | https://rustup.rs | Run `rustup-init.exe`, accept the defaults (`x86_64-pc-windows-msvc`). |
| WebView2 Runtime | already on Windows 10/11 | Only needed separately on very old installs. |

Open a **new** terminal afterwards and check:

```powershell
node -v      # v22.12.0 or newer
npm -v
rustc -V     # rustc 1.8x or newer
cargo -V
```

> ⚠️ If **Smart App Control** is On, Windows blocks the unsigned build scripts Rust
> compiles (`os error 4551`). Build on a PC/VM with it Off, or use the GitHub Actions
> workflow in `.github/workflows/build.yml`, which builds the installers on
> `windows-latest`.

## 2. Unzip and install dependencies

```powershell
cd path\to\wolf-attendance
npm ci
```

`npm ci` installs exactly the versions in `package-lock.json` (including the Tauri CLI).

## 3. (Optional) run the checks

```powershell
npm run check                      # typecheck + frontend tests + production bundle
cd wolf-core;  cargo test;  cd ..  # planner algorithm tests (~20 s)
cd src-tauri;  cargo test;  cd ..  # app backend tests
```

## 4. Try it before packaging (optional)

```powershell
npm run tauri dev
```

## 5. Build the exe + installers

```powershell
npm run tauri build
```

The first build downloads and compiles the Rust crates and takes several minutes;
later builds are much faster. Output:

```text
src-tauri\target\release\wolf-attendance.exe                                   ← the app itself
src-tauri\target\release\bundle\nsis\WOLF Attendance_3.1.1_x64-setup.exe        ← installer (recommended)
src-tauri\target\release\bundle\msi\WOLF Attendance_3.1.1_x64_en-US.msi         ← MSI installer
```

Ship the **`-setup.exe`**: it installs the app, Start-menu/desktop shortcuts and, if
missing, the WebView2 runtime. The bare `wolf-attendance.exe` also runs on a PC that
already has WebView2.

Only want the NSIS installer (faster, skips WiX)? `npm run tauri build -- --bundles nsis`

## Troubleshooting

- **`link.exe not found` / `MSVC` errors** — the C++ Build Tools ("Desktop development
  with C++") are missing. Install them and reopen the terminal.
- **`'tauri' is not recognized`** — run `npm ci` first; always use `npm run tauri …`.
- **MSI step fails downloading WiX** — the machine is offline or behind a proxy; use
  `--bundles nsis`.
- **Windows SmartScreen warns when installing** — expected for an unsigned app. Click
  *More info → Run anyway*, or code-sign the installer for distribution.
- **Where's my data?** `%APPDATA%\com.wolf.attendance\data.json` (also shown at the
  bottom of Settings). Uninstalling does not delete it.
