import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// ✅ OFFICE ACCESS — 3-LAYER CHECK (IP-free, permanent)
// Layer 1: Time  — sirf office hours mein login allowed
// Layer 2: Network — mobile data pe block
// Layer 3: Admin — hamesha bypass, koi restriction nahi
const OFFICE_HOUR_START = 10 * 60 + 30;  // 10:30 AM = 630 min
const OFFICE_HOUR_END   = 22 * 60;        // 10:00 PM = 1320 min

async function checkOfficeAccess(isAdmin) {
  if (isAdmin) return { ok: true };

  // Layer 1: Time check (minutes-based for 10:30 support)
  const _n = new Date();
  const totalMin = _n.getHours() * 60 + _n.getMinutes();
  if (totalMin < OFFICE_HOUR_START || totalMin >= OFFICE_HOUR_END) {
    return {
      ok: false,
      reason: "Office hours ke bahar hain. Login 10:30 AM se 10:00 PM ke darmiyan ho sakta hai.",
    };
  }

  // Layer 2: WiFi naam check — "vibeX- Digital 4G" ke ilawa block
  const OFFICE_WIFI = "vibeX- Digital 4G";
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    // Mobile data check
    if (conn.type && conn.type !== "wifi" && conn.type !== "ethernet") {
      return {
        ok: false,
        reason: "Sirf office WiFi (vibeX- Digital 4G) se attendance lag sakti hai. Mobile data allowed nahi.",
      };
    }
    // WiFi naam check (jahan available ho)
    if (conn.ssid && conn.ssid !== OFFICE_WIFI) {
      return {
        ok: false,
        reason: `Sirf office WiFi "${OFFICE_WIFI}" se login ho sakta hai. Aap "${conn.ssid}" se connected hain.`,
      };
    }
  }

  return { ok: true };
}
// ============================================================

// ============================================================
// 🗄️ SUPABASE CONFIG
const SUPABASE_URL = "https://zsynfqmslbsaadgkwhzs.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZAbqB-oya175Lo-pZG-Xwg_E2WYNBqp";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
// ============================================================

const OFFICE_START = "10:30";
const LATE_TO_ABSENT = 3;

const DEFAULT_EMPLOYEES = [
  { id: "ahmed", name: "Ahmed Ali", username: "ahmed", password: "ahmed123", avatar: "AA", salary: 45000, working_days: 22 },
  { id: "sara", name: "Sara Khan", username: "sara", password: "sara123", avatar: "SK", salary: 38000, working_days: 22 },
  { id: "usman", name: "Usman Raza", username: "usman", password: "usman123", avatar: "UR", salary: 52000, working_days: 20 },
  { id: "fatima", name: "Fatima Noor", username: "fatima", password: "fatima123", avatar: "FN", salary: 41000, working_days: 12 },
  { id: "bilal", name: "Bilal Shah", username: "bilal", password: "bilal123", avatar: "BS", salary: 35000, working_days: 8 },
];
const ADMIN = { id: "admin", name: "Admin", username: "admin", password: "vibex@admin", avatar: "AD", role: "admin" };

// ── SUPABASE HELPERS ──────────────────────────────────────────
async function getEmployees() {
  const { data, error } = await sb.from("employees").select("*");
  if (error || !data || data.length === 0) {
    // Insert defaults if empty
    await sb.from("employees").upsert(DEFAULT_EMPLOYEES);
    return DEFAULT_EMPLOYEES;
  }
  return data;
}
async function saveEmployee(emp) {
  await sb.from("employees").upsert(emp);
}
async function getRecord(userId, date) {
  const { data } = await sb.from("attendance").select("*").eq("user_id", userId).eq("date", date).single();
  return data;
}
async function saveRecord(userId, date, updates) {
  const existing = await getRecord(userId, date);
  if (existing) {
    await sb.from("attendance").update(updates).eq("user_id", userId).eq("date", date);
  } else {
    await sb.from("attendance").insert({ id: `${userId}_${date}`, user_id: userId, date, ...updates });
  }
}
async function deleteRecord(userId, date) {
  await sb.from("attendance").delete().eq("user_id", userId).eq("date", date);
}
async function getUserRecords(userId) {
  const { data } = await sb.from("attendance").select("*").eq("user_id", userId).order("date", { ascending: false });
  return data || [];
}
async function getAllAttendance() {
  const { data } = await sb.from("attendance").select("*").order("date", { ascending: false });
  return data || [];
}
async function deleteAllUserRecords(userId) {
  await sb.from("attendance").delete().eq("user_id", userId);
}
async function getSelfie(userId, date) {
  const { data } = await sb.from("selfies").select("image").eq("user_id", userId).eq("date", date).single();
  return data?.image || null;
}
async function saveSelfie(userId, date, b64) {
  const existing = await getSelfie(userId, date);
  if (existing) {
    await sb.from("selfies").update({ image: b64 }).eq("user_id", userId).eq("date", date);
  } else {
    await sb.from("selfies").insert({ id: `${userId}_${date}`, user_id: userId, date, image: b64 });
  }
}
function getProfilePic(userId) { return localStorage.getItem(`vx_pic_${userId}`) || null; }
function saveProfilePic(userId, b64) { localStorage.setItem(`vx_pic_${userId}`, b64); }

// ── UTILS ─────────────────────────────────────────────────────
function today() { return new Date().toISOString().split("T")[0]; }
function fmtTime(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(d) { return new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }); }
function isLate(inTime) {
  if (!inTime) return false;
  const t = new Date(inTime), [h, m] = OFFICE_START.split(":").map(Number);
  const cut = new Date(t); cut.setHours(h, m, 0, 0);
  return t > cut;
}
function lateMin(inTime) {
  if (!inTime) return 0;
  const t = new Date(inTime), [h, m] = OFFICE_START.split(":").map(Number);
  const cut = new Date(t); cut.setHours(h, m, 0, 0);
  return Math.max(0, Math.floor((t - cut) / 60000));
}
function duration(inTime, outTime) {
  if (!inTime || !outTime) return "--";
  const d = Math.floor((new Date(outTime) - new Date(inTime)) / 60000);
  return `${Math.floor(d / 60)}h ${d % 60}m`;
}
function getMonthDates(year, month) {
  const dates = [], d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) { dates.push(d.toISOString().split("T")[0]); d.setDate(d.getDate() + 1); }
  return dates;
}
function calcSalary(emp, records, year, month) {
  const dates = getMonthDates(year, month);
  let lateCount = 0, presentCount = 0;
  dates.forEach(date => {
    const rec = records.find(r => r.date === date);
    if (rec && rec.in_time) { presentCount++; if (isLate(rec.in_time)) lateCount++; }
  });
  const lateAbsents = Math.floor(lateCount / LATE_TO_ABSENT);
  const perDay = emp.salary / emp.working_days;
  const deduction = lateAbsents * perDay;
  return { lateCount, lateAbsents, presentCount, perDay, deduction, finalSalary: Math.max(0, emp.salary - deduction) };
}
function exportCSV(data, filename) {
  const csv = data.map(r => r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename; a.click();
}

// ── STYLES ────────────────────────────────────────────────────
const S = { navy: "#0A1628", navyMid: "#0D2147", blue: "#1565C0", blueDark: "#0D47A1", teal: "#26C6A0", red: "#E53935", amber: "#F59E0B", green: "#16A34A", slate: "#64748b", light: "#F0F4FF" };
const card = { background: "white", borderRadius: "16px", boxShadow: "0 4px 24px rgba(10,22,40,0.08)", overflow: "hidden" };
const tag = (bg, color) => ({ padding: "4px 12px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", background: bg, color });

// ── LOGO ──────────────────────────────────────────────────────
const LOGO_SRC = "data:image/webp;base64,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";
function Logo({ size = "md" }) {
  const h = { sm: 36, md: 48, lg: 72 }[size] || 48;
  return (
    <img src={LOGO_SRC} alt="Fox Media" style={{ height: h, width: "auto", objectFit: "contain", userSelect: "none" }} />
  );
}

// ── AVATAR ────────────────────────────────────────────────────
function Avatar({ userId, fallback, size = 40 }) {
  const pic = getProfilePic(userId);
  return pic
    ? <img src={pic} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.2)", flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#1565C0,#26C6A0)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: size * 0.3, flexShrink: 0 }}>{fallback}</div>;
}

// ── LOADER ────────────────────────────────────────────────────
function Loader({ text = "LOADING..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: "3px solid #E2E8F0", borderTop: `3px solid ${S.blue}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ color: "#94A3B8", fontSize: 11, letterSpacing: 3, fontFamily: "'Montserrat',sans-serif" }}>{text}</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── SELFIE CAMERA ─────────────────────────────────────────────
function SelfieCamera({ onCapture, onCancel }) {
  const videoRef = useRef(), canvasRef = useRef();
  const [ready, setReady] = useState(false), [error, setError] = useState(null);
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(s => { videoRef.current.srcObject = s; setReady(true); })
      .catch(() => setError("Camera allow karo browser mein."));
    return () => { if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop()); };
  }, []);
  function capture() {
    const c = canvasRef.current, v = videoRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    v.srcObject.getTracks().forEach(t => t.stop());
    onCapture(c.toDataURL("image/jpeg", 0.5));
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.96)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, padding: 24 }}>
      <div style={{ color: "white", fontFamily: "'Montserrat',sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: 2 }}>SELFIE LO 📸</div>
      {error
        ? <div style={{ color: "#ef9a9a", textAlign: "center", fontFamily: "'Montserrat',sans-serif", fontSize: 14, maxWidth: 300 }}>{error}</div>
        : <div style={{ borderRadius: 16, overflow: "hidden", border: `2px solid ${S.teal}` }}>
          <video ref={videoRef} autoPlay playsInline style={{ width: "min(340px,90vw)", display: "block" }} />
        </div>
      }
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div style={{ display: "flex", gap: 12 }}>
        {!error && ready && <button onClick={capture} style={{ padding: "14px 36px", background: `linear-gradient(135deg,${S.teal},#00897B)`, color: "white", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", letterSpacing: 2 }}>📸 CAPTURE</button>}
        <button onClick={onCancel} style={{ padding: "14px 24px", background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Montserrat',sans-serif" }}>CANCEL</button>
      </div>
    </div>
  );
}

// ── MODAL ─────────────────────────────────────────────────────
function Modal({ title, msg, onOk, onCancel, okLabel = "DELETE" }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 18, padding: "36px 32px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", fontFamily: "'Montserrat',sans-serif" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontWeight: 800, color: S.navy, fontSize: 17, marginBottom: 10 }}>{title}</div>
        <div style={{ color: S.slate, fontSize: 13, marginBottom: 28, lineHeight: 1.7 }}>{msg}</div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 13, borderRadius: 9, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 12, color: S.slate }}>CANCEL</button>
          <button onClick={onOk} style={{ flex: 1, padding: 13, borderRadius: 9, border: "none", background: `linear-gradient(135deg,${S.red},#C62828)`, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 12, color: "white" }}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────────
function Nav({ right }) {
  return (
    <div style={{ background: `linear-gradient(135deg,${S.navy},${S.navyMid})`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 70, boxShadow: "0 4px 24px rgba(10,22,40,0.3)", position: "sticky", top: 0, zIndex: 100 }}>
      <Logo size="sm" />
      {right}
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────
function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{ padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "1.5px", background: active === t.id ? `linear-gradient(135deg,${S.blueDark},${S.blue})` : "white", color: active === t.id ? "white" : S.slate, boxShadow: active === t.id ? "0 4px 16px rgba(13,71,161,0.3)" : "0 2px 8px rgba(0,0,0,0.06)" }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────
function Home({ onLogin }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg,${S.navy},${S.navyMid} 50%,${S.navy})`, display: "flex", flexDirection: "column", fontFamily: "'Montserrat',sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: -120, left: -120, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(229,57,53,0.1) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -120, right: -120, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(38,198,160,0.08) 0%,transparent 70%)", pointerEvents: "none" }} />
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 48px", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "relative", zIndex: 10 }}>
        <Logo size="md" />
        <button onClick={onLogin} style={{ background: `linear-gradient(135deg,${S.blue},${S.blueDark})`, color: "white", border: "1px solid rgba(255,255,255,0.15)", padding: "12px 32px", borderRadius: 8, fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, cursor: "pointer" }}>LOGIN →</button>
      </nav>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: "60px 24px", position: "relative", zIndex: 5, textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 5, color: S.teal, fontWeight: 700, marginBottom: 20 }}>ATTENDANCE MANAGEMENT SYSTEM</div>
        <h1 style={{ fontSize: "clamp(40px,6vw,72px)", fontWeight: 900, color: "white", margin: "0 0 16px", lineHeight: 1.05, letterSpacing: -2 }}>
          Track. Manage.<br />
          <span style={{ background: `linear-gradient(90deg,${S.red},${S.teal})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Grow.</span>
        </h1>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", maxWidth: 480, lineHeight: 1.9, marginBottom: 48 }}>Selfie attendance, salary deduction, late policy — sab ek jagah.</p>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 18, padding: "28px 56px", backdropFilter: "blur(20px)", marginBottom: 48 }}>
          <div style={{ fontSize: 50, fontWeight: 900, color: "white", letterSpacing: 4, fontVariantNumeric: "tabular-nums" }}>
            {time.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 10, letterSpacing: 2 }}>
            {time.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <button onClick={onLogin} style={{ background: `linear-gradient(135deg,${S.blue},${S.blueDark})`, color: "white", border: "none", padding: "18px 60px", borderRadius: 10, fontSize: 14, fontWeight: 700, letterSpacing: 3, cursor: "pointer", fontFamily: "'Montserrat',sans-serif" }}>PORTAL MEIN ENTER KAREN →</button>
        <div style={{ display: "flex", gap: 48, marginTop: 64, flexWrap: "wrap", justifyContent: "center" }}>
          {[["📸", "Selfie Attendance"], ["💰", "Salary Deduction"], ["📊", "Monthly Reports"]].map(([icon, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28 }}>{icon}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginTop: 6 }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "center", padding: 20, borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: 2 }}> DEVELOP BY HASNAIN RAZA © 2026 VIBEX DIGITAL</div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────
function Login({ onSuccess, onBack, employees }) {
  const [user, setUser] = useState(""), [pass, setPass] = useState(""), [err, setErr] = useState(""), [loading, setLoading] = useState(false);
  async function go() {
    if (!user || !pass) { setErr("Username aur password dono bharo."); return; }
    setLoading(true);
    setErr("");
    // Admin: 3-layer bypass
    const isAdmin = user === ADMIN.username && pass === ADMIN.password;
    const access = await checkOfficeAccess(isAdmin);
    if (!access.ok) { setErr("⚠️ " + access.reason); setLoading(false); return; }
    if (isAdmin) { onSuccess(ADMIN); return; }
    const emp = employees.find(e => e.username === user && e.password === pass);
    if (emp) onSuccess({ ...emp, role: "employee" });
    else { setErr("Username ya password galat hai."); setLoading(false); }
  }
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg,${S.navy},${S.navyMid})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',sans-serif", padding: 24 }}>
      <div style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 20, padding: "48px 40px", width: "100%", maxWidth: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <Logo size="lg" />
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 14, letterSpacing: 4 }}>ATTENDANCE PORTAL</div>
        </div>
        <div style={{ background: "rgba(38,198,160,0.08)", border: "1px solid rgba(38,198,160,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 1.6 }}>
          📶 Office WiFi pe connected ho kar login karen &nbsp;|&nbsp; ⏰ Hours: 10:30 AM – 10:00 PM
        </div>
        {[{ label: "USERNAME", val: user, set: setUser, type: "text" }, { label: "PASSWORD", val: pass, set: setPass, type: "password" }].map(f => (
          <div key={f.label} style={{ marginBottom: 20 }}>
            <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 8 }}>{f.label}</label>
            <input value={f.val} type={f.type} onChange={e => { f.set(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && go()} placeholder={`Enter ${f.label.toLowerCase()}`}
              style={{ width: "100%", padding: "14px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white", fontSize: 14, fontFamily: "'Montserrat',sans-serif", outline: "none", boxSizing: "border-box" }} />
          </div>
        ))}
        {err && <div style={{ color: "#ef9a9a", fontSize: 12, textAlign: "center", marginBottom: 16 }}>{err}</div>}
        <button onClick={go} disabled={loading} style={{ width: "100%", padding: 16, background: loading ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg,${S.blue},${S.blueDark})`, color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, letterSpacing: 2, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Montserrat',sans-serif" }}>
          {loading ? "CHECK HO RAHA HAI..." : "LOGIN →"}
        </button>
        <button onClick={onBack} style={{ width: "100%", marginTop: 14, padding: 12, background: "transparent", color: "rgba(255,255,255,0.35)", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'Montserrat',sans-serif" }}>← Back</button>
      </div>
    </div>
  );
}

// ── SELFIE THUMB ──────────────────────────────────────────────
function SelfieThumb({ userId, date, onClick }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { getSelfie(userId, date).then(setSrc); }, [userId, date]);
  return src
    ? <img onClick={() => onClick(src)} src={src} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", cursor: "pointer", border: `2px solid ${S.teal}` }} />
    : <span style={{ color: "#CBD5E1", fontSize: 11 }}>--</span>;
}

// ── EMPLOYEE DASHBOARD ────────────────────────────────────────
function EmpDashboard({ emp, onLogout }) {
  const td = today();
  const [inTime, setInTime] = useState(null), [outTime, setOutTime] = useState(null);
  const [now, setNow] = useState(new Date()), [tab, setTab] = useState("today");
  const [records, setRecords] = useState([]), [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false), [selfie, setSelfie] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null), [picTick, setPicTick] = useState(0);
  const [viewSelfie, setViewSelfie] = useState(null), [saving, setSaving] = useState(false);
  const picRef = useRef();

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [rec, recs, s] = await Promise.all([getRecord(emp.id, td), getUserRecords(emp.id), getSelfie(emp.id, td)]);
      if (rec) { setInTime(rec.in_time || null); setOutTime(rec.out_time || null); }
      setRecords(recs); setSelfie(s); setLoading(false);
    }
    load();
  }, [emp.id]);

  async function handleSelfie(b64) {
    setSaving(true);
    const t = new Date().toISOString();
    await Promise.all([saveSelfie(emp.id, td, b64), saveRecord(emp.id, td, { in_time: t })]);
    setSelfie(b64); setInTime(t); setShowCamera(false);
    setRecords(await getUserRecords(emp.id));
    setSaving(false);
  }

  async function markOut() {
    setSaving(true);
    const t = new Date().toISOString();
    await saveRecord(emp.id, td, { out_time: t });
    setOutTime(t); setRecords(await getUserRecords(emp.id));
    setSaving(false);
  }

  async function handleDel(date) {
    await deleteRecord(emp.id, date);
    if (date === td) { setInTime(null); setOutTime(null); setSelfie(null); }
    setDelConfirm(null); setRecords(await getUserRecords(emp.id));
  }

  const lateCount = records.filter(r => r.in_time && isLate(r.in_time)).length;
  const onTimeCount = records.filter(r => r.in_time && !isLate(r.in_time)).length;
  const now2 = new Date();
  const sal = calcSalary(emp, records, now2.getFullYear(), now2.getMonth() + 1);

  return (
    <div style={{ minHeight: "100vh", background: S.light, fontFamily: "'Montserrat',sans-serif" }}>
      {showCamera && <SelfieCamera onCapture={handleSelfie} onCancel={() => setShowCamera(false)} />}
      {delConfirm && <Modal title="Record Delete?" msg={`${fmtDate(delConfirm)} ka record delete ho jayega.`} onOk={() => handleDel(delConfirm)} onCancel={() => setDelConfirm(null)} />}
      {viewSelfie && <div onClick={() => setViewSelfie(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><img src={viewSelfie} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 16 }} /></div>}

      <Nav right={
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ cursor: "pointer", position: "relative" }} onClick={() => picRef.current.click()}>
            <Avatar userId={emp.id} fallback={emp.avatar} size={38} key={picTick} />
            <div style={{ position: "absolute", bottom: -2, right: -2, width: 16, height: 16, borderRadius: "50%", background: S.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, border: "2px solid white" }}>📷</div>
            <input ref={picRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { saveProfilePic(emp.id, ev.target.result); setPicTick(p => p + 1); }; r.readAsDataURL(f); }} />
          </div>
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{emp.name}</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: 1 }}>EMPLOYEE</div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(229,57,53,0.15)", border: "1px solid rgba(229,57,53,0.25)", color: "#ef9a9a", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: "'Montserrat',sans-serif" }}>LOGOUT</button>
        </div>
      } />

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px" }}>
        <Tabs tabs={[{ id: "today", label: "TODAY" }, { id: "history", label: "HISTORY" }, { id: "salary", label: "MY SALARY" }]} active={tab} onChange={setTab} />
        {loading ? <Loader /> : (
          <>
            {tab === "today" && (
              <>
                <div style={{ background: `linear-gradient(135deg,${S.navy},${S.navyMid})`, borderRadius: 16, padding: 32, marginBottom: 24, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle,rgba(38,198,160,0.1) 0%,transparent 70%)" }} />
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 3, marginBottom: 8 }}>{now.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
                  <div style={{ color: "white", fontSize: 50, fontWeight: 900, letterSpacing: 4, fontVariantNumeric: "tabular-nums" }}>{now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</div>
                  <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: S.teal, boxShadow: `0 0 8px ${S.teal}` }} />
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 2 }}>OFFICE HOURS: 10:30 AM</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                  <div style={{ ...card, borderTop: `4px solid ${S.teal}`, padding: 28 }}>
                    <div style={{ fontSize: 10, color: "#94A3B8", letterSpacing: 2, marginBottom: 16 }}>CHECK IN</div>
                    {inTime ? (
                      <>
                        <div style={{ fontSize: 26, fontWeight: 900, color: S.navy }}>{fmtTime(inTime)}</div>
                        <div style={{ marginTop: 8, fontSize: 12, color: isLate(inTime) ? S.red : S.teal, fontWeight: 700 }}>{isLate(inTime) ? `⚠ ${lateMin(inTime)} min late` : "✓ On Time"}</div>
                        {selfie && <img onClick={() => setViewSelfie(selfie)} src={selfie} alt="" style={{ width: "100%", borderRadius: 10, marginTop: 12, objectFit: "cover", maxHeight: 120, cursor: "pointer" }} />}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 26, fontWeight: 900, color: "#CBD5E1" }}>--:--</div>
                        <button onClick={() => setShowCamera(true)} disabled={saving} style={{ marginTop: 16, width: "100%", padding: 13, background: saving ? "#E2E8F0" : `linear-gradient(135deg,${S.teal},#00897B)`, color: saving ? "#94A3B8" : "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 12, letterSpacing: 1, cursor: saving ? "wait" : "pointer", fontFamily: "'Montserrat',sans-serif" }}>
                          {saving ? "SAVING..." : "📸 SELFIE & CHECK IN"}
                        </button>
                      </>
                    )}
                  </div>
                  <div style={{ ...card, borderTop: `4px solid ${S.blue}`, padding: 28 }}>
                    <div style={{ fontSize: 10, color: "#94A3B8", letterSpacing: 2, marginBottom: 16 }}>CHECK OUT</div>
                    {outTime ? (
                      <>
                        <div style={{ fontSize: 26, fontWeight: 900, color: S.navy }}>{fmtTime(outTime)}</div>
                        <div style={{ marginTop: 8, fontSize: 12, color: S.blue, fontWeight: 600 }}>Duration: {duration(inTime, outTime)}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 26, fontWeight: 900, color: "#CBD5E1" }}>--:--</div>
                        <button onClick={markOut} disabled={!inTime || saving} style={{ marginTop: 16, width: "100%", padding: 13, background: (!inTime || saving) ? "#E2E8F0" : `linear-gradient(135deg,${S.blue},${S.blueDark})`, color: (!inTime || saving) ? "#94A3B8" : "white", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: (!inTime || saving) ? "not-allowed" : "pointer", fontFamily: "'Montserrat',sans-serif" }}>
                          {saving ? "SAVING..." : "MARK OUT ↑"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                  {[{ l: "Total Days", v: records.length, c: S.blueDark }, { l: "On Time", v: onTimeCount, c: S.teal }, { l: "Late Days", v: lateCount, c: S.red }].map(s => (
                    <div key={s.l} style={{ ...card, padding: 20, textAlign: "center" }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: "#94A3B8", letterSpacing: 1.5, marginTop: 4 }}>{s.l.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === "history" && (
              <div style={card}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ fontWeight: 800, color: S.navy, fontSize: 15 }}>Attendance History</div>
                  <button onClick={() => exportCSV([["Date", "Check In", "Check Out", "Duration", "Status"], ...records.map(r => [fmtDate(r.date), fmtTime(r.in_time), fmtTime(r.out_time), duration(r.in_time, r.out_time), r.in_time ? (isLate(r.in_time) ? "Late" : "On Time") : "Absent"])], `${emp.name}_attendance.csv`)}
                    style={{ background: `linear-gradient(135deg,${S.blueDark},${S.blue})`, color: "white", border: "none", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>↓ EXPORT</button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ background: "#F8FAFF" }}>{["Date", "In", "Out", "Duration", "Status", "Selfie", "Del"].map(h => <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 10, color: S.slate, letterSpacing: 2, fontWeight: 700, borderBottom: "1px solid #F1F5F9" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {records.length === 0 ? <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Koi record nahi</td></tr>
                        : records.map(r => (
                          <tr key={r.date} style={{ borderBottom: "1px solid #F8FAFF" }}>
                            <td style={{ padding: "12px 18px", fontWeight: 700, color: S.navy, fontSize: 13 }}>{fmtDate(r.date)}</td>
                            <td style={{ padding: "12px 18px", color: "#334155", fontSize: 13 }}>{fmtTime(r.in_time)}</td>
                            <td style={{ padding: "12px 18px", color: "#334155", fontSize: 13 }}>{fmtTime(r.out_time)}</td>
                            <td style={{ padding: "12px 18px", color: "#334155", fontSize: 13 }}>{duration(r.in_time, r.out_time)}</td>
                            <td style={{ padding: "12px 18px" }}><span style={tag(!r.in_time ? "#FEF2F2" : isLate(r.in_time) ? "#FEF2F2" : "#F0FDF4", !r.in_time ? S.red : isLate(r.in_time) ? S.red : S.green)}>{!r.in_time ? "ABSENT" : isLate(r.in_time) ? `LATE ${lateMin(r.in_time)}m` : "ON TIME"}</span></td>
                            <td style={{ padding: "12px 18px" }}><SelfieThumb userId={emp.id} date={r.date} onClick={setViewSelfie} /></td>
                            <td style={{ padding: "12px 18px" }}><button onClick={() => setDelConfirm(r.date)} style={{ background: "rgba(229,57,53,0.1)", border: "none", color: S.red, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>🗑</button></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "salary" && (
              <div style={card}>
                <div style={{ background: `linear-gradient(135deg,${S.navy},${S.navyMid})`, padding: "28px 32px" }}>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 3 }}>IS MAAH KI SALARY</div>
                  <div style={{ color: "white", fontSize: 42, fontWeight: 900, marginTop: 8 }}>Rs. {Math.round(sal.finalSalary).toLocaleString()}</div>
                  {sal.deduction > 0 && <div style={{ color: "#ef9a9a", fontSize: 13, marginTop: 6 }}>- Rs. {Math.round(sal.deduction).toLocaleString()} deduction</div>}
                </div>
                <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 }}>
                  {[{ l: "Monthly Salary", v: `Rs. ${emp.salary.toLocaleString()}`, c: S.blueDark }, { l: "Working Days", v: emp.working_days, c: S.teal }, { l: "Per Day", v: `Rs. ${Math.round(sal.perDay).toLocaleString()}`, c: S.slate }, { l: "Late Count", v: sal.lateCount, c: S.amber }, { l: "Late Absents", v: sal.lateAbsents, c: S.red }, { l: "Deduction", v: `Rs. ${Math.round(sal.deduction).toLocaleString()}`, c: S.red }].map(s => (
                    <div key={s.l} style={{ textAlign: "center", padding: 14, background: S.light, borderRadius: 10 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: 9, color: "#94A3B8", letterSpacing: 1.5, marginTop: 4 }}>{s.l.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "12px 32px 20px", borderTop: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: 12, color: S.slate }}>📌 Policy: <strong>3 late = 1 absent</strong> — {sal.lateCount} late → {sal.lateAbsents} absent counted</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────
function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState("overview");
  const [employees, setEmployees] = useState([]);
  const [allRecs, setAllRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("all"), [filterMonth, setFilterMonth] = useState(""), [filterStatus, setFilterStatus] = useState("all");
  const [delConfirm, setDelConfirm] = useState(null), [delAllConfirm, setDelAllConfirm] = useState(null);
  const [editEmp, setEditEmp] = useState(null), [viewSelfie, setViewSelfie] = useState(null);
  const [salMonth, setSalMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  const td = today();

  async function loadAll() {
    setLoading(true);
    const [emps, recs] = await Promise.all([getEmployees(), getAllAttendance()]);
    setEmployees(emps); setAllRecs(recs); setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  const todayRecs = employees.map(e => ({ ...e, ...(allRecs.find(r => r.user_id === e.id && r.date === td) || {}) }));
  const presentToday = todayRecs.filter(r => r.in_time).length;
  const lateToday = todayRecs.filter(r => r.in_time && isLate(r.in_time)).length;

  let filtered = allRecs.map(r => ({ ...r, empName: employees.find(e => e.id === r.user_id)?.name || r.user_id, avatar: employees.find(e => e.id === r.user_id)?.avatar || "?" }));
  if (filterUser !== "all") filtered = filtered.filter(r => r.user_id === filterUser);
  if (filterMonth) filtered = filtered.filter(r => r.date.startsWith(filterMonth));
  if (filterStatus === "late") filtered = filtered.filter(r => r.in_time && isLate(r.in_time));
  if (filterStatus === "ontime") filtered = filtered.filter(r => r.in_time && !isLate(r.in_time));

  async function handleSaveEmp(updated) {
    await saveEmployee(updated); setEditEmp(null); loadAll();
  }

  const [salYear, salMonthNum] = salMonth.split("-").map(Number);

  return (
    <div style={{ minHeight: "100vh", background: S.light, fontFamily: "'Montserrat',sans-serif" }}>
      {delConfirm && <Modal title="Record Delete?" msg={`${delConfirm.name} — ${fmtDate(delConfirm.date)}`} onOk={async () => { await deleteRecord(delConfirm.userId, delConfirm.date); setDelConfirm(null); loadAll(); }} onCancel={() => setDelConfirm(null)} />}
      {delAllConfirm && <Modal title={`${delAllConfirm.name} — Sab Delete?`} msg="Is employee ke saare records delete ho jayenge." onOk={async () => { await deleteAllUserRecords(delAllConfirm.id); setDelAllConfirm(null); loadAll(); }} onCancel={() => setDelAllConfirm(null)} />}
      {viewSelfie && <div onClick={() => setViewSelfie(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><img src={viewSelfie} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 16 }} /></div>}

      {editEmp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 18, padding: "36px 32px", maxWidth: 420, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", fontFamily: "'Montserrat',sans-serif" }}>
            <div style={{ fontWeight: 800, color: S.navy, fontSize: 17, marginBottom: 24 }}>✏️ {editEmp.name}</div>
            {[{ label: "Monthly Salary (Rs)", key: "salary", type: "number" }, { label: "Working Days Per Month", key: "working_days", type: "number" }, { label: "Password", key: "password", type: "text" }].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: S.slate, letterSpacing: 1.5, display: "block", marginBottom: 6 }}>{f.label.toUpperCase()}</label>
                <input type={f.type} value={editEmp[f.key]} onChange={e => setEditEmp({ ...editEmp, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                  style={{ width: "100%", padding: "12px 16px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, fontFamily: "'Montserrat',sans-serif", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setEditEmp(null)} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 12, color: S.slate }}>CANCEL</button>
              <button onClick={() => handleSaveEmp(editEmp)} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: `linear-gradient(135deg,${S.blue},${S.blueDark})`, cursor: "pointer", fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 12, color: "white" }}>SAVE</button>
            </div>
          </div>
        </div>
      )}

      <Nav right={
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: 13 }}>Admin Panel</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: 1 }}>VIBEX DIGITAL</div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(229,57,53,0.15)", border: "1px solid rgba(229,57,53,0.25)", color: "#ef9a9a", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: "'Montserrat',sans-serif" }}>LOGOUT</button>
        </div>
      } />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <Tabs tabs={[{ id: "overview", label: "OVERVIEW" }, { id: "today", label: "TODAY" }, { id: "records", label: "RECORDS" }, { id: "salary", label: "SALARY" }, { id: "employees", label: "EMPLOYEES" }]} active={tab} onChange={setTab} />

        {loading ? <Loader text="DATA LOAD HO RAHA HAI..." /> : (
          <>
            {tab === "overview" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16, marginBottom: 28 }}>
                  {[{ l: "Total Employees", v: employees.length, c: S.blueDark, i: "👥" }, { l: "Present Today", v: presentToday, c: S.teal, i: "✅" }, { l: "Late Today", v: lateToday, c: S.amber, i: "⏰" }, { l: "Absent Today", v: employees.length - presentToday, c: S.red, i: "❌" }].map(s => (
                    <div key={s.l} style={{ ...card, padding: 24, borderLeft: `4px solid ${s.c}` }}>
                      <div style={{ fontSize: 22, marginBottom: 8 }}>{s.i}</div>
                      <div style={{ fontSize: 36, fontWeight: 900, color: s.c }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: "#94A3B8", letterSpacing: 1.5, marginTop: 4 }}>{s.l.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
                <div style={card}>
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", fontWeight: 800, color: S.navy, fontSize: 15 }}>Employee Summary</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr style={{ background: "#F8FAFF" }}>{["Employee", "Total", "On Time", "Late", "Late %", "Actions"].map(h => <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 10, color: S.slate, letterSpacing: 2, fontWeight: 700, borderBottom: "1px solid #F1F5F9" }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {employees.map(e => {
                          const recs = allRecs.filter(r => r.user_id === e.id);
                          const late = recs.filter(r => r.in_time && isLate(r.in_time)).length;
                          const onT = recs.filter(r => r.in_time && !isLate(r.in_time)).length;
                          const pct = recs.length ? Math.round((late / recs.length) * 100) : 0;
                          return (
                            <tr key={e.id} style={{ borderBottom: "1px solid #F8FAFF" }}>
                              <td style={{ padding: "12px 18px" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar userId={e.id} fallback={e.avatar} size={32} /><span style={{ fontWeight: 700, color: S.navy, fontSize: 13 }}>{e.name}</span></div></td>
                              <td style={{ padding: "12px 18px", color: "#334155", fontWeight: 700 }}>{recs.length}</td>
                              <td style={{ padding: "12px 18px", color: S.green, fontWeight: 700 }}>{onT}</td>
                              <td style={{ padding: "12px 18px", color: S.red, fontWeight: 700 }}>{late}</td>
                              <td style={{ padding: "12px 18px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ flex: 1, height: 6, background: "#F1F5F9", borderRadius: 3 }}><div style={{ width: `${pct}%`, height: "100%", background: pct > 50 ? S.red : pct > 20 ? S.amber : S.teal, borderRadius: 3 }} /></div>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", minWidth: 32 }}>{pct}%</span>
                                </div>
                              </td>
                              <td style={{ padding: "12px 18px" }}>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => setEditEmp(e)} style={{ background: "rgba(21,101,192,0.1)", border: "none", color: S.blue, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>✏️</button>
                                  <button onClick={() => setDelAllConfirm(e)} style={{ background: "rgba(229,57,53,0.1)", border: "none", color: S.red, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>🗑</button>
                                </div>
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
              <div style={card}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", fontWeight: 800, color: S.navy, fontSize: 15 }}>Today — {fmtDate(td)}</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ background: "#F8FAFF" }}>{["Employee", "In", "Out", "Duration", "Status", "Late", "Selfie", "Del"].map(h => <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 10, color: S.slate, letterSpacing: 2, fontWeight: 700, borderBottom: "1px solid #F1F5F9" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {todayRecs.map(r => (
                        <tr key={r.id} style={{ borderBottom: "1px solid #F8FAFF" }}>
                          <td style={{ padding: "12px 18px" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar userId={r.id} fallback={r.avatar} size={32} /><span style={{ fontWeight: 700, color: S.navy, fontSize: 13 }}>{r.name}</span></div></td>
                          <td style={{ padding: "12px 18px", color: "#334155", fontSize: 13 }}>{fmtTime(r.in_time)}</td>
                          <td style={{ padding: "12px 18px", color: "#334155", fontSize: 13 }}>{fmtTime(r.out_time)}</td>
                          <td style={{ padding: "12px 18px", color: "#334155", fontSize: 13 }}>{duration(r.in_time, r.out_time)}</td>
                          <td style={{ padding: "12px 18px" }}><span style={tag(!r.in_time ? "#FEF2F2" : isLate(r.in_time) ? "#FFF7ED" : "#F0FDF4", !r.in_time ? S.red : isLate(r.in_time) ? "#D97706" : S.green)}>{!r.in_time ? "ABSENT" : isLate(r.in_time) ? "LATE" : "ON TIME"}</span></td>
                          <td style={{ padding: "12px 18px", color: S.red, fontWeight: 700, fontSize: 13 }}>{r.in_time && isLate(r.in_time) ? `${lateMin(r.in_time)} min` : "-"}</td>
                          <td style={{ padding: "12px 18px" }}><SelfieThumb userId={r.id} date={td} onClick={setViewSelfie} /></td>
                          <td style={{ padding: "12px 18px" }}>{r.in_time && <button onClick={() => setDelConfirm({ userId: r.id, date: td, name: r.name })} style={{ background: "rgba(229,57,53,0.1)", border: "none", color: S.red, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>🗑</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "records" && (
              <div style={card}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 800, color: S.navy, fontSize: 15, marginRight: 8 }}>All Records</div>
                  <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "'Montserrat',sans-serif", fontSize: 12 }}>
                    <option value="all">All Employees</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "'Montserrat',sans-serif", fontSize: 12 }} />
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "'Montserrat',sans-serif", fontSize: 12 }}>
                    <option value="all">All Status</option>
                    <option value="ontime">On Time</option>
                    <option value="late">Late</option>
                  </select>
                  <button onClick={() => exportCSV([["Employee", "Date", "In", "Out", "Duration", "Status"], ...filtered.map(r => [r.empName, fmtDate(r.date), fmtTime(r.in_time), fmtTime(r.out_time), duration(r.in_time, r.out_time), r.in_time ? (isLate(r.in_time) ? "Late" : "On Time") : "Absent"])], "vibex_records.csv")}
                    style={{ background: `linear-gradient(135deg,${S.blueDark},${S.blue})`, color: "white", border: "none", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", marginLeft: "auto" }}>↓ EXPORT</button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr style={{ background: "#F8FAFF" }}>{["Employee", "Date", "In", "Out", "Duration", "Status", "Selfie", "Del"].map(h => <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontSize: 10, color: S.slate, letterSpacing: 2, fontWeight: 700, borderBottom: "1px solid #F1F5F9" }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {filtered.length === 0 ? <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Koi record nahi</td></tr>
                        : filtered.map((r, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #F8FAFF" }}>
                            <td style={{ padding: "12px 18px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar userId={r.user_id} fallback={r.avatar} size={28} /><span style={{ fontWeight: 700, color: S.navy, fontSize: 12 }}>{r.empName}</span></div></td>
                            <td style={{ padding: "12px 18px", color: "#334155", fontSize: 12 }}>{fmtDate(r.date)}</td>
                            <td style={{ padding: "12px 18px", color: "#334155", fontSize: 12 }}>{fmtTime(r.in_time)}</td>
                            <td style={{ padding: "12px 18px", color: "#334155", fontSize: 12 }}>{fmtTime(r.out_time)}</td>
                            <td style={{ padding: "12px 18px", color: "#334155", fontSize: 12 }}>{duration(r.in_time, r.out_time)}</td>
                            <td style={{ padding: "12px 18px" }}><span style={tag(!r.in_time ? "#FEF2F2" : isLate(r.in_time) ? "#FFF7ED" : "#F0FDF4", !r.in_time ? S.red : isLate(r.in_time) ? "#D97706" : S.green)}>{!r.in_time ? "ABSENT" : isLate(r.in_time) ? "LATE" : "ON TIME"}</span></td>
                            <td style={{ padding: "12px 18px" }}><SelfieThumb userId={r.user_id} date={r.date} onClick={setViewSelfie} /></td>
                            <td style={{ padding: "12px 18px" }}><button onClick={() => setDelConfirm({ userId: r.user_id, date: r.date, name: r.empName })} style={{ background: "rgba(229,57,53,0.1)", border: "none", color: S.red, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>🗑</button></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "salary" && (
              <div>
                <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, color: S.navy, fontSize: 16 }}>Salary Report</div>
                  <input type="month" value={salMonth} onChange={e => setSalMonth(e.target.value)} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E2E8F0", fontFamily: "'Montserrat',sans-serif", fontSize: 13 }} />
                  <button onClick={() => {
                    const rows = [["Employee", "Salary", "Working Days", "Per Day", "Present", "Late", "Absents", "Deduction", "Final"]];
                    employees.forEach(e => { const recs = allRecs.filter(r => r.user_id === e.id); const s = calcSalary(e, recs, salYear, salMonthNum); rows.push([e.name, e.salary, e.working_days, Math.round(s.perDay), s.presentCount, s.lateCount, s.lateAbsents, Math.round(s.deduction), Math.round(s.finalSalary)]); });
                    exportCSV(rows, `vibex_salary_${salMonth}.csv`);
                  }} style={{ background: `linear-gradient(135deg,${S.teal},#00897B)`, color: "white", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>↓ EXPORT SALARY</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                  {employees.map(e => {
                    const recs = allRecs.filter(r => r.user_id === e.id);
                    const s = calcSalary(e, recs, salYear, salMonthNum);
                    return (
                      <div key={e.id} style={card}>
                        <div style={{ background: `linear-gradient(135deg,${S.navy},${S.navyMid})`, padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
                          <Avatar userId={e.id} fallback={e.avatar} size={44} />
                          <div><div style={{ color: "white", fontWeight: 800, fontSize: 15 }}>{e.name}</div><div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 2 }}>{e.working_days} DAYS/MONTH</div></div>
                          <div style={{ marginLeft: "auto", textAlign: "right" }}>
                            <div style={{ color: S.teal, fontSize: 20, fontWeight: 900 }}>Rs. {Math.round(s.finalSalary).toLocaleString()}</div>
                            {s.deduction > 0 && <div style={{ color: "#ef9a9a", fontSize: 11 }}>-Rs. {Math.round(s.deduction).toLocaleString()}</div>}
                          </div>
                        </div>
                        <div style={{ padding: "16px 24px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                            {[["Present", s.presentCount, S.teal], ["Late", s.lateCount, S.amber], ["Absents", s.lateAbsents, S.red]].map(([l, v, c]) => (
                              <div key={l} style={{ textAlign: "center", padding: "10px 8px", background: S.light, borderRadius: 8 }}>
                                <div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v}</div>
                                <div style={{ fontSize: 9, color: "#94A3B8", letterSpacing: 1 }}>{l}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ background: S.light, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: S.slate }}>Base Salary</span><span style={{ fontWeight: 700, color: S.navy }}>Rs. {e.salary.toLocaleString()}</span></div>
                          {s.deduction > 0 && <div style={{ background: "#FEF2F2", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", marginTop: 8 }}><span style={{ fontSize: 12, color: S.red }}>Deduction</span><span style={{ fontWeight: 700, color: S.red }}>-Rs. {Math.round(s.deduction).toLocaleString()}</span></div>}
                          <div style={{ background: "#F0FDF4", borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", marginTop: 8, border: "1px solid rgba(22,163,74,0.2)" }}><span style={{ fontSize: 13, color: S.green, fontWeight: 700 }}>Final Salary</span><span style={{ fontWeight: 900, color: S.green, fontSize: 16 }}>Rs. {Math.round(s.finalSalary).toLocaleString()}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "employees" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
                {employees.map(e => {
                  const recs = allRecs.filter(r => r.user_id === e.id);
                  const late = recs.filter(r => r.in_time && isLate(r.in_time)).length;
                  const onT = recs.filter(r => r.in_time && !isLate(r.in_time)).length;
                  return (
                    <div key={e.id} style={card}>
                      <div style={{ background: `linear-gradient(135deg,${S.navy},${S.navyMid})`, padding: 28, textAlign: "center" }}>
                        <Avatar userId={e.id} fallback={e.avatar} size={64} />
                        <div style={{ color: "white", fontWeight: 800, fontSize: 16, marginTop: 12 }}>{e.name}</div>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: 2, marginTop: 4 }}>@{e.username}</div>
                        <div style={{ color: S.teal, fontSize: 13, fontWeight: 700, marginTop: 6 }}>Rs. {e.salary.toLocaleString()}/mo</div>
                      </div>
                      <div style={{ padding: 20 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                          {[["Total", recs.length, S.blueDark], ["On Time", onT, S.teal], ["Late", late, S.red]].map(([l, v, c]) => (
                            <div key={l} style={{ textAlign: "center", padding: 10, background: S.light, borderRadius: 8 }}>
                              <div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v}</div>
                              <div style={{ fontSize: 9, color: "#94A3B8", letterSpacing: 1, marginTop: 2 }}>{l}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setEditEmp(e)} style={{ flex: 1, padding: "9px 0", background: "rgba(21,101,192,0.08)", border: "1px solid rgba(21,101,192,0.2)", color: S.blue, borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>✏️ EDIT</button>
                          <button onClick={() => setDelAllConfirm(e)} style={{ flex: 1, padding: "9px 0", background: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.2)", color: S.red, borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif" }}>🗑 DELETE</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home"), [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);

  useEffect(() => { getEmployees().then(setEmployees); }, []);

  if (page === "home") return <Home onLogin={() => setPage("login")} />;
  if (page === "login") return <Login onSuccess={u => { setUser(u); setPage("dashboard"); }} onBack={() => setPage("home")} employees={employees} />;
  if (page === "dashboard") {
    if (user?.role === "admin") return <AdminDashboard onLogout={() => { setUser(null); setPage("home"); }} />;
    return <EmpDashboard emp={user} onLogout={() => { setUser(null); setPage("home"); }} />;
  }
}
