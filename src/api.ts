import type {AdminPatientRecord,Appointment,Dashboard,Doctor,LabOrder,Patient,PatientRecord,User} from './types';
const json=async<T>(res:Response):Promise<T>=>{const body=await res.json();if(!res.ok)throw new Error(body.error||'Request failed');return body};
const request=async<T>(url:string,init:RequestInit={}):Promise<T>=>json<T>(await fetch(url,{...init,headers:{'Content-Type':'application/json',...(init.headers||{}),...(localStorage.getItem('cw_token')?{Authorization:`Bearer ${localStorage.getItem('cw_token')}`}:{})}}));
export const api={
  login:(email:string,password:string)=>request<{token:string;user:User}>('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})}),
  me:()=>request<User>('/api/me'),
  dashboard:()=>request<Dashboard>('/api/dashboard'),
  // Patient endpoints
  patients:(q='')=>request<Patient[]>(`/api/patients?query=${encodeURIComponent(q)}`),
  patient:(id:string)=>request<PatientRecord>(`/api/patients/${id}/record`),
  patientAdmin:(id:string)=>request<AdminPatientRecord>(`/api/patients/${id}/admin`),
  createPatient:(body:Partial<Patient>)=>request<Patient>('/api/patients',{method:'POST',body:JSON.stringify(body)}),
  updatePatient:(id:string,body:Partial<Patient>)=>request<Patient>(`/api/patients/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
  // Doctor list
  doctors:()=>request<Doctor[]>('/api/doctors'),
  // Appointment endpoints
  appointments:(params?:{date?:string;status?:string;patientId?:string})=>request<Appointment[]>(`/api/appointments${params?'?'+new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v])=>v)) as Record<string,string>):''}`),
  createAppointment:(body:any)=>request<Appointment>('/api/appointments',{method:'POST',body:JSON.stringify(body)}),
  updateAppointment:(id:string,body:{status?:string;date?:string;time?:string;reason?:string})=>request<Appointment>(`/api/appointments/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
  // Lab endpoints (lab/doctor only)
  createEncounter:(body:any)=>request<any>('/api/encounters',{method:'POST',body:JSON.stringify(body)}),
  labOrders:()=>request<LabOrder[]>('/api/lab-orders'),
  createLabOrder:(body:any)=>request<any>('/api/lab-orders',{method:'POST',body:JSON.stringify(body)}),
  updateLabStatus:(id:string,status:string,reason?:string)=>request<any>(`/api/lab-orders/${id}/status`,{method:'PATCH',body:JSON.stringify({status,reason})}),
  addLabResult:(body:any)=>request<any>('/api/lab-results',{method:'POST',body:JSON.stringify(body)}),
  verifyLabResult:(id:string)=>request<any>(`/api/lab-results/${id}/verify`,{method:'POST'}),
  createPrescription:(body:any)=>request<any>('/api/prescriptions',{method:'POST',body:JSON.stringify(body)}),
  // Reconciliation
  cases:()=>request<any[]>('/api/reconciliation/cases'),
  resolveCase:(id:string,decision:string)=>request<any>(`/api/reconciliation/cases/${id}`,{method:'PATCH',body:JSON.stringify({decision})}),
  importRecord:(body:any)=>request<any>('/api/external-records/import',{method:'POST',body:JSON.stringify(body)}),
};
