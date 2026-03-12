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

const INDICATORS = [
  { id: "iea",   label: "IEA v8.5",             desc: "Regime, Edge Score, Diamond Signals" },
  { id: "awa",   label: "AWA",                   desc: "Demand/Supply Blocks, Volume" },
  { id: "wave",  label: "WaveOscPro",            desc: "RSI Candles, Squeeze, Momentum" },
  { id: "exec",  label: "Trade Execution Suite", desc: "EXEC Score/Grade, FTC, Action" },
  { id: "form",  label: "Formation Scanner",     desc: "STRAT Formations: ABW/DBW/CFB etc" },
  { id: "lpz",   label: "LPZ",                   desc: "Liquidity Probability Zones" },
  { id: "macro", label: "Macro Compass",         desc: "Macro Regime, Sector Flow" },
  { id: "hma",   label: "HMA Concavity Pro",     desc: "HMA Slope, Concavity Signal" },
];

type Result = {
  blocked?: boolean; msg?: string;
  ticker?: string; tf?: string; dir?: string;
  grade?: string; score?: number; verdict?: string;
  iea?: { regime: string; edge: string; signal: string } | null;
  awa?: { block: string; vol: string; quality: string } | null;
  wave?: { mom: string; squeeze: string } | null;
  exec?: { score: string; grade: string; ftc: string; action: string; formation: string } | null;
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
  const [activeInds, setActiveInds] = useState<Set<string>>(new Set(["iea","awa","wave"]));
  const [man, setMan] = useState({
    ticker:"", tf:"15m", dir:"LONG", regime:"TREND",
    edge:"", sig:"Long Diamond", block:"Demand", vol:"Loud",
    qual:"Untested", mom:"Bullish", sqz:"None",
    exScore:"", exGrade:"A", ftc:"", action:"Go", form:"None", notes:""
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleInd = (id: string) => {
    setActiveInds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

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
      const indicators = Array.from(activeInds);
      const body = tab === "upload" && b64
        ? { type: "image", imageB64: b64, indicators }
        : { type: "manual", indicators, manualText: `TDL Manual Input — Ticker:${man.ticker||"N/A"} TF:${man.tf} Direction:${man.dir} IEA Regime:${man.regime} Edge Score:${man.edge||"N/A"} Signal:${man.sig} AWA Block:${man.block} Volume:${man.vol} Quality:${man.qual} Wave Momentum:${man.mom} Squeeze:${man.sqz} EXEC Score:${man.exScore||"N/A"} Grade:${man.exGrade} FTC:${man.ftc||"N/A"} Action:${man.action} Formation:${man.form} Notes:${man.notes||"none"}` };

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
        .ind-chip:hover{border-color:#0ea5e9!important;background:#0ea5e908!important}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#1a2f45}
      `}</style>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"16px 12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, paddingBottom:10, borderBottom:"1px solid #1a2f45" }}>
          <div style={{ width:28, height:28, background:"#0ea5e915", border:"1px solid #0ea5e9", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>◈</div>
          <div>
            <div style={{ color:"#0ea5e9", fontSize:13, letterSpacing:3, fontWeight:"bold" }}>TDL TRADE CO-PILOT</div>
            <div style={{ color:"#1a4060", fontSize:9, letterSpacing:1 }}>INSTITUTIONAL SUITE · {userId.slice(0,12).toUpperCase()}</div>
          </div>
        </div>

        {/* INDICATOR SELECTOR */}
        <div style={{ ...S.panel, marginBottom:12 }}>
          <span style={S.seclbl}>ACTIVE INDICATORS ON YOUR CHART</span>
          <div style={{ color:"#1a4060", fontSize:9, marginBottom:10 }}>Check only the indicators you have applied to this chart — Co-Pilot will only score what you have active</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {INDICATORS.map(ind => {
              const active = activeInds.has(ind.id);
              return (
                <div key={ind.id} className="ind-chip" onClick={() => toggleInd(ind.id)}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", border:`1px solid ${active?"#0ea5e9":"#1a2f45"}`, background:active?"#0ea5e910":"#060a0f", cursor:"pointer", borderRadius:2, transition:"all .15s" }}>
                  <div style={{ width:13, height:13, border:`1px solid ${active?"#0ea5e9":"#2a5a7f"}`, background:active?"#0ea5e9":"transparent", borderRadius:2, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#080c10" }}>{active?"✓":""}</div>
                  <div>
                    <div style={{ color:active?"#0ea5e9":"#4a7a9a", fontSize:10, letterSpacing:1 }}>{ind.label}</div>
                    <div style={{ color:"#1a3a50", fontSize:9 }}>{ind.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {activeInds.size === 0 && <div style={{ color:"#ff6666", fontSize:10, marginTop:8, textAlign:"center" }}>⚠ Select at least one indicator</div>}
        </div>

        {/* TABS */}
        <div style={{ display:"flex", gap:4, marginBottom:10 }}>
          {[["upload","📷  CHART UPLOAD"],["manual","⌨  MANUAL INPUT"]].map(([id,lbl]) => (
            <button key={id} className="tb" onClick={()=>setTab(id)}
              style={{ flex:1, padding:"7px", border:`1px solid ${tab===id?"#0ea5e9":"#1a2f45"}`, background:tab===id?"#0ea5e910":"transparent", color:tab===id?"#0ea5e9":"#2a5a7f", fontFamily:"monospace", fontSize:9, letterSpacing:2, cursor:"pointer", borderRadius:2 }}>
              {lbl}
            </button>
          ))}
        </div>

        {tab === "upload" && (
          <div className="dz" onDrop={onDrop} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onClick={()=>fileRef.current?.click()}
            style={{ border:`1px dashed ${drag?"#0ea5e9":"#1a2f45"}`, padding:"22px", textAlign:"center", cursor:"pointer", marginBottom:10, background:drag?"#0ea5e905":"#060a0f", transition:"all .2s", borderRadius:2 }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>loadFile(e.target.files?.[0])}/>
            {img ? <img src={img} alt="chart" style={{ maxWidth:"100%", maxHeight:220, objectFit:"contain", borderRadius:2 }}/> : (
              <>
                <div style={{ fontSize:24, marginBottom:8, color:"#1a3a50" }}>📊</div>
                <div style={{ color:"#0ea5e9", fontSize:10, letterSpacing:2, marginBottom:4 }}>DROP CHART SCREENSHOT</div>
                <div style={{ color:"#1a4060", fontSize:9 }}>or click to browse · PNG / JPG</div>
              </>
            )}
          </div>
        )}

        {tab === "manual" && (
          <div style={{ ...S.panel, marginBottom:10 }}>
            <span style={S.seclbl}>MANUAL INDICATOR INPUT</span>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {([["TICKER","ticker","inp","MNQ1!"],["TIMEFRAME","tf","sel",["1m","2m","3m","5m","15m","30m","1h","4h","D","W"]],["DIRECTION","dir","sel",["LONG","SHORT","NEUTRAL"]]] as [string,string,string,unknown][]).map(([l,k,t,o])=>(
                <div key={k as string}><span style={S.lbl}>{l}</span>
                  {t==="inp"?<input style={S.inp} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})} placeholder={o as string}/>:<select style={S.sel} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})}>{(o as string[]).map(x=><option key={x}>{x}</option>)}</select>}
                </div>
              ))}
              {activeInds.has("iea") && ([["IEA REGIME","regime","sel",["TREND","RANGE","BREAKOUT","MIXED"]],["EDGE SCORE","edge","inp","0-10+"],["IEA SIGNAL","sig","sel",["Long Diamond","Short Diamond","None"]]] as [string,string,string,unknown][]).map(([l,k,t,o])=>(
                <div key={k as string}><span style={S.lbl}>{l}</span>
                  {t==="inp"?<input style={S.inp} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})} placeholder={o as string}/>:<select style={S.sel} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})}>{(o as string[]).map(x=><option key={x}>{x}</option>)}</select>}
                </div>
              ))}
              {activeInds.has("awa") && ([["AWA BLOCK","block","sel",["Demand","Supply","None"]],["VOLUME","vol","sel",["Loud","High","Soft"]],["QUALITY","qual","sel",["Untested","Retested","Broken"]]] as [string,string,string,unknown][]).map(([l,k,t,o])=>(
                <div key={k as string}><span style={S.lbl}>{l}</span>
                  {t==="inp"?<input style={S.inp} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})} placeholder={o as string}/>:<select style={S.sel} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})}>{(o as string[]).map(x=><option key={x}>{x}</option>)}</select>}
                </div>
              ))}
              {activeInds.has("wave") && ([["WAVE MOM","mom","sel",["Bullish","Bearish","Neutral"]],["SQUEEZE","sqz","sel",["None","Active","Released"]]] as [string,string,string,unknown][]).map(([l,k,t,o])=>(
                <div key={k as string}><span style={S.lbl}>{l}</span>
                  {t==="inp"?<input style={S.inp} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})} placeholder={o as string}/>:<select style={S.sel} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})}>{(o as string[]).map(x=><option key={x}>{x}</option>)}</select>}
                </div>
              ))}
              {activeInds.has("exec") && ([["EXEC SCORE","exScore","inp","80+"],["EXEC GRADE","exGrade","sel",["A+","A","B","C"]],["FTC","ftc","inp","3/4 BULL"],["EXEC ACTION","action","sel",["Go","Wait","No Trade"]]] as [string,string,string,unknown][]).map(([l,k,t,o])=>(
                <div key={k as string}><span style={S.lbl}>{l}</span>
                  {t==="inp"?<input style={S.inp} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})} placeholder={o as string}/>:<select style={S.sel} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})}>{(o as string[]).map(x=><option key={x}>{x}</option>)}</select>}
                </div>
              ))}
              {activeInds.has("form") && ([["FORMATION","form","sel",["None","ABW","DBW","CFB","Inside Bar","2U","2D","3U","3D"]]] as [string,string,string,unknown][]).map(([l,k,t,o])=>(
                <div key={k as string}><span style={S.lbl}>{l}</span>
                  <select style={S.sel} value={man[k as keyof typeof man]} onChange={e=>setMan({...man,[k as string]:e.target.value})}>{(o as string[]).map(x=><option key={x}>{x}</option>)}</select>
                </div>
              ))}
              <div style={{ gridColumn:"span 2" }}><span style={S.lbl}>NOTES</span><input style={S.inp} value={man.notes} onChange={e=>setMan({...man,notes:e.target.value})} placeholder="Additional context..."/></div>
            </div>
          </div>
        )}

        <button className="btn" onClick={analyze} disabled={busy||(tab==="upload"&&!b64)||activeInds.size===0}
          style={{ width:"100%", padding:"12px", border:"1px solid #0ea5e9", background:busy?"#0d1117":"#0ea5e910", color:"#0ea5e9", fontFamily:"monospace", fontSize:11, letterSpacing:3, cursor:"pointer", borderRadius:2, marginBottom:13, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {busy?<><div className="sp" style={{ width:12,height:12,border:"2px solid #0ea5e930",borderTop:"2px solid #0ea5e9",borderRadius:"50%" }}/>ANALYZING...</>:"◈  ANALYZE SETUP"}
        </button>

        {err && <div style={{ background:"#ff000010", border:"1px solid #ff4444", padding:10, marginBottom:12, color:"#ff6666", fontSize:11 }}>⚠ {err}</div>}

        {res?.blocked && (
          <div className="si" style={{ background:"#ff000010", border:"1px solid #ff4444", padding:20, textAlign:"center", marginBottom:12 }}>
            <div style={{ fontSize:20, marginBottom:8 }}>⛔</div>
            <div style={{ color:"#ff6666", fontSize:11, letterSpacing:2, marginBottom:8 }}>TDL INDICATORS NOT DETECTED</div>
            <div style={{ color:"#c8d4e0", lineHeight:1.6, fontSize:11, maxWidth:420, margin:"0 auto" }}>{res.msg}</div>
          </div>
        )}

        {res && !res.blocked && g && v && dc && (
          <div className="si">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:8 }}>
              {([[res.grade,"SETUP GRADE",g],[res.verdict,"VERDICT",v],[res.dir,"DIRECTION",dc]] as [string,string,string[]][]).map(([val,lbl,st])=>(
                <div key={lbl} style={{ background:st[0], border:`1px solid ${st[1]}`, padding:"12px", textAlign:"center" }}>
                  <div style={{ color:"#2a5a7f", fontSize:9, letterSpacing:2, marginBottom:5 }}>{lbl}</div>
                  <div style={{ color:st[2], fontFamily:"Georgia,serif", fontSize:18, fontWeight:"bold", letterSpacing:2 }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <div style={S.panel}><span style={S.lbl}>INSTRUMENT</span><div style={{ fontFamily:"Georgia,serif", fontSize:16, letterSpacing:2, fontWeight:"bold" }}>{res.ticker} <span style={{ fontSize:11, color:"#2a5a7f", fontWeight:"normal" }}>{res.tf}</span></div></div>
              <div style={S.panel}>
                <span style={S.lbl}>CONFLUENCE {res.score}/10</span>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                  <div style={{ flex:1, height:5, background:"#1a2f45", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(100,(res.score||0)*10)}%`, height:"100%", borderRadius:3, background:(res.score||0)>=8?"#00ff88":(res.score||0)>=6?"#7fff00":(res.score||0)>=4?"#ffd700":"#ff4444" }}/>
                  </div>
                  <span style={{ fontFamily:"Georgia,serif", fontSize:14, fontWeight:"bold", minWidth:24 }}>{res.score}</span>
                </div>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              {activeInds.has("iea") && res.iea && (
                <div style={S.panel}><span style={S.seclbl}>IEA v8.5</span>
                  {[["REGIME",res.iea.regime],["EDGE SCORE",res.iea.edge],["SIGNAL",res.iea.signal]].map(([k,val])=>(
                    <div key={k} style={S.row}><span style={{ color:"#2a5a7f" }}>{k}</span><span style={{ color:"#c8d4e0" }}>{val||"—"}</span></div>
                  ))}
                </div>
              )}
              {activeInds.has("awa") && res.awa && (
                <div style={S.panel}><span style={S.seclbl}>AWA</span>
                  {[["BLOCK",res.awa.block],["VOLUME",res.awa.vol],["QUALITY",res.awa.quality]].map(([k,val])=>(
                    <div key={k} style={S.row}><span style={{ color:"#2a5a7f" }}>{k}</span><span style={{ color:val==="Loud"?"#00ff88":"#c8d4e0" }}>{val||"—"}</span></div>
                  ))}
                </div>
              )}
              {activeInds.has("wave") && res.wave && (
                <div style={S.panel}><span style={S.seclbl}>WAVEOSCPRO</span>
                  {[["MOMENTUM",res.wave.mom],["SQUEEZE",res.wave.squeeze]].map(([k,val])=>(
                    <div key={k} style={S.row}><span style={{ color:"#2a5a7f" }}>{k}</span><span style={{ color:"#c8d4e0" }}>{val||"—"}</span></div>
                  ))}
                </div>
              )}
              {activeInds.has("exec") && res.exec && (
                <div style={S.panel}><span style={S.seclbl}>TRADE EXECUTION SUITE</span>
                  {[["SCORE/GRADE",`${res.exec.score||"—"} ${res.exec.grade||""}`],["FTC",res.exec.ftc],["ACTION",res.exec.action],["FORMATION",res.exec.formation]].map(([k,val])=>(
                    <div key={k} style={S.row}><span style={{ color:"#2a5a7f" }}>{k}</span><span style={{ color:val==="Go"?"#00ff88":"#c8d4e0" }}>{val||"—"}</span></div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...S.panel, marginBottom:8 }}>
              <span style={S.seclbl}>CONFLUENCE CHECKLIST</span>
              {res.checklist?.map((c,i)=>(
                <div key={i} className="cr" style={{ display:"flex", alignItems:"flex-start", gap:7, padding:"4px 0", borderBottom:"1px solid #0a0f14" }}>
                  <div style={{ width:15, height:15, border:`1px solid ${c.met?"#00ff88":"#ff4444"}`, background:c.met?"#00ff8815":"#ff000015", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:9, color:c.met?"#00ff88":"#ff4444" }}>{c.met?"✓":"✗"}</div>
                  <div style={{ fontSize:11 }}><span style={{ color:c.met?"#c8d4e0":"#3a6a7a" }}>{c.item}</span>{c.note&&<span style={{ color:"#2a5a7f", marginLeft:6 }}>· {c.note}</span>}</div>
                </div>
              ))}
            </div>

            <div style={{ ...S.panel, marginBottom:8 }}>
              <span style={S.seclbl}>KEY LEVELS</span>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
                {([["ENTRY",res.levels?.entry,"#ffd700"],["STOP",res.levels?.stop,"#ff4444"],["TARGET 1",res.levels?.t1,"#00ff88"],["TARGET 2",res.levels?.t2,"#00cc66"],["R:R",res.levels?.rr,"#0ea5e9"]] as [string,string|undefined,string][]).map(([l,val,c])=>(
                  <div key={l} style={{ background:"#060a0f", padding:"7px 4px", textAlign:"center", borderRadius:2 }}>
                    <div style={{ color:"#2a5a7f", fontSize:9, marginBottom:3 }}>{l}</div>
                    <div style={{ color:val&&val!=="null"?c:"#1a3a50", fontSize:11 }}>{val&&val!=="null"?val:"—"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background:"#060d15", border:"1px solid #1a2f45", borderLeft:"2px solid #0ea5e9", padding:13, marginBottom:8 }}>
              <span style={S.seclbl}>TRADE NARRATIVE</span>
              <div style={{ color:"#c8d4e0", lineHeight:1.75, fontSize:13 }}>{res.narrative}</div>
            </div>

            {(res.warnings?.length||0)>0 && (
              <div style={{ background:"#ffd70008", border:"1px solid #ffd70030", padding:11, marginBottom:8 }}>
                <span style={{ color:"#ffd700", fontSize:9, letterSpacing:2, marginBottom:6, display:"block" }}>⚠ RISK FLAGS</span>
                {res.warnings!.map((w,i)=><div key={i} style={{ color:"#b89000", fontSize:11, padding:"2px 0" }}>· {w}</div>)}
              </div>
            )}

            <div style={S.panel}>
              <span style={S.seclbl}>ASK CO-PILOT</span>
              <div style={{ display:"flex", gap:7 }}>
                <input value={fq} onChange={e=>setFq(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askFollowUp()} placeholder="What's the invalidation level? Where to add?" style={{ ...S.inp, flex:1 }}/>
                <button onClick={askFollowUp} disabled={fb||!fq.trim()} style={{ background:"#1a2f45", border:"1px solid #0ea5e9", color:"#0ea5e9", padding:"0 13px", fontFamily:"monospace", fontSize:10, cursor:"pointer", letterSpacing:1, opacity:fb?0.4:1, whiteSpace:"nowrap" }}>
                  {fb?"...":"SEND →"}
                </button>
              </div>
              {fa && <div style={{ marginTop:9, padding:11, background:"#060a0f", borderLeft:"2px solid #0ea5e9", color:"#c8d4e0", lineHeight:1.7, fontSize:12, whiteSpace:"pre-wrap" }}>{fa.replace(/\*\*(.*?)\*\*/g,"$1").replace(/##\s*/g,"").replace(/\*/g,"")}</div>}
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
