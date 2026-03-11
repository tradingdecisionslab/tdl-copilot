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
  options?: string[]; state: Manua
