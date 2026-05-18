import { useState, useEffect, useRef } from "react";

// ============================================================
// ✅ IP RESTRICTION — APNA OFFICE WIFI IP YAHAN DAAL DENA
const ALLOWED_OFFICE_IP = "119.73.97.135";
// ============================================================

const OFFICE_START = "10:30";

const DEFAULT_USERS = [
  { id: 1, name: "ahmed", role: "employee", username: "ahmed", password: "ahmed123", avatar: "AA" },
  { id: 2, name: "Sara Khan", role: "employee", username: "sara", password: "sara123", avatar: "SK" },
  { id: 3, name: "Usman Raza", role: "employee", username: "usman", password: "usman123", avatar: "UR" },
  { id: 4, name: "Fatima Noor", role: "employee", username: "fatima", password: "fatima123", avatar: "FN" },
  { id: 5, name: "Bilal Shah", role: "employee", username: "bilal", password: "bilal123", avatar: "BS" },
  { id: 6, name: "Admin", role: "admin", username: "admin", password: "vibex@admin", avatar: "AD" },
];

function getUsers() {
  const stored = localStorage.getItem("vibex_users");
  return stored ? JSON.parse(stored) : DEFAULT_USERS;
}
function saveUsers(users) {
  localStorage.setItem("vibex_users", JSON.stringify(users));
}
function getProfilePic(userId) {
  return localStorage.getItem(`vibex_pic_${userId}`) || null;
}
function saveProfilePic(userId, base64) {
  localStorage.setItem(`vibex_pic_${userId}`, base64);
}
function getStorageKey(userId, date) { return `vibex_${userId}_${date}`; }
function getTodayDate() { return new Date().toISOString().split("T")[0]; }
function formatTime(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function formatDate(d) {
  return new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}
function isLate(inTime) {
  if (!inTime) return false;
  const t = new Date(inTime);
  const [h, m] = OFFICE_START.split(":").map(Number);
  const cut = new Date(t); cut.setHours(h, m, 0, 0);
  return t > cut;
}
function getLateMin(inTime) {
  if (!inTime) return 0;
  const t = new Date(inTime);
  const [h, m] = OFFICE_START.split(":").map(Number);
  const cut = new Date(t); cut.setHours(h, m, 0, 0);
  const d = Math.floor((t - cut) / 60000);
  return d > 0 ? d : 0;
}
function getDuration(inTime, outTime) {
  if (!inTime || !outTime) return "--";
  const d = Math.floor((new Date(outTime) - new Date(inTime)) / 60000);
  return `${Math.floor(d / 60)}h ${d % 60}m`;
}
function getAllRecords(userId) {
  const records = [];
  for (let k in localStorage) {
    if (k.startsWith(`vibex_${userId}_`)) {
      const date = k.replace(`vibex_${userId}_`, "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const val = JSON.parse(localStorage.getItem(k));
        records.push({ date, ...val });
      }
    }
  }
  return records.sort((a, b) => b.date.localeCompare(a.date));
}
function deleteRecord(userId, date) {
  localStorage.removeItem(getStorageKey(userId, date));
}
function deleteAllRecords(userId) {
  const keys = [];
  for (let k in localStorage) if (k.startsWith(`vibex_${userId}_`)) keys.push(k);
  keys.forEach(k => localStorage.removeItem(k));
}
function getAllEmployeeRecords(users) {
  const all = [];
  users.filter(u => u.role === "employee").forEach(user => {
    getAllRecords(user.id).forEach(r => all.push({ ...r, userId: user.id, userName: user.name, avatar: user.avatar }));
  });
  return all.sort((a, b) => b.date.localeCompare(a.date) || a.userName.localeCompare(b.userName));
}
function exportToCSV(data, filename) {
  const headers = ["Employee", "Date", "Check In", "Check Out", "Duration", "Status", "Late By"];
  const rows = data.map(r => [
    r.userName, formatDate(r.date), formatTime(r.inTime), formatTime(r.outTime),
    getDuration(r.inTime, r.outTime),
    r.inTime ? (isLate(r.inTime) ? "Late" : "On Time") : "Absent",
    r.inTime && isLate(r.inTime) ? `${getLateMin(r.inTime)} min` : "-"
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// ── STYLISH TEXT LOGO ─────────────────────────────────────────
function VibexTextLogo({ size = "md" }) {
  const sizes = { sm: { v: 22, d: 13, gap: 6 }, md: { v: 30, d: 16, gap: 8 }, lg: { v: 48, d: 22, gap: 10 } };
  const s = sizes[size] || sizes.md;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: `${s.gap}px`, fontFamily: "'Montserrat', sans-serif", userSelect: "none" }}>
      <span style={{
        fontSize: `${s.v}px`, fontWeight: 900, letterSpacing: "-1px",
        background: "linear-gradient(135deg, #fff 30%, #26C6A0 100%)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        textShadow: "none", lineHeight: 1
      }}>VIBEX</span>
      <span style={{
        fontSize: `${s.d}px`, fontWeight: 300, letterSpacing: "6px",
        color: "rgba(255,255,255,0.55)", lineHeight: 1, paddingBottom: "2px"
      }}>DIGITAL</span>
    </div>
  );
}

// ── AVATAR ────────────────────────────────────────────────────
function Avatar({ userId, fallback, size = 40 }) {
  const pic = getProfilePic(userId);
  return pic
    ? <img src={pic} alt="avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.2)" }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#1565C0,#26C6A0)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: size * 0.3, border: "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }}>{fallback}</div>;
}

// ── PROFILE PIC UPLOAD ────────────────────────────────────────
function ProfilePicUpload({ user, onUpdate }) {
  const ref = useRef();
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { saveProfilePic(user.id, ev.target.result); onUpdate(); };
    reader.readAsDataURL(file);
  }
  return (
    <div style={{ position: "relative", display: "inline-block", cursor: "pointer" }} onClick={() => ref.current.click()}>
      <Avatar userId={user.id} fallback={user.avatar} size={80} />
      <div style={{
        position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%",
        background: "linear-gradient(135deg,#1565C0,#26C6A0)", display: "flex", alignItems: "center",
        justifyContent: "center", border: "2px solid white", fontSize: 13
      }}>📷</div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────
function HomePage({ onLogin }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0A1628 0%,#0D2147 50%,#0A1628 100%)", display: "flex", flexDirection: "column", fontFamily: "'Montserrat',sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "-120px", left: "-120px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle,rgba(229,57,53,0.1) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-120px", right: "-120px", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle,rgba(38,198,160,0.08) 0%,transparent 70%)", pointerEvents: "none" }} />

      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 48px", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "relative", zIndex: 10 }}>
        <VibexTextLogo size="md" />
        <button onClick={onLogin} style={{ background: "linear-gradient(135deg,#1565C0,#0D47A1)", color: "white", border: "1px solid rgba(255,255,255,0.15)", padding: "12px 32px", borderRadius: "8px", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "13px", letterSpacing: "2px", cursor: "pointer", boxShadow: "0 4px 20px rgba(21,101,192,0.4)", transition: "all 0.2s" }}
          onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}>
          LOGIN →
        </button>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: "60px 24px", position: "relative", zIndex: 5, textAlign: "center" }}>
        <div style={{ fontSize: "11px", letterSpacing: "5px", color: "#26C6A0", fontWeight: 700, marginBottom: "20px" }}>ATTENDANCE MANAGEMENT SYSTEM</div>
        <h1 style={{ fontSize: "clamp(40px,6vw,76px)", fontWeight: 900, color: "white", margin: "0 0 16px", lineHeight: 1.05, letterSpacing: "-2px" }}>
          Track. Manage.<br />
          <span style={{ background: "linear-gradient(90deg,#E53935,#26C6A0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Grow.</span>
        </h1>
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.45)", maxWidth: "460px", lineHeight: 1.9, marginBottom: "48px" }}>
          Vibex Digital ka smart attendance portal — team ki timing, performance aur records ek jagah.
        </p>

        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "18px", padding: "28px 56px", backdropFilter: "blur(20px)", marginBottom: "48px" }}>
          <div style={{ fontSize: "50px", fontWeight: 900, color: "white", letterSpacing: "4px", fontVariantNumeric: "tabular-nums" }}>
            {time.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
          </div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "10px", letterSpacing: "2px" }}>
            {time.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>

        <button onClick={onLogin} style={{ background: "linear-gradient(135deg,#1565C0,#0D47A1)", color: "white", border: "none", padding: "18px 60px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, letterSpacing: "3px", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", boxShadow: "0 8px 32px rgba(21,101,192,0.45)", transition: "all 0.2s" }}
          onMouseOver={e => e.currentTarget.style.transform = "translateY(-3px)"} onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}>
          PORTAL MEIN ENTER KAREN →
        </button>

        <div style={{ display: "flex", gap: "48px", marginTop: "64px", flexWrap: "wrap", justifyContent: "center" }}>
          {[["15+", "Team Members"], ["100%", "Daily Records"], ["Excel", "Data Export"]].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "30px", fontWeight: 900, color: "white" }}>{val}</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", letterSpacing: "2px", marginTop: "6px" }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "center", padding: "20px", borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", fontSize: "11px", letterSpacing: "2px" }}>© 2025 VIBEX DIGITAL — ALL RIGHTS RESERVED</div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────
function LoginPage({ onSuccess, onBack, ipAllowed }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleLogin() {
    if (!ipAllowed) { setError("⚠️ Sirf office WiFi se login kar sakte hain."); return; }
    setLoading(true);
    setTimeout(() => {
      const users = getUsers();
      const user = users.find(u => u.username === username && u.password === password);
      if (user) onSuccess(user);
      else { setError("Username ya password galat hai."); setLoading(false); }
    }, 700);
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0A1628,#0D2147)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',sans-serif", padding: "24px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "350px", height: "350px", borderRadius: "50%", background: "radial-gradient(circle,rgba(38,198,160,0.08) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-80px", left: "-80px", width: "350px", height: "350px", borderRadius: "50%", background: "radial-gradient(circle,rgba(229,57,53,0.08) 0%,transparent 70%)", pointerEvents: "none" }} />

      <div style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "20px", padding: "48px 40px", width: "100%", maxWidth: "420px", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <VibexTextLogo size="lg" />
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px", marginTop: "14px", letterSpacing: "4px" }}>ATTENDANCE PORTAL</div>
        </div>

        {!ipAllowed && (
          <div style={{ background: "rgba(229,57,53,0.1)", border: "1px solid rgba(229,57,53,0.3)", borderRadius: "10px", padding: "14px", marginBottom: "20px", color: "#ef9a9a", fontSize: "12px", textAlign: "center" }}>
            ⚠️ Office WiFi se connected nahi hain. Login sirf office network par mumkin hai.
          </div>
        )}

        {["USERNAME", "PASSWORD"].map((label, i) => (
          <div key={label} style={{ marginBottom: i === 0 ? "20px" : "28px" }}>
            <label style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", letterSpacing: "2px", display: "block", marginBottom: "8px" }}>{label}</label>
            <input value={i === 0 ? username : password} type={i === 1 ? "password" : "text"}
              onChange={e => { i === 0 ? setUsername(e.target.value) : setPassword(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder={`Enter ${label.toLowerCase()}`}
              style={{ width: "100%", padding: "14px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "white", fontSize: "14px", fontFamily: "'Montserrat',sans-serif", outline: "none", boxSizing: "border-box" }}
            />
          </div>
        ))}

        {error && <div style={{ color: "#ef9a9a", fontSize: "12px", textAlign: "center", marginBottom: "16px" }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading || !ipAllowed} style={{ width: "100%", padding: "16px", background: !ipAllowed ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg,#1565C0,#0D47A1)", color: "white", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 700, letterSpacing: "2px", cursor: !ipAllowed ? "not-allowed" : "pointer", fontFamily: "'Montserrat',sans-serif", boxShadow: !ipAllowed ? "none" : "0 8px 24px rgba(21,101,192,0.4)" }}>
          {loading ? "LOGGING IN..." : "LOGIN →"}
        </button>
        <button onClick={onBack} style={{ width: "100%", marginTop: "14px", padding: "12px", background: "transparent", color: "rgba(255,255,255,0.35)", border: "none", cursor: "pointer", fontSize: "12px", fontFamily: "'Montserrat',sans-serif" }}>← Back to Home</button>
      </div>
    </div>
  );
}

// ── EMPLOYEE DASHBOARD ────────────────────────────────────────
function EmployeeDashboard({ user, onLogout }) {
  const today = getTodayDate();
  const key = getStorageKey(user.id, today);
  const saved = JSON.parse(localStorage.getItem(key) || "{}");
  const [inTime, setInTime] = useState(saved.inTime || null);
  const [outTime, setOutTime] = useState(saved.outTime || null);
  const [now, setNow] = useState(new Date());
  const [tab, setTab] = useState("today");
  const [records, setRecords] = useState(getAllRecords(user.id));
  const [picKey, setPicKey] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  function refreshRecords() { setRecords(getAllRecords(user.id)); }

  function markIn() {
    const t = new Date().toISOString(); setInTime(t);
    const rec = JSON.parse(localStorage.getItem(key) || "{}"); rec.inTime = t;
    localStorage.setItem(key, JSON.stringify(rec)); refreshRecords();
  }
  function markOut() {
    const t = new Date().toISOString(); setOutTime(t);
    const rec = JSON.parse(localStorage.getItem(key) || "{}"); rec.outTime = t;
    localStorage.setItem(key, JSON.stringify(rec)); refreshRecords();
  }
  function handleDelete(date) {
    deleteRecord(user.id, date);
    if (date === today) { setInTime(null); setOutTime(null); }
    setDeleteConfirm(null); refreshRecords();
  }
  function handleDeleteAll() {
    deleteAllRecords(user.id); setInTime(null); setOutTime(null);
    setShowDeleteAll(false); refreshRecords();
  }

  const lateCount = records.filter(r => r.inTime && isLate(r.inTime)).length;
  const onTimeCount = records.filter(r => r.inTime && !isLate(r.inTime)).length;

  const navStyle = { padding: "10px 22px", borderRadius: "8px", border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "11px", letterSpacing: "1.5px" };

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4FF", fontFamily: "'Montserrat',sans-serif" }}>
      {/* Confirm Modals */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "32px", maxWidth: "360px", width: "90%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>🗑️</div>
            <div style={{ fontWeight: 800, color: "#0D2147", fontSize: "16px", marginBottom: "8px" }}>Record Delete Karen?</div>
            <div style={{ color: "#64748b", fontSize: "13px", marginBottom: "24px" }}>{formatDate(deleteConfirm)} ka record permanently delete ho jayega.</div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "12px", color: "#64748b" }}>CANCEL</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#E53935,#C62828)", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "12px", color: "white" }}>DELETE</button>
            </div>
          </div>
        </div>
      )}
      {showDeleteAll && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "32px", maxWidth: "380px", width: "90%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>⚠️</div>
            <div style={{ fontWeight: 800, color: "#0D2147", fontSize: "16px", marginBottom: "8px" }}>Sab Records Delete Karen?</div>
            <div style={{ color: "#64748b", fontSize: "13px", marginBottom: "24px" }}>Apke saare attendance records permanently delete ho jayenge. Ye action undo nahi ho sakta.</div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setShowDeleteAll(false)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "12px", color: "#64748b" }}>CANCEL</button>
              <button onClick={handleDeleteAll} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#E53935,#C62828)", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "12px", color: "white" }}>DELETE ALL</button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <div style={{ background: "linear-gradient(135deg,#0A1628,#0D2147)", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "70px", boxShadow: "0 4px 24px rgba(10,22,40,0.3)" }}>
        <VibexTextLogo size="sm" />
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Avatar userId={user.id} fallback={user.avatar} size={38} />
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>{user.name}</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px", letterSpacing: "1px" }}>EMPLOYEE</div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(229,57,53,0.15)", border: "1px solid rgba(229,57,53,0.25)", color: "#ef9a9a", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontFamily: "'Montserrat',sans-serif", letterSpacing: "1px" }}>LOGOUT</button>
        </div>
      </div>

      <div style={{ maxWidth: "920px", margin: "0 auto", padding: "32px 24px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "28px", flexWrap: "wrap" }}>
          {["today", "history", "profile"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...navStyle, background: tab === t ? "linear-gradient(135deg,#0D47A1,#1565C0)" : "white", color: tab === t ? "white" : "#64748b", boxShadow: tab === t ? "0 4px 16px rgba(13,71,161,0.3)" : "0 2px 8px rgba(0,0,0,0.06)" }}>
              {t === "today" ? "TODAY" : t === "history" ? "HISTORY" : "PROFILE"}
            </button>
          ))}
        </div>

        {tab === "today" && (
          <>
            <div style={{ background: "linear-gradient(135deg,#0A1628,#0D2147)", borderRadius: "16px", padding: "32px", marginBottom: "24px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "radial-gradient(circle,rgba(38,198,160,0.1) 0%,transparent 70%)" }} />
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", letterSpacing: "3px", marginBottom: "8px" }}>
                {now.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
              <div style={{ color: "white", fontSize: "50px", fontWeight: 900, letterSpacing: "4px", fontVariantNumeric: "tabular-nums" }}>
                {now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
              </div>
              <div style={{ marginTop: "14px", display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#26C6A0", boxShadow: "0 0 8px #26C6A0" }} />
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", letterSpacing: "2px" }}>OFFICE HOURS: 10:30 AM</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              {[{ label: "CHECK IN", time: inTime, action: markIn, color: "#26C6A0", btn: "MARK IN ↓", disabled: !!inTime },
                { label: "CHECK OUT", time: outTime, action: markOut, color: "#1565C0", btn: "MARK OUT ↑", disabled: !inTime || !!outTime }].map(c => (
                <div key={c.label} style={{ background: "white", borderRadius: "16px", padding: "28px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", borderTop: `4px solid ${c.color}` }}>
                  <div style={{ fontSize: "10px", color: "#94A3B8", letterSpacing: "2px", marginBottom: "16px" }}>{c.label}</div>
                  {c.time ? (
                    <>
                      <div style={{ fontSize: "26px", fontWeight: 900, color: "#0D2147" }}>{formatTime(c.time)}</div>
                      {c.label === "CHECK IN" && (
                        <div style={{ marginTop: "8px", fontSize: "12px", color: isLate(c.time) ? "#E53935" : "#26C6A0", fontWeight: 700 }}>
                          {isLate(c.time) ? `⚠ ${getLateMin(c.time)} min late` : "✓ On Time"}
                        </div>
                      )}
                      {c.label === "CHECK OUT" && outTime && (
                        <div style={{ marginTop: "8px", fontSize: "12px", color: "#1565C0", fontWeight: 600 }}>Duration: {getDuration(inTime, outTime)}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: "26px", fontWeight: 900, color: "#CBD5E1" }}>--:--</div>
                      <button onClick={c.action} disabled={c.disabled} style={{ marginTop: "16px", width: "100%", padding: "13px", background: c.disabled ? "#E2E8F0" : `linear-gradient(135deg,${c.color},${c.color}dd)`, color: c.disabled ? "#94A3B8" : "white", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "12px", letterSpacing: "1px", cursor: c.disabled ? "not-allowed" : "pointer", fontFamily: "'Montserrat',sans-serif" }}>{c.btn}</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px" }}>
              {[{ label: "Total Days", val: records.length, color: "#0D47A1" }, { label: "On Time", val: onTimeCount, color: "#26C6A0" }, { label: "Late Days", val: lateCount, color: "#E53935" }].map(s => (
                <div key={s.label} style={{ background: "white", borderRadius: "14px", padding: "20px", textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize: "32px", fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: "10px", color: "#94A3B8", letterSpacing: "1.5px", marginTop: "4px" }}>{s.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "history" && (
          <div style={{ background: "white", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ fontWeight: 800, color: "#0D2147", fontSize: "15px" }}>Attendance History</div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button onClick={() => exportToCSV(records.map(r => ({ ...r, userName: user.name })), `${user.name}_attendance.csv`)} style={{ background: "linear-gradient(135deg,#0D47A1,#1565C0)", color: "white", border: "none", padding: "9px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", fontFamily: "'Montserrat',sans-serif" }}>↓ EXPORT</button>
                <button onClick={() => setShowDeleteAll(true)} style={{ background: "linear-gradient(135deg,#E53935,#C62828)", color: "white", border: "none", padding: "9px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", fontFamily: "'Montserrat',sans-serif" }}>🗑 DELETE ALL</button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8FAFF" }}>
                    {["Date", "Check In", "Check Out", "Duration", "Status", "Action"].map(h => (
                      <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: "10px", color: "#64748b", letterSpacing: "2px", fontWeight: 700, borderBottom: "1px solid #F1F5F9" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Koi record nahi mila</td></tr>
                  ) : records.map(r => (
                    <tr key={r.date} style={{ borderBottom: "1px solid #F8FAFF" }}>
                      <td style={{ padding: "12px 18px", fontWeight: 700, color: "#0D2147", fontSize: "13px" }}>{formatDate(r.date)}</td>
                      <td style={{ padding: "12px 18px", color: "#334155", fontSize: "13px" }}>{formatTime(r.inTime)}</td>
                      <td style={{ padding: "12px 18px", color: "#334155", fontSize: "13px" }}>{formatTime(r.outTime)}</td>
                      <td style={{ padding: "12px 18px", color: "#334155", fontSize: "13px" }}>{getDuration(r.inTime, r.outTime)}</td>
                      <td style={{ padding: "12px 18px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", background: !r.inTime ? "#FEF2F2" : isLate(r.inTime) ? "#FEF2F2" : "#F0FDF4", color: !r.inTime ? "#E53935" : isLate(r.inTime) ? "#E53935" : "#16A34A" }}>
                          {!r.inTime ? "ABSENT" : isLate(r.inTime) ? `LATE ${getLateMin(r.inTime)}m` : "ON TIME"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <button onClick={() => setDeleteConfirm(r.date)} style={{ background: "rgba(229,57,53,0.1)", border: "none", color: "#E53935", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div style={{ background: "white", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg,#0A1628,#0D2147)", padding: "48px 32px", textAlign: "center" }}>
              <ProfilePicUpload user={user} onUpdate={() => setPicKey(p => p + 1)} key={picKey} />
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", marginTop: "12px", letterSpacing: "1px" }}>Tap to change photo</div>
              <div style={{ color: "white", fontSize: "22px", fontWeight: 800, marginTop: "16px" }}>{user.name}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", letterSpacing: "3px", marginTop: "4px" }}>EMPLOYEE</div>
            </div>
            <div style={{ padding: "32px" }}>
              {[["Username", user.username], ["Total Days", getAllRecords(user.id).length], ["On Time", getAllRecords(user.id).filter(r => r.inTime && !isLate(r.inTime)).length], ["Late Days", getAllRecords(user.id).filter(r => r.inTime && isLate(r.inTime)).length]].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid #F8FAFF" }}>
                  <span style={{ color: "#64748b", fontSize: "13px", letterSpacing: "1px" }}>{label}</span>
                  <span style={{ color: "#0D2147", fontWeight: 800, fontSize: "15px" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────
function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState("overview");
  const [filterUser, setFilterUser] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [users, setUsers] = useState(getUsers());
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showDeleteAll, setShowDeleteAll] = useState(null);
  const [picKey, setPicKey] = useState(0);

  const employees = users.filter(u => u.role === "employee");
  const today = getTodayDate();
  const todayRecords = employees.map(u => {
    const key = getStorageKey(u.id, today);
    const rec = JSON.parse(localStorage.getItem(key) || "{}");
    return { ...u, ...rec };
  });
  const presentToday = todayRecords.filter(r => r.inTime).length;
  const lateToday = todayRecords.filter(r => r.inTime && isLate(r.inTime)).length;

  let allRecords = getAllEmployeeRecords(users);
  let filtered = allRecords;
  if (filterUser !== "all") filtered = filtered.filter(r => r.userId === parseInt(filterUser));
  if (filterMonth) filtered = filtered.filter(r => r.date.startsWith(filterMonth));
  if (filterStatus === "late") filtered = filtered.filter(r => r.inTime && isLate(r.inTime));
  if (filterStatus === "ontime") filtered = filtered.filter(r => r.inTime && !isLate(r.inTime));
  if (filterStatus === "absent") filtered = filtered.filter(r => !r.inTime);

  function handleDeleteRecord(userId, date) {
    deleteRecord(userId, date);
    setDeleteConfirm(null);
    setUsers([...getUsers()]);
  }
  function handleDeleteAllUser(userId) {
    deleteAllRecords(userId);
    setShowDeleteAll(null);
    setUsers([...getUsers()]);
  }

  const navStyle = { padding: "10px 22px", borderRadius: "8px", border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "11px", letterSpacing: "1.5px" };

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4FF", fontFamily: "'Montserrat',sans-serif" }}>
      {/* Confirm Modals */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "32px", maxWidth: "360px", width: "90%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>🗑️</div>
            <div style={{ fontWeight: 800, color: "#0D2147", fontSize: "16px", marginBottom: "8px" }}>Record Delete Karen?</div>
            <div style={{ color: "#64748b", fontSize: "13px", marginBottom: "24px" }}>{deleteConfirm.name} — {formatDate(deleteConfirm.date)}</div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "12px", color: "#64748b" }}>CANCEL</button>
              <button onClick={() => handleDeleteRecord(deleteConfirm.userId, deleteConfirm.date)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#E53935,#C62828)", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "12px", color: "white" }}>DELETE</button>
            </div>
          </div>
        </div>
      )}
      {showDeleteAll && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "16px", padding: "32px", maxWidth: "380px", width: "90%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>⚠️</div>
            <div style={{ fontWeight: 800, color: "#0D2147", fontSize: "16px", marginBottom: "8px" }}>{showDeleteAll.name} — Sab Records Delete?</div>
            <div style={{ color: "#64748b", fontSize: "13px", marginBottom: "24px" }}>Is employee ke saare records permanently delete ho jayenge.</div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setShowDeleteAll(null)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "12px", color: "#64748b" }}>CANCEL</button>
              <button onClick={() => handleDeleteAllUser(showDeleteAll.id)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#E53935,#C62828)", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: "12px", color: "white" }}>DELETE ALL</button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <div style={{ background: "linear-gradient(135deg,#0A1628,#0D2147)", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "70px", boxShadow: "0 4px 24px rgba(10,22,40,0.3)" }}>
        <VibexTextLogo size="sm" />
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>Admin Panel</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px", letterSpacing: "1px" }}>VIBEX DIGITAL</div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(229,57,53,0.15)", border: "1px solid rgba(229,57,53,0.25)", color: "#ef9a9a", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontFamily: "'Montserrat',sans-serif", letterSpacing: "1px" }}>LOGOUT</button>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "28px", flexWrap: "wrap" }}>
          {["overview", "today", "records", "employees"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...navStyle, background: tab === t ? "linear-gradient(135deg,#0D47A1,#1565C0)" : "white", color: tab === t ? "white" : "#64748b", boxShadow: tab === t ? "0 4px 16px rgba(13,71,161,0.3)" : "0 2px 8px rgba(0,0,0,0.06)" }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "16px", marginBottom: "28px" }}>
              {[{ label: "Total Employees", val: employees.length, color: "#0D47A1", icon: "👥" }, { label: "Present Today", val: presentToday, color: "#26C6A0", icon: "✅" }, { label: "Late Today", val: lateToday, color: "#F59E0B", icon: "⏰" }, { label: "Absent Today", val: employees.length - presentToday, color: "#E53935", icon: "❌" }].map(s => (
                <div key={s.label} style={{ background: "white", borderRadius: "14px", padding: "24px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)", borderLeft: `4px solid ${s.color}` }}>
                  <div style={{ fontSize: "22px", marginBottom: "8px" }}>{s.icon}</div>
                  <div style={{ fontSize: "36px", fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: "10px", color: "#94A3B8", letterSpacing: "1.5px", marginTop: "4px" }}>{s.label.toUpperCase()}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "white", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", fontWeight: 800, color: "#0D2147", fontSize: "15px" }}>Employee Summary</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFF" }}>
                      {["Employee", "Total Days", "On Time", "Late Days", "Late %", "Actions"].map(h => (
                        <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: "10px", color: "#64748b", letterSpacing: "2px", fontWeight: 700, borderBottom: "1px solid #F1F5F9" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(u => {
                      const recs = getAllRecords(u.id);
                      const late = recs.filter(r => r.inTime && isLate(r.inTime)).length;
                      const onT = recs.filter(r => r.inTime && !isLate(r.inTime)).length;
                      const pct = recs.length ? Math.round((late / recs.length) * 100) : 0;
                      return (
                        <tr key={u.id} style={{ borderBottom: "1px solid #F8FAFF" }}>
                          <td style={{ padding: "12px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <Avatar userId={u.id} fallback={u.avatar} size={34} />
                              <span style={{ fontWeight: 700, color: "#0D2147", fontSize: "13px" }}>{u.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 18px", color: "#334155", fontWeight: 700 }}>{recs.length}</td>
                          <td style={{ padding: "12px 18px", color: "#16A34A", fontWeight: 700 }}>{onT}</td>
                          <td style={{ padding: "12px 18px", color: "#E53935", fontWeight: 700 }}>{late}</td>
                          <td style={{ padding: "12px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ flex: 1, height: "6px", background: "#F1F5F9", borderRadius: "3px" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: pct > 50 ? "#E53935" : pct > 20 ? "#F59E0B" : "#26C6A0", borderRadius: "3px" }} />
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#334155", minWidth: "34px" }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 18px" }}>
                            <button onClick={() => setShowDeleteAll(u)} style={{ background: "rgba(229,57,53,0.1)", border: "none", color: "#E53935", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>🗑 All</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "today" && (
          <div style={{ background: "white", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, color: "#0D2147", fontSize: "15px" }}>Today — {formatDate(today)}</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8FAFF" }}>
                    {["Employee", "Check In", "Check Out", "Duration", "Status", "Late By", "Action"].map(h => (
                      <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: "10px", color: "#64748b", letterSpacing: "2px", fontWeight: 700, borderBottom: "1px solid #F1F5F9" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayRecords.map(r => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #F8FAFF" }}>
                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Avatar userId={r.id} fallback={r.avatar} size={32} />
                          <span style={{ fontWeight: 700, color: "#0D2147", fontSize: "13px" }}>{r.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 18px", color: "#334155", fontSize: "13px" }}>{formatTime(r.inTime)}</td>
                      <td style={{ padding: "12px 18px", color: "#334155", fontSize: "13px" }}>{formatTime(r.outTime)}</td>
                      <td style={{ padding: "12px 18px", color: "#334155", fontSize: "13px" }}>{getDuration(r.inTime, r.outTime)}</td>
                      <td style={{ padding: "12px 18px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", background: !r.inTime ? "#FEF2F2" : isLate(r.inTime) ? "#FFF7ED" : "#F0FDF4", color: !r.inTime ? "#E53935" : isLate(r.inTime) ? "#D97706" : "#16A34A" }}>
                          {!r.inTime ? "ABSENT" : isLate(r.inTime) ? "LATE" : "ON TIME"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px", color: "#E53935", fontWeight: 700, fontSize: "13px" }}>{r.inTime && isLate(r.inTime) ? `${getLateMin(r.inTime)} min` : "-"}</td>
                      <td style={{ padding: "12px 18px" }}>
                        {r.inTime && <button onClick={() => setDeleteConfirm({ userId: r.id, date: today, name: r.name })} style={{ background: "rgba(229,57,53,0.1)", border: "none", color: "#E53935", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>🗑</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "records" && (
          <div style={{ background: "white", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 800, color: "#0D2147", fontSize: "15px", marginRight: "8px" }}>All Records</div>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", fontFamily: "'Montserrat',sans-serif", fontSize: "12px", color: "#334155" }}>
                <option value="all">All Employees</option>
                {employees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", fontFamily: "'Montserrat',sans-serif", fontSize: "12px", color: "#334155" }} />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid #E2E8F0", fontFamily: "'Montserrat',sans-serif", fontSize: "12px", color: "#334155" }}>
                <option value="all">All Status</option>
                <option value="ontime">On Time</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
              </select>
              <button onClick={() => exportToCSV(filtered, "vibex_attendance.csv")} style={{ background: "linear-gradient(135deg,#0D47A1,#1565C0)", color: "white", border: "none", padding: "9px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", fontFamily: "'Montserrat',sans-serif", marginLeft: "auto" }}>↓ EXPORT CSV</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8FAFF" }}>
                    {["Employee", "Date", "Check In", "Check Out", "Duration", "Status", "Late By", "Delete"].map(h => (
                      <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: "10px", color: "#64748b", letterSpacing: "2px", fontWeight: 700, borderBottom: "1px solid #F1F5F9" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>Koi record nahi mila</td></tr>
                  ) : filtered.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F8FAFF" }}>
                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Avatar userId={r.userId} fallback={r.avatar} size={28} />
                          <span style={{ fontWeight: 700, color: "#0D2147", fontSize: "12px" }}>{r.userName}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 18px", color: "#334155", fontSize: "12px" }}>{formatDate(r.date)}</td>
                      <td style={{ padding: "12px 18px", color: "#334155", fontSize: "12px" }}>{formatTime(r.inTime)}</td>
                      <td style={{ padding: "12px 18px", color: "#334155", fontSize: "12px" }}>{formatTime(r.outTime)}</td>
                      <td style={{ padding: "12px 18px", color: "#334155", fontSize: "12px" }}>{getDuration(r.inTime, r.outTime)}</td>
                      <td style={{ padding: "12px 18px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", background: !r.inTime ? "#FEF2F2" : isLate(r.inTime) ? "#FFF7ED" : "#F0FDF4", color: !r.inTime ? "#E53935" : isLate(r.inTime) ? "#D97706" : "#16A34A" }}>
                          {!r.inTime ? "ABSENT" : isLate(r.inTime) ? "LATE" : "ON TIME"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px", color: "#E53935", fontWeight: 700, fontSize: "12px" }}>{r.inTime && isLate(r.inTime) ? `${getLateMin(r.inTime)} min` : "-"}</td>
                      <td style={{ padding: "12px 18px" }}>
                        <button onClick={() => setDeleteConfirm({ userId: r.userId, date: r.date, name: r.userName })} style={{ background: "rgba(229,57,53,0.1)", border: "none", color: "#E53935", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "employees" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "16px" }}>
            {employees.map(u => {
              const recs = getAllRecords(u.id);
              const late = recs.filter(r => r.inTime && isLate(r.inTime)).length;
              const onT = recs.filter(r => r.inTime && !isLate(r.inTime)).length;
              return (
                <div key={u.id} style={{ background: "white", borderRadius: "16px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                  <div style={{ background: "linear-gradient(135deg,#0A1628,#0D2147)", padding: "28px", textAlign: "center" }}>
                    <Avatar userId={u.id} fallback={u.avatar} size={64} />
                    <div style={{ color: "white", fontWeight: 800, fontSize: "16px", marginTop: "12px" }}>{u.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", letterSpacing: "2px", marginTop: "4px" }}>@{u.username}</div>
                  </div>
                  <div style={{ padding: "20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                      {[["Total", recs.length, "#0D47A1"], ["On Time", onT, "#26C6A0"], ["Late", late, "#E53935"]].map(([l, v, c]) => (
                        <div key={l} style={{ textAlign: "center", padding: "10px", background: "#F8FAFF", borderRadius: "8px" }}>
                          <div style={{ fontSize: "20px", fontWeight: 900, color: c }}>{v}</div>
                          <div style={{ fontSize: "9px", color: "#94A3B8", letterSpacing: "1px", marginTop: "2px" }}>{l.toUpperCase()}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setShowDeleteAll(u)} style={{ width: "100%", padding: "10px", background: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.2)", color: "#E53935", borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", fontFamily: "'Montserrat',sans-serif" }}>🗑 DELETE ALL RECORDS</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [ipAllowed, setIpAllowed] = useState(false);
  const [ipChecked, setIpChecked] = useState(false);

  useEffect(() => {
    if (ALLOWED_OFFICE_IP === "YOUR_OFFICE_IP_HERE") {
      setIpAllowed(true); setIpChecked(true); return;
    }
    fetch("https://api.ipify.org?format=json")
      .then(r => r.json())
      .then(data => { setIpAllowed(data.ip === ALLOWED_OFFICE_IP); setIpChecked(true); })
      .catch(() => { setIpAllowed(false); setIpChecked(true); });
  }, []);

  if (!ipChecked) return (
    <div style={{ minHeight: "100vh", background: "#0A1628", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',sans-serif" }}>
      <div style={{ color: "white", fontSize: "14px", letterSpacing: "4px" }}>LOADING...</div>
    </div>
  );

  if (page === "home") return <HomePage onLogin={() => setPage("login")} />;
  if (page === "login") return <LoginPage onSuccess={u => { setUser(u); setPage("dashboard"); }} onBack={() => setPage("home")} ipAllowed={ipAllowed} />;
  if (page === "dashboard") {
    if (user?.role === "admin") return <AdminDashboard onLogout={() => { setUser(null); setPage("home"); }} />;
    return <EmployeeDashboard user={user} onLogout={() => { setUser(null); setPage("home"); }} />;
  }
}
