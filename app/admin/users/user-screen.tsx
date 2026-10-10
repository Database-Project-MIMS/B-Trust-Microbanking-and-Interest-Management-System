 'use client';

import {useEffect,useState} from 'react';

import {accountRequest,csrfToken} from '@/app/accounts/account-client';

type Row={userId:string;username:string;roleName:string;status:string;branchName:string|null};

type Data={rows:Row[];total:number;roles:{name:string;status:string}[]};

const roles=['ADMIN','CENTRAL_OPS','AUDITOR','AGENT','BRANCH_MANAGER','CUSTOMER'];

const profileFields: [string,string,string][]=[['employeeNo','Employee number','text'],['nicPassportNo','NIC or passport','text'],['fullName','Full name','text'],['dateOfBirth','Date of birth','date'],['gender','Gender','text'],['phone','Phone','tel'],['address','Address','text'],['email','Email','email'],['hiredDate','Hired date','date']];

export function UserScreen({rolesOnly=false}:{rolesOnly?:boolean}){

 const [data,setData]=useState<Data|null>(null),[q,setQ]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1),[attempt,setAttempt]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[resetLink,setResetLink]=useState('');

 const [creating,setCreating]=useState(false),[role,setRole]=useState('CENTRAL_OPS'),[branches,setBranches]=useState<{branchId:string;branchName:string;status:string}[]>([]),[editing,setEditing]=useState<Row|null>(null);

 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');accountRequest<Data>('/api/admin/users?'+new URLSearchParams({q:search,page:String(page)}),{signal:c.signal}).then(r=>{if(c.signal.aborted)return;if(r.ok&&r.data)setData(r.data);else{setData(null);setError(r.error?.message??'Unable to load users.');}}).catch(()=>{}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[search,page,attempt]);

 useEffect(()=>{if(!creating)return;const c=new AbortController();accountRequest<typeof branches>('/api/branches',{signal:c.signal}).then(r=>{if(r.ok)setBranches((r.data??[]).filter(b=>b.status==='ACTIVE'));else setError(r.error?.message??'Unable to load branches.');}).catch(()=>{});return()=>c.abort();},[creating]);

 async function issueReset(id:string){setBusy(true);setError('');setResetLink('');try{const r=await accountRequest<{token:string;expiresAt:string}>(`/api/admin/users/${id}/reset`,{method:'POST',headers:{'x-csrf-token':csrfToken()}});if(r.ok&&r.data){setResetLink(window.location.origin+'/reset-password#token='+r.data.token);setMessage('Reset link expires in 30 minutes. Give it to the verified user through an approved private channel.');}else setError(r.error?.message??'Unable to issue reset link.');}finally{setBusy(false);}}
 async function save(form:HTMLFormElement){setBusy(true);setError('');setMessage('');const values=Object.fromEntries(new FormData(form));let body:Record<string,unknown>;

 if(editing){body={status:values.status,...(values.password?{password:values.password}:{}),...(['ADMIN','CENTRAL_OPS','AUDITOR'].includes(editing.roleName)?{roleName:values.roleName}:{})};}

 else{body={username:values.username,password:values.password,roleName:role};if(['AGENT','BRANCH_MANAGER'].includes(role))body.profile=Object.fromEntries(['branchId',...profileFields.map(([name])=>name)].map(name=>[name,values[name]]));if(role==='CUSTOMER')body.customerId=values.customerId;}

 try{const r=await accountRequest(editing?`/api/admin/users/${editing.userId}`:'/api/admin/users',{method:editing?'PATCH':'POST',headers:{'content-type':'application/json','x-csrf-token':csrfToken()},body:JSON.stringify(body)});if(!r.ok){setError(r.error?.message??'Unable to save user.');return;}setEditing(null);setCreating(false);setMessage('User saved. Existing sessions were revoked for changes to access.');setAttempt(n=>n+1);}finally{setBusy(false);}}

 return <div className="space-y-6"><div className="page-header"><div><p className="eyebrow">Administration</p><h1 className="page-title">{rolesOnly?'Roles and permissions':'Users and access'}</h1><p className="page-description">Create identities with their required profiles. Access changes invalidate existing sessions.</p></div>{!rolesOnly&&<button className="btn btn-primary" onClick={()=>{setCreating(true);setEditing(null);}}>Create user</button>}</div>

 {error&&<p className="card" role="alert">{error} <button className="btn btn-secondary" onClick={()=>setAttempt(n=>n+1)}>Retry</button></p>}{message&&<p className="card" role="status">{message}</p>}{resetLink&&<label className="field card">Single-use reset link<input className="input" value={resetLink} readOnly/><button className="btn btn-secondary" onClick={()=>setResetLink('')}>Hide link</button></label>}

 {(creating||editing)&&<form className="card grid gap-4 max-w-3xl md:grid-cols-2" onSubmit={e=>{e.preventDefault();void save(e.currentTarget);}}><h2 className="section-heading md:col-span-2">{editing?`Manage ${editing.username}`:'Create user'}</h2><fieldset disabled={busy} className="contents">

 {!editing&&<label className="field">Username (required)<input className="input" name="username" required minLength={3} maxLength={100} pattern="[A-Za-z0-9._-]+" autoComplete="off"/></label>}

 <label className="field">{editing?'New password (optional)':'Password (required)'}<input className="input" name="password" type="password" required={!editing} minLength={12} maxLength={128} autoComplete="new-password"/><small>Use at least 12 characters.</small></label>

 <label className="field">Role<select className="input" name="roleName" value={editing?editing.roleName:role} disabled={!!editing&&!['ADMIN','CENTRAL_OPS','AUDITOR'].includes(editing.roleName)} onChange={e=>editing?setEditing({...editing,roleName:e.target.value}):setRole(e.target.value)}>{(editing&&['ADMIN','CENTRAL_OPS','AUDITOR'].includes(editing.roleName)?roles.slice(0,3):roles).map(r=><option key={r}>{r}</option>)}</select></label>

 {editing?<label className="field">Status<select className="input" name="status" defaultValue={editing.status}>{['ACTIVE','INACTIVE','SUSPENDED'].map(s=><option key={s}>{s}</option>)}</select></label>:['AGENT','BRANCH_MANAGER'].includes(role)?<><label className="field">Branch (required)<select className="input" name="branchId" required><option value="">Choose branch</option>{branches.map(b=><option key={b.branchId} value={b.branchId}>{b.branchName}</option>)}</select></label>{profileFields.map(([name,label,type])=><label className="field" key={name}>{label} (required)<input className="input" name={name} type={type} required/></label>)}</>:role==='CUSTOMER'?<label className="field">Existing customer UUID (required)<input className="input" name="customerId" required/><small>The customer must be active and have no existing login.</small></label>:null}

 <div className="flex gap-3 md:col-span-2"><button type="button" className="btn btn-secondary" onClick={()=>{setCreating(false);setEditing(null);}}>Cancel</button><button className="btn btn-primary">{busy?'Saving…':editing?'Save access changes':'Create user'}</button></div></fieldset></form>}

 {loading?<p className="card" role="status">Loading users and roles…</p>:rolesOnly?<section className="card"><table className="data-table"><thead><tr><th>Role</th><th>Status</th><th>Scope</th></tr></thead><tbody>{data?.roles.map(r=><tr key={r.name}><td>{r.name}</td><td>{r.status}</td><td>{r.name==='CUSTOMER'?'Owned accounts':r.name==='AGENT'?'Assigned customers and branch':r.name==='BRANCH_MANAGER'?'Own branch':'Bank-wide'}</td></tr>)}</tbody></table></section>:<><form className="card flex gap-3" onSubmit={e=>{e.preventDefault();setSearch(q);setPage(1);}}><label className="field flex-1">Search username<input className="input" value={q} onChange={e=>setQ(e.target.value)}/></label><button className="btn btn-secondary">Search</button></form>{data&&<section className="card table-wrap"><table className="data-table"><thead><tr><th>Username</th><th>Role</th><th>Branch</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.rows.map(r=><tr key={r.userId}><td>{r.username}</td><td>{r.roleName}</td><td>{r.branchName??'—'}</td><td>{r.status}</td><td><button className="btn btn-secondary" onClick={()=>{setEditing(r);setCreating(false);}}>Manage</button><button className="btn btn-secondary" disabled={busy||r.status!=='ACTIVE'} onClick={()=>void issueReset(r.userId)}>Issue reset link</button></td></tr>)}{!data.rows.length&&<tr><td colSpan={5}>No users match this search.</td></tr>}</tbody></table></section>}<div className="flex gap-4"><button className="btn btn-secondary" disabled={page===1} onClick={()=>setPage(n=>n-1)}>Previous</button><span>Page {page}</span><button className="btn btn-secondary" disabled={!data||page*25>=data.total} onClick={()=>setPage(n=>n+1)}>Next</button></div></>}

 </div>;

}
