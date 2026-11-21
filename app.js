/* =========================================================================
   1. رابط الـ API والإعدادات الأساسية (يمكنك التعديل هنا بسهولة مستقبلاً)
   ========================================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycbyI4a8tf5gBnFpBiL92vKTFvT8vX9MEBKT7IBA8GllDjG3ldpI9EhFQWyyaPVPEvnHPGA/exec";

const ADMIN_PIN = "1011100010"; // الرمز السري الافتراضي للإدارة
const FILES_PAGE_SIZE = 12; // التحميل التدريجي للملفات لحماية أداء الجوال

const STORAGE_KEYS = {
  PORTAL_CACHE: "ai_l1_portal_cloud_cache_v3",
  SEEN_FILES: "ai_l1_seen_file_ids_v3"
};

const DAYS_ORDER = [
  { key: "saturday", label: "السبت", jsDay: 6 },
  { key: "sunday", label: "الأحد", jsDay: 0 },
  { key: "monday", label: "الاثنين", jsDay: 1 },
  { key: "tuesday", label: "الثلاثاء", jsDay: 2 },
  { key: "wednesday", label: "الأربعاء", jsDay: 3 },
  { key: "thursday", label: "الخميس", jsDay: 4 }
];

const DEFAULT_PORTAL_DATA = {
  announcement: {
    visible: false,
    text: ""
  },
  schedule: {
    saturday: [
      { subject: "Introduction to computer", time: "08:00 - 10:00 ص", room: "قاعة 101", doctor: "د. عبدالله المنصور" },
      { subject: "Mathematics", time: "10:15 - 12:15 م", room: "قاعة 102", doctor: "د. سامي الحسن" }
    ],
    sunday: [
      { subject: "Computer programming", time: "08:00 - 10:00 ص", room: "مدرج الذكاء الاصطناعي", doctor: "د. خالد السالم" },
      { subject: "English language", time: "10:30 - 12:00 م", room: "قاعة 204", doctor: "أ. نورة العلي" }
    ],
    monday: [
      { subject: "Physics", time: "08:30 - 10:30 ص", room: "قاعة العلوم 1", doctor: "د. طارق يوسف" },
      { subject: "Arabic language", time: "10:45 - 12:15 م", room: "قاعة 105", doctor: "د. فهد القحطاني" }
    ],
    tuesday: [
      { subject: "Computer programming (عملي)", time: "09:00 - 11:00 ص", room: "معمل البرمجة 2", doctor: "م. سارة الأحمد" },
      { subject: "Mathematics (تمارين)", time: "11:15 - 12:45 م", room: "قاعة 102", doctor: "م. عمر الزهراني" }
    ],
    wednesday: [
      { subject: "Introduction to computer (عملي)", time: "08:00 - 10:00 ص", room: "معمل الحاسوب 1", doctor: "م. ريم الدوسري" },
      { subject: "Physics (معمل)", time: "10:30 - 12:30 م", room: "مختبر الفيزياء", doctor: "م. مازن الشهري" }
    ],
    thursday: [
      { subject: "English language", time: "09:00 - 10:30 ص", room: "قاعة 204", doctor: "أ. نورة العلي" }
    ]
  }
};

/*
 * بنية مرنة مجهزة للتوسع المستقبلي (مثل قسم تسجيلات المحاضرات)
 */
const FUTURE_RECORDINGS_CONFIG = {
  enabled: false,
  title: "تسجيلات المحاضرات",
  subtitle: "روابط التسجيلات الصوتية والمرئية للمحاضرات",
  items: []
};

/* =========================================================================
   2. حالة التطبيق (Application State)
   ========================================================================= */
let coursesData = [];
let portalData = cloneObj(DEFAULT_PORTAL_DATA);
let activeDayKey = detectTodayKey();
let currentModalCourse = null;
let currentSectionIndex = 0;

let sectionVisibleLimit = FILES_PAGE_SIZE;
let searchVisibleLimit = FILES_PAGE_SIZE;

let sessionNewFileIds = new Set();
let sessionAdminPin = "";
let isAdminSyncing = false;
let lastShownUrgentSignature = "";

/* =========================================================================
   3. طبقة التخزين الآمنة (Safari Private Mode & Storage Protection)
   ========================================================================= */
function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    return false;
  }
}

/* =========================================================================
   4. دوال مساعدة عامة
   ========================================================================= */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cloneObj(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function showToast(message, type = "default") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.2s";
    setTimeout(() => toast.remove(), 220);
  }, 2600);
}

function formatFileSize(sizeKB) {
  const kb = Number(sizeKB);
  if (!kb || Number.isNaN(kb) || kb <= 0) return "غير محدد";
  if (kb < 1024) return `${Math.round(kb)} كيلوبايت`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} ميجابايت`;
}

function getFileBadge(fileName) {
  const match = String(fileName || "").match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1].toUpperCase() : "FILE";
}

function getEmbedPreviewUrl(url) {
  if (!url) return "";
  return url.replace(/\/view(\?.*)?$/i, "/preview$1");
}

function detectTodayKey() {
  const todayJs = new Date().getDay();
  const found = DAYS_ORDER.find(d => d.jsDay === todayJs);
  return found ? found.key : "saturday";
}

function getCourseVisual(courseName) {
  const name = String(courseName || "").toLowerCase();
  if (name.includes("math") || name.includes("رياض")) {
    return { bg: "#eff6ff", color: "#1d4ed8", svg: `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M4 19h16"/><path d="M5 15l4-8 4 5 4-7 2 3"/></svg>` };
  }
  if (name.includes("program") || name.includes("code") || name.includes("برمج")) {
    return { bg: "#f0fdf4", color: "#15803d", svg: `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>` };
  }
  if (name.includes("phys") || name.includes("فيزي")) {
    return { bg: "#fdf4ff", color: "#a21caf", svg: `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)"/></svg>` };
  }
  if (name.includes("english") || name.includes("إنجل") || name.includes("انجل")) {
    return { bg: "#fff7ed", color: "#c2410c", svg: `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>` };
  }
  if (name.includes("arab") || name.includes("عرب")) {
    return { bg: "#fef2f2", color: "#b91c1c", svg: `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>` };
  }
  if (name.includes("computer") || name.includes("intro") || name.includes("حاس")) {
    return { bg: "#ecfeff", color: "#0e7490", svg: `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>` };
  }
  return { bg: "#f1f5f9", color: "#334155", svg: `<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>` };
}

function hideSplashScreen() {
  const splash = document.getElementById("appSplash");
  if (!splash || splash.classList.contains("fade-out")) return;
  splash.classList.add("fade-out");
  setTimeout(() => splash.remove(), 320);
}

/* =========================================================================
   5. تتبع الملفات الجديدة (شارة "جديد")
   ========================================================================= */
function extractAllFileIds(courses) {
  const ids = [];
  (courses || []).forEach(course => {
    (course.sections || []).forEach(sec => {
      (sec.files || []).forEach(file => {
        if (file && file.id) ids.push(String(file.id));
      });
    });
  });
  return ids;
}

function loadSeenFileIds() {
  const raw = safeStorageGet(STORAGE_KEYS.SEEN_FILES);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : null;
  } catch (err) {
    return null;
  }
}

function saveSeenFileIds(idSet) {
  safeStorageSet(STORAGE_KEYS.SEEN_FILES, JSON.stringify(Array.from(idSet)));
}

function detectNewFilesFromData(courses) {
  const currentIds = extractAllFileIds(courses);
  const storedSeen = loadSeenFileIds();

  if (storedSeen === null) {
    saveSeenFileIds(new Set(currentIds));
    return;
  }

  currentIds.forEach(id => {
    if (!storedSeen.has(id)) {
      sessionNewFileIds.add(id);
    }
  });
}

function markSectionFilesAsSeen(files) {
  if (!Array.isArray(files) || files.length === 0) return;
  const storedSeen = loadSeenFileIds() || new Set();
  let changed = false;

  files.forEach(file => {
    if (file && file.id) {
      const fid = String(file.id);
      if (!storedSeen.has(fid)) {
        storedSeen.add(fid);
        changed = true;
      }
    }
  });

  if (changed) saveSeenFileIds(storedSeen);
}

function countCourseNewFiles(course) {
  let count = 0;
  (course.sections || []).forEach(sec => {
    (sec.files || []).forEach(file => {
      if (file && file.id && sessionNewFileIds.has(String(file.id))) {
        count++;
      }
    });
  });
  return count;
}

function countCourseFiles(course) {
  return (course.sections || []).reduce(
    (total, sec) => total + (Array.isArray(sec.files) ? sec.files.length : 0),
    0
  );
}

/* =========================================================================
   6. تطبيع وعرض التنبيه العاجل والجدول الأسبوعي من الخادم
   ========================================================================= */
function normalizeNotice(rawNotice) {
  if (!rawNotice || typeof rawNotice !== "object") return null;
  return {
    visible: Boolean(rawNotice.visible ?? rawNotice.enabled ?? rawNotice.active ?? false),
    text: String(rawNotice.text ?? rawNotice.message ?? "").trim()
  };
}

function normalizeSchedule(rawSchedule) {
  if (!rawSchedule || typeof rawSchedule !== "object" || Array.isArray(rawSchedule)) {
    return null;
  }
  const arabicDayMap = {
    "السبت": "saturday",
    "الأحد": "sunday",
    "الاحد": "sunday",
    "الاثنين": "monday",
    "الإثنين": "monday",
    "الثلاثاء": "tuesday",
    "الأربعاء": "wednesday",
    "الاربعاء": "wednesday",
    "الخميس": "thursday"
  };

  const normalized = {};
  DAYS_ORDER.forEach(d => {
    normalized[d.key] = [];
  });

  let hasKnownDayKey = false;
  Object.keys(rawSchedule).forEach(rawKey => {
    const key = arabicDayMap[rawKey] || String(rawKey).toLowerCase().trim();
    if (Object.prototype.hasOwnProperty.call(normalized, key)) {
      hasKnownDayKey = true;
      const dayItems = Array.isArray(rawSchedule[rawKey]) ? rawSchedule[rawKey] : [];
      normalized[key] = dayItems.map(item => ({
        subject: String(item.subject || item.name || ""),
        time: String(item.time || ""),
        room: String(item.room || item.hall || ""),
        doctor: String(item.doctor || item.instructor || "")
      }));
    }
  });

  return hasKnownDayKey ? normalized : null;
}

function applyApiPayload(payload, { isInitialOrManual = false } = {}) {
  // التوافق مع الصيغة الجديدة { subjects, notice, schedule } أو صيغة المصفوفة المباشرة
  let subjects = [];
  let serverNotice = null;
  let serverSchedule = null;

  if (Array.isArray(payload)) {
    subjects = payload;
  } else if (payload && typeof payload === "object") {
    subjects = Array.isArray(payload.subjects)
      ? payload.subjects
      : (Array.isArray(payload.courses) ? payload.courses : []);
    serverNotice = normalizeNotice(payload.notice);
    serverSchedule = normalizeSchedule(payload.schedule);
  }

  coursesData = subjects;
  if (serverNotice) {
    portalData.announcement = serverNotice;
  }
  if (serverSchedule) {
    portalData.schedule = serverSchedule;
  }

  detectNewFilesFromData(coursesData);
  renderArchive();
  renderSchedule();
  renderAnnouncementUI({ openModalIfChanged: isInitialOrManual });
}

function renderAnnouncementUI({ openModalIfChanged = false } = {}) {
  const banner = document.getElementById("urgentBanner");
  const bannerText = document.getElementById("urgentBannerText");
  const modalText = document.getElementById("urgentModalText");
  const { visible, text } = portalData.announcement;
  const hasActiveNotice = Boolean(visible && text && text.trim());

  if (hasActiveNotice) {
    banner.classList.remove("hidden");
    bannerText.textContent = text;
    modalText.textContent = text;

    const signature = `1|${text}`;
    if (openModalIfChanged && signature !== lastShownUrgentSignature) {
      lastShownUrgentSignature = signature;
      openModal("urgentModal");
    }
  } else {
    lastShownUrgentSignature = "";
    banner.classList.add("hidden");
    closeModal("urgentModal");
  }
}

function renderSchedule() {
  const tabsEl = document.getElementById("daysTabs");
  const listEl = document.getElementById("lecturesList");
  const todayJs = new Date().getDay();

  tabsEl.innerHTML = DAYS_ORDER.map(day => {
    const isActive = day.key === activeDayKey;
    const isToday = day.jsDay === todayJs;
    return `
      <button
        type="button"
        class="day-tab ${isActive ? "active" : ""}"
        role="tab"
        aria-selected="${isActive}"
        data-day-key="${day.key}"
      >
        <span>${escapeHtml(day.label)}</span>
        ${isToday ? `<span class="today-chip">اليوم</span>` : ""}
      </button>
    `;
  }).join("");

  const lectures = Array.isArray(portalData.schedule[activeDayKey])
    ? portalData.schedule[activeDayKey]
    : [];

  if (lectures.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="border-style: solid;">
        <h3>لا توجد محاضرات مسجلة لهذا اليوم</h3>
        <p style="margin-bottom: 0;">يمكنك مراجعة الملازم والملفات المتوفرة بالأعلى.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = lectures.map(lec => `
    <article class="lecture-item">
      <div class="lecture-subject">${escapeHtml(lec.subject)}</div>
      <div class="lecture-details">
        <span class="lecture-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${escapeHtml(lec.time)}</span>
        </span>
        <span class="lecture-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>${escapeHtml(lec.room)}</span>
        </span>
        <span class="lecture-detail">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>${escapeHtml(lec.doctor)}</span>
        </span>
      </div>
    </article>
  `).join("");
}

/* =========================================================================
   7. جلب البيانات والمزامنة عبر GET (كاش فوري + تحديث بالخلفية)
   ========================================================================= */
function renderLoadingSkeleton() {
  const container = document.getElementById("coursesContainer");
  container.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-box skeleton-icon"></div>
      <div class="skeleton-lines">
        <div class="skeleton-box skeleton-line-lg"></div>
        <div class="skeleton-box skeleton-line-sm"></div>
      </div>
    </div>
  `).join("");
  document.getElementById("archiveStatsText").textContent = "جاري جلب البيانات من Google Drive...";
}

function setSyncStatus(text, spinning = false) {
  const pill = document.getElementById("syncStatusPill");
  if (pill) pill.textContent = text;

  [document.getElementById("refreshFilesBtn"), document.getElementById("headerRefreshBtn")].forEach(b => {
    if (b) b.disabled = spinning;
  });
  [document.getElementById("refreshFilesIcon"), document.getElementById("headerRefreshIcon")].forEach(ic => {
    if (ic) ic.classList.toggle("spin", spinning);
  });
}

function loadPortalCache() {
  const raw = safeStorageGet(STORAGE_KEYS.PORTAL_CACHE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.payload ? parsed : null;
  } catch (err) {
    return null;
  }
}

function savePortalCache(payload) {
  const timestamp = Date.now();
  safeStorageSet(STORAGE_KEYS.PORTAL_CACHE, JSON.stringify({ timestamp, payload }));
  return timestamp;
}

function updateCachedPortalFields() {
  const existing = loadPortalCache();
  const baseSubjects = Array.isArray(existing?.payload)
    ? existing.payload
    : (existing?.payload?.subjects || coursesData);

  savePortalCache({
    subjects: baseSubjects,
    notice: portalData.announcement,
    schedule: portalData.schedule
  });
}

function formatSyncTime(ts) {
  if (!ts) return "";
  return `آخر تحديث: ${new Date(ts).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`;
}

async function fetchPortalData({ forceRefresh = false } = {}) {
  const cached = loadPortalCache();

  // عرض فوري للكاش عند الفتح ثم التحديث الصامت في الخلفية
  if (!forceRefresh && cached) {
    applyApiPayload(cached.payload, { isInitialOrManual: true });
    hideSplashScreen();
    setSyncStatus(`${formatSyncTime(cached.timestamp)} • جاري المزامنة...`, false);
    silentBackgroundSync();
    return;
  }

  renderLoadingSkeleton();
  setSyncStatus("جاري التحديث...", true);

  try {
    const url = forceRefresh ? `${API_URL}?_=${Date.now()}` : API_URL;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = await response.json();
    const ts = savePortalCache(json);
    applyApiPayload(json, { isInitialOrManual: true });
    setSyncStatus(formatSyncTime(ts), false);

    if (forceRefresh) {
      showToast("تم تحديث الملازم والجدول بنجاح", "success");
    }
  } catch (err) {
    if (cached) {
      applyApiPayload(cached.payload, { isInitialOrManual: true });
      setSyncStatus("عرض النسخة المحفوظة", false);
      showToast("تعذر الاتصال الآن، تم عرض النسخة المحفوظة", "error");
    } else {
      renderArchiveError();
      setSyncStatus("تعذر الاتصال", false);
    }
  } finally {
    hideSplashScreen();
  }
}

async function silentBackgroundSync() {
  try {
    const response = await fetch(`${API_URL}?_=${Date.now()}`);
    if (!response.ok) return;
    const json = await response.json();
    const ts = savePortalCache(json);
    applyApiPayload(json, { isInitialOrManual: true });
    setSyncStatus(formatSyncTime(ts), false);
  } catch (err) {
    const cached = loadPortalCache();
    setSyncStatus(cached ? formatSyncTime(cached.timestamp) : "", false);
  }
}

function renderArchiveError() {
  const container = document.getElementById("coursesContainer");
  container.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <h3>تعذر تحميل البيانات من الخادم</h3>
      <p>تحقق من اتصال الإنترنت ثم اضغط إعادة المحاولة.</p>
      <button type="button" class="btn btn-primary btn-sm" onclick="fetchPortalData({ forceRefresh: true })">إعادة المحاولة</button>
    </div>
  `;
  document.getElementById("archiveStatsText").textContent = "تعذر الاتصال بالأرشيف";
}

/* =========================================================================
   8. عرض الأرشيف والبحث والتحميل التدريجي
   ========================================================= */
function renderArchive() {
  const searchInput = document.getElementById("searchInput");
  const query = searchInput.value.trim().toLowerCase();
  const clearBtn = document.getElementById("clearSearchBtn");
  const container = document.getElementById("coursesContainer");
  const filesBox = document.getElementById("searchFilesContainer");

  clearBtn.classList.toggle("visible", query.length > 0);

  const totalFiles = coursesData.reduce((sum, c) => sum + countCourseFiles(c), 0);
  const totalNew = sessionNewFileIds.size;
  document.getElementById("archiveStatsText").textContent = totalNew > 0
    ? `${coursesData.length} مواد • ${totalFiles} ملف (${totalNew} جديد)`
    : `${coursesData.length} مواد دراسية • ${totalFiles} ملف`;

  let filteredCourses = coursesData;
  const matchingFiles = [];

  if (query) {
    filteredCourses = coursesData.filter(course => {
      const nameMatch = String(course.name || "").toLowerCase().includes(query);
      let fileMatch = false;

      (course.sections || []).forEach(sec => {
        (sec.files || []).forEach(file => {
          if (String(file.name || "").toLowerCase().includes(query)) {
            fileMatch = true;
            matchingFiles.push({
              courseName: course.name,
              sectionName: sec.name || "ملفات عامة",
              file
            });
          }
        });
      });

      return nameMatch || fileMatch;
    });
  }

  if (filteredCourses.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>لا توجد نتائج مطابقة</h3>
        <p style="margin-bottom: 0;">لم نعثر على مواد أو ملفات تطابق "${escapeHtml(query)}"</p>
      </div>
    `;
  } else {
    container.innerHTML = filteredCourses.map(course => {
      const visual = getCourseVisual(course.name);
      const count = countCourseFiles(course);
      const sectionsCount = Array.isArray(course.sections) ? course.sections.length : 0;
      const newCount = countCourseNewFiles(course);

      return `
        <article class="course-card" role="button" tabindex="0" data-course-id="${escapeHtml(course.id)}">
          <div class="course-icon" style="background: ${visual.bg}; color: ${visual.color};">
            ${visual.svg}
          </div>
          <div class="course-info">
            <h3 class="course-name">${escapeHtml(course.name)}</h3>
            <div class="course-meta">
              <span class="badge-count">${count} ملف</span>
              <span>${sectionsCount} أقسام</span>
              ${newCount > 0 ? `<span class="badge-new">${newCount} جديد</span>` : ""}
            </div>
          </div>
          <svg class="course-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
        </article>
      `;
    }).join("");
  }

  if (query && matchingFiles.length > 0) {
    filesBox.classList.remove("hidden");
    const visibleItems = matchingFiles.slice(0, searchVisibleLimit);
    const remaining = matchingFiles.length - visibleItems.length;

    filesBox.innerHTML = `
      <div class="search-files-title">
        <span>ملفات مطابقة للبحث (${matchingFiles.length})</span>
      </div>
      <div class="files-list">
        ${visibleItems.map(item => renderFileItemHtml(item.file, `${item.courseName} • ${item.sectionName}`)).join("")}
      </div>
      ${remaining > 0 ? `
        <div class="load-more-wrap">
          <button type="button" id="searchLoadMoreBtn" class="btn btn-outline btn-sm">
            عرض المزيد (متبقي ${remaining})
          </button>
        </div>
      ` : ""}
    `;
  } else {
    filesBox.classList.add("hidden");
    filesBox.innerHTML = "";
  }

  renderFutureRecordingsSlot();
}

function renderFutureRecordingsSlot() {
  const slot = document.getElementById("recordingsFutureSlot");
  if (!slot) return;

  if (!FUTURE_RECORDINGS_CONFIG.enabled || FUTURE_RECORDINGS_CONFIG.items.length === 0) {
    slot.classList.add("hidden");
    return;
  }

  slot.classList.remove("hidden");
  slot.innerHTML = `
    <div class="search-files-title">${escapeHtml(FUTURE_RECORDINGS_CONFIG.title)}</div>
    <p style="font-size: 0.8rem; color: var(--text-light); margin-bottom: 10px;">${escapeHtml(FUTURE_RECORDINGS_CONFIG.subtitle)}</p>
    <div class="files-list">
      ${FUTURE_RECORDINGS_CONFIG.items.map(rec => `
        <div class="file-item">
          <div class="file-top">
            <div class="file-type-icon">REC</div>
            <div class="file-details">
              <div class="file-name">${escapeHtml(rec.title)}</div>
              <div class="file-meta">${escapeHtml(rec.course || "")}</div>
            </div>
          </div>
          <div class="file-actions">
            <a href="${escapeHtml(rec.url)}" target="_blank" rel="noopener noreferrer" class="file-action-btn preview">فتح التسجيل</a>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderFileItemHtml(file, extraSubtitle = "") {
  const ext = getFileBadge(file.name);
  const sizeStr = formatFileSize(file.sizeKB);
  const previewUrl = file.previewUrl || "";
  const downloadUrl = file.downloadUrl || previewUrl;
  const isNew = file && file.id && sessionNewFileIds.has(String(file.id));

  return `
    <div class="file-item ${isNew ? "is-new" : ""}">
      <div class="file-top">
        <div class="file-type-icon">${escapeHtml(ext)}</div>
        <div class="file-details">
          <div class="file-title-row">
            <div class="file-name">${escapeHtml(file.name)}</div>
            ${isNew ? `<span class="badge-new">جديد</span>` : ""}
          </div>
          <div class="file-meta">
            <span>الحجم: ${escapeHtml(sizeStr)}</span>
            ${extraSubtitle ? `<span>• ${escapeHtml(extraSubtitle)}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="file-actions">
        <button
          type="button"
          class="file-action-btn preview"
          data-action="preview"
          data-url="${escapeHtml(previewUrl)}"
          data-name="${escapeHtml(file.name)}"
        >
          <span>معاينة</span>
        </button>
        <a
          href="${escapeHtml(downloadUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="file-action-btn download"
        >
          <span>تحميل مباشر</span>
        </a>
        <button
          type="button"
          class="file-action-btn copy"
          data-action="copy"
          data-url="${escapeHtml(previewUrl)}"
        >
          <span>نسخ الرابط</span>
        </button>
      </div>
    </div>
  `;
}

/* =========================================================================
   9. نافذة المادة والمعاينة والنسخ
   ========================================================= */
function openCourseModal(courseId) {
  const course = coursesData.find(c => String(c.id) === String(courseId));
  if (!course) return;

  currentModalCourse = course;
  currentSectionIndex = 0;
  sectionVisibleLimit = FILES_PAGE_SIZE;

  document.getElementById("courseModalTitle").textContent = course.name || "تفاصيل المادة";
  renderCourseModalBody();
  openModal("courseModal");
}

function renderCourseModalBody() {
  const tabsEl = document.getElementById("courseSectionTabs");
  const filesEl = document.getElementById("courseFilesList");
  const loadMoreWrap = document.getElementById("courseLoadMoreWrap");
  const loadMoreBtn = document.getElementById("courseLoadMoreBtn");

  const sections = Array.isArray(currentModalCourse?.sections) ? currentModalCourse.sections : [];

  if (sections.length === 0) {
    tabsEl.innerHTML = "";
    loadMoreWrap.classList.add("hidden");
    filesEl.innerHTML = `
      <div class="empty-state">
        <h3>لا توجد أقسام أو ملفات حالياً</h3>
        <p style="margin-bottom: 0;">سيتم عرض أي مجلدات أو ملفات تُضاف في Google Drive تلقائياً.</p>
      </div>
    `;
    return;
  }

  if (currentSectionIndex >= sections.length) currentSectionIndex = 0;

  tabsEl.innerHTML = sections.map((sec, idx) => {
    const count = Array.isArray(sec.files) ? sec.files.length : 0;
    return `
      <button
        type="button"
        class="section-tab-btn ${idx === currentSectionIndex ? "active" : ""}"
        data-section-index="${idx}"
      >
        ${escapeHtml(sec.name || "ملفات عامة")} (${count})
      </button>
    `;
  }).join("");

  const activeSection = sections[currentSectionIndex];
  const allFiles = Array.isArray(activeSection?.files) ? activeSection.files : [];

  if (allFiles.length === 0) {
    loadMoreWrap.classList.add("hidden");
    filesEl.innerHTML = `
      <div class="empty-state">
        <h3>هذا القسم فارغ حالياً</h3>
        <p style="margin-bottom: 0;">لم تُرفع ملفات داخل "${escapeHtml(activeSection.name)}" بعد.</p>
      </div>
    `;
    return;
  }

  markSectionFilesAsSeen(allFiles);

  const visibleFiles = allFiles.slice(0, sectionVisibleLimit);
  const remaining = allFiles.length - visibleFiles.length;

  filesEl.innerHTML = visibleFiles.map(file => renderFileItemHtml(file)).join("");

  if (remaining > 0) {
    loadMoreWrap.classList.remove("hidden");
    loadMoreBtn.textContent = `عرض المزيد من الملفات (متبقي ${remaining})`;
  } else {
    loadMoreWrap.classList.add("hidden");
  }
}

function openPreviewModal(previewUrl, fileName) {
  if (!previewUrl) {
    showToast("رابط المعاينة غير متوفر", "error");
    return;
  }
  document.getElementById("previewModalTitle").textContent = fileName || "معاينة الملف";
  document.getElementById("previewExternalLink").href = previewUrl;
  document.getElementById("previewIframe").src = getEmbedPreviewUrl(previewUrl);
  openModal("previewModal");
}

async function copyText(text) {
  if (!text) {
    showToast("لا يوجد رابط للنسخ", "error");
    return;
  }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    showToast("تم نسخ الرابط", "success");
  } catch (err) {
    showToast("تعذر نسخ الرابط", "error");
  }
}

/* =========================================================================
   10. إدارة النوافذ المنبثقة (Modals)
   ========================================================= */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("open");
  if (id === "previewModal") {
    document.getElementById("previewIframe").src = "about:blank";
  }
  if (!document.querySelector(".modal-backdrop.open")) {
    document.body.style.overflow = "";
  }
}

/* =========================================================================
   11. لوحة الإدارة والمزامنة عبر POST بصيغة text/plain
   ========================================================= */
function setAdminSyncBanner(message = "", type = "info") {
  const banner = document.getElementById("adminSyncBanner");
  if (!banner) return;
  if (!message) {
    banner.classList.add("hidden");
    banner.textContent = "";
    return;
  }
  banner.className = `admin-sync-banner ${type}`;
  banner.textContent = message;
}

function setAdminControlsDisabled(disabled) {
  isAdminSyncing = disabled;
  const ids = ["saveAnnouncementBtn", "saveLectureBtn", "adminScheduleDaySelect"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
}

async function syncAdminUpdatesToServer(previousSnapshot, successMessage) {
  setAdminControlsDisabled(true);
  setAdminSyncBanner("جاري حفظ التعديلات ومزامنتها لجميع الطلاب...", "info");

  const payload = {
    pin: sessionAdminPin,
    notice: {
      visible: Boolean(portalData.announcement.visible),
      enabled: Boolean(portalData.announcement.visible),
      text: String(portalData.announcement.text || "").trim()
    },
    schedule: portalData.schedule
  };

  try {
    // إرسال POST بصيغة text/plain لتجنب مشاكل CORS Preflight في Google Apps Script
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`فشل الاتصال بالخادم (${response.status})`);
    }

    const rawText = await response.text();
    let resJson = null;
    try {
      resJson = JSON.parse(rawText);
    } catch (_) {
      resJson = null;
    }

    if (
      resJson &&
      (resJson.ok === false ||
        resJson.success === false ||
        resJson.status === "error" ||
        Boolean(resJson.error))
    ) {
      throw new Error(resJson.error || resJson.message || "تم رفض التعديل من الخادم (تأكد من الرمز السري)");
    }

    // تحديث الكاش المحلي والواجهة فوراً بعد نجاح الحفظ في السحابة
    updateCachedPortalFields();
    renderAnnouncementUI({ openModalIfChanged: false });
    renderSchedule();
    renderAdminDayLectures();
    refreshExportBox();

    setAdminSyncBanner(successMessage, "success");
    showToast(successMessage, "success");
    return true;
  } catch (err) {
    // التراجع عن التعديل المحلي إذا فشل الحفظ في السحابة لضمان تطابق البيانات
    portalData = previousSnapshot;
    renderAnnouncementUI({ openModalIfChanged: false });
    renderSchedule();
    populateAdminPanel();

    const errMsg = err && err.message ? err.message : "حدث خطأ أثناء الحفظ، حاول مرة أخرى";
    setAdminSyncBanner(`خطأ: ${errMsg}`, "error");
    showToast(errMsg, "error");
    return false;
  } finally {
    setAdminControlsDisabled(false);
  }
}

function populateAdminPanel() {
  document.getElementById("adminAnnouncementVisible").checked = Boolean(portalData.announcement.visible);
  document.getElementById("adminAnnouncementText").value = portalData.announcement.text || "";

  const select = document.getElementById("adminScheduleDaySelect");
  select.innerHTML = DAYS_ORDER.map(d => `<option value="${d.key}">${escapeHtml(d.label)}</option>`).join("");
  select.value = activeDayKey;

  renderAdminDayLectures();
  refreshExportBox();
}

function renderAdminDayLectures() {
  const dayKey = document.getElementById("adminScheduleDaySelect").value;
  const listEl = document.getElementById("adminDayLecturesList");
  const lectures = portalData.schedule[dayKey] || [];

  if (lectures.length === 0) {
    listEl.innerHTML = `<p style="font-size: 0.84rem; color: var(--text-light); padding: 6px 0;">لا توجد حصص لهذا اليوم.</p>`;
    return;
  }

  listEl.innerHTML = lectures.map((lec, idx) => `
    <div class="admin-lecture-row">
      <div style="min-width: 0;">
        <div style="font-weight: 800; font-size: 0.88rem; color: var(--navy-900);">${escapeHtml(lec.subject)}</div>
        <div style="font-size: 0.77rem; color: var(--text-muted);">${escapeHtml(lec.time)} • ${escapeHtml(lec.room)} • ${escapeHtml(lec.doctor)}</div>
      </div>
      <div style="display: flex; gap: 6px; flex-shrink: 0;">
        <button type="button" class="btn btn-soft btn-sm" data-admin-edit="${idx}">تعديل</button>
        <button type="button" class="btn btn-danger-soft btn-sm" data-admin-delete="${idx}">حذف</button>
      </div>
    </div>
  `).join("");
}

function resetAdminLectureForm() {
  document.getElementById("editLectureIndex").value = "-1";
  document.getElementById("adminLectureFormTitle").textContent = "إضافة حصة جديدة";
  document.getElementById("saveLectureBtn").textContent = "حفظ وإضافة للجدول";
  document.getElementById("cancelEditLectureBtn").classList.add("hidden");
  document.getElementById("adminLectureForm").reset();
}

function refreshExportBox() {
  const backupData = {
    notice: portalData.announcement,
    schedule: portalData.schedule
  };
  document.getElementById("exportJsonBox").textContent = JSON.stringify(backupData, null, 2);
}

/* =========================================================================
   12. ربط الأحداث وتشغيل التطبيق
   ========================================================================= */
function initEvents() {
  document.getElementById("refreshFilesBtn").addEventListener("click", () => fetchPortalData({ forceRefresh: true }));
  document.getElementById("headerRefreshBtn").addEventListener("click", () => fetchPortalData({ forceRefresh: true }));

  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", () => {
    searchVisibleLimit = FILES_PAGE_SIZE;
    renderArchive();
  });

  document.getElementById("clearSearchBtn").addEventListener("click", () => {
    searchInput.value = "";
    searchVisibleLimit = FILES_PAGE_SIZE;
    renderArchive();
    searchInput.focus();
  });

  document.getElementById("coursesContainer").addEventListener("click", e => {
    const card = e.target.closest(".course-card");
    if (card) openCourseModal(card.dataset.courseId);
  });

  document.getElementById("coursesContainer").addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest(".course-card");
      if (card) {
        e.preventDefault();
        openCourseModal(card.dataset.courseId);
      }
    }
  });

  document.getElementById("courseSectionTabs").addEventListener("click", e => {
    const btn = e.target.closest(".section-tab-btn");
    if (!btn) return;
    currentSectionIndex = Number(btn.dataset.sectionIndex);
    sectionVisibleLimit = FILES_PAGE_SIZE;
    renderCourseModalBody();
  });

  document.getElementById("courseLoadMoreBtn").addEventListener("click", () => {
    sectionVisibleLimit += FILES_PAGE_SIZE;
    renderCourseModalBody();
  });

  document.addEventListener("click", e => {
    if (e.target && e.target.id === "searchLoadMoreBtn") {
      searchVisibleLimit += FILES_PAGE_SIZE;
      renderArchive();
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const url = actionBtn.dataset.url;
      const name = actionBtn.dataset.name;
      if (action === "preview") openPreviewModal(url, name);
      else if (action === "copy") copyText(url);
      return;
    }

    const closeBtn = e.target.closest("[data-close-modal]");
    if (closeBtn) {
      closeModal(closeBtn.dataset.closeModal);
      return;
    }

    if (e.target.classList.contains("modal-backdrop")) {
      closeModal(e.target.id);
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      const opened = document.querySelectorAll(".modal-backdrop.open");
      if (opened.length > 0) closeModal(opened[opened.length - 1].id);
    }
  });

  document.getElementById("ackUrgentBtn").addEventListener("click", () => closeModal("urgentModal"));
  document.getElementById("reopenUrgentModalBtn").addEventListener("click", () => openModal("urgentModal"));

  document.getElementById("daysTabs").addEventListener("click", e => {
    const tab = e.target.closest(".day-tab");
    if (!tab) return;
    activeDayKey = tab.dataset.dayKey;
    renderSchedule();
  });

  document.querySelectorAll("[data-quick-nav]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-quick-nav]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // تسجيل دخول لوحة الإدارة
  document.getElementById("openAdminLoginBtn").addEventListener("click", () => {
    document.getElementById("adminPinInput").value = "";
    document.getElementById("adminLoginError").classList.add("hidden");
    openModal("adminLoginModal");
    setTimeout(() => document.getElementById("adminPinInput").focus(), 100);
  });

  document.getElementById("adminLoginForm").addEventListener("submit", e => {
    e.preventDefault();
    const pin = document.getElementById("adminPinInput").value.trim();
    if (!pin || (ADMIN_PIN && pin !== ADMIN_PIN)) {
      document.getElementById("adminLoginError").classList.remove("hidden");
      return;
    }
    sessionAdminPin = pin;
    setAdminSyncBanner("");
    closeModal("adminLoginModal");
    populateAdminPanel();
    openModal("adminPanelModal");
  });

  document.querySelectorAll(".admin-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.adminTab;
      document.getElementById("adminTabAnnouncement").classList.toggle("hidden", target !== "announcement");
      document.getElementById("adminTabSchedule").classList.toggle("hidden", target !== "schedule");
      document.getElementById("adminTabBackup").classList.toggle("hidden", target !== "backup");
      if (target === "backup") refreshExportBox();
    });
  });

  // حفظ التنبيه العاجل وإرساله عبر POST
  document.getElementById("saveAnnouncementBtn").addEventListener("click", async () => {
    if (isAdminSyncing) return;
    const prevSnapshot = cloneObj(portalData);

    portalData.announcement.visible = document.getElementById("adminAnnouncementVisible").checked;
    portalData.announcement.text = document.getElementById("adminAnnouncementText").value.trim();

    await syncAdminUpdatesToServer(prevSnapshot, "تم تحديث التنبيه العاجل لجميع الطلاب بنجاح");
  });

  document.getElementById("adminScheduleDaySelect").addEventListener("change", () => {
    resetAdminLectureForm();
    renderAdminDayLectures();
  });

  // تعديل أو حذف حصة من الجدول وإرسال التعديل عبر POST
  document.getElementById("adminDayLecturesList").addEventListener("click", async e => {
    if (isAdminSyncing) return;
    const dayKey = document.getElementById("adminScheduleDaySelect").value;
    const editBtn = e.target.closest("[data-admin-edit]");
    const delBtn = e.target.closest("[data-admin-delete]");

    if (editBtn) {
      const idx = Number(editBtn.dataset.adminEdit);
      const lec = portalData.schedule[dayKey][idx];
      if (!lec) return;
      document.getElementById("editLectureIndex").value = idx;
      document.getElementById("lecSubjectInput").value = lec.subject;
      document.getElementById("lecTimeInput").value = lec.time;
      document.getElementById("lecRoomInput").value = lec.room;
      document.getElementById("lecDoctorInput").value = lec.doctor;
      document.getElementById("adminLectureFormTitle").textContent = "تعديل الحصة";
      document.getElementById("saveLectureBtn").textContent = "حفظ التعديل للجميع";
      document.getElementById("cancelEditLectureBtn").classList.remove("hidden");
    } else if (delBtn) {
      const idx = Number(delBtn.dataset.adminDelete);
      const prevSnapshot = cloneObj(portalData);
      portalData.schedule[dayKey].splice(idx, 1);
      await syncAdminUpdatesToServer(prevSnapshot, "تم حذف الحصة وتحديث الجدول للجميع");
    }
  });

  document.getElementById("cancelEditLectureBtn").addEventListener("click", resetAdminLectureForm);

  // إضافة أو حفظ تعديل حصة وإرساله عبر POST
  document.getElementById("adminLectureForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (isAdminSyncing) return;

    const dayKey = document.getElementById("adminScheduleDaySelect").value;
    const prevSnapshot = cloneObj(portalData);

    if (!Array.isArray(portalData.schedule[dayKey])) {
      portalData.schedule[dayKey] = [];
    }

    const lectureObj = {
      subject: document.getElementById("lecSubjectInput").value.trim(),
      time: document.getElementById("lecTimeInput").value.trim(),
      room: document.getElementById("lecRoomInput").value.trim(),
      doctor: document.getElementById("lecDoctorInput").value.trim()
    };

    const editIdx = Number(document.getElementById("editLectureIndex").value);
    const isEditing = editIdx >= 0 && portalData.schedule[dayKey][editIdx];

    if (isEditing) {
      portalData.schedule[dayKey][editIdx] = lectureObj;
    } else {
      portalData.schedule[dayKey].push(lectureObj);
    }

    const ok = await syncAdminUpdatesToServer(
      prevSnapshot,
      isEditing ? "تم تعديل الحصة ونشرها للجميع" : "تمت إضافة الحصة ونشرها للجميع"
    );

    if (ok) {
      resetAdminLectureForm();
    }
  });

  // التصدير والاستيراد الاحتياطي
  document.getElementById("copyConfigBtn").addEventListener("click", () => {
    copyText(document.getElementById("exportJsonBox").textContent);
  });

  document.getElementById("downloadConfigBtn").addEventListener("click", () => {
    const backupData = {
      notice: portalData.announcement,
      schedule: portalData.schedule
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-portal-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("تم تصدير النسخة الاحتياطية", "success");
  });

  document.getElementById("importConfigFile").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file || isAdminSyncing) return;

    const reader = new FileReader();
    reader.onload = async ev => {
      const prevSnapshot = cloneObj(portalData);
      try {
        const parsed = JSON.parse(ev.target.result);
        const importedNotice = normalizeNotice(parsed.notice || parsed.announcement);
        const importedSchedule = normalizeSchedule(parsed.schedule);

        if (!importedNotice && !importedSchedule) {
          throw new Error("صيغة الملف غير متوافقة");
        }

        if (importedNotice) portalData.announcement = importedNotice;
        if (importedSchedule) portalData.schedule = importedSchedule;

        populateAdminPanel();
        await syncAdminUpdatesToServer(prevSnapshot, "تم استيراد البيانات ونشرها لجميع الطلاب");
      } catch (err) {
        portalData = prevSnapshot;
        showToast("ملف JSON غير صالح", "error");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initEvents();
  renderSchedule();
  fetchPortalData({ forceRefresh: false });

  // إخفاء شاشة البداية سريعاً إذا تأخرت الشبكة لإظهار بطاقات Skeleton
  setTimeout(hideSplashScreen, 1200);
});
