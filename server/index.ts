import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { ensureSeed } from './seed.js';

const app=express(); const PORT=Number(process.env.PORT||4000); const DATA=path.resolve('data/careweave.json');
app.use(cors({origin:process.env.CLIENT_ORIGIN||'http://localhost:5173'})); app.use(express.json({limit:'2mb'}));
let db:any; const sessions=new Map<string,{userId:string;expires:number}>();
const now=()=>new Date().toISOString(); const id=(prefix:string)=>`${prefix}-${crypto.randomBytes(4).toString('hex')}`;
async function save(){await fs.writeFile(DATA,JSON.stringify(db,null,2))}
function user(req:any){const raw=String(req.headers.authorization||'').replace('Bearer ','');const s=sessions.get(raw);if(!s||s.expires<Date.now())return null;return db.users.find((u:any)=>u.id===s.userId)||null}
function auth(req:any,res:any,next:any){const u=user(req);if(!u)return res.status(401).json({error:'Authentication required'});req.user=u;next()}
function roles(...allowed:string[]){return (req:any,res:any,next:any)=>{if(!allowed.includes(req.user.role))return res.status(403).json({error:'This action is not permitted for your role'});next()}}
function audit(req:any,action:string,entity:string,entityId:string,detail=''){db.auditLogs.push({id:id('audit'),actorId:req.user.id,actorRole:req.user.role,action,entity,entityId,detail,timestamp:now()});}
function patientById(value:string){return db.patients.find((p:any)=>p.id===value||p.patientId===value)}
function isoToday(){return new Date().toISOString().slice(0,10)} // YYYY-MM-DD
function isToday(dateStr:string){if(!dateStr)return false; if(dateStr==='Today')return true; return dateStr.slice(0,10)===isoToday()}
function timelineFor(patientId:string){
  const events:any[]=[];
  db.encounters.filter((e:any)=>e.patientId===patientId).forEach((e:any)=>events.push({id:e.id,type:'Consultation',date:e.date,title:e.diagnosis||'Clinical consultation',detail:e.notes||'Encounter recorded in CareWeave.',source:e.source||'CareWeave Clinic',reference:e.id,imported:e.imported}));
  db.labOrders.filter((o:any)=>o.patientId===patientId).forEach((o:any)=>events.push({id:o.id,type:'Lab result',date:o.result?.observedAt||o.requestedAt,title:o.testName,detail:o.result?`${o.result.value} ${o.result.units} · reference ${o.result.referenceRange}`:'Order requested; result pending.',source:o.result?.verifiedBy||'CareWeave Diagnostics',reference:o.orderId,status:o.result?.status||o.status}));
  db.prescriptions.filter((r:any)=>r.patientId===patientId).forEach((r:any)=>events.push({id:r.id,type:'Prescription',date:r.date,title:`${r.medicine} · ${r.dosage}`,detail:`${r.route} · ${r.frequency} · ${r.duration}${r.status&&r.status!=='Active'?` [${r.status}]`:''}`,source:r.source||'CareWeave Clinic',reference:r.id,imported:r.imported}));
  db.externalRecords.filter((r:any)=>r.patientId===patientId).forEach((r:any)=>events.push({id:r.id,type:'Imported record',date:r.eventDate,title:`${r.kind} from ${r.facility}`,detail:`Source ${r.sourceRecordId} · import status ${r.status}`,source:r.facility,reference:r.sourceRecordId,imported:true,status:r.status}));
  if(db.referrals)db.referrals.filter((rf:any)=>rf.patientId===patientId).forEach((rf:any)=>events.push({id:rf.id,type:'Referral',date:rf.date,title:`Referral: ${rf.specialty}`,detail:`${rf.providerName} · ${rf.reason}`,source:'CareWeave Clinic',reference:rf.id,status:rf.status}));
  if(db.vitals)db.vitals.filter((vt:any)=>vt.patientId===patientId).forEach((vt:any)=>events.push({id:vt.id,type:'Vitals',date:vt.date,title:`Vitals Check: BP ${vt.bpSystolic}/${vt.bpDiastolic}`,detail:`HR ${vt.heartRate} bpm · SpO2 ${vt.spo2}% · Temp ${vt.tempF}°F · BMI ${vt.bmi}`,source:vt.recordedBy||'CareWeave Clinic',reference:vt.id}));
  return events.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime())
}
function chartFor(patientId:string){return db.labOrders.filter((o:any)=>o.patientId===patientId&&o.result&&['Verified','Released to Doctor'].includes(o.result.status)).map((o:any)=>({date:o.result.observedAt,value:Number.parseFloat(o.result.value),units:o.result.units,range:o.result.referenceRange,test:o.testName,status:o.result.status}))}

// Receptionist-safe patient profile — no clinical data
function adminPatientView(p:any){return {id:p.id,patientId:p.patientId,name:p.name,dob:p.dob,phone:p.phone,email:p.email,emergencyContact:p.emergencyContact,createdAt:p.createdAt,risk:p.risk}}

app.get('/api/health',(_,res)=>res.json({ok:true,service:'careweave-api'}));
app.post('/api/auth/login',async(req,res)=>{const {email,password}=req.body||{};const u=db.users.find((x:any)=>x.email===email);if(!u||!(await bcrypt.compare(String(password||''),u.passwordHash)))return res.status(401).json({error:'Invalid email or password'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{userId:u.id,expires:Date.now()+8*60*60*1000});audit({user:u},'login','session',u.id,'Successful sign-in');await save();res.json({token,user:{id:u.id,name:u.name,email:u.email,role:u.role,facility:u.facility}})});
app.use('/api',auth);
app.get('/api/me',(req:any,res)=>res.json({id:req.user.id,name:req.user.name,email:req.user.email,role:req.user.role,facility:req.user.facility}));

// Dashboard — fixed today's date filtering
app.get('/api/dashboard',(req:any,res)=>{
  const role=req.user.role;
  const cases=role==='doctor'?db.cases.filter((c:any)=>c.status==='open'):db.cases.filter((c:any)=>c.type==='duplicate');
  const todayAppts=db.appointments.filter((a:any)=>isToday(a.date));
  const stats:any={
    patients:db.patients.length,
    appointments:todayAppts.length,
    waiting:db.appointments.filter((a:any)=>['Waiting','Checked in','Checked In'].includes(a.status)).length,
    checkedIn:db.appointments.filter((a:any)=>['Checked in','Checked In'].includes(a.status)).length,
    completed:db.appointments.filter((a:any)=>a.status==='Completed').length,
    cancelled:db.appointments.filter((a:any)=>a.status==='Cancelled').length,
    todayCompleted:todayAppts.filter((a:any)=>a.status==='Completed').length,
    todayScheduled:todayAppts.filter((a:any)=>a.status==='Scheduled').length,
    requested:db.labOrders.filter((o:any)=>o.status==='Requested'||o.status==='Sample Collection Pending').length,
    processing:db.labOrders.filter((o:any)=>['Sample Collected','Processing'].includes(o.status)).length,
    awaitingVerification:db.labOrders.filter((o:any)=>o.status==='Awaiting Verification').length,
    released:db.labOrders.filter((o:any)=>o.status==='Released to Doctor').length,
    followups:2
  };
  // For receptionist, filter appointments to today, sorted by time
  const appointments=role==='receptionist'?todayAppts.sort((a:any,b:any)=>a.time.localeCompare(b.time)):db.appointments;
  res.json({stats,appointments,labOrders:db.labOrders,cases,recent:db.auditLogs.slice(-10).reverse()});
});

// Patient endpoints
app.get('/api/patients',roles('receptionist','doctor'),(req:any,res)=>{
  const q=String(req.query.query||'').toLowerCase();
  const rows=db.patients.filter((p:any)=>!q||[p.name,p.patientId,p.phone,p.email].some(v=>String(v||'').toLowerCase().includes(q)));
  audit(req,'search','patient','directory',q?'Search by permitted identifiers':'Open patient directory');
  // Receptionist gets admin view only — no clinical data ever sent
  const view=req.user.role==='receptionist'?rows.map(adminPatientView):rows;
  res.json(view);
});

app.post('/api/patients',roles('receptionist'),async(req:any,res)=>{
  const {name,dob,phone,email,emergencyContact,_forceCreate,risk}=req.body||{};
  if(!name||!name.trim())return res.status(400).json({error:'Full name is required'});
  if(!dob)return res.status(400).json({error:'Date of birth is required'});
  if(!phone||!phone.trim())return res.status(400).json({error:'Phone number is required'});
  // Duplicate detection: same normalised name + same DOB
  const nameNorm=String(name).trim().toLowerCase();
  const duplicates=db.patients.filter((p:any)=>p.name.toLowerCase()===nameNorm&&p.dob===dob);
  if(duplicates.length>0&&!_forceCreate){
    return res.status(409).json({
      error:`Possible duplicate registration detected.`,
      duplicates:duplicates.map(adminPatientView)
    });
  }
  const p={id:id('p'),patientId:`CW-${Math.floor(10000+Math.random()*89999)}`,name:String(name).trim(),dob,phone:String(phone).trim(),email:email||undefined,emergencyContact:emergencyContact||undefined,createdAt:now(),risk:risk||undefined};
  db.patients.unshift(p);
  audit(req,'create','patient',p.id,'Administrative registration');
  await save();
  res.status(201).json(adminPatientView(p));
});

// Receptionist-safe patient admin profile (no clinical data)
app.get('/api/patients/:id/admin',roles('receptionist'),(req:any,res)=>{
  const p=patientById(req.params.id);
  if(!p)return res.status(404).json({error:'Patient not found'});
  audit(req,'read','patient',p.id,'Open administrative patient profile');
  // Include appointments only — no encounters, prescriptions, lab details
  const appointments=db.appointments.filter((a:any)=>a.patientId===p.id).map((a:any)=>({id:a.id,date:a.date,time:a.time,reason:a.reason,status:a.status,doctorName:a.doctorName,checkedInAt:a.checkedInAt}));
  res.json({...adminPatientView(p),appointments});
});

// Edit permitted patient demographics (receptionist only)
app.patch('/api/patients/:id',roles('receptionist'),async(req:any,res)=>{
  const p=patientById(req.params.id);
  if(!p)return res.status(404).json({error:'Patient not found'});
  const {name,phone,email,emergencyContact}=req.body||{};
  // DOB is immutable after registration to prevent identity fraud
  if(name)p.name=String(name).trim();
  if(phone)p.phone=String(phone).trim();
  if(email!==undefined)p.email=email||undefined;
  if(emergencyContact!==undefined)p.emergencyContact=emergencyContact||undefined;
  audit(req,'update','patient',p.id,'Updated permitted demographic fields');
  await save();
  res.json(adminPatientView(p));
});

// Full clinical record — doctor only (unchanged, enforced server-side)
app.get('/api/patients/:id/record',roles('doctor'),(req:any,res)=>{
  const p=patientById(req.params.id);
  if(!p)return res.status(404).json({error:'Patient not found'});
  audit(req,'read','patient',p.id,'Open unified health record');
  res.json({
    ...p,
    allergies:p.allergies||[],
    problems:p.problems||[],
    vitals:(db.vitals||[]).filter((v:any)=>v.patientId===p.id),
    referrals:(db.referrals||[]).filter((r:any)=>r.patientId===p.id),
    carePlans:(db.carePlans||[]).filter((c:any)=>c.patientId===p.id),
    timeline:timelineFor(p.id),
    chart:chartFor(p.id),
    appointments:db.appointments.filter((a:any)=>a.patientId===p.id),
    labOrders:db.labOrders.filter((o:any)=>o.patientId===p.id),
    prescriptions:db.prescriptions.filter((r:any)=>r.patientId===p.id)
  });
});

// Doctors list for appointment booking
app.get('/api/doctors',roles('receptionist','doctor'),(req:any,res)=>{
  const doctors=db.users.filter((u:any)=>u.role==='doctor').map((u:any)=>({id:u.id,name:u.name,facility:u.facility}));
  res.json(doctors);
});

// Appointments
app.get('/api/appointments',roles('receptionist','doctor'),(req:any,res)=>{
  const {date,status,patientId}=req.query as any;
  let rows=db.appointments;
  if(date==='today')rows=rows.filter((a:any)=>isToday(a.date));
  if(status)rows=rows.filter((a:any)=>a.status===status);
  if(patientId)rows=rows.filter((a:any)=>a.patientId===patientId);
  res.json(rows);
});

app.post('/api/appointments',roles('receptionist','doctor'),async(req:any,res)=>{
  const p=patientById(req.body.patientId);
  if(!p)return res.status(404).json({error:'Patient not found'});
  const {date,time,reason,doctorId}=req.body;
  if(!date||!time)return res.status(400).json({error:'Date and time are required'});
  if(!reason||!reason.trim())return res.status(400).json({error:'Reason for appointment is required'});
  // Conflict check: same patient, same date, not cancelled/completed
  const conflict=db.appointments.find((a:any)=>a.patientId===p.id&&a.date===date&&a.time===time&&!['Cancelled','Completed','No Show'].includes(a.status));
  if(conflict)return res.status(409).json({error:`Patient already has an appointment at ${time} on ${date}`});
  // Resolve doctor
  const doctor=doctorId?db.users.find((u:any)=>u.id===doctorId):db.users.find((u:any)=>u.role==='doctor');
  const a={id:id('appt'),patientId:p.id,patientName:p.name,patientIdCode:p.patientId,doctorId:doctor?.id||'',doctorName:doctor?.name||'Unassigned',date,time,reason:String(reason).trim(),status:'Scheduled'};
  db.appointments.push(a);
  audit(req,'create','appointment',a.id,`${p.name} · ${date} ${time}`);
  await save();
  res.status(201).json(a);
});

app.patch('/api/appointments/:id',roles('receptionist','doctor'),async(req:any,res)=>{
  const a=db.appointments.find((x:any)=>x.id===req.params.id);
  if(!a)return res.status(404).json({error:'Appointment not found'});
  const {status,date,time,reason}=req.body;
  // Validate status transitions
  const validStatuses=['Scheduled','Checked In','Waiting','In Consultation','Completed','Cancelled','No Show'];
  if(status){
    if(!validStatuses.includes(status))return res.status(400).json({error:'Invalid appointment status'});
    // Receptionist cannot move patient to In Consultation or Completed (clinical workflow)
    if(req.user.role==='receptionist'&&['In Consultation','Completed'].includes(status))
      return res.status(403).json({error:'Clinical status transitions are restricted to clinical staff'});
    // Prevent duplicate check-in
    if(['Checked In','Waiting'].includes(status)&&['Checked In','Waiting','In Consultation'].includes(a.status))
      return res.status(409).json({error:'Patient is already checked in or in consultation'});
    a.status=status;
    if(status==='Checked In'&&!a.checkedInAt)a.checkedInAt=now();
  }
  // Allow rescheduling (only for Scheduled appointments)
  if(date||time){
    if(!['Scheduled'].includes(a.status)&&!status)
      return res.status(400).json({error:'Only scheduled appointments can be rescheduled'});
    if(date)a.date=date;
    if(time)a.time=time;
    a.rescheduledAt=now();
  }
  if(reason)a.reason=String(reason).trim();
  audit(req,'update','appointment',a.id,`Status: ${a.status}${date?` · Rescheduled to ${a.date} ${a.time}`:''}`);
  await save();
  res.json(a);
});

// Encounter, lab, prescription endpoints — doctor/lab only
app.post('/api/encounters',roles('doctor'),async(req:any,res)=>{
  const p=patientById(req.body.patientId);
  if(!p)return res.status(404).json({error:'Patient not found'});
  const e={
    id:id('enc'),
    patientId:p.id,
    doctorId:req.user.id,
    date:now(),
    notes:String(req.body.notes||''),
    diagnosis:String(req.body.diagnosis||''),
    chiefComplaint:req.body.chiefComplaint||'',
    subjective:req.body.subjective||'',
    objective:req.body.objective||'',
    assessment:req.body.assessment||'',
    plan:req.body.plan||'',
    vitals:req.body.vitals||undefined,
    source:'CareWeave Clinic',
    imported:false
  };
  db.encounters.unshift(e);
  if(req.body.vitals){
    if(!db.vitals)db.vitals=[];
    const v={id:id('vt'),patientId:p.id,date:now(),...req.body.vitals,recordedBy:req.user.name};
    db.vitals.unshift(v);
  }
  audit(req,'create','encounter',e.id,`SOAP documentation: ${e.diagnosis||'Consultation'}`);
  await save();
  res.status(201).json(e);
});

app.patch('/api/encounters/:id',roles('doctor'),async(req:any,res)=>{
  const e=db.encounters.find((x:any)=>x.id===req.params.id);
  if(!e)return res.status(404).json({error:'Encounter not found'});
  Object.assign(e,{
    notes:req.body.notes??e.notes,
    diagnosis:req.body.diagnosis??e.diagnosis,
    chiefComplaint:req.body.chiefComplaint??e.chiefComplaint,
    subjective:req.body.subjective??e.subjective,
    objective:req.body.objective??e.objective,
    assessment:req.body.assessment??e.assessment,
    plan:req.body.plan??e.plan
  });
  audit(req,'update','encounter',e.id);
  await save();
  res.json(e);
});

// Vitals management
app.post('/api/patients/:id/vitals',roles('doctor'),async(req:any,res)=>{
  const p=patientById(req.params.id);
  if(!p)return res.status(404).json({error:'Patient not found'});
  if(!db.vitals)db.vitals=[];
  const v={
    id:id('vt'),
    patientId:p.id,
    date:now(),
    bpSystolic:Number(req.body.bpSystolic)||120,
    bpDiastolic:Number(req.body.bpDiastolic)||80,
    heartRate:Number(req.body.heartRate)||72,
    tempF:Number(req.body.tempF)||98.6,
    respRate:Number(req.body.respRate)||16,
    spo2:Number(req.body.spo2)||99,
    bmi:Number(req.body.bmi)||23.5,
    recordedBy:req.user.name
  };
  db.vitals.unshift(v);
  audit(req,'create','vitals',v.id,`Recorded BP ${v.bpSystolic}/${v.bpDiastolic}, HR ${v.heartRate}`);
  await save();
  res.status(201).json(v);
});

// Patient Allergies & Problems management
app.post('/api/patients/:id/allergies',roles('doctor'),async(req:any,res)=>{
  const p=patientById(req.params.id);
  if(!p)return res.status(404).json({error:'Patient not found'});
  if(!p.allergies)p.allergies=[];
  const al={
    id:id('al'),
    allergen:String(req.body.allergen||'').trim(),
    severity:req.body.severity||'Moderate',
    reaction:String(req.body.reaction||'').trim()
  };
  p.allergies.unshift(al);
  audit(req,'create','allergy',al.id,`Documented allergy: ${al.allergen}`);
  await save();
  res.status(201).json(al);
});

app.post('/api/patients/:id/problems',roles('doctor'),async(req:any,res)=>{
  const p=patientById(req.params.id);
  if(!p)return res.status(404).json({error:'Patient not found'});
  if(!p.problems)p.problems=[];
  const pr={
    id:id('pr'),
    code:String(req.body.code||'R69').trim(),
    name:String(req.body.name||'').trim(),
    status:req.body.status||'Active',
    diagnosedDate:now()
  };
  p.problems.unshift(pr);
  audit(req,'create','problem',pr.id,`Added chronic diagnosis: ${pr.name}`);
  await save();
  res.status(201).json(pr);
});

// Referrals
app.get('/api/referrals',roles('doctor'),(req:any,res)=>{
  if(!db.referrals)db.referrals=[];
  audit(req,'read','referral','directory');
  res.json(db.referrals);
});

app.post('/api/referrals',roles('doctor'),async(req:any,res)=>{
  const p=patientById(req.body.patientId);
  if(!p)return res.status(404).json({error:'Patient not found'});
  if(!db.referrals)db.referrals=[];
  const rf={
    id:id('ref'),
    patientId:p.id,
    patientName:p.name,
    patientIdCode:p.patientId,
    specialty:req.body.specialty||'Specialist',
    providerName:req.body.providerName||'Regional Specialist Clinic',
    priority:req.body.priority||'Routine',
    reason:String(req.body.reason||'').trim(),
    clinicalSummary:String(req.body.clinicalSummary||'').trim(),
    date:now(),
    status:req.body.status||'Sent'
  };
  db.referrals.unshift(rf);
  audit(req,'create','referral',rf.id,`Outbound referral to ${rf.specialty}`);
  await save();
  res.status(201).json(rf);
});

app.patch('/api/referrals/:id',roles('doctor'),async(req:any,res)=>{
  if(!db.referrals)db.referrals=[];
  const rf=db.referrals.find((x:any)=>x.id===req.params.id);
  if(!rf)return res.status(404).json({error:'Referral not found'});
  if(req.body.status)rf.status=req.body.status;
  audit(req,'update','referral',rf.id,`Status: ${rf.status}`);
  await save();
  res.json(rf);
});

// Care Plans
app.get('/api/care-plans',roles('doctor'),(req:any,res)=>{
  if(!db.carePlans)db.carePlans=[];
  audit(req,'read','care-plan','directory');
  res.json(db.carePlans);
});

app.post('/api/care-plans',roles('doctor'),async(req:any,res)=>{
  const p=patientById(req.body.patientId);
  if(!p)return res.status(404).json({error:'Patient not found'});
  if(!db.carePlans)db.carePlans=[];
  const cp={
    id:id('cp'),
    patientId:p.id,
    patientName:p.name,
    title:String(req.body.title||'Chronic Care Plan').trim(),
    category:req.body.category||'General Protocol',
    goals:req.body.goals||[],
    targets:req.body.targets||[],
    nextReviewDate:req.body.nextReviewDate||now(),
    status:'Active'
  };
  db.carePlans.unshift(cp);
  audit(req,'create','care-plan',cp.id,`Initiated protocol: ${cp.title}`);
  await save();
  res.status(201).json(cp);
});

app.patch('/api/care-plans/:id',roles('doctor'),async(req:any,res)=>{
  if(!db.carePlans)db.carePlans=[];
  const cp=db.carePlans.find((x:any)=>x.id===req.params.id);
  if(!cp)return res.status(404).json({error:'Care plan not found'});
  if(req.body.status)cp.status=req.body.status;
  if(req.body.targets)cp.targets=req.body.targets;
  audit(req,'update','care-plan',cp.id,`Updated care protocol`);
  await save();
  res.json(cp);
});

app.get('/api/lab-orders',roles('lab','doctor'),(req:any,res)=>{audit(req,'read','lab-order','directory');res.json(db.labOrders)});
app.post('/api/lab-orders',roles('doctor'),async(req:any,res)=>{
  const p=patientById(req.body.patientId);
  if(!p)return res.status(404).json({error:'Patient not found'});
  const o={
    id:id('lo'),
    orderId:`LAB-${Math.floor(24000+Math.random()*900)}`,
    patientId:p.id,
    patientName:p.name,
    patientIdCode:p.patientId,
    encounterId:req.body.encounterId||'enc-current',
    testName:req.body.testName||'Unspecified test',
    orderingDoctor:req.user.name,
    requestedAt:now(),
    sampleType:req.body.sampleType||'Blood',
    priority:req.body.priority||'Routine',
    clinicalIndication:req.body.clinicalIndication||'',
    status:'Requested'
  };
  db.labOrders.unshift(o);
  audit(req,'create','lab-order',o.id,`Doctor test order: ${o.testName} (${o.priority})`);
  await save();
  res.status(201).json(o);
});
app.patch('/api/lab-orders/:id/status',roles('lab','doctor'),async(req:any,res)=>{const o=db.labOrders.find((x:any)=>x.id===req.params.id);if(!o)return res.status(404).json({error:'Lab order not found'});const allowed=['Requested','Sample Collection Pending','Sample Collected','Processing','Awaiting Verification','Verified','Released to Doctor'];if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid lab workflow status'});if(req.body.status==='Verified'&&!o.result)return res.status(400).json({error:'A result must be submitted before verification'});o.status=req.body.status;if(o.result)o.result.status=req.body.status;if(req.body.status==='Released to Doctor'&&o.result)o.result.releasedAt=now();audit(req,'update','lab-order',o.id,`Status: ${o.status}`);await save();res.json(o)});
app.post('/api/lab-results',roles('lab','doctor'),async(req:any,res)=>{const o=db.labOrders.find((x:any)=>x.id===req.body.orderId);if(!o)return res.status(404).json({error:'Lab order not found'});if(!req.body.value||!req.body.units||!req.body.referenceRange)return res.status(400).json({error:'Value, units, and reference interval are required'});const result={id:id('lr'),orderId:o.id,value:String(req.body.value),units:String(req.body.units),referenceRange:String(req.body.referenceRange),observedAt:req.body.observedAt||now(),comments:String(req.body.comments||''),status:'Released to Doctor'};o.result=result;o.status='Released to Doctor';audit(req,'create','lab-result',result.id,'Diagnostic result recorded');await save();res.status(201).json(result)});
app.post('/api/lab-results/:id/verify',roles('lab','doctor'),async(req:any,res)=>{const o=db.labOrders.find((x:any)=>x.result?.id===req.params.id);if(!o||!o.result)return res.status(404).json({error:'Lab result not found'});o.result.verifiedBy=req.user.name;o.result.verifiedAt=now();o.result.status='Verified';o.status='Verified';audit(req,'verify','lab-result',o.result.id,'Qualified laboratory verification');await save();res.json(o.result)});
app.post('/api/prescriptions',roles('doctor'),async(req:any,res)=>{
  const p=patientById(req.body.patientId);
  if(!p)return res.status(404).json({error:'Patient not found'});
  const r={
    id:id('rx'),
    patientId:p.id,
    encounterId:req.body.encounterId||'enc-current',
    medicine:req.body.medicine,
    dosage:req.body.dosage,
    route:req.body.route||'Oral',
    frequency:req.body.frequency||'Once daily',
    duration:req.body.duration||'30 days',
    instructions:req.body.instructions||'',
    refills:Number(req.body.refills)||0,
    status:'Active',
    date:now(),
    source:'CareWeave Clinic',
    prescribingClinician:req.user.name,
    imported:false
  };
  if(!r.medicine||!r.dosage)return res.status(400).json({error:'Medicine and dosage are required'});
  db.prescriptions.unshift(r);
  audit(req,'create','prescription',r.id,`Prescribed ${r.medicine} ${r.dosage}`);
  await save();
  res.status(201).json(r);
});
app.patch('/api/prescriptions/:id',roles('doctor'),async(req:any,res)=>{
  const r=db.prescriptions.find((x:any)=>x.id===req.params.id);
  if(!r)return res.status(404).json({error:'Prescription not found'});
  if(req.body.status)r.status=req.body.status;
  if(req.body.refills!==undefined)r.refills=req.body.refills;
  if(req.body.discontinueReason)r.discontinueReason=req.body.discontinueReason;
  audit(req,'update','prescription',r.id,`Prescription ${r.medicine}: ${r.status}`);
  await save();
  res.json(r);
});
app.get('/api/reconciliation/cases',roles('doctor'),(req:any,res)=>{audit(req,'read','reconciliation','queue');res.json(db.cases.filter((c:any)=>c.status==='open'))});
app.patch('/api/reconciliation/cases/:id',roles('doctor'),async(req:any,res)=>{const c=db.cases.find((x:any)=>x.id===req.params.id);if(!c)return res.status(404).json({error:'Review case not found'});c.status='reviewed';c.decision=req.body.decision;c.reviewedBy=req.user.name;c.reviewedAt=now();audit(req,'resolve','reconciliation-case',c.id,`Decision: ${c.decision}`);await save();res.json(c)});
app.post('/api/external-records/import',roles('doctor'),async(req:any,res)=>{const {patientId,facility,sourceRecordId,eventDate,kind,content}=req.body||{};const p=patientById(patientId);if(!p)return res.status(404).json({error:'Patient not found; unmatched records remain separate until an authorized reviewer links them'});const existing=db.externalRecords.find((r:any)=>r.patientId===p.id&&r.sourceRecordId===sourceRecordId);const record={id:id('ext'),patientId:p.id,facility,sourceRecordId,eventDate:eventDate||now(),importedAt:now(),importedBy:req.user.id,kind,content,status:existing?'Duplicate flagged':'Requires review'};db.externalRecords.unshift(record);const c={id:id('case'),type:existing?'duplicate':'match',title:existing?'Possible duplicate external report':'Imported record requires review',detail:`${facility} · ${sourceRecordId} linked to ${p.patientId} pending human review.`,reference:sourceRecordId,evidence:existing?['Same source record identifier','Original record preserved','No automatic overwrite']:['Patient identifier supplied','Source facility preserved','Human review required'],status:'open'};db.cases.unshift(c);audit(req,'import','external-record',record.id,`Source: ${facility}`);await save();res.status(201).json({record,case:c})});

app.use((err:any,_req:any,res:any,_next:any)=>{console.error(err);res.status(500).json({error:'Unexpected server error'})});
const start=async()=>{db=await ensureSeed(DATA);app.listen(PORT,()=>console.log(`CareWeave API listening on http://localhost:${PORT}`))};start();
