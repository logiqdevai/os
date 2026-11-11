/* Shared mockup helpers: icons, theme, avatars. Load in <head> so the theme applies before first paint.
 *
 * @impl MOCK-ONLY FILE. Nothing here ships. Production equivalents:
 *   - Icons: use `lucide-react`. Mapping of the mock icon names below (stroke 1.7px, 16px default -> lucide default 2px is fine):
 *       home=Home  folder=Folder  tasks=SquareCheckBig  users=Users  crm=Briefcase  file=FileText  dollar=DollarSign
 *       mail=Mail  chat=MessageSquare  support=LifeBuoy  clock/time=Clock  calendar=Calendar  bell=Bell  zap=Zap
 *       search=Search  settings=SlidersHorizontal  shield=Shield  sparkles=Sparkles  down/right/left/up=Chevron*
 *       plus=Plus  panel/panelr=PanelLeft/PanelRight  menu=Menu  star=Star  x=X  check=Check  layers=Layers
 *       receipt=Receipt  people=UserPlus  pen=PenLine  globe=Globe  book=BookOpen  grid=LayoutGrid  more=MoreHorizontal
 *       pin=Pin  inbox=Inbox  filter=Filter  send=Send  hash=Hash  box=Archive/Box  help=CircleHelp  at=AtSign
 *       smile=Smile  clip=Paperclip  phone=Phone  tag=Tag  link=Link  lock=Lock  sun=Sun  moon=Moon  reply=Reply
 *       archive=Archive  flag=Flag  bot=Bot  chart=LineChart  sms=MessageSquareText  video=Video  edit=SquarePen
 *       plug=Plug  sort=ArrowUpDown  snooze=AlarmClock  bold=Bold  list=List  key=KeyRound  minus=Minus  building=Building2
 *   - Theme: production uses the app's theme provider (next-themes / shadcn). The mock default is DARK (DESIGN.MD is
 *     dark-first); persist the user's choice in `UserPreference.theme` (string) so it follows them across devices.
 *   - Avatar: shadcn `Avatar` with `AvatarImage` (User.profile_photo_url) and an initials `AvatarFallback`.
 */
(function () {
  const P = {
    home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    folder: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    tasks: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    crm: "M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2",
    file: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5",
    dollar: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    mail: "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM22 6l-10 7L2 6",
    chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    support: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.9 4.9l4.3 4.3M14.8 14.8l4.3 4.3M14.8 9.2l4.3-4.3M4.9 19.1l4.3-4.3",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
    calendar: "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
    zap: "M13 2 3 14h9l-1 8 10-12h-9z",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
    settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    sparkles: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z",
    down: "M6 9l6 6 6-6", right: "M9 6l6 6-6 6", left: "M15 6l-6 6 6 6", up: "M18 15l-6-6-6 6",
    plus: "M12 5v14M5 12h14",
    panel: "M3 4h18v16H3zM9 4v16", panelr: "M3 4h18v16H3zM15 4v16",
    menu: "M3 6h18M3 12h18M3 18h18",
    star: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z",
    x: "M18 6 6 18M6 6l12 12",
    check: "M20 6 9 17l-5-5",
    layers: "M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    receipt: "M4 2v20l3-2 2 2 3-2 3 2 2-2 3 2V2zM8 8h8M8 12h8",
    people: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6",
    pen: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20",
    book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    pin: "M12 17v5M9 3h6l-1 7 3 3v2H7v-2l3-3z",
    inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z",
    filter: "M22 3H2l8 9.5V19l4 2v-8.5z",
    send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
    hash: "M4 9h16M4 15h16M10 3 8 21M16 3l-2 18",
    box: "M21 8v13H3V8M1 3h22v5H1zM10 12h4",
    help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
    at: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9",
    smile: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
    clip: "M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5",
    phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
    tag: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
    link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
    lock: "M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4",
    sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
    moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
    reply: "M9 14 4 9l5-5M20 20v-7a4 4 0 0 0-4-4H4",
    archive: "M21 8v13H3V8M1 3h22v5H1zM10 12h4",
    flag: "M4 22V4M4 4h13l-2 4 2 4H4",
    bot: "M12 8V4M8 4h8M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM9 14h.01M15 14h.01",
    chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
    sms: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5zM8 11h8M8 14h5",
    video: "M23 7l-7 5 7 5zM1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z",
    sort: "M3 6h18M6 12h12M10 18h4",
    snooze: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 9h6l-6 6h6",
    bold: "M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    key: "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4",
    minus: "M5 12h14",
    plug: "M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z",
    building: "M4 21V3h10v18M14 9h6v12M8 7h2M8 11h2M8 15h2",
    time: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  };

  function icon(name, size) {
    size = size || 16;
    return '<svg class="ico" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' + (P[name] || P.box) + '"/></svg>';
  }
  function hydrate(root) {
    (root || document).querySelectorAll("i[data-i]").forEach(function (el) { el.outerHTML = icon(el.dataset.i, +el.dataset.s || 16); });
  }
  /* avatar(initials, colorClass, sizeClass, presence: 'on' | 'off' | undefined) */
  function av(ini, cls, size, pres) {
    return '<span class="avatar ' + (size || "") + " " + (cls || "") + '">' + ini + (pres ? '<span class="pres ' + (pres === "off" ? "off" : "") + '"></span>' : "") + "</span>";
  }

  /* ---- theme: dark by default (DESIGN.MD is dark-first), persisted, toggleable ---- */
  function getTheme() { return document.documentElement.dataset.theme; }
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("lq-theme", t); } catch (e) {}
    document.querySelectorAll("[data-theme-btn]").forEach(paintThemeBtn);
  }
  function paintThemeBtn(b) { b.innerHTML = icon(getTheme() === "dark" ? "sun" : "moon", 19); b.dataset.tip = getTheme() === "dark" ? "Light theme" : "Dark theme"; }
  function toggleTheme() { setTheme(getTheme() === "dark" ? "light" : "dark"); }
  (function init() {
    var t = null;
    var q = new URLSearchParams(location.search).get("theme");
    if (q === "light" || q === "dark") t = q;
    else { try { t = localStorage.getItem("lq-theme"); } catch (e) {} }
    if (!t) t = "dark";
    document.documentElement.dataset.theme = t;
  })();

  window.LQ = { icon: icon, hydrate: hydrate, av: av, getTheme: getTheme, setTheme: setTheme, toggleTheme: toggleTheme, paintThemeBtn: paintThemeBtn };
  document.addEventListener("DOMContentLoaded", function () { hydrate(); });
})();
