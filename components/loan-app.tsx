"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell, Boxes, CalendarClock, Check, ChevronDown, CircleDollarSign, ClipboardCheck,
  Clock3, FileDown, FileText, History, LayoutDashboard, Laptop, Menu, PackageCheck,
  Plus, RotateCcw, Search, Settings, ShieldCheck, SlidersHorizontal, TriangleAlert,
  UserCog, Users, Wrench, X, LogOut, MapPin, MoreHorizontal, Upload
  , Pencil, Trash2, UserPlus, Power, Tag
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

type Equipment = {
  id:number; asset_code:string; name:string; category:string; brand_model:string; serial_number:string;
  location:string; status:string; notes:string;
};
type Loan = {
  id:number; request_code:string; borrower_name:string; start_at:string; due_at:string; purpose:string;
  status:string; item_names:string; item_count:number; borrower_auth_id:string;
};
type UserRow = { id:number; auth_id:string; email:string; name:string; role:string; active:number|boolean };
type RefRow = { id:number; name:string; active:number|boolean };
type View = "dashboard"|"equipment"|"requests"|"approval"|"returns"|"history"|"reports"|"users"|"settings";
type AppData = {
  equipment: Equipment[]; requests: Loan[]; users:UserRow[]; categories:RefRow[]; locations:RefRow[];
  settings:Record<string,string>; user:{id:string;name:string;email:string;role:string}
};

const nav: {id:View; label:string; icon:typeof LayoutDashboard; admin?:boolean}[] = [
  {id:"dashboard",label:"ภาพรวม",icon:LayoutDashboard},{id:"equipment",label:"รายการอุปกรณ์",icon:Boxes},
  {id:"requests",label:"คำขอยืมของฉัน",icon:FileText},{id:"approval",label:"อนุมัติคำขอ",icon:ClipboardCheck,admin:true},
  {id:"returns",label:"บันทึกคืน",icon:RotateCcw,admin:true},{id:"history",label:"ประวัติการยืม-คืน",icon:History},
  {id:"reports",label:"รายงาน",icon:FileDown,admin:true},{id:"users",label:"จัดการผู้ใช้งาน",icon:UserCog,admin:true},
  {id:"settings",label:"ตั้งค่าระบบ",icon:Settings,admin:true},
];
const statusText:Record<string,string> = {
  available:"พร้อมยืม",borrowed:"กำลังยืม",pending:"รออนุมัติ",maintenance:"ซ่อมบำรุง",damaged:"ชำรุด",
  lost:"สูญหาย",approved:"อนุมัติแล้ว",rejected:"ไม่อนุมัติ",returned:"คืนแล้ว",overdue:"เกินกำหนด"
};
const statusClass:Record<string,string> = {
  available:"green",returned:"green",pending:"yellow",approved:"sky",borrowed:"blue",maintenance:"orange",
  damaged:"red",lost:"red",overdue:"red",rejected:"gray"
};
const fmt = (value:string) => new Intl.DateTimeFormat("th-TH",{day:"numeric",month:"short",year:"2-digit"}).format(new Date(value));

export default function LoanApp() {
  const [data,setData] = useState<AppData|null>(null);
  const [view,setView] = useState<View>("dashboard");
  const [menu,setMenu] = useState(false);
  const [query,setQuery] = useState("");
  const [status,setStatus] = useState("all");
  const [category,setCategory] = useState("all");
  const [loanOpen,setLoanOpen] = useState(false);
  const [equipmentEditor,setEquipmentEditor] = useState<Equipment|"new"|null>(null);
  const [userOpen,setUserOpen] = useState(false);
  const [returnLoan,setReturnLoan] = useState<Loan|null>(null);
  const [selected,setSelected] = useState<number[]>([]);
  const [toast,setToast] = useState("");
  const [busy,setBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/system",{cache:"no-store"});
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);
    setData(json);
  };
  useEffect(() => { load().catch(e=>setToast(e.message)); },[]);
  useEffect(() => {
    const ctx = (document as unknown as {modelContext?:{registerTool:(t:unknown,o?:unknown)=>unknown}}).modelContext;
    if (!ctx?.registerTool) return;
    const abort = new AbortController();
    void ctx.registerTool({
      name:"list_available_equipment", title:"ดูอุปกรณ์ที่พร้อมยืม",
      description:"แสดงรายการอุปกรณ์ไอทีที่มีสถานะพร้อมยืมในระบบ",
      inputSchema:{type:"object",properties:{},additionalProperties:false},
      annotations:{readOnlyHint:true,untrustedContentHint:false},
      execute:()=>({items:(data?.equipment??[]).filter(x=>x.status==="available").map(x=>({id:x.id,code:x.asset_code,name:x.name}))})
    },{signal:abort.signal});
    return ()=>abort.abort();
  },[data]);

  const flash=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(""),3500)};
  const post=async(body:Record<string,unknown>)=>{
    setBusy(true);
    try { const r=await fetch("/api/system",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const j=await r.json(); if(!r.ok) throw new Error(j.error); await load(); return j;
    } catch(error) { flash(error instanceof Error?error.message:"เกิดข้อผิดพลาด กรุณาลองใหม่"); throw error }
    finally {setBusy(false)}
  };
  const filtered=useMemo(()=>data?.equipment.filter(e=>
    (status==="all"||(status==="issue"?["maintenance","damaged","lost"].includes(e.status):e.status===status))&&(category==="all"||e.category===category)&&
    [e.name,e.asset_code,e.brand_model,e.location].join(" ").toLowerCase().includes(query.toLowerCase())
  )??[],[data,query,status,category]);
  const categories=data?.categories.map(x=>x.name)??[];
  const stats = {
    total:data?.equipment.length??0, available:data?.equipment.filter(e=>e.status==="available").length??0,
    borrowed:data?.equipment.filter(e=>e.status==="borrowed").length??0,
    repair:data?.equipment.filter(e=>["maintenance","damaged"].includes(e.status)).length??0,
    overdue:data?.requests.filter(r=>r.status==="overdue"||(["borrowed","approved"].includes(r.status)&&new Date(r.due_at)<new Date())).length??0
  };

  if(!data) return <div className="loading"><div className="loading-mark"><Laptop/></div><p>กำลังเตรียมระบบยืม-คืนอุปกรณ์...</p></div>;
  return <div className="app-shell">
    <aside className={`sidebar ${menu?"open":""}`}>
      <div className="brand"><span><Laptop/></span><div><b>IT Borrow</b><small>Equipment Center</small></div><button className="mobile-close" onClick={()=>setMenu(false)}><X/></button></div>
      <nav>{nav.filter(item=>!item.admin||data.user.role==="admin").map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>{setView(item.id);setMenu(false)}}>
        <item.icon/><span>{item.label}</span>{item.id==="approval"&&<em>{data.requests.filter(r=>r.status==="pending").length}</em>}
      </button>)}</nav>
      <div className="sidebar-help"><ShieldCheck/><b>ระบบพร้อมใช้งาน</b><span>ข้อมูลได้รับการบันทึกอัตโนมัติ</span></div>
      <a className="logout" href="/signout-with-chatgpt?return_to=/"><LogOut/> ออกจากระบบ</a>
    </aside>
    {menu&&<button className="scrim" onClick={()=>setMenu(false)} aria-label="ปิดเมนู"/>}
    <main className="main">
      <header className="topbar">
        <div className="top-title"><button className="menu-button" onClick={()=>setMenu(true)}><Menu/></button><div><small>ระบบยืม-คืนอุปกรณ์ไอที</small><b>{nav.find(n=>n.id===view)?.label}</b></div></div>
        <div className="top-actions"><button className="notification" onClick={()=>setView(data.user.role==="admin"?"approval":"requests")} aria-label="ดูรายการแจ้งเตือน"><Bell/><i>{stats.overdue+data.requests.filter(r=>r.status==="pending").length}</i></button><div className="profile"><span>{data.user.name.slice(0,2)}</span><div><b>{data.user.name}</b><small>{data.user.role==="admin"?"ผู้ดูแลระบบ":"ผู้ใช้งาน"}</small></div><ChevronDown/></div></div>
      </header>
      <div className="content">
        {view==="dashboard"&&<Dashboard stats={stats} loans={data.requests} equipment={data.equipment} admin={data.user.role==="admin"} onBorrow={()=>setLoanOpen(true)} onGo={setView}/>}
        {view==="equipment"&&<EquipmentView items={filtered} allItems={data.equipment} query={query} setQuery={setQuery} status={status} setStatus={setStatus}
          category={category} setCategory={setCategory} categories={categories} selected={selected} setSelected={setSelected}
          onBorrow={()=>setLoanOpen(true)} onAdd={()=>setEquipmentEditor("new")} onEdit={(e:Equipment)=>setEquipmentEditor(e)} admin={data.user.role==="admin"}/>}
        {view==="requests"&&<RequestsView title="คำขอยืมของฉัน" loans={data.requests.filter(r=>r.borrower_auth_id===data.user.id)} actions={false}/>}
        {view==="approval"&&<RequestsView title="รายการรออนุมัติ" loans={data.requests.filter(x=>["pending","approved"].includes(x.status))} actions
          onAction={async(id,s)=>{await post({action:"setStatus",requestId:id,status:s});flash(s==="approved"?"อนุมัติคำขอแล้ว":"อัปเดตสถานะแล้ว")}}/>}
        {view==="returns"&&<ReturnView loans={data.requests.filter(x=>["approved","borrowed","overdue"].includes(x.status))} onReturn={setReturnLoan}/>}
        {view==="history"&&<RequestsView title="ประวัติการยืม-คืนทั้งหมด" loans={data.requests} actions={false}/>}
        {view==="reports"&&<Reports equipment={data.equipment} loans={data.requests}/>}
        {view==="users"&&<UsersView users={data.users} onAdd={()=>setUserOpen(true)} onToggle={async(u)=>{await post({action:"toggleUser",id:u.id,active:!Boolean(u.active)});flash(Boolean(u.active)?"ปิดบัญชีแล้ว":"เปิดใช้งานบัญชีแล้ว")}}/>}
        {view==="settings"&&<SettingsView settings={data.settings} categories={data.categories} locations={data.locations} busy={busy}
          onSave={async(v)=>{await post({action:"saveSettings",...v});flash("บันทึกการตั้งค่าแล้ว")}}
          onAddRef={async(kind,name)=>{await post({action:"saveReference",kind,name});flash("เพิ่มข้อมูลอ้างอิงแล้ว")}}/>}
      </div>
    </main>
    <LoanDialog open={loanOpen} onOpen={setLoanOpen} items={data.equipment.filter(x=>x.status==="available")} initialSelected={selected}
      busy={busy} onSubmit={async form=>{const j=await post({action:"createLoan",...form});setLoanOpen(false);setSelected([]);flash(`ส่งคำขอ ${j.code} เรียบร้อยแล้ว`)}}/>
    <EquipmentDialog open={!!equipmentEditor} onOpen={v=>!v&&setEquipmentEditor(null)} item={equipmentEditor==="new"?null:equipmentEditor}
      categories={data.categories.map(x=>x.name)} locations={data.locations.map(x=>x.name)} busy={busy}
      onSubmit={async form=>{await post({action:"saveEquipment",...form});setEquipmentEditor(null);flash(form.id?"แก้ไขอุปกรณ์แล้ว":"เพิ่มอุปกรณ์เรียบร้อยแล้ว")}}
      onDisable={async id=>{await post({action:"disableEquipment",id});setEquipmentEditor(null);flash("นำอุปกรณ์ออกจากรายการแล้ว")}}/>
    <UserDialog open={userOpen} onOpen={setUserOpen} busy={busy} onSubmit={async form=>{await post({action:"saveUser",...form});setUserOpen(false);flash("เพิ่มผู้ใช้งานแล้ว")}}/>
    <ReturnDialog loan={returnLoan} onOpen={()=>setReturnLoan(null)} busy={busy} onSubmit={async form=>{await post({action:"return",requestId:returnLoan?.id,...form});setReturnLoan(null);flash("บันทึกการคืนอุปกรณ์แล้ว")}}/>
    {toast&&<div className="toast"><Check/>{toast}</div>}
  </div>
}

function Dashboard({stats,loans,equipment,admin,onBorrow,onGo}:{stats:Record<string,number>;loans:Loan[];equipment:Equipment[];admin:boolean;onBorrow:()=>void;onGo:(v:View)=>void}) {
  const cards=[["อุปกรณ์ทั้งหมด",stats.total,Boxes,"purple"],["พร้อมใช้งาน",stats.available,PackageCheck,"green"],["กำลังถูกยืม",stats.borrowed,Laptop,"blue"],["ชำรุด / ซ่อม",stats.repair,Wrench,"orange"],["เกินกำหนดคืน",stats.overdue,TriangleAlert,"red"]] as const;
  const max=Math.max(...Object.values(stats),1);
  return <><section className="welcome"><div><p>{new Intl.DateTimeFormat("th-TH",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}</p><h1>สวัสดีครับ 👋</h1><span>วันนี้มี <b>{loans.filter(x=>x.status==="pending").length} คำขอ</b> รออนุมัติ และ <b>{stats.overdue} รายการ</b> ต้องติดตาม</span></div><button className="primary" onClick={onBorrow}><Plus/> สร้างคำขอยืม</button></section>
  <section className="stat-grid">{cards.map(([label,value,Icon,color])=><article className="stat-card" key={label}><div className={`icon-box ${color}`}><Icon/></div><div><span>{label}</span><strong>{value}</strong><small>รายการ</small></div></article>)}</section>
  <section className="dashboard-grid"><article className="panel">
    <div className="panel-head"><div><h2>สถานะอุปกรณ์</h2><p>ภาพรวมอุปกรณ์ในระบบ</p></div><button className="text-button" onClick={()=>onGo("equipment")}>ดูทั้งหมด</button></div>
    <div className="bars">{[["พร้อมยืม",stats.available,"#16a36a"],["กำลังยืม",stats.borrowed,"#146cf4"],["ชำรุด / ซ่อม",stats.repair,"#ef7c26"]].map(([l,v,c])=><div className="bar-row" key={String(l)}><div><span>{l}</span><b>{v}</b></div><i><u style={{width:`${Number(v)/max*100}%`,background:String(c)}}/></i></div>)}</div>
  </article><article className="panel">
    <div className="panel-head"><div><h2>ใกล้ถึงกำหนดคืน</h2><p>ภายใน 3 วันข้างหน้า</p></div><CalendarClock/></div>
    <div className="due-list">{loans.filter(x=>["borrowed","approved"].includes(x.status)).slice(0,3).map(x=><div key={x.id}><span className="equipment-mini"><Laptop/></span><div><b>{x.item_names}</b><small>{x.borrower_name}</small></div><em><Clock3/>{fmt(x.due_at)}</em></div>)}{!loans.length&&<p className="empty">ไม่มีรายการใกล้ครบกำหนด</p>}</div>
  </article></section>
  <section className="panel recent"><div className="panel-head"><div><h2>คำขอล่าสุด</h2><p>ติดตามสถานะคำขอยืมล่าสุด</p></div><button className="text-button" onClick={()=>onGo(admin?"approval":"requests")}>ดูคำขอทั้งหมด</button></div><RequestTable loans={loans.slice(0,5)}/></section></>
}

function EquipmentView({items,allItems,query,setQuery,status,setStatus,category,setCategory,categories,selected,setSelected,onBorrow,onAdd,onEdit,admin}:any) {
  const counts = {
    all:allItems.length,
    available:allItems.filter((e:Equipment)=>e.status==="available").length,
    borrowed:allItems.filter((e:Equipment)=>e.status==="borrowed").length,
    issue:allItems.filter((e:Equipment)=>["maintenance","damaged","lost"].includes(e.status)).length,
  };
  const toggle=(e:Equipment)=>{if(e.status!=="available")return;setSelected((s:number[])=>s.includes(e.id)?s.filter(x=>x!==e.id):[...s,e.id])};
  return <><section className="page-head equipment-head"><div><h1>รายการอุปกรณ์</h1><p>เลือกอุปกรณ์ที่พร้อมใช้งานแล้วส่งคำขอยืมได้ทันที</p></div><div>{admin&&<button className="secondary" onClick={onAdd}><Plus/> เพิ่มอุปกรณ์</button>}<button className="primary" disabled={!selected.length} onClick={onBorrow}><ClipboardCheck/> ยืมที่เลือก <span className="button-count">{selected.length}</span></button></div></section>
  <section className="inventory-summary">
    {[["all","ทั้งหมด",counts.all,Boxes],["available","พร้อมยืม",counts.available,PackageCheck],["borrowed","กำลังยืม",counts.borrowed,Laptop],["issue","ชำรุด / ซ่อม",counts.issue,Wrench]].map(([key,label,value,Icon])=>
      <button key={String(key)} className={status===key?"active":""} onClick={()=>setStatus(key)}>
        <span className={String(key)}><Icon/></span><div><small>{String(label)}</small><b>{String(value)}</b></div>
      </button>)}
  </section>
  <section className="inventory-toolbar">
    <label className="inventory-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาชื่อ รหัส รุ่น หรือสถานที่จัดเก็บ"/></label>
    <label><SlidersHorizontal/><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">ทุกประเภท</option>{categories.map((x:string)=><option key={x}>{x}</option>)}</select></label>
    <label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">ทุกสถานะ</option><option value="issue">ชำรุด / ซ่อม / สูญหาย</option>{Object.entries(statusText).slice(0,6).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
    {(query||status!=="all"||category!=="all")&&<button className="clear-filter" onClick={()=>{setQuery("");setStatus("all");setCategory("all")}}><X/> ล้างตัวกรอง</button>}
  </section>
  <div className="inventory-result"><b>อุปกรณ์ {items.length} รายการ</b><span>{selected.length?"เลือกแล้ว "+selected.length+" รายการ":"กดที่การ์ดเพื่อเลือกอุปกรณ์ที่พร้อมยืม"}</span></div>
  <section className="equipment-grid">
    {items.map((e:Equipment)=>{const picked=selected.includes(e.id);return <article key={e.id} className={"equipment-card "+(picked?"picked ":"")+(e.status!=="available"?"unavailable":"")} onClick={()=>toggle(e)}>
      <div className="equipment-card-top"><span className="equipment-visual"><Laptop/></span><div className="equipment-card-actions"><Status value={e.status}/>{admin&&<button aria-label="แก้ไขอุปกรณ์" onClick={ev=>{ev.stopPropagation();onEdit(e)}}><Pencil/></button>}</div></div>
      <div className="equipment-card-title"><small>{e.asset_code}</small><h3>{e.name}</h3><p>{e.brand_model||"ไม่ระบุยี่ห้อ / รุ่น"}</p></div>
      <div className="equipment-card-info"><span><Tag/>{e.category}</span><span><MapPin/>{e.location}</span><span><FileText/>S/N {e.serial_number||"—"}</span></div>
      <div className="equipment-card-foot">{e.status==="available"?<><Checkbox checked={picked} onCheckedChange={()=>toggle(e)}/><b>{picked?"เลือกแล้ว":"เลือกเพื่อยืม"}</b></>:<span>ยังไม่พร้อมให้ยืม</span>}</div>
    </article>})}
    {!items.length&&<div className="inventory-empty"><Search/><h3>ไม่พบอุปกรณ์</h3><p>ลองเปลี่ยนคำค้นหาหรือตัวกรองอีกครั้ง</p><button className="secondary" onClick={()=>{setQuery("");setStatus("all");setCategory("all")}}>แสดงทั้งหมด</button></div>}
  </section>
  {selected.length>0&&<div className="selection-dock"><div><span>{selected.length}</span><p><b>เลือกอุปกรณ์แล้ว</b><small>ตรวจสอบรายการแล้วส่งคำขอยืม</small></p></div><button className="primary" onClick={onBorrow}>ดำเนินการต่อ <ClipboardCheck/></button></div>}
  </>;
}

function RequestsView({title,loans,actions,onAction}:{title:string;loans:Loan[];actions:boolean;onAction?:(id:number,s:string)=>void}) {
  return <><section className="page-head"><div><h1>{title}</h1><p>ตรวจสอบรายละเอียด ช่วงเวลา และสถานะของคำขอ</p></div></section><section className="panel table-panel"><RequestTable loans={loans} actions={actions} onAction={onAction}/></section></>
}
function RequestTable({loans,actions=false,onAction}:{loans:Loan[];actions?:boolean;onAction?:(id:number,s:string)=>void}) {
  return <Table><TableHeader><TableRow><TableHead>เลขที่คำขอ</TableHead><TableHead>ผู้ยืม / วัตถุประสงค์</TableHead><TableHead>อุปกรณ์</TableHead><TableHead>ช่วงเวลายืม</TableHead><TableHead>สถานะ</TableHead>{actions&&<TableHead>การอนุมัติ</TableHead>}</TableRow></TableHeader><TableBody>
    {loans.map(r=><TableRow key={r.id}><TableCell><b className="request-code">{r.request_code}</b></TableCell><TableCell><div className="stack"><b>{r.borrower_name}</b><small>{r.purpose}</small></div></TableCell><TableCell><div className="stack"><b>{r.item_names||"—"}</b><small>{r.item_count} รายการ</small></div></TableCell><TableCell><div className="stack"><b>{fmt(r.start_at)} – {fmt(r.due_at)}</b><small>{Math.max(1,Math.ceil((+new Date(r.due_at)-+new Date(r.start_at))/86400000))} วัน</small></div></TableCell><TableCell><Status value={r.status}/></TableCell>{actions&&<TableCell><div className="row-actions">{r.status==="pending"?<><button className="approve" onClick={()=>onAction?.(r.id,"approved")}><Check/>อนุมัติ</button><button className="reject" onClick={()=>onAction?.(r.id,"rejected")}><X/></button></>:<button className="secondary small" onClick={()=>onAction?.(r.id,"borrowed")}>ส่งมอบแล้ว</button>}</div></TableCell>}</TableRow>)}
    {!loans.length&&<TableRow><TableCell colSpan={actions?6:5}><p className="empty">ยังไม่มีรายการในหน้านี้</p></TableCell></TableRow>}
  </TableBody></Table>
}
function ReturnView({loans,onReturn}:{loans:Loan[];onReturn:(l:Loan)=>void}) {
  return <><section className="page-head"><div><h1>บันทึกคืนอุปกรณ์</h1><p>ตรวจรับ ตรวจสภาพ และบันทึกค่าปรับหรือความเสียหาย</p></div></section><section className="return-grid">{loans.map(r=><article className="return-card" key={r.id}><div className="return-top"><span><RotateCcw/></span><Status value={r.status}/></div><h3>{r.item_names}</h3><p>{r.request_code} • {r.borrower_name}</p><div className="return-meta"><span><CalendarClock/>ครบกำหนด {fmt(r.due_at)}</span><span>{r.item_count} รายการ</span></div><button className="primary full" onClick={()=>onReturn(r)}>ตรวจรับและบันทึกคืน</button></article>)}</section></>
}
function Reports({equipment,loans}:{equipment:Equipment[];loans:Loan[]}) {
  const download=()=>{const rows=[["รหัสอุปกรณ์","ชื่ออุปกรณ์","ประเภท","สถานะ","สถานที่"],...equipment.map(e=>[e.asset_code,e.name,e.category,statusText[e.status],e.location])];const html=`<table>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff",html],{type:"application/vnd.ms-excel"}));a.download="รายงานอุปกรณ์.xls";a.click()};
  return <><section className="page-head"><div><h1>รายงานสรุป</h1><p>วิเคราะห์การใช้งาน ติดตามรายการเกินกำหนด และส่งออกข้อมูล</p></div><div><button className="secondary" onClick={()=>window.print()}><FileText/> ดาวน์โหลด PDF</button><button className="primary" onClick={download}><FileDown/> ดาวน์โหลด Excel</button></div></section>
  <section className="report-grid"><article className="panel"><h2>อุปกรณ์ที่ถูกยืมบ่อย</h2>{equipment.slice(0,4).map((e,i)=><div className="rank" key={e.id}><b>{i+1}</b><span><strong>{e.name}</strong><small>{[18,15,11,8][i]} ครั้ง</small></span><i><u style={{width:`${[100,83,61,44][i]}%`}}/></i></div>)}</article><article className="panel"><h2>สรุปคำขอตามสถานะ</h2><div className="donut-wrap"><div className="donut"><span>{loans.length}<small>คำขอ</small></span></div><div className="legend">{["pending","approved","borrowed","returned"].map(s=><div key={s}><i className={statusClass[s]}/><span>{statusText[s]}</span><b>{loans.filter(x=>x.status===s).length}</b></div>)}</div></div></article></section>
  <section className="panel report-cards"><h2>รายงานที่พร้อมใช้งาน</h2><div>{[["ประวัติการยืมตามช่วงเวลา",History],["รายการเกินกำหนดคืน",TriangleAlert],["อุปกรณ์ชำรุด / ซ่อม",Wrench],["สรุปค่าปรับ",CircleDollarSign]].map(([t,I])=><button key={String(t)} onClick={download}><span><I/></span><b>{String(t)}</b><FileDown/></button>)}</div></section></>
}
function UsersView({users,onAdd,onToggle}:{users:UserRow[];onAdd:()=>void;onToggle:(u:UserRow)=>void}) {
  return <><section className="page-head"><div><h1>จัดการผู้ใช้งาน</h1><p>กำหนดสิทธิ์และเปิดหรือปิดบัญชีผู้ใช้งาน</p></div><button className="primary" onClick={onAdd}><UserPlus/> เพิ่มผู้ใช้งาน</button></section>
  <section className="panel table-panel"><div className="table-summary"><b>ผู้ใช้งาน {users.length} คน</b><span>ข้อมูลบัญชีที่มีสิทธิ์เข้าใช้งานระบบ</span></div><Table><TableHeader><TableRow><TableHead>ชื่อผู้ใช้งาน</TableHead><TableHead>อีเมล</TableHead><TableHead>สิทธิ์</TableHead><TableHead>สถานะ</TableHead><TableHead>จัดการ</TableHead></TableRow></TableHeader><TableBody>{users.map(u=><TableRow key={u.id}><TableCell><div className="user-cell"><span>{u.name.slice(0,2)}</span><b>{u.name}</b></div></TableCell><TableCell>{u.email}</TableCell><TableCell><span className="role"><ShieldCheck/>{u.role==="admin"?"ผู้ดูแลระบบ":"ผู้ใช้งาน"}</span></TableCell><TableCell><span className={"status "+(u.active?"green":"gray")}><i/>{u.active?"ใช้งาน":"ปิดใช้งาน"}</span></TableCell><TableCell><button className="secondary small" onClick={()=>onToggle(u)}><Power/>{u.active?"ปิดบัญชี":"เปิดบัญชี"}</button></TableCell></TableRow>)}</TableBody></Table></section></>;
}
function SettingsView({settings,categories,locations,busy,onSave,onAddRef}:{settings:Record<string,string>;categories:RefRow[];locations:RefRow[];busy:boolean;onSave:(v:Record<string,unknown>)=>void;onAddRef:(kind:string,name:string)=>void}) {
  const [maxDays,setMaxDays]=useState(settings.max_borrow_days??"14");
  const [reminder,setReminder]=useState(settings.reminder_days??"3");
  const [approval,setApproval]=useState(settings.require_approval!=="false");
  const [kind,setKind]=useState<"category"|"location"|null>(null);
  const [name,setName]=useState("");
  const list=kind==="category"?categories:locations;
  return <><section className="page-head"><div><h1>ตั้งค่าระบบ</h1><p>จัดการเงื่อนไขการยืมและข้อมูลที่ใช้ในแบบฟอร์ม</p></div><button className="primary" disabled={busy} onClick={()=>onSave({maxBorrowDays:Number(maxDays),reminderDays:Number(reminder),requireApproval:approval})}><Check/> บันทึกการตั้งค่า</button></section>
  <section className="settings-grid"><article className="panel"><h2>การยืมและแจ้งเตือน</h2><label>จำนวนวันที่ยืมสูงสุด<input type="number" min="1" value={maxDays} onChange={e=>setMaxDays(e.target.value)}/></label><label>แจ้งเตือนก่อนครบกำหนด (วัน)<input type="number" min="0" value={reminder} onChange={e=>setReminder(e.target.value)}/></label><label className="toggle-line"><span><b>อนุมัติคำขอก่อนทุกครั้ง</b><small>คำขอจะไม่สามารถรับอุปกรณ์ได้จนกว่าจะอนุมัติ</small></span><input type="checkbox" checked={approval} onChange={e=>setApproval(e.target.checked)}/></label></article><article className="panel"><h2>ข้อมูลอ้างอิง</h2><button className="setting-row" onClick={()=>{setKind("category");setName("")}}><span><Boxes/></span><div><b>ประเภทอุปกรณ์</b><small>{categories.length} ประเภท</small></div><ChevronDown/></button><button className="setting-row" onClick={()=>{setKind("location");setName("")}}><span><MapPin/></span><div><b>สถานที่จัดเก็บ</b><small>{locations.length} สถานที่</small></div><ChevronDown/></button></article></section>
  <Dialog open={!!kind} onOpenChange={v=>!v&&setKind(null)}><DialogContent className="modal"><DialogHeader><DialogTitle>{kind==="category"?"ประเภทอุปกรณ์":"สถานที่จัดเก็บ"}</DialogTitle><DialogDescription>รายการเหล่านี้จะแสดงในแบบฟอร์มเพิ่มอุปกรณ์</DialogDescription></DialogHeader><div className="reference-list">{list.map(x=><span key={x.id}>{x.name}</span>)}</div><div className="inline-add"><input value={name} onChange={e=>setName(e.target.value)} placeholder="เพิ่มรายการใหม่"/><button className="primary" disabled={!name.trim()||busy} onClick={async()=>{await onAddRef(kind!,name);setName("")}}><Plus/> เพิ่ม</button></div></DialogContent></Dialog>
  </>;
}
function Status({value}:{value:string}){return <span className={`status ${statusClass[value]??"gray"}`}><i/>{value==="available"&&value in statusText?statusText[value]:(statusText[value]??value)}</span>}

function LoanDialog({open,onOpen,items,initialSelected,busy,onSubmit}:{open:boolean;onOpen:(v:boolean)=>void;items:Equipment[];initialSelected:number[];busy:boolean;onSubmit:(v:Record<string,unknown>)=>void}) {
  const [ids,setIds]=useState<number[]>([]); const [start,setStart]=useState(""); const [due,setDue]=useState(""); const [purpose,setPurpose]=useState(""); const [notes,setNotes]=useState("");
  useEffect(()=>{if(open)setIds(initialSelected)},[open,initialSelected]);
  return <Dialog open={open} onOpenChange={onOpen}><DialogContent className="modal wide"><DialogHeader><DialogTitle>สร้างคำขอยืมอุปกรณ์</DialogTitle><DialogDescription>เลือกได้มากกว่า 1 รายการ ระบบจะตรวจสอบช่วงเวลาซ้ำก่อนบันทึก</DialogDescription></DialogHeader>
    <div className="form-grid"><label className="span-2">เลือกอุปกรณ์ <b>*</b><div className="pick-list">{items.map(e=><button type="button" className={ids.includes(e.id)?"selected":""} key={e.id} onClick={()=>setIds(s=>s.includes(e.id)?s.filter(x=>x!==e.id):[...s,e.id])}><span><Laptop/></span><div><b>{e.name}</b><small>{e.asset_code} • {e.location}</small></div>{ids.includes(e.id)?<Check/>:<Plus/>}</button>)}</div></label>
    <label>วันที่และเวลารับ <b>*</b><input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label><label>วันครบกำหนดคืน <b>*</b><input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label>
    <label className="span-2">วัตถุประสงค์ <b>*</b><textarea value={purpose} onChange={e=>setPurpose(e.target.value)} placeholder="เช่น ใช้สำหรับประชุมนอกสถานที่"/></label><label className="span-2">หมายเหตุเพิ่มเติม<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="ข้อมูลเพิ่มเติม (ถ้ามี)"/></label></div>
    <DialogFooter><button className="secondary" onClick={()=>onOpen(false)}>ยกเลิก</button><button className="primary" disabled={busy||!ids.length||!start||!due||!purpose} onClick={()=>onSubmit({equipmentIds:ids,startAt:new Date(start).toISOString(),dueAt:new Date(due).toISOString(),purpose,notes})}>{busy?"กำลังบันทึก...":"ส่งคำขอยืม"}</button></DialogFooter>
  </DialogContent></Dialog>
}
function EquipmentDialog({open,onOpen,item,categories,locations,busy,onSubmit,onDisable}:{open:boolean;onOpen:(v:boolean)=>void;item:Equipment|null;categories:string[];locations:string[];busy:boolean;onSubmit:(v:Record<string,unknown>)=>void;onDisable:(id:number)=>void}) {
  const blank={assetCode:"",name:"",category:"",brandModel:"",serialNumber:"",location:"",status:"available",notes:""};
  const [f,setF]=useState(blank);
  useEffect(()=>{if(open)setF(item?{assetCode:item.asset_code,name:item.name,category:item.category,brandModel:item.brand_model,serialNumber:item.serial_number,location:item.location,status:item.status,notes:item.notes}:blank)},[open,item]);
  return <Dialog open={open} onOpenChange={onOpen}><DialogContent className="modal wide"><DialogHeader><DialogTitle>{item?"แก้ไขอุปกรณ์":"เพิ่มอุปกรณ์"}</DialogTitle><DialogDescription>กรอกข้อมูลสำหรับค้นหา ติดตาม และแสดงสถานะอุปกรณ์</DialogDescription></DialogHeader><div className="form-grid">
    <label>รหัสอุปกรณ์ *<input value={f.assetCode} onChange={e=>setF({...f,assetCode:e.target.value})}/></label>
    <label>ชื่ออุปกรณ์ *<input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
    <label>ประเภท *<input list="category-list" value={f.category} onChange={e=>setF({...f,category:e.target.value})}/><datalist id="category-list">{categories.map(x=><option key={x} value={x}/>)}</datalist></label>
    <label>ยี่ห้อ / รุ่น<input value={f.brandModel} onChange={e=>setF({...f,brandModel:e.target.value})}/></label>
    <label>Serial Number<input value={f.serialNumber} onChange={e=>setF({...f,serialNumber:e.target.value})}/></label>
    <label>สถานที่จัดเก็บ *<input list="location-list" value={f.location} onChange={e=>setF({...f,location:e.target.value})}/><datalist id="location-list">{locations.map(x=><option key={x} value={x}/>)}</datalist></label>
    <label>สถานะ<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{Object.entries(statusText).slice(0,6).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
    <label className="span-2">หมายเหตุ<textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label></div>
    <DialogFooter><div className="modal-footer-split">{item&&<button className="danger-button" disabled={busy} onClick={()=>onDisable(item.id)}><Trash2/> นำออกจากรายการ</button>}<span/><button className="secondary" onClick={()=>onOpen(false)}>ยกเลิก</button><button className="primary" disabled={busy||!f.assetCode||!f.name||!f.category||!f.location} onClick={()=>onSubmit({...f,id:item?.id})}>{busy?"กำลังบันทึก...":"บันทึก"}</button></div></DialogFooter>
  </DialogContent></Dialog>
}
function UserDialog({open,onOpen,busy,onSubmit}:{open:boolean;onOpen:(v:boolean)=>void;busy:boolean;onSubmit:(v:Record<string,unknown>)=>void}) {
  const [name,setName]=useState("");const [email,setEmail]=useState("");const [role,setRole]=useState("user");
  useEffect(()=>{if(open){setName("");setEmail("");setRole("user")}},[open]);
  return <Dialog open={open} onOpenChange={onOpen}><DialogContent className="modal"><DialogHeader><DialogTitle>เพิ่มผู้ใช้งาน</DialogTitle><DialogDescription>เพิ่มบัญชีและกำหนดสิทธิ์เริ่มต้นในระบบ</DialogDescription></DialogHeader><div className="return-form"><label>ชื่อ-นามสกุล<input value={name} onChange={e=>setName(e.target.value)} placeholder="ชื่อผู้ใช้งาน"/></label><label>อีเมล<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.org"/></label><label>สิทธิ์<select value={role} onChange={e=>setRole(e.target.value)}><option value="user">ผู้ใช้งาน</option><option value="admin">ผู้ดูแลระบบ</option></select></label></div><DialogFooter><button className="secondary" onClick={()=>onOpen(false)}>ยกเลิก</button><button className="primary" disabled={busy||!name||!email.includes("@")} onClick={()=>onSubmit({name,email,role})}>เพิ่มผู้ใช้งาน</button></DialogFooter></DialogContent></Dialog>
}
function ReturnDialog({loan,onOpen,busy,onSubmit}:{loan:Loan|null;onOpen:()=>void;busy:boolean;onSubmit:(v:Record<string,unknown>)=>Promise<void>|void}) {
  const [condition,setCondition]=useState("normal"); const [damage,setDamage]=useState("");const [fine,setFine]=useState("0");const [file,setFile]=useState<File|null>(null);
  const submit=async()=>{let photoName="";if(file){const fd=new FormData();fd.append("file",file);const r=await fetch("/api/upload",{method:"POST",body:fd});const j=await r.json();if(!r.ok)throw new Error(j.error);photoName=j.key}await onSubmit({condition,damageDetails:damage,fineAmount:Number(fine),photoName})};
  return <Dialog open={!!loan} onOpenChange={v=>!v&&onOpen()}><DialogContent className="modal"><DialogHeader><DialogTitle>ตรวจรับอุปกรณ์</DialogTitle><DialogDescription>{loan?.request_code} • {loan?.borrower_name}</DialogDescription></DialogHeader><div className="return-form"><div className="return-summary"><Laptop/><div><b>{loan?.item_names}</b><span>{loan?.item_count} รายการ</span></div></div><label>สภาพหลังคืน<select value={condition} onChange={e=>setCondition(e.target.value)}><option value="normal">ปกติ</option><option value="minor">มีรอยเล็กน้อย</option><option value="damaged">ชำรุด</option></select></label><label>รายละเอียดความเสียหาย<textarea value={damage} onChange={e=>setDamage(e.target.value)} placeholder="ระบุรายละเอียด (ถ้ามี)"/></label><label>ค่าปรับ (บาท)<input type="number" min="0" value={fine} onChange={e=>setFine(e.target.value)}/></label><label className="upload"><Upload/><span>{file?.name||"แนบรูปภาพความเสียหาย (ไม่เกิน 8 MB)"}</span><input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]??null)}/></label></div><DialogFooter><button className="secondary" onClick={onOpen}>ยกเลิก</button><button className="primary" disabled={busy} onClick={()=>void submit()}>ยืนยันการคืน</button></DialogFooter></DialogContent></Dialog>
}
