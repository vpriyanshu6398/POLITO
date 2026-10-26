/* POLITO Parliamentary Constituency search and full-page profiles */
(function politisoParliamentaryProfiles(){
  const $id=id=>document.getElementById(id);
  const norm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('en-IN');
  function parseCSV(text){
    const rows=[]; let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];
      if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
      else if(c==='"')quoted=true;
      else if(c===','){row.push(field);field='';}
      else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}
      else if(c!=='\r')field+=c;
    }
    if(field.length||row.length){row.push(field);rows.push(row);}
    return rows;
  }
  const loadCSV=async path=>{
    const res=await fetch(path); if(!res.ok) throw new Error('Could not load '+path);
    const rows=parseCSV(await res.text()); const headerIndex=rows.findIndex(r=>r.some(c=>/^(State|State_Name|PC Name|PC NAME|PC No|PC NO|Candidate|Candidate Name)$/i.test(String(c).trim())));
    if(headerIndex<0)throw new Error('CSV header not found: '+path);
    const headers=rows[headerIndex].map(v=>String(v).trim());
    return rows.slice(headerIndex+1).filter(r=>r.some(v=>String(v).trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,String(r[i]??'').trim()])));
  };
  const field=(r,...names)=>{for(const n of names)if(r[n]!=null&&r[n]!=='')return r[n];return '';};
  let pcs=[],results24=[],candidates19=[],segments19=[],segments24=[],summary=[];
  const dataReady=(async()=>{
    try{
      results24=await loadCSV('data/up-lok-sabha-2024-results.csv');
      results24=results24.filter(r=>/^(uttar pradesh|up)$/i.test(field(r,'State').replace(/_/g,' ')));
      const pcMap=new Map();
      results24.forEach(r=>{const name=field(r,'PC Name','PC NAME');if(name&&!pcMap.has(norm(name)))pcMap.set(norm(name),name);});
      pcs=[...pcMap.values()].map(name=>({name,meta:'Parliamentary Constituency · Uttar Pradesh',type:'Parliamentary Constituency'}));
      console.log('POLITO Parliamentary search ready:',pcs.length,'PCs');
      if(input?.value)showSearchResults(input.value);
    }catch(err){console.error('POLITO 2024 parliamentary data failed:',err);}
    try{
      const [c19,s19,s24,sum]=await Promise.all([
        loadCSV('data/up-lok-sabha-2019-candidates.csv'),
        loadCSV('data/up-lok-sabha-2019-segments.csv'),
        loadCSV('data/up-lok-sabha-2024-segments.csv'),
        loadCSV('data/7. Constituency (PC) wise Summary (1).csv')
      ]);
      const isUP=r=>/^(uttar pradesh|up)$/i.test(field(r,'State','State_Name','State-UT Code & Name','State/UT Name').replace(/_/g,' '));
      candidates19=c19.filter(r=>isUP(r)&&field(r,'Year')==='2019'&&/Lok Sabha/i.test(field(r,'Election_Type')));
      segments19=s19.filter(isUP);
      segments24=s24.filter(isUP);
      summary=sum.filter(r=>/^\d+$/.test(field(r,'PC No'))&&field(r,'PC Name'));
      console.log('POLITO Parliamentary profile data ready:',{candidates2019:candidates19.length,segments2019:segments19.length,segments2024:segments24.length,summary:summary.length});
      if(input?.value)showSearchResults(input.value);
    }catch(err){console.error('POLITO additional parliamentary data failed:',err);}
  })();

  function getPCRows(year,name){
    const src=year===2024?results24:candidates19;
    return src.filter(r=>{
      const nm=field(r,'PC Name','PC NAME','Constituency_Name');
      if(nm&&norm(nm)===norm(name))return true;
      const no=field(r,'PC No','PC NO','Constituency_No');
      const sumRow=summary.find(s=>norm(field(s,'PC Name'))===norm(name));
      return !!sumRow&&no===field(sumRow,'PC No')&&(!nm||!norm(nm));
    }).map(r=>({
      candidate:field(r,'Candidate','CANDIDATE NAME','Candidate Name'),
      party:field(r,'Party','PARTY'),
      votes:Number(field(r,'Total Votes','Votes','VOTES SECURED EVM'))||0,
      share:Number(field(r,'Vote Share','Vote_Share_Percentage'))||0,
      position:Number(field(r,'Sl no','Position'))||0
    })).filter(r=>r.candidate).sort((a,b)=>b.votes-a.votes);
  }
  function getSummary(name){return summary.find(r=>norm(field(r,'PC Name'))===norm(name));}
  function getSegments(year,name){
    const src=year===2024?segments24:segments19;
    const set=new Map();
    src.filter(r=>norm(field(r,'PC NAME','PC Name'))===norm(name)).forEach(r=>{
      const ac=field(r,'AC NAME','AC Name');if(ac&&!set.has(norm(ac)))set.set(norm(ac),ac);
    });
    return [...set.values()];
  }
  function getSegmentResults(year,name){
    const src=year===2024?segments24:segments19;
    const pcSummary=getSummary(name);
    const pcNo=field(pcSummary,'PC No');
    const groups=new Map();
    src.filter(r=>{
      const pcName=field(r,'PC NAME','PC Name');
      const rowPcNo=field(r,'PC NO','PC No');
      return norm(pcName)===norm(name)||(pcNo&&rowPcNo===pcNo);
    }).forEach(r=>{
      const ac=field(r,'AC NAME','AC Name');
      if(!ac)return;
      const key=field(r,'AC NO','AC No')||norm(ac);
      if(!groups.has(key))groups.set(key,{name:ac,rows:[]});
      groups.get(key).rows.push({
        candidate:field(r,'CANDIDATE NAME','Candidate Name'),
        party:field(r,'PARTY','Party'),
        votes:Number(field(r,'VOTES SECURED EVM','Votes'))||0
      });
    });
    return [...groups.values()].map(group=>{
      const rows=group.rows.sort((a,b)=>b.votes-a.votes);
      const valid=rows.filter(r=>norm(r.party)!=='nota'&&norm(r.candidate)!=='noneoftheabove');
      return {
        name:group.name,
        leader:valid[0],
        runner:valid[1],
        margin:valid.length>1?valid[0].votes-valid[1].votes:null
      };
    }).sort((a,b)=>a.name.localeCompare(b.name));
  }
  async function openPC(name){
    await dataReady;
    const r24=getPCRows(2024,name),r19=getPCRows(2019,name),s=getSummary(name);
    const segs=getSegments(2024,name);
    const segmentResults19=getSegmentResults(2019,name),segmentResults24=getSegmentResults(2024,name);
    const winner=r24[0],runner=r24[1];
    let old=$id('politiso-pc-profile');if(old)old.remove();
    const overlay=document.createElement('div');overlay.id='politiso-pc-profile';overlay.className='politiso-pc-profile';
    const candidateTable=(rows,year)=>rows.length?`<div class="pc-table-wrap"><table class="pc-results-table"><thead><tr><th>#</th><th>Candidate</th><th>Party</th><th>Votes</th><th>Vote share</th></tr></thead><tbody>${rows.map((r,i)=>{const role=i===0?'winner':i===1?'runner-up':'candidate';const rowClass=i===0?'pc-winner':i===1?'pc-runner-up':'';const roleLabel=i===0?'Winner':i===1?'Runner-up':'Candidate';return `<tr class="${rowClass}"><td>${i+1}</td><td>${esc(r.candidate)} <span class="pc-role-tag pc-role-${role}">${roleLabel}</span></td><td>${esc(r.party||'—')}</td><td>${fmt(r.votes)}</td><td>${r.share? r.share.toFixed(2)+'%':(rows.reduce((a,b)=>a+b.votes,0)?(r.votes/rows.reduce((a,b)=>a+b.votes,0)*100).toFixed(2)+'%':'—')}</td></tr>`}).join('')}</tbody></table></div>`:`<p class="pc-empty">Candidate-level ${year} result data is not available for this constituency.</p>`;
    const candidateBars=(rows)=>rows.length?`<div class="pc-vote-bars">${rows.slice(0,8).map((r,i)=>{const total=rows.reduce((a,b)=>a+b.votes,0);const pct=r.share|| (total?r.votes/total*100:0);return `<div class="pc-vote-bar-row"><div class="pc-vote-bar-label"><b>${esc(r.party||'Independent')}</b><small>${esc(r.candidate)}</small></div><div class="pc-vote-bar-track"><span style="width:${Math.max(0,Math.min(100,pct))}%;background:${i===0?'#16845b':['#3978d4','#e99a43','#319879','#9164cc','#d85d68','#64748b'][i%6]}"></span></div><strong>${pct.toFixed(2)}%</strong></div>`}).join('')}</div>`:'';
    const segmentTable=(results,year)=>results.length?`<div class="pc-table-wrap"><table class="pc-results-table pc-segment-results-table"><thead><tr><th>Assembly constituency</th><th>Leading candidate / party</th><th>Lead votes</th><th>Runner-up</th><th>Lead margin</th></tr></thead><tbody>${results.map(segment=>`<tr class="${segment.leader?'pc-winner':''}"><td>${esc(segment.name)}</td><td>${segment.leader?`<b>${esc(segment.leader.candidate)}</b><div class="pc-muted">${esc(segment.leader.party)}</div>`:'Result unavailable'}</td><td>${segment.leader?fmt(segment.leader.votes):'—'}</td><td>${segment.runner?`${esc(segment.runner.candidate)}<div class="pc-muted">${esc(segment.runner.party)}</div>`:'—'}</td><td>${segment.margin==null?'—':fmt(segment.margin)}</td></tr>`).join('')}</tbody></table></div>`:`<p class="pc-empty">Assembly-segment results are not available in the supplied ${year} dataset.</p>`;
    overlay.innerHTML=`<div class="pc-profile-top"><button type="button" class="pc-back" id="pcProfileBack">← Back to POLITO</button><span class="section-kicker">POLITO · UTTAR PRADESH · LOK SABHA</span><h1>${esc(name)}</h1><p>Parliamentary Constituency profile</p></div>
      <div class="pc-profile-content">
      <div class="pc-metric-grid">
       <article class="pc-metric"><small>2024 WINNER</small><strong>${esc(winner?.candidate||'Data unavailable')}</strong><span>${esc(winner?.party||'')}</span></article>
       <article class="pc-metric"><small>WINNING MARGIN · 2024</small><strong>${winner&&runner?fmt(winner.votes-runner.votes):'—'}</strong><span>${winner&&runner?`over ${esc(runner.candidate)}`:'Not available'}</span></article>
       <article class="pc-metric"><small>REGISTERED ELECTORS</small><strong>${s?fmt(field(s,'Electors')):'—'}</strong><span>Electoral summary</span></article>
       <article class="pc-metric"><small>VOTER TURNOUT · 2024</small><strong>${s?esc(field(s,'Voters Turn Out (%)'))+'%':'—'}</strong><span>${s?fmt(field(s,'Voters'))+' voters':'Summary unavailable'}</span></article>
      </div>
      <section class="pc-profile-section"><div class="pc-section-head"><div><span class="section-kicker">GENERAL ELECTION</span><h2>2024 Lok Sabha Results</h2></div><span class="pc-pill">${r24.length} candidates</span></div><h3>Vote-share graphics</h3>${candidateBars(r24)}${candidateTable(r24,2024)}</section>
      <section class="pc-profile-section"><div class="pc-section-head"><div><span class="section-kicker">PREVIOUS ELECTION</span><h2>2019 Lok Sabha Results</h2></div><span class="pc-pill">${r19.length} candidates</span></div><h3>Vote-share graphics</h3>${candidateBars(r19)}${candidateTable(r19,2019)}</section>
      <section class="pc-profile-section"><div class="pc-section-head"><div><span class="section-kicker">ASSEMBLY SEGMENTS · 2024 LOK SABHA ELECTION</span><h2>Segment leads in ${esc(name)}</h2></div><span class="pc-pill">${segmentResults24.length||segs.length||'—'} segments</span></div><p class="pc-muted">Leading candidate, party, votes and margin in each Assembly constituency.</p>${segmentTable(segmentResults24,2024)}<p class="pc-data-note">Segment leads are based on the 2024 Lok Sabha votes recorded within each Assembly constituency; they are not 2022 Assembly election results.</p></section>
      <section class="pc-profile-section"><div class="pc-section-head"><div><span class="section-kicker">ASSEMBLY SEGMENTS · 2019 LOK SABHA ELECTION</span><h2>Segment results in ${esc(name)}</h2></div><span class="pc-pill">${segmentResults19.length} segments</span></div><p class="pc-muted">Leading candidate, party, votes and margin in each Assembly constituency.</p>${segmentTable(segmentResults19,2019)}</section>
      </div>`;
    document.body.appendChild(overlay);document.body.classList.add('pc-profile-open');
    overlay.querySelector('#pcProfileBack').addEventListener('click',()=>{overlay.remove();document.body.classList.remove('pc-profile-open');location.hash='#constituencies';});
    window.scrollTo({top:0,behavior:'instant'});
    location.hash='#parliamentary';
  }

  window.POLITISO_OPEN_PC = openPC;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      const p=document.getElementById('politiso-pc-profile');
      if(p){p.remove();document.body.classList.remove('pc-profile-open');}
      const s=document.getElementById('politisoSeatFullPage');
      if(s){s.remove();document.body.classList.remove('pc-profile-open');}
    }
  });
})();
