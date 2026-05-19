import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// ✅ IP RESTRICTION
const ALLOWED_OFFICE_IP = "119.73.97.135";
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
function Logo({ size = "md" }) {
  const sz = { sm: [20, 11], md: [28, 14], lg: [44, 20] }[size] || [28, 14];
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: "'Montserrat',sans-serif", userSelect: "none" }}>
      <span style={{ fontSize: sz[0], fontWeight: 900, letterSpacing: "-1px", background: "linear-gradient(135deg,#fff 30%,#26C6A0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VIBEX</span>
      <span style={{ fontSize: sz[1], fontWeight: 300, letterSpacing: "6px", color: "rgba(255,255,255,0.5)" }}>DIGITAL</span>
    </div>
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
      <div style={{ textAlign: "center", padding: 20, borderTop: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)", fontSize: 11, letterSpacing: 2 }}>© 2025 VIBEX DIGITAL</div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────
function Login({ onSuccess, onBack, ipAllowed, employees }) {
  const [user, setUser] = useState(""), [pass, setPass] = useState(""), [err, setErr] = useState(""), [loading, setLoading] = useState(false);
  function go() {
    if (!ipAllowed) { setErr("⚠️ Sirf office WiFi se login ho sakta hai."); return; }
    setLoading(true);
    setTimeout(() => {
      if (user === ADMIN.username && pass === ADMIN.password) { onSuccess(ADMIN); return; }
      const emp = employees.find(e => e.username === user && e.password === pass);
      if (emp) onSuccess({ ...emp, role: "employee" });
      else { setErr("Username ya password galat hai."); setLoading(false); }
    }, 600);
  }
  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg,${S.navy},${S.navyMid})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',sans-serif", padding: 24 }}>
      <div style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 20, padding: "48px 40px", width: "100%", maxWidth: 420, boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <Logo size="lg" />
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 14, letterSpacing: 4 }}>ATTENDANCE PORTAL</div>
        </div>
        {!ipAllowed && <div style={{ background: "rgba(229,57,53,0.1)", border: "1px solid rgba(229,57,53,0.3)", borderRadius: 10, padding: 14, marginBottom: 20, color: "#ef9a9a", fontSize: 12, textAlign: "center" }}>⚠️ Office WiFi se connected nahi hain.</div>}
        {[{ label: "USERNAME", val: user, set: setUser, type: "text" }, { label: "PASSWORD", val: pass, set: setPass, type: "password" }].map(f => (
          <div key={f.label} style={{ marginBottom: 20 }}>
            <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 8 }}>{f.label}</label>
            <input value={f.val} type={f.type} onChange={e => { f.set(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && go()} placeholder={`Enter ${f.label.toLowerCase()}`}
              style={{ width: "100%", padding: "14px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white", fontSize: 14, fontFamily: "'Montserrat',sans-serif", outline: "none", boxSizing: "border-box" }} />
          </div>
        ))}
        {err && <div style={{ color: "#ef9a9a", fontSize: 12, textAlign: "center", marginBottom: 16 }}>{err}</div>}
        <button onClick={go} disabled={loading || !ipAllowed} style={{ width: "100%", padding: 16, background: !ipAllowed ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg,${S.blue},${S.blueDark})`, color: "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, letterSpacing: 2, cursor: !ipAllowed ? "not-allowed" : "pointer", fontFamily: "'Montserrat',sans-serif" }}>
          {loading ? "LOGGING IN..." : "LOGIN →"}
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
  const [ipAllowed, setIpAllowed] = useState(false), [ipChecked, setIpChecked] = useState(false);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    getEmployees().then(setEmployees);
    if (ALLOWED_OFFICE_IP === "YOUR_OFFICE_IP_HERE") { setIpAllowed(true); setIpChecked(true); return; }
    fetch("https://api.ipify.org?format=json")
      .then(r => r.json())
      .then(d => { setIpAllowed(d.ip === ALLOWED_OFFICE_IP); setIpChecked(true); })
      .catch(() => { setIpAllowed(false); setIpChecked(true); });
  }, []);

  if (!ipChecked) return (
    <div style={{ minHeight: "100vh", background: S.navy, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Montserrat',sans-serif" }}>
      <div style={{ color: "white", fontSize: 14, letterSpacing: 4 }}>LOADING...</div>
    </div>
  );

  if (page === "home") return <Home onLogin={() => setPage("login")} />;
  if (page === "login") return <Login onSuccess={u => { setUser(u); setPage("dashboard"); }} onBack={() => setPage("home")} ipAllowed={ipAllowed} employees={employees} />;
  if (page === "dashboard") {
    if (user?.role === "admin") return <AdminDashboard onLogout={() => { setUser(null); setPage("home"); }} />;
    return <EmpDashboard emp={user} onLogout={() => { setUser(null); setPage("home"); }} />;
  }
}
