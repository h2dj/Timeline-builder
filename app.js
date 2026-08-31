(function () {
  "use strict";

  /* ============================== Constants ============================== */

  const STORAGE_KEY = "timeline_builder_state_v1";
  const THEME_KEY = "timeline_builder_theme";

  const ZOOM_LEVELS = [
    { label: "년", pxPerDay: 0.6, tickUnit: "year" },
    { label: "분기", pxPerDay: 1.6, tickUnit: "quarter" },
    { label: "월", pxPerDay: 4, tickUnit: "month" },
    { label: "주", pxPerDay: 13, tickUnit: "week" },
    { label: "일", pxPerDay: 48, tickUnit: "day" },
  ];

  const DEFAULT_CATEGORIES = [
    { id: "cat-work", name: "업무", color: "#4f7cff" },
    { id: "cat-personal", name: "개인", color: "#34c38f" },
    { id: "cat-important", name: "중요", color: "#e25555" },
    { id: "cat-etc", name: "기타", color: "#a3a8c2" },
  ];

  const UNCATEGORIZED = { id: null, name: "미분류", color: "#9aa0b4" };

  const LANE_HEIGHT = 38;
  const LANE_GAP = 8;
  const TRACK_PAD_TOP = 16;
  const TRACK_PAD_BOTTOM = 24;
  const TRACK_PAD_SIDE = 40;
  const MIN_TRACK_WIDTH = 900;

  /* ============================== State ============================== */

  let state = {
    events: [],
    categories: DEFAULT_CATEGORIES.slice(),
    zoomIndex: 2,
    view: "timeline",
    search: "",
    categoryFilter: "all",
  };

  let editingEventDefaultColorTouched = false;

  /* ============================== Utilities ============================== */

  function uid(prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function parseDate(str) {
    if (!str) return null;
    const d = new Date(str + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  function toDateInputValue(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function diffDays(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function addMonths(d, n) {
    const r = new Date(d);
    r.setMonth(r.getMonth() + n);
    return r;
  }

  function startOfWeek(d) {
    const r = new Date(d);
    const day = (r.getDay() + 6) % 7; // Monday = 0
    r.setDate(r.getDate() - day);
    r.setHours(0, 0, 0, 0);
    return r;
  }

  function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function startOfQuarter(d) {
    const q = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), q, 1);
  }

  function startOfYear(d) {
    return new Date(d.getFullYear(), 0, 1);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function getCategory(id) {
    if (!id) return UNCATEGORIZED;
    return state.categories.find((c) => c.id === id) || UNCATEGORIZED;
  }

  function todayStr() {
    return toDateInputValue(new Date());
  }

  /* ============================== Persistence ============================== */

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.events) && Array.isArray(parsed.categories)) {
          state.events = parsed.events;
          state.categories = parsed.categories;
          if (typeof parsed.zoomIndex === "number") state.zoomIndex = parsed.zoomIndex;
          return;
        }
      }
    } catch (e) {
      console.warn("failed to load state", e);
    }
    // first run: seed with sample data so the app isn't empty
    seedSampleData();
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          events: state.events,
          categories: state.categories,
          zoomIndex: state.zoomIndex,
        })
      );
    } catch (e) {
      console.warn("failed to save state", e);
    }
  }

  function loadTheme() {
    let theme = "light";
    try {
      theme = localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    } catch (e) {}
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("btnTheme");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  /* ============================== Sample data ============================== */

  function seedSampleData() {
    const t = new Date();
    const y = t.getFullYear();
    const m = t.getMonth();
    const mk = (offsetMonths, day) => toDateInputValue(new Date(y, m + offsetMonths, day));

    state.categories = DEFAULT_CATEGORIES.slice();
    state.events = [
      {
        id: uid("ev"),
        title: "프로젝트 킥오프",
        description: "이해관계자들과 프로젝트 목표 및 범위를 정의합니다.",
        category: "cat-work",
        color: "#4f7cff",
        start: mk(-1, 3),
        end: "",
      },
      {
        id: uid("ev"),
        title: "요구사항 분석",
        description: "핵심 기능을 정리하고 우선순위를 정합니다.",
        category: "cat-work",
        color: "#4f7cff",
        start: mk(-1, 6),
        end: mk(0, 2),
      },
      {
        id: uid("ev"),
        title: "디자인 시안 검토",
        description: "",
        category: "cat-etc",
        color: "#a3a8c2",
        start: mk(0, 5),
        end: "",
      },
      {
        id: uid("ev"),
        title: "개발 스프린트 1",
        description: "핵심 기능 개발.",
        category: "cat-work",
        color: "#4f7cff",
        start: mk(0, 8),
        end: mk(1, 5),
      },
      {
        id: uid("ev"),
        title: "휴가",
        description: "재충전 기간.",
        category: "cat-personal",
        color: "#34c38f",
        start: mk(1, 10),
        end: mk(1, 14),
      },
      {
        id: uid("ev"),
        title: "베타 출시",
        description: "제한된 사용자에게 베타 버전을 공개합니다.",
        category: "cat-important",
        color: "#e25555",
        start: mk(2, 1),
        end: "",
      },
      {
        id: uid("ev"),
        title: "정식 출시",
        description: "전체 사용자 대상 정식 서비스 오픈!",
        category: "cat-important",
        color: "#e25555",
        start: mk(3, 1),
        end: "",
      },
    ];
  }

  /* ============================== DOM refs ============================== */

  const el = {};
  function cacheDom() {
    [
      "searchInput", "categoryFilter", "btnAddEvent", "btnAddEventEmpty", "btnMenu", "dropdownMenu",
      "btnManageCategories", "btnExport", "btnImport", "btnSample", "btnClear", "btnTheme",
      "viewTimelineBtn", "viewListBtn", "timelineView", "listView", "timelineScroll", "timelineAxis",
      "timelineTrack", "timelineNow", "emptyState", "eventTableBody", "zoomOut", "zoomIn", "zoomLabel",
      "btnToday", "btnFit", "eventModal", "modalTitle", "eventForm", "eventId", "eventTitle", "eventStart",
      "eventEnd", "eventCategory", "eventColor", "eventDescription", "btnDeleteEvent", "btnCancelModal",
      "btnCloseModal", "categoryModal", "categoryList", "categoryForm", "newCategoryName", "newCategoryColor",
      "btnCloseCategoryModal", "btnCloseCategoryModal2", "importFileInput", "toast",
    ].forEach((id) => (el[id] = document.getElementById(id)));
  }

  /* ============================== Rendering: filters ============================== */

  function renderCategoryOptions() {
    // header filter
    const filterVal = el.categoryFilter.value || "all";
    el.categoryFilter.innerHTML =
      '<option value="all">모든 카테고리</option>' +
      state.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("") +
      '<option value="__none__">미분류</option>';
    el.categoryFilter.value = filterVal;

    // modal select
    const modalVal = el.eventCategory.value;
    el.eventCategory.innerHTML = state.categories
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");
    if (state.categories.some((c) => c.id === modalVal)) {
      el.eventCategory.value = modalVal;
    }
  }

  function getFilteredEvents() {
    const q = state.search.trim().toLowerCase();
    return state.events.filter((ev) => {
      if (state.categoryFilter === "__none__" && ev.category) return false;
      if (state.categoryFilter !== "all" && state.categoryFilter !== "__none__" && ev.category !== state.categoryFilter)
        return false;
      if (q) {
        const hay = (ev.title + " " + (ev.description || "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  /* ============================== Rendering: timeline ============================== */

  function computeRange(events, unit) {
    let min, max;
    if (events.length === 0) {
      const t = new Date();
      min = addMonths(t, -1);
      max = addMonths(t, 2);
    } else {
      min = null;
      max = null;
      events.forEach((ev) => {
        const s = parseDate(ev.start);
        const e = parseDate(ev.end) || s;
        if (!s) return;
        if (!min || s < min) min = s;
        if (!max || e > max) max = e;
      });
      if (!min) {
        const t = new Date();
        min = addMonths(t, -1);
        max = addMonths(t, 2);
      }
    }
    // pad range so first/last events aren't flush against the edge
    min = addDays(min, -7);
    max = addDays(max, 14);
    // snap outward to the current tick unit for a clean first/last tick
    min = startOfUnit(min, unit);
    max = addUnit(startOfUnit(max, unit), unit, 1);
    return { min, max };
  }

  function startOfUnit(d, unit) {
    switch (unit) {
      case "year": return startOfYear(d);
      case "quarter": return startOfQuarter(d);
      case "month": return startOfMonth(d);
      case "week": return startOfWeek(d);
      default: {
        const r = new Date(d);
        r.setHours(0, 0, 0, 0);
        return r;
      }
    }
  }

  function addUnit(d, unit, n) {
    switch (unit) {
      case "year": return addMonths(d, 12 * n);
      case "quarter": return addMonths(d, 3 * n);
      case "month": return addMonths(d, n);
      case "week": return addDays(d, 7 * n);
      default: return addDays(d, n);
    }
  }

  function formatTick(d, unit) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    switch (unit) {
      case "year": return `${y}`;
      case "quarter": return `${y}. Q${Math.floor((m - 1) / 3) + 1}`;
      case "month": return m === 1 ? `${y}년` : `${m}월`;
      case "week": return `${m}/${day}`;
      default: return `${m}/${day}`;
    }
  }

  function isMajorTick(d, unit) {
    switch (unit) {
      case "year": return true;
      case "quarter": return d.getMonth() === 0;
      case "month": return d.getMonth() === 0;
      case "week": return d.getDate() <= 7;
      default: return d.getDate() === 1;
    }
  }

  function renderTimeline() {
    const zoom = ZOOM_LEVELS[state.zoomIndex];
    const filtered = getFilteredEvents();
    const { min, max } = computeRange(filtered, zoom.tickUnit);
    const totalDays = diffDays(min, max);
    const innerWidth = Math.max(MIN_TRACK_WIDTH, totalDays * zoom.pxPerDay);

    el.emptyState.classList.toggle("hidden", state.events.length !== 0);

    // ---- axis + grid ----
    el.timelineAxis.innerHTML = "";
    el.timelineAxis.style.width = innerWidth + TRACK_PAD_SIDE * 2 + "px";

    const gridFrag = document.createDocumentFragment();
    const axisFrag = document.createDocumentFragment();

    let cursor = min;
    let guard = 0;
    while (cursor < max && guard < 500) {
      const left = diffDays(min, cursor) * zoom.pxPerDay + TRACK_PAD_SIDE;
      const major = isMajorTick(cursor, zoom.tickUnit);

      const tick = document.createElement("div");
      tick.className = "axis-tick" + (major ? " major" : "");
      tick.style.left = left + "px";
      tick.textContent = formatTick(cursor, zoom.tickUnit);
      axisFrag.appendChild(tick);

      const gridLine = document.createElement("div");
      gridLine.className = "tl-grid-line";
      gridLine.style.left = left + "px";
      gridFrag.appendChild(gridLine);

      cursor = addUnit(cursor, zoom.tickUnit, 1);
      guard++;
    }
    el.timelineAxis.appendChild(axisFrag);

    // ---- track ----
    el.timelineTrack.innerHTML = "";
    el.timelineTrack.appendChild(gridFrag.cloneNode(true));
    el.timelineTrack.style.width = innerWidth + TRACK_PAD_SIDE * 2 + "px";

    // now line
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (now >= min && now <= max) {
      const nowLine = document.createElement("div");
      nowLine.className = "now-line";
      nowLine.style.left = diffDays(min, now) * zoom.pxPerDay + TRACK_PAD_SIDE + "px";
      el.timelineTrack.appendChild(nowLine);
    }

    // ---- events: compute geometry ----
    const geoms = filtered
      .map((ev) => {
        const s = parseDate(ev.start);
        if (!s) return null;
        const e = parseDate(ev.end) || s;
        const isPoint = diffDays(s, e) <= 0;
        const left = diffDays(min, s) * zoom.pxPerDay + TRACK_PAD_SIDE;
        let width;
        if (isPoint) {
          width = Math.min(220, Math.max(90, ev.title.length * 7 + 40));
        } else {
          width = Math.max(60, diffDays(s, e) * zoom.pxPerDay);
        }
        return { ev, left, width, isPoint };
      })
      .filter(Boolean)
      .sort((a, b) => a.left - b.left);

    // lane assignment (greedy)
    const laneEnds = []; // right edge (px) of last placed card per lane
    geoms.forEach((g) => {
      let lane = laneEnds.findIndex((end) => end + LANE_GAP <= g.left);
      if (lane === -1) {
        lane = laneEnds.length;
      }
      laneEnds[lane] = g.left + g.width;
      g.lane = lane;
    });

    const laneCount = Math.max(1, laneEnds.length);
    el.timelineTrack.style.minHeight = TRACK_PAD_TOP + TRACK_PAD_BOTTOM + laneCount * LANE_HEIGHT + "px";

    const cardFrag = document.createDocumentFragment();
    geoms.forEach((g) => {
      const cat = getCategory(g.ev.category);
      const card = document.createElement("div");
      card.className = "event-card" + (g.isPoint ? " point" : "");
      card.style.left = g.left + "px";
      card.style.top = TRACK_PAD_TOP + g.lane * LANE_HEIGHT + "px";
      card.style.width = g.width + "px";
      card.style.background = g.ev.color || cat.color;
      card.innerHTML = `<span class="dot"></span><span>${escapeHtml(g.ev.title)}</span>`;
      card.addEventListener("click", () => openEventModal(g.ev.id));
      card.addEventListener("mouseenter", (evt) => showTooltip(evt, g.ev, cat));
      card.addEventListener("mousemove", positionTooltip);
      card.addEventListener("mouseleave", hideTooltip);
      cardFrag.appendChild(card);
    });
    el.timelineTrack.appendChild(cardFrag);

    el.timelineTrack.dataset.min = min.getTime();
    el.timelineTrack.dataset.pxPerDay = zoom.pxPerDay;
  }

  let tooltipEl = null;
  function showTooltip(evt, ev, cat) {
    hideTooltip();
    tooltipEl = document.createElement("div");
    tooltipEl.className = "event-tooltip";
    const dateLabel = ev.end && ev.end !== ev.start ? `${ev.start} ~ ${ev.end}` : ev.start;
    tooltipEl.innerHTML = `
      <div class="tt-title">${escapeHtml(ev.title)}</div>
      <div class="tt-date">${escapeHtml(cat.name)} · ${escapeHtml(dateLabel)}</div>
      ${ev.description ? `<div class="tt-desc">${escapeHtml(ev.description)}</div>` : ""}
    `;
    document.body.appendChild(tooltipEl);
    positionTooltip(evt);
  }
  function positionTooltip(evt) {
    if (!tooltipEl) return;
    const pad = 14;
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    const rect = tooltipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = evt.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = evt.clientY - rect.height - pad;
    tooltipEl.style.left = x + "px";
    tooltipEl.style.top = y + "px";
  }
  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  /* ============================== Rendering: list ============================== */

  function renderList() {
    const filtered = getFilteredEvents().slice().sort((a, b) => (a.start > b.start ? 1 : a.start < b.start ? -1 : 0));
    if (filtered.length === 0) {
      el.eventTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">표시할 이벤트가 없습니다.</td></tr>`;
      return;
    }
    el.eventTableBody.innerHTML = filtered
      .map((ev) => {
        const cat = getCategory(ev.category);
        return `
        <tr data-id="${ev.id}">
          <td><strong>${escapeHtml(ev.title)}</strong></td>
          <td><span class="cat-badge" style="background:${cat.color}">${escapeHtml(cat.name)}</span></td>
          <td>${escapeHtml(ev.start)}</td>
          <td>${escapeHtml(ev.end || "-")}</td>
          <td>${escapeHtml((ev.description || "").slice(0, 80))}${(ev.description || "").length > 80 ? "…" : ""}</td>
          <td class="row-actions">
            <button data-action="edit" title="수정">✎</button>
            <button data-action="delete" title="삭제">🗑</button>
          </td>
        </tr>`;
      })
      .join("");

    el.eventTableBody.querySelectorAll("tr").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-action="edit"]').addEventListener("click", () => openEventModal(id));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => {
        if (confirm("이 이벤트를 삭제할까요?")) {
          deleteEvent(id);
        }
      });
    });
  }

  /* ============================== Main render ============================== */

  function render() {
    renderCategoryOptions();
    if (state.view === "timeline") {
      el.timelineView.classList.remove("hidden");
      el.listView.classList.add("hidden");
      renderTimeline();
    } else {
      el.timelineView.classList.add("hidden");
      el.listView.classList.remove("hidden");
      renderList();
    }
    el.zoomLabel.textContent = ZOOM_LEVELS[state.zoomIndex].label;
    saveState();
  }

  /* ============================== Event modal ============================== */

  function openEventModal(id) {
    editingEventDefaultColorTouched = !!id;
    const ev = id ? state.events.find((e) => e.id === id) : null;
    el.modalTitle.textContent = ev ? "이벤트 수정" : "이벤트 추가";
    el.eventId.value = ev ? ev.id : "";
    el.eventTitle.value = ev ? ev.title : "";
    el.eventStart.value = ev ? ev.start : todayStr();
    el.eventEnd.value = ev ? ev.end || "" : "";
    el.eventDescription.value = ev ? ev.description || "" : "";
    renderCategoryOptions();
    el.eventCategory.value = ev ? ev.category || (state.categories[0] && state.categories[0].id) : state.categories[0] && state.categories[0].id;
    el.eventColor.value = ev ? ev.color || getCategory(ev.category).color : getCategory(el.eventCategory.value).color;
    el.btnDeleteEvent.classList.toggle("hidden", !ev);
    el.eventModal.classList.remove("hidden");
    setTimeout(() => el.eventTitle.focus(), 30);
  }

  function closeEventModal() {
    el.eventModal.classList.add("hidden");
  }

  function submitEventForm(e) {
    e.preventDefault();
    const id = el.eventId.value;
    const title = el.eventTitle.value.trim();
    const start = el.eventStart.value;
    const end = el.eventEnd.value;
    if (!title || !start) return;
    if (end && end < start) {
      toast("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    const payload = {
      title,
      description: el.eventDescription.value.trim(),
      category: el.eventCategory.value || null,
      color: el.eventColor.value,
      start,
      end: end || "",
    };
    if (id) {
      const idx = state.events.findIndex((e2) => e2.id === id);
      if (idx !== -1) state.events[idx] = { ...state.events[idx], ...payload };
    } else {
      state.events.push({ id: uid("ev"), ...payload });
    }
    closeEventModal();
    render();
    toast(id ? "이벤트를 수정했습니다." : "이벤트를 추가했습니다.");
  }

  function deleteEvent(id) {
    state.events = state.events.filter((e) => e.id !== id);
    closeEventModal();
    render();
    toast("이벤트를 삭제했습니다.");
  }

  /* ============================== Category modal ============================== */

  function openCategoryModal() {
    renderCategoryModalList();
    el.categoryModal.classList.remove("hidden");
  }
  function closeCategoryModal() {
    el.categoryModal.classList.add("hidden");
  }
  function renderCategoryModalList() {
    if (state.categories.length === 0) {
      el.categoryList.innerHTML = `<p style="color:var(--text-muted); font-size:13px;">카테고리가 없습니다. 아래에서 추가해보세요.</p>`;
      return;
    }
    el.categoryList.innerHTML = state.categories
      .map(
        (c) => `
      <div class="category-row" data-id="${c.id}">
        <span class="swatch" style="background:${c.color}"></span>
        <span class="name">${escapeHtml(c.name)}</span>
        <button data-action="delete" title="삭제">삭제</button>
      </div>`
      )
      .join("");
    el.categoryList.querySelectorAll(".category-row").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('[data-action="delete"]').addEventListener("click", () => {
        const cat = getCategory(id);
        const usageCount = state.events.filter((e) => e.category === id).length;
        const msg = usageCount > 0 ? `"${cat.name}" 카테고리를 삭제하면 이벤트 ${usageCount}개가 미분류로 변경됩니다. 계속할까요?` : `"${cat.name}" 카테고리를 삭제할까요?`;
        if (!confirm(msg)) return;
        state.categories = state.categories.filter((c) => c.id !== id);
        state.events.forEach((e) => {
          if (e.category === id) e.category = null;
        });
        renderCategoryModalList();
        render();
        toast("카테고리를 삭제했습니다.");
      });
    });
  }

  function submitCategoryForm(e) {
    e.preventDefault();
    const name = el.newCategoryName.value.trim();
    if (!name) return;
    state.categories.push({ id: uid("cat"), name, color: el.newCategoryColor.value });
    el.newCategoryName.value = "";
    el.newCategoryColor.value = "#4f7cff";
    renderCategoryModalList();
    render();
    toast("카테고리를 추가했습니다.");
  }

  /* ============================== Export / Import ============================== */

  function exportData() {
    const data = { events: state.events, categories: state.categories, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline-builder-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("JSON 파일로 내보냈습니다.");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed.events) || !Array.isArray(parsed.categories)) {
          throw new Error("invalid shape");
        }
        if (!confirm("가져온 데이터로 현재 데이터를 덮어씁니다. 계속할까요?")) return;
        state.events = parsed.events;
        state.categories = parsed.categories;
        render();
        toast("데이터를 가져왔습니다.");
      } catch (err) {
        toast("유효하지 않은 JSON 파일입니다.");
      }
    };
    reader.readAsText(file);
  }

  /* ============================== Toast ============================== */

  let toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    el.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove("show");
    }, 2400);
  }

  /* ============================== Zoom / navigation ============================== */

  function zoomBy(delta) {
    const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, state.zoomIndex + delta));
    if (next === state.zoomIndex) return;
    state.zoomIndex = next;
    render();
  }

  function goToToday() {
    if (state.view !== "timeline") {
      el.viewTimelineBtn.click();
    }
    requestAnimationFrame(() => {
      const nowLine = el.timelineTrack.querySelector(".now-line");
      if (nowLine) {
        const target = parseFloat(nowLine.style.left) - el.timelineScroll.clientWidth / 2;
        el.timelineScroll.scrollLeft = Math.max(0, target);
      } else {
        el.timelineScroll.scrollLeft = 0;
      }
    });
  }

  function fitToData() {
    const filtered = getFilteredEvents();
    if (filtered.length === 0) return;
    let min = null,
      max = null;
    filtered.forEach((ev) => {
      const s = parseDate(ev.start);
      const e = parseDate(ev.end) || s;
      if (!s) return;
      if (!min || s < min) min = s;
      if (!max || e > max) max = e;
    });
    if (!min) return;
    const totalDays = Math.max(1, diffDays(min, max) + 21);
    const containerWidth = Math.max(200, el.timelineScroll.clientWidth - TRACK_PAD_SIDE * 2);
    const neededPxPerDay = containerWidth / totalDays;
    let bestIdx = 0;
    ZOOM_LEVELS.forEach((z, i) => {
      if (z.pxPerDay <= neededPxPerDay) bestIdx = i;
    });
    state.zoomIndex = bestIdx;
    render();
    requestAnimationFrame(() => (el.timelineScroll.scrollLeft = 0));
  }

  /* ============================== Wiring ============================== */

  function wireEvents() {
    el.btnAddEvent.addEventListener("click", () => openEventModal(null));
    el.btnAddEventEmpty.addEventListener("click", () => openEventModal(null));
    el.btnCloseModal.addEventListener("click", closeEventModal);
    el.btnCancelModal.addEventListener("click", closeEventModal);
    el.eventModal.addEventListener("click", (e) => {
      if (e.target === el.eventModal) closeEventModal();
    });
    el.eventForm.addEventListener("submit", submitEventForm);
    el.btnDeleteEvent.addEventListener("click", () => {
      const id = el.eventId.value;
      if (id && confirm("이 이벤트를 삭제할까요?")) deleteEvent(id);
    });
    el.eventCategory.addEventListener("change", () => {
      if (!editingEventDefaultColorTouched) {
        el.eventColor.value = getCategory(el.eventCategory.value).color;
      }
    });
    el.eventColor.addEventListener("input", () => {
      editingEventDefaultColorTouched = true;
    });

    // category modal
    el.btnManageCategories.addEventListener("click", () => {
      el.dropdownMenu.classList.add("hidden");
      openCategoryModal();
    });
    el.btnCloseCategoryModal.addEventListener("click", closeCategoryModal);
    el.btnCloseCategoryModal2.addEventListener("click", closeCategoryModal);
    el.categoryModal.addEventListener("click", (e) => {
      if (e.target === el.categoryModal) closeCategoryModal();
    });
    el.categoryForm.addEventListener("submit", submitCategoryForm);

    // dropdown menu
    el.btnMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      el.dropdownMenu.classList.toggle("hidden");
    });
    document.addEventListener("click", () => el.dropdownMenu.classList.add("hidden"));
    el.dropdownMenu.addEventListener("click", (e) => e.stopPropagation());

    el.btnExport.addEventListener("click", () => {
      el.dropdownMenu.classList.add("hidden");
      exportData();
    });
    el.btnImport.addEventListener("click", () => {
      el.dropdownMenu.classList.add("hidden");
      el.importFileInput.click();
    });
    el.importFileInput.addEventListener("change", () => {
      const file = el.importFileInput.files[0];
      if (file) importData(file);
      el.importFileInput.value = "";
    });
    el.btnSample.addEventListener("click", () => {
      el.dropdownMenu.classList.add("hidden");
      if (confirm("샘플 데이터를 불러오면 현재 데이터를 덮어씁니다. 계속할까요?")) {
        seedSampleData();
        render();
        toast("샘플 데이터를 불러왔습니다.");
      }
    });
    el.btnClear.addEventListener("click", () => {
      el.dropdownMenu.classList.add("hidden");
      if (confirm("모든 이벤트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) {
        state.events = [];
        render();
        toast("모든 이벤트를 삭제했습니다.");
      }
    });

    // theme
    el.btnTheme.addEventListener("click", toggleTheme);

    // view toggle
    el.viewTimelineBtn.addEventListener("click", () => setView("timeline"));
    el.viewListBtn.addEventListener("click", () => setView("list"));

    // zoom
    el.zoomOut.addEventListener("click", () => zoomBy(-1));
    el.zoomIn.addEventListener("click", () => zoomBy(1));
    el.btnToday.addEventListener("click", goToToday);
    el.btnFit.addEventListener("click", fitToData);

    // search / filter
    let searchDebounce = null;
    el.searchInput.addEventListener("input", () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.search = el.searchInput.value;
        render();
      }, 150);
    });
    el.categoryFilter.addEventListener("change", () => {
      state.categoryFilter = el.categoryFilter.value;
      render();
    });

    // keyboard: Escape closes modals
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeEventModal();
        closeCategoryModal();
      }
    });

    // drag-to-pan on the timeline background
    wireDragPan();
  }

  function setView(view) {
    state.view = view;
    el.viewTimelineBtn.classList.toggle("active", view === "timeline");
    el.viewListBtn.classList.toggle("active", view === "list");
    render();
  }

  function wireDragPan() {
    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    el.timelineScroll.addEventListener("mousedown", (e) => {
      if (e.target.closest(".event-card")) return;
      isDown = true;
      startX = e.pageX;
      startScroll = el.timelineScroll.scrollLeft;
      el.timelineScroll.style.cursor = "grabbing";
    });
    window.addEventListener("mouseup", () => {
      isDown = false;
      el.timelineScroll.style.cursor = "";
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      el.timelineScroll.scrollLeft = startScroll - (e.pageX - startX);
    });
  }

  /* ============================== Init ============================== */

  function init() {
    cacheDom();
    loadTheme();
    loadState();
    wireEvents();
    setView("timeline");
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
