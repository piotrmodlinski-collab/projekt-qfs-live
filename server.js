require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const rootDir = __dirname;
const secureViewsDir = path.join(rootDir, ".secure");
const bundledSecureViewsDir = path.join(rootDir, "secure-views");
const panelDataFile = path.join(secureViewsDir, "panel-data.json");
const taskAttachmentUploadsDir = path.join(secureViewsDir, "uploads");
const contactBriefsFile = path.join(secureViewsDir, "contact-briefs.jsonl");
const bundledSecureViewFiles = ["logowanie.html", "panel.html"];

const MAX_TASK_ATTACHMENTS = 12;
const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;

fs.mkdirSync(secureViewsDir, { recursive: true });
fs.mkdirSync(taskAttachmentUploadsDir, { recursive: true });

for (const viewFile of bundledSecureViewFiles) {
  const sourcePath = path.join(bundledSecureViewsDir, viewFile);
  const targetPath = path.join(secureViewsDir, viewFile);
  if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }
}

const port = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === "production";
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || `${baseUrl}/auth/google/callback`;
const localPanelLogin = process.env.PANEL_LOGIN || "admin";
const localPanelPassword = process.env.PANEL_PASSWORD || "QFS123!";
const sessionSecret = process.env.SESSION_SECRET || "qfs-dev-session-secret-change-me";

const allowedEmailSet = new Set(
  (process.env.ALLOWED_GMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
);

const isGoogleConfigured = Boolean(googleClientId && googleClientSecret);

if (isProd && sessionSecret === "qfs-dev-session-secret-change-me") {
  throw new Error("SESSION_SECRET musi byc ustawiony w production.");
}

const STATUS_COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

const STATUS_KEYS = new Set(STATUS_COLUMNS.map((col) => col.key));
const PRIORITY_VALUES = ["low", "medium", "high", "critical"];
const PERMISSION_KEYS = ["kanban", "schedule", "archive", "users"];
const ALLOWED_ATTACHMENT_MIME_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "text/",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream",
];

const taskAttachmentStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, taskAttachmentUploadsDir);
  },
  filename(_req, file, cb) {
    const originalExt = path.extname(String(file.originalname || "")).toLowerCase();
    const safeExt = /^[.][a-z0-9]{1,10}$/.test(originalExt) ? originalExt : "";
    const randomPart = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    cb(null, `att-${randomPart}${safeExt}`);
  },
});

const taskAttachmentUpload = multer({
  storage: taskAttachmentStorage,
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    const mime = String(file.mimetype || "").toLowerCase();
    const isAllowed = ALLOWED_ATTACHMENT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
    if (!isAllowed) {
      cb(new Error("Nieobslugiwany typ pliku."));
      return;
    }
    cb(null, true);
  },
});

function nowIso() {
  return new Date().toISOString();
}

function toFiniteNumber(value, fallback) {
  const num = Number(value);
  if (Number.isFinite(num)) {
    return num;
  }
  return fallback;
}

function dayPlus(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function makeAttachmentUrl(taskId, attachmentId) {
  return `/api/panel/task/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

function sanitizeAttachmentName(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return normalized || "zalacznik";
}

function sanitizeStoredFileName(value) {
  const fileName = path.basename(String(value || "").trim());
  if (!fileName) {
    return "";
  }
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "");
}

function sanitizeTaskAttachments(attachmentsValue, taskId) {
  if (!Array.isArray(attachmentsValue)) {
    return [];
  }

  return attachmentsValue
    .map((entry) => {
      const attachmentId = String(entry.id || `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).trim();
      const fileName = sanitizeStoredFileName(entry.fileName);
      if (!attachmentId || !fileName) {
        return null;
      }

      const size = Number(entry.size);
      const mime = String(entry.mime || "application/octet-stream").trim().slice(0, 120);

      return {
        id: attachmentId,
        name: sanitizeAttachmentName(entry.name || fileName),
        fileName,
        size: Number.isFinite(size) && size >= 0 ? size : 0,
        mime: mime || "application/octet-stream",
        uploadedAt: entry.uploadedAt || nowIso(),
        uploadedBy: entry.uploadedBy || "system",
        url: makeAttachmentUrl(taskId, attachmentId),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_TASK_ATTACHMENTS);
}

function resolveAttachmentFilePath(fileNameValue) {
  const fileName = sanitizeStoredFileName(fileNameValue);
  if (!fileName) {
    return null;
  }

  const resolvedBase = path.resolve(taskAttachmentUploadsDir);
  const resolvedPath = path.resolve(taskAttachmentUploadsDir, fileName);
  const normalizedBase = resolvedBase.toLowerCase();
  const normalizedPath = resolvedPath.toLowerCase();

  if (!(normalizedPath === normalizedBase || normalizedPath.startsWith(`${normalizedBase}${path.sep}`))) {
    return null;
  }

  return resolvedPath;
}

function makeTask(task) {
  const timeline = normalizeTaskTimeline({
    startDate: task.startDate,
    endDate: task.endDate,
    dueDate: task.dueDate,
  });

  return {
    id: task.id,
    title: task.title,
    description: task.description || "",
    status: STATUS_KEYS.has(task.status) ? task.status : "backlog",
    priority: PRIORITY_VALUES.includes(task.priority) ? task.priority : "medium",
    labels: Array.isArray(task.labels) ? task.labels.map((label) => String(label).trim()).filter(Boolean).slice(0, 8) : [],
    assignee: String(task.assignee || "Nieprzypisane"),
    startDate: timeline.startDate,
    endDate: timeline.endDate,
    dueDate: timeline.dueDate,
    sortOrder: toFiniteNumber(task.sortOrder, 0),
    attachments: sanitizeTaskAttachments(task.attachments, task.id),
    archived: Boolean(task.archived),
    createdAt: task.createdAt || nowIso(),
    updatedAt: task.updatedAt || nowIso(),
    createdBy: task.createdBy || "system",
  };
}

function makeSchedule(schedule) {
  return {
    id: schedule.id,
    taskId: schedule.taskId || null,
    title: String(schedule.title || ""),
    date: String(schedule.date || ""),
    start: String(schedule.start || "09:00"),
    end: String(schedule.end || "10:00"),
    owner: String(schedule.owner || "Nieprzypisane"),
    status: schedule.status === "done" ? "done" : "planned",
    note: String(schedule.note || ""),
    sortOrder: toFiniteNumber(schedule.sortOrder, 0),
    createdAt: schedule.createdAt || nowIso(),
    updatedAt: schedule.updatedAt || nowIso(),
  };
}

function normalizeAssigneeName(value) {
  return String(value || "").trim().slice(0, 64);
}

function normalizeLabelName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 48);
}

function buildLabelList(sourceList, tasks) {
  const map = new Map();

  function pushLabel(rawValue) {
    const label = normalizeLabelName(rawValue);
    if (!label) return;
    const key = label.toLowerCase();
    if (!map.has(key)) {
      map.set(key, label);
    }
  }

  if (Array.isArray(sourceList)) {
    sourceList.forEach((entry) => pushLabel(entry));
  }

  if (Array.isArray(tasks)) {
    tasks.forEach((task) => {
      if (Array.isArray(task.labels)) {
        task.labels.forEach((label) => pushLabel(label));
      }
    });
  }

  return Array.from(map.values());
}

function buildAssigneeList(sourceList, tasks, users) {
  const map = new Map();

  function pushName(rawValue) {
    const name = normalizeAssigneeName(rawValue);
    if (!name) return;
    const key = name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, name);
    }
  }

  pushName("Nieprzypisane");

  if (Array.isArray(sourceList)) {
    sourceList.forEach((entry) => pushName(entry));
  }

  if (Array.isArray(tasks)) {
    tasks.forEach((task) => pushName(task.assignee));
  }

  if (Array.isArray(users)) {
    users.forEach((user) => pushName(user.name));
  }

  return Array.from(map.values());
}

function sanitizeAssigneeValue(assigneeValue, assigneeList) {
  const normalized = normalizeAssigneeName(assigneeValue);
  const safeList = Array.isArray(assigneeList) ? assigneeList : [];

  if (!normalized) {
    return "Nieprzypisane";
  }

  const match = safeList.find((entry) => entry.toLowerCase() === normalized.toLowerCase());
  if (match) {
    return match;
  }

  return "Nieprzypisane";
}

function fullPermissions() {
  return {
    kanban: true,
    schedule: true,
    archive: true,
    users: true,
  };
}

function defaultPermissionsForRole(role) {
  if (role === "admin") {
    return fullPermissions();
  }

  if (role === "manager") {
    return {
      kanban: true,
      schedule: true,
      archive: true,
      users: false,
    };
  }

  return {
    kanban: true,
    schedule: true,
    archive: true,
    users: false,
  };
}

function normalizePermissions(input, fallback) {
  const base = fallback || fullPermissions();
  const next = {};

  PERMISSION_KEYS.forEach((key) => {
    if (input && Object.prototype.hasOwnProperty.call(input, key)) {
      next[key] = Boolean(input[key]);
    } else {
      next[key] = Boolean(base[key]);
    }
  });

  return next;
}

function normalizeRole(roleValue) {
  const role = String(roleValue || "member").toLowerCase();
  if (role === "admin" || role === "manager" || role === "member") {
    return role;
  }
  return "member";
}

function sortTasks(a, b) {
  const aOrder = toFiniteNumber(a.sortOrder, 0);
  const bOrder = toFiniteNumber(b.sortOrder, 0);
  if (aOrder !== bOrder) return aOrder - bOrder;

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const statusOrder = STATUS_COLUMNS.reduce((acc, col, idx) => {
    acc[col.key] = idx;
    return acc;
  }, {});

  const aStatus = statusOrder[a.status] ?? 999;
  const bStatus = statusOrder[b.status] ?? 999;
  if (aStatus !== bStatus) return aStatus - bStatus;

  const aPriority = priorityOrder[a.priority] ?? 999;
  const bPriority = priorityOrder[b.priority] ?? 999;
  if (aPriority !== bPriority) return aPriority - bPriority;

  const aDue = a.endDate || a.dueDate ? new Date(a.endDate || a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const bDue = b.endDate || b.dueDate ? new Date(b.endDate || b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  if (aDue !== bDue) return aDue - bDue;

  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function sortSchedules(a, b) {
  const aOrder = toFiniteNumber(a.sortOrder, 0);
  const bOrder = toFiniteNumber(b.sortOrder, 0);
  if (aOrder !== bOrder) return aOrder - bOrder;

  const aStamp = new Date(`${a.date || "1970-01-01"}T${a.start || "00:00"}:00`).getTime();
  const bStamp = new Date(`${b.date || "1970-01-01"}T${b.start || "00:00"}:00`).getTime();
  return aStamp - bStamp;
}

function generateDefaultPanelData() {
  const seedTasks = [
    { id: "task-001", title: "Podpiecie domeny i routing logowania /logowanie", status: "review", priority: "critical", assignee: "Piotr", dueDate: dayPlus(1), labels: ["Infra", "Routing"] },
    { id: "task-002", title: "Strona glowna: spojne menu, logo i footer", status: "review", priority: "high", assignee: "Piotr", dueDate: dayPlus(1), labels: ["Homepage", "UI"] },
    { id: "task-003", title: "Outsourcing: unifikacja UX i sekcji wzgledem glownej", status: "review", priority: "high", assignee: "Piotr", dueDate: dayPlus(1), labels: ["Outsourcing", "UX"] },
    { id: "task-004", title: "Outsourcing Classic: poprawa layoutu, scrolla i linkow produkcji", status: "review", priority: "high", assignee: "Piotr", dueDate: dayPlus(1), labels: ["Outsourcing Classic", "Layout"] },
    { id: "task-005", title: "Kontakt: dopasowanie formularza i kart do design systemu QFS", status: "review", priority: "high", assignee: "Piotr", dueDate: dayPlus(1), labels: ["Kontakt", "Forms"] },
    { id: "task-006", title: "Mini gra monitor: CTA do Centrum kontaktu i aktualizacja copy", status: "review", priority: "medium", assignee: "Piotr", dueDate: dayPlus(1), labels: ["Mini Gra", "CTA"] },
    { id: "task-007", title: "Ezoteva: menu gry, panel contentu i flow sekcji Project/Media", status: "review", priority: "critical", assignee: "Piotr", dueDate: dayPlus(1), labels: ["Ezoteva", "Feature"] },
    { id: "task-008", title: "Ezoteva: galeria miniaturek + fullscreen dla obrazow i video", status: "review", priority: "high", assignee: "Piotr", dueDate: dayPlus(1), labels: ["Ezoteva", "Media"] },
    { id: "task-009", title: "Hiberman: strona w stylu referencji + osobne tlo video", status: "review", priority: "critical", assignee: "Piotr", dueDate: dayPlus(1), labels: ["Hiberman", "Visual"] },
    { id: "task-010", title: "Footer globalny: sociale + ikona logowania do portalu", status: "review", priority: "medium", assignee: "Piotr", dueDate: dayPlus(1), labels: ["Footer", "Portal"] },
  ];

  const seedSchedules = [];

  return {
    statuses: STATUS_COLUMNS,
    tasks: seedTasks.map((task, index) =>
      makeTask({
        ...task,
        sortOrder: index + 1,
        description: task.description || "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        createdBy: "system",
        archived: false,
      })
    ),
    schedules: seedSchedules.map((schedule, index) =>
      makeSchedule({
        ...schedule,
        sortOrder: index + 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
    ),
    assignees: buildAssigneeList([], seedTasks, []),
    labels: buildLabelList([], seedTasks),
    users: [],
    updatedAt: nowIso(),
  };
}

function ensurePanelDataShape(data) {
  const source = data && typeof data === "object" ? data : {};

  const tasks = Array.isArray(source.tasks) ? source.tasks.map((task) => makeTask(task)) : [];
  const schedules = Array.isArray(source.schedules)
    ? source.schedules.map((schedule) => makeSchedule(schedule))
    : [];

  const users = Array.isArray(source.users)
    ? source.users
        .map((user) => ({
          id: String(user.id || `usr-${Math.random().toString(36).slice(2, 9)}`),
          email: String(user.email || "").toLowerCase(),
          name: String(user.name || user.email || "Użytkownik"),
          role: normalizeRole(user.role),
          active: user.active !== false,
          permissions: normalizePermissions(user.permissions, defaultPermissionsForRole(normalizeRole(user.role))),
          lastLoginAt: user.lastLoginAt || null,
          createdAt: user.createdAt || nowIso(),
          updatedAt: user.updatedAt || nowIso(),
        }))
        .filter((user) => user.email)
    : [];

  const assignees = buildAssigneeList(source.assignees, tasks, users);
  const labels = buildLabelList(source.labels, tasks);

  const activeTasks = tasks.filter((task) => !task.archived).sort(sortTasks);
  const archivedTasks = tasks.filter((task) => task.archived).sort(sortTasks);
  activeTasks.forEach((task, index) => {
    task.sortOrder = index + 1;
  });
  archivedTasks.forEach((task, index) => {
    task.sortOrder = activeTasks.length + index + 1;
  });

  const groupedSchedules = new Map();
  schedules.forEach((schedule) => {
    const key = schedule.taskId || "__orphan__";
    if (!groupedSchedules.has(key)) groupedSchedules.set(key, []);
    groupedSchedules.get(key).push(schedule);
  });
  groupedSchedules.forEach((entries) => {
    entries.sort(sortSchedules).forEach((entry, index) => {
      entry.sortOrder = index + 1;
    });
  });

  return {
    statuses: STATUS_COLUMNS,
    tasks,
    schedules,
    assignees,
    labels,
    users,
    updatedAt: source.updatedAt || nowIso(),
  };
}

function loadPanelData() {
  try {
    if (!fs.existsSync(panelDataFile)) {
      const created = generateDefaultPanelData();
      fs.writeFileSync(panelDataFile, JSON.stringify(created, null, 2), "utf8");
      return created;
    }

    const raw = fs.readFileSync(panelDataFile, "utf8");
    if (!raw.trim()) {
      const created = generateDefaultPanelData();
      fs.writeFileSync(panelDataFile, JSON.stringify(created, null, 2), "utf8");
      return created;
    }

    const parsed = JSON.parse(raw);
    const normalized = ensurePanelDataShape(parsed);
    fs.writeFileSync(panelDataFile, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  } catch (error) {
    console.error("[QFS PANEL] Nie udalo sie wczytac panel-data.json, tworze domyslne dane.", error.message);
    const created = generateDefaultPanelData();
    fs.writeFileSync(panelDataFile, JSON.stringify(created, null, 2), "utf8");
    return created;
  }
}

let panelData = loadPanelData();

function persistPanelData() {
  panelData.updatedAt = nowIso();
  fs.writeFileSync(panelDataFile, JSON.stringify(panelData, null, 2), "utf8");
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "200kb" }));

app.use(
  session({
    name: "qfs.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

function isAllowedGoogleEmail(email) {
  if (!email) {
    return false;
  }

  const normalized = email.toLowerCase();

  if (allowedEmailSet.size > 0) {
    return allowedEmailSet.has(normalized);
  }

  return normalized.endsWith("@gmail.com") || normalized.endsWith("@googlemail.com");
}

function safeCompareStrings(inputValue, expectedValue) {
  const inputBuffer = Buffer.from(String(inputValue || ""), "utf8");
  const expectedBuffer = Buffer.from(String(expectedValue || ""), "utf8");

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

function sanitizePlainInput(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isValidEmailAddress(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
}

function getSafeRefererPath(req, fallbackPath) {
  const fallback = fallbackPath || "/kontakt";
  const referer = String(req.get("referer") || "").trim();
  const requestHost = String(req.get("host") || "").toLowerCase();

  if (!referer || !requestHost) {
    return fallback;
  }

  try {
    const parsed = new URL(referer);
    if (String(parsed.host || "").toLowerCase() !== requestHost) {
      return fallback;
    }
    const pathWithQueryAndHash = `${parsed.pathname || "/"}${parsed.search || ""}${parsed.hash || ""}`;
    if (!pathWithQueryAndHash.startsWith("/")) {
      return fallback;
    }
    return pathWithQueryAndHash;
  } catch (error) {
    return fallback;
  }
}

function appendQueryParam(pathValue, key, value) {
  const hashIndex = String(pathValue || "").indexOf("#");
  const hash = hashIndex >= 0 ? pathValue.slice(hashIndex) : "";
  const basePath = hashIndex >= 0 ? pathValue.slice(0, hashIndex) : String(pathValue || "");
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
}

function isValidLocalPanelCredentials(login, password) {
  return safeCompareStrings(login, localPanelLogin) && safeCompareStrings(password, localPanelPassword);
}

if (isGoogleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl,
      },
      (accessToken, refreshToken, profile, done) => {
        const rawEmail = profile.emails && profile.emails[0] ? profile.emails[0].value : "";
        const email = String(rawEmail || "").toLowerCase();

        if (!isAllowedGoogleEmail(email)) {
          return done(null, false, { message: "unauthorized" });
        }

        return done(null, {
          id: profile.id,
          displayName: profile.displayName || email,
          email,
          avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
        });
      }
    )
  );
} else {
  console.warn("[QFS AUTH] Google OAuth nie skonfigurowany. Ustaw GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET.");
}

if (!process.env.PANEL_LOGIN || !process.env.PANEL_PASSWORD) {
  console.warn("[QFS AUTH] Aktywne tymczasowe logowanie lokalne (PANEL_LOGIN/PANEL_PASSWORD nie ustawione).");
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const contactBriefLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

function noIndex(req, res, next) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  next();
}

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  return res.redirect("/logowanie?error=unauthorized");
}

function resolveSecureViewPath(fileName) {
  const safeFileName = path.basename(String(fileName || "").trim());
  if (!safeFileName) {
    return null;
  }

  const runtimePath = path.join(secureViewsDir, safeFileName);
  if (fs.existsSync(runtimePath)) {
    return runtimePath;
  }

  const bundledPath = path.join(bundledSecureViewsDir, safeFileName);
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  return null;
}

function sendSecureView(res, fileName) {
  const viewPath = resolveSecureViewPath(fileName);
  if (!viewPath) {
    return res.status(404).sendFile(path.join(rootDir, "404.html"));
  }
  return res.sendFile(viewPath);
}

function sendPublicFile(fileName) {
  return function sendFile(req, res) {
    res.sendFile(path.join(rootDir, fileName));
  };
}

function ensureAssigneeExists(nameValue) {
  const name = normalizeAssigneeName(nameValue);
  if (!name) {
    return false;
  }

  const list = Array.isArray(panelData.assignees) ? panelData.assignees : [];
  const exists = list.some((entry) => entry.toLowerCase() === name.toLowerCase());
  if (!exists) {
    panelData.assignees = buildAssigneeList(list.concat(name), panelData.tasks, panelData.users);
    return true;
  }

  return false;
}

function ensureSessionPanelUser(sessionUser) {
  if (!sessionUser || !sessionUser.email) {
    return null;
  }

  const email = String(sessionUser.email).toLowerCase();
  let panelUser = panelData.users.find((user) => user.email === email);
  let changed = false;

  if (!panelUser) {
    const firstUser = panelData.users.length === 0;
    const role = firstUser ? "admin" : "member";
    panelUser = {
      id: `usr-${Math.random().toString(36).slice(2, 9)}`,
      email,
      name: sessionUser.displayName || email,
      role,
      active: true,
      permissions: defaultPermissionsForRole(role),
      lastLoginAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    panelData.users.push(panelUser);
    if (ensureAssigneeExists(panelUser.name)) {
      changed = true;
    }
    changed = true;
  } else {
    if (!panelUser.active) {
      return null;
    }

    const nextName = sessionUser.displayName || panelUser.name;
    if (nextName !== panelUser.name) {
      panelUser.name = nextName;
      if (ensureAssigneeExists(nextName)) {
        changed = true;
      }
      changed = true;
    }

    panelUser.lastLoginAt = nowIso();
    panelUser.updatedAt = nowIso();
    changed = true;
  }

  if (changed) {
    persistPanelData();
  }

  return panelUser;
}

function getPanelUser(req) {
  if (!req.user) {
    return null;
  }

  return ensureSessionPanelUser(req.user);
}

function hasPermission(req, permissionKey) {
  const panelUser = getPanelUser(req);
  if (!panelUser) {
    return false;
  }

  if (!PERMISSION_KEYS.includes(permissionKey)) {
    return false;
  }

  return Boolean(panelUser.permissions && panelUser.permissions[permissionKey]);
}

function requirePanelPermission(permissionKey) {
  return function panelPermissionMiddleware(req, res, next) {
    const panelUser = getPanelUser(req);
    if (!panelUser) {
      return res.status(403).json({ ok: false, error: "Brak dostepu do panelu." });
    }

    if (!hasPermission(req, permissionKey)) {
      return res.status(403).json({ ok: false, error: "Brak uprawnien do tej operacji." });
    }

    return next();
  };
}

function sanitizeTaskStatus(statusValue) {
  const status = String(statusValue || "").trim().toLowerCase();
  if (STATUS_KEYS.has(status)) {
    return status;
  }
  return "backlog";
}

function sanitizePriority(priorityValue) {
  const priority = String(priorityValue || "").trim().toLowerCase();
  if (PRIORITY_VALUES.includes(priority)) {
    return priority;
  }
  return "medium";
}

function sanitizeTaskLabels(labelsValue) {
  if (Array.isArray(labelsValue)) {
    return labelsValue.map((label) => normalizeLabelName(label)).filter(Boolean).slice(0, 8);
  }

  if (typeof labelsValue === "string") {
    return labelsValue
      .split(",")
      .map((label) => normalizeLabelName(label))
      .filter(Boolean)
      .slice(0, 8);
  }

  return [];
}

function sanitizeDateOnly(value) {
  const date = String(value || "").trim();
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const stamp = new Date(`${date}T00:00:00`).getTime();
  if (!Number.isFinite(stamp)) return "";
  return date;
}

function normalizeTaskTimeline(input) {
  const startDate = sanitizeDateOnly(input && input.startDate);
  const explicitEnd = sanitizeDateOnly(input && input.endDate);
  const legacyDue = sanitizeDateOnly(input && input.dueDate);
  let endDate = explicitEnd || legacyDue;

  if (startDate && endDate) {
    const startStamp = new Date(`${startDate}T00:00:00`).getTime();
    const endStamp = new Date(`${endDate}T00:00:00`).getTime();
    if (Number.isFinite(startStamp) && Number.isFinite(endStamp) && endStamp < startStamp) {
      endDate = startDate;
    }
  }

  return {
    startDate,
    endDate,
    dueDate: endDate,
  };
}

function normalizeTaskSortOrders() {
  const active = panelData.tasks.filter((task) => !task.archived).sort(sortTasks);
  const archived = panelData.tasks.filter((task) => task.archived).sort(sortTasks);

  active.forEach((task, index) => {
    task.sortOrder = index + 1;
  });

  archived.forEach((task, index) => {
    task.sortOrder = active.length + index + 1;
  });
}

function normalizeScheduleSortOrders() {
  const grouped = new Map();

  panelData.schedules.forEach((schedule) => {
    const key = schedule.taskId || "__orphan__";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(schedule);
  });

  grouped.forEach((entries) => {
    entries.sort(sortSchedules).forEach((entry, index) => {
      entry.sortOrder = index + 1;
    });
  });
}

function moveItemInOrderedList(list, itemId, direction) {
  const index = list.findIndex((entry) => entry.id === itemId);
  if (index === -1) {
    return { ok: false, reason: "not_found" };
  }

  const delta = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  if (!delta) {
    return { ok: false, reason: "bad_direction" };
  }

  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= list.length) {
    return { ok: true, moved: false };
  }

  const [item] = list.splice(index, 1);
  list.splice(targetIndex, 0, item);
  return { ok: true, moved: true };
}

function findTaskById(taskId) {
  return panelData.tasks.find((task) => task.id === taskId);
}

function findTaskAttachment(task, attachmentId) {
  if (!task || !Array.isArray(task.attachments)) {
    return null;
  }
  return task.attachments.find((attachment) => attachment.id === attachmentId) || null;
}

function findScheduleById(scheduleId) {
  return panelData.schedules.find((schedule) => schedule.id === scheduleId);
}

const staticOptions = {
  fallthrough: false,
  etag: true,
  maxAge: isProd ? "7d" : 0,
};

app.use("/assets", express.static(path.join(rootDir, "assets"), staticOptions));
app.use("/node_modules", express.static(path.join(rootDir, "node_modules"), staticOptions));

app.get("/logowanie", noIndex, (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const panelUser = getPanelUser(req);
    if (panelUser) {
      return res.redirect("/panel");
    }
  }

  return sendSecureView(res, "logowanie.html");
});

app.post("/logowanie", noIndex, authLimiter, (req, res, next) => {
  const login = String(req.body.login || "").trim();
  const password = String(req.body.password || "");

  if (!login || !password) {
    return res.redirect("/logowanie?error=missing_credentials");
  }

  if (!isValidLocalPanelCredentials(login, password)) {
    return res.redirect("/logowanie?error=invalid_credentials");
  }

  const normalizedLogin = login.toLowerCase();
  const sessionUser = {
    id: `local-${normalizedLogin.replace(/[^a-z0-9_-]/g, "-")}`,
    displayName: login,
    email: normalizedLogin.includes("@") ? normalizedLogin : `${normalizedLogin}@qfs.local`,
    avatar: null,
    authProvider: "local",
  };

  return req.logIn(sessionUser, (loginError) => {
    if (loginError) {
      return next(loginError);
    }

    const panelUser = ensureSessionPanelUser(sessionUser);
    if (!panelUser) {
      return res.redirect("/logowanie?error=unauthorized");
    }

    return res.redirect("/panel");
  });
});

app.get("/auth/google", noIndex, authLimiter, (req, res, next) => {
  if (!isGoogleConfigured) {
    return res.redirect("/logowanie?error=oauth_config");
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })(req, res, next);
});

app.get("/auth/google/callback", noIndex, authLimiter, (req, res, next) => {
  if (!isGoogleConfigured) {
    return res.redirect("/logowanie?error=oauth_config");
  }

  return passport.authenticate("google", (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      const errorKey = info && info.message === "unauthorized" ? "unauthorized" : "oauth";
      return res.redirect(`/logowanie?error=${errorKey}`);
    }

    return req.logIn(user, (loginError) => {
      if (loginError) {
        return next(loginError);
      }

      const panelUser = ensureSessionPanelUser(user);
      if (!panelUser) {
        return res.redirect("/logowanie?error=unauthorized");
      }

      return res.redirect("/panel");
    });
  })(req, res, next);
});

app.get("/panel", noIndex, requireAuth, (req, res) => {
  const panelUser = getPanelUser(req);
  if (!panelUser) {
    return res.redirect("/logowanie?error=unauthorized");
  }

  return sendSecureView(res, "panel.html");
});

app.get("/api/panel/me", noIndex, requireAuth, (req, res) => {
  const panelUser = getPanelUser(req);
  if (!panelUser) {
    return res.status(403).json({ ok: false, error: "Brak dostepu do panelu." });
  }

  res.setHeader("Cache-Control", "no-store");

  return res.json({
    ok: true,
    user: {
      id: req.user.id,
      displayName: req.user.displayName,
      email: req.user.email,
      avatar: req.user.avatar || null,
    },
    panelUser,
  });
});

app.get("/api/panel/state", noIndex, requireAuth, (req, res) => {
  const panelUser = getPanelUser(req);
  if (!panelUser) {
    return res.status(403).json({ ok: false, error: "Brak dostepu do panelu." });
  }

  const tasks = panelData.tasks.filter((task) => !task.archived).sort(sortTasks);
  const archived = panelData.tasks
    .filter((task) => task.archived)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const schedules = [...panelData.schedules].sort(sortSchedules);

  return res.json({
    ok: true,
    me: panelUser,
    panelUser,
    statuses: STATUS_COLUMNS,
    assignees: panelData.assignees,
    labels: panelData.labels,
    tasks,
    archived,
    schedules,
    users: panelUser.permissions.users ? panelData.users : [],
    currentUser: panelUser,
    updatedAt: panelData.updatedAt,
  });
});

app.post("/api/panel/task", noIndex, requireAuth, requirePanelPermission("kanban"), (req, res) => {
  const panelUser = getPanelUser(req);
  const title = String(req.body.title || "").trim();

  if (!title) {
    return res.status(400).json({ ok: false, error: "Tytul zadania jest wymagany." });
  }

  const task = makeTask({
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    description: String(req.body.description || "").trim(),
    status: sanitizeTaskStatus(req.body.status),
    priority: sanitizePriority(req.body.priority),
    labels: sanitizeTaskLabels(req.body.labels),
    assignee: sanitizeAssigneeValue(req.body.assignee || panelUser.name || "Nieprzypisane", panelData.assignees),
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    dueDate: String(req.body.dueDate || ""),
    archived: false,
    createdBy: panelUser.email,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  panelData.tasks.unshift(task);
  panelData.labels = buildLabelList(panelData.labels, panelData.tasks);
  normalizeTaskSortOrders();
  persistPanelData();

  return res.status(201).json({ ok: true, task });
});

app.patch("/api/panel/task/:id", noIndex, requireAuth, requirePanelPermission("kanban"), (req, res) => {
  const task = findTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono zadania." });
  }

  if (typeof req.body.title === "string") {
    const nextTitle = req.body.title.trim();
    if (nextTitle) {
      task.title = nextTitle;
    }
  }

  if (typeof req.body.description === "string") {
    task.description = req.body.description.trim();
  }

  if (typeof req.body.status !== "undefined") {
    task.status = sanitizeTaskStatus(req.body.status);
  }

  if (typeof req.body.priority !== "undefined") {
    task.priority = sanitizePriority(req.body.priority);
  }

  if (typeof req.body.assignee === "string") {
    task.assignee = sanitizeAssigneeValue(req.body.assignee, panelData.assignees);
  }

  if (typeof req.body.dueDate === "string") {
    task.dueDate = req.body.dueDate.trim();
  }
  if (typeof req.body.startDate === "string") {
    task.startDate = req.body.startDate.trim();
  }
  if (typeof req.body.endDate === "string") {
    task.endDate = req.body.endDate.trim();
  }

  if (typeof req.body.labels !== "undefined") {
    task.labels = sanitizeTaskLabels(req.body.labels);
  }

  const normalizedTimeline = normalizeTaskTimeline(task);
  task.startDate = normalizedTimeline.startDate;
  task.endDate = normalizedTimeline.endDate;
  task.dueDate = normalizedTimeline.dueDate;

  panelData.labels = buildLabelList(panelData.labels, panelData.tasks);
  normalizeTaskSortOrders();
  task.updatedAt = nowIso();
  persistPanelData();

  return res.json({ ok: true, task });
});

app.post("/api/panel/task/:id/move", noIndex, requireAuth, requirePanelPermission("schedule"), (req, res) => {
  const task = findTaskById(req.params.id);
  if (!task || task.archived) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono aktywnego zadania." });
  }

  const direction = String(req.body.direction || "").toLowerCase();
  if (direction !== "up" && direction !== "down") {
    return res.status(400).json({ ok: false, error: "Nieprawidlowy kierunek. Uzyj up lub down." });
  }

  const activeTasks = panelData.tasks.filter((entry) => !entry.archived).sort(sortTasks);
  const moved = moveItemInOrderedList(activeTasks, task.id, direction);
  if (!moved.ok) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono zadania do przesuniecia." });
  }

  activeTasks.forEach((entry, index) => {
    entry.sortOrder = index + 1;
    entry.updatedAt = nowIso();
  });

  normalizeTaskSortOrders();
  persistPanelData();

  return res.json({ ok: true, moved: moved.moved, task });
});

app.post("/api/panel/task/:id/attachments", noIndex, requireAuth, requirePanelPermission("kanban"), (req, res) => {
  const task = findTaskById(req.params.id);
  const panelUser = getPanelUser(req);

  if (!task) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono zadania." });
  }

  return taskAttachmentUpload.single("file")(req, res, (uploadError) => {
    if (uploadError) {
      if (uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ ok: false, error: `Plik jest za duzy. Maksymalny rozmiar to ${Math.round(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024))} MB.` });
      }
      return res.status(400).json({ ok: false, error: uploadError.message || "Nie udalo sie przeslac pliku." });
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "Nie przeslano pliku." });
    }

    const currentAttachments = Array.isArray(task.attachments) ? task.attachments : [];
    if (currentAttachments.length >= MAX_TASK_ATTACHMENTS) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (error) {}
      return res.status(400).json({ ok: false, error: `Limit zalacznikow na zadanie to ${MAX_TASK_ATTACHMENTS}.` });
    }

    const attachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: sanitizeAttachmentName(req.file.originalname || req.file.filename),
      fileName: sanitizeStoredFileName(req.file.filename),
      size: req.file.size,
      mime: String(req.file.mimetype || "application/octet-stream"),
      uploadedAt: nowIso(),
      uploadedBy: panelUser ? panelUser.email : "system",
    };

    task.attachments = sanitizeTaskAttachments([...currentAttachments, attachment], task.id);
    task.updatedAt = nowIso();
    persistPanelData();

    const created = findTaskAttachment(task, attachment.id);
    return res.status(201).json({ ok: true, attachment: created, task });
  });
});

app.get("/api/panel/task/:id/attachments/:attachmentId", noIndex, requireAuth, (req, res) => {
  const task = findTaskById(req.params.id);
  const panelUser = getPanelUser(req);
  if (!task || !panelUser) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono zalacznika." });
  }

  const attachment = findTaskAttachment(task, req.params.attachmentId);
  if (!attachment) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono zalacznika." });
  }

  const filePath = resolveAttachmentFilePath(attachment.fileName);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: "Plik zalacznika nie istnieje." });
  }

  res.setHeader("Cache-Control", "no-store");
  if (attachment.mime) {
    res.setHeader("Content-Type", attachment.mime);
  }
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.name || attachment.fileName)}"`);
  return res.sendFile(filePath);
});

app.delete("/api/panel/task/:id/attachments/:attachmentId", noIndex, requireAuth, requirePanelPermission("kanban"), (req, res) => {
  const task = findTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono zadania." });
  }

  const attachments = Array.isArray(task.attachments) ? task.attachments : [];
  const index = attachments.findIndex((entry) => entry.id === req.params.attachmentId);
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono zalacznika." });
  }

  const [removed] = attachments.splice(index, 1);
  task.attachments = sanitizeTaskAttachments(attachments, task.id);
  task.updatedAt = nowIso();
  persistPanelData();

  const filePath = resolveAttachmentFilePath(removed.fileName);
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {}
  }

  return res.json({ ok: true, attachments: task.attachments });
});

app.post("/api/panel/task/:id/archive", noIndex, requireAuth, requirePanelPermission("archive"), (req, res) => {
  const task = findTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono zadania." });
  }

  task.archived = true;
  task.status = "done";
  task.updatedAt = nowIso();
  normalizeTaskSortOrders();
  persistPanelData();

  return res.json({ ok: true, task });
});

app.post("/api/panel/task/:id/restore", noIndex, requireAuth, requirePanelPermission("archive"), (req, res) => {
  const task = findTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono zadania." });
  }

  task.archived = false;
  task.status = sanitizeTaskStatus(req.body.status || "todo");
  task.updatedAt = nowIso();
  normalizeTaskSortOrders();
  persistPanelData();

  return res.json({ ok: true, task });
});

app.post("/api/panel/schedule", noIndex, requireAuth, requirePanelPermission("schedule"), (req, res) => {
  const title = String(req.body.title || "").trim();
  const date = String(req.body.date || "").trim();
  const taskId = String(req.body.taskId || "").trim();

  if (!title || !date || !taskId) {
    return res.status(400).json({ ok: false, error: "Tytul, data i powiazane zadanie sa wymagane." });
  }

  const linkedTask = findTaskById(taskId);
  if (!linkedTask || linkedTask.archived) {
    return res.status(400).json({ ok: false, error: "Wybierz aktywne zadanie z Kanbana." });
  }

  const schedule = makeSchedule({
    id: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    taskId,
    title,
    date,
    start: String(req.body.start || "09:00"),
    end: String(req.body.end || "10:00"),
    owner: String(req.body.owner || "Nieprzypisane"),
    status: req.body.status === "done" ? "done" : "planned",
    note: String(req.body.note || "").trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  panelData.schedules.push(schedule);
  normalizeScheduleSortOrders();
  persistPanelData();

  return res.status(201).json({ ok: true, schedule });
});

app.patch("/api/panel/schedule/:id", noIndex, requireAuth, requirePanelPermission("schedule"), (req, res) => {
  const schedule = findScheduleById(req.params.id);
  if (!schedule) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono wpisu harmonogramu." });
  }

  if (typeof req.body.title === "string" && req.body.title.trim()) {
    schedule.title = req.body.title.trim();
  }
  if (typeof req.body.date === "string" && req.body.date.trim()) {
    schedule.date = req.body.date.trim();
  }
  if (typeof req.body.start === "string" && req.body.start.trim()) {
    schedule.start = req.body.start.trim();
  }
  if (typeof req.body.end === "string" && req.body.end.trim()) {
    schedule.end = req.body.end.trim();
  }
  if (typeof req.body.owner === "string") {
    schedule.owner = req.body.owner.trim() || "Nieprzypisane";
  }
  if (typeof req.body.taskId !== "undefined") {
    const nextTaskId = String(req.body.taskId || "").trim();
    if (!nextTaskId) {
      return res.status(400).json({ ok: false, error: "Powiazanie z zadaniem jest wymagane." });
    }
    const linkedTask = findTaskById(nextTaskId);
    if (!linkedTask || linkedTask.archived) {
      return res.status(400).json({ ok: false, error: "Wybierz aktywne zadanie z Kanbana." });
    }
    schedule.taskId = nextTaskId;
  }
  if (typeof req.body.note === "string") {
    schedule.note = req.body.note.trim();
  }
  if (typeof req.body.status !== "undefined") {
    schedule.status = req.body.status === "done" ? "done" : "planned";
  }

  schedule.updatedAt = nowIso();
  normalizeScheduleSortOrders();
  persistPanelData();

  return res.json({ ok: true, schedule });
});

app.post("/api/panel/schedule/:id/move", noIndex, requireAuth, requirePanelPermission("schedule"), (req, res) => {
  const schedule = findScheduleById(req.params.id);
  if (!schedule) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono wpisu harmonogramu." });
  }

  const direction = String(req.body.direction || "").toLowerCase();
  if (direction !== "up" && direction !== "down") {
    return res.status(400).json({ ok: false, error: "Nieprawidlowy kierunek. Uzyj up lub down." });
  }

  const groupKey = schedule.taskId || null;
  const groupEntries = panelData.schedules
    .filter((entry) => (entry.taskId || null) === groupKey)
    .sort(sortSchedules);

  const moved = moveItemInOrderedList(groupEntries, schedule.id, direction);
  if (!moved.ok) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono wpisu do przesuniecia." });
  }

  groupEntries.forEach((entry, index) => {
    entry.sortOrder = index + 1;
    entry.updatedAt = nowIso();
  });

  normalizeScheduleSortOrders();
  persistPanelData();

  return res.json({ ok: true, moved: moved.moved, schedule });
});

app.delete("/api/panel/schedule/:id", noIndex, requireAuth, requirePanelPermission("schedule"), (req, res) => {
  const index = panelData.schedules.findIndex((schedule) => schedule.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono wpisu harmonogramu." });
  }

  panelData.schedules.splice(index, 1);
  normalizeScheduleSortOrders();
  persistPanelData();
  return res.json({ ok: true });
});

app.post("/api/panel/users", noIndex, requireAuth, requirePanelPermission("users"), (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const name = String(req.body.name || "").trim();
  const role = normalizeRole(req.body.role);

  if (!email) {
    return res.status(400).json({ ok: false, error: "E-mail uzytkownika jest wymagany." });
  }

  const existing = panelData.users.find((user) => user.email === email);
  if (existing) {
    return res.status(409).json({ ok: false, error: "Uzytkownik z tym adresem juz istnieje." });
  }

  const user = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email,
    name: name || email,
    role,
    active: true,
    permissions: defaultPermissionsForRole(role),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: null,
  };

  panelData.users.push(user);
  ensureAssigneeExists(user.name);
  persistPanelData();

  return res.status(201).json({ ok: true, user });
});

app.patch("/api/panel/users/:id", noIndex, requireAuth, requirePanelPermission("users"), (req, res) => {
  const currentUser = getPanelUser(req);
  const user = panelData.users.find((entry) => entry.id === req.params.id);
  if (!user) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono uzytkownika." });
  }

  if (typeof req.body.name === "string") {
    const nextName = req.body.name.trim();
    if (nextName) {
      user.name = nextName;
      ensureAssigneeExists(nextName);
    }
  }

  if (typeof req.body.role !== "undefined") {
    const role = normalizeRole(req.body.role);
    user.role = role;
    user.permissions = normalizePermissions(req.body.permissions, defaultPermissionsForRole(role));
  } else if (typeof req.body.permissions !== "undefined") {
    user.permissions = normalizePermissions(req.body.permissions, user.permissions);
  }

  if (typeof req.body.active !== "undefined") {
    const nextActive = Boolean(req.body.active);
    if (user.email === currentUser.email && !nextActive) {
      return res.status(400).json({ ok: false, error: "Nie mozna dezaktywowac aktualnie zalogowanego konta." });
    }
    user.active = nextActive;
  }

  user.updatedAt = nowIso();
  persistPanelData();

  return res.json({ ok: true, user });
});

app.post("/api/panel/assignees", noIndex, requireAuth, requirePanelPermission("users"), (req, res) => {
  const name = normalizeAssigneeName(req.body.name);
  if (!name) {
    return res.status(400).json({ ok: false, error: "Nazwa odpowiedzialnego jest wymagana." });
  }

  const exists = panelData.assignees.some((entry) => entry.toLowerCase() === name.toLowerCase());
  if (exists) {
    return res.status(409).json({ ok: false, error: "Taka pozycja juz istnieje na liscie." });
  }

  panelData.assignees = buildAssigneeList(panelData.assignees.concat(name), panelData.tasks, panelData.users);
  persistPanelData();

  return res.status(201).json({ ok: true, assignees: panelData.assignees });
});

app.post("/api/panel/labels", noIndex, requireAuth, requirePanelPermission("users"), (req, res) => {
  const name = normalizeLabelName(req.body.name);
  if (!name) {
    return res.status(400).json({ ok: false, error: "Nazwa etykiety jest wymagana." });
  }

  const exists = panelData.labels.some((entry) => entry.toLowerCase() === name.toLowerCase());
  if (exists) {
    return res.status(409).json({ ok: false, error: "Taka etykieta juz istnieje na liscie." });
  }

  panelData.labels = buildLabelList(panelData.labels.concat(name), panelData.tasks);
  persistPanelData();

  return res.status(201).json({ ok: true, labels: panelData.labels });
});

app.delete("/api/panel/assignees/:name", noIndex, requireAuth, requirePanelPermission("users"), (req, res) => {
  const name = normalizeAssigneeName(req.params.name);
  if (!name) {
    return res.status(400).json({ ok: false, error: "Brak nazwy pozycji do usuniecia." });
  }

  if (name.toLowerCase() === "nieprzypisane") {
    return res.status(400).json({ ok: false, error: "Nie mozna usunac pozycji Nieprzypisane." });
  }

  const index = panelData.assignees.findIndex((entry) => entry.toLowerCase() === name.toLowerCase());
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono takiej pozycji na liscie." });
  }

  const removedName = panelData.assignees[index];
  panelData.assignees.splice(index, 1);

  panelData.tasks.forEach((task) => {
    if (String(task.assignee || "").toLowerCase() === removedName.toLowerCase()) {
      task.assignee = "Nieprzypisane";
      task.updatedAt = nowIso();
    }
  });

  panelData.schedules.forEach((schedule) => {
    if (String(schedule.owner || "").toLowerCase() === removedName.toLowerCase()) {
      schedule.owner = "Nieprzypisane";
      schedule.updatedAt = nowIso();
    }
  });

  panelData.assignees = buildAssigneeList(panelData.assignees, panelData.tasks, panelData.users);
  persistPanelData();

  return res.json({ ok: true, assignees: panelData.assignees });
});

app.delete("/api/panel/labels/:name", noIndex, requireAuth, requirePanelPermission("users"), (req, res) => {
  const name = normalizeLabelName(req.params.name);
  if (!name) {
    return res.status(400).json({ ok: false, error: "Brak nazwy etykiety do usuniecia." });
  }

  const index = panelData.labels.findIndex((entry) => entry.toLowerCase() === name.toLowerCase());
  if (index === -1) {
    return res.status(404).json({ ok: false, error: "Nie znaleziono takiej etykiety." });
  }

  const removedName = panelData.labels[index];
  panelData.labels.splice(index, 1);

  panelData.tasks.forEach((task) => {
    const initialLength = Array.isArray(task.labels) ? task.labels.length : 0;
    task.labels = (Array.isArray(task.labels) ? task.labels : []).filter(
      (label) => normalizeLabelName(label).toLowerCase() !== removedName.toLowerCase()
    );
    if (task.labels.length !== initialLength) {
      task.updatedAt = nowIso();
    }
  });

  panelData.labels = buildLabelList(panelData.labels, panelData.tasks);
  persistPanelData();

  return res.json({ ok: true, labels: panelData.labels });
});

app.post("/wyloguj", noIndex, requireAuth, (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) {
      return next(logoutError);
    }

    return req.session.destroy((destroyError) => {
      if (destroyError) {
        return next(destroyError);
      }

      res.clearCookie("qfs.sid");
      return res.redirect("/logowanie?status=wylogowano");
    });
  });
});

app.post("/api/contact-brief", contactBriefLimiter, (req, res) => {
  const refererPath = getSafeRefererPath(req, "/kontakt");
  const successRedirect = appendQueryParam(refererPath, "brief", "sent");
  const errorRedirect = appendQueryParam(refererPath, "brief", "error");

  const fullName = sanitizePlainInput(req.body.name || req.body["Imie i firma"] || req.body["Imię i firma"], 120);
  const email = String(req.body.email || req.body["E-mail"] || "").trim().toLowerCase();
  const scope = sanitizePlainInput(req.body.scope || req.body["Zakres i cele"], 3000);

  if (!fullName || !scope || !isValidEmailAddress(email)) {
    return res.redirect(303, errorRedirect);
  }

  const brief = {
    id: `brief-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName,
    email,
    scope,
    submittedAt: nowIso(),
    sourcePath: refererPath,
    ip: String(req.ip || ""),
    userAgent: sanitizePlainInput(req.get("user-agent") || "", 255),
  };

  try {
    fs.appendFileSync(contactBriefsFile, `${JSON.stringify(brief)}\n`, "utf8");
  } catch (error) {
    console.error("[QFS CONTACT] Nie udalo sie zapisac briefu.", error.message);
    return res.redirect(303, errorRedirect);
  }

  return res.redirect(303, successRedirect);
});

app.get("/", sendPublicFile("index.html"));

[
  "index.html",
  "produkcje.html",
  "outsourcing.html",
  "outsourcing-classic.html",
  "zespol.html",
  "kontakt.html",
  "ezoteva.html",
  "hiberman.html",
  "404.html",
  "styles.css",
  "hiberman-comic.css",
  "outsourcing-alt.css",
  "outsourcing-experience.js",
  "app.js",
  "deploy-game.js",
  "robots.txt",
  "sitemap.xml",
].forEach((fileName) => {
  app.get(`/${fileName}`, sendPublicFile(fileName));
});

[
  ["index", "index.html"],
  ["produkcje", "produkcje.html"],
  ["outsourcing", "outsourcing.html"],
  ["outsourcing-classic", "outsourcing-classic.html"],
  ["zespol", "zespol.html"],
  ["kontakt", "kontakt.html"],
  ["ezoteva", "ezoteva.html"],
  ["hiberman", "hiberman.html"],
].forEach(([slug, fileName]) => {
  app.get(`/${slug}`, sendPublicFile(fileName));
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(rootDir, "404.html"));
});

app.listen(port, () => {
  console.log(`QFS server listening on port ${port}`);
  console.log(`[QFS AUTH] BASE_URL=${baseUrl}`);
  console.log(`[QFS AUTH] GOOGLE_CALLBACK_URL=${googleCallbackUrl}`);
});
