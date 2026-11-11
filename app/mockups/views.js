/* VIEWS registry + placeholder. Every app now has its own schema-aligned file (views-<app>.js) that assigns window.VIEWS.<appId> after this file loads.
   The old unaligned Messages, Support and Campaigns mocks were removed when modules 12, 13 and 11 were built. */
(function () {
  const I = (n, s) => LQ.icon(n, s);

  /* ================= placeholder for apps not yet mocked =================
     @note Apps without a design yet (none left except Home when views-home.js is not loaded).
           Do NOT implement from this placeholder: wait for the mockup (which will follow the schema-first rule). */
  function placeholder(app) {
    return '<div class="page"><div class="page-head"><div><h1>' + app.panel.title + '</h1><p>Mockup not built yet</p></div><button class="btn primary">' + I("plus", 14) + " " + app.newLabel + '</button></div>' +
      '<div class="panel" style="padding:48px;text-align:center;border-style:dashed;background:transparent"><div style="color:var(--mute);margin-bottom:6px">' + I(app.icon, 28) + '</div><b style="color:var(--ink)">' + app.label + '</b><p style="color:var(--ash);margin-top:4px">This app gets its own layout, like Tasks, Messages and Support. Sections: ' +
      app.panel.blocks[0].items.map((i) => i.l).join(" · ") + ".</p></div></div>";
  }

  window.VIEWS = { placeholder: placeholder };
})();
