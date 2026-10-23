import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
const now=new Date(); const iso=(d:number)=>new Date(now.getTime()-d*86400000).toISOString();
export async function buildSeed(){
 const users=[
  {id:'u-reception',name:'Maya Patel',email:'reception@careweave.test',passwordHash:await bcrypt.hash('demo123',10),role:'receptionist',facility:'CareWeave Front Desk'},
  {id:'u-lab',name:'Jordan Lee',email:'lab@careweave.test',passwordHash:await bcrypt.hash('demo123',10),role:'lab',facility:'CareWeave Diagnostics'},
  {id:'u-doctor',name:'Dr. Amara Singh',email:'doctor@careweave.test',passwordHash:await bcrypt.hash('demo123',10),role:'doctor',facility:'CareWeave Clinic'}
 ];
 const patients=[
  {id:'p-ava',patientId:'CW-10482',name:'Ava Morgan',dob:'1991-04-12',phone:'+1 (415) 555-0182',email:'ava.morgan@example.test',emergencyContact:'Eli Morgan · +1 (415) 555-0107',createdAt:iso(42),risk:'Review imported history'},
  {id:'p-liam',patientId:'CW-10531',name:'Liam Chen',dob:'1986-09-28',phone:'+1 (415) 555-0124',email:'liam.chen@example.test',createdAt:iso(18)},
  {id:'p-noor',patientId:'CW-10544',name:'Noor Williams',dob:'1978-02-19',phone:'+1 (415) 555-0148',createdAt:iso(10)}
 ];
 const appointments=[
  {id:'a-1',patientId:'p-ava',patientName:'Ava Morgan',patientIdCode:'CW-10482',doctorId:'u-doctor',doctorName:'Dr. Amara Singh',date:'Today',time:'09:30 AM',reason:'Follow-up · fatigue',status:'Checked in'},
  {id:'a-2',patientId:'p-liam',patientName:'Liam Chen',patientIdCode:'CW-10531',doctorId:'u-doctor',doctorName:'Dr. Amara Singh',date:'Today',time:'10:15 AM',reason:'Annual review',status:'Scheduled'},
  {id:'a-3',patientId:'p-noor',patientName:'Noor Williams',patientIdCode:'CW-10544',doctorId:'u-doctor',doctorName:'Dr. Amara Singh',date:'Today',time:'11:00 AM',reason:'Medication review',status:'Waiting'},
  {id:'a-4',patientId:'p-ava',patientName:'Ava Morgan',patientIdCode:'CW-10482',doctorId:'u-doctor',doctorName:'Dr. Amara Singh',date:'Tomorrow',time:'02:30 PM',reason:'Results review',status:'Scheduled'}
 ];
 const encounters=[{id:'enc-ava-old',patientId:'p-ava',doctorId:'u-doctor',date:iso(32),notes:'Historical consultation imported from Harborview Medical Center.',diagnosis:'Fatigue under evaluation',source:'Harborview Medical Center',imported:true},{id:'enc-ava-current',patientId:'p-ava',doctorId:'u-doctor',date:iso(0),notes:'',diagnosis:'',source:'CareWeave Clinic',imported:false}];
 const labOrders=[
  {id:'lo-ava-a1c',orderId:'LAB-24081',patientId:'p-ava',patientName:'Ava Morgan',patientIdCode:'CW-10482',encounterId:'enc-ava-old',testName:'HbA1c',orderingDoctor:'Dr. Amara Singh',requestedAt:iso(32),sampleType:'Blood',status:'Released to Doctor',result:{id:'lr-ava-a1c',orderId:'lo-ava-a1c',value:'5.8',units:'%',referenceRange:'4.0–5.6',observedAt:iso(31),comments:'Historical report; retained original source.',verifiedBy:'External source review',verifiedAt:iso(30),releasedAt:iso(30),status:'Released to Doctor'}},
  {id:'lo-ava-cbc',orderId:'LAB-24102',patientId:'p-ava',patientName:'Ava Morgan',patientIdCode:'CW-10482',encounterId:'enc-ava-current',testName:'CBC — Hemoglobin',orderingDoctor:'Dr. Amara Singh',requestedAt:iso(0),sampleType:'Blood',status:'Awaiting Verification'},
  {id:'lo-liam-lipid',orderId:'LAB-24103',patientId:'p-liam',patientName:'Liam Chen',patientIdCode:'CW-10531',encounterId:'enc-liam-current',testName:'Lipid panel',orderingDoctor:'Dr. Amara Singh',requestedAt:iso(0),sampleType:'Blood',status:'Processing'},
  {id:'lo-noor-tsh',orderId:'LAB-24076',patientId:'p-noor',patientName:'Noor Williams',patientIdCode:'CW-10544',encounterId:'enc-noor-current',testName:'TSH',orderingDoctor:'Dr. Amara Singh',requestedAt:iso(3),sampleType:'Blood',status:'Sample Collection Pending'}
 ];
 const prescriptions=[{id:'rx-ava-1',patientId:'p-ava',encounterId:'enc-ava-old',medicine:'Ferrous sulfate',dosage:'325 mg',route:'Oral',frequency:'Once daily',duration:'30 days',date:iso(32),source:'Harborview Medical Center',imported:true},{id:'rx-ava-conflict',patientId:'p-ava',encounterId:'enc-ava-old',medicine:'Ferrous sulfate',dosage:'325 mg',route:'Oral',frequency:'Twice daily',duration:'14 days',date:iso(31),source:'Northstar Diagnostics',imported:true}];
 const externalRecords=[{id:'ext-1',patientId:'p-ava',facility:'Harborview Medical Center',sourceRecordId:'HV-99201',eventDate:iso(32),importedAt:iso(2),importedBy:'u-doctor',kind:'consultation',status:'Reviewed'},{id:'ext-2',patientId:'p-ava',facility:'Northstar Diagnostics',sourceRecordId:'NS-44182',eventDate:iso(32),importedAt:iso(1),importedBy:'u-doctor',kind:'lab',status:'Duplicate flagged'}];
 const cases=[{id:'case-1',type:'duplicate',title:'Possible duplicate HbA1c report',detail:'Northstar Diagnostics record may match the historical Harborview result.',reference:'NS-44182 · CW-10482',evidence:['Same patient linkage','Same test type: HbA1c','Event date within 24 hours'],status:'open'},{id:'case-2',type:'conflict',title:'Medication frequency conflict',detail:'Two imported sources disagree on the frequency for ferrous sulfate.',reference:'HV-99201 vs NS-44182',evidence:['Same medicine and dose','Frequency differs: daily vs twice daily','Both records remain preserved'],status:'open'},{id:'case-3',type:'match',title:'Ambiguous external identity match',detail:'An imported record matches the patient name but lacks a second identity factor.',reference:'EXT-AMB-778 · review required',evidence:['Name match only','DOB not supplied','No auto-link performed'],status:'open'}];
 return {users,patients,appointments,encounters,labOrders,prescriptions,externalRecords,cases,auditLogs:[]};
}
export async function ensureSeed(file=path.resolve('data/careweave.json')){try{await fs.access(file);return JSON.parse(await fs.readFile(file,'utf8'))}catch{const data=await buildSeed();await fs.writeFile(file,JSON.stringify(data,null,2));return data}}
if(process.argv[1]?.endsWith('seed.ts')){const file=path.resolve('data/careweave.json');const data=await buildSeed();await fs.writeFile(file,JSON.stringify(data,null,2));console.log('Seeded synthetic CareWeave data to',file)}
