/* =========================================================
   DYNAMIC DASHBOARD EXTENSION – FIXED FOR REAL WORKSPACE
   Compatible with build.html + state-client.js
========================================================= */

(function () {

  /* ---------- HELPERS ---------- */

  function getWS() {
    return window.wsActive || window.__WS__ || null;
  }

  function getState() {
    const ws = getWS();
    if (!ws) return null;
    ws.state = ws.state || {};
    ws.state.dynamic = ws.state.dynamic || { sections: {} };
    return ws.state.dynamic;
  }

  function save() {
    if (typeof window.wsSaveCurrentWorkspace === "function") {
      wsSaveCurrentWorkspace();
    }
  }

  function me() {
    return window.twMe || { role: "viewer", userId: "unknown" };
  }

  function isAdmin() {
    return me().role === "admin";
  }

  function canEdit(obj) {
    if (isAdmin()) return true;
    if (obj.locked) return false;
    return obj.createdBy === me().userId;
  }

  /* ---------- SECTION CRUD ---------- */

  window.addDynamicSection = function (type) {
    const state = getState();
    if (!state) return alert("Workspace not ready");

    const id = "dyn_sec_" + Date.now();
    state.sections[id] = {
      id,
      type,
      title: type,
      createdBy: me().userId,
      locked: false,
      tiles: {}
    };

    save();
    render();
  };

  window.toggleDynamicSectionLock = function (id) {
    if (!isAdmin()) return;
    const state = getState();
    state.sections[id].locked = !state.sections[id].locked;
    save();
    render();
  };

  /* ---------- TILE CRUD ---------- */

  window.addDynamicTile = function (secId, type) {
    const state = getState();
    const tileId = "tile_" + Date.now();

    state.sections[secId].tiles[tileId] = {
      id: tileId,
      type,
      title: type + " Title",
      value: "",
      createdBy: me().userId,
      locked: false
    };

    save();
    render();
  };

  /* ---------- RENDER ---------- */

  function render() {
    const host = document.getElementById("dynamic-section-host");
    if (!host) return;

    const state = getState();
    if (!state) return;

    host.innerHTML = "";

    Object.values(state.sections).forEach(sec => {
      const el = document.createElement("div");
      el.className = "bg-white border rounded-xl p-4 mb-4";

      el.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-lg font-semibold"
              contenteditable="${canEdit(sec)}"
              onblur="wsActive.state.dynamic.sections['${sec.id}'].title=this.innerText;wsSaveCurrentWorkspace()">
            ${sec.title}
          </h3>

          ${isAdmin() ? `
            <button class="text-xs px-2 py-1 border rounded"
              onclick="toggleDynamicSectionLock('${sec.id}')">
              ${sec.locked ? "Unlock" : "Lock"}
            </button>` : ""}
        </div>

        <div class="flex gap-2 mb-3">
          <button class="text-xs bg-indigo-600 text-white px-2 py-1 rounded"
            onclick="addDynamicTile('${sec.id}','Text')">+ Text</button>

          <button class="text-xs bg-indigo-600 text-white px-2 py-1 rounded"
            onclick="addDynamicTile('${sec.id}','Number')">+ Number</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${Object.values(sec.tiles).map(t => `
            <div class="border rounded-lg p-3">
              <h4 class="text-sm font-medium"
                  contenteditable="${canEdit(t)}"
                  onblur="wsActive.state.dynamic.sections['${sec.id}'].tiles['${t.id}'].title=this.innerText;wsSaveCurrentWorkspace()">
                ${t.title}
              </h4>

              <div class="text-sm text-slate-600 mt-1"
                   contenteditable="${canEdit(t)}"
                   onblur="wsActive.state.dynamic.sections['${sec.id}'].tiles['${t.id}'].value=this.innerText;wsSaveCurrentWorkspace()">
                ${t.value || "Edit content"}
              </div>
            </div>
          `).join("")}
        </div>
      `;

      host.appendChild(el);
    });
  }

  /* ---------- INIT ---------- */

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(render, 500); // wait for workspace to load
  });

})();
