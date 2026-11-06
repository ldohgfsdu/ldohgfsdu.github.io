/* Independent local queue policy. This does not import Anki scheduler state. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.M1racleReview=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const DEFAULTS={newLimit:20,reviewLimit:200};
  const clone=value=>JSON.parse(JSON.stringify(value));
  function empty(){return {version:1,records:{},suspended:{},buried:{},options:{},usage:{},dayStart:4,undo:null};}
  function normalize(value){
    if(!value||value.version!==1)throw new Error('本地复习数据格式不受支持，请先备份浏览器数据');
    const state={...empty(),...value};
    for(const key of ['records','suspended','buried','options','usage']){
      if(!state[key]||typeof state[key]!=='object'||Array.isArray(state[key]))throw new Error('本地复习数据损坏：'+key);
    }
    if(!Number.isInteger(state.dayStart)||state.dayStart<0||state.dayStart>23)throw new Error('学习日开始时间无效');
    return state;
  }
  function dayKey(now,dayStart=4){
    const d=new Date(now);
    if(d.getHours()<dayStart)d.setDate(d.getDate()-1);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function nextBoundary(now,dayStart=4){
    const d=new Date(now);d.setHours(dayStart,0,0,0);
    if(d.getTime()<=+new Date(now))d.setDate(d.getDate()+1);
    return d.getTime();
  }
  function matches(row,did,decks){
    did=String(did);
    if(did==='all'||String(row.did)===did)return true;
    const parent=decks[did],child=decks[String(row.did)];
    return !!parent&&!!child&&child.startsWith(parent+'::');
  }
  function classify(row,state){
    const n=Number(state.records[row.cid]?.card?.state||0);
    return n===2?'review':n===3?'relearning':n===1?'learning':'new';
  }
  function isBuried(row,state,now){return Number(state.buried[row.cid]||0)>+new Date(now);}
  function dueTime(row,state){
    const r=state.records[row.cid];
    return Date.parse(r?.card?.due||r?.due||'');
  }
  function due(row,state,now){
    if(state.suspended[row.cid]||isBuried(row,state,now))return false;
    if(classify(row,state)==='new')return true;
    const time=dueTime(row,state);
    if(!Number.isFinite(time))return false;
    return classify(row,state)==='review'?time<nextBoundary(now,state.dayStart):time<=+new Date(now);
  }
  function budgetKind(row,state,now){
    const kind=classify(row,state);
    if(kind==='new'||kind==='review')return kind;
    const r=state.records[row.cid];
    // Repetitions on the same study day are exempt from daily review limits.
    const last=r?.reviewedAt||r?.card?.last_review;
    return last&&dayKey(last,state.dayStart)!==dayKey(now,state.dayStart)?'review':null;
  }
  function settings(state,did){return {...DEFAULTS,...state.options[String(did)]};}
  function used(state,decks,did,kind,now){
    const day=state.usage[dayKey(now,state.dayStart)]||{};
    return Object.entries(day).reduce((sum,[id,counts])=>sum+(matches({did:id},did,decks)?Number(counts[kind]||0):0),0);
  }
  function sort(rows,state){
    const rank=row=>({learning:0,relearning:0,review:1,new:2})[classify(row,state)];
    return rows.slice().sort((a,b)=>rank(a)-rank(b)||(dueTime(a,state)||0)-(dueTime(b,state)||0)||Number(a.cid)-Number(b.cid));
  }
  function selectQueue(rows,state,decks,did,scope,now){
    const scoped=sort(rows.filter(row=>matches(row,did,decks)),state);
    if(scope==='all')return scoped;
    const reserved={},queue=[];
    for(const row of scoped){
      if(!due(row,state,now))continue;
      const kind=budgetKind(row,state,now);
      const parents=['all',...Object.keys(decks).filter(id=>matches(row,id,decks))];
      if(!parents.includes(String(row.did)))parents.push(String(row.did));
      if(kind&&parents.some(id=>used(state,decks,id,kind,now)+(reserved[id]?.[kind]||0)>=settings(state,id)[kind+'Limit']))continue;
      queue.push(row);
      if(kind)for(const id of parents){reserved[id]??={new:0,review:0};reserved[id][kind]++;}
    }
    return queue;
  }
  function counts(rows,state,decks,did,now){
    const scoped=rows.filter(row=>matches(row,did,decks));
    const out={new:0,learning:0,relearning:0,review:0,suspended:0,buried:0,due:0,available:0,reviewed:0};
    for(const row of scoped){
      if(state.records[row.cid])out.reviewed++;
      if(state.suspended[row.cid])out.suspended++;
      else if(isBuried(row,state,now))out.buried++;
      else out[classify(row,state)]++;
      if(due(row,state,now))out.due++;
    }
    out.available=selectQueue(rows,state,decks,did,'due',now).length;
    return out;
  }
  function grade(state,row,result,rating,now){
    if(!Number.isInteger(rating)||rating<1||rating>4)throw new Error('评分无效');
    if(state.suspended[row.cid]||isBuried(row,state,now))throw new Error('请先恢复当前卡片再评分');
    if(!result?.card||!Number.isFinite(+new Date(result.card.due)))throw new Error('调度结果无效');
    const next=clone(state),cid=String(row.cid),did=String(row.did),day=dayKey(now,state.dayStart);
    const prior=next.records[cid]||null;
    const priorUsage=next.usage[day]?.[did]||null;
    const history=(prior?.history||[]).slice(-199);
    history.push({at:new Date(now).toISOString(),rating,due:result.card.due,state:result.card.state});
    const record=clone({card:result.card,due:result.card.due,reviewedAt:new Date(now).toISOString(),grade:rating,history});
    next.records[cid]=record;
    const kind=budgetKind(row,state,now);
    if(kind){
      next.usage[day]??={};next.usage[day][did]={new:0,review:0,...priorUsage};
      next.usage[day][did][kind]++;
    }
    next.undo=clone({cid,prior,after:record,day,did,priorUsage,afterUsage:next.usage[day]?.[did]||null});
    return next;
  }
  function undo(state){
    const info=state.undo;
    if(!info)throw new Error('没有可撤销的评分记录');
    if(JSON.stringify(state.records[info.cid])!==JSON.stringify(info.after)||JSON.stringify(state.usage[info.day]?.[info.did]||null)!==JSON.stringify(info.afterUsage))throw new Error('评分记录已改变，无法安全撤销');
    const next=clone(state);
    if(info.prior===null)delete next.records[info.cid];else next.records[info.cid]=info.prior;
    if(info.priorUsage===null){if(next.usage[info.day])delete next.usage[info.day][info.did];}
    else{next.usage[info.day]??={};next.usage[info.day][info.did]=info.priorUsage;}
    next.undo=null;
    return next;
  }
  function suspend(state,cid){const next=clone(state);if(next.suspended[cid])delete next.suspended[cid];else next.suspended[cid]=true;return next;}
  function bury(state,cid,now){const next=clone(state);next.buried[cid]=nextBoundary(now,state.dayStart);return next;}
  function unbury(state,rows,decks,did){
    const next=clone(state);
    for(const row of rows)if(matches(row,did,decks))delete next.buried[row.cid];
    return next;
  }
  function configure(state,did,options,dayStart){
    for(const key of ['newLimit','reviewLimit'])if(!Number.isInteger(options[key])||options[key]<0||options[key]>100000)throw new Error('每日上限须为 0 到 100000 的整数');
    if(!Number.isInteger(dayStart)||dayStart<0||dayStart>23)throw new Error('学习日开始时间须为 0 到 23 的整数');
    const next=clone(state);next.options[String(did)]={...options};next.dayStart=dayStart;return next;
  }
  function reset(state){const next=clone(state);next.records={};next.usage={};next.undo=null;return next;}
  function nextWake(rows,state,decks,did,now){
    const times=rows.filter(row=>matches(row,did,decks)&&!state.suspended[row.cid]).flatMap(row=>{
      const time=dueTime(row,state);
      return [Number(state.buried[row.cid]||0),classify(row,state)==='review'?0:time];
    }).filter(t=>Number.isFinite(t)&&t>+new Date(now));
    return Math.min(nextBoundary(now,state.dayStart),...times);
  }
  return {empty,normalize,dayKey,nextBoundary,matches,classify,isBuried,dueTime,due,budgetKind,settings,used,sort,selectQueue,counts,grade,undo,suspend,bury,unbury,configure,reset,nextWake};
});
