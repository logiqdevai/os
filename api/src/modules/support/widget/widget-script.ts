/**
 * Source of the embeddable chat widget served at GET /support/widget/:key.js (13 §1, §5).
 * It contains only the API base URL and the public embed key — never a secret. The visitor's conversation
 * token lives in the visitor's own localStorage. Rendered in a Shadow DOM so the host page's CSS cannot leak in.
 * Live updates: Socket.IO namespace `/support` (client loaded from the official CDN); polling fallback every 5 s,
 * plus a 30 s safety refresh. Typing indicator both ways over the same socket. Outside the channel's office hours the
 * first message becomes a "we'll reply by email" form (email required). AI answers carry an "AI assistant" label.
 */
export function buildWidgetScript(apiBase: string, key: string): string {
    const cfg = JSON.stringify({ api: apiBase.replace(/\/+$/, ''), key });
    return `/* Logiqdev OS chat widget */
(function () {
  "use strict";
  var CFG = ${cfg};
  if (window.__lqWidgetLoaded && window.__lqWidgetLoaded[CFG.key]) return;
  window.__lqWidgetLoaded = window.__lqWidgetLoaded || {};
  window.__lqWidgetLoaded[CFG.key] = true;

  // Use the origin this script was loaded from (works behind any proxy prefix and locally); fall back to the configured API URL.
  var SRC = document.currentScript && document.currentScript.src ? document.currentScript.src : "";
  var API = SRC.indexOf("/support/widget/") > 0 ? SRC.slice(0, SRC.indexOf("/support/widget/")) : CFG.api;
  var BASE = API + "/support/widget/" + encodeURIComponent(CFG.key);
  var STORE = "lq_widget_" + CFG.key;
  var state = { open: false, config: null, token: null, messages: [], status: "OPEN", sending: false, error: "", socket: null, poll: null, unread: 0, typing: null, typingTimer: null, lastTyping: 0, replyByEmail: false };
  try { state.token = localStorage.getItem(STORE); } catch (e) {}

  function api(method, path, body) {
    var headers = { "Content-Type": "application/json" };
    if (state.token) headers["X-Widget-Token"] = state.token;
    return fetch(BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, credentials: "omit" })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) { var err = new Error((data && data.message) || "Something went wrong"); err.status = r.status; err.code = data && data.code; throw err; }
          return data;
        });
      });
  }
  // The agent's profile photo (or their first letter) next to the name on human replies.
  function agentAvatar(m) {
    if (m.is_ai) return "";
    if (m.author_photo_url && /^https?:\\/\\//i.test(m.author_photo_url)) return "<img class='av' alt='' src='" + esc(m.author_photo_url) + "'>";
    return "<span class='av avi' aria-hidden='true'>" + esc(String(m.author_name || "S").charAt(0).toUpperCase()) + "</span>";
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function linkify(s) { return s.replace(/(https?:\\/\\/[^\\s<&]+[^\\s<&.,;:!?)])/g, function (u) { return "<a href='" + u + "' target='_blank' rel='noopener noreferrer'>" + u + "</a>"; }); }
  function time(iso) { try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

  var host = document.createElement("div");
  host.id = "lq-chat-widget";
  host.style.cssText = "position:fixed;bottom:20px;z-index:2147483000;";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  document.body.appendChild(host);

  function css(color) {
    return ":host{all:initial}" +
      "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
      ".wrap{--c:" + color + ";--bg:#ffffff;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--bubble:#f1f5f9}" +
      "@media (prefers-color-scheme:dark){.wrap{--bg:#0f172a;--fg:#f1f5f9;--muted:#94a3b8;--line:#1e293b;--bubble:#1e293b}}" +
      ".btn{width:56px;height:56px;border-radius:50%;border:0;background:var(--c);color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;position:relative}" +
      ".btn:focus-visible{outline:3px solid var(--fg);outline-offset:2px}" +
      ".badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;border-radius:10px;background:#dc2626;color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 5px}" +
      ".panel{position:absolute;bottom:72px;width:min(370px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden}" +
      ".head{background:var(--c);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}" +
      ".head img{width:28px;height:28px;border-radius:6px;background:#fff;object-fit:contain}" +
      ".head b{font-size:15px;display:block}.head span{font-size:12px;opacity:.85}" +
      ".x{margin-left:auto;background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;padding:4px}" +
      ".body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;font-size:14px}" +
      ".m{max-width:82%;padding:8px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word;line-height:1.4}" +
      ".m small{display:block;font-size:11px;opacity:.7;margin-top:3px}" +
      ".av{width:16px;height:16px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:5px;display:inline-block}" +
      ".avi{background:var(--line);color:var(--fg);font-size:9px;line-height:16px;text-align:center;font-weight:600}" +
      ".team{align-self:flex-start;background:var(--bubble);color:var(--fg);border-bottom-left-radius:4px}" +
      ".visitor{align-self:flex-end;background:var(--c);color:#fff;border-bottom-right-radius:4px}" +
      ".note{font-size:12px;color:var(--muted);text-align:center;padding:4px}" +
      ".foot{border-top:1px solid var(--line);padding:10px;display:flex;flex-direction:column;gap:8px}" +
      "input,textarea{width:100%;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:10px;padding:9px 11px;font-size:14px;resize:none}" +
      "input:focus,textarea:focus{outline:2px solid var(--c);outline-offset:0;border-color:transparent}" +
      ".row{display:flex;gap:8px;align-items:flex-end}" +
      ".send{background:var(--c);color:#fff;border:0;border-radius:10px;padding:9px 14px;font-size:14px;font-weight:600;cursor:pointer}" +
      ".send[disabled]{opacity:.6;cursor:default}" +
      ".err{color:#dc2626;font-size:12px}" +
      ".m a{color:inherit;text-decoration:underline;word-break:break-all}" +
      ".ai{display:inline-block;font-size:10px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;border:1px solid var(--line);border-radius:6px;padding:0 5px;margin-right:4px}" +
      ".notice{font-size:12px;color:var(--muted);background:var(--bubble);border-radius:10px;padding:8px 10px}" +
      ".typing{font-size:12px;color:var(--muted);min-height:16px;padding:0 14px 4px}" +
      ".dot{display:inline-block;width:5px;height:5px;margin-left:2px;border-radius:50%;background:var(--muted);animation:lqb 1.2s infinite}" +
      ".dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}" +
      "@keyframes lqb{0%,80%,100%{opacity:.3}40%{opacity:1}}" +
      "@media (prefers-reduced-motion:reduce){.dot{animation:none}}";
  }

  function render() {
    var c = state.config;
    if (!c) return;
    host.style.right = c.position === "left" ? "" : "20px";
    host.style.left = c.position === "left" ? "20px" : "";
    var h = "<style>" + css(c.color) + "</style><div class='wrap'>";
    if (state.open) {
      h += "<div class='panel' role='dialog' aria-label='" + esc(c.title) + "' style='" + (c.position === "left" ? "left:0" : "right:0") + "'>";
      h += "<div class='head'>" + (c.organization.logo_url ? "<img alt='' src='" + esc(c.organization.logo_url) + "'>" : "") +
        "<div><b>" + esc(c.title) + "</b><span>" + (offline() ? "Offline · we reply by email" : state.socket && state.socket.connected ? "Online" : "We will reply here") + "</span></div>" +
        "<button class='x' aria-label='Close chat' data-act='close'>&times;</button></div>";
      h += "<div class='body' id='lq-body'><div class='m team'>" + esc(c.welcome_message) + "</div>";
      if (!state.token && offline()) h += "<div class='notice' role='status'>" + esc(c.office_hours.offline_message) + "</div>";
      if (c.ai_assistant && c.ai_assistant.enabled && !state.messages.length) h += "<div class='notice'>An AI assistant may answer first using our help articles. " + esc("Reply 'human' at any time to talk to a person.") + "</div>";
      state.messages.forEach(function (m) {
        h += "<div class='m " + (m.from === "visitor" ? "visitor" : "team") + "'>" + linkify(esc(m.body)) + "<small>" + (m.from === "team" ? (m.is_ai ? "<span class='ai'>AI</span>" : agentAvatar(m)) + esc(m.author_name) + " · " : "") + time(m.created_at) + "</small></div>";
      });
      if (state.replyByEmail) h += "<div class='note'>Thanks! We are offline right now and will reply by email.</div>";
      if (state.status === "RESOLVED") h += "<div class='note'>This conversation was resolved. Write again to reopen it.</div>";
      h += "</div><div class='typing' id='lq-typing' aria-live='polite'></div><form class='foot' data-act='send'>";
      if (!state.token) {
        h += "<input name='name' placeholder='Your name' autocomplete='name' maxlength='120'>" +
          "<input name='email' type='email' placeholder='Email" + (c.require_email || offline() ? "" : " (optional)") + "' autocomplete='email' " + (c.require_email || offline() ? "required" : "") + " maxlength='254'>";
      }
      h += "<div class='row'><textarea name='body' rows='2' placeholder='Write a message…' aria-label='Message' required maxlength='5000'></textarea>" +
        "<button class='send' type='submit'" + (state.sending ? " disabled" : "") + ">" + (!state.token && offline() ? "Send by email" : "Send") + "</button></div>";
      if (state.error) h += "<div class='err' role='alert'>" + esc(state.error) + "</div>";
      h += "</form></div>";
    }
    h += "<button class='btn' data-act='toggle' aria-label='" + (state.open ? "Close chat" : "Open chat") + "' aria-expanded='" + state.open + "'>" +
      (state.open ? "<svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5'><path d='M18 6 6 18M6 6l12 12'/></svg>"
        : "<svg width='26' height='26' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/></svg>") +
      (state.unread && !state.open ? "<span class='badge'>" + state.unread + "</span>" : "") + "</button></div>";
    var draft = root.querySelector && root.querySelector("textarea");
    var draftValue = draft ? draft.value : "";
    root.innerHTML = h;
    var ta = root.querySelector("textarea");
    if (ta) {
      ta.value = draftValue;
      ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(root.querySelector("form")); } });
      ta.addEventListener("input", sendTyping);
    }
    var body = root.querySelector("#lq-body");
    if (body) body.scrollTop = body.scrollHeight;
    renderTyping();
  }

  function offline() { return !!(state.config && state.config.office_hours && !state.config.office_hours.open); }

  /** Only the typing line is updated, so the visitor's own textarea keeps focus and caret. */
  function renderTyping() {
    var el = root.querySelector && root.querySelector("#lq-typing");
    if (!el) return;
    el.innerHTML = state.typing ? esc(state.typing) + " is typing<span class='dot'></span><span class='dot'></span><span class='dot'></span>" : "";
  }

  function sendTyping() {
    var now = Date.now();
    if (!state.socket || !state.socket.connected || now - state.lastTyping < 2500) return;
    state.lastTyping = now;
    state.socket.emit("typing", { active: true });
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t) return;
    var act = t.getAttribute("data-act");
    if (act === "toggle" || act === "close") {
      state.open = act === "toggle" ? !state.open : false;
      if (state.open) { state.unread = 0; refresh(); }
      render();
      if (state.open) { var ta = root.querySelector("textarea"); if (ta) ta.focus(); }
    }
  });
  root.addEventListener("submit", function (e) { e.preventDefault(); submit(e.target); });

  function submit(form) {
    if (!form || state.sending) return;
    var text = (form.body.value || "").trim();
    if (!text) return;
    state.sending = true; state.error = ""; render();
    var req = state.token
      ? api("POST", "/conversation/messages", { body: text })
      : api("POST", "/conversations", { body: text, name: form.name && form.name.value || undefined, email: form.email && form.email.value || undefined, page_url: location.origin + location.pathname });
    req.then(function (data) {
      if (data.token) { state.token = data.token; state.replyByEmail = !!data.reply_by_email; try { localStorage.setItem(STORE, data.token); } catch (e) {} connect(); }
      state.messages = data.messages || state.messages;
      state.status = data.conversation ? data.conversation.status : state.status;
      var ta = root.querySelector("textarea"); if (ta) ta.value = "";
    }).catch(function (err) {
      if (err.status === 401) { forget(); }
      state.error = err.message;
    }).then(function () { state.sending = false; render(); });
  }

  function forget() {
    state.token = null; state.messages = []; state.status = "OPEN";
    try { localStorage.removeItem(STORE); } catch (e) {}
    if (state.socket) { state.socket.disconnect(); state.socket = null; }
  }

  function refresh() {
    if (!state.token) return;
    var count = state.messages.length;
    api("GET", "/conversation").then(function (data) {
      state.messages = data.messages || [];
      state.status = data.conversation.status;
      var fresh = state.messages.slice(count).filter(function (m) { return m.from === "team"; }).length;
      if (!state.open && fresh) state.unread += fresh;
      render();
    }).catch(function (err) { if (err.status === 401) { forget(); render(); } });
  }

  function startPolling() {
    if (state.poll) clearInterval(state.poll);
    state.poll = setInterval(function () { if (!state.socket || !state.socket.connected) refresh(); }, 5000);
  }

  function connect() {
    if (!state.token || state.socket || typeof window.io !== "function") return;
    state.socket = window.io(API + "/support", { auth: { widget_key: CFG.key, widget_token: state.token }, transports: ["websocket", "polling"] });
    state.socket.on("message.new", refresh);
    state.socket.on("conversation.updated", refresh);
    state.socket.on("typing", function (t) {
      clearTimeout(state.typingTimer);
      state.typing = t && t.active !== false ? (t.from === "ai" ? "AI assistant" : (t.name || "Support")) : null;
      if (state.typing) state.typingTimer = setTimeout(function () { state.typing = null; renderTyping(); }, 8000);
      renderTyping();
    });
    state.socket.on("message.new", function () { state.typing = null; renderTyping(); });
    state.socket.on("connect", render);
    state.socket.on("disconnect", render);
    state.socket.on("error", function () { /* polling keeps the thread fresh */ });
  }

  function loadSocketClient() {
    if (typeof window.io === "function") { connect(); return; }
    var s = document.createElement("script");
    s.src = "https://cdn.socket.io/4.8.1/socket.io.min.js";
    s.crossOrigin = "anonymous";
    s.onload = connect;
    document.head.appendChild(s);
  }

  api("GET", "/config").then(function (c) {
    state.config = c;
    render();
    refresh();
    loadSocketClient();
    startPolling();
    setInterval(refresh, 30000);
  }).catch(function (e) {
    host.remove();
    // Tell the site developer why nothing appeared (wrong key, inactive channel, or this site is not on the allowed list).
    if (window.console && console.warn) console.warn("[Logiqdev chat] The widget could not start: " + ((e && e.message) || "request failed") + (e && e.code ? " (" + e.code + ")" : ""));
  });
})();
`;
}
