/* M1racle Study Cloud v8.0 — independent, browser-native Supabase REST client.
   Personal-stage account and revision-safe document synchronization.
   No service-role keys; Postgres RLS is authoritative. */
(function(root,factory){
  const lib=factory(root);
  root.M1Cloud=lib;
  if(typeof module==='object' && module.exports)module.exports=lib;
})(typeof window!=='undefined'?window:globalThis,function(W){
  'use strict';
  const PLATFORM='m1racle_study_platform_v1',PHYSICAL='phys_exam_lab_2025_v1';
  const OWNER='m1racle_cloud_owner_v1',SESSION='m1racle_cloud_auth_v1',DEVICE='m1racle_cloud_device_v1';
  const cfg=W.M1_CLOUD_CONFIG||{};
  const validURL=typeof cfg.url==='string'&&/^https:\/\/[a-z\d-]+\.supabase\.co\/?$/i.test(cfg.url);
  const validKey=typeof cfg.publishableKey==='string' && (cfg.publishableKey.startsWith('sb_publishable_')||(/^eyJ[A-Za-z0-9_-]+\./.test(cfg.publishableKey)));
  const configured=validURL&&validKey;
  const origin=validURL?cfg.url.replace(/\/$/,''):'';
  const rnd=()=>{if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID();const b=new Uint8Array(16);if(typeof crypto!=='undefined'&&crypto.getRandomValues)crypto.getRandomValues(b);else for(let i=0;i<16;i++)b[i]=Math.floor(Math.random()*256);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
  const copy=x=>JSON.parse(JSON.stringify(x));
  const deepEq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function read(k,fallback=null){try{const s=localStorage.getItem(k);return s===null?fallback:JSON.parse(s)}catch{return fallback}}
  function store(k,value){localStorage.setItem(k,JSON.stringify(value))}
  function defaultState(scope){return scope==='platform'?{answered:{},wrong:{},starred:{},sessions:[],lastModule:'physical'}:{mastery:{},flags:{},notes:{},globalNote:'',flow:{},wrong:{},attempts:[],lastStudy:0,theme:'sea',reviews:{},planStart:null,planDay:1,activity:{},drillChecks:{},rubricScores:{}}}
  const groups={platform:['answered','wrong','starred'],physical:['mastery','flags','notes','flow','wrong','reviews','activity','drillChecks','rubricScores']};
  const arrayNames={platform:['sessions'],physical:['attempts']};
  function flatten(scope,obj){
    const out={};if(!obj||typeof obj!=='object')return out;
    for(const g of groups[scope]||[]){
      const data=obj[g];if(!data||typeof data!=='object')continue;
      for(const [k,v] of Object.entries(data)){
        if(g==='rubricScores'||g==='drillChecks'){
          for(const [sub,subv] of Object.entries(v||{}))out[`${g}/${k}/${sub}`]=subv;
        }else out[`${g}/${k}`]=v;
      }
    }
    for(const g of arrayNames[scope]||[]){
      (Array.isArray(obj[g])?obj[g]:[]).forEach((v,i)=>{
        if(!v||typeof v!=='object')return;
        const identity=v.id||[v.date||v.created_at||'unknown',v.correct??'',v.total??'',v.scope||''].join('_');
        const safe=encodeURIComponent(String(identity));
        let key=`${g}/${safe}`;
        if(Object.hasOwn(out,key))key+=`__${i}`;
        out[key]=v;
      });
    }
    const scalars=scope==='platform'?{lastModule:'physical'}:{globalNote:'',lastStudy:0,theme:'sea',planStart:null,planDay:1};
    for(const [k,def] of Object.entries(scalars))if(Object.hasOwn(obj,k)&&!deepEq(obj[k],def))out[k]=obj[k];
    return out;
  }
  function unflatten(scope,docs){
    const out=defaultState(scope);
    for(const [key,value] of Object.entries(docs||{})){
      if(value===null||value===undefined)continue;
      const parts=key.split('/');
      if((arrayNames[scope]||[]).includes(parts[0])){out[parts[0]].push(copy(value));continue}
      if((groups[scope]||[]).includes(parts[0])){
        if(parts.length===2)out[parts[0]][parts[1]]=copy(value);
        else if(parts.length===3){out[parts[0]][parts[1]]??={};out[parts[0]][parts[1]][parts[2]]=copy(value)}
        continue;
      }
      if(parts.length===1&&Object.hasOwn(out,key))out[key]=copy(value);
    }
    for(const name of arrayNames[scope]||[])out[name].sort((a,b)=>String(b.date||b.created_at||'').localeCompare(String(a.date||a.created_at||'')));
    return out;
  }
  function hasContent(scope,obj){return Object.keys(flatten(scope,obj)).length>0}
  function hasLocalContent(){return hasContent('platform',read(PLATFORM,{}))||hasContent('physical',read(PHYSICAL,{}))}
  function makeDocId(scope,key){return `${scope}|${key}`}
  function redact(message){return String(message||'网络或权限请求失败').replace(/sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]{30,}/g,'[hidden]').slice(0,240)}
  class Cloud{
    constructor(){
      this.configured=configured;this.user=null;this.session=null;this.mode=configured?'signedout':'setup';this.error='';this.remote=new Map();this.shadow={};this.queue=[];this.events=[];this.conflicts={};this.inFlight=false;this.syncing=false;this.active=false;this.initialized=false;
      this.device=localStorage.getItem(DEVICE)||rnd();localStorage.setItem(DEVICE,this.device);
      this.listeners=new Set();this.lastPull=0;this.lastSync=0;this.pollId=null;
    }
    subscribe(fn){this.listeners.add(fn);fn(this.status());return ()=>this.listeners.delete(fn)}
    status(){return {configured:this.configured,mode:this.mode,email:this.user?.email||'',userId:this.user?.id||'',pending:this.queue.length+this.events.length,conflicts:Object.keys(this.conflicts).length,lastSync:this.lastSync,error:this.error,active:this.active}}
    announce(){const s=this.status();for(const f of this.listeners){try{f(s)}catch(_){}}W.dispatchEvent?.(new CustomEvent('m1racle:cloud-status',{detail:s}))}
    statusText(){let a={setup:'未配置云端',signedout:'未登录',connecting:'连接中',migration:'等待选择旧记录',ready:'已同步',syncing:'同步中',offline:'离线待同步',conflict:'记录冲突',error:'同步异常'};return a[this.mode]||'云端状态'}
    headers(token,extra={}){return {'apikey':cfg.publishableKey,'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{}),...extra}}
    async raw(url,method='GET',body,token,extra={}){
      const response=await fetch(origin+url,{method,headers:this.headers(token,extra),...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
      const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{data={message:text}}
      if(!response.ok){const e=new Error(redact(data?.msg||data?.message||data?.error_description||data?.error||`HTTP ${response.status}`));e.status=response.status;e.code=data?.code;throw e}
      return data;
    }
    async refresh(){
      if(!this.session?.refresh_token)throw Error('会话已失效，请重新登录');
      const perform=async()=>{
        const latest=read(SESSION);if(latest?.expires_at>Date.now()+60000){this.session=latest;return this.session}
        const d=await this.raw('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:latest?.refresh_token||this.session.refresh_token},undefined);
        if(!d.access_token||!d.user?.id)throw Error('无法刷新登录状态');
        this.session={...d,expires_at:Date.now()+Math.max(60,d.expires_in||3600)*1000};store(SESSION,this.session);return this.session;
      };
      if(navigator?.locks?.request)return navigator.locks.request('m1racle-cloud-auth-refresh',perform);
      if(!this.refreshJob)this.refreshJob=perform().finally(()=>{this.refreshJob=null});
      return this.refreshJob;
    }
    async token(){if(!this.session)return null;if(this.session.expires_at<Date.now()+60000)await this.refresh();return this.session.access_token}
    async req(url,method='GET',body,extra={}){
      let tk=await this.token();if(!tk)throw Error('尚未登录');
      try{return await this.raw(url,method,body,tk,extra)}catch(e){
        if(e.status!==401)return Promise.reject(e);
        this.session.expires_at=0;store(SESSION,this.session);
        await this.refresh();tk=this.session.access_token;
        return this.raw(url,method,body,tk,extra)
      }
    }
    async login(email,password){
      if(!this.configured)throw Error('请先配置独立的 M1racle Study Supabase 项目');
      this.mode='connecting';this.error='';this.announce();
      try{
        const d=await this.raw('/auth/v1/token?grant_type=password','POST',{email:String(email).trim(),password},undefined);
        if(!d.user?.id||!d.access_token)throw Error('登录响应无效');
        this.session={...d,expires_at:Date.now()+Math.max(60,d.expires_in||3600)*1000};store(SESSION,this.session);
        await this.initUser();return this.status();
      }catch(e){this.mode='error';this.error=redact(e.message);this.announce();throw e}
    }
    async init(){
      if(this.initialized)return;this.initialized=true;
      if(!this.configured){this.announce();return}
      const cache=read(SESSION);
      if(cache?.access_token){this.session=cache;try{await this.initUser()}catch(e){this.error=redact(e.message);this.mode='error';this.announce()}}
      else{this.mode='signedout';this.announce()}
      if(typeof window!=='undefined'){
        W.addEventListener('online',()=>{if(this.active)this.synchronize().catch(()=>{})});
        W.addEventListener('focus',()=>{if(this.active)this.synchronize().catch(()=>{})});
        W.addEventListener('storage',e=>{if(e.key===SESSION&&e.newValue){const s=read(SESSION);if(s?.user?.id===this.user?.id)this.session=s}if(e.key===SESSION&&!e.newValue&&this.user)this.clearSessionState()});
        this.pollId=setInterval(()=>{if(this.active&&document.visibilityState==='visible')this.synchronize().catch(()=>{})},20000);
      }
    }
    async initUser(){
      const person=await this.req('/auth/v1/user');if(!person?.id)throw Error('用户身份验证失败');
      this.user=person;this.mode='connecting';this.error='';this.announce();
      this.queue=read(`m1racle_cloud_queue_${person.id}`,[]);
      this.events=read(`m1racle_cloud_attempts_${person.id}`,[]);
      const owner=localStorage.getItem(OWNER);
      await this.getRemote();
      if(owner&&owner!==person.id){this.mode='migration';this.active=false;this.announce();return}
      if(!owner&&hasLocalContent()){this.mode='migration';this.active=false;this.announce();return}
      this.activate(person.id);
      await this.synchronize();
    }
    async getRemote(){
      if(!this.user)throw Error('尚未验证身份');
      let records=[],start=0;
      while(true){
        const page=await this.req('/rest/v1/study_documents?select=namespace,item_key,payload,deleted,version,last_op_id,updated_at&user_id=eq.'+encodeURIComponent(this.user.id)+'&order=namespace.asc,item_key.asc&limit=1000&offset='+start);
        if(!Array.isArray(page))throw Error('云端返回记录格式不正确');
        records.push(...page);if(page.length<1000)break;start+=1000;
        if(start>=100000)throw Error('同步记录过多，请联系管理员处理分页');
      }
      this.remote=new Map(records.map(d=>[makeDocId(d.namespace,d.item_key),d]));return records;
    }
    ensureQueueStore(){if(!this.user)return;store(`m1racle_cloud_queue_${this.user.id}`,this.queue)}
    ensureEventStore(){if(!this.user)return;store(`m1racle_cloud_attempts_${this.user.id}`,this.events)}
    activeDocMaps(){const o={platform:{},physical:{}};for(const d of this.remote.values())if(o[d.namespace]&&!d.deleted)o[d.namespace][d.item_key]=d.payload;return o}
    rebuild(){
      if(!this.user||!this.active)return;
      const maps=this.activeDocMaps();
      for(const op of this.queue){if(!maps[op.namespace])continue;if(op.deleted)delete maps[op.namespace][op.item_key];else maps[op.namespace][op.item_key]=copy(op.payload)}
      for(const scope of ['platform','physical']){
        const data=unflatten(scope,maps[scope]);this.shadow[scope]=flatten(scope,data);
        const storageKey=scope==='platform'?PLATFORM:PHYSICAL;
        if(!deepEq(read(storageKey,defaultState(scope)),data)){
          store(storageKey,data);
          W.dispatchEvent?.(new CustomEvent('m1racle:remote-state',{detail:{scope,state:copy(data)}}));
        }
      }
    }
    activate(id){
      localStorage.setItem(OWNER,id);this.active=true;this.mode='ready';this.rebuild();this.announce();
    }
    backupLegacy(){
      const packet={format:'m1racle-local-backup-v1',createdAt:new Date().toISOString(),platform:read(PLATFORM,{}),physical:read(PHYSICAL,{})};
      const k='m1racle_backup_'+Date.now();store(k,packet);
      // Save an independent copy outside browser storage before importing. Called by a user click.
      try{if(typeof document!=='undefined'){
        const file=new Blob([JSON.stringify(packet,null,2)],{type:'application/json'});
        const url=URL.createObjectURL(file),a=document.createElement('a');
        a.href=url;a.download='M1racle_Study_旧版迁移备份_'+new Date().toISOString().slice(0,10)+'.json';a.click();
        setTimeout(()=>URL.revokeObjectURL(url),2000);
      }}catch(_){/* Browser-local independent snapshot still exists. */}
      return {key:k,data:packet};
    }
    async migrate(mode){
      if(this.mode!=='migration')throw Error('当前没有需要处理的本地记录');
      if(!['merge','cloud'].includes(mode))throw Error('无效的迁移选项');
      const owner=localStorage.getItem(OWNER);if(owner&&owner!==this.user.id&&mode==='merge')throw Error('这些本地记录属于另一账号，不能直接合并');
      this.backupLegacy();
      const local={platform:flatten('platform',read(PLATFORM,{})),physical:flatten('physical',read(PHYSICAL,{}))};
      if(mode==='merge'){
        for(const scope of ['platform','physical']){
          for(const [key,payload] of Object.entries(local[scope])){
            if(this.remote.has(makeDocId(scope,key)))continue; // 云端同一条目优先，旧记录仍在备份中
            this.queue.push({namespace:scope,item_key:key,payload,deleted:false,expected_version:0,op_id:rnd()});
          }
        }
        this.ensureQueueStore();
      }
      this.activate(this.user.id);await this.synchronize();
      return {queued:this.queue.length,mode};
    }
    localSave(scope,state){
      if(!this.active||!this.user)return;
      const now=flatten(scope,state),prev=this.shadow[scope]||{};
      const keys=new Set([...Object.keys(now),...Object.keys(prev)]);
      for(const key of keys){
        if(deepEq(now[key],prev[key]))continue;
        const existing=this.queue.find(q=>q.namespace===scope&&q.item_key===key);
        const remote=this.remote.get(makeDocId(scope,key));
        const op={namespace:scope,item_key:key,payload:Object.hasOwn(now,key)?copy(now[key]):null,deleted:!Object.hasOwn(now,key),expected_version:existing?.expected_version??remote?.version??0,op_id:rnd()};
        this.queue=this.queue.filter(q=>!(q.namespace===scope&&q.item_key===key));this.queue.push(op);
        delete this.conflicts[makeDocId(scope,key)];
      }
      this.shadow[scope]=copy(now);this.ensureQueueStore();
      this.mode=navigator.onLine===false?'offline':'syncing';this.announce();
      clearTimeout(this.flushTimer);this.flushTimer=setTimeout(()=>this.synchronize().catch(()=>{}),350);
    }
    pushAttempt(questionId,selected,correct){
      if(!this.active||!this.user)return;
      this.events.push({id:rnd(),user_id:this.user.id,question_id:String(questionId),selected:Number(selected),correct:!!correct,client_id:this.device,answered_at:new Date().toISOString()});
      this.ensureEventStore();this.announce();
      clearTimeout(this.flushTimer);this.flushTimer=setTimeout(()=>this.synchronize().catch(()=>{}),350);
    }
    async writeOne(op){
      const id=makeDocId(op.namespace,op.item_key);
      const base={namespace:op.namespace,item_key:op.item_key,payload:op.payload,deleted:op.deleted,last_op_id:op.op_id,updated_at:new Date().toISOString()};
      let result;
      if(op.expected_version===0){
        try{
          result=await this.req('/rest/v1/study_documents','POST',{...base,user_id:this.user.id,version:1},{Prefer:'return=representation'});
        }catch(e){if(e.status!==409)throw e}
      }else{
        result=await this.req('/rest/v1/study_documents?user_id=eq.'+this.user.id+'&namespace=eq.'+encodeURIComponent(op.namespace)+'&item_key=eq.'+encodeURIComponent(op.item_key)+'&version=eq.'+op.expected_version,'PATCH',{...base,version:op.expected_version+1},{Prefer:'return=representation'});
      }
      if(Array.isArray(result)&&result.length===1){this.remote.set(id,result[0]);return true}
      const latest=await this.req('/rest/v1/study_documents?select=namespace,item_key,payload,deleted,version,last_op_id,updated_at&user_id=eq.'+this.user.id+'&namespace=eq.'+encodeURIComponent(op.namespace)+'&item_key=eq.'+encodeURIComponent(op.item_key)+'&limit=1');
      if(latest?.[0])this.remote.set(id,latest[0]);
      if(latest?.[0]?.last_op_id===op.op_id)return true; // 写入已成功，只是客户端丢失响应
      this.conflicts[id]={local:op,remote:latest?.[0]||null};return false;
    }
    async writeAttempt(event){
      try{await this.req('/rest/v1/question_attempts','POST',event,{Prefer:'return=minimal'});return true}
      catch(e){if(e.status===409)return true;throw e}
    }
    async synchronize(){
      if(!this.active||this.inFlight||!this.user)return;
      if(navigator.onLine===false){this.mode='offline';this.announce();return}
      this.inFlight=true;this.mode='syncing';this.error='';this.announce();
      try{
        for(const op of [...this.queue]){
          const id=makeDocId(op.namespace,op.item_key);
          if(this.conflicts[id])continue;
          const ok=await this.writeOne(op);
          if(ok){this.queue=this.queue.filter(x=>x!==op);this.ensureQueueStore()}
        }
        for(const event of [...this.events]){
          await this.writeAttempt(event);this.events=this.events.filter(x=>x!==event);this.ensureEventStore();
        }
        await this.getRemote();this.rebuild();this.lastPull=Date.now();this.lastSync=Date.now();
        this.mode=Object.keys(this.conflicts).length?'conflict':'ready';
      }catch(e){this.error=redact(e.message);this.mode=navigator.onLine===false?'offline':'error'}
      finally{this.inFlight=false;this.announce()}
    }
    listConflicts(){return Object.entries(this.conflicts).map(([key,x])=>({key,...x}))}
    async resolveConflict(key,choice){
      if(!this.conflicts[key])throw Error('冲突已解决或不存在');
      const c=this.conflicts[key],op=c.local;
      if(choice==='remote'){
        this.queue=this.queue.filter(x=>x!==op);delete this.conflicts[key];this.ensureQueueStore();this.rebuild();this.announce();return;
      }
      if(choice==='local'){
        op.expected_version=c.remote?.version||0;op.op_id=rnd();delete this.conflicts[key];this.ensureQueueStore();await this.synchronize();return;
      }
      throw Error('未知处理方式');
    }
    async signout(){
      if(this.queue.length||this.events.length)throw Error('仍有未同步记录，请先恢复网络、解决冲突，或导出备份');
      try{if(this.session)await this.req('/auth/v1/logout','POST',undefined)}catch(_){/* 本机仍需退出 */}
      localStorage.removeItem(SESSION);this.clearSessionState();
    }
    clearSessionState(){
      this.active=false;this.user=null;this.session=null;this.remote.clear();this.queue=[];this.events=[];this.conflicts={};this.shadow={};
      localStorage.removeItem(OWNER);localStorage.removeItem(PLATFORM);localStorage.removeItem(PHYSICAL);
      this.mode=this.configured?'signedout':'setup';this.announce();
      for(const scope of ['platform','physical'])W.dispatchEvent?.(new CustomEvent('m1racle:remote-state',{detail:{scope,state:defaultState(scope)}}));
    }
    exportBackup(){
      const data={format:'m1racle-study-backup-v8',date:new Date().toISOString(),platform:read(PLATFORM,{}),physical:read(PHYSICAL,{}),pending:this.queue,events:this.events};
      const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=`M1racle_Study_学习备份_${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
    }
  }
  const instance=new Cloud();
  instance.helpers={flatten,unflatten,defaultState};
  if(typeof window!=='undefined'){
    W.addEventListener('load',()=>instance.init().catch(e=>{instance.error=redact(e.message);instance.mode='error';instance.announce()}));
  }
  return instance;
});
