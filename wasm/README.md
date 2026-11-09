# C / WebAssembly integration

`../daa_project1.c` (in the parent DAA project directory) is the source of truth for both scheduling algorithms. The browser exports reuse its existing `greedy_select`, `weighted_select`, and `sum_weight` functions; the JavaScript adapter only marshals session data and reads the C results. The native CLI retains its 100-session capacity. The browser accepts at most 10 sessions with importance from 1 to 10.

The generated Emscripten files belong in `public/wasm/study_planner.js` and `public/wasm/study_planner.wasm`. The schedule buttons load this module and call its C exports using Emscripten's `ccall`. The module files are present in this checkout; if they are missing or you change the C implementation, regenerate them using the steps below.

## Install and activate Emscripten on Windows

Install Git for Windows if needed, then open **Command Prompt** and run:

```bat
git clone https://github.com/emscripten-core/emsdk.git C:\emsdk
cd /d C:\emsdk
emsdk.bat install latest
emsdk.bat activate latest
emsdk_env.bat
emcc --version
```

Keep that Command Prompt open: `emsdk_env.bat` configures `PATH` for that terminal session. In the same window, change to this web app directory and compile the original C source:

```bat
cd /d <path-to-AP25110070113_DAA>\study-planner-web
if not exist public\wasm mkdir public\wasm
emcc ..\daa_project1.c -O2 -DSTUDY_PLANNER_WASM -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORT_NAME=createPlannerModule -s EXPORTED_RUNTIME_METHODS=ccall -s EXPORTED_FUNCTIONS=_planner_reset,_planner_add_session,_planner_greedy_compute,_planner_greedy_id_at,_planner_greedy_importance,_planner_weighted_compute,_planner_weighted_id_at,_planner_weighted_importance -s ENVIRONMENT=web -o public\wasm\study_planner.js
```

The compile creates both `study_planner.js` and `study_planner.wasm`. Verify that both files exist, then run `npm run build` from the web app directory. Do not substitute JavaScript scheduling code for these generated C/WASM outputs.

## Native regression test

Run this from the web app directory with GCC on `PATH`:

```bat
gcc -std=c99 -Wall -Wextra wasm\planner_native_test.c -o planner_native_test.exe
planner_native_test.exe
```

The regression data covers the five demo activities. Greedy must select four compatible sessions for 11 points; Weighted DP must select two sessions for 15 points.