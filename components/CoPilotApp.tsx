"use client";

import { useState, useRef, useCallback, useEffect } from "react";

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
  { id: "exec",  label: "Trade Execution Suite", desc: "EXEC Grade, FTC, Action" },
  { id: "form",  label: "Formation Scanner",     desc: "STRAT Formations: ABW/DBW/CFB etc" },
  { id: "lpz",   label: "LPZ",                   desc: "Liquidity Probability Zones" },
  { id: "delta", label: "Delta Flow Pro",         desc: "Volume Delta, Absorption, Imbalance" },
  { id: "mtf",   label: "MTF Reaction Zones",     desc: "Multi-TF Support/Resistance Zones" },
  { id: "macro", label: "Macro Compass",         desc: "Macro Regime, Sector Flow" },
  { id: "hma",   label: "HMA Concavity Pro",     desc: "HMA Slope, Concavity Signal" },
];

type Quote = { label: string; price: number | null; change: number | null };
type ConfidenceLevel = "high" | "medium" | "low";

type Result = {
  blocked?: boolean; msg?: string;
  ticker?: string; tf?: string; dir?: string;
  grade?: string; score?: number; verdict?: string;
  pattern?: string | null;
  entry_trigger?: string | null;
  invalidation?: string | null;
  technicals?: {
    candle?: string | null;
    structure?: string | null;
    key_levels?: string[];
    range_position?: string | null;
    momentum?: string | null;
  } | null;
  iea?: { regime: string; edge: string; signal: string; confidence: ConfidenceLevel } | null;
  awa?: { block: string; vol: string; quality: string; confidence: ConfidenceLevel } | null;
  wave?: { mom: string; squeeze: string; confidence: ConfidenceLevel } | null;
  exec?: { score: string; grade: string; ftc: string; action: string; formation: string; confidence: ConfidenceLevel } | null;
  delta?: { direction: string; absorption: string; imbalance: string; confidence: ConfidenceLevel } | null;
  mtf?: { zone: string; type: string; reaction: string; confidence: ConfidenceLevel } | null;
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
  const [currentPrice, setCurrentPrice] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesTs, setQuotesTs] = useState<string>("");
  const [man, setMan] = useState({
    ticker:"", tf:"15m", dir:"LONG", regime:"TREND",
    edge:"", sig:"Long Diamond", block:"Demand", vol:"Loud",
    qual:"Untested", mom:"Bullish", sqz:"None",
    exScore:"", exGrade:"A", ftc:"", action:"Go", form:"None", notes:""
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/prices")
      .then(r => r.json())
      .then(d => {
        if (d.quotes?.length) {
          setQuotes(d.quotes);
          setQuotesTs(new Date(d.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) loadFile(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const toggleInd = (id: string) => {
    setActiveInds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const loadFile = (f: File | null | undefined) => {
    if (!f?.type.startsWith("image/")) return;
    setTab("upload");
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

  const buildMarketContext = () => {
    if (!quotes.length) return undefined;
    const parts = quotes.map(q => {
      if (!q.price) return q.label + ": N/A";
      const chStr = q.change !== null ? (q.change >= 0 ? "+" : "") + q.change.toFixed(2) + "%" : "";
      return q.label + ": " + q.price.toFixed(2) + " (" + chStr + ")";
    });
    return "Live market snapshot (" + quotesTs + "): " + parts.join(", ");
  };

  // Client-side score cap: if <2 active indicators returned non-null, cap at 4
  const getDisplayScore = (r: Result): number => {
    if (!r.score) return 0;
    const activeArr = Array.from(activeInds);
    const indMap: Record<string, unknown> = { iea: r.iea, awa: r.awa, wave: r.wave, exec: r.exec, delta: r.delta, mtf: r.mtf };
    const readableCount = activeArr.filter(id => indMap[id] != null).length;
    if (readableCount < 2 && activeArr.length >= 2) return Math.min(r.score, 4);
    return r.score;
  };

  const analyze = async () => {
    setBusy(true); setErr(null); setRes(null); setFa(null);
    try {
      const indicators = Array.from(activeInds);
      const marketContext = buildMarketContext();
      const priceAnchor = currentPrice.trim() || undefined;
      const body = tab === "upload" && b64
        ? { type: "image", imageB64: b64, activeIndicators: indicators, marketContext, currentPrice: priceAnchor, tf: man.tf }
        : { type: "manual", activeIndicators: indicators, marketContext, currentPrice: priceAnchor, tf: man.tf, manualText: `TDL Manual Input — Ticker:${man.ticker||"N/A"} TF:${man.tf} Direction:${man.dir} IEA Regime:${man.regime} Edge Score:${man.edge||"N/A"} Signal:${man.sig} AWA Block:${man.block} Volume:${man.vol} Quality:${man.qual} Wave Momentum:${man.mom} Squeeze:${man.sqz} EXEC Score:${man.exScore||"N/A"} Grade:${man.exGrade} FTC:${man.ftc||"N/A"} Action:${man.action} Formation:${man.form} Notes:${man.notes||"none"}` };

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
      // Compress priorResult to save tokens
      const slim = { verdict: res.verdict, grade: res.grade, score: res.score, ticker: res.ticker, tf: res.tf, dir: res.dir, levels: res.levels, warnings: res.warnings, entry_trigger: res.entry_trigger, invalidation: res.invalidation };
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUp: fq, priorResult: slim }),
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
    zonelbl: { color:"#0ea5e9", fontSize:8, letterSpacing:3, marginBottom:8, display:"block" as const, paddingBottom:6, borderBottom:"1px solid #0ea5e920" },
    row: { display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid #0a0f14", fontSize:11 },
  };

  const confBadge = (conf?: ConfidenceLevel) => {
    if (!conf) return null;
    const col = conf === "high" ? "#00ff88" : conf === "medium" ? "#ffd700" : "#ff6666";
    return <span style={{ float:"right" as const, fontSize:8, color:col, border:`1px solid ${col}30`, padding:"1px 5px", borderRadius:2, letterSpacing:1 }}>{conf.toUpperCase()}</span>;
  };

  const scoreColor = (s: number) => s >= 8 ? "#00ff88" : s >= 6 ? "#7fff00" : s >= 4 ? "#ffd700" : "#ff4444";
  const sizeNote = (s: number, verdict: string, warnings: string[] = []) => {
    if (verdict === "WAIT") return { label: "CONDITIONAL · WAIT FOR TRIGGER", color: "#ffd700" };
    if (verdict === "NO TRADE") return { label: "NO TRADE / SIT OUT", color: "#ff4444" };
    if (s >= 8 && warnings.length === 0) return { label: "FULL SIZE", color: "#00ff88" };
    if (s >= 6) return { label: "HALF SIZE", color: "#ffd700" };
    if (s >= 4) return { label: "QUARTER SIZE · TRIGGER ONLY", color: "#ff8c00" };
    return { label: "NO TRADE / SIT OUT", color: "#ff4444" };
  };

  const hasTechnicals = (r: Result) => r.technicals && (
    r.technicals.candle || r.technicals.structure ||
    (r.technicals.key_levels?.length ?? 0) > 0 ||
    r.technicals.range_position || r.technicals.momentum
  );

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

        {/* HEADER */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, paddingBottom:10, borderBottom:"1px solid #1a2f45" }}>
          <div style={{ width:28, height:28, background:"#0ea5e915", border:"1px solid #0ea5e9", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>◈</div>
          <div>
            <div style={{ color:"#0ea5e9", fontSize:13, letterSpacing:3, fontWeight:"bold" }}>TDL TRADE CO-PILOT</div>
            <div style={{ color:"#1a4060", fontSize:9, letterSpacing:1 }}>INSTITUTIONAL SUITE · {userId.slice(0,12).toUpperCase()}</div>
          </div>
        </div>

        {/* COMPLIANCE */}
        <div style={{ background:"#0a0f14", border:"1px solid #1a2f45", borderLeft:"2px solid #ffd700", padding:"8px 12px", marginBottom:12, fontSize:9, color:"#6a7a60", lineHeight:1.6 }}>
          ⚠ <span style={{ color:"#7a8a70", letterSpacing:0.5 }}>FOR EDUCATIONAL USE ONLY. This tool does not constitute financial advice, investment recommendations, or trading signals. Past performance is not indicative of future results. Trading futures and options involves substantial risk of loss. You are solely responsible for your trading decisions. Not affiliated with or endorsed by the CFTC, NFA, or any regulatory body.</span>
        </div>

        {/* LIVE TICKER */}
        {quotes.length > 0 && (
          <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" as const }}>
            {quotes.map(q => {
              const up = (q.change ?? 0) >= 0;
              const col = q.change === null ? "#2a5a7f" : up ? "#00ff88" : "#ff4444";
              return (
                <div key={q.label} style={{ background:"#0d1117", border:"1px solid #1a2f45", padding:"5px 10px", borderRadius:2, display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ color:"#2a5a7f", fontSize:9, letterSpacing:1 }}>{q.label}</span>
                  <span style={{ color:"#c8d4e0", fontSize:11, fontWeight:"bold" }}>{q.price ? q.price.toFixed(2) : "—"}</span>
                  {q.change !== null && <span style={{ color:col, fontSize:9 }}>{up ? "▲" : "▼"} {Math.abs(q.change).toFixed(2)}%</span>}
                </div>
              );
            })}
            <div style={{ color:"#1a3a50", fontSize:9, alignSelf:"center", marginLeft:4 }}>as of {quotesTs} · included in analysis</div>
          </div>
        )}

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
          <>
            <div ref={dropRef} className="dz" onDrop={onDrop} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onClick={()=>fileRef.current?.click()}
              style={{ border:`1px dashed ${drag?"#0ea5e9":"#1a2f45"}`, padding:"22px", textAlign:"center", cursor:"pointer", marginBottom:6, background:drag?"#0ea5e905":"#060a0f", transition:"all .2s", borderRadius:2 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>loadFile(e.target.files?.[0])}/>
              {img ? <img src={img} alt="chart" style={{ maxWidth:"100%", maxHeight:220, objectFit:"contain", borderRadius:2 }}/> : (
                <>
                  <div style={{ fontSize:24, marginBottom:8, color:"#1a3a50" }}>📊</div>
                  <div style={{ color:"#0ea5e9", fontSize:10, letterSpacing:2, marginBottom:4 }}>DROP CHART SCREENSHOT</div>
                  <div style={{ color:"#1a4060", fontSize:9 }}>or click to browse · PNG / JPG</div>
                </>
              )}
            </div>
            <div style={{ color:"#1a4060", fontSize:9, textAlign:"center", marginBottom:10 }}>
              💡 <span style={{ color:"#0ea5e9" }}>Ctrl+V / Cmd+V</span> to paste directly
            </div>
          </>
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
              {activeInds.has("form") && (
                <div><span style={S.lbl}>FORMATION</span>
                  <select style={S.sel} value={man.form} onChange={e=>setMan({...man,form:e.target.value})}>
                    {["None","ABW","DBW","CFB","Inside Bar","2U","2D","3U","3D"].map(x=><option key={x}>{x}</option>)}
                  </select>
                </div>
              )}
              <div style={{ gridColumn:"span 2" }}><span style={S.lbl}>NOTES</span><input style={S.inp} value={man.notes} onChange={e=>setMan({...man,notes:e.target.value})} placeholder="Additional context..."/></div>
            </div>
          </div>
        )}

        {/* PRICE + TF */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <div>
            <span style={S.lbl}>CURRENT PRICE <span style={{ color:"#1a4060" }}>(optional)</span></span>
            <input style={S.inp} value={currentPrice} onChange={e=>setCurrentPrice(e.target.value)} placeholder="e.g. 24730.50"/>
          </div>
          {tab === "upload" && (
            <div>
              <span style={S.lbl}>CHART TIMEFRAME</span>
              <select style={S.sel} value={man.tf} onChange={e=>setMan({...man,tf:e.target.value})}>
                {["1m","2m","3m","5m","15m","30m","1h","2h","4h","D","W"].map(x=><option key={x}>{x}</option>)}
              </select>
            </div>
          )}
        </div>

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

        {res && !res.blocked && g && v && dc && (() => {
          const displayScore = getDisplayScore(res);
          const size = sizeNote(displayScore, res.verdict || 'NO TRADE', res.warnings);
          const isNoTrade = res.verdict === "NO TRADE";

          return (
            <div className="si">

              {/* ── ZONE 1: DECISION ── */}
              <div style={{ background:"#090e15", border:"1px solid #1a2f45", borderTop:"2px solid #0ea5e9", padding:"14px", marginBottom:8 }}>
                <span style={S.zonelbl}>ZONE 1 · DECISION</span>

                <div style={{ background:v[0], border:`2px solid ${v[1]}`, padding:"16px", textAlign:"center", marginBottom:10 }}>
                  <div style={{ color:"#2a5a7f", fontSize:9, letterSpacing:3, marginBottom:6 }}>VERDICT</div>
                  <div style={{ color:v[2], fontFamily:"Georgia,serif", fontSize:28, fontWeight:"bold", letterSpacing:4 }}>{res.verdict}</div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
                  {([[res.grade,"GRADE",g],[res.dir,"DIRECTION",dc],[`${res.ticker||"—"} ${res.tf||""}`.trim(),"INSTRUMENT",["#ffffff05","#2a5a7f","#4a8aaa"]]] as [string,string,string[]][]).map(([val,lbl,st])=>(
                    <div key={lbl} style={{ background:st[0], border:`1px solid ${st[1]}40`, padding:"10px", textAlign:"center" }}>
                      <div style={{ color:"#2a5a7f", fontSize:8, letterSpacing:2, marginBottom:4 }}>{lbl}</div>
                      <div style={{ color:st[2], fontFamily:"Georgia,serif", fontSize:14, fontWeight:"bold", letterSpacing:1 }}>{val}</div>
                    </div>
                  ))}
                </div>

                {res.entry_trigger && res.verdict === "WAIT" && (
                  <div style={{ background:"#ffd70008", border:"1px solid #ffd70040", borderLeft:"3px solid #ffd700", padding:"10px 14px", marginBottom:8 }}>
                    <span style={{ color:"#ffd700", fontSize:9, letterSpacing:2, display:"block", marginBottom:5 }}>⏳ ENTRY TRIGGER — WHAT FLIPS THIS TO GO</span>
                    <div style={{ color:"#e8d070", fontSize:12, lineHeight:1.7 }}>{res.entry_trigger}</div>
                  </div>
                )}

                {res.invalidation && !isNoTrade && (
                  <div style={{ background:"#ff000008", border:"1px solid #ff444430", borderLeft:"3px solid #ff4444", padding:"10px 14px" }}>
                    <span style={{ color:"#ff6666", fontSize:9, letterSpacing:2, display:"block", marginBottom:5 }}>✗ SETUP INVALIDATED IF</span>
                    <div style={{ color:"#c87070", fontSize:12, lineHeight:1.7 }}>{res.invalidation}</div>
                  </div>
                )}
              </div>

              {isNoTrade ? (
                (res.warnings?.length ?? 0) > 0 ? (
                  <div style={{ background:"#ffd70008", border:"1px solid #ffd70030", padding:11, marginBottom:8 }}>
                    <span style={{ color:"#ffd700", fontSize:9, letterSpacing:2, marginBottom:6, display:"block" }}>⚠ REASON</span>
                    {res.warnings!.map((w,i)=><div key={i} style={{ color:"#b89000", fontSize:11, padding:"2px 0" }}>· {w}</div>)}
                  </div>
                ) : null
              ) : (
                <>
                  {/* ── ZONE 2: EVIDENCE ── */}
                  <div style={{ background:"#090e15", border:"1px solid #1a2f45", padding:"14px", marginBottom:8 }}>
                    <span style={S.zonelbl}>ZONE 2 · EVIDENCE</span>

                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                      <div style={S.panel}>
                        <span style={S.lbl}>CONFLUENCE SCORE</span>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                          <div style={{ flex:1, height:6, background:"#1a2f45", borderRadius:3, overflow:"hidden" }}>
                            <div style={{ width:`${Math.min(100,displayScore*10)}%`, height:"100%", borderRadius:3, background:scoreColor(displayScore) }}/>
                          </div>
                          <span style={{ fontFamily:"Georgia,serif", fontSize:18, fontWeight:"bold", color:scoreColor(displayScore), minWidth:28 }}>{displayScore}</span>
                        </div>
                      </div>
                      <div style={{ ...S.panel, display:"flex", flexDirection:"column" as const, justifyContent:"center", alignItems:"center", textAlign:"center" }}>
                        <span style={S.lbl}>POSITION SIZE</span>
                        <span style={{ color:size.color, fontFamily:"Georgia,serif", fontSize:13, fontWeight:"bold", letterSpacing:1, marginTop:4 }}>{size.label}</span>
                      </div>
                    </div>

                    {res.pattern && (
                      <div style={{ marginBottom:10, padding:"8px 12px", background:"#ffd70008", border:"1px solid #ffd70030", borderRadius:2 }}>
                        <span style={{ color:"#2a5a7f", fontSize:9, letterSpacing:1 }}>PATTERN · </span>
                        <span style={{ color:"#ffd700", fontSize:11, letterSpacing:1 }}>◆ {res.pattern}</span>
                      </div>
                    )}

                    {/* TECHNICALS PANEL */}
                    {hasTechnicals(res) && (
                      <div style={{ ...S.panel, marginBottom:10, borderLeft:"2px solid #7b68ee" }}>
                        <span style={{ ...S.seclbl, color:"#9b88ee" }}>PRICE ACTION / TECHNICALS</span>
                        {res.technicals?.structure && (
                          <div style={S.row}>
                            <span style={{ color:"#2a5a7f" }}>STRUCTURE</span>
                            <span style={{ color: res.technicals.structure === "Uptrend" ? "#00ff88" : res.technicals.structure === "Downtrend" ? "#ff4444" : "#ffd700" }}>
                              {res.technicals.structure}
                            </span>
                          </div>
                        )}
                        {res.technicals?.range_position && (
                          <div style={S.row}>
                            <span style={{ color:"#2a5a7f" }}>RANGE POSITION</span>
                            <span style={{ color:"#c8d4e0" }}>{res.technicals.range_position}</span>
                          </div>
                        )}
                        {res.technicals?.candle && (
                          <div style={{ padding:"5px 0", borderBottom:"1px solid #0a0f14" }}>
                            <div style={{ color:"#2a5a7f", fontSize:9, marginBottom:3 }}>CANDLE CONTEXT</div>
                            <div style={{ color:"#c8d4e0", fontSize:11 }}>{res.technicals.candle}</div>
                          </div>
                        )}
                        {res.technicals?.momentum && (
                          <div style={{ padding:"5px 0", borderBottom:"1px solid #0a0f14" }}>
                            <div style={{ color:"#2a5a7f", fontSize:9, marginBottom:3 }}>MOMENTUM</div>
                            <div style={{ color:"#c8d4e0", fontSize:11 }}>{res.technicals.momentum}</div>
                          </div>
                        )}
                        {(res.technicals?.key_levels?.length ?? 0) > 0 && (
                          <div style={{ padding:"5px 0" }}>
                            <div style={{ color:"#2a5a7f", fontSize:9, marginBottom:4 }}>KEY LEVELS FROM CHART</div>
                            {res.technicals!.key_levels!.map((lvl,i) => (
                              <div key={i} style={{ color:"#a8b4c0", fontSize:10, padding:"2px 0" }}>· {lvl}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* INDICATOR PANELS */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                      {activeInds.has("iea") && res.iea && (
                        <div style={S.panel}><span style={S.seclbl}>IEA v8.5{confBadge(res.iea.confidence)}</span>
                          {[["REGIME",res.iea.regime],["EDGE SCORE",res.iea.edge],["SIGNAL",res.iea.signal]].map(([k,val])=>(
                            <div key={k} style={S.row}><span style={{ color:"#2a5a7f" }}>{k}</span><span style={{ color:"#c8d4e0" }}>{val||"—"}</span></div>
                          ))}
                        </div>
                      )}
                      {activeInds.has("awa") && res.awa && (
                        <div style={S.panel}><span style={S.seclbl}>AWA{confBadge(res.awa.confidence)}</span>
                          {[["BLOCK",res.awa.block],["VOLUME",res.awa.vol],["QUALITY",res.awa.quality]].map(([k,val])=>(
                            <div key={k} style={S.row}><span style={{ color:"#2a5a7f" }}>{k}</span><span style={{ color:val==="Loud"?"#00ff88":"#c8d4e0" }}>{val||"—"}</span></div>
                          ))}
                        </div>
                      )}
                      {activeInds.has("wave") && res.wave && (
                        <div style={S.panel}><span style={S.seclbl}>WAVEOSCPRO{confBadge(res.wave.confidence)}</span>
                          {[["MOMENTUM",res.wave.mom],["SQUEEZE",res.wave.squeeze]].map(([k,val])=>(
                            <div key={k} style={S.row}><span style={{ color:"#2a5a7f" }}>{k}</span><span style={{ color:"#c8d4e0" }}>{val||"—"}</span></div>
                          ))}
                        </div>
                      )}
                      {activeInds.has("exec") && res.exec && (
                        <div style={S.panel}><span style={S.seclbl}>EXEC SUITE{confBadge(res.exec.confidence)}</span>
                          {[["GRADE",res.exec.grade],["FTC",res.exec.ftc],["ACTION",res.exec.action],["FORMATION",res.exec.formation]].map(([k,val])=>(
                            <div key={k} style={S.row}><span style={{ color:"#2a5a7f" }}>{k}</span><span style={{ color:val==="Go"?"#00ff88":"#c8d4e0" }}>{val||"—"}</span></div>
                          ))}
                        </div>
                      )}
                      {activeInds.has("delta") && res.delta && (
                        <div style={S.panel}><span style={S.seclbl}>DELTA FLOW{confBadge(res.delta.confidence)}</span>
                          {[["DIRECTION",res.delta.direction],["ABSORPTION",res.delta.absorption],["IMBALANCE",res.delta.imbalance]].map(([k,val])=>(
                            <div key={k} style={S.row}><span style={{ color:"#2a5a7f" }}>{k}</span><span style={{ color:"#c8d4e0" }}>{val||"—"}</span></div>
                          ))}
                        </div>
                      )}
                      {activeInds.has("mtf") && res.mtf && (
                        <div style={S.panel}><span style={S.seclbl}>MTF ZONES{confBadge(res.mtf.confidence)}</span>
                          {[["ZONE",res.mtf.zone],["TYPE",res.mtf.type],["REACTION",res.mtf.reaction]].map(([k,val])=>(
                            <div key={k} style={S.row}><span style={{ color:"#2a5a7f" }}>{k}</span><span style={{ color:"#c8d4e0" }}>{val||"—"}</span></div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* CHECKLIST */}
                    <div style={S.panel}>
                      <span style={S.seclbl}>CONFLUENCE CHECKLIST</span>
                      {res.checklist?.map((c,i)=>(
                        <div key={i} className="cr" style={{ display:"flex", alignItems:"flex-start", gap:7, padding:"4px 0", borderBottom:"1px solid #0a0f14" }}>
                          <div style={{ width:15, height:15, border:`1px solid ${c.met?"#00ff88":"#ff4444"}`, background:c.met?"#00ff8815":"#ff000015", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:9, color:c.met?"#00ff88":"#ff4444" }}>{c.met?"✓":"✗"}</div>
                          <div style={{ fontSize:11 }}><span style={{ color:c.met?"#c8d4e0":"#3a6a7a" }}>{c.item}</span>{c.note&&<span style={{ color:"#2a5a7f", marginLeft:6 }}>· {c.note}</span>}</div>
                        </div>
                      ))}
                    </div>

                    {(res.warnings?.length||0)>0 && (
                      <div style={{ background:"#ffd70008", border:"1px solid #ffd70030", padding:11, marginTop:8 }}>
                        <span style={{ color:"#ffd700", fontSize:9, letterSpacing:2, marginBottom:6, display:"block" }}>⚠ RISK FLAGS</span>
                        {res.warnings!.map((w,i)=><div key={i} style={{ color:"#b89000", fontSize:11, padding:"2px 0" }}>· {w}</div>)}
                      </div>
                    )}
                  </div>

                  {/* ── ZONE 3: EXECUTION ── */}
                  <div style={{ background:"#090e15", border:"1px solid #1a2f45", padding:"14px", marginBottom:8 }}>
                    <span style={S.zonelbl}>ZONE 3 · EXECUTION</span>
                    <div style={{ color:"#1a3a50", fontSize:9, marginBottom:8 }}>⚠ Levels are approximate zones — confirm exact prices on your chart before entering</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6, marginBottom:12 }}>
                      {([["ENTRY",res.levels?.entry,"#ffd700"],["STOP",res.levels?.stop,"#ff4444"],["TARGET 1",res.levels?.t1,"#00ff88"],["TARGET 2",res.levels?.t2,"#00cc66"],["R:R",res.levels?.rr,"#0ea5e9"]] as [string,string|undefined,string][]).map(([l,val,c])=>(
                        <div key={l} style={{ background:"#060a0f", padding:"10px 4px", textAlign:"center", borderRadius:2, border:`1px solid ${val&&val!=="null"?c+"30":"#1a2f45"}` }}>
                          <div style={{ color:"#2a5a7f", fontSize:9, marginBottom:4 }}>{l}</div>
                          <div style={{ color:val&&val!=="null"?c:"#1a3a50", fontSize:11, fontWeight:"bold" }}>{val&&val!=="null"?val:"—"}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background:"#060d15", borderLeft:"2px solid #0ea5e9", padding:"12px 14px" }}>
                      <span style={{ color:"#0ea5e9", fontSize:9, letterSpacing:2, display:"block", marginBottom:8 }}>TRADE NARRATIVE</span>
                      <div style={{ color:"#c8d4e0", lineHeight:1.8, fontSize:13 }}>{res.narrative}</div>
                    </div>
                  </div>
                </>
              )}

              {/* ── ZONE 4: ASK CO-PILOT ── */}
              <div style={{ background:"#090e15", border:"1px solid #1a2f45", padding:"14px", marginBottom:8 }}>
                <span style={S.zonelbl}>ZONE 4 · ASK CO-PILOT</span>
                <div style={{ background:"#080c10", border:"1px solid #1a2f45", padding:"8px 12px", marginBottom:10, fontSize:9, color:"#3a4a35", lineHeight:1.6, textAlign:"center" }}>
                  Educational purposes only — not financial or investment advice.
                </div>
                <div style={{ display:"flex", gap:7, marginBottom:8 }}>
                  <input value={fq} onChange={e=>setFq(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askFollowUp()} placeholder="What's max loss on 2 contracts? Where would you add? What invalidates this?" style={{ ...S.inp, flex:1 }}/>
                  <button onClick={askFollowUp} disabled={fb||!fq.trim()} style={{ background:"#1a2f45", border:"1px solid #0ea5e9", color:"#0ea5e9", padding:"0 13px", fontFamily:"monospace", fontSize:10, cursor:"pointer", letterSpacing:1, opacity:fb?0.4:1, whiteSpace:"nowrap" }}>
                    {fb?"...":"SEND →"}
                  </button>
                </div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" as const, marginBottom:fa?10:0 }}>
                  {([
                    res.ticker?.toUpperCase().includes("NQ") ? "Max loss on 2 NQ contracts at this stop?" : null,
                    res.verdict === "WAIT" ? (["D","W","1W"].includes(man.tf) ? "What does this look like if trigger fires next week?" : "What does this look like if trigger fires at 3pm?") : null,
                    "What would strengthen this setup to an A+?",
                    (res.warnings?.length ?? 0) > 0 ? "How do these warnings affect position size?" : "What are the key risk factors here?",
                  ] as (string|null)[]).filter(Boolean).slice(0,3).map((q,i)=>(
                    <button key={i} onClick={()=>setFq(q!)} style={{ fontSize:9, color:"#4a6a8a", background:"#0D1220", border:"1px solid #1A2A3A", borderRadius:20, padding:"4px 10px", cursor:"pointer", fontFamily:"monospace" }}>{q}</button>
                  ))}
                </div>
                {fa && <div style={{ marginTop:9, padding:11, background:"#060a0f", borderLeft:"2px solid #0ea5e9", color:"#c8d4e0", lineHeight:1.7, fontSize:12, whiteSpace:"pre-wrap" }}>{fa}</div>}
              </div>

            </div>
          );
        })()}

        <div style={{ borderTop:"1px solid #1a2f45", marginTop:18, paddingTop:10, color:"#1a3050", fontSize:9, letterSpacing:1, display:"flex", justifyContent:"space-between" }}>
          <span>TDL TRADE CO-PILOT · EDUCATIONAL USE ONLY</span>
          <span>TRADING DECISIONS LAB © 2026</span>
        </div>
      </div>
    </div>
  );
}
