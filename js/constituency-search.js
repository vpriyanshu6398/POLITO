const searchData = [
  {name:"Sirsaganj",meta:"Assembly constituency · Firozabad district",type:"Constituency"},
  {name:"Firozabad",meta:"District · Assembly and Lok Sabha data",type:"District"},
  {name:"Uttar Pradesh Assembly Results",meta:"2017 & 2022 · 403 constituencies",type:"Election"},
  {name:"Uttar Pradesh Parliamentary Results",meta:"2019 & 2024 · 80 parliamentary constituencies",type:"Election"},
  {name:"Local Elections",meta:"Municipal and Panchayat results",type:"Election"},
  {name:"2027 Forecast Desk",meta:"Forecast framework · not yet populated",type:"Analysis"}
];

const input = $("#globalSearch");
const results = $("#searchResults");

const searchNormalize = value => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]/g, "");

const searchEscape = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

let assemblySeats = [];
let electionResults = new Map();
let assemblyCandidateSearchRecords = [];
let assembly2017CandidateSearchPromise;
let assembly2017CandidateSearchError = "";

function getSeatName(feature) {
  const p = feature.properties || {};
  return p.AC_NAME || p.ac_name || p.NAME || p.name || p.constituency || "Assembly constituency";
}

function getDistrict(feature) {
  const p = feature.properties || {};
  return p.DIST_NAME || p.dist_name || p.DISTRICT || p.district || "Uttar Pradesh";
}

let parliamentarySeats = new Map();
let parliamentary2019 = new Map();
let parliamentary2024 = new Map();
let parliamentaryElectors2019 = new Map();
let parliamentarySegments = new Map();

function parseSearchCSV(text) {
  const rows=[]; let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'&&quoted&&text[i+1]==='"'){field+='"';i++;}
    else if(c==='"')quoted=!quoted;
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()!==''))rows.push(row);row=[];field='';}
    else field+=c;
  }
  row.push(field);if(row.some(v=>v.trim()!==''))rows.push(row);return rows;
}
function readCsvObjects(text){const rows=parseSearchCSV(text.replace(/^\uFEFF/,''));const headers=(rows.shift()||[]).map(v=>v.trim());return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||'').trim()])));}
function groupCandidates(rows){rows.sort((a,b)=>b.votes-a.votes);const total=rows.reduce((sum,r)=>sum+r.votes,0);const valid=rows.filter(r=>searchNormalize(r.party)!=='nota'&&searchNormalize(r.candidate)!=='noneoftheabove');return {rows,total,winner:valid[0],runner:valid[1],margin:valid.length>1?valid[0].votes-valid[1].votes:null};}
function loadParliamentaryData(){
  Promise.all([
    fetch('data/up-lok-sabha-2024-results.csv').then(r=>{if(!r.ok)throw Error('2024 Lok Sabha results file missing');return r.text()}),
    fetch('data/up-lok-sabha-2019-candidates.csv').then(r=>{if(!r.ok)throw Error('2019 Lok Sabha candidates file missing');return r.text()}),
    fetch('data/up-lok-sabha-2024-segments.csv').then(r=>{if(!r.ok)throw Error('2024 segment data missing');return r.text()})
  ]).then(([csv24,csv19,segcsv])=>{
    const rows24=readCsvObjects(csv24).filter(r=>searchNormalize(r.State)==='uttarpradesh');
    rows24.forEach(r=>{const name=r['PC Name'];if(!name)return;const key=searchNormalize(name);if(!parliamentarySeats.has(key))parliamentarySeats.set(key,name);if(!parliamentary2024.has(key))parliamentary2024.set(key,[]);parliamentary2024.get(key).push({candidate:r.Candidate,party:r.Party,votes:Number(r['Total Votes'])||0,share:Number(r['Vote Share'])||0});});
    for(const [key,rows] of parliamentary2024)parliamentary2024.set(key,groupCandidates(rows));
    const rows19=readCsvObjects(csv19).filter(r=>searchNormalize(String(r.State_Name||'').replace(/_/g,' '))==='uttarpradesh'&&String(r.Year)==='2019');
    rows19.forEach(r=>{const name=(r.Constituency_Name||'').trim();if(!name)return;const key=searchNormalize(name);if(!parliamentarySeats.has(key))parliamentarySeats.set(key,name);if(!parliamentary2019.has(key))parliamentary2019.set(key,[]);parliamentary2019.get(key).push({candidate:r.Candidate,party:r.Party,votes:Number(r.Votes)||0,share:Number(r.Vote_Share_Percentage)||0});if(r.Electors)parliamentaryElectors2019.set(key,{electors:Number(r.Electors)||0,turnout:Number(r.Turnout_Percentage)||0,validVotes:Number(r.Valid_Votes)||0});});
    for(const [key,rows] of parliamentary2019)parliamentary2019.set(key,groupCandidates(rows));
    const segRows=parseSearchCSV(segcsv.replace(/^\uFEFF/,''));
    const segHeader=segRows.findIndex(row=>row.some(c=>searchNormalize(c)==='stateutname')&&row.some(c=>searchNormalize(c)==='acname'));
    if(segHeader>=0){const h=segRows[segHeader].map(c=>searchNormalize(c));const ix={state:h.indexOf('stateutname'),pc:h.indexOf('pcname'),ac:h.indexOf('acname')};for(const r of segRows.slice(segHeader+1)){if(searchNormalize(r[ix.state])!=='uttarpradesh')continue;const k=searchNormalize(r[ix.pc]),ac=(r[ix.ac]||'').trim();if(!k||!ac)continue;if(!parliamentarySegments.has(k))parliamentarySegments.set(k,new Set());parliamentarySegments.get(k).add(ac);}}
    console.log('POLITO parliamentary seats loaded:',parliamentarySeats.size,'2019:',parliamentary2019.size,'2024:',parliamentary2024.size,'segment groups:',parliamentarySegments.size);
    if(input?.value)showSearchResults(input.value);
  }).catch(e=>console.error('Parliamentary search data error:',e));
}

function openParliamentaryProfile(name){
  const key=searchNormalize(name),display=parliamentarySeats.get(key)||name;
  const y19=parliamentary2019.get(key),y24=parliamentary2024.get(key),stats19=parliamentaryElectors2019.get(key);
  const esc=searchEscape,fmt=n=>Number(n||0).toLocaleString('en-IN');
  const share=(r,total)=>Number.isFinite(r.share)&&r.share>0?r.share:(total?r.votes/total*100:0);
  const table=group=>group?`<div class="pp-table-wrap"><table class="pp-table"><thead><tr><th>#</th><th>Candidate / Party</th><th>Votes</th><th>Vote share</th></tr></thead><tbody>${group.rows.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.candidate)}</b><div class="pp-muted">${esc(r.party)}</div></td><td>${fmt(r.votes)}</td><td>${share(r,group.total).toFixed(2)}%</td></tr>`).join('')}</tbody></table></div>`:'<div class="pp-error">Results unavailable in the supplied dataset.</div>';
  const cards=(g,label)=>g?`<div class="pp-stats"><article class="pp-card"><div class="pp-label">WINNER</div><div class="pp-big">${esc(g.winner?.candidate||'Unavailable')}</div><div class="pp-muted">${esc(g.winner?.party||'')}</div><strong>${fmt(g.winner?.votes)} votes</strong></article><article class="pp-card"><div class="pp-label">RUNNER-UP</div><div class="pp-big">${esc(g.runner?.candidate||'Unavailable')}</div><div class="pp-muted">${esc(g.runner?.party||'')}</div><strong>${fmt(g.runner?.votes)} votes</strong></article><article class="pp-card"><div class="pp-label">WINNING MARGIN</div><div class="pp-big">${g.margin==null?'—':fmt(g.margin)}</div><div class="pp-muted">votes</div></article></div>`:'<div class="pp-error">Results unavailable in the supplied dataset.</div>';
  const bars=g=>g?g.rows.slice(0,8).map((r,i)=>`<div class="pp-bar-row"><div><b>${esc(r.party)}</b><small>${esc(r.candidate)}</small></div><div class="pp-track"><div style="height:100%;width:${Math.min(100,share(r,g.total))}%;background:${['#3978d4','#e99a43','#319879','#9164cc','#d85d68','#64748b'][i%6]};border-radius:20px"></div></div><strong>${share(r,g.total).toFixed(1)}%</strong></div>`).join(''):'<p>Vote-share chart unavailable.</p>';
  let page=document.getElementById('politisoParliamentFullPage');if(!page){page=document.createElement('section');page.id='politisoParliamentFullPage';page.style.cssText='position:fixed;inset:0;z-index:10060;overflow:auto;background:#f3f6fb;color:#17243a;font-family:inherit';document.body.appendChild(page);}
  page.innerHTML=`<style>#politisoParliamentFullPage *{box-sizing:border-box}.pp-top{position:sticky;top:0;z-index:2;background:#101b30;color:#fff;padding:16px clamp(14px,4vw,48px);display:flex;justify-content:space-between;align-items:center;gap:14px}.pp-back{background:#273750;color:#fff;border:1px solid #56647a;border-radius:10px;padding:10px 14px;font:inherit;cursor:pointer}.pp-wrap{max-width:1240px;margin:auto;padding:28px clamp(12px,3vw,30px) 60px}.pp-kicker{font-size:11px;font-weight:800;letter-spacing:1.5px;color:#6d7b92}.pp-title{font-size:clamp(32px,5vw,50px);margin:9px 0}.pp-muted{color:#758198;font-size:13px;line-height:1.55}.pp-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.pp-card,.pp-panel{background:white;border:1px solid #e1e7f0;border-radius:17px;padding:19px;box-shadow:0 6px 22px #182d4a08;min-width:0}.pp-label{font-size:11px;letter-spacing:.5px;color:#748199;font-weight:800}.pp-big{font-size:clamp(19px,2.6vw,28px);font-weight:800;margin:9px 0;overflow-wrap:anywhere}.pp-section{margin:28px 0 12px}.pp-section h2{font-size:24px;margin:8px 0}.pp-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pp-bar-row{display:grid;grid-template-columns:minmax(90px,145px) 1fr 48px;gap:10px;align-items:center;margin:16px 0;font-size:12px}.pp-bar-row small{display:block;color:#8490a3;margin-top:3px;overflow-wrap:anywhere}.pp-track{height:12px;background:#edf1f7;border-radius:20px;overflow:hidden}.pp-table-wrap{overflow:auto}.pp-table{width:100%;min-width:590px;border-collapse:collapse;font-size:13px}.pp-table th,.pp-table td{padding:13px 10px;border-bottom:1px solid #edf0f5;text-align:left}.pp-table th{font-size:11px;color:#748199}.pp-table td:nth-child(n+3),.pp-table th:nth-child(n+3){text-align:right}.pp-error{padding:18px;border:1px solid #f2d1a7;background:#fff8ed;border-radius:12px;color:#7c4b12}@media(max-width:760px){.pp-stats,.pp-grid{grid-template-columns:1fr}.pp-card,.pp-panel{padding:15px}}</style><header class="pp-top"><div><b style="font-size:19px;letter-spacing:1px">POLITO</b><div style="font-size:11px;color:#bdc8d9;margin-top:4px">PARLIAMENTARY CONSTITUENCY PROFILE</div></div><button class="pp-back" id="ppBack">← Back to search</button></header><main class="pp-wrap"><div class="pp-kicker">UTTAR PRADESH · LOK SABHA</div><h1 class="pp-title">${esc(display)}</h1><p class="pp-muted">Parliamentary constituency election profile · Uttar Pradesh</p><section class="pp-section"><div class="pp-kicker">2019 ELECTION</div><h2>Lok Sabha Election 2019</h2><p class="pp-muted">Candidate votes and vote share from the supplied 2019 candidate dataset.</p></section>${cards(y19)}<div class="pp-grid"><article class="pp-panel"><h3>2019 vote-share graphics</h3>${bars(y19)}</article><article class="pp-panel"><h3>2019 candidate results</h3>${table(y19)}</article></div><section class="pp-section"><div class="pp-kicker">2024 ELECTION</div><h2>Lok Sabha Election 2024</h2><p class="pp-muted">Candidate votes and vote share from the supplied 2024 results dataset.</p></section>${cards(y24)}<div class="pp-grid"><article class="pp-panel"><h3>2024 vote-share graphics</h3>${bars(y24)}</article><article class="pp-panel"><h3>2024 candidate results</h3>${table(y24)}</article></div>${stats19?`<section class="pp-section"><h2>2019 electorate statistics</h2><div class="pp-stats"><article class="pp-card"><div class="pp-label">TOTAL ELECTORS</div><div class="pp-big">${fmt(stats19.electors)}</div></article><article class="pp-card"><div class="pp-label">TURNOUT</div><div class="pp-big">${stats19.turnout.toFixed(2)}%</div></article><article class="pp-card"><div class="pp-label">VALID VOTES</div><div class="pp-big">${fmt(stats19.validVotes)}</div></article></div></section>`:''}<section class="pp-section"><h2>Assembly segments</h2><p class="pp-muted">Assembly constituencies that form this Parliamentary Constituency, from the supplied 2024 segment dataset.</p><div class="pp-panel">${[...(parliamentarySegments.get(key)||[])].map(ac=>`<span style="display:inline-block;padding:7px 10px;margin:4px;border:1px solid #e1e7f0;border-radius:9px;background:#fff">${esc(ac)}</span>`).join('')||'Assembly segment list unavailable in the supplied dataset.'}</div></section></main>`;
  page.hidden=false;page.scrollTop=0;document.body.style.overflow='hidden';page.querySelector('#ppBack').addEventListener('click',()=>{page.remove();document.body.style.overflow='';});
}

let parliamentaryList = [];

function indexParliamentarySeats(features) {
  const pcGroup = new Map();
  (features || []).forEach(f => {
    const p = f.properties || {};
    const pc = (p.pc_name || '').trim();
    if (!pc) return;
    const key = searchNormalize(pc);
    if (!pcGroup.has(key)) {
      pcGroup.set(key, {
        name: pc,
        pcNo: p.pc || '',
        segments: []
      });
    }
    const acName = (p.ac_name || getSeatName(f) || '').trim();
    if (acName && !pcGroup.get(key).segments.includes(acName)) {
      pcGroup.get(key).segments.push(acName);
    }
  });
  parliamentaryList = [...pcGroup.values()];
}

function showSearchResults(query) {
  if (!input || !results) return;
  const q = searchNormalize(query.trim());
  if (!q) { results.innerHTML = ''; results.hidden = true; return; }
  if (q.length >= 3 && !assembly2017CandidateSearchPromise) {
    assembly2017CandidateSearchPromise = loadUPAssembly2017Data().then(data => {
      for (const seat of data.seats.values()) {
        for (const candidate of seat.rows) {
          assemblyCandidateSearchRecords.push({
            candidate: candidate.candidate,
            party: candidate.party,
            year: 2017,
            constituency: seat.name,
            constituencyNumber: candidate.constituencyNumber
          });
        }
      }
      if (input?.value) showSearchResults(input.value);
    }).catch(error => {
      assembly2017CandidateSearchError = error.message;
      console.error("2017 Assembly candidate search data could not load:", error);
      if (input?.value) showSearchResults(input.value);
    });
  }

  // 1. Parliamentary Constituencies (Lok Sabha)
  const pcMatches = parliamentaryList.filter(pc => {
    const key = searchNormalize(pc.name);
    const no = String(pc.pcNo || '').trim();
    return key.includes(q) || no === q;
  }).sort((a, b) => {
    const an = searchNormalize(a.name);
    const bn = searchNormalize(b.name);
    if (an === q) return -1;
    if (bn === q) return 1;
    if (an.startsWith(q) && !bn.startsWith(q)) return -1;
    if (bn.startsWith(q) && !an.startsWith(q)) return 1;
    return an.localeCompare(bn);
  });

  // 2. Assembly Constituencies (Vidhan Sabha)
  const acMatches = assemblySeats.filter(feature => {
    const p = feature.properties || {};
    const name = searchNormalize(getSeatName(feature));
    const district = searchNormalize(getDistrict(feature));
    const no = String(p.ac || p.AC_NO || p.ac_no || p.AC || '').trim();
    return name.includes(q) || district.includes(q) || no === q;
  }).sort((a, b) => {
    const an = searchNormalize(getSeatName(a));
    const bn = searchNormalize(getSeatName(b));
    if (an === q) return -1;
    if (bn === q) return 1;
    if (an.startsWith(q) && !bn.startsWith(q)) return -1;
    if (bn.startsWith(q) && !an.startsWith(q)) return 1;
    return an.localeCompare(bn);
  });

  // Convert to formatted result cards
  const pcItems = pcMatches.map(pc => {
    const segCount = pc.segments.length;
    const segSample = pc.segments.slice(0, 5).join(', ') + (pc.segments.length > 5 ? ` +${pc.segments.length - 5} more` : '');
    return {
      kind: 'pc',
      name: pc.name,
      badgeText: 'LOK SABHA · PARLIAMENT',
      meta: pc.pcNo ? `Parliamentary Seat #${pc.pcNo} · ${segCount} Assembly Segments` : `Parliamentary Seat · ${segCount} Assembly Segments`,
      submeta: segCount ? `Segments: ${segSample}` : '',
      actionText: 'Lok Sabha Profile',
      pc: pc
    };
  });

  const acItems = acMatches.map(feature => {
    const p = feature.properties || {};
    const name = getSeatName(feature);
    const dist = getDistrict(feature);
    const no = p.ac || p.AC_NO || p.ac_no || p.AC || '';
    const pcName = p.pc_name || '';
    return {
      kind: 'ac',
      name: name,
      badgeText: 'VIDHAN SABHA · ASSEMBLY',
      meta: no ? `Assembly Seat #${no} · ${dist} district` : `Assembly Seat · ${dist} district`,
      submeta: pcName ? `Part of ${pcName} Lok Sabha seat` : '',
      actionText: 'View on Map & Profile',
      feature: feature
    };
  });

  const candidateItems = q.length >= 3
    ? assemblyCandidateSearchRecords
      .filter(candidate => searchNormalize(candidate.candidate).includes(q))
      .sort((a, b) => {
        const an = searchNormalize(a.candidate);
        const bn = searchNormalize(b.candidate);
        if (an === q && bn !== q) return -1;
        if (bn === q && an !== q) return 1;
        if (an.startsWith(q) && !bn.startsWith(q)) return -1;
        if (bn.startsWith(q) && !an.startsWith(q)) return 1;
        return an.localeCompare(bn) || b.year - a.year;
      })
      .slice(0, 10)
      .map(candidate => {
        const feature = assemblySeats.find(seat => {
          const properties = seat.properties || {};
          const number = String(properties.ac || properties.AC_NO || properties.ac_no || properties.AC || "").trim();
          return candidate.constituencyNumber && number === candidate.constituencyNumber;
        }) || assemblySeats.find(seat =>
          searchNormalize(getSeatName(seat)) === searchNormalize(candidate.constituency)
        );
        return {
          kind: "ac",
          name: feature ? getSeatName(feature) : candidate.constituency,
          badgeText: `CANDIDATE · ${candidate.year} ASSEMBLY`,
          meta: `${candidate.party} · ${candidate.year} Assembly election`,
          submeta: `Candidate: ${candidate.candidate}`,
          actionText: "View Constituency",
          feature
        };
      })
    : [];
  const candidateErrorHtml = assembly2017CandidateSearchError
    ? `<div class="search-empty-state"><span class="empty-icon">!</span><div><b>2017 candidate matches unavailable</b><small>${searchEscape(assembly2017CandidateSearchError)}</small></div></div>`
    : "";

  const districtItems = typeof window.POLITISO_DISTRICT_SEARCH === 'function'
    ? window.POLITISO_DISTRICT_SEARCH(query).map(district => ({
      kind: 'district',
      name: district.name,
      badgeText: 'DISTRICT SCORECARD · 2022',
      meta: district.meta,
      submeta: district.submeta,
      actionText: 'Open Scorecard'
    }))
    : [];
  const districtLoadError = typeof window.POLITISO_DISTRICT_ERROR === 'function'
    ? window.POLITISO_DISTRICT_ERROR()
    : '';
  const districtErrorHtml = districtLoadError
    ? `<div class="search-empty-state"><span class="empty-icon">!</span><div><b>District scorecards unavailable</b><small>${searchEscape(districtLoadError)}</small></div></div>`
    : '';

  // Ranking: If query has exact matches (like "Firozabad"), show both exact matches first
  const exactDistrict = districtItems.filter(item => searchNormalize(item.name) === q);
  const exactPc = pcItems.filter(item => searchNormalize(item.name) === q);
  const exactAc = acItems.filter(item => searchNormalize(item.name) === q);
  const otherDistrict = districtItems.filter(item => searchNormalize(item.name) !== q);
  const otherPc = pcItems.filter(item => searchNormalize(item.name) !== q);
  const otherAc = acItems.filter(item => searchNormalize(item.name) !== q);

  const items = [...exactDistrict, ...exactPc, ...exactAc, ...candidateItems, ...otherDistrict, ...otherPc, ...otherAc].slice(0, 16);

  if (!items.length) {
    results.innerHTML = candidateErrorHtml || districtErrorHtml || `
      <div class="search-empty-state">
        <span class="empty-icon">⌕</span>
        <div>
          <b>No matching seat, district, or candidate found</b>
          <small>Try an Assembly or Parliamentary seat, district, or candidate name.</small>
        </div>
      </div>`;
    results.hidden = false;
    return;
  }

  const pcCount = items.filter(it => it.kind === 'pc').length;
  const acCount = items.filter(it => it.kind === 'ac').length;
  const districtCount = items.filter(it => it.kind === 'district').length;

  const candidateCount = items.filter(it => it.badgeText?.startsWith("CANDIDATE ·")).length;
  const headerHtml = `
    <div class="search-results-header">
      <span>MATCHING RESULTS (${items.length})</span>
      <div class="header-tags">
        ${districtCount ? `<span class="header-pill pill-district"><span class="pill-dot"></span>${districtCount} District${districtCount === 1 ? '' : 's'}</span>` : ''}
        ${pcCount ? `<span class="header-pill pill-pc"><span class="pill-dot"></span>${pcCount} Lok Sabha</span>` : ''}
        ${acCount ? `<span class="header-pill pill-ac"><span class="pill-dot"></span>${acCount} Vidhan Sabha</span>` : ''}
        ${candidateCount ? `<span class="header-pill pill-ac"><span class="pill-dot"></span>${candidateCount} Candidate matches</span>` : ''}
      </div>
    </div>`;

  const itemsHtml = items.map((item, index) => {
    const isPc = item.kind === 'pc';
    const isDistrict = item.kind === 'district';
    return `
      <div class="search-result-item ${isDistrict ? 'item-district' : isPc ? 'item-pc' : 'item-ac'}" role="button" tabindex="0" data-search-index="${index}">
        <div class="item-graphic">
          <div class="item-icon ${isDistrict ? 'icon-district' : isPc ? 'icon-pc' : 'icon-ac'}">
            ${isDistrict ? '▦' : isPc ? '🏛️' : '⌖'}
          </div>
        </div>
        <div class="item-body">
          <div class="item-headline">
            <strong class="item-name">${searchEscape(item.name)}</strong>
            <span class="item-badge ${isDistrict ? 'badge-district' : isPc ? 'badge-pc' : 'badge-ac'}">
              <span class="badge-dot"></span>
              ${item.badgeText}
            </span>
          </div>
          <div class="item-meta">${searchEscape(item.meta)}</div>
          ${item.submeta ? `<div class="item-submeta">${searchEscape(item.submeta)}</div>` : ''}
        </div>
        <div class="item-action ${isDistrict ? 'action-district' : isPc ? 'action-pc' : 'action-ac'}">
          <span class="action-label">${searchEscape(item.actionText)}</span>
          <span class="action-arrow">↗</span>
        </div>
      </div>`;
  }).join('');

  results.innerHTML = headerHtml + itemsHtml + districtErrorHtml + candidateErrorHtml;
  results.hidden = false;

  results.querySelectorAll('[data-search-index]').forEach(el => {
    const choose = () => {
      const item = items[Number(el.dataset.searchIndex)];
      if (!item) return;
      input.value = item.name;
      results.hidden = true;
      if (item.kind === 'pc') {
        if (typeof window.POLITISO_OPEN_PC === 'function') {
          window.POLITISO_OPEN_PC(item.name);
        } else if (typeof openParliamentaryProfile === 'function') {
          openParliamentaryProfile(item.name);
        }
        return;
      }
      if (item.kind === 'district') {
        if (typeof window.POLITISO_OPEN_DISTRICT === 'function') {
          window.POLITISO_OPEN_DISTRICT(item.name);
        }
        return;
      }
      if (item.kind === 'ac') {
        window.dispatchEvent(new CustomEvent('politiso:select-seat', { detail: { name: item.name, feature: item.feature } }));
        window.location.hash = '#constituencies';
        return;
      }
    };
    el.addEventListener('click', choose);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
  });
}

loadParliamentaryData();
input?.addEventListener("input", () => showSearchResults(input.value));

input?.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    const first = results?.querySelector("[data-search-index]");
    if (first) {
      event.preventDefault();
      first.click();
    }
  }

  if (event.key === "Escape" && results) {
    results.hidden = true;
  }
});

fetch("data/up-constituencies.geojson")
  .then(response => {
    if (!response.ok) throw new Error("Constituency data failed to load");
    return response.json();
  })
  .then(data => {
    assemblySeats = data.features || [];
    indexParliamentarySeats(assemblySeats);
    console.log("Constituencies loaded:", assemblySeats.length, "Parliamentary seats indexed:", parliamentaryList.length);
    if (input?.value) showSearchResults(input.value);
  })
  .catch(error => console.error("Constituency search error:", error));

fetch("https://raw.githubusercontent.com/thecont1/india-votes-data/main/data/csv/2022Assembly-UP.csv")
  .then(response => {
    if (!response.ok) throw new Error("Election data failed to load");
    return response.text();
  })
  .then(csv => {
    const rows = csv.trim().split(/\r?\n/).map(row => row.split(","));
    const headers = rows.shift().map(value => value.trim());
    const column = Object.fromEntries(headers.map((name, index) => [name, index]));

    rows.forEach(row => {
      if (row[column.election_year] !== "2022") return;
      if ((row[column.election_state] || "").toUpperCase() !== "UP") return;

      const name = (row[column.constituency] || "").trim();
      if (!name) return;

      const candidate = (row[column.candidate] || "").trim();
      const party = (row[column.party] || "").trim();
      if (candidate) assemblyCandidateSearchRecords.push({candidate,party,year:2022,constituency:name});
      const votes = (Number(row[column.evm_votes]) || 0) +
                    (Number(row[column.postal_votes]) || 0);

      const key = searchNormalize(name);
      if (!electionResults.has(key)) electionResults.set(key, []);
      electionResults.get(key).push({ candidate, party, votes });
    });

    for (const [key, candidates] of electionResults) {
      candidates.sort((a, b) => b.votes - a.votes);
      electionResults.set(key, { winner: candidates[0], candidates });
    }

    if (input?.value) showSearchResults(input.value);
  })
  .catch(error => console.error("2022 results error:", error));

// Independent interactive Assembly constituency map.
// The Overview's local glowing image is not moved or replaced.
(function initAssemblyMap(){
  const mapNode=document.getElementById('upAssemblyMap');
  if(!mapNode||!window.L)return;
  const status=document.getElementById('mapStatus');
  const search=document.getElementById('mapSeatSearch');
  const reset=document.getElementById('mapReset');
  const dialog=document.getElementById('infoDialog');
  const dialogTitle=document.getElementById('dialogTitle');
  const dialogText=document.getElementById('dialogText');
  let map,geoLayer,features=[],selectedLayer=null;
  let resultsByName=new Map();
  let resultsLoadError='';
  const geoJsonUrl='data/up-constituencies.geojson';
  const resultsCsvUrl='https://raw.githubusercontent.com/thecont1/india-votes-data/main/data/csv/2022Assembly-UP.csv';
  const setStatus=t=>{if(status)status.textContent=t};
  const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const votesFmt=n=>Number(n||0).toLocaleString('en-IN');
  const prop=(p,keys)=>{for(const k of keys)if(p&&p[k]!=null&&String(p[k]).trim())return p[k];return ''};
  const seatName=f=>String(prop(f.properties,['AC_NAME','ac_name','ACNAME','NAME','name','constituency','assembly_name'])||'Assembly constituency');
  const seatNo=f=>String(prop(f.properties,['AC_NO','ac_no','ACNO','AC_NUM','ac','number','constituency_no'])||'');
  const district=f=>String(prop(f.properties,['DIST_NAME','dist_name','DISTRICT','district','district_name'])||'Uttar Pradesh');
  const style={color:'#69c8ff',weight:.7,fillColor:'#17558a',fillOpacity:.72};
  const selectedStyle={color:'#fff0b8',weight:2,fillColor:'#e6ad52',fillOpacity:.95};

  let panel=document.getElementById('seatResultsPanel');
  if(!panel&&dialogText){
    panel=document.createElement('div');
    panel.id='seatResultsPanel';
    panel.style.cssText='max-height:48vh;overflow:auto;margin-top:12px;font-size:12px;line-height:1.5';
    dialogText.insertAdjacentElement('afterend',panel);
  }

  let suggestions=document.getElementById('mapSeatSuggestions');
  if(!suggestions){
    suggestions=document.createElement('div');
    suggestions.id='mapSeatSuggestions';
    suggestions.hidden=true;
    suggestions.style.cssText='position:absolute;top:52px;left:12px;width:min(480px,calc(100% - 24px));max-height:320px;overflow:auto;z-index:1000;background:#0d1b2e;border:1px solid #35516f;border-radius:10px;box-shadow:0 12px 32px #0008;color:#eef6ff';
    const parent=mapNode.parentElement;
    if(parent){
      if(getComputedStyle(parent).position==='static')parent.style.position='relative';
      parent.appendChild(suggestions);
    }
  }

  function summarize(rows){
    rows.sort((a,b)=>b.votes-a.votes);
    const valid=rows.filter(r=>normalize(r.party)!=='noneoftheabove'&&normalize(r.candidate)!=='nota');
    return {
      rows,
      winner:valid[0],
      runner:valid[1],
      margin:valid.length>1?valid[0].votes-valid[1].votes:null
    };
  }

  function parseCSV(text){
    const rows=[];
    let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'&&quoted&&text[i+1]==='"'){field+='"';i++}
      else if(c==='"')quoted=!quoted;
      else if(c===','&&!quoted){row.push(field);field=''}
      else if((c==='\n'||c==='\r')&&!quoted){
        if(c==='\r'&&text[i+1]==='\n')i++;
        row.push(field);
        if(row.some(v=>v!==''))rows.push(row);
        row=[];field='';
      }else field+=c;
    }
    row.push(field);
    if(row.some(v=>v!==''))rows.push(row);
    return rows;
  }

  const resultsPromise=fetch(resultsCsvUrl)
    .then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.text()})
    .then(csv=>{
      const rows=parseCSV(csv.replace(/^\uFEFF/,''));
      if(rows.length<100)throw Error('Election CSV is empty or incomplete');
      const headers=rows.shift().map(h=>h.trim());
      const idx=Object.fromEntries(headers.map((h,i)=>[h,i]));
      const val=(r,k)=>r[idx[k]]||'';
      for(const r of rows){
        if(val(r,'election_year')!=='2022'||val(r,'election_state').toUpperCase()!=='UP')continue;
        const name=val(r,'constituency').trim();
        if(!name)continue;
        const evm=Number(val(r,'evm_votes'))||0;
        const postal=Number(val(r,'postal_votes'))||0;
        const item={
          candidate:val(r,'candidate').trim(),
          party:val(r,'party').trim(),
          votes:evm+postal
        };
        const key=normalize(name);
        if(!resultsByName.has(key))resultsByName.set(key,[]);
        resultsByName.get(key).push(item);
      }
      for(const [k,rows] of resultsByName)resultsByName.set(k,summarize(rows));
      return resultsByName;
    })
    .catch(e=>{
      resultsLoadError=e.message;
      console.error('2022 election results could not load:',e);
      return resultsByName;
    });

  let segments2024ByName=new Map();
let segments2024LoadError='';
  let segments2019ByName=new Map();
  let segments2019LoadError='';

const segments2024Promise=fetch('data/up-lok-sabha-2024-segments.csv')
.then(r=>{if(!r.ok)throw Error('2024 segment CSV not found');return r.text()})
.then(csv=>{
  const rows=parseCSV(csv.replace(/^\uFEFF/,''));
  const headerIndex=rows.findIndex(row=>row.some(cell=>normalize(cell)==='stateutname')&&row.some(cell=>normalize(cell)==='acname'));
  if(headerIndex<0)throw Error('Could not find 2024 CSV header row');
  const headers=rows[headerIndex].map(h=>normalize(h));
  const idx=Object.fromEntries(headers.map((h,i)=>[h,i]));
  const findCol=names=>names.map(n=>idx[normalize(n)]).find(i=>i!==undefined);
  const stateCol=findCol(['State/UT Name']);
  const acCol=findCol(['AC NAME']);
  const pcCol=findCol(['PC NAME']);
  const candidateCol=findCol(['CANDIDATE NAME']);
  const partyCol=findCol(['PARTY']);
  const votesCol=findCol(['VOTES SECURED EVM']);
  if(acCol===undefined||partyCol===undefined||votesCol===undefined)throw Error('Required 2024 CSV columns not found: '+headers.join(', '));
  for(const row of rows.slice(headerIndex+1)){
    const state=String(row[stateCol]||'').trim().toLowerCase();
    if(state&&!['uttar pradesh','up'].includes(state))continue;
    const name=String(row[acCol]||'').trim(),party=String(row[partyCol]||'').trim();
    if(!name||!party)continue;
    const votes=Number(String(row[votesCol]||'').replace(/,/g,''))||0;
    const item={candidate:String(row[candidateCol]||'').trim(),party,votes,pc:String(row[pcCol]||'').trim()};
    const key=normalize(name);
    if(!segments2024ByName.has(key))segments2024ByName.set(key,[]);
    segments2024ByName.get(key).push(item);
  }
  for(const [key,list] of segments2024ByName){
    list.sort((a,b)=>b.votes-a.votes);
    const valid=list.filter(r=>normalize(r.party)!=='noneoftheabove'&&normalize(r.candidate)!=='nota');
    segments2024ByName.set(key,{rows:list,winner:valid[0],runner:valid[1],margin:valid.length>1?valid[0].votes-valid[1].votes:null,pc:list[0]?.pc||''});
  }
  if(!segments2024ByName.size)throw Error('No Uttar Pradesh segment rows found');
  console.log('2024 UP Assembly segments loaded:',segments2024ByName.size);
  return segments2024ByName;
}).catch(e=>{segments2024LoadError=e.message;console.error('2024 segment results error:',e);return segments2024ByName;});

const segments2019Promise=fetch('data/up-lok-sabha-2019-segments.csv')
.then(r=>{if(!r.ok)throw Error('2019 segment CSV not found');return r.text()})
.then(csv=>{
  const rows=parseCSV(csv.replace(/^\uFEFF/,''));
  const headerIndex=rows.findIndex(row=>row.some(cell=>normalize(cell)==='stateutcodename')&&row.some(cell=>normalize(cell)==='acname'));
  if(headerIndex<0)throw Error('Could not find 2019 CSV header row');
  const headers=rows[headerIndex].map(h=>normalize(h));
  const idx=Object.fromEntries(headers.map((h,i)=>[h,i]));
  const findCol=names=>names.map(n=>idx[normalize(n)]).find(i=>i!==undefined);
  const stateCol=findCol(['State-UT Code & Name']);
  const acCol=findCol(['AC NAME']);
  const pcCol=findCol(['PC NAME']);
  const candidateCol=findCol(['CANDIDATE NAME']);
  const partyCol=findCol(['PARTY']);
  const votesCol=findCol(['VOTES SECURED EVM']);
  if(stateCol===undefined||acCol===undefined||partyCol===undefined||candidateCol===undefined||votesCol===undefined) {
    throw Error('Required 2019 segment CSV columns are missing');
  }
  for(const row of rows.slice(headerIndex+1)){
    const state=String(row[stateCol]||'').trim().toLowerCase();
    if(state&&!['uttar pradesh','up'].includes(state))continue;
    const name=String(row[acCol]||'').trim(),party=String(row[partyCol]||'').trim();
    const candidate=String(row[candidateCol]||'').trim();
    if(!name||!party||!candidate)continue;
    const rawVotes=String(row[votesCol]||'').replace(/,/g,'').trim();
    const votes=Number(rawVotes);
    if(!Number.isFinite(votes))throw Error(`Invalid 2019 segment vote total for ${candidate} in ${name}`);
    const key=normalize(name);
    if(!segments2019ByName.has(key))segments2019ByName.set(key,[]);
    segments2019ByName.get(key).push({
      candidate,party,votes,pc:String(row[pcCol]||'').trim()
    });
  }
  if(!segments2019ByName.size)throw Error('No Uttar Pradesh 2019 segment rows found');
  for(const [key,list] of segments2019ByName){
    list.sort((a,b)=>b.votes-a.votes);
    const valid=list.filter(r=>normalize(r.party)!=='nota'&&normalize(r.candidate)!=='noneoftheabove');
    segments2019ByName.set(key,{
      rows:list,
      winner:valid[0],
      runner:valid[1],
      margin:valid.length>1?valid[0].votes-valid[1].votes:null,
      pc:list[0]?.pc||''
    });
  }
  console.log('2019 UP Assembly segments loaded:',segments2019ByName.size);
  return segments2019ByName;
}).catch(e=>{
  segments2019LoadError=e.message;
  console.error('2019 segment results error:',e);
  return segments2019ByName;
});

function resultFor(f){
  return resultsByName.get(normalize(seatName(f)));
}

function segment2024For(f){
  const name=normalize(seatName(f));
  if(segments2024ByName.has(name))return segments2024ByName.get(name);
  for(const [key,value] of segments2024ByName){if(key===name||key.startsWith(name)||name.startsWith(key))return value;}
  return undefined;
}

function segment2019For(f){
  const name=normalize(seatName(f));
  if(segments2019ByName.has(name))return segments2019ByName.get(name);
  for(const [key,value] of segments2019ByName){if(key===name||key.startsWith(name)||name.startsWith(key))return value;}
  return undefined;
}

function hideSuggestions(){
  suggestions.hidden=true;
}

function showSeat(f){
  const name=seatName(f);
  openSearchSeatProfile(name);
}

  function openSearchSeatProfile(name){
    const feature=features.find(f=>normalize(seatName(f))===normalize(name))||
      assemblySeats.find(f=>normalize((f.properties||{}).AC_NAME||f.properties?.ac_name||f.properties?.NAME||f.properties?.name)===normalize(name));
    if(!feature){console.warn('Could not find selected constituency feature:',name);return;}
    Promise.all([
      resultsPromise,
      segments2024Promise,
      segments2019Promise,
      loadUPAssembly2017Data().then(data=>({data,error:""})).catch(error=>{
        console.error('2017 Assembly constituency results could not load:',error);
        return {data:null,error:error.message};
      })
    ]).then(([, , , assembly2017])=>{
      const seat=seatName(feature),d=district(feature),r=resultFor(feature),seg=segment2024For(feature),seg19=segment2019For(feature);
      let page=document.getElementById('politisoSeatFullPage');
      if(page){page.remove();}
      page=document.createElement('div');page.id='politisoSeatFullPage';page.className='politiso-pc-profile';
      document.body.appendChild(page);document.body.classList.add('pc-profile-open');

      const esc=escapeHtml,fmt=v=>votesFmt(v);
      const palette=['#4285f4','#ea8c2a','#34a853','#9b59b6','#e74c3c','#0097a7','#e67e22','#2ecc71'];
      const acNo=seatNo(feature)?`AC ${seatNo(feature)}`:'';
      const pcLabel=seg?.pc||'';
      const list22=r?.rows||[],list24=seg?.rows||[];
      const list19=seg19?.rows||[];
      const result17=assembly2017.data?.seats.get(normalize(seat))||
        assembly2017.data?.seatsByNumber.get(seatNo(feature))||
        [...(assembly2017.data?.seats.values()||[])].find(candidateSeat=>
          candidateSeat.rows[0]?.constituencyNumber===seatNo(feature)
        );
      const list17=result17?.rows||[];
      const ranked22=list22.filter(candidate=>normalize(candidate.party)!=='noneoftheabove'&&normalize(candidate.candidate)!=='nota');
      const winner22=ranked22[0],runner22=ranked22[1],third22=ranked22[2];

      const metricCard=(label,val,sub)=>`<article class="pc-metric"><small>${esc(label)}</small><strong>${esc(String(val||'\u2014'))}</strong><span>${esc(sub||'')}</span></article>`;

      const candidateBars=(list)=>{
        if(!list||!list.length)return '<p style="color:#91a9c3;font-size:13px">Vote-share data unavailable.</p>';
        const total=list.reduce((a,b)=>a+b.votes,0)||1;
        return `<div class="pc-vote-bars">${list.slice(0,8).map((x,i)=>{const pct=(x.votes/total*100);return `<div class="pc-vote-bar-row"><div class="pc-vote-bar-label"><b>${esc(x.party||'Independent')}</b><small>${esc(x.candidate||'')}</small></div><div class="pc-vote-bar-track"><span style="width:${Math.max(0,Math.min(100,pct))}%;background:${i===0?'#22946d':palette[i%palette.length]}"></span></div><strong>${pct.toFixed(2)}%</strong></div>`;}).join('')}</div>`;
      };

      const candidateTable=(list,year)=>{
        if(!list||!list.length)return `<p class="pc-empty">Candidate-level ${year} result data is not available for this constituency.</p>`;
        const total=list.reduce((a,b)=>a+b.votes,0)||1;
        return `<div class="pc-table-wrap"><table class="pc-results-table"><thead><tr><th>#</th><th>Candidate</th><th>Party</th><th>Votes</th><th>Vote share</th></tr></thead><tbody>${list.map((x,i)=>`<tr class="${i===0?'pc-winner':''}"><td>${i+1}</td><td>${esc(x.candidate||'Unavailable')}${i===0?' <span class="pc-winner-tag">WINNER</span>':''}</td><td>${esc(x.party||'\u2014')}</td><td>${fmt(x.votes)}</td><td>${(x.votes/total*100).toFixed(2)}%</td></tr>`).join('')}</tbody></table></div>`;
      };

      page.innerHTML=`
        <div class="pc-profile-top" style="background:radial-gradient(ellipse at 80% 0%,rgba(59,130,246,.22),transparent 45%),#0a1728">
          <button type="button" class="pc-back" id="psBack">\u2190 Back to Constituencies</button>
          <span class="section-kicker" style="color:#7eb8ff;display:block;margin-bottom:10px">POLITO \u00b7 UTTAR PRADESH \u00b7 VIDHAN SABHA</span>
          <h1>${esc(seat)}${acNo?` <span style="font-size:clamp(14px,2vw,20px);font-weight:600;opacity:.55;margin-left:8px">${esc(acNo)}</span>`:''}</h1>
          <p>${esc(d)} district${pcLabel?' \u00b7 Part of '+esc(pcLabel)+' Lok Sabha seat':''} \u00b7 Assembly &amp; Parliamentary election profile</p>
        </div>
        <div class="pc-profile-content">
          <div class="pc-metric-grid">
            ${metricCard('2022 WINNER',winner22?.candidate||'Not available',winner22?.party||'')}
            ${metricCard('2022 RUNNER-UP',runner22?.candidate||'Not available',runner22?.party||'')}
            ${metricCard('2022 3RD PLACE',third22?.candidate||'Not available',third22?.party||'')}
            ${metricCard('2022 WIN MARGIN OVER RUNNER-UP',winner22&&runner22?fmt(winner22.votes-runner22.votes)+' votes':'\u2014',winner22&&runner22?'over '+runner22.candidate:'Not available')}
          </div>

          <section class="pc-profile-section">
            <div class="pc-section-head">
              <div><span class="section-kicker" style="color:#7eb8ff">VIDHAN SABHA \u00b7 2022 ASSEMBLY ELECTION</span><h2>Assembly Election 2022</h2></div>
              <span class="pc-pill">${list22.length} candidate${list22.length!==1?'s':''}</span>
            </div>
            <h3 style="color:#9db3ca;font-size:13px;font-weight:600;letter-spacing:.04em;margin:0 0 14px">VOTE-SHARE GRAPHICS</h3>
            ${candidateBars(list22)}
            <h3 style="color:#9db3ca;font-size:13px;font-weight:600;letter-spacing:.04em;margin:22px 0 14px">CANDIDATE-WISE RESULTS</h3>
            ${candidateTable(list22,'2022')}
          </section>

          <section class="pc-profile-section">
            <div class="pc-section-head">
              <div><span class="section-kicker" style="color:#7eb8ff">VIDHAN SABHA \u00b7 2017 ASSEMBLY ELECTION</span><h2>Assembly Election 2017</h2></div>
              <span class="pc-pill">${list17.length} candidate${list17.length!==1?'s':''}</span>
            </div>
            ${assembly2017.data?`<h3 style="color:#9db3ca;font-size:13px;font-weight:600;letter-spacing:.04em;margin:0 0 14px">VOTE-SHARE GRAPHICS</h3>${candidateBars(list17)}<h3 style="color:#9db3ca;font-size:13px;font-weight:600;letter-spacing:.04em;margin:22px 0 14px">CANDIDATE-WISE RESULTS</h3>${candidateTable(list17,'2017')}`:`<p class="pc-empty">2017 Assembly results could not be loaded: ${esc(assembly2017.error)}</p>`}
          </section>

          <section class="pc-profile-section">
            <div class="pc-section-head">
              <div><span class="section-kicker" style="color:#7eb8ff">LOK SABHA SEGMENT \u00b7 2024 ELECTION</span><h2>Lok Sabha Election 2024 \u00b7 Assembly Segment</h2></div>
              <span class="pc-pill">${list24.length} candidate${list24.length!==1?'s':''}</span>
            </div>
            ${pcLabel?`<p style="color:#9db3ca;font-size:13px;margin:0 0 16px">Parliamentary votes counted within this Assembly segment. Lok Sabha seat: <strong style="color:#7eb8ff">${esc(pcLabel)}</strong></p>`:`<p style="color:#9db3ca;font-size:13px;margin:0 0 16px">Parliamentary candidates\u2019 votes within this Assembly constituency during the 2024 Lok Sabha election.</p>`}
            <h3 style="color:#9db3ca;font-size:13px;font-weight:600;letter-spacing:.04em;margin:0 0 14px">VOTE-SHARE GRAPHICS</h3>
            ${candidateBars(list24)}
            <h3 style="color:#9db3ca;font-size:13px;font-weight:600;letter-spacing:.04em;margin:22px 0 14px">CANDIDATE-WISE RESULTS</h3>
            ${candidateTable(list24,'2024')}
          </section>

          <section class="pc-profile-section">
            <div class="pc-section-head">
              <div><span class="section-kicker" style="color:#7eb8ff">LOK SABHA SEGMENT \u00b7 2019 ELECTION</span><h2>Lok Sabha Election 2019 \u00b7 Assembly Segment</h2></div>
              <span class="pc-pill">${list19.length} candidate${list19.length!==1?'s':''}</span>
            </div>
            ${seg19?.pc?`<p style="color:#9db3ca;font-size:13px;margin:0 0 16px">Parliamentary votes counted within this Assembly segment. Lok Sabha seat: <strong style="color:#7eb8ff">${esc(seg19.pc)}</strong></p>`:`<p style="color:#9db3ca;font-size:13px;margin:0 0 16px">Parliamentary candidates\u2019 votes within this Assembly constituency during the 2019 Lok Sabha election.</p>`}
            ${seg19?`<p style="color:#9db3ca;font-size:13px;margin:0 0 16px">Segment lead: <strong style="color:#7eb8ff">${esc(seg19.winner?.candidate||'Unavailable')}</strong> (${esc(seg19.winner?.party||'')}) · margin ${seg19.margin==null?'—':fmt(seg19.margin)+' votes'} over ${esc(seg19.runner?.candidate||'the runner-up')}.</p>`:''}
            ${list19.length?`<h3 style="color:#9db3ca;font-size:13px;font-weight:600;letter-spacing:.04em;margin:0 0 14px">VOTE-SHARE GRAPHICS</h3>${candidateBars(list19)}<h3 style="color:#9db3ca;font-size:13px;font-weight:600;letter-spacing:.04em;margin:22px 0 14px">CANDIDATE-WISE RESULTS</h3>${candidateTable(list19,'2019')}`:`<p class="pc-empty">${segments2019LoadError?`2019 segment results could not be loaded: ${esc(segments2019LoadError)}`:'2019 Lok Sabha segment results are not available for this constituency.'}</p>`}
          </section>

          <p class="pc-data-note">Data: 2017 Assembly candidate results from DeepakKumarGS/UP-Election-Analysis; 2022 Assembly results from thecont1/india-votes-data; 2019 and 2024 Lok Sabha segment results from their respective CSV files in data/. Verify against Election Commission of India before publication.</p>
        </div>`;

      window.scrollTo({top:0,behavior:'instant'});
      page.querySelector('#psBack').addEventListener('click',()=>{page.remove();document.body.classList.remove('pc-profile-open');window.location.hash='#constituencies';window.scrollTo({top:0,behavior:'auto'});});
    });
  }
  window.addEventListener('politiso:select-seat', event => {
    const name = event.detail?.name || '';
    if (geoLayer && map && features.length) {
      const feat = features.find(f => normalize(seatName(f)) === normalize(name)) || event.detail?.feature;
      if (feat) {
        const layer = geoLayer.getLayers().find(l => l.feature === feat);
        if (layer) {
          if (selectedLayer) geoLayer.resetStyle(selectedLayer);
          selectedLayer = layer;
          layer.setStyle(selectedStyle);
          map.fitBounds(layer.getBounds(), { maxZoom: 10, padding: [35, 35] });
        }
      }
    }
    openSearchSeatProfile(name);
  });

  function choose(f){
    hideSuggestions();
    if(!geoLayer||!map)return;
    const layer=geoLayer.getLayers().find(l=>l.feature===f);
    if(!layer)return;
    if(selectedLayer)geoLayer.resetStyle(selectedLayer);
    selectedLayer=layer;
    layer.setStyle(selectedStyle);
    map.fitBounds(layer.getBounds(),{maxZoom:10,padding:[35,35]});
    showSeat(f);
    setStatus('Selected '+seatName(f)+' · 2022 result');
  }

  function renderSuggestions(query){
    const q=String(query||'').trim().toLowerCase();
    if(!q||!features.length){hideSuggestions();return}
    const matches=features.filter(f=>
      seatName(f).toLowerCase().includes(q)||
      district(f).toLowerCase().includes(q)||
      seatNo(f)===q
    ).sort((a,b)=>{
      const an=seatName(a).toLowerCase(),bn=seatName(b).toLowerCase();
      if(an===q)return -1;
      if(bn===q)return 1;
      if(an.startsWith(q)&&!bn.startsWith(q))return -1;
      if(bn.startsWith(q)&&!an.startsWith(q))return 1;
      return an.localeCompare(bn);
    }).slice(0,20);

    if(!matches.length){
      suggestions.innerHTML='<div style="padding:12px">No matching constituency found.</div>';
      suggestions.hidden=false;
      return;
    }

    suggestions.innerHTML=matches.map((f,i)=>{
      const res=resultFor(f);
      const w=res&&res.winner;
      return `<button type="button" data-pick="${i}" style="display:block;width:100%;text-align:left;padding:10px 12px;border:0;border-bottom:1px solid #263c55;background:#0d1b2e;color:#eef6ff;cursor:pointer">
        <b>${escapeHtml(seatName(f))}</b> <small>AC ${escapeHtml(seatNo(f)||'—')}</small>
        <div style="font-size:11px;color:#9fb8d4">${escapeHtml(district(f))} district</div>
        <div style="font-size:11px;color:#80e6c0;margin-top:4px">${w?escapeHtml(w.candidate)+' · '+escapeHtml(w.party)+' · '+votesFmt(w.votes)+' votes':'2022 result loading / unavailable'}</div>
        ${res&&res.margin!=null?`<small>Margin ${votesFmt(res.margin)}</small>`:''}
      </button>`;
    }).join('');
    suggestions.hidden=false;
    suggestions.querySelectorAll('[data-pick]').forEach(btn=>btn.addEventListener('click',()=>{
      const f=matches[Number(btn.dataset.pick)];
      if(f){search.value=seatName(f);choose(f)}
    }));
  }

  if(search){
    search.autocomplete='off';
    search.addEventListener('input',()=>renderSuggestions(search.value));
    search.addEventListener('focus',()=>{if(search.value.trim())renderSuggestions(search.value)});
    search.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        const first=suggestions.querySelector('[data-pick]');
        if(first){e.preventDefault();first.click()}
      }
      if(e.key==='Escape')hideSuggestions();
    });
  }

  document.addEventListener('click',e=>{
    if(!e.target.closest('#mapSeatSuggestions')&&e.target!==search)hideSuggestions();
  });

  if(reset)reset.addEventListener('click',()=>{
    hideSuggestions();
    if(geoLayer)map.fitBounds(geoLayer.getBounds(),{padding:[25,25]});
    if(selectedLayer)geoLayer.resetStyle(selectedLayer);
    selectedLayer=null;
    if(search)search.value='';
  });

  map=L.map(mapNode,{zoomControl:false,preferCanvas:true}).setView([26.8,80.9],6);
L.control.zoom({position:'topright'}).addTo(map);
  window.addEventListener('politiso:pagechange', event=>{
    if(event.detail?.route!=='constituencies')return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!mapNode.isConnected||mapNode.clientWidth===0||mapNode.clientHeight===0)return;
      const center=map.getCenter();
      if(!Number.isFinite(center.lat)||!Number.isFinite(center.lng)){
        map.setView([26.8,80.9],6,{animate:false});
      }
      map.invalidateSize({pan:false});
      if(geoLayer&&geoLayer.getBounds().isValid()){
        map.fitBounds(geoLayer.getBounds(),{padding:[25,25],animate:false});
      }
    }));
  });
  fetch(geoJsonUrl,{cache:'no-cache'})
    .then(r=>{if(!r.ok)throw Error('Boundary data HTTP '+r.status);return r.json()})
    .then(data=>{
      const collection=data.type==='FeatureCollection'?data:(data.geojson||data.data||data);
      if(!collection||!Array.isArray(collection.features)||collection.features.length<350)throw Error('Expected 403 constituency polygons');
      features=collection.features;
      geoLayer=L.geoJSON(collection,{
        style:()=>({...style}),
        onEachFeature:(f,layer)=>{
          layer.bindTooltip(seatName(f),{sticky:true});
          layer.on('click',()=>{
            if(selectedLayer)geoLayer.resetStyle(selectedLayer);
            selectedLayer=layer;
            layer.setStyle(selectedStyle);
            showSeat(f);
          });
        }
      }).addTo(map);
      if(mapNode.clientWidth>0&&mapNode.clientHeight>0&&geoLayer.getBounds().isValid()){
        map.fitBounds(geoLayer.getBounds(),{padding:[25,25],animate:false});
      }
      const loading=mapNode.querySelector('.map-loading');
      if(loading)loading.remove();
      setStatus(features.length+' constituencies loaded · Search or click a seat');
      if(search&&search.value.trim())renderSuggestions(search.value);
    })
    .catch(e=>{
      console.error('POLITO map error:',e);
      setStatus('Map data failed to load: '+e.message);
    });
})();

