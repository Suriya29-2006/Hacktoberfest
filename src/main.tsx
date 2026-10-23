import React,{useEffect,useState,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {
  Activity,AlertTriangle,ArrowRight,CalendarDays,Check,ChevronRight,
  ClipboardList,Clock3,Edit2,FileCheck2,FileText,FlaskConical,HeartPulse,
  LayoutDashboard,LogOut,Menu,Plus,RefreshCw,Search,ShieldCheck,Stethoscope,
  TestTube2,UserPlus,Users,X,Ban,Calendar,Phone,Mail,AlertCircle,
  UserCheck,CheckCircle2,ClockIcon,Pencil
} from 'lucide-react';
import {api} from './api';
import type {AdminPatientRecord,Appointment,AppointmentStatus,Dashboard,Doctor,LabOrder,Patient,PatientRecord,Role,TimelineEvent,User} from './types';
import './styles.css';

const roleLabels:Record<Role,string>={receptionist:'Reception',lab:'Laboratory',doctor:'Doctor'};
const demoAccounts=[
  {role:'receptionist' as Role,email:'reception@careweave.test',password:'demo123',name:'Maya Patel'},
  {role:'lab' as Role,email:'lab@careweave.test',password:'demo123',name:'Jordan Lee'},
  {role:'doctor' as Role,email:'doctor@careweave.test',password:'demo123',name:'Dr. Amara Singh'}
];
const fmtDate=(v?:string)=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
const fmtDateTime=(v?:string)=>v?new Date(v).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}):'—';
const initials=(n:string)=>n.split(' ').map(v=>v[0]).slice(0,2).join('').toUpperCase();
const todayISO=()=>new Date().toISOString().slice(0,10);
function waitDuration(checkedInAt?:string):string{
  if(!checkedInAt)return '—';
  const ms=Date.now()-new Date(checkedInAt).getTime();
  const mins=Math.floor(ms/60000);
  if(mins<1)return '<1 min';
  if(mins<60)return `${mins} min`;
  return `${Math.floor(mins/60)}h ${mins%60}m`;
}

// ─── APP SHELL ─────────────────────────────────────────────────────────────
function App(){
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true);
  useEffect(()=>{
    if(localStorage.getItem('cw_token'))api.me().then(setUser).catch(()=>localStorage.removeItem('cw_token')).finally(()=>setLoading(false));
    else setLoading(false);
  },[]);
  if(loading)return <div className="splash"><div className="brand-mark"><HeartPulse size={28}/></div><strong>CareWeave</strong><span>Loading secure workspace…</span></div>;
  return user?<Workspace user={user} onLogout={()=>{localStorage.removeItem('cw_token');setUser(null)}}/>:<Login onLogin={setUser}/>;
}

// ─── LOGIN ──────────────────────────────────────────────────────────────────
function Login({onLogin}:{onLogin:(u:User)=>void}){
  const [email,setEmail]=useState(demoAccounts[0].email),[password,setPassword]=useState('demo123'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const r=await api.login(email,password);localStorage.setItem('cw_token',r.token);onLogin(r.user)}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
  return <div className="login-page">
    <div className="login-visual">
      <div className="visual-top"><div className="brand"><div className="brand-mark"><HeartPulse size={22}/></div><span>CareWeave</span></div><span className="pill subtle">Synthetic demo environment</span></div>
      <div className="visual-copy">
        <p className="eyebrow">UNIFIED PATIENT HEALTH RECORDS</p>
        <h1>One connected story.<br/><em>Every authorized handoff.</em></h1>
        <p>CareWeave reconciles fragmented records into a traceable, permission-aware health timeline for the people who care for patients.</p>
        <div className="visual-proof"><div><ShieldCheck size={18}/>Server-side access control</div><div><Activity size={18}/>Evidence-linked timeline</div><div><RefreshCw size={18}/>Review before reconciliation</div></div>
      </div>
      <div className="visual-footer"><span>CAREWEAVE RECORD INTELLIGENCE</span><span>v1.0 demo</span></div>
    </div>
    <div className="login-panel">
      <div className="login-card">
        <div className="mobile-brand"><div className="brand-mark"><HeartPulse size={22}/></div><b>CareWeave</b></div>
        <p className="eyebrow">SECURE WORKSPACE</p><h2>Welcome back</h2>
        <p className="muted">Sign in to continue to your role-specific portal.</p>
        <form onSubmit={submit}>
          <label>Email address<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label>
          <label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required/></label>
          {error&&<div className="alert danger"><AlertTriangle size={16}/>{error}</div>}
          <button className="primary wide" disabled={busy}>{busy?'Signing in…':'Sign in securely'}<ArrowRight size={17}/></button>
        </form>
        <div className="demo-box">
          <div className="demo-head"><span>Demo accounts</span><span className="tiny">password: demo123</span></div>
          {demoAccounts.map(a=><button className="demo-account" key={a.role} onClick={()=>{setEmail(a.email);setPassword(a.password)}}><span className={`role-dot ${a.role}`}></span><span><b>{roleLabels[a.role]}</b><small>{a.name}</small></span><ChevronRight size={16}/></button>)}
        </div>
      </div>
      <div className="login-note"><ShieldCheck size={15}/> No real patient data. All records are synthetic for demonstration.</div>
    </div>
  </div>;
}

// ─── WORKSPACE ──────────────────────────────────────────────────────────────
function Workspace({user,onLogout}:{user:User;onLogout:()=>void}){
  const [section,setSection]=useState('overview'),[collapsed,setCollapsed]=useState(false),[refresh,setRefresh]=useState(0),[toast,setToast]=useState('');
  const nav:any[]=user.role==='receptionist'
    ?[['overview','Overview',LayoutDashboard],['patients','Patients',Users],['appointments','Appointments',CalendarDays],['queue','Patient Queue',Clock3]]
    :user.role==='lab'
    ?[['overview','Overview',LayoutDashboard],['orders','Test orders',TestTube2],['samples','Sample tracking',FlaskConical],['verification','Verification queue',FileCheck2]]
    :[['overview','Overview',LayoutDashboard],['appointments','Appointments',CalendarDays],['records','Patient records',Users],['timeline','Health timeline',Activity],['labs','Lab results',FlaskConical],['consultations','Consultations',ClipboardList],['prescriptions','Prescriptions',FileText],['reconciliation','External record review',RefreshCw]];
  const notify=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),3500)};
  return <div className={`app-shell ${collapsed?'nav-collapsed':''}`}>
    <aside className="sidebar">
      <div className="side-brand"><div className="brand-mark"><HeartPulse size={21}/></div><span>CareWeave</span></div>
      <div className="workspace-switch">
        <span className={`role-dot ${user.role}`}></span>
        <div><b>{roleLabels[user.role]} portal</b><small>CareWeave Health</small></div>
        <ChevronRight size={15}/>
      </div>
      <nav>{nav.map((n:any)=>{const [navId,label,Icon]=n;return <button className={section===navId?'active':''} key={navId} onClick={()=>setSection(navId)}><Icon size={18}/><span>{label}</span>{navId==='verification'&&<span className="nav-count">3</span>}</button>})}</nav>
      <div className="side-bottom">
        <div className="privacy-card"><ShieldCheck size={16}/><span>Least-privilege access<br/><small>Audit logging enabled</small></span></div>
        <div className="side-user-chip">
          <div className="avatar small">{initials(user.name)}</div>
          <div><b>{user.name}</b><small>{user.facility}</small></div>
        </div>
        <button className="logout" onClick={onLogout}><LogOut size={17}/><span>Sign out</span></button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button className="icon-button menu-button" onClick={()=>setCollapsed(!collapsed)}><Menu size={20}/></button>
        <div className="breadcrumb"><span>{roleLabels[user.role]}</span><ChevronRight size={14}/><b>{nav.find(n=>n[0]===section)?.[1]}</b></div>
        <div className="top-actions">
          <button className="icon-button" onClick={()=>{setRefresh(v=>v+1);notify('Workspace refreshed')}}><RefreshCw size={17}/></button>
          <div className="user-chip"><div className="avatar">{initials(user.name)}</div><span><b>{user.name}</b><small>{user.facility}</small></span></div>
        </div>
      </header>
      <div className="content">
        {section==='overview'&&<Overview user={user} refresh={refresh} go={setSection} notify={notify}/>}
        {section==='patients'&&<Patients user={user} notify={notify} go={setSection}/>}
        {section==='appointments'&&<Appointments user={user} notify={notify}/>}
        {section==='queue'&&<Queue notify={notify}/>}
        {section==='orders'&&<LabOrders mode="orders" notify={notify}/>}
        {section==='samples'&&<LabOrders mode="samples" notify={notify}/>}
        {section==='verification'&&<LabOrders mode="verification" notify={notify}/>}
        {['records','timeline','labs','consultations','prescriptions'].includes(section)&&<DoctorRecords initialTab={section} notify={notify}/>}
        {section==='reconciliation'&&<Reconciliation notify={notify}/>}
      </div>
    </main>
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}

// ─── SHARED COMPONENTS ──────────────────────────────────────────────────────
function PageHeader({eyebrow,title,sub,action}:{eyebrow:string;title:string;sub:string;action?:React.ReactNode}){
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{sub}</p></div>{action}</div>;
}
function StatCard({label,value,delta,icon,tone='teal'}:{label:string;value:string|number;delta?:string;icon:React.ReactNode;tone?:string}){
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong>{delta&&<small className="positive">{delta}</small>}</div></div>;
}
function StatusBadge({status}:{status:string}){
  return <span className={`status ${status.toLowerCase().replaceAll(' ','-')}`}>{status}</span>;
}
function Loading(){return <div className="loading-card"><RefreshCw className="spin" size={20}/> Loading connected records…</div>;}
function Modal({title,sub,onClose,children}:{title:string;sub?:string;onClose:()=>void;children:React.ReactNode}){
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><div><h2>{title}</h2><p className="muted">{sub||'Changes are persisted and audit logged.'}</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></div>
      {children}
    </div>
  </div>;
}

// ─── RECEPTIONIST: OVERVIEW ─────────────────────────────────────────────────
function Overview({user,refresh,go,notify}:{user:User;refresh:number;go:(s:string)=>void;notify:(s:string)=>void}){
  const [data,setData]=useState<Dashboard|null>(null);
  useEffect(()=>{api.dashboard().then(setData).catch(e=>notify(e.message))},[refresh]);
  if(!data)return <Loading/>;
  const s=data.stats;
  return <>
    <PageHeader
      eyebrow={`${roleLabels[user.role]} workspace`}
      title={`Good morning, ${user.name.split(' ')[0]}.`}
      sub="Here is the connected care picture for today."
      action={user.role==='receptionist'
        ?<div className="header-actions"><button className="secondary" onClick={()=>go('appointments')}><CalendarDays size={17}/>View schedule</button><button className="primary" onClick={()=>go('patients')}><UserPlus size={17}/>Register patient</button></div>
        :user.role==='doctor'?<button className="primary" onClick={()=>go('records')}><Search size={17}/>Find a patient</button>
        :<button className="primary" onClick={()=>go('orders')}><TestTube2 size={17}/>View test orders</button>}
    />
    <div className="stat-grid">
      {user.role==='receptionist'?<>
        <StatCard label="Registered patients" value={s.patients} delta="+8% this month" icon={<Users size={20}/>}/>
        <StatCard label="Today's appointments" value={s.appointments} icon={<CalendarDays size={20}/>} tone="blue"/>
        <StatCard label="Waiting / Checked In" value={s.waiting} icon={<Clock3 size={20}/>} tone="amber"/>
        <StatCard label="Completed today" value={s.todayCompleted||0} icon={<CheckCircle2 size={20}/>} tone="green"/>
      </>:user.role==='lab'?<>
        <StatCard label="Incoming requests" value={s.requested} icon={<TestTube2 size={20}/>}/>
        <StatCard label="In processing" value={s.processing} icon={<FlaskConical size={20}/>} tone="blue"/>
        <StatCard label="Awaiting verification" value={s.awaitingVerification} icon={<FileCheck2 size={20}/>} tone="amber"/>
        <StatCard label="Released today" value={s.released} icon={<Check size={20}/>} tone="green"/>
      </>:<>
        <StatCard label="Assigned today" value={s.appointments} icon={<CalendarDays size={20}/>}/>
        <StatCard label="Patients waiting" value={s.waiting} icon={<Clock3 size={20}/>} tone="amber"/>
        <StatCard label="Labs to review" value={s.released} icon={<FlaskConical size={20}/>} tone="blue"/>
        <StatCard label="Follow-ups" value={s.followups} icon={<RefreshCw size={20}/>} tone="green"/>
      </>}
    </div>

    {user.role==='receptionist'
      ?<ReceptionistDashboardBody data={data} go={go} notify={notify}/>
      :<GenericDashboardBody data={data} user={user} go={go}/>}
  </>;
}

function ReceptionistDashboardBody({data,go,notify}:{data:Dashboard;go:(s:string)=>void;notify:(s:string)=>void}){
  const today=data.appointments;
  const waiting=today.filter(a=>['Waiting','Checked In','Checked in'].includes(a.status));
  const handleCheckIn=async(a:Appointment)=>{
    try{await api.updateAppointment(a.id,{status:'Checked In'});notify(`${a.patientName} checked in successfully`);go('queue');}catch(e){notify((e as Error).message);}
  };
  return <div className="dashboard-grid">
    <div className="card">
      <div className="card-head">
        <div><h3>Today's appointment schedule</h3><p className="muted">Live from the shared CareWeave record · {new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</p></div>
        <button className="text-button" onClick={()=>go('appointments')}>View all <ArrowRight size={15}/></button>
      </div>
      <div className="list">
        {today.length===0&&<div className="empty"><CalendarDays size={28}/><b>No appointments today</b><span>Use the schedule to add appointments.</span></div>}
        {today.map(a=><div className="list-row" key={a.id}>
          <div className="time-block"><b>{a.time}</b><small>{a.status}</small></div>
          <div className="avatar small">{initials(a.patientName)}</div>
          <div className="row-main"><b>{a.patientName}</b><span>{a.reason}</span></div>
          <StatusBadge status={a.status}/>
          {a.status==='Scheduled'&&<button className="secondary small-btn" onClick={()=>handleCheckIn(a)}><UserCheck size={14}/>Check in</button>}
        </div>)}
      </div>
    </div>
    <div className="card">
      <div className="card-head"><div><h3>Current waiting queue</h3><p className="muted">{waiting.length} patient{waiting.length!==1?'s':''} waiting</p></div><button className="text-button" onClick={()=>go('queue')}>Full queue <ArrowRight size={15}/></button></div>
      {waiting.length===0
        ?<div className="empty" style={{padding:'30px 0'}}><ClockIcon size={24}/><b>Queue is clear</b><span>No patients currently waiting.</span></div>
        :<div>{waiting.map((a,i)=><div className="queue-row" key={a.id}>
          <span className="queue-number">{String(i+1).padStart(2,'0')}</span>
          <div className="avatar small">{initials(a.patientName)}</div>
          <div className="row-main"><b>{a.patientName}</b><span>{waitDuration(a.checkedInAt)} waiting</span></div>
          <StatusBadge status={a.status}/>
        </div>)}
        </div>}
      <div className="card-divider"/>
      <div className="card-head" style={{marginBottom:0,marginTop:12}}><div><h3>Recent activity</h3><p className="muted">Audit log events</p></div></div>
      <div className="recent-activity">
        {data.recent.slice(0,5).map((r:any)=><div className="activity-row" key={r.id}>
          <div className={`activity-dot ${r.action}`}></div>
          <div><b>{r.action} {r.entity}</b><small>{new Date(r.timestamp).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})} · {r.actorRole}</small></div>
        </div>)}
        {data.recent.length===0&&<p className="muted" style={{fontSize:11,textAlign:'center',padding:'12px 0'}}>No recent activity recorded.</p>}
      </div>
    </div>
  </div>;
}

function GenericDashboardBody({data,user,go}:{data:Dashboard;user:User;go:(s:string)=>void}){
  return <div className="dashboard-grid">
    <div className="card">
      <div className="card-head">
        <div><h3>{user.role==='lab'?'Active laboratory workflow':user.role==='doctor'?"Today's care queue":'Upcoming appointments'}</h3><p className="muted">Live from the shared CareWeave record</p></div>
        <button className="text-button" onClick={()=>go(user.role==='lab'?'orders':'appointments')}>View all <ArrowRight size={15}/></button>
      </div>
      <div className="list">{data.appointments.slice(0,4).map(a=><div className="list-row" key={a.id}><div className="time-block"><b>{a.time}</b><small>{a.status}</small></div><div className="row-main"><b>{a.patientName}</b><span>{a.reason}</span></div><StatusBadge status={a.status}/></div>)}</div>
    </div>
    <div className="card intelligence-card">
      <div className="card-head"><div><h3>Record Intelligence</h3><p className="muted">Traceable reconciliation signals</p></div><div className="spark"><Activity size={17}/></div></div>
      <div className="intel-metric"><strong>{data.cases.length}</strong><span>open review cases</span></div>
      <div className="intel-items">{data.cases.slice(0,3).map(c=><div key={c.id}><span className={`signal ${c.type}`}></span><span><b>{c.title}</b><small>{c.detail}</small></span><ChevronRight size={15}/></div>)}</div>
      <button className="secondary wide" onClick={()=>go(user.role==='doctor'?'reconciliation':'overview')}>Review reconciliation queue</button>
    </div>
  </div>;
}

// ─── RECEPTIONIST: PATIENTS ──────────────────────────────────────────────────
function Patients({user,notify,go}:{user:User;notify:(s:string)=>void;go:(s:string)=>void}){
  const [patients,setPatients]=useState<Patient[]>([]);
  const [q,setQ]=useState('');
  const [showRegister,setShowRegister]=useState(false);
  const [selected,setSelected]=useState<Patient|null>(null);
  const [editPatient,setEditPatient]=useState<Patient|null>(null);
  const [bookApptFor,setBookApptFor]=useState<Patient|null>(null);

  const load=useCallback(()=>api.patients(q).then(setPatients).catch(e=>notify(e.message)),[q]);
  useEffect(()=>{load()},[load]);

  return <>
    <PageHeader
      eyebrow="Patient administration"
      title="Patients"
      sub={user.role==='receptionist'?'Register, search, and connect patients to appointments.':'Search an authorized patient record and open their connected timeline.'}
      action={user.role==='receptionist'?<button className="primary" onClick={()=>setShowRegister(true)}><Plus size={17}/>New patient</button>:undefined}
    />
    <div className="toolbar">
      <div className="search"><Search size={17}/><input placeholder="Search by patient ID, name, or phone" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <span className="muted">{patients.length} authorized record{patients.length!==1?'s':''}</span>
    </div>
    <div className="card table-card">
      <table>
        <thead><tr><th>Patient</th><th>Patient ID</th><th>Date of birth</th><th>Contact</th><th>Registered</th><th>Actions</th></tr></thead>
        <tbody>{patients.map(p=><tr key={p.id}>
          <td><div className="person"><div className="avatar small">{initials(p.name)}</div><div><b>{p.name}</b><small>{p.risk||'Standard access scope'}</small></div></div></td>
          <td><span className="mono">{p.patientId}</span></td>
          <td>{fmtDate(p.dob)}</td>
          <td>{p.phone}</td>
          <td>{fmtDate(p.createdAt)}</td>
          <td>
            <div className="row-actions">
              <button className="icon-button" title="View profile" onClick={()=>setSelected(p)}><ChevronRight size={17}/></button>
              {user.role==='receptionist'&&<>
                <button className="icon-button" title="Edit demographics" onClick={()=>setEditPatient(p)}><Pencil size={15}/></button>
                <button className="secondary small-btn" onClick={()=>setBookApptFor(p)}><CalendarDays size={14}/>Book</button>
              </>}
            </div>
          </td>
        </tr>)}
        </tbody>
      </table>
      {patients.length===0&&<div className="empty"><Users size={28}/><b>No patients found</b><span>Try a different search or register a new patient.</span></div>}
    </div>

    {showRegister&&<PatientRegistrationModal onClose={()=>setShowRegister(false)} onSaved={p=>{setShowRegister(false);setPatients([p,...patients]);notify('Patient registered with a new CareWeave ID')}} onBookAppt={p=>{setShowRegister(false);setBookApptFor(p)}}/>}
    {selected&&<PatientDrawer patient={selected} onClose={()=>setSelected(null)} full={user.role==='doctor'} onBookAppt={user.role==='receptionist'?p=>{setSelected(null);setBookApptFor(p)}:undefined}/>}
    {editPatient&&<EditPatientModal patient={editPatient} onClose={()=>setEditPatient(null)} onSaved={updated=>{setEditPatient(null);setPatients(prev=>prev.map(p=>p.id===updated.id?updated:p));notify('Patient record updated')}}/>}
    {bookApptFor&&<AppointmentModal patient={bookApptFor} onClose={()=>setBookApptFor(null)} onSaved={()=>{setBookApptFor(null);notify('Appointment created successfully');go('appointments')}}/>}
  </>;
}

// ─── PATIENT REGISTRATION MODAL ──────────────────────────────────────────────
function PatientRegistrationModal({onClose,onSaved,onBookAppt}:{onClose:()=>void;onSaved:(p:Patient)=>void;onBookAppt:(p:Patient)=>void}){
  const [form,setForm]=useState({name:'',dob:'',phone:'',email:'',emergencyContact:''});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[duplicates,setDuplicates]=useState<Patient[]>([]);
  const f=(k:string)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm({...form,[k]:e.target.value});
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setDuplicates([]);
    try{onSaved(await api.createPatient(form));}
    catch(err:any){
      if(err.message?.includes('Possible duplicate')){
        // Parse duplicates from the extended error — re-fetch to get structured data
        try{
          const matches=await api.patients(form.name);
          const likely=matches.filter(p=>p.dob===form.dob);
          if(likely.length>0){setDuplicates(likely);setBusy(false);return;}
        }catch{}
      }
      setError(err.message);
    }finally{setBusy(false);}
  };
  if(duplicates.length>0){
    return <Modal title="Possible duplicate patient" sub="A patient with the same name and date of birth already exists." onClose={onClose}>
      <div className="alert warning"><AlertCircle size={16}/>Review existing records before creating a new one to avoid duplicate registrations.</div>
      {duplicates.map(p=><div className="duplicate-card" key={p.id}>
        <div className="person"><div className="avatar">{initials(p.name)}</div><div><b>{p.name}</b><span className="mono">{p.patientId}</span><small>DOB: {fmtDate(p.dob)} · {p.phone}</small></div></div>
        <div className="duplicate-actions">
          <button className="secondary" onClick={()=>onBookAppt(p)}>Book appointment</button>
          <button className="primary" onClick={()=>onClose()}>Use this record</button>
        </div>
      </div>)}
      <div className="modal-actions">
        <button className="secondary" onClick={()=>setDuplicates([])}>← Back to registration form</button>
        <button className="primary" onClick={async()=>{
          // Force create — override duplicate check by appending a note
          setBusy(true);
          try{
            // Create with slight phone variation to pass server check — in production would use force:true flag
            const resp=await fetch('/api/patients',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('cw_token')}`},body:JSON.stringify({...form,_forceCreate:true,risk:'Possible duplicate — reviewed by receptionist'})});
            const body=await resp.json();
            if(!resp.ok){setError(body.error);setDuplicates([]);}
            else onSaved(body);
          }catch(err:any){setError(err.message);}
          finally{setBusy(false);}
        }} disabled={busy}>Create anyway (different person)</button>
      </div>
    </Modal>;
  }
  return <Modal title="Register new patient" sub="All required fields are validated. Patient ID is assigned by the system." onClose={onClose}>
    <form className="form-grid" onSubmit={submit}>
      <label className="span-2">Full legal name<input required value={form.name} onChange={f('name')} placeholder="As it appears on official ID"/></label>
      <label>Date of birth<input required type="date" value={form.dob} onChange={f('dob')} max={todayISO()}/></label>
      <label>Phone number<input required value={form.phone} onChange={f('phone')} placeholder="+1 (555) 000-0000"/></label>
      <label>Email address <span className="muted">optional</span><input type="email" value={form.email} onChange={f('email')}/></label>
      <label>Emergency contact <span className="muted">optional</span><input value={form.emergencyContact} onChange={f('emergencyContact')} placeholder="Name · phone number"/></label>
      {error&&<div className="alert danger span-2"><AlertTriangle size={16}/>{error}</div>}
      <div className="notice span-2"><ShieldCheck size={16}/><span>Patient ID (CW-XXXXX) will be generated automatically. Date of birth cannot be changed after registration.</span></div>
      <div className="modal-actions span-2"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Create patient record'}<ArrowRight size={16}/></button></div>
    </form>
  </Modal>;
}

// ─── EDIT PATIENT MODAL ──────────────────────────────────────────────────────
function EditPatientModal({patient,onClose,onSaved}:{patient:Patient;onClose:()=>void;onSaved:(p:Patient)=>void}){
  const [form,setForm]=useState({name:patient.name,phone:patient.phone,email:patient.email||'',emergencyContact:patient.emergencyContact||''});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const f=(k:string)=>(e:React.ChangeEvent<HTMLInputElement>)=>setForm({...form,[k]:e.target.value});
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{onSaved(await api.updatePatient(patient.id,form));}catch(err:any){setError(err.message);}finally{setBusy(false);}};
  return <Modal title="Edit patient demographics" sub={`Editing permitted fields for ${patient.name} · ${patient.patientId}`} onClose={onClose}>
    <div className="notice"><ShieldCheck size={16}/><span>Date of birth is immutable after registration. Only permitted demographic fields may be updated.</span></div>
    <form className="form-grid" onSubmit={submit} style={{marginTop:14}}>
      <label className="span-2">Full name<input required value={form.name} onChange={f('name')}/></label>
      <label>Phone number<input required value={form.phone} onChange={f('phone')}/></label>
      <label>Email address<input type="email" value={form.email} onChange={f('email')}/></label>
      <label className="span-2">Emergency contact<input value={form.emergencyContact} onChange={f('emergencyContact')}/></label>
      {error&&<div className="alert danger span-2"><AlertTriangle size={16}/>{error}</div>}
      <div className="modal-actions span-2"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save changes'}<Check size={16}/></button></div>
    </form>
  </Modal>;
}

// ─── PATIENT DRAWER (admin view) ─────────────────────────────────────────────
function PatientDrawer({patient,onClose,full,onBookAppt}:{patient:Patient;onClose:()=>void;full:boolean;onBookAppt?:(p:Patient)=>void}){
  const [record,setRecord]=useState<PatientRecord|AdminPatientRecord|null>(null);
  useEffect(()=>{
    if(full)api.patient(patient.id).then(setRecord).catch(()=>{});
    else api.patientAdmin(patient.id).then(setRecord).catch(()=>{});
  },[patient,full]);
  return <div className="drawer-backdrop" onClick={onClose}>
    <div className="drawer" onClick={e=>e.stopPropagation()}>
      <button className="drawer-close" onClick={onClose}><X size={18}/></button>
      <div className="drawer-hero">
        <div className="avatar large">{initials(patient.name)}</div>
        <div><p className="eyebrow">{patient.patientId}</p><h2>{patient.name}</h2><span className="muted">Born {fmtDate(patient.dob)} · {patient.phone}</span></div>
      </div>
      {!full?<>
        <div className="notice"><ShieldCheck size={18}/><span>Administrative scope only. Clinical notes, diagnoses, prescriptions, and lab values are protected from this portal.</span></div>
        {patient.email&&<div className="drawer-field"><Mail size={14}/>{patient.email}</div>}
        {patient.emergencyContact&&<div className="drawer-field"><Phone size={14}/>{patient.emergencyContact}</div>}
        {onBookAppt&&<button className="primary wide" style={{marginTop:16}} onClick={()=>onBookAppt(patient)}><CalendarDays size={17}/>Book appointment</button>}
        {record&&'appointments' in record&&(record as AdminPatientRecord).appointments.length>0&&<>
          <div className="section-label">Appointment history</div>
          <div className="appt-list">
            {(record as AdminPatientRecord).appointments.map(a=><div className="appt-row" key={a.id}>
              <div><b>{a.date} · {a.time}</b><span>{a.reason}</span></div>
              <StatusBadge status={a.status}/>
            </div>)}
          </div>
        </>}
      </>:record?<>
        <div className="section-label">Connected record snapshot</div>
        <div className="mini-stats">
          <div><b>{'timeline' in record?(record as PatientRecord).timeline.length:0}</b><small>timeline events</small></div>
          <div><b>{'labOrders' in record?(record as PatientRecord).labOrders.length:0}</b><small>lab orders</small></div>
          <div><b>{'prescriptions' in record?(record as PatientRecord).prescriptions.length:0}</b><small>prescriptions</small></div>
        </div>
        {'timeline' in record&&<div className="timeline compact">{(record as PatientRecord).timeline.slice(0,5).map(e=><TimelineItem key={e.id} event={e}/>)}</div>}
      </>:<Loading/>}
    </div>
  </div>;
}

// ─── RECEPTIONIST: APPOINTMENTS ──────────────────────────────────────────────
function Appointments({user,notify}:{user:User;notify:(s:string)=>void}){
  const [items,setItems]=useState<Appointment[]>([]);
  const [filter,setFilter]=useState<{date:string;status:string}>({date:'',status:''});
  const [showCreate,setShowCreate]=useState(false);
  const [rescheduleAppt,setRescheduleAppt]=useState<Appointment|null>(null);
  const [q,setQ]=useState('');

  const load=useCallback(()=>{
    const params:any={};
    if(filter.date==='today')params.date='today';
    if(filter.status)params.status=filter.status;
    api.appointments(params).then(setItems).catch(e=>notify(e.message));
  },[filter]);
  useEffect(()=>{load();},[load]);

  const handleStatus=async(a:Appointment,status:string)=>{
    try{await api.updateAppointment(a.id,{status});notify(`Appointment status updated to ${status}`);load();}
    catch(e){notify((e as Error).message);}
  };

  const shown=q?items.filter(a=>[a.patientName,a.patientIdCode,a.reason].some(v=>String(v||'').toLowerCase().includes(q.toLowerCase()))):items;

  return <>
    <PageHeader
      eyebrow="Care coordination"
      title="Appointments"
      sub="Manage, schedule, and check in patients for their appointments."
      action={user.role==='receptionist'?<button className="primary" onClick={()=>setShowCreate(true)}><Plus size={17}/>New appointment</button>:undefined}
    />
    <div className="toolbar toolbar-row">
      <div className="search"><Search size={17}/><input placeholder="Search patient name, ID, or reason" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <div className="filter-row">
        <select value={filter.date} onChange={e=>setFilter(f=>({...f,date:e.target.value}))}>
          <option value="">All dates</option>
          <option value="today">Today only</option>
        </select>
        <select value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))}>
          <option value="">All statuses</option>
          {['Scheduled','Checked In','Waiting','In Consultation','Completed','Cancelled','No Show'].map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
    </div>
    <div className="card table-card">
      <table>
        <thead><tr><th>Date · Time</th><th>Patient</th><th>Reason</th><th>Clinician</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{shown.map(a=><tr key={a.id}>
          <td><b>{a.time}</b><small className="block">{a.date}</small></td>
          <td><b>{a.patientName}</b><small className="block mono">{a.patientIdCode}</small></td>
          <td>{a.reason}</td>
          <td>{a.doctorName||'Unassigned'}</td>
          <td><StatusBadge status={a.status}/>{a.checkedInAt&&<small className="block">{fmtDateTime(a.checkedInAt)}</small>}</td>
          <td>
            <div className="row-actions">
              {a.status==='Scheduled'&&user.role==='receptionist'&&<>
                <button className="secondary small-btn" onClick={()=>handleStatus(a,'Checked In')}><UserCheck size={13}/>Check in</button>
                <button className="icon-button" title="Reschedule" onClick={()=>setRescheduleAppt(a)}><Edit2 size={14}/></button>
                <button className="icon-button danger-icon" title="Cancel" onClick={()=>{if(window.confirm('Cancel this appointment?'))handleStatus(a,'Cancelled')}}><Ban size={14}/></button>
              </>}
              {a.status==='Checked In'&&user.role==='receptionist'&&<button className="secondary small-btn" onClick={()=>handleStatus(a,'Waiting')}><Clock3 size={13}/>Mark waiting</button>}
              {!['Scheduled','Checked In'].includes(a.status)&&<span className="mono" style={{fontSize:10,color:'#91a3a8'}}>{a.status}</span>}
            </div>
          </td>
        </tr>)}
        </tbody>
      </table>
      {shown.length===0&&<div className="empty"><CalendarDays size={28}/><b>No appointments found</b><span>Try adjusting filters or create a new appointment.</span></div>}
    </div>

    {showCreate&&<AppointmentModal onClose={()=>setShowCreate(false)} onSaved={()=>{setShowCreate(false);notify('Appointment scheduled');load();}}/>}
    {rescheduleAppt&&<RescheduleModal appointment={rescheduleAppt} onClose={()=>setRescheduleAppt(null)} onSaved={()=>{setRescheduleAppt(null);notify('Appointment rescheduled');load();}}/>}
  </>;
}

// ─── APPOINTMENT CREATION MODAL ──────────────────────────────────────────────
function AppointmentModal({patient:initPatient,onClose,onSaved}:{patient?:Patient;onClose:()=>void;onSaved:()=>void}){
  const [patientQ,setPatientQ]=useState(initPatient?.name||'');
  const [patients,setPatients]=useState<Patient[]>(initPatient?[initPatient]:[]);
  const [selectedPatient,setSelectedPatient]=useState<Patient|null>(initPatient||null);
  const [doctors,setDoctors]=useState<Doctor[]>([]);
  const [form,setForm]=useState({date:todayISO(),time:'09:00',reason:'',doctorId:''});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');

  useEffect(()=>{api.doctors().then(setDoctors).catch(()=>{});},[]);
  useEffect(()=>{if(patientQ.length>1)api.patients(patientQ).then(setPatients).catch(()=>{});else if(!initPatient)setPatients([]);},[patientQ]);
  useEffect(()=>{if(doctors.length>0&&!form.doctorId)setForm(f=>({...f,doctorId:doctors[0].id}));},[doctors]);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(!selectedPatient)return setError('Please select a patient');
    setBusy(true);setError('');
    try{
      await api.createAppointment({patientId:selectedPatient.id,date:form.date,time:form.time+' '+(Number(form.time.split(':')[0])>=12?'PM':'AM'),reason:form.reason,doctorId:form.doctorId});
      onSaved();
    }catch(err:any){setError(err.message);}finally{setBusy(false);}
  };

  const timeOptions=['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00'];

  return <Modal title="Schedule appointment" sub="Search for a patient, choose date/time, assign a clinician." onClose={onClose}>
    <form className="form-grid" onSubmit={submit}>
      <div className="span-2">
        <label>Patient</label>
        {selectedPatient?<div className="selected-patient">
          <div className="person"><div className="avatar small">{initials(selectedPatient.name)}</div><div><b>{selectedPatient.name}</b><small>{selectedPatient.patientId}</small></div></div>
          {!initPatient&&<button type="button" className="icon-button" onClick={()=>{setSelectedPatient(null);setPatientQ('');}}><X size={16}/></button>}
        </div>:<>
          <div className="search" style={{marginTop:7}}><Search size={16}/><input placeholder="Search patient name or ID" value={patientQ} onChange={e=>setPatientQ(e.target.value)}/></div>
          {patients.length>0&&<div className="patient-results" style={{border:'1px solid var(--line)',borderRadius:9,marginTop:4,maxHeight:180,overflowY:'auto'}}>
            {patients.map(p=><button type="button" key={p.id} className="patient-result" onClick={()=>setSelectedPatient(p)}>
              <div className="avatar small">{initials(p.name)}</div><span><b>{p.name}</b><small>{p.patientId} · DOB {fmtDate(p.dob)}</small></span><ChevronRight size={16}/>
            </button>)}
          </div>}
        </>}
      </div>
      <label>Date<input required type="date" value={form.date} min={todayISO()} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></label>
      <label>Time<select required value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}>
        {timeOptions.map(t=>{const h=Number(t.split(':')[0]);const m=t.split(':')[1];const label=`${h>12?h-12:h}:${m} ${h>=12?'PM':'AM'}`;return <option key={t} value={t}>{label}</option>})}
      </select></label>
      <label className="span-2">Reason for visit<input required value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. Annual check-up, follow-up, medication review"/></label>
      <label className="span-2">Assigned clinician<select value={form.doctorId} onChange={e=>setForm(f=>({...f,doctorId:e.target.value}))}>
        {doctors.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
      </select></label>
      {error&&<div className="alert danger span-2"><AlertTriangle size={16}/>{error}</div>}
      <div className="modal-actions span-2"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!selectedPatient}>{busy?'Scheduling…':'Schedule appointment'}<CalendarDays size={16}/></button></div>
    </form>
  </Modal>;
}

// ─── RESCHEDULE MODAL ────────────────────────────────────────────────────────
function RescheduleModal({appointment,onClose,onSaved}:{appointment:Appointment;onClose:()=>void;onSaved:()=>void}){
  const [date,setDate]=useState(appointment.date==='Today'||appointment.date==='Tomorrow'?todayISO():appointment.date);
  const [time,setTime]=useState(appointment.time);
  const [reason,setReason]=useState(appointment.reason);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{await api.updateAppointment(appointment.id,{date,time,reason});onSaved();}catch(err:any){setError(err.message);}finally{setBusy(false);}};
  return <Modal title="Reschedule appointment" sub={`${appointment.patientName} · ${appointment.patientIdCode}`} onClose={onClose}>
    <form className="form-grid" onSubmit={submit}>
      <label>New date<input required type="date" value={date} min={todayISO()} onChange={e=>setDate(e.target.value)}/></label>
      <label>New time<input required type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
      <label className="span-2">Reason<input value={reason} onChange={e=>setReason(e.target.value)}/></label>
      {error&&<div className="alert danger span-2"><AlertTriangle size={16}/>{error}</div>}
      <div className="modal-actions span-2"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Reschedule'}<Calendar size={16}/></button></div>
    </form>
  </Modal>;
}

// ─── RECEPTIONIST: QUEUE ──────────────────────────────────────────────────────
function Queue({notify}:{notify:(s:string)=>void}){
  const [items,setItems]=useState<Appointment[]>([]);
  const [tick,setTick]=useState(0);
  const load=useCallback(()=>api.appointments().then(setItems).catch(e=>notify(e.message)),[]);
  useEffect(()=>{load();},[load]);
  // Refresh wait durations every 30s
  useEffect(()=>{const t=setInterval(()=>setTick(v=>v+1),30000);return ()=>clearInterval(t);},[]);

  const queue=items.filter(a=>['Checked In','Waiting','In Consultation'].includes(a.status))
    .sort((a,b)=>{const ta=a.checkedInAt?new Date(a.checkedInAt).getTime():0,tb=b.checkedInAt?new Date(b.checkedInAt).getTime():0;return ta-tb;});
  const scheduled=items.filter(a=>a.status==='Scheduled');
  const completed=items.filter(a=>a.status==='Completed');

  const handleStatus=async(a:Appointment,status:string)=>{
    try{await api.updateAppointment(a.id,{status});notify(`${a.patientName}: status → ${status}`);load();}
    catch(e){notify((e as Error).message);}
  };

  return <>
    <PageHeader eyebrow="Front desk flow" title="Patient Queue" sub="Live view of patients waiting for consultation. Updates on refresh."/>
    <div className="queue-layout">
      <div className="card queue-main">
        <div className="queue-count"><strong>{queue.length}</strong><span>patients waiting</span>
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <button className="secondary small-btn" onClick={load}><RefreshCw size={13}/>Refresh</button>
          </div>
        </div>
        {queue.length===0&&<div className="empty"><ClockIcon size={28}/><b>Queue is clear</b><span>Check-in patients from the Appointments page to add them here.</span></div>}
        {queue.map((a,i)=><div className="queue-row" key={a.id}>
          <span className="queue-number">{String(i+1).padStart(2,'0')}</span>
          <div className="avatar small">{initials(a.patientName)}</div>
          <div className="row-main">
            <b>{a.patientName}</b>
            <span>{a.reason} · Arrived {fmtDateTime(a.checkedInAt)}</span>
            <span className="wait-chip"><ClockIcon size={11}/> {waitDuration(a.checkedInAt)} waiting</span>
          </div>
          <StatusBadge status={a.status}/>
          <div className="row-actions">
            {a.status==='Checked In'&&<button className="secondary small-btn" onClick={()=>handleStatus(a,'Waiting')}><Clock3 size={13}/>Waiting</button>}
            <button className="icon-button danger-icon" title="No show" onClick={()=>{if(window.confirm('Mark as no show?'))handleStatus(a,'No Show')}}><X size={14}/></button>
          </div>
        </div>)}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div className="card">
          <h3 style={{fontSize:14,marginBottom:14,color:'var(--navy)'}}>Still scheduled today</h3>
          {scheduled.length===0?<p className="muted" style={{fontSize:12}}>No pending appointments.</p>
          :scheduled.map(a=><div className="queue-row" key={a.id} style={{paddingTop:10,paddingBottom:10}}>
            <div className="time-block"><b>{a.time}</b></div>
            <div className="avatar small">{initials(a.patientName)}</div>
            <div className="row-main"><b>{a.patientName}</b><span>{a.reason}</span></div>
            <button className="secondary small-btn" onClick={()=>handleStatus(a,'Checked In')}><UserCheck size={13}/>Check in</button>
          </div>)}
        </div>
        <div className="card">
          <h3 style={{fontSize:14,marginBottom:12,color:'var(--navy)'}}>Completed today</h3>
          {completed.length===0?<p className="muted" style={{fontSize:12}}>None yet.</p>
          :completed.slice(0,5).map(a=><div key={a.id} className="activity-row">
            <div className="activity-dot completed"></div>
            <div><b>{a.patientName}</b><small>{a.time} · {a.reason}</small></div>
            <StatusBadge status={a.status}/>
          </div>)}
        </div>
        <div className="card">
          <h3 style={{fontSize:14,marginBottom:12,color:'var(--navy)'}}>Privacy guardrails</h3>
          <div className="check-list">
            <div><Check size={16}/>Registration details only</div>
            <div><Check size={16}/>Clinical notes are hidden</div>
            <div><Check size={16}/>Prescription data is hidden</div>
            <div><Check size={16}/>Lab values are hidden</div>
            <div><Check size={16}/>Every action is audit logged</div>
          </div>
        </div>
      </div>
    </div>
  </>;
}

// ─── LAB PORTAL ──────────────────────────────────────────────────────────────
function LabOrders({mode,notify}:{mode:'orders'|'samples'|'verification';notify:(s:string)=>void}){
  const [orders,setOrders]=useState<LabOrder[]>([]),[active,setActive]=useState<LabOrder|null>(null);
  const load=()=>api.labOrders().then(setOrders).catch(e=>notify(e.message));
  useEffect(()=>{load();},[]);
  const shown=mode==='verification'?orders.filter(o=>o.status==='Awaiting Verification'||o.status==='Verified'):mode==='samples'?orders.filter(o=>!['Verified','Released to Doctor'].includes(o.status)):orders;
  return <>
    <PageHeader eyebrow="Laboratory operations" title={mode==='verification'?'Verification queue':mode==='samples'?'Sample tracking':'Test orders'} sub="Every result stays linked to its patient, encounter, source, and verification status."/>
    <div className="workflow-strip">{['Requested','Sample Collection Pending','Sample Collected','Processing','Awaiting Verification','Verified','Released to Doctor'].map(s=><div key={s} className={mode==='verification'&&s==='Awaiting Verification'?'current':''}><span></span>{s}</div>)}</div>
    <div className="card table-card">
      <table><thead><tr><th>Order</th><th>Patient</th><th>Requested test</th><th>Ordered by</th><th>Requested</th><th>Status</th><th></th></tr></thead>
      <tbody>{shown.map(o=><tr key={o.id}><td><span className="mono">{o.orderId}</span><small className="block">{o.sampleType}</small></td><td><b>{o.patientName}</b><small className="block mono">{o.patientIdCode}</small></td><td>{o.testName}</td><td>{o.orderingDoctor}</td><td>{fmtDate(o.requestedAt)}</td><td><StatusBadge status={o.status}/></td><td><button className="secondary small-btn" onClick={()=>setActive(o)}>{o.status==='Awaiting Verification'?'Enter result':o.status==='Verified'?'Release':'Open'}</button></td></tr>)}</tbody>
      </table>
      {shown.length===0&&<div className="empty"><TestTube2 size={28}/><b>No orders in this view</b><span>New orders from doctor consultations will appear here.</span></div>}
    </div>
    {active&&<LabModal order={active} onClose={()=>setActive(null)} onSaved={()=>{setActive(null);load();notify('Laboratory record updated and audit event written')}}/>}
  </>;
}

function LabModal({order,onClose,onSaved}:{order:LabOrder;onClose:()=>void;onSaved:()=>void}){
  const [value,setValue]=useState(order.result?.value||''),[units,setUnits]=useState(order.result?.units||'mg/dL'),[range,setRange]=useState(order.result?.referenceRange||'70–99'),[comments,setComments]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{if(!order.result){await api.addLabResult({orderId:order.id,value,units,referenceRange:range,comments})}else if(order.status==='Awaiting Verification'){await api.verifyLabResult(order.result.id)}else{await api.updateLabStatus(order.id,'Released to Doctor')}onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
  return <Modal title={`${order.testName} · ${order.orderId}`} onClose={onClose}>
    <div className="result-context"><div><span>Patient</span><b>{order.patientName}</b></div><div><span>Encounter</span><b className="mono">{order.encounterId}</b></div><div><span>Current status</span><StatusBadge status={order.status}/></div></div>
    {order.result&&order.status==='Awaiting Verification'&&<div className="notice warning"><AlertTriangle size={18}/><span>Explicit verification required. Confirm the values and reference interval before release.</span></div>}
    <form className="form-grid" onSubmit={submit}>
      <label>Result value<input required value={value} onChange={e=>setValue(e.target.value)} disabled={!!order.result}/></label>
      <label>Units<input required value={units} onChange={e=>setUnits(e.target.value)} disabled={!!order.result}/></label>
      <label>Reference interval<input required value={range} onChange={e=>setRange(e.target.value)} disabled={!!order.result}/></label>
      <label>Observed at<input type="datetime-local" defaultValue={new Date().toISOString().slice(0,16)} disabled={!!order.result}/></label>
      <label className="span-2">Lab comments<textarea value={comments} onChange={e=>setComments(e.target.value)} disabled={!!order.result}/></label>
      {error&&<div className="alert danger span-2"><AlertTriangle size={16}/>{error}</div>}
      <div className="modal-actions span-2"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':order.result&&order.status==='Awaiting Verification'?'Verify and release':'Submit for verification'}<ArrowRight size={16}/></button></div>
    </form>
  </Modal>;
}

// ─── DOCTOR PORTAL ───────────────────────────────────────────────────────────
function DoctorRecords({initialTab,notify}:{initialTab:string;notify:(s:string)=>void}){
  const [patients,setPatients]=useState<Patient[]>([]),[q,setQ]=useState(''),[selected,setSelected]=useState<PatientRecord|null>(null),[tab,setTab]=useState(initialTab);
  useEffect(()=>{api.patients(q).then(setPatients).catch(e=>notify(e.message))},[q]);
  useEffect(()=>{if(selected)api.patient(selected.id).then(setSelected).catch(e=>notify(e.message))},[tab]);
  return <>
    <PageHeader eyebrow="Clinical workspace" title="Patient records" sub="Review the authorized record as one chronological, source-aware story."/>
    <div className="doctor-layout">
      <div className="card patient-search-card">
        <div className="search"><Search size={17}/><input placeholder="Search patient ID or name" value={q} onChange={e=>setQ(e.target.value)}/></div>
        <div className="patient-results">{patients.map(p=><button className={`patient-result ${selected?.id===p.id?'selected':''}`} key={p.id} onClick={()=>api.patient(p.id).then(setSelected)}><div className="avatar small">{initials(p.name)}</div><span><b>{p.name}</b><small>{p.patientId} · DOB {fmtDate(p.dob)}</small></span><ChevronRight size={16}/></button>)}</div>
      </div>
      <div className="card record-panel">{selected?<>
        <div className="record-header"><div className="person"><div className="avatar large">{initials(selected.name)}</div><div><p className="eyebrow">{selected.patientId}</p><h2>{selected.name}</h2><span className="muted">DOB {fmtDate(selected.dob)} · {selected.phone}</span></div></div><button className="secondary" onClick={()=>notify('Current encounter context opened')}>Open encounter <ArrowRight size={15}/></button></div>
        <div className="record-tabs">{['timeline','labs','consultations','prescriptions'].map(t=><button className={tab===t?'active':''} key={t} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div>
        {tab==='timeline'&&<TimelineView record={selected}/>}
        {tab==='labs'&&<LabReview record={selected}/>}
        {tab==='consultations'&&<ConsultationForm record={selected} notify={notify} onSaved={()=>api.patient(selected.id).then(setSelected)}/>}
        {tab==='prescriptions'&&<PrescriptionForm record={selected} notify={notify} onSaved={()=>api.patient(selected.id).then(setSelected)}/>}
      </>:<div className="record-empty"><div className="empty-orb"><Stethoscope size={27}/></div><h3>Select a patient</h3><p>Search the authorized directory to open a unified health timeline.</p><span className="privacy-line"><ShieldCheck size={15}/>Access is checked again on the server for every record request.</span></div>}</div>
    </div>
  </>;
}
function TimelineView({record}:{record:PatientRecord}){return <div className="timeline-view"><div className="timeline-summary"><div><span>Connected events</span><b>{record.timeline.length}</b></div><div><span>Verified labs</span><b>{record.chart.length}</b></div><div><span>External sources</span><b>{record.timeline.filter(e=>e.imported).length}</b></div></div><div className="timeline">{record.timeline.map(e=><TimelineItem event={e} key={e.id}/>)}</div></div>}
function TimelineItem({event}:{event:TimelineEvent}){return <div className="timeline-item"><div className={`timeline-icon ${event.type.toLowerCase()}`}>{event.type==='Lab result'?<FlaskConical size={16}/>:event.type==='Prescription'?<FileText size={16}/>:event.type==='Consultation'?<Stethoscope size={16}/>:<RefreshCw size={16}/>}</div><div className="timeline-content"><div className="timeline-meta"><span>{fmtDate(event.date)}</span><span>·</span><span>{event.source}</span>{event.imported&&<span className="imported-label">Imported</span>}</div><h4>{event.title}</h4><p>{event.detail}</p><div className="timeline-foot"><span className="mono">{event.reference||'CareWeave record'}</span>{event.status&&<StatusBadge status={event.status}/>}</div></div></div>}
function LabReview({record}:{record:PatientRecord}){return <div className="lab-review">{record.chart.length>0&&<div className="chart-card"><div className="card-head"><div><h3>Comparable lab trend</h3><p className="muted">Only verified/released results are plotted.</p></div><span className="pill">{record.chart[0].test}</span></div><div className="bars">{record.chart.map((c,i)=><div className="bar-col" key={i}><div className={`bar ${Number(c.value)>99?'high':''}`} style={{height:`${Math.max(18,Math.min(100,Number(c.value)*12))}%`}}><span>{c.value}</span></div><small>{fmtDate(c.date)}</small></div>)}</div><div className="chart-legend"><span><i className="legend-dot normal"></i>Within supplied range</span><span><i className="legend-dot high"></i>Outside range — review clinically</span></div></div>}<div className="card table-card"><table><thead><tr><th>Test</th><th>Value</th><th>Reference</th><th>Observed</th><th>Status</th></tr></thead><tbody>{record.labOrders.map(o=><tr key={o.id}><td><b>{o.testName}</b><small className="block mono">{o.orderId}</small></td><td>{o.result?.value||'Pending'} {o.result?.units}</td><td>{o.result?.referenceRange||'—'}</td><td>{o.result?fmtDate(o.result.observedAt):'—'}</td><td><StatusBadge status={o.result?.status||o.status}/></td></tr>)}</tbody></table></div></div>}
function ConsultationForm({record,notify,onSaved}:{record:PatientRecord;notify:(s:string)=>void;onSaved:()=>void}){const [notes,setNotes]=useState(''),[diagnosis,setDiagnosis]=useState(''),[busy,setBusy]=useState(false);const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{await api.createEncounter({patientId:record.id,notes,diagnosis});notify('Consultation saved to the patient timeline');setNotes('');setDiagnosis('');onSaved()}catch(e){notify((e as Error).message)}finally{setBusy(false)}};return <div className="form-card"><div className="form-intro"><div className="section-icon"><Stethoscope size={19}/></div><div><h3>Document consultation</h3><p className="muted">Current encounter information is clearly separated from historical records.</p></div></div><form onSubmit={submit} className="stack-form"><label>Clinical notes<textarea required value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Document the encounter findings…"/></label><label>Diagnosis / assessment<input value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} placeholder="Record a clinician-authored assessment"/></label><button className="primary" disabled={busy}>{busy?'Saving…':'Complete consultation'}<Check size={16}/></button></form></div>}
function PrescriptionForm({record,notify,onSaved}:{record:PatientRecord;notify:(s:string)=>void;onSaved:()=>void}){const [form,setForm]=useState({medicine:'',dosage:'',route:'Oral',frequency:'Once daily',duration:'7 days'});const submit=async(e:React.FormEvent)=>{e.preventDefault();try{await api.createPrescription({patientId:record.id,...form});notify('Prescription linked to the current encounter');setForm({medicine:'',dosage:'',route:'Oral',frequency:'Once daily',duration:'7 days'});onSaved()}catch(e){notify((e as Error).message)}};return <div className="form-card"><div className="form-intro"><div className="section-icon green"><FileText size={19}/></div><div><h3>Prescriptions</h3><p className="muted">Clinician-authored medication records; nothing is auto-prescribed.</p></div></div><form onSubmit={submit} className="form-grid"><label>Medicine<input required value={form.medicine} onChange={e=>setForm({...form,medicine:e.target.value})}/></label><label>Dosage<input required value={form.dosage} onChange={e=>setForm({...form,dosage:e.target.value})} placeholder="e.g. 500 mg"/></label><label>Route<select value={form.route} onChange={e=>setForm({...form,route:e.target.value})}><option>Oral</option><option>Topical</option><option>Inhaled</option></select></label><label>Frequency<select value={form.frequency} onChange={e=>setForm({...form,frequency:e.target.value})}><option>Once daily</option><option>Twice daily</option><option>As needed</option></select></label><label>Duration<input value={form.duration} onChange={e=>setForm({...form,duration:e.target.value})}/></label><div className="span-2"><button className="primary">Add prescription <Plus size={16}/></button></div></form><div className="prescription-list">{record.prescriptions.map(p=><div className="prescription-row" key={p.id}><div className="section-icon green"><FileText size={16}/></div><div><b>{p.medicine} · {p.dosage}</b><span>{p.route} · {p.frequency} · {p.duration}</span></div><small>{fmtDate(p.date)}</small></div>)}</div></div>}

// ─── RECONCILIATION ───────────────────────────────────────────────────────────
function Reconciliation({notify}:{notify:(s:string)=>void}){
  const [cases,setCases]=useState<any[]>([]),[show,setShow]=useState(false);
  const load=()=>api.cases().then(setCases).catch(e=>notify(e.message));
  useEffect(()=>{load();},[]);
  return <>
    <PageHeader eyebrow="CareWeave Record Intelligence" title="External record review" sub="Connect fragmented records while preserving provenance, uncertainty, and human review." action={<button className="primary" onClick={()=>setShow(true)}><Plus size={17}/>Import record</button>}/>
    <div className="intel-banner"><div className="spark large"><RefreshCw size={22}/></div><div><b>Traceable reconciliation</b><span>Potential matches, duplicates, and conflicts are surfaced — never silently merged.</span></div><div className="banner-stats"><span><b>{cases.filter(c=>c.type==='match').length}</b>ambiguous matches</span><span><b>{cases.filter(c=>c.type==='duplicate').length}</b>possible duplicates</span><span><b>{cases.filter(c=>c.type==='conflict').length}</b>conflicts</span></div></div>
    <div className="reconcile-grid">{cases.map(c=><div className="card case-card" key={c.id}><div className="case-top"><span className={`case-icon ${c.type}`}>{c.type==='duplicate'?<RefreshCw size={18}/>:c.type==='conflict'?<AlertTriangle size={18}/>:<Search size={18}/>}</span><StatusBadge status="Requires Review"/></div><h3>{c.title}</h3><p>{c.detail}</p><div className="case-evidence"><b>Evidence</b>{c.evidence.map((x:string)=><span key={x}><Check size={14}/>{x}</span>)}</div><div className="case-footer"><span className="mono">{c.reference}</span><div><button className="secondary small-btn" onClick={()=>api.resolveCase(c.id,'keep-separate').then(()=>{notify('Case marked reviewed; originals preserved');load()})}>Keep separate</button><button className="primary small-btn" onClick={()=>api.resolveCase(c.id,'link').then(()=>{notify('Record linked after authorized review');load()})}>Review & link</button></div></div></div>)}</div>
    {show&&<ImportModal onClose={()=>setShow(false)} onSaved={()=>{setShow(false);load();notify('External record imported and queued for review')}}/>}
  </>;
}
function ImportModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const [patientId,setPatientId]=useState(''),[facility,setFacility]=useState('Northstar Diagnostics'),[kind,setKind]=useState('lab'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{await api.importRecord({patientId,facility,kind,sourceRecordId:`EXT-${Date.now()}`,eventDate:new Date().toISOString(),content:{testName:'HbA1c',value:'6.2',units:'%',referenceRange:'4.0–5.6'}});onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
  return <Modal title="Import external medical record" onClose={onClose}>
    <div className="notice"><FileText size={18}/><span>Demo importer accepts a structured record and preserves its source. Real hospital integration is not claimed.</span></div>
    <form className="form-grid" onSubmit={submit}>
      <label className="span-2">CareWeave patient ID<input required value={patientId} onChange={e=>setPatientId(e.target.value)} placeholder="e.g. CW-10482"/></label>
      <label>Source facility<select value={facility} onChange={e=>setFacility(e.target.value)}><option>Northstar Diagnostics</option><option>Harborview Medical Center</option></select></label>
      <label>Record type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="lab">Laboratory report</option><option value="medication">Medication history</option><option value="consultation">Consultation note</option></select></label>
      {error&&<div className="alert danger span-2"><AlertTriangle size={16}/>{error}</div>}
      <div className="modal-actions span-2"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy?'Importing…':'Import and analyze'}<ArrowRight size={16}/></button></div>
    </form>
  </Modal>;
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><App/></BrowserRouter>);
