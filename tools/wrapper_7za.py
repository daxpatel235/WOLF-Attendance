# 7za wrapper — lets electron-builder extract winCodeSign without symlink
# privilege by skipping the unused macOS "darwin" symlink files on extraction.
# Build:  pyinstaller --onefile --console --name 7za wrapper_7za.py
# Then place the built 7za.exe at node_modules/7zip-bin/win/x64/7za.exe
# (rename the original there to _7za-real.exe first).
import sys, os, subprocess

exe_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
real = os.path.join(exe_dir, "_7za-real.exe")
args = sys.argv[1:]
cmd = [real] + args
if any(a == "x" for a in args):       # extract command -> skip mac symlinks
    cmd.append("-xr!darwin")
sys.exit(subprocess.call(cmd))
