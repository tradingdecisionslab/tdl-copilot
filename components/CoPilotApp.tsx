"use client";

import { useState, useRef, useCallback } from "react";

type Result = {
  blocked?: boolean; msg?: string; ticker?: string; tf?: string;
  dir?: string; grade?: string; score?: number; verdict?: string;
  iea?: { regime: string; edge: string; signal: string };
  awa?: { block: string; vol: string; quality: string };
  wave?: { mom: string; squeeze: string };
  exec?: { score: string; grade: string; ftc: string; action: string; formation: string };
  checklist?: { item: string; met: boolean; note: string }[];
  levels?: { entry: string; stop: string; t1: string; t2: string; rr: string };
  narrative?: string; warnings?: string[];
};

type ManualState = {
  ticker: string; tf: string; dir: string; regime: string; edge: string;
  sig: string; block: string; vol: string; qual: string; mom: string;
  sqz: string; exScore: string; exGrade: string; ftc: string;
  action: string; form: string; notes: string;
};

const GRADE_COLORS: Record<string, [string, string, string]> = {
  "A+":       ["#00ff8818", "#00ff88", "#00ff88"],
  "A":        ["#7fff0018", "#7fff00", "#7fff00"],
  "B":        ["#ffd70018", "#ffd700", "#ffd700"],
  "C":        ["#ff8c0018", "#ff8c00", "#ff8c00"],
  "NO TRADE": ["#ff000018", "#ff4444", "#ff4444"],
};

const VERDICT_COLORS: Record<string, [string, string, string]> = {
  "GO":       ["#00ff8818", "#00ff88", "#00ff88"],
  "WAIT":     ["#ffd70018", "#ffd700", "#ffd700"],
  "NO TRADE": ["#ff000018", "#ff4444", "#ff4444"],
};

const dirColors = (dir?: string): [string, string, string] =>
  dir === "LONG"  ? ["#00ff8818", "#00ff88", "#00ff88"] :
  dir === "SHORT" ? ["#ff000018", "#ff4444", "#ff4444"] :
                   ["#ffffff08", "#4a7faa", "#4a7faa"];

const valColor = (val?: string) =>
  val === "Loud" || val === "Go" ? "#00ff88" : "#c8d4e0";

const INP: React.CSSProperties = {
  background: "#060a0f", border: "1px solid #1a2f45", color: "#c8d4e0",
  padding: "6px 8px", fontFamily: "monospace", fontSize: 11,
  outline: "none", borderRadius: 2, width: "100%",
};

function SL({ c }: { c: string }) {
  return <div style={{ color: "#0ea5e9", fontSize: 9, letterSpacing: 2, marginBottom: 9 }}>{c}</div>;
}

function FL({ c }: { c: string }) {
  return <div style={{ color: "#2a5a7f", fontSize: 9, letterSpacing: 1, marginBottom: 3 }}>{c}</div>;
}

function SR({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid #0a0f14", fontSize:11 }}>
      <span style={{ color:"#2a5a7f" }}>{label}</span>
      <span style={{ color:valColor(value) }}>{value || "—"}</span>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div style={{ background:"#0d1117", border:"1px solid #1a2f45", padding:12, marginBottom:8 }}>{children}</div>;
}

function Field({ label, fieldKey, type, options, state, setState }: {
  label: string; fieldKey: keyof ManualState; type: "inp" | "sel";
  options?: string[]; state: ManualState; setState: (s: ManualState) => void;
}) {
  return (
    <div>
      <FL c={label} />
      {type === "inp"
        ? <input style={INP} value={state[fieldKey]} onChange={(e) => setState({ ...state, [fieldKey]: e.target.value })} placeholder={options?.[0] ?? ""} />
        : <select style={INP} value={state[fieldKey]} onChange={(e) => setState({ ...state, [fieldKey]: e.target.value })}>
            {options!.map((o) => <option key={o}>{o}</option>)}
          </select>
      }
    </div>
  );
}

export function CoPilotApp({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"upload" | "manual">("upload");
  const [img, setImg] = useState<string | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fq, setFq] = useState("");
  const [fa, setFa] = useState<string | null>(null);
  const [fb, setFb] = useState(false);
  const [man, setMan] = useState<ManualState>({
    ticker: "", tf: "15m", dir: "LONG", regime: "TREND", edge: "",
    sig: "Long Diamond", block: "Demand", vol: "Loud", qual: "Untested",
    mom: "Bullish", sqz: "None", exScore: "", exGrade: "A",
    ftc: "", action: "Go", form: "None", notes: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = (f: File | null | undefined) => {
    if (!f?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setImg(src); setB64(src.split(",")[1]);
      setRes(null); setErr(null); setFa(null);
    };
    reader.readAsDataURL(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    loadFile(e.dataTransfer.files[0]);
  }, []);

  const analyze = async () => {
    setBusy(true); setErr(null); setRes(null); setFa(null);
    try {
      const body = tab === "upload" && b64
        ? { type: "image", imageB64: b64 }
        : { type: "manual", manualText: `TDL Manual Input:\nTicker: ${man.ticker||"N/A"} | Timeframe: ${man.tf} | Direction: ${man.dir}\nIEA: Regime=${man.regime}, Edge Score=${man.edge||"N/A"}, Signal=${man.sig}\nAWA: Block=${man.block}, Volume=${man.vol}, Quality=${man.qual}\nWaveOscPro: Momentum=${man.mom}, Squeeze=${man.sqz}\nEXEC: Score=${man.exScore||"N/A"}, Grade=${man.exGrade}, FTC=${man.ftc||"N/A"}, Action=${man.action}, Formation=${man.form}\nNotes: ${man.notes||"none"}` };
      const r = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setRes(data);
    } catch (e: any) {
      setErr(e.message || "Analysis failed. Please try again.");
    }
    setBusy(false);
  };

  const askFollowUp = async () => {
    if (!fq.trim() || !res) return;
    setFb(true);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUp: fq, priorResult: res }),
      });
      const data = await r.json();
      setFa(data.answer || "");
    } catch { setFa("Error — please try again."); }
    setFb(false); setFq("");
  };

  const gc = res && !res.blocked ? (GRADE_COLORS[res.grade!] ?? GRADE_COLORS["C"]) : null;
  const vc = res && !res.blocked ? (VERDICT_COLORS[res.verdict!] ?? VERDICT_COLORS["WAIT"]) : null;
  const dc = res && !res.blocked ? dirColors(res.dir) : null;

  return (
    <div style={{ minHeight:"100vh", background:"#080c10", color:"#c8d4e0", fontFamily:"monospace", fontSize:13 }}>
      <style>{`
        *{box-sizing:border-box}
        input:focus,select:focus{border-color:#0ea5e9!important;outline:none}
        .btn{transition:all .18s}
        .btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 3px 14px #0ea5e930}
        .btn:disabled{opacity:.4;cursor:not-allowed}
        .sp{animation:sp 1s linear infinite}
        @keyframes sp{to{transform:rotate(360deg)}}
        .si{animation:si .3s ease-out}
        @keyframes si{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#1a2f45}
      `}</style>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"18px 14px 48px" }}>

        {/* HEADER */}
        <div style={{ borderBottom:"1px solid #1a2f45", paddingBottom:13, marginBottom:18, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:22, fontWeight:"bold", letterSpacing:3, color:"#0ea5e9" }}>TDL TRADE CO-PILOT</div>
            <div style={{ color:"#2a5a7f", fontSize:10, letterSpacing:2, marginTop:2 }}>TRADING DECISIONS LAB · INSTITUTIONAL ANALYSIS ENGINE</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#00ff88", boxShadow:"0 0 6px #00ff88" }} />
            <span style={{ color:"#2a5a7f", fontSize:9, letterSpacing:2 }}>LIVE</span>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display:"flex", gap:2, marginBottom:13, background:"#0d1117", border:"1px solid #1a2f45", padding:3, borderRadius:2 }}>
          {(["upload","manual"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setRes(null); setErr(null); }}
              style={{ flex:1, padding:"8px", border:"none", borderRadius:1, transition:"all .15s", background:tab===t?"#1a2f45":"transparent", color:tab===t?"#0ea5e9":"#2a5a7f", fontFamily:"monospace", fontSize:10, letterSpacing:2, cursor:"pointer" }}>
              {t === "upload" ? "▲ CHART UPLOAD" : "≡ MANUAL INPUT"}
            </button>
          ))}
        </div>

        {/* UPLOAD */}
        {tab === "upload" && (
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop} onClick={() => fileRef.current?.click()}
            style={{ border:`1px dashed ${drag?"#0ea5e9":"#1a2f45"}`, borderRadius:2, marginBottom:12, background:drag?"#0ea5e908":"#0d1117", cursor:"pointer", transition:"all .2s", minHeight:img?0:120, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, padding:img?6:18 }}>
            {img
              ? <div style={{ position:"relative", width:"100%" }}>
                  <img src={img} alt="" style={{ maxHeight:260, maxWidth:"100%", display:"block", margin:"0 auto", opacity:.88 }} />
                  <div style={{ position:"absolute", top:5, right:5, background:"#080c10cc", padding:"2px 7px", fontSize:9, color:"#2a5a7f", border:"1px solid #1a2f45" }}>CLICK TO CHANGE</div>
                </div>
              : <>
                  <div style={{ fontSize:24, opacity:.2 }}>⬡</div>
                  <div style={{ color:"#2a5a7f", fontSize:10, letterSpacing:2 }}>DROP CHART SCREENSHOT</div>
                  <div style={{ color:"#1a3a50", fontSize:9 }}>TDL INDICATORS MUST BE VISIBLE ON CHART</div>
                </>
            }
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={(e) => loadFile(e.target.files?.[0])} />

        {/* MANUAL */}
        {tab === "manual" && (
          <Panel>
            <SL c="IEA v8.5" />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
              <Field label="TICKER" fieldKey="ticker" type="inp" options={["NQ / ES / AAPL"]} state={man} setState={setMan} />
              <Field label="TIMEFRAME" fieldKey="tf" type="sel" options={["1m","3m","5m","15m","30m","1h","4h","D","W"]} state={man} setState={setMan} />
              <Field label="DIRECTION" fieldKey="dir" type="sel" options={["LONG","SHORT","NEUTRAL"]} state={man} setState={setMan} />
              <Field label="IEA REGIME" fieldKey="regime" type="sel" options={["TREND","RANGE","BREAKOUT","MIXED"]} state={man} setState={setMan} />
              <Field label="EDGE SCORE" fieldKey="edge" type="inp" options={["0–10+"]} state={man} setState={setMan} />
              <Field label="IEA SIGNAL" fieldKey="sig" type="sel" options={["Long Diamond","Short Diamond","Continuation","None"]} state={man} setState={setMan} />
            </div>
            <SL c="AWA + WAVEOSCPRO + EXEC" />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
              <Field label="AWA BLOCK" fieldKey="block" type="sel" options={["Demand","Supply","None"]} state={man} setState={setMan} />
              <Field label="AWA VOLUME" fieldKey="vol" type="sel" options={["Loud","High","Soft"]} state={man} setState={setMan} />
              <Field label="AWA QUALITY" fieldKey="qual" type="sel" options={["Untested","Retested","Broken"]} state={man} setState={setMan} />
              <Field label="WAVE MOMENTUM" fieldKey="mom" type="sel" options={["Bullish","Bearish","Neutral"]} state={man} setState={setMan} />
              <Field label="SQUEEZE" fieldKey="sqz" type="sel" options={["None","Active","Released"]} state={man} setState={setMan} />
              <Field label="EXEC SCORE" fieldKey="exScore" type="inp" options={["0–100"]} state={man} setState={setMan} />
              <Field label="FTC" fieldKey="ftc" type="inp" options={["3/4 BULL"]} state={man} setState={setMan} />
              <Field label="EXEC ACTION" fieldKey="action" type="sel" options={["Go","Wait","No Trade"]} state={man} setState={setMan} />
              <Field label="FORMATION" fieldKey="form" type="sel" options={["None","ABW","DBW","CFB","Inside Bar","2U","2D","3U","3D"]} state={man} setState={setMan} />
              <div style={{ gridColumn:"span 3" }}>
                <FL c="NOTES" />
                <input style={INP} value={man.notes} onChange={(e) => setMan({ ...man, notes: e.target.value })} placeholder="Additional context..." />
              </div>
            </div>
          </Panel>
        )}

        {/* ANALYZE BUTTON */}
        <button className="btn" onClick={analyze} disabled={busy || (tab==="upload" && !b64)}
          style={{ width:"100%", padding:"12px", border:"1px solid #0ea5e9", background:busy?"#0d1117":"#0ea5e910", color:"#0ea5e9", fontFamily:"monospace", fontSize:11, letterSpacing:3, cursor:"pointer", borderRadius:2, marginBottom:13, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {busy
            ? <><div className="sp" style={{ width:12, height:12, border:"2px solid #0ea5e930", borderTop:"2px solid #0ea5e9", borderRadius:"50%" }} />ANALYZING...</>
            : "◈  ANALYZE SETUP"}
        </button>

        {err && <div style={{ background:"#ff000010", border:"1px solid #ff4444", padding:10, marginBottom:12, color:"#ff6666", fontSize:11 }}>⚠ {err}</div>}

        {/* BLOCKED */}
        {res?.blocked && (
          <div className="si" style={{ background:"#ff000010", border:"1px solid #ff4444", padding:20, textAlign:"center", marginBottom:12 }}>
            <div style={{ fontSize:20, marginBottom:8 }}>⛔</div>
            <div style={{ color:"#ff6666", fontSize:11, letterSpacing:2, marginBottom:8 }}>TDL INDICATORS NOT DETECTED</div>
            <div style={{ color:"#c8d4e0", lineHeight:1.6, fontSize:11, maxWidth:420, margin:"0 auto" }}>{res.msg}</div>
          </div>
        )}

        {/* RESULTS */}
        {res && !res.blocked && gc && vc && dc && (
          <div className="si">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:8 }}>
              {([
                [res.grade,   "SETUP GRADE", gc],
                [res.verdict, "VERDICT",     vc],
                [res.dir,     "DIRECTION",   dc],
              ] as [string, string, [string,string,string]][]).map(([val, lbl, st]) => (
                <div key={lbl} style={{ background:st[0], border:`1px solid ${st[1]}`, padding:"12px", textAlign:"center" }}>
                  <div style={{ color:"#2a5a7f", fontSize:9, letterSpacing:2, marginBottom:5 }}>{lbl}</div>
                  <div style={{ color:st[2], fontWeight:"bold", fontSize:18, letterSpacing:2 }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <Panel>
                <FL c="INSTRUMENT" />
                <div style={{ fontWeight:"bold", fontSize:16, letterSpacing:2 }}>{res.ticker} <span style={{ fontSize:11, color:"#2a5a7f", fontWeight:"normal" }}>{res.tf}</span></div>
              </Panel>
              <Panel>
                <FL c={`CONFLUENCE  ${res.score}/10`} />
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                  <div style={{ flex:1, height:5, background:"#1a2f45", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${(res.score??0)*10}%`, height:"100%", borderRadius:3, background:(res.score??0)>=8?"#00ff88":(res.score??0)>=6?"#7fff00":(res.score??0)>=4?"#ffd700":"#ff4444" }} />
                  </div>
                  <span style={{ fontWeight:"bold", fontSize:14, minWidth:24 }}>{res.score}</span>
                </div>
              </Panel>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <Panel><SL c="IEA v8.5" /><SR label="REGIME" value={res.iea?.regime} /><SR label="EDGE SCORE" value={res.iea?.edge} /><SR label="SIGNAL" value={res.iea?.signal} /></Panel>
              <Panel><SL c="AWA" /><SR label="BLOCK" value={res.awa?.block} /><SR label="VOLUME" value={res.awa?.vol} /><SR label="QUALITY" value={res.awa?.quality} /></Panel>
              <Panel><SL c="WAVEOSCPRO" /><SR label="MOMENTUM" value={res.wave?.mom} /><SR label="SQUEEZE" value={res.wave?.squeeze} /></Panel>
              <Panel><SL c="EXEC · FTC" /><SR label="SCORE / GRADE" value={`${res.exec?.score??""} ${res.exec?.grade??""}`} /><SR label="FTC" value={res.exec?.ftc} /><SR label="ACTION" value={res.exec?.action} /><SR label="FORMATION" value={res.exec?.formation} /></Panel>
            </div>

            <Panel>
              <SL c="CONFLUENCE CHECKLIST" />
              {res.checklist?.map((c, i) => (
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:7, padding:"4px 0", borderBottom:"1px solid #0a0f14" }}>
                  <div style={{ width:15, height:15, flexShrink:0, border:`1px solid ${c.met?"#00ff88":"#ff4444"}`, background:c.met?"#00ff8815":"#ff000015", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:c.met?"#00ff88":"#ff4444" }}>
                    {c.met?"✓":"✗"}
                  </div>
                  <div style={{ fontSize:11 }}>
                    <span style={{ color:c.met?"#c8d4e0":"#3a6a7a" }}>{c.item}</span>
                    {c.note && <span style={{ color:"#2a5a7f", marginLeft:6 }}>· {c.note}</span>}
                  </div>
                </div>
              ))}
            </Panel>

            <Panel>
              <SL c="KEY LEVELS" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
                {([["ENTRY",res.levels?.entry,"#ffd700"],["STOP",res.levels?.stop,"#ff4444"],["TARGET 1",res.levels?.t1,"#00ff88"],["TARGET 2",res.levels?.t2,"#00cc66"],["R:R",res.levels?.rr,"#0ea5e9"]] as [string,string|undefined,string][]).map(([l,val,c]) => (
                  <div key={l} style={{ background:"#060a0f", padding:"7px 4px", textAlign:"center", borderRadius:2 }}>
                    <div style={{ color:"#2a5a7f", fontSize:9, marginBottom:3 }}>{l}</div>
                    <div style={{ color:val&&val!=="null"?c:"#1a3a50", fontSize:11 }}>{val&&val!=="null"?val:"—"}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <div style={{ background:"#060d15", border:"1px solid #1a2f45", borderLeft:"2px solid #0ea5e9", padding:13, marginBottom:8 }}>
              <SL c="TRADE NARRATIVE" />
              <div style={{ color:"#c8d4e0", lineHeight:1.75, fontSize:13 }}>{res.narrative}</div>
            </div>

            {(res.warnings?.length??0)>0 && (
              <div style={{ background:"#ffd70008", border:"1px solid #ffd70030", padding:11, marginBottom:8 }}>
                <div style={{ color:"#ffd700", fontSize:9, letterSpacing:2, marginBottom:6 }}>⚠ RISK FLAGS</div>
                {res.warnings!.map((w,i) => <div key={i} style={{ color:"#b89000", fontSize:11, padding:"2px 0" }}>· {w}</div>)}
              </div>
            )}

            <Panel>
              <SL c="ASK CO-PILOT" />
              <div style={{ display:"flex", gap:7 }}>
                <input value={fq} onChange={(e) => setFq(e.target.value)} onKeyDown={(e) => e.key==="Enter"&&askFollowUp()} placeholder="Max loss on 2 contracts? What if it retraces first?..." style={{ ...INP, flex:1 }} />
                <button onClick={askFollowUp} disabled={fb||!fq.trim()} style={{ background:"#1a2f45", border:"1px solid #0ea5e9", color:"#0ea5e9", padding:"0 13px", fontFamily:"monospace", fontSize:10, cursor:"pointer", letterSpacing:1, whiteSpace:"nowrap", opacity:fb?.4:1 }}>
                  {fb?"...":"SEND →"}
                </button>
              </div>
              {fa && <div style={{ marginTop:9, padding:11, background:"#060a0f", borderLeft:"2px solid #0ea5e9", color:"#c8d4e0", lineHeight:1.7, fontSize:12 }}>{fa}</div>}
            </Panel>
          </div>
        )}

        <div style={{ borderTop:"1px solid #1a2f45", marginTop:18, paddingTop:10, color:"#1a3050", fontSize:9, letterSpacing:1, display:"flex", justifyContent:"space-between" }}>
          <span>TDL TRADE CO-PILOT · EDUCATIONAL USE ONLY</span>
          <span>TRADING DECISIONS LAB © 2026</span>
        </div>

      </div>
    </div>
  );
}
