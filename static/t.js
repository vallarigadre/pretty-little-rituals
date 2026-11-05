/* Pretty Little Rituals: private reader stats. Counts page views, read-throughs and Amazon link clicks,
   plus which platform the visit came from. No cookies, nothing that identifies a reader.
   Results show on /admin/. */
(function () {
  try { if (localStorage.getItem("tln_notrack") === "1") return; } catch (e) {}
  if (navigator.webdriver) return;
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;

  var path = location.pathname;
  var title = (document.title || "").replace(/\s*\|\s*Pretty Little Rituals\s*$/, "");

  function host(u) { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch (e) { return ""; } }

  // Where did this visit come from? A utm_source tag wins, then the referring site.
  function platform() {
    var q = new URLSearchParams(location.search);
    var u = (q.get("utm_source") || q.get("ref") || "").toLowerCase();
    var name = function (s) {
      if (/pinterest|^pin\.it|^pin$/.test(s)) return "Pinterest";
      if (/instagram|^ig$|^insta/.test(s)) return "Instagram";
      if (/threads/.test(s)) return "Threads";
      if (/facebook|^fb$|^m\.me|messenger/.test(s)) return "Facebook";
      if (/beacons/.test(s)) return "Beacons";
      if (/newsletter|email|mail/.test(s)) return "Newsletter";
      if (/google/.test(s)) return "Google";
      if (/bing|duckduckgo|yahoo|ecosia|brave|search/.test(s)) return "Other search";
      if (/chatgpt|openai|perplexity|claude|gemini|copilot/.test(s)) return "AI search";
      if (/tiktok/.test(s)) return "TikTok";
      if (/youtube|youtu\.be/.test(s)) return "YouTube";
      if (/reddit/.test(s)) return "Reddit";
      if (/^t\.co$|twitter|^x\.com/.test(s)) return "X";
      return "";
    };
    if (u) return name(u) || u.slice(0, 30);
    var h = host(document.referrer);
    if (!h || h === location.hostname) return null;
    return name(h) || h.slice(0, 40);
  }

  var src = null;
  try { src = sessionStorage.getItem("tln_src"); } catch (e) {}
  var found = platform();
  if (found || !src) {
    src = found || "Direct";
    try { sessionStorage.setItem("tln_src", src); } catch (e) {}
  }

  function send(data) {
    data.p = path; data.ti = title; data.s = src;
    var body = JSON.stringify(data);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon("/api/t", body)) return;
    } catch (e) {}
    try { fetch("/api/t", { method: "POST", body: body, keepalive: true }); } catch (e) {}
  }

  function once(key) {
    try {
      if (sessionStorage.getItem(key)) return false;
      sessionStorage.setItem(key, "1");
    } catch (e) {}
    return true;
  }

  // 1. A view, once per page per visit.
  if (once("tln_v:" + path)) send({ t: "view" });

  // 2. A read: the reader scrolled at least 60% of the way through the story.
  var prose = document.querySelector(".post .prose");
  if (prose && path.indexOf("/posts/") === 0) {
    var check = function () {
      var r = prose.getBoundingClientRect();
      if (window.innerHeight - r.top >= r.height * 0.6) {
        window.removeEventListener("scroll", check);
        if (once("tln_r:" + path)) send({ t: "read" });
      }
    };
    window.addEventListener("scroll", check, { passive: true });
  }

  // 3. Amazon link clicks: which product, where in the post.
  var links = Array.prototype.slice.call(document.querySelectorAll("a.shop-link"));
  var onClick = function (e) {
    if (e.type === "auxclick" && e.button !== 1) return;
    var a = e.target.closest && e.target.closest("a.shop-link");
    if (!a) return;
    var inList = !!a.closest("li");
    send({ t: "click", h: a.href.slice(0, 300), x: (a.textContent || "").trim().slice(0, 120), w: inList ? "list" : "story", n: links.indexOf(a) + 1 });
  };
  document.addEventListener("click", onClick, true);
  document.addEventListener("auxclick", onClick, true);
})();
