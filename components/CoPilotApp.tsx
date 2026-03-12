"use client";

import { useState, useRef, useCallback } from "react";

const GC: Record<string, string[]> = {
  "A+": ["#00ff8815","#00ff88","#00ff88"],
  "A":  ["#7fff0015","#7fff00","#7fff00"],
  "B":  ["#ffd70015","#ffd700","#ffd700"],
  "C":  ["#ff8c0015","#ff8c00","#ff8c00"],
  "NO TRADE": ["#ff000015","#ff4444","#ff4444"],
};
const VC: Record<string, string[]> = {
  "GO":       ["#00ff8815","#00ff88","#00ff88"],
  "WAIT":     ["#ffd70015","#ffd700","#ffd700"],
  "NO TRADE": ["#ff000015","#ff4444","#ff4444"],
};

type Result = {
  blocked?: boolean; msg?: string;
  ticker?: string; tf?: string; dir?: string;
  grade?: string; score?: number; verdict?: string;
  iea?: { regime: string; edge: string; signal: string };
  awa?: { block: string; vol: string; quality: string };
  wave?: { mom: string; squeeze: string };
  exec?: { score: string; grade: string; ftc: string; action: string; formation: string };
  checklist?: { item: string; met: boolean; note: string }[];
  levels?: { entry: string; stop: string; t1: string; t2: string; rr: string };
  narrative?: string;
  warnings?: string[];
};

export function CoPilotApp({ userId }: { userId: string }) {
  const [tab, setTab] = useState("upload");
  const [img, setImg] = useState<string | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fq, setFq] = useState("");
  const [fa, setFa] = useState<string | null>(null);
  const [fb, setFb] = useState(false);
  const [man, setMan] = useState({
    ticker:"", tf:"15m", dir:"LONG", regime:"TREND",
    edge:"", sig:"Long Diamond", block:"Demand", vol:"Loud",
    qual:"Untested", mom:"Bullish", sqz:"None",
    exScore:"", exGrade:"A", ftc:"", action:"Go", form:"None", notes:""
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = (f: File | null | undefined) => {
    if (!f?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      setImg(result);
      setB64(result.split(",")[1]);
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
        : { type: "manual", manualText: `TDL Manual Input — Ticker:${man.ticker||"N/A"} TF:${man.tf} Direction:${man.dir} IEA Regime:${man.regime} Edge Score:${man.edge||"N/A"} Signal:${man.sig} AWA Block:${man.block} Volume:${man.vol} Quality:${man.qual} Wave Momentum:${man.mom} Squeeze:${man.sqz} EXEC Score:${man.exScore||"N/A"} Grade:${man.exGrade} FTC:${man.ftc||"N/A"} Action:${man.action} Formation:${man.form} Notes:${man.notes||"none"}` };

      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setRes(data);
    } catch (e: unknown) {
      setErr((e instanceof Error ? e.message : null) || "Analysis failed. Please try again.");
    }
    setBusy(false);
  };

  const askFollowUp = async () => {
    if (!fq.trim() || !res) return;
    setFb(true);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUp: fq, priorResult: res }),
      });
      const data = await r.json();
      setFa(data.answer || "");
    } catch { setFa("Error. Please try again."); }
    setFb(false); setFq("");
  };

  const g = res && !res.blocked ? (GC[res.grade!] || GC["C"]) : null;
  const v = res && !res.blocked ? (VC[res.verdict!] || VC["WAIT"]) : null;
  const dc = res && !res.blocked ? (
    res.dir === "LONG" ? ["#00ff8815","#00ff88","#00ff88"] :
    res.dir === "SHORT" ? ["#ff000015","#ff4444","#ff4444"] :
    ["#ffffff08","#4a7faa","#4a7faa"]
  ) : null;

  const S = {
    page: { minHeight:"100vh", background:"#080c10", color:"#c8d4e0", fontFamily:"'IBM Plex Mono',monospace", fontSize:"13px" },
    panel: { background:"#0d1117", border:"1px solid #1a2f45", padding:12, marginBottom:8 },
    sel: { background:"#060a0f", border:"1px solid #1a2f45", color:"#c8d4e0", padding:"6px 8px", fontFamily:"monospace", fontSize:11, outline:"none", borderRadius:2, width:"100%" },
    inp: { background:"#060a0f", border:"1px solid #1a2f45", color:"#c8d4e0", padding:"6px 8px", fontFamily:"monospace", fontSize:11, outline:"none", borderRadius:2, width:"100%" },
    lbl: { color:"#2a5a7f", fontSize:9, letterSpacing:1, marginBottom:3, display:"block" as const },
    seclbl: { color:"#0ea5e9", fontSize:9, letterSpacing:2, marginBottom:10, display:"block" as const },
    row: { display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid #0a0f14", fontSize:11 },
  };

  return (
    <div style={S.page}>
      <style>{`
        *{box-sizing:border-box}
        input:focus,select:focus{border-color:#0ea5e9!important}
        .dz:hover{border-color:#0ea5e9!important}
        .tb:hover{background:#1a2f4550!important}
        .btn{transition:all .18s}
        .btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 3px 14px #0ea5e930}
        .btn:disabled{opacity:.4;cursor:not-allowed}
        .sp{animation:sp 1s linear infinite}
        @keyframes sp{to{transform:rotate(360deg)}}
        .si{animation:si .3s ease-out}
        @keyframes si{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .cr:last-child{border-bottom:none!important}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a2f45}
      `}</style>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"18px 14px 48px" }}>

        {/* HEADER */}
        <div style={{ borderBottom:"1px solid #1a2f45", paddingBottom:13, marginBottom:18, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"Georgia,serif", fontSize:22, letterSpacing:3, color:"#0ea5e9", fontWeight:"bold" }}>TDL TRADE CO-PILOT</div>
            <div style={{ color:"#2a5a7f", fontSize:10, letterSpacing:2, marginTop:2 }}>TRADING DECISIONS LAB · INSTITUTIONAL ANALYSIS ENGINE</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#00ff88", boxShadow:"0 0 6px #00ff88" }}/>
            <span style={{ color:"#2a5a7f", fontSize:9, letterSpacing:2 }}>LIVE</span>
          </div>
        </div>

        {/* TAB TOGGLE */}
        <div style={{ display:"flex", gap:2, marginBottom:13, background:"#0d1117", border:"1px solid #1a2f45", padding:3, borderRadius:2 }}>
          {(["upload","manual"] as const).map(t => (
            <button key={t} className="tb" onClick={() => { setTab(t); setRes(null); setErr(null); }}
              style={{ flex:1, padding:"8px", border:"none", background:tab===t?"#1a2f45":"transparent", color:tab===t?"#0ea5e9":"#2a5a7f", fontFamily:"monospace", fontSize:10, letterSpacing:2, cursor:"pointer", borderRadius:1, transition:"all .15s" }}>
              {t==="upload" ? "▲ CHART UPLOAD" : "≡ MANUAL INPUT"}
            </button>
          ))}
        </div>

        {/* UPLOAD ZONE */}
        {tab === "upload" && (
          <div className="dz"
            onDragOver={e=>{e.preventDefault();setDrag(true)}}
            onDragLeave={()=>setDrag(false)}
            onDrop={onDrop}
            onClick={()=>fileRef.current?.click()}
            style={{ border:`1px dashed ${drag?"#0ea5e9":"#1a2f45"}`, borderRadius:2, marginBottom:12, background:drag?"#0ea5e908":"#0d1117", cursor:"pointer", transition:"all .2s", minHeight:img?0:120, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, padding:img?6:18 }}>
            {img ? (
              <div style={{ position:"relative", width:"100%" }}>
                <img src={img} alt="" style={{ maxHeight:260, maxWidth:"100%", display:"block", margin:"0 auto", opacity:.88 }}/>
                <div style={{ position:"absolute", top:5, right:5, background:"#080c10cc", padding:"2px 7px", fontSize:9, color:"#2a5a7f", border:"1px solid #1a2f45" }}>CLICK TO CHANGE</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:24, opacity:.2 }}>⬡</div>
                <div style={{ color:"#2a5a7f", fontSize:10, letterSpacing:2 }}>DROP CHART SCREENSHOT</div>
                <div style={{ color:"#1a3a50", fontSize:9 }}>TDL INDICATORS MUST BE VISIBLE ON CHART</div>
              </>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>loadFile(e.target.files?.[0])}/>

        {/* MANUAL INPUT */}
        {tab === "manual" && (
          <div style={{ ...S.panel, marginBottom:12 }}>
            <span style={S.seclbl}>IEA v8.5</span>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
              {([["TICKER","ticker","inp","NQ/ES/AAPL"],["TIMEFRAME","tf","sel",["1m","3m","5m","15m","30m","1h","4h","D","W"]],["DIRECTION","dir","sel",["LONG","SHORT","NEUTRAL"]],["REGIME","regime","sel",["TREND","RANGE","BREAKOUT","MIXED"]],["EDGE SCORE","edge","inp","0–10+"],["IEA SIGNAL","sig","sel",["Long Diamond","Short Diamond","Continuation","None"]]] as [string,string,string,unknown][]).map(([l,k,t,o]) => (
                <div key={k as string}><span style={S.lbl}>{l as string}</span>
                  {t==="inp" ? <input style={S.inp} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})} placeholder={o as string}/> : <select style={S.sel} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})}>{(o as string[]).map(x=><option key={x}>{x}</option>)}</select>}
                </div>
              ))}
            </div>
            <span style={S.seclbl}>AWA + WAVEOSCPRO + EXEC</span>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
              {([["AWA BLOCK","block","sel",["Demand","Supply","None"]],["VOLUME","vol","sel",["Loud","High","Soft"]],["QUALITY","qual","sel",["Untested","Retested","Broken"]],["WAVE MOM","mom","sel",["Bullish","Bearish","Neutral"]],["SQUEEZE","sqz","sel",["None","Active","Released"]],["EXEC SCORE","exScore","inp","0–100+"],["FTC","ftc","inp","3/4 BULL"],["EXEC ACTION","action","sel",["Go","Wait","No Trade"]],["FORMATION","form","sel",["None","ABW","DBW","CFB","Inside Bar","2U","2D","3U","3D"]]] as [string,string,string,unknown][]).map(([l,k,t,o]) => (
                <div key={k as string}><span style={S.lbl}>{l as string}</span>
                  {t==="inp" ? <input style={S.inp} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})} placeholder={o as string}/> : <select style={S.sel} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})}>{(o as string[]).map(x=><option key={x}>{x}</option>)}</select>}
                </div>
              ))}
              <div style={{ gridColumn:"span 2" }}><span style={S.lbl}>NOTES</span><input style={S.inp} value={man.notes} onChange={e=>setMan({...man,notes:e.target.value})} placeholder="Additional context..."/></div>
            </div>
          </div>
        )}

        {/* ANALYZE BUTTON */}
        <button className="btn" onClick={analyze} disabled={busy||(tab==="upload"&&!b64)}
          style={{ width:"100%", padding:"12px", border:"1px solid #0ea5e9", background:busy?"#0d1117":"#0ea5e910", color:"#0ea5e9", fontFamily:"monospace", fontSize:11, letterSpacing:3, cursor:"pointer", borderRadius:2, marginBottom:13, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {busy ? <><div className="sp" style={{ width:12, height:12, border:"2px solid #0ea5e930", borderTop:"2px solid #0ea5e9", borderRadius:"50%" }}/>ANALYZING...</> : "◈  ANALYZE SETUP"}
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
        {res && !res.blocked && g && v && dc && (
          <div className="si">
            {/* TOP ROW */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:8 }}>
              {([[res.grade,"SETUP GRADE",g],[res.verdict,"VERDICT",v],[res.dir,"DIRECTION",dc]] as [string,string,string[]][]).map(([val,lbl,st]) => (
                <div key={lbl} style={{ background:st[0], border:`1px solid ${st[1]}`, padding:"12px", textAlign:"center" }}>
                  <div style={{ color:"#2a5a7f", fontSize:9, letterSpacing:2, marginBottom:5 }}>{lbl}</div>
                  <div style={{ color:st[2], fontFamily:"Georgia,serif", fontSize:18, fontWeight:"bold", letterSpacing:2 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* TICKER + CONFLUENCE */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <div style={S.panel}>
                <span style={S.lbl}>INSTRUMENT</span>
                <div style={{ fontFamily:"Georgia,serif", fontSize:16, letterSpacing:2, fontWeight:"bold" }}>{res.ticker} <span style={{ fontSize:11, color:"#2a5a7f", fontWeight:"normal" }}>{res.tf}</span></div>
              </div>
              <div style={S.panel}>
                <span style={S.lbl}>CONFLUENCE {res.score}/10</span>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                  <div style={{ flex:1, height:5, background:"#1a2f45", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${(res.score||0)*10}%`, height:"100%", borderRadius:3, background:(res.score||0)>=8?"#00ff88":(res.score||0)>=6?"#7fff00":(res.score||0)>=4?"#ffd700":"#ff4444" }}/>
                  </div>
                  <span style={{ fontFamily:"Georgia,serif", fontSize:14, fontWeight:"bold", minWidth:24 }}>{res.score}</span>
                </div>
              </div>
            </div>

            {/* INDICATOR PANELS */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              {[
                { t:"IEA v8.5", rows:[["REGIME",res.iea?.regime],["EDGE SCORE",res.iea?.edge],["SIGNAL",res.iea?.signal]] },
                { t:"AWA", rows:[["BLOCK",res.awa?.block],["VOLUME",res.awa?.vol],["QUALITY",res.awa?.quality]] },
                { t:"WAVEOSCPRO", rows:[["MOMENTUM",res.wave?.mom],["SQUEEZE",res.wave?.squeeze]] },
                { t:"EXEC · FTC", rows:[["SCORE/GRADE",`${res.exec?.score||"—"} ${res.exec?.grade||""}`],["FTC",res.exec?.ftc],["ACTION",res.exec?.action],["FORMATION",res.exec?.formation]] },
              ].map(({ t, rows }) => (
                <div key={t} style={S.panel}>
                  <span style={S.seclbl}>{t}</span>
                  {rows.map(([k,val]) => (
                    <div key={k} style={S.row}>
                      <span style={{ color:"#2a5a7f" }}>{k}</span>
                      <span style={{ color:val==="Loud"||val==="Go"?"#00ff88":"#c8d4e0" }}>{val||"—"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* CHECKLIST */}
            <div style={{ ...S.panel, marginBottom:8 }}>
              <span style={S.seclbl}>CONFLUENCE CHECKLIST</span>
              {res.checklist?.map((c, i) => (
                <div key={i} className="cr" style={{ display:"flex", alignItems:"flex-start", gap:7, padding:"4px 0", borderBottom:"1px solid #0a0f14" }}>
                  <div style={{ width:15, height:15, border:`1px solid ${c.met?"#00ff88":"#ff4444"}`, background:c.met?"#00ff8815":"#ff000015", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:9, color:c.met?"#00ff88":"#ff4444" }}>{c.met?"✓":"✗"}</div>
                  <div style={{ fontSize:11 }}><span style={{ color:c.met?"#c8d4e0":"#3a6a7a" }}>{c.item}</span>{c.note&&<span style={{ color:"#2a5a7f", marginLeft:6 }}>· {c.note}</span>}</div>
                </div>
              ))}
            </div>

            {/* KEY LEVELS */}
            <div style={{ ...S.panel, marginBottom:8 }}>
              <span style={S.seclbl}>KEY LEVELS</span>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
                {([["ENTRY",res.levels?.entry,"#ffd700"],["STOP",res.levels?.stop,"#ff4444"],["TARGET 1",res.levels?.t1,"#00ff88"],["TARGET 2",res.levels?.t2,"#00cc66"],["R:R",res.levels?.rr,"#0ea5e9"]] as [string,string|undefined,string][]).map(([l,val,c]) => (
                  <div key={l} style={{ background:"#060a0f", padding:"7px 4px", textAlign:"center", borderRadius:2 }}>
                    <div style={{ color:"#2a5a7f", fontSize:9, marginBottom:3 }}>{l}</div>
                    <div style={{ color:val&&val!=="null"?c:"#1a3a50", fontSize:11 }}>{val&&val!=="null"?val:"—"}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* NARRATIVE */}
            <div style={{ background:"#060d15", border:"1px solid #1a2f45", borderLeft:"2px solid #0ea5e9", padding:13, marginBottom:8 }}>
              <span style={S.seclbl}>TRADE NARRATIVE</span>
              <div style={{ color:"#c8d4e0", lineHeight:1.75, fontSize:13 }}>{res.narrative}</div>
            </div>

            {/* WARNINGS */}
            {(res.warnings?.length || 0) > 0 && (
              <div style={{ background:"#ffd70008", border:"1px solid #ffd70030", padding:11, marginBottom:8 }}>
                <span style={{ color:"#ffd700", fontSize:9, letterSpacing:2, marginBottom:6, display:"block" }}>⚠ RISK FLAGS</span>
                {res.warnings!.map((w, i) => <div key={i} style={{ color:"#b89000", fontSize:11, padding:"2px 0" }}>· {w}</div>)}
              </div>
            )}

            {/* FOLLOW-UP */}
            <div style={S.panel}>
              <span style={S.seclbl}>ASK CO-PILOT</span>
              <div style={{ display:"flex", gap:7 }}>
                <input value={fq} onChange={e=>setFq(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askFollowUp()} placeholder="Max loss on 2 contracts? What if it retraces first?..." style={{ ...S.inp, flex:1 }}/>
                <button onClick={askFollowUp} disabled={fb||!fq.trim()}
                  style={{ background:"#1a2f45", border:"1px solid #0ea5e9", color:"#0ea5e9", padding:"0 13px", fontFamily:"monospace", fontSize:10, cursor:"pointer", letterSpacing:1, opacity:fb?.4:1, whiteSpace:"nowrap" }}>
                  {fb?"...":"SEND →"}
                </button>
              </div>
              {fa && <div style={{ marginTop:9, padding:11, background:"#060a0f", borderLeft:"2px solid #0ea5e9", color:"#c8d4e0", lineHeight:1.7, fontSize:12 }}>{fa}</div>}
            </div>
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
