# Student Study Planner

React + Vite dashboard for managing study intervals and comparing the existing C implementations of Greedy Activity Selection and Weighted Interval Scheduling.

## Run locally

```sh
npm install
npm run dev
```

Sessions are persisted in browser local storage. Load the sample data from the dashboard to add the demonstration intervals.

## WebAssembly engine

Scheduling runs only in the original C algorithms compiled to WebAssembly; there is no JavaScript scheduling implementation. The generated Emscripten loader and WASM binary are stored in `public/wasm/` and copied into production builds. If either generated module file is missing, the planner and session-management pages still work and the algorithm pages show **Temporary fallback**. Follow [`wasm/README.md`](wasm/README.md) to rebuild the Emscripten outputs from the existing `daa_project1.c`. Use **Generate schedule** or **Run both algorithms** to invoke the C exports. The web planner accepts up to 10 input sessions, each with an importance score from 1 to 10; the original CLI retains its separate 100-session capacity and same 1–10 importance range.

Importance labels are Low (1–3), Medium (4–6), High (7–8), and Critical (9–10). Existing local scores above 10 are migrated from the former 0–100 web scale when the app loads.

The native sample regression test can be run from this directory with:

```sh
gcc -std=c99 -Wall -Wextra wasm/planner_native_test.c -o planner_native_test
./planner_native_test
```