import { useState, useEffect, useRef } from "react";

// ─── Default data ─────────────────────────────────────────────────────────────
const DEFAULT_NPC_LIBRARY = [
  { id:"npc_goblin",       name:"Goblin",           maxHp:7,   ac:15, cr:"1/4" },
  { id:"npc_skeleton",     name:"Skeleton",          maxHp:13,  ac:13, cr:"1/4" },
  { id:"npc_zombie",       name:"Zombie",            maxHp:22,  ac:8,  cr:"1/4" },
  { id:"npc_orc",          name:"Orc",               maxHp:15,  ac:13, cr:"1/2" },
  { id:"npc_wolf",         name:"Wolf",              maxHp:11,  ac:13, cr:"1/4" },
  { id:"npc_bandit",       name:"Bandit",            maxHp:11,  ac:12, cr:"1/8" },
  { id:"npc_cultist",      name:"Cultist",           maxHp:9,   ac:12, cr:"1/8" },
  { id:"npc_guard",        name:"Guard",             maxHp:11,  ac:16, cr:"1/8" },
  { id:"npc_hobgoblin",    name:"Hobgoblin",         maxHp:11,  ac:18, cr:"1/2" },
  { id:"npc_bugbear",      name:"Bugbear",           maxHp:27,  ac:16, cr:"1"   },
  { id:"npc_gnoll",        name:"Gnoll",             maxHp:22,  ac:15, cr:"1/2" },
  { id:"npc_kobold",       name:"Kobold",            maxHp:5,   ac:12, cr:"1/8" },
  { id:"npc_troll",        name:"Troll",             maxHp:84,  ac:15, cr:"5"   },
  { id:"npc_ogre",         name:"Ogre",              maxHp:59,  ac:11, cr:"2"   },
  { id:"npc_banshee",      name:"Banshee",           maxHp:58,  ac:12, cr:"4"   },
  { id:"npc_vampire",      name:"Vampire",           maxHp:144, ac:16, cr:"13"  },
  { id:"npc_dragon_young", name:"Young Red Dragon",  maxHp:178, ac:18, cr:"17"  },
  { id:"npc_imp",          name:"Imp",               maxHp:10,  ac:13, cr:"1"   },
  { id:"npc_merrow",       name:"Merrow",            maxHp:45,  ac:13, cr:"2"   },
  { id:"npc_worg",         name:"Worg",              maxHp:26,  ac:13, cr:"1/2" },
];

const DEFAULT_CONDITIONS = [
  "Blinded","Charmed","Deafened","Exhaustion","Frightened",
  "Grappled","Incapacitated","Invisible","Paralyzed","Petrified",
  "Poisoned","Prone","Restrained","Stunned","Unconscious","Concentration",
];

// ─── localStorage helpers ─────────────────────────────────────────────────────
const LS_LIBRARY    = "dnd_npc_library";
const LS_CONDITIONS = "dnd_conditions";

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let UID = 1;
const uid  = () => `c_${UID++}`;
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));

// Try to pull a usable HP value from various .monster / JSON formats
function parseMonsterHp(data) {
  // Standard tracker format
  if (typeof data.maxHp === "number") return data.maxHp;
  // .monster format: hpText = "225 (18d12 + 108)" — leading number is the flat HP
  if (typeof data.hpText === "string") {
    const m = data.hpText.match(/^\d+/);
    if (m) return Number(m[0]);
  }
  // 5e-stat-block style: { hp: { average: 11 } }
  if (data.hp?.average) return Number(data.hp.average);
  if (data.hp?.value)   return Number(data.hp.value);
  // Flat number
  if (typeof data.hp === "number") return data.hp;
  // String like "2d6+4" — extract first number as fallback
  if (typeof data.hp === "string") {
    const m = data.hp.match(/\d+/);
    if (m) return Number(m[0]);
  }
  return null;
}

function parseMonsterAc(data) {
  // .monster format: otherArmorDesc = "16 (chain shirt, shield)" — leading number is AC
  if (typeof data.otherArmorDesc === "string" && data.otherArmorDesc.trim()) {
    const m = data.otherArmorDesc.match(/^\d+/);
    if (m) return m[0];
  }
  // Standard formats
  if (typeof data.ac === "number") return String(data.ac);
  if (typeof data.ac === "string") return data.ac;
  if (Array.isArray(data.ac) && data.ac[0]?.value) return String(data.ac[0].value);
  if (data.armorClass) return String(data.armorClass);
  return "—";
}

function parseMonsterCr(data) {
  // .monster format: always use "cr" field (NOT "customCr" which is unreliable)
  if (data.cr !== undefined && data.cr !== "") return String(data.cr);
  if (data.challengeRating !== undefined) return String(data.challengeRating);
  return "—";
}

function parseMonsterName(data) {
  return data.name || data.Name || "Unknown";
}

// Convert any recognised format → our NPC template object
// Returns null if data is unrecognisable
function parseNpcEntry(data) {
  if (!data || typeof data !== "object") return null;
  const hp = parseMonsterHp(data);
  if (!hp || hp < 1) return null;
  return {
    id: `npc_imported_${uid()}`,
    name: parseMonsterName(data),
    maxHp: hp,
    ac: parseMonsterAc(data),
    cr: parseMonsterCr(data),
  };
}

// ─── HP Bar ───────────────────────────────────────────────────────────────────
function HpBar({ current, max }) {
  const pct   = max > 0 ? clamp((current/max)*100, 0, 100) : 0;
  const color = pct > 60 ? "#4ade80" : pct > 30 ? "#facc15" : "#f87171";
  return (
    <div style={{background:"#0d0d1a",borderRadius:4,height:10,width:"100%",overflow:"hidden",marginTop:5}}>
      <div style={{width:`${pct}%`,height:"100%",background:color,transition:"width .4s,background .4s"}}/>
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ label, value, onChange, color="#e8d5b0" }) {
  const n = parseInt(value) || 0;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      <label style={{fontSize:11,color:"#8a7a5a",letterSpacing:1,textTransform:"uppercase"}}>{label}</label>
      <div style={{display:"flex",alignItems:"center",borderRadius:6,overflow:"hidden",border:"1px solid #3a2a2a"}}>
        <button style={{background:"#2a1a1a",color:"#e87a7a",fontSize:22,fontWeight:"bold",width:44,minHeight:44,border:"none",cursor:"pointer",flexShrink:0,fontFamily:"inherit"}}
          onClick={()=>onChange(String(Math.max(0,n-1)))}>−</button>
        <input style={{flex:1,background:"#0d0d1a",color,border:"none",textAlign:"center",fontSize:20,fontWeight:"bold",fontFamily:"'Crimson Text',Georgia,serif",minHeight:44,outline:"none",minWidth:0}}
          type="number" inputMode="numeric" value={value} onChange={e=>onChange(e.target.value)}/>
        <button style={{background:"#1a2a1a",color:"#4ade80",fontSize:22,fontWeight:"bold",width:44,minHeight:44,border:"none",cursor:"pointer",flexShrink:0,fontFamily:"inherit"}}
          onClick={()=>onChange(String(n+1))}>+</button>
      </div>
    </div>
  );
}

// ─── Toast notification ───────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2800); return()=>clearTimeout(t); },[]);
  if (!msg) return null;
  const isErr = msg.startsWith("❌");
  return (
    <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:500,
      background:isErr?"#3a0a0a":"#0a3a0a",border:`1px solid ${isErr?"#e74c3c":"#2ecc71"}`,
      color:"#e8d5b0",borderRadius:10,padding:"12px 20px",fontSize:14,
      boxShadow:"0 4px 20px rgba(0,0,0,.6)",maxWidth:"90vw",textAlign:"center",
      animation:"toastIn .25s ease"}}>
      {msg}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("combat");

  // Persisted state — loaded from localStorage on first render
  const [npcLibrary,  setNpcLibraryRaw]  = useState(() => lsGet(LS_LIBRARY,    DEFAULT_NPC_LIBRARY));
  const [conditions,  setConditionsRaw]  = useState(() => lsGet(LS_CONDITIONS, DEFAULT_CONDITIONS));

  // Wrap setters to also persist
  function setNpcLibrary(updater) {
    setNpcLibraryRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      lsSet(LS_LIBRARY, next);
      return next;
    });
  }
  function setConditions(updater) {
    setConditionsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      lsSet(LS_CONDITIONS, next);
      return next;
    });
  }

  // Non-persisted combat state
  const [combatants,    setCombatants]    = useState([]);
  const [envTurns,      setEnvTurns]      = useState([]);
  const [form,          setForm]          = useState({name:"",maxHp:"",initiative:"",type:"player"});
  const [formError,     setFormError]     = useState("");
  const [selectedNpc,   setSelectedNpc]   = useState("");
  const [npcInit,       setNpcInit]       = useState("");
  const [envForm,       setEnvForm]       = useState({name:"Lair Action",initiative:"20",description:""});
  const [addOpen,       setAddOpen]       = useState(true);
  const [combatStarted, setCombatStarted] = useState(false);
  const [currentIndex,  setCurrentIndex]  = useState(0);
  const [round,         setRound]         = useState(1);
  const [damageInput,   setDamageInput]   = useState("");
  const [healInput,     setHealInput]     = useState("");
  const [pendingConditions, setPendingConditions] = useState([]);
  const [targetPanel,   setTargetPanel]   = useState(null);
  const [quickInputs,   setQuickInputs]   = useState({});
  const [libForm,       setLibForm]       = useState({name:"",maxHp:"",ac:"",cr:""});
  const [condInput,     setCondInput]     = useState("");
  const [toast,         setToast]         = useState("");

  // Import modal state
  const [importModal,   setImportModal]   = useState(false); // "library" | "conditions" | false
  const [importText,    setImportText]    = useState("");
  const [importError,   setImportError]   = useState("");
  const importFileRef   = useRef(null);

  const showToast = msg => { setToast(msg); };

  // ── Sorted list ──────────────────────────────────────────────────────────────
  const allEntries = [
    ...combatants.map(c=>({kind:"combatant",...c})),
    ...envTurns.map(e=>({kind:"env",...e})),
  ].sort((a,b)=>b.initiative-a.initiative);

  const currentEntry = combatStarted && allEntries.length > 0
    ? allEntries[currentIndex % allEntries.length] : null;

  // ── Combat actions ────────────────────────────────────────────────────────────
  function addCombatant() {
    if (!form.name.trim()) { setFormError("Name required"); return; }
    const hp=parseInt(form.maxHp), init=parseInt(form.initiative);
    if (isNaN(hp)||hp<1) { setFormError("Valid HP required"); return; }
    if (isNaN(init))     { setFormError("Valid initiative required"); return; }
    setFormError("");
    const curInit=currentEntry?.initiative??0;
    setCombatants(p=>[...p,{id:uid(),name:form.name.trim(),maxHp:hp,currentHp:hp,
      initiative:init,type:form.type,conditions:[],
      tookTurnThisRound:combatStarted?init>=curInit:false}]);
    setForm({name:"",maxHp:"",initiative:"",type:"player"});
  }

  function addNpcFromLibrary() {
    const t=npcLibrary.find(n=>n.id===selectedNpc); if (!t) return;
    const init=parseInt(npcInit); if (isNaN(init)) return;
    const count=combatants.filter(c=>c.name.startsWith(t.name)).length;
    const curInit=currentEntry?.initiative??0;
    setCombatants(p=>[...p,{id:uid(),name:`${t.name} ${count+1}`,
      maxHp:t.maxHp,currentHp:t.maxHp,initiative:init,type:"npc",conditions:[],
      tookTurnThisRound:combatStarted?init>=curInit:false}]);
    setNpcInit(""); setSelectedNpc("");
  }

  function addEnvTurn() {
    const init=parseInt(envForm.initiative);
    if (!envForm.name.trim()||isNaN(init)) return;
    setEnvTurns(p=>[...p,{id:uid(),name:envForm.name.trim(),initiative:init,description:envForm.description.trim()}]);
    setEnvForm({name:"Lair Action",initiative:"20",description:""});
  }

  function removeEntry(id) {
    const idx=allEntries.findIndex(e=>e.id===id);
    if (combatStarted&&idx<=currentIndex&&currentIndex>0) setCurrentIndex(i=>i-1);
    setCombatants(p=>p.filter(c=>c.id!==id));
    setEnvTurns(p=>p.filter(e=>e.id!==id));
  }

  function startCombat() {
    if (allEntries.length===0) return;
    setCombatStarted(true); setCurrentIndex(0); setRound(1);
    setDamageInput(""); setHealInput(""); setPendingConditions([]);
    setCombatants(p=>p.map(c=>({...c,tookTurnThisRound:false})));
    setAddOpen(false);
  }

  function commitTurn() {
    if (!currentEntry) return;
    if (currentEntry.kind==="combatant") {
      const dmg=parseInt(damageInput)||0, heal=parseInt(healInput)||0;
      setCombatants(p=>p.map(c=>{
        if (c.id!==currentEntry.id) return c;
        const newHp=clamp(c.currentHp-dmg+heal,0,c.maxHp);
        let nc=[...c.conditions];
        pendingConditions.forEach(cond=>{ nc.includes(cond)?nc=nc.filter(x=>x!==cond):nc.push(cond); });
        return {...c,currentHp:newHp,conditions:nc,tookTurnThisRound:true};
      }));
    }
    setDamageInput(""); setHealInput(""); setPendingConditions([]);
    const total=allEntries.length, newIdx=(currentIndex+1)%total;
    if (currentIndex+1>=total) { setRound(r=>r+1); setCombatants(p=>p.map(c=>({...c,tookTurnThisRound:false}))); }
    setCurrentIndex(newIdx);
  }

  function prevTurn() {
    const total=allEntries.length;
    if (currentIndex===0) { setRound(r=>Math.max(1,r-1)); setCurrentIndex(total-1); }
    else setCurrentIndex(i=>i-1);
    setDamageInput(""); setHealInput(""); setPendingConditions([]);
  }

  function endCombat() {
    setCombatStarted(false); setCombatants([]); setEnvTurns([]);
    setCurrentIndex(0); setRound(1);
    setDamageInput(""); setHealInput(""); setPendingConditions([]);
    setTargetPanel(null); setQuickInputs({}); setAddOpen(true);
  }

  function applyHpChange(id,delta) {
    setCombatants(p=>p.map(c=>c.id===id?{...c,currentHp:clamp(c.currentHp+delta,0,c.maxHp)}:c));
  }

  function openTargetPanel(sourceId) { setTargetPanel({sourceId,targets:new Set(),amount:""}); }
  function toggleTarget(id) { setTargetPanel(p=>{ const t=new Set(p.targets); t.has(id)?t.delete(id):t.add(id); return{...p,targets:t}; }); }
  function applyTargetedDamage() {
    const dmg=parseInt(targetPanel.amount);
    if (isNaN(dmg)||dmg<=0||targetPanel.targets.size===0) return;
    setCombatants(p=>p.map(c=>targetPanel.targets.has(c.id)?{...c,currentHp:clamp(c.currentHp-dmg,0,c.maxHp)}:c));
    setTargetPanel(null);
  }
  function applyTargetedHeal() {
    const heal=parseInt(targetPanel.amount);
    if (isNaN(heal)||heal<=0||targetPanel.targets.size===0) return;
    setCombatants(p=>p.map(c=>targetPanel.targets.has(c.id)?{...c,currentHp:clamp(c.currentHp+heal,0,c.maxHp)}:c));
    setTargetPanel(null);
  }
  function togglePendingCondition(cond) {
    setPendingConditions(p=>p.includes(cond)?p.filter(c=>c!==cond):[...p,cond]);
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  function exportLibrary() {
    const blob = new Blob([JSON.stringify(npcLibrary, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dnd-npc-library.json";
    a.click();
    showToast("✅ NPC library exported!");
  }

  function exportConditions() {
    const blob = new Blob([JSON.stringify(conditions, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dnd-conditions.json";
    a.click();
    showToast("✅ Conditions exported!");
  }

  // ── Import logic ──────────────────────────────────────────────────────────────
  function openImport(type) {
    setImportModal(type);
    setImportText(""); setImportError("");
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setImportText(ev.target.result);
      setImportError("");
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function commitImport() {
    setImportError("");
    let parsed;
    try {
      parsed = JSON.parse(importText.trim());
    } catch {
      setImportError("Invalid JSON — check the file format and try again.");
      return;
    }

    if (importModal === "library") {
      // Accept: array of our format, array of .monster objects, or a single object
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const results = arr.map(parseNpcEntry).filter(Boolean);
      if (results.length === 0) {
        setImportError("No recognisable NPC entries found. Each entry needs at least a name and HP.");
        return;
      }
      // Deduplicate by name (case-insensitive) — skip if already in library
      const existingNames = new Set(npcLibrary.map(n=>n.name.toLowerCase()));
      const fresh   = results.filter(r=>!existingNames.has(r.name.toLowerCase()));
      const skipped = results.length - fresh.length;
      setNpcLibrary(p=>[...p,...fresh]);
      setImportModal(false);
      showToast(`✅ Imported ${fresh.length} NPC${fresh.length!==1?"s":""}${skipped>0?` (${skipped} skipped — already in library)`:""}`);
    }

    if (importModal === "conditions") {
      // Accept: array of strings, or object with a "conditions" array key
      let arr = Array.isArray(parsed) ? parsed : (parsed.conditions || []);
      arr = arr.filter(c=>typeof c==="string"&&c.trim());
      if (arr.length===0) {
        setImportError("No conditions found. Expected a JSON array of strings e.g. [\"Blinded\",\"Prone\"]");
        return;
      }
      const existingSet = new Set(conditions.map(c=>c.toLowerCase()));
      const fresh   = arr.filter(c=>!existingSet.has(c.toLowerCase().trim())).map(c=>c.trim());
      const skipped = arr.length - fresh.length;
      setConditions(p=>[...p,...fresh]);
      setImportModal(false);
      showToast(`✅ Imported ${fresh.length} condition${fresh.length!==1?"s":""}${skipped>0?` (${skipped} skipped — duplicates)`:""}`);
    }
  }

  function resetLibraryToDefaults() {
    if (!window.confirm("Reset NPC library to defaults? Your custom NPCs will be removed.")) return;
    setNpcLibrary(DEFAULT_NPC_LIBRARY);
    showToast("✅ Library reset to defaults");
  }

  function resetConditionsToDefaults() {
    if (!window.confirm("Reset conditions to defaults?")) return;
    setConditions(DEFAULT_CONDITIONS);
    showToast("✅ Conditions reset to defaults");
  }

  // ── Design tokens ─────────────────────────────────────────────────────────────
  const C = {
    bg:"#0d0d1a", bgCard:"rgba(255,255,255,.03)", bgActive:"rgba(139,26,26,.18)",
    bgEnv:"rgba(20,20,70,.4)", bgEnvActive:"rgba(80,80,200,.2)", bgDead:"rgba(0,0,0,.4)",
    border:"rgba(232,200,122,.15)", borderActive:"#e8c87a", borderEnv:"#4a4a9a", borderEnvActive:"#9090ff",
    gold:"#e8c87a", red:"#8b1a1a", redBright:"#e87a7a", green:"#4ade80", blue:"#6a6ae0",
    text:"#e8d5b0", textMid:"#a09070", textDim:"#8a7a5a", textDead:"#5a4a4a",
  };

  const inputStyle = (extra={}) => ({
    background:"#0d0d1a",border:"1px solid #3a2a2a",borderRadius:6,color:C.text,
    padding:"12px 14px",fontSize:16,fontFamily:"'Crimson Text',Georgia,serif",outline:"none",
    width:"100%",boxSizing:"border-box",minHeight:48,WebkitAppearance:"none",...extra,
  });
  const selectStyle = () => ({
    ...inputStyle(),appearance:"none",WebkitAppearance:"none",
    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%238a7a5a' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
    backgroundRepeat:"no-repeat",backgroundPosition:"right 14px center",paddingRight:36,
  });
  const btnStyle = (v="primary",extra={}) => ({
    background:v==="primary"?"#8b1a1a":v==="success"?"#1a5a1a":v==="danger"?"#5a1a1a":v==="blue"?"#1a1a6a":v==="ghost"?"transparent":"#2a2a3a",
    color:C.text,
    border:`1px solid ${v==="primary"?"#c0392b":v==="success"?"#2ecc71":v==="danger"?"#e74c3c":v==="blue"?"#6a6ae0":v==="ghost"?"#3a2a2a":"#4a4a6a"}`,
    borderRadius:8,padding:"13px 16px",cursor:"pointer",fontSize:15,
    fontFamily:"'Crimson Text',Georgia,serif",letterSpacing:.5,transition:"all .15s",
    minHeight:48,display:"flex",alignItems:"center",justifyContent:"center",
    gap:6,whiteSpace:"nowrap",userSelect:"none",WebkitTapHighlightColor:"transparent",...extra,
  });
  const labelStyle      = {fontSize:12,color:C.textDim,letterSpacing:1,textTransform:"uppercase",marginBottom:5,display:"block"};
  const cardStyle       = (extra={}) => ({background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:10,...extra});
  const sectionTitleStyle = {fontSize:12,color:C.gold,letterSpacing:2,textTransform:"uppercase",marginBottom:10,borderBottom:`1px solid rgba(232,200,122,.2)`,paddingBottom:6};

  // ── Import Modal ──────────────────────────────────────────────────────────────
  function ImportModal() {
    const isLib = importModal === "library";
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
        onClick={e=>{ if(e.target===e.currentTarget) setImportModal(false); }}>
        <div style={{background:"#100a14",border:`2px solid ${C.gold}`,borderRadius:"16px 16px 0 0",padding:"20px 16px 40px",width:"100%",maxWidth:600,maxHeight:"90vh",overflowY:"auto"}}>
          <div style={{width:40,height:4,background:"#3a2a2a",borderRadius:2,margin:"0 auto 16px"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{color:C.gold,fontSize:17,fontFamily:"'Cinzel',Georgia,serif",letterSpacing:1}}>
              📥 Import {isLib ? "NPCs" : "Conditions"}
            </div>
            <button style={btnStyle("ghost",{minHeight:44,padding:"0 14px",borderColor:"#5a1a1a"})}
              onClick={()=>setImportModal(false)}>✕</button>
          </div>

          <div style={{fontSize:13,color:C.textDim,marginBottom:14,lineHeight:1.7,background:"rgba(0,0,0,.3)",padding:12,borderRadius:8}}>
            {isLib ? (
              <>
                <strong style={{color:C.gold}}>Accepted formats:</strong><br/>
                • Our own exported <code style={{color:"#a0d0ff"}}>.json</code> library file<br/>
                • <code style={{color:"#a0d0ff"}}>.monster</code> / <code style={{color:"#a0d0ff"}}>.json</code> stat block files — single monsters or arrays<br/>
                • Any JSON with <code style={{color:"#a0d0ff"}}>name</code> + <code style={{color:"#a0d0ff"}}>hp</code> fields (supports <code style={{color:"#a0d0ff"}}>hp.average</code>, <code style={{color:"#a0d0ff"}}>hp.value</code>, or a plain number)<br/>
                • Duplicate names are skipped automatically
              </>
            ) : (
              <>
                <strong style={{color:C.gold}}>Accepted formats:</strong><br/>
                • A JSON array of strings: <code style={{color:"#a0d0ff"}}>["Blinded", "Hexed"]</code><br/>
                • An object with a <code style={{color:"#a0d0ff"}}>"conditions"</code> key containing an array<br/>
                • Duplicates are skipped automatically
              </>
            )}
          </div>

          {/* File picker */}
          <input ref={importFileRef} type="file"
            accept=".json,.monster,.txt" style={{display:"none"}}
            onChange={handleImportFile}/>
          <button style={btnStyle("blue",{width:"100%",marginBottom:10,fontSize:15})}
            onClick={()=>importFileRef.current?.click()}>
            📂 Choose File (.json / .monster)
          </button>

          {/* Or paste */}
          <div style={{...labelStyle,marginBottom:6}}>— or paste JSON directly —</div>
          <textarea
            style={{...inputStyle({minHeight:140,resize:"vertical",padding:12,fontSize:13,fontFamily:"monospace",lineHeight:1.5}),whiteSpace:"pre"}}
            placeholder={isLib
              ? '[{"name":"Goblin","maxHp":7,"ac":15,"cr":"1/4"}, ...]'
              : '["Blinded","Prone","Hexed"]'}
            value={importText}
            onChange={e=>{setImportText(e.target.value);setImportError("");}}
          />

          {importError&&(
            <div style={{color:C.redBright,fontSize:13,marginTop:8,padding:"8px 12px",background:"rgba(200,0,0,.1)",borderRadius:6,border:"1px solid #5a1a1a"}}>
              ⚠ {importError}
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
            <button style={btnStyle("ghost",{minHeight:52})} onClick={()=>setImportModal(false)}>Cancel</button>
            <button style={btnStyle("success",{minHeight:52,fontSize:16})}
              onClick={commitImport} disabled={!importText.trim()}>
              ✅ Import
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Sub-components ────────────────────────────────────────────────────────────
  function EnvCard({entry,isActive}) {
    const cs = isActive
      ? {background:C.bgEnvActive,border:`2px solid ${C.borderEnvActive}`,borderRadius:10,padding:14,marginBottom:10,boxShadow:"0 0 24px rgba(150,150,255,.2)"}
      : {background:C.bgEnv,border:`1px solid ${C.borderEnv}`,borderRadius:10,padding:14,marginBottom:10};
    return (
      <div style={cs}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:22,fontWeight:"bold",color:"#9090ff",minWidth:36,textAlign:"center"}}>{entry.initiative}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:isActive?18:16,fontWeight:isActive?"bold":"normal",color:isActive?"#c0c0ff":"#9090d0"}}>🌀 {entry.name}</span>
              {isActive&&<span style={{fontSize:11,color:"#9090ff",letterSpacing:1,animation:"pulse 1s infinite"}}>◀ ACTIVE</span>}
            </div>
            {entry.description&&<div style={{fontSize:13,color:"#7070a0",fontStyle:"italic",marginTop:3}}>{entry.description}</div>}
          </div>
          <button style={{...btnStyle("ghost",{minHeight:44,padding:"0 14px",borderColor:"#5a2a2a",color:C.redBright})}} onClick={()=>removeEntry(entry.id)}>✕</button>
        </div>
        {isActive&&<div style={{marginTop:12,borderTop:"1px solid rgba(144,144,255,.2)",paddingTop:12,fontSize:14,color:"#9090c0",lineHeight:1.5}}>Resolve this environment / lair action, then tap <strong style={{color:C.gold}}>Confirm Turn & Next →</strong></div>}
      </div>
    );
  }

  function CombatantCard({c,isActive}) {
    const isDead=c.currentHp<=0;
    const cs = isDead
      ? {background:C.bgDead,border:"1px solid #2a2a2a",borderRadius:10,padding:14,marginBottom:10,opacity:.45}
      : isActive
        ? {background:C.bgActive,border:`2px solid ${C.borderActive}`,borderRadius:10,padding:14,marginBottom:10,boxShadow:"0 0 24px rgba(232,200,122,.18)"}
        : cardStyle();
    const qi=quickInputs[c.id]||"";
    return (
      <div style={cs}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:isActive?14:6}}>
          <div style={{background:isActive?"#8b1a1a":"#1a1218",border:`1px solid ${isActive?C.gold:"#3a2a2a"}`,borderRadius:8,minWidth:42,height:42,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:18,fontWeight:"bold",color:C.gold}}>{c.initiative}</span>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:2}}>
              <span style={{fontSize:isActive?19:16,fontWeight:"bold",color:isActive?"#fff":C.text,wordBreak:"break-word"}}>{c.name}</span>
              <span style={{fontSize:10,padding:"2px 6px",borderRadius:3,background:c.type==="player"?"rgba(26,74,26,.5)":"rgba(74,26,26,.5)",border:`1px solid ${c.type==="player"?"#2ecc71":"#e74c3c"}`,color:c.type==="player"?"#2ecc71":"#e87a7a",letterSpacing:1,textTransform:"uppercase"}}>{c.type==="player"?"PC":"NPC"}</span>
              {isDead&&<span style={{fontSize:11,color:C.redBright,letterSpacing:1,fontWeight:"bold"}}>☠ DOWN</span>}
              {isActive&&<span style={{fontSize:11,color:C.gold,letterSpacing:1,animation:"pulse 1s infinite"}}>◀ ACTIVE</span>}
            </div>
            <div style={{fontSize:14,color:isDead?C.textDead:C.textMid}}>HP: <strong style={{fontSize:17,color:isDead?C.redBright:C.text}}>{c.currentHp}</strong><span style={{color:C.textDim}}> / {c.maxHp}</span></div>
            <HpBar current={c.currentHp} max={c.maxHp}/>
          </div>
        </div>

        {c.conditions.length>0&&(
          <div style={{marginBottom:isActive?10:4,display:"flex",flexWrap:"wrap",gap:4}}>
            {c.conditions.map(cond=><span key={cond} style={{padding:"3px 10px",borderRadius:12,fontSize:12,background:"#8b1a1a",border:"1px solid #c0392b",color:"#fff"}}>{cond}</span>)}
          </div>
        )}

        {!isActive&&(
          <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6}}>
            <input style={{...inputStyle({minHeight:44,padding:"8px 10px",fontSize:15,flex:1,minWidth:0,textAlign:"center"}),maxWidth:90}}
              type="number" inputMode="numeric" placeholder="HP"
              value={qi} onChange={e=>setQuickInputs(q=>({...q,[c.id]:e.target.value}))}/>
            <button style={btnStyle("danger",{minHeight:44,padding:"0 12px",fontSize:15,flex:1})}
              onClick={()=>{const v=parseInt(qi)||0;applyHpChange(c.id,-Math.abs(v));setQuickInputs(q=>({...q,[c.id]:""}));}}>💥 Dmg</button>
            <button style={btnStyle("success",{minHeight:44,padding:"0 12px",fontSize:15,flex:1})}
              onClick={()=>{const v=parseInt(qi)||0;applyHpChange(c.id,Math.abs(v));setQuickInputs(q=>({...q,[c.id]:""}));}}>✚ Heal</button>
            <button style={btnStyle("blue",{minHeight:44,padding:"0 12px",fontSize:18})} onClick={()=>openTargetPanel(c.id)}>🎯</button>
            <button style={btnStyle("ghost",{minHeight:44,padding:"0 12px",fontSize:16,borderColor:"#4a1a1a",color:C.redBright})} onClick={()=>removeEntry(c.id)}>✕</button>
          </div>
        )}

        {isActive&&(
          <div style={{borderTop:"1px solid rgba(232,200,122,.2)",paddingTop:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <Stepper label="💥 Damage (self)" value={damageInput} onChange={setDamageInput} color={C.redBright}/>
              <Stepper label="✚ Heal (self)"   value={healInput}   onChange={setHealInput}   color={C.green}/>
            </div>
            <button style={btnStyle("blue",{width:"100%",marginBottom:14,fontSize:16})} onClick={()=>openTargetPanel(c.id)}>
              🎯 Deal Damage / Heal to Other Targets
            </button>
            <div style={sectionTitleStyle}>Conditions — tap to stage</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {conditions.map(cond=>{
                const has=c.conditions.includes(cond), pending=pendingConditions.includes(cond), willHave=pending?!has:has;
                return (
                  <button key={cond}
                    style={{padding:"8px 13px",borderRadius:20,fontSize:13,border:`1px solid ${willHave?"#c0392b":pending?C.gold:"#3a2a2a"}`,
                      background:willHave?"#8b1a1a":"rgba(255,255,255,.04)",color:willHave?"#fff":pending?C.gold:C.textDim,
                      cursor:"pointer",outline:pending?"1px dashed #e8c87a":"none",
                      fontFamily:"'Crimson Text',Georgia,serif",minHeight:40,userSelect:"none",WebkitTapHighlightColor:"transparent"}}
                    onClick={()=>togglePendingCondition(cond)}>
                    {cond}{pending&&<span style={{fontSize:10,marginLeft:4}}>{willHave?"+":"−"}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function TargetPanel() {
    const source=combatants.find(c=>c.id===targetPanel.sourceId);
    const others=combatants.filter(c=>c.id!==targetPanel.sourceId);
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
        onClick={e=>{if(e.target===e.currentTarget)setTargetPanel(null);}}>
        <div style={{background:"#100a14",border:`2px solid ${C.gold}`,borderRadius:"16px 16px 0 0",padding:"20px 16px",width:"100%",maxWidth:600,maxHeight:"90vh",overflowY:"auto",paddingBottom:40}}>
          <div style={{width:40,height:4,background:"#3a2a2a",borderRadius:2,margin:"0 auto 16px"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{color:C.gold,fontSize:17,fontFamily:"'Cinzel',Georgia,serif",letterSpacing:1}}>
              🎯 Target Attack{source?` — ${source.name}`:""}
            </div>
            <button style={btnStyle("ghost",{minHeight:44,padding:"0 14px",borderColor:"#5a1a1a",color:C.redBright})} onClick={()=>setTargetPanel(null)}>✕</button>
          </div>
          <div style={{marginBottom:16}}>
            <Stepper label="Damage / Heal Amount" value={targetPanel.amount}
              onChange={v=>setTargetPanel(p=>({...p,amount:v}))} color={C.text}/>
          </div>
          <div style={sectionTitleStyle}>Select Targets</div>
          {others.length===0&&<p style={{color:C.textDim,fontSize:14}}>No other combatants to target.</p>}
          {others.map(c=>{
            const sel=targetPanel.targets.has(c.id), isDead=c.currentHp<=0;
            return (
              <div key={c.id}
                style={{borderRadius:10,padding:"12px 14px",marginBottom:8,cursor:"pointer",
                  background:sel?"rgba(232,200,122,.1)":"rgba(0,0,0,.3)",
                  border:sel?`2px solid ${C.gold}`:"1px solid #3a2a2a",transition:"all .15s",
                  userSelect:"none",WebkitTapHighlightColor:"transparent"}}
                onClick={()=>toggleTarget(c.id)}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22,color:sel?C.gold:"#4a3a2a",flexShrink:0}}>{sel?"☑":"☐"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:"bold",fontSize:16,color:isDead?C.textDead:C.text}}>{c.name}</div>
                    <div style={{fontSize:13,color:C.textMid}}>{c.currentHp}/{c.maxHp} HP {isDead&&"☠"}</div>
                  </div>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:3,background:c.type==="player"?"rgba(26,74,26,.5)":"rgba(74,26,26,.5)",border:`1px solid ${c.type==="player"?"#2ecc71":"#e74c3c"}`,color:c.type==="player"?"#2ecc71":"#e87a7a",textTransform:"uppercase",letterSpacing:1,flexShrink:0}}>{c.type==="player"?"PC":"NPC"}</span>
                </div>
                {sel&&<div style={{marginTop:6}}><HpBar current={c.currentHp} max={c.maxHp}/></div>}
              </div>
            );
          })}
          <div style={{textAlign:"center",fontSize:13,color:C.textDim,margin:"10px 0"}}>
            {targetPanel.targets.size} target{targetPanel.targets.size!==1?"s":""} selected
            {targetPanel.amount&&<> · <strong style={{color:C.text}}>{targetPanel.amount}</strong> each</>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,position:"sticky",bottom:0,paddingTop:10,background:"#100a14"}}>
            <button style={btnStyle("danger",{fontSize:16,minHeight:54})} onClick={applyTargetedDamage}
              disabled={targetPanel.targets.size===0||!targetPanel.amount}>💥 Deal Damage</button>
            <button style={btnStyle("success",{fontSize:16,minHeight:54})} onClick={applyTargetedHeal}
              disabled={targetPanel.targets.size===0||!targetPanel.amount}>✚ Apply Heal</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Combat Tab ────────────────────────────────────────────────────────────────
  function CombatTab() {
    return (
      <div>
        <div style={cardStyle()}>
          <button style={btnStyle("ghost",{width:"100%",background:"transparent",border:"none",padding:"4px 0",fontSize:14,color:C.gold,justifyContent:"space-between"})}
            onClick={()=>setAddOpen(o=>!o)}>
            <span style={{fontFamily:"'Cinzel',Georgia,serif",letterSpacing:1}}>{addOpen?"▼":"▶"} Add Combatants</span>
            <span style={{fontSize:12,color:C.textDim}}>{allEntries.length} entries</span>
          </button>

          {addOpen&&(
            <div style={{marginTop:12}}>
              <div style={sectionTitleStyle}>⚔ Custom Combatant</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <div style={{gridColumn:"1/-1"}}><label style={labelStyle}>Name</label>
                  <input style={inputStyle()} value={form.name} placeholder="Character name"
                    onChange={e=>setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addCombatant()}/></div>
                <div><label style={labelStyle}>Max HP</label>
                  <input style={inputStyle()} type="number" inputMode="numeric" value={form.maxHp} placeholder="HP"
                    onChange={e=>setForm(f=>({...f,maxHp:e.target.value}))}/></div>
                <div><label style={labelStyle}>Initiative</label>
                  <input style={inputStyle()} type="number" inputMode="numeric" value={form.initiative} placeholder="Roll"
                    onChange={e=>setForm(f=>({...f,initiative:e.target.value}))}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={labelStyle}>Type</label>
                  <select style={selectStyle()} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    <option value="player">Player Character</option>
                    <option value="npc">NPC / DM Character</option>
                  </select></div>
              </div>
              {formError&&<div style={{color:C.redBright,fontSize:13,marginBottom:8}}>{formError}</div>}
              <button style={btnStyle("primary",{width:"100%",fontSize:16,marginBottom:16})} onClick={addCombatant}>+ Add Combatant</button>

              <div style={{borderTop:"1px solid rgba(232,200,122,.1)",paddingTop:14,marginBottom:14}}>
                <div style={{...sectionTitleStyle,color:"#c0a060"}}>📖 Add from NPC Library</div>
                <div style={{display:"grid",gap:10}}>
                  <div><label style={labelStyle}>NPC Template</label>
                    <select style={selectStyle()} value={selectedNpc} onChange={e=>setSelectedNpc(e.target.value)}>
                      <option value="">Select NPC...</option>
                      {npcLibrary.map(n=><option key={n.id} value={n.id}>{n.name} — HP:{n.maxHp} AC:{n.ac} CR:{n.cr}</option>)}
                    </select></div>
                  <div><label style={labelStyle}>Initiative Roll</label>
                    <input style={inputStyle()} type="number" inputMode="numeric" value={npcInit} placeholder="Roll"
                      onChange={e=>setNpcInit(e.target.value)}/></div>
                  <button style={btnStyle("primary",{width:"100%",fontSize:16})} onClick={addNpcFromLibrary} disabled={!selectedNpc||!npcInit}>
                    + Add NPC</button>
                </div>
              </div>

              <div style={{borderTop:"1px solid rgba(100,100,220,.25)",paddingTop:14}}>
                <div style={{...sectionTitleStyle,color:"#9090e0"}}>🌀 Environment / Lair Action</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div style={{gridColumn:"1/-1"}}><label style={labelStyle}>Name</label>
                    <input style={{...inputStyle(),borderColor:"#3a3a7a"}} value={envForm.name} placeholder="Lair Action"
                      onChange={e=>setEnvForm(f=>({...f,name:e.target.value}))}/></div>
                  <div><label style={labelStyle}>Initiative</label>
                    <input style={{...inputStyle(),borderColor:"#3a3a7a"}} type="number" inputMode="numeric"
                      value={envForm.initiative} placeholder="e.g. 20" onChange={e=>setEnvForm(f=>({...f,initiative:e.target.value}))}/></div>
                  <div><label style={labelStyle}>Note (optional)</label>
                    <input style={{...inputStyle(),borderColor:"#3a3a7a"}} value={envForm.description} placeholder="What happens?"
                      onChange={e=>setEnvForm(f=>({...f,description:e.target.value}))}/></div>
                </div>
                <button style={btnStyle("blue",{width:"100%",fontSize:16})} onClick={addEnvTurn}>+ Add Environment Turn</button>
              </div>
            </div>
          )}
        </div>

        {!combatStarted ? (
          <div style={{display:"grid",gridTemplateColumns:allEntries.length>0?"3fr 1fr":"1fr",gap:8,marginBottom:12}}>
            <button style={btnStyle("success",{fontSize:17,minHeight:56})} onClick={startCombat} disabled={allEntries.length===0}>
              ⚡ Start Combat ({allEntries.length})</button>
            {allEntries.length>0&&<button style={btnStyle("danger",{fontSize:17,minHeight:56})} onClick={()=>{setCombatants([]);setEnvTurns([]);}}>Clear</button>}
          </div>
        ) : (
          <div style={{position:"sticky",top:0,zIndex:50,background:"#0d0d1a",paddingBottom:8,paddingTop:4}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 2fr 1fr",gap:6,marginBottom:4}}>
              <button style={btnStyle("",{minHeight:52,fontSize:15})} onClick={prevTurn}>← Prev</button>
              <button style={btnStyle("primary",{minHeight:52,fontSize:15})} onClick={commitTurn}>✓ Confirm & Next →</button>
              <button style={btnStyle("danger",{minHeight:52,fontSize:14})} onClick={endCombat}>End</button>
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:12,fontSize:13,color:C.textMid}}>
              <span style={{background:"#8b1a1a",color:C.text,padding:"3px 12px",borderRadius:12,fontSize:12}}>Round {round}</span>
              <span>Turn {currentIndex+1} / {allEntries.length}</span>
              {currentEntry&&<span style={{color:C.gold,fontWeight:"bold"}}>{currentEntry.name}</span>}
            </div>
          </div>
        )}

        <div style={{...sectionTitleStyle,marginTop:4}}>Initiative Order</div>
        {allEntries.length===0&&<div style={{textAlign:"center",color:"#5a4a3a",padding:"40px 20px",fontSize:16,lineHeight:1.8}}>No entries yet.<br/>Add combatants above, then start combat.</div>}
        {allEntries.map((entry,idx)=>{
          const isActive=combatStarted&&idx===currentIndex;
          if (entry.kind==="env") return <EnvCard key={entry.id} entry={entry} isActive={isActive}/>;
          return <CombatantCard key={entry.id} c={entry} isActive={isActive}/>;
        })}
        {targetPanel&&<TargetPanel/>}
      </div>
    );
  }

  // ── Library Tab ───────────────────────────────────────────────────────────────
  function LibraryTab() {
    return (
      <div>
        {/* Add manually */}
        <div style={cardStyle()}>
          <div style={sectionTitleStyle}>✦ Add NPC Manually</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div style={{gridColumn:"1/-1"}}><label style={labelStyle}>Name</label>
              <input style={inputStyle()} value={libForm.name} placeholder="NPC name" onChange={e=>setLibForm(f=>({...f,name:e.target.value}))}/></div>
            <div><label style={labelStyle}>Max HP</label>
              <input style={inputStyle()} type="number" inputMode="numeric" value={libForm.maxHp} placeholder="HP" onChange={e=>setLibForm(f=>({...f,maxHp:e.target.value}))}/></div>
            <div><label style={labelStyle}>AC</label>
              <input style={inputStyle()} value={libForm.ac} placeholder="e.g. 15" onChange={e=>setLibForm(f=>({...f,ac:e.target.value}))}/></div>
            <div style={{gridColumn:"1/-1"}}><label style={labelStyle}>CR</label>
              <input style={inputStyle()} value={libForm.cr} placeholder="e.g. 1/2" onChange={e=>setLibForm(f=>({...f,cr:e.target.value}))}/></div>
          </div>
          <button style={btnStyle("primary",{width:"100%",fontSize:16})} onClick={()=>{
            if (!libForm.name.trim()||!libForm.maxHp) return;
            setNpcLibrary(p=>[...p,{id:`npc_c_${uid()}`,name:libForm.name.trim(),maxHp:parseInt(libForm.maxHp)||10,ac:libForm.ac||"—",cr:libForm.cr||"—"}]);
            setLibForm({name:"",maxHp:"",ac:"",cr:""});
            showToast(`✅ ${libForm.name} added to library`);
          }}>+ Add to Library</button>
        </div>

        {/* Import / Export */}
        <div style={cardStyle()}>
          <div style={sectionTitleStyle}>📥 Import / 📤 Export</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button style={btnStyle("blue",{fontSize:14,minHeight:52})} onClick={()=>openImport("library")}>
              📥 Import NPCs<br/><span style={{fontSize:11,opacity:.7}}>.json / .monster</span>
            </button>
            <button style={btnStyle("ghost",{fontSize:14,minHeight:52})} onClick={exportLibrary}>
              📤 Export Library<br/><span style={{fontSize:11,opacity:.7}}>Save as .json</span>
            </button>
          </div>
          <div style={{marginTop:8}}>
            <button style={btnStyle("ghost",{width:"100%",fontSize:13,color:C.textDim,borderColor:"#2a1a1a",minHeight:44})}
              onClick={resetLibraryToDefaults}>
              ↺ Reset to default NPCs
            </button>
          </div>
        </div>

        {/* Persistent indicator */}
        <div style={{fontSize:12,color:C.textDim,textAlign:"center",marginBottom:12,padding:"6px 0"}}>
          💾 Library auto-saved to this device · {npcLibrary.length} NPCs
        </div>

        {/* Library list */}
        <div style={sectionTitleStyle}>NPC Library ({npcLibrary.length})</div>
        {npcLibrary.map(n=>(
          <div key={n.id} style={{...cardStyle(),display:"flex",alignItems:"center",gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:"bold",fontSize:16,color:C.text,marginBottom:2}}>{n.name}</div>
              <div style={{fontSize:13,color:C.textDim}}>HP:<strong style={{color:C.text,marginLeft:4}}>{n.maxHp}</strong> · AC:<strong style={{color:C.text,marginLeft:4}}>{n.ac}</strong> · CR:<strong style={{color:C.gold,marginLeft:4}}>{n.cr}</strong></div>
            </div>
            <button style={btnStyle("ghost",{minHeight:44,padding:"0 14px",borderColor:"#5a1a1a",color:C.redBright})}
              onClick={()=>{ setNpcLibrary(p=>p.filter(x=>x.id!==n.id)); showToast(`Removed ${n.name}`); }}>✕</button>
          </div>
        ))}
      </div>
    );
  }

  // ── Conditions Tab ────────────────────────────────────────────────────────────
  function ConditionsTab() {
    return (
      <div>
        <div style={cardStyle()}>
          <div style={sectionTitleStyle}>Add Custom Condition</div>
          <div style={{display:"flex",gap:8}}>
            <input style={{...inputStyle(),flex:1}} value={condInput} placeholder="e.g. Hexed, Raged…"
              onChange={e=>setCondInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&condInput.trim()&&!conditions.includes(condInput.trim())){setConditions(p=>[...p,condInput.trim()]);showToast(`✅ "${condInput}" added`);setCondInput("");}}}/>
            <button style={btnStyle("primary",{minHeight:48,padding:"0 18px",fontSize:16})} onClick={()=>{
              if(condInput.trim()&&!conditions.includes(condInput.trim())){setConditions(p=>[...p,condInput.trim()]);showToast(`✅ "${condInput}" added`);setCondInput("");}
            }}>Add</button>
          </div>
        </div>

        {/* Import / Export */}
        <div style={cardStyle()}>
          <div style={sectionTitleStyle}>📥 Import / 📤 Export</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button style={btnStyle("blue",{fontSize:14,minHeight:52})} onClick={()=>openImport("conditions")}>
              📥 Import Conditions<br/><span style={{fontSize:11,opacity:.7}}>.json array</span>
            </button>
            <button style={btnStyle("ghost",{fontSize:14,minHeight:52})} onClick={exportConditions}>
              📤 Export Conditions<br/><span style={{fontSize:11,opacity:.7}}>Save as .json</span>
            </button>
          </div>
          <div style={{marginTop:8}}>
            <button style={btnStyle("ghost",{width:"100%",fontSize:13,color:C.textDim,borderColor:"#2a1a1a",minHeight:44})}
              onClick={resetConditionsToDefaults}>↺ Reset to default conditions</button>
          </div>
        </div>

        <div style={{fontSize:12,color:C.textDim,textAlign:"center",marginBottom:12,padding:"6px 0"}}>
          💾 Conditions auto-saved to this device · {conditions.length} conditions
        </div>

        <div style={sectionTitleStyle}>Conditions ({conditions.length})</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {conditions.map(cond=>(
            <div key={cond} style={{...cardStyle({marginBottom:0}),padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:15}}>{cond}</span>
              <button style={btnStyle("ghost",{minHeight:36,padding:"0 10px",fontSize:15,borderColor:"#5a1a1a",color:C.redBright})}
                onClick={()=>setConditions(p=>p.filter(c=>c!==cond))}>✕</button>
            </div>
          ))}
        </div>
        <div style={{marginTop:16,padding:14,background:"rgba(0,0,0,.2)",borderRadius:8,fontSize:13,color:C.textDim,lineHeight:1.6}}>
          Conditions are staged during each combatant's active turn and applied on <strong style={{color:C.gold}}>Confirm Turn & Next</strong>.
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0d0d1a 0%,#1a0808 55%,#0a0a1a 100%)",fontFamily:"'Crimson Text',Georgia,serif",color:C.text,paddingBottom:60,overflowX:"hidden"}}>
      

      <div style={{background:"linear-gradient(180deg,#2a0808,#180404)",borderBottom:"2px solid #8b1a1a",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 4px 20px rgba(139,26,26,.4)"}}>
        <h1 style={{fontSize:20,fontWeight:"bold",color:C.gold,letterSpacing:2,textShadow:"0 0 20px rgba(232,200,122,.4)",margin:0,fontFamily:"'Cinzel',Georgia,serif"}}>⚔ D&D Combat</h1>
        {combatStarted&&<div style={{background:"#8b1a1a",color:C.text,padding:"5px 14px",borderRadius:20,fontSize:13,letterSpacing:1}}>Round {round}</div>}
      </div>

      <div style={{display:"flex",background:"#0a0a14",borderBottom:"1px solid #1a1020",position:"sticky",top:0,zIndex:40}}>
        {[["combat","⚔ Combat"],["library","📖 Library"],["conditions","✦ Conditions"]].map(([k,l])=>(
          <button key={k}
            style={{flex:1,padding:"14px 4px",textAlign:"center",cursor:"pointer",fontSize:13,letterSpacing:.5,
              background:tab===k?"#140a10":"transparent",color:tab===k?C.gold:C.textDim,
              borderBottom:tab===k?`2px solid ${C.gold}`:"2px solid transparent",
              transition:"all .2s",fontFamily:"'Crimson Text',Georgia,serif",border:"none",minHeight:48,userSelect:"none"}}
            onClick={()=>setTab(k)}>{l}
          </button>
        ))}
      </div>

      <div style={{padding:"12px 12px",maxWidth:700,margin:"0 auto"}}>
        {tab==="combat"    && <CombatTab/>}
        {tab==="library"   && <LibraryTab/>}
        {tab==="conditions"&& <ConditionsTab/>}
      </div>
    </div>
  );
}
