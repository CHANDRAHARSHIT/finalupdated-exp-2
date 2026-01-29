/* File: progress_tracker.js
   Usage on any page:
   <script src="./progress_tracker.js"></script>
   <script>VLProgress.initPage();</script>

   If inside simulation/static/index.html:
   <script src="../../progress_tracker.js"></script>
*/

(function () {
  const KEY = "vlab_exp2_progress_v1";
  const VERSION = 1;

  const nowISO = () => new Date().toISOString();
  const GENERAL_PROGRESS_KEYS = [
    "vlab_exp2_pretest_score",
    "vlab_exp2_pretest_total",
    "vlab_exp2_pretest_updated_at",
    "vlab_exp2_posttest_score",
    "vlab_exp2_posttest_total",
    "vlab_exp2_posttest_updated_at",
    "vlab_exp2_simulation_report_html",
    "vlab_exp2_simulation_report_updated_at"
  ];

  function safeParse(json, fallback) {
    try {
      const v = JSON.parse(json);
      return v && typeof v === "object" ? v : fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeEmail(email) {
    if (!email || typeof email !== "string") return "";
    return email.trim().toLowerCase();
  }

  function computeUserHash(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return "";

    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
      hash |= 0;
    }
    return `u${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function clearGeneralProgressKeys() {
    if (typeof localStorage === "undefined") return;
    try {
      for (const key of GENERAL_PROGRESS_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore storage failures
    }
  }

  function baseState() {
    return {
      version: VERSION,
      user: null,
      flags: { reportDeclined: false },
      timestamps: {
        sessionStart: null,
        aimAfterIntro: null,
        simulationStart: null,
        contributorsVisited: null,
        reportViewedAt: null
      },
      pages: {}, // { "aim.html": { firstEnter, lastExit, timeMs, visits } }
      steps: [], // [{ name, ts, meta }]
      userHistory: []
    };
  }

  function ensureHistory(state) {
    if (!Array.isArray(state.userHistory)) state.userHistory = [];
  }

  function findHistoryEntry(state, normalizedEmail) {
    if (!normalizedEmail) return null;
    ensureHistory(state);
    return state.userHistory.find(entry => entry.email === normalizedEmail) || null;
  }

  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return baseState();

    const parsed = safeParse(raw, baseState());

    // harden structure
    if (!parsed.flags) parsed.flags = { reportDeclined: false };
    if (!parsed.timestamps) parsed.timestamps = baseState().timestamps;
    if (!parsed.pages) parsed.pages = {};
    if (!parsed.steps) parsed.steps = [];
    if (!Array.isArray(parsed.userHistory)) parsed.userHistory = [];
    return { ...baseState(), ...parsed };
  }

  function recordUserHistory(state, user) {
    const normalizedEmail = normalizeEmail(user?.email);
    if (!normalizedEmail) return false;
    ensureHistory(state);

    const now = nowISO();
    const existing = state.userHistory.find(entry => entry.email === normalizedEmail);
    if (existing) {
      existing.name = (user?.name || "").trim();
      existing.designation = (user?.designation || "").trim();
      existing.lastSeen = now;
      return false;
    }

    state.userHistory.push({
      email: normalizedEmail,
      name: (user?.name || "").trim(),
      designation: (user?.designation || "").trim(),
      firstSeen: now,
      lastSeen: now
    });
    return true;
  }

  function findUserByEmail(email) {
    const state = load();
    const normalizedEmail = normalizeEmail(email);
    const entry = findHistoryEntry(state, normalizedEmail);
    return entry ? Object.assign({}, entry) : null;
  }

  function isUserEmailNew(email) {
    return !findUserByEmail(email);
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // ignore quota / private mode errors
    }
  }

  function pageName() {
    const p = window.location.pathname.split("/").pop();
    return p || "index.html";
  }

  function ensureSessionStart(state) {
    if (!state.timestamps.sessionStart) state.timestamps.sessionStart = nowISO();
  }

  // format milliseconds -> HH:MM:SS
  function formatMs(ms) {
    const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const ss = String(totalSec % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  function initPage() {
    const state = load();
    ensureSessionStart(state);

    const p = pageName();
    const rec = state.pages[p] || {
      firstEnter: null,
      lastExit: null,
      timeMs: 0,
      visits: 0
    };

    if (!rec.firstEnter) rec.firstEnter = nowISO();
    rec.visits += 1;

    state.pages[p] = rec;

    // useful: auto stamp simulationStart for simulation/static/index.html
    if (p === "index.html" && /\/simulation\//.test(window.location.pathname)) {
      if (!state.timestamps.simulationStart) state.timestamps.simulationStart = nowISO();
    }

    // useful: contributors page stamp if file is literally contributors.html
    if (p === "contributors.html" && !state.timestamps.contributorsVisited) {
      state.timestamps.contributorsVisited = nowISO();
    }

    save(state);

    // store enter time in sessionStorage for time-on-page calc
    try {
      sessionStorage.setItem("vlab_exp2_current_page", p);
      sessionStorage.setItem("vlab_exp2_page_enter_ms", String(Date.now()));
    } catch {}
  }

  function recordPageExit() {
    const state = load();
    const p = (() => {
      try {
        return sessionStorage.getItem("vlab_exp2_current_page") || pageName();
      } catch {
        return pageName();
      }
    })();

    let enterMs = null;
    try {
      const s = sessionStorage.getItem("vlab_exp2_page_enter_ms");
      enterMs = s ? Number(s) : null;
    } catch {}

    const delta = (enterMs && Number.isFinite(enterMs)) ? (Date.now() - enterMs) : 0;

    const rec = state.pages[p] || { firstEnter: null, lastExit: null, timeMs: 0, visits: 0 };
    rec.timeMs = (rec.timeMs || 0) + Math.max(0, delta);
    rec.lastExit = nowISO();

    state.pages[p] = rec;
    save(state);
  }

  function logStep(name, meta = {}) {
    const state = load();
    ensureSessionStart(state);
    state.steps.push({ name: String(name || "").trim(), ts: nowISO(), meta: meta || {} });
    save(state);
  }

  function setUser(user) {
    const trimmedUser = {
      name: (user?.name || "").trim(),
      email: (user?.email || "").trim(),
      designation: (user?.designation || "").trim()
    };
    const normalizedEmail = normalizeEmail(trimmedUser.email);

    const state = load();
    const isNewUserByEmail = recordUserHistory(state, trimmedUser);

    state.user = {
      ...trimmedUser,
      submittedAt: nowISO()
    };
    state.flags.reportDeclined = false;

    try {
      if (normalizedEmail) {
        localStorage.setItem("vlab_exp2_active_user_hash", computeUserHash(normalizedEmail));
      } else {
        localStorage.removeItem("vlab_exp2_active_user_hash");
      }
    } catch {
      // ignore storage errors
    }

    if (isNewUserByEmail && normalizedEmail) {
      clearGeneralProgressKeys();
    }

    save(state);
  }

  function hasUser() {
    const s = load();
    return !!(s.user && s.user.name && s.user.email && s.user.designation);
  }

  function declineReport() {
    const state = load();
    state.flags.reportDeclined = true;
    save(state);
  }

  function clearDecline() {
    const state = load();
    state.flags.reportDeclined = false;
    save(state);
  }

  function mark(key) {
    const state = load();
    if (!state.timestamps) state.timestamps = baseState().timestamps;
    state.timestamps[key] = nowISO();
    save(state);
  }

  function markReportViewed() {
    const state = load();
    if (!state.timestamps.reportViewedAt) state.timestamps.reportViewedAt = nowISO();
    save(state);
  }

  function resetAll() {
    try { localStorage.removeItem(KEY); } catch {}
    try {
      sessionStorage.removeItem("vlab_exp2_current_page");
      sessionStorage.removeItem("vlab_exp2_page_enter_ms");
    } catch {}
  }

  // automatically capture exit
  window.addEventListener("pagehide", recordPageExit);
  window.addEventListener("beforeunload", recordPageExit);

  // expose API
  window.VLProgress = {
    initPage,
    recordPageExit,
    logStep,
    setUser,
    hasUser,
    declineReport,
    clearDecline,
    mark,
    markReportViewed,
    getState: load,
    saveState: save,
    formatMs,
    findUserByEmail,
    isUserEmailNew,
    resetAll
  };
})();
