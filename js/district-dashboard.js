/* POLITO DISTRICT DASHBOARD */
(function(){
  const input=document.getElementById("globalSearch");
  const results=document.getElementById("searchResults");
  if(!input||!results)return;
  const csvUrl="https://raw.githubusercontent.com/thecont1/india-votes-data/main/data/csv/2022Assembly-UP.csv";
  const geoUrl="data/up-constituencies.geojson";
  const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function csvLine(line){
    const out=[];let v="",q=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'&&q&&line[i+1]==='"'){v+='"';i++;}
      else if(c==='"')q=!q;
      else if(c===","&&!q){out.push(v);v="";}
      else v+=c;
    }
    out.push(v);return out;
  }
  let seats=[],districts=[],resultsBySeat=new Map(),ready=false,loadError="";
  const dataReady=Promise.all([
    fetch(geoUrl).then(r=>{if(!r.ok)throw Error("GeoJSON load failed");return r.json()}),
    fetch(csvUrl).then(r=>{if(!r.ok)throw Error("2022 result CSV load failed");return r.text()})
  ]).then(([geo,csv])=>{
    const features=geo.features||geo.geojson?.features||geo.data?.features||[];
    seats=features.map(f=>({
      name:f.properties?.ac_name||f.properties?.AC_NAME||f.properties?.name||f.properties?.NAME||"",
      district:f.properties?.district||f.properties?.DISTRICT||f.properties?.dist_name||f.properties?.DIST_NAME||"",
      number:f.properties?.ac||f.properties?.AC_NO||f.properties?.ac_no||""
    })).filter(s=>s.name&&s.district);
    const lines=csv.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);
    if(lines.length<1000)throw Error("CSV data incomplete");
    const heads=csvLine(lines.shift()).map(s=>s.trim());
    const ix=Object.fromEntries(heads.map((h,i)=>[h,i]));
    const get=(row,key)=>row[ix[key]]??"";
    const groups=new Map();
    for(const line of lines){
      const row=csvLine(line);
      if(get(row,"election_year")!=="2022"||get(row,"election_state").toUpperCase()!=="UP")continue;
      const name=get(row,"constituency").trim();
      if(!name)continue;
      const item={
        name,
        candidate:get(row,"candidate").trim(),
        party:get(row,"party").trim(),
        votes:(Number(get(row,"evm_votes"))||0)+(Number(get(row,"postal_votes"))||0)
      };
      const key=norm(name);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(item);
    }
    for(const [key,rows] of groups){
      rows.sort((a,b)=>b.votes-a.votes);
      const valid=rows.filter(r=>norm(r.party)!=="noneoftheabove"&&norm(r.candidate)!=="nota");
      resultsBySeat.set(key,{rows,winner:valid[0]||null,runner:valid[1]||null});
    }
    const districtMap=new Map();
    for(const s of seats){
      const key=norm(s.district);
      if(!districtMap.has(key))districtMap.set(key,{name:s.district,seats:[]});
      const found=resultsBySeat.get(norm(s.name));
      districtMap.get(key).seats.push({...s,result:found||null});
    }
    districts=[...districtMap.values()].sort((a,b)=>a.name.localeCompare(b.name));
    ready=true;
  }).catch(e=>{
    loadError=e.message||"Could not load election data";
    console.error("POLITO district dashboard:",e);
  });
  function navigateDistrict(d){
    const page=document.getElementById("page-constituencies")||document.getElementById("constituencies");
    if(!page)return;
    let panel=document.getElementById("districtDashboard");
    if(!panel){
      panel=document.createElement("section");
      panel.id="districtDashboard";
      panel.className="district-dashboard";
      panel.style.cssText="margin:24px 0;padding:clamp(16px,3vw,30px);border:1px solid #dce5f0;border-radius:22px;background:#fff;color:#14243b;box-shadow:0 12px 35px #10213b12";
      const mapSection=page.querySelector(".constituency-map-section");
      const searchArea=page.querySelector(".search-area");
      if(mapSection)page.insertBefore(panel,mapSection);
      else if(searchArea&&searchArea.parentElement===page)page.insertBefore(panel,searchArea.nextSibling);
      else page.appendChild(panel);
    }
    const tally=new Map();
    d.seats.forEach(s=>{
      const party=s.result?.winner?.party;
      if(party)tally.set(party,(tally.get(party)||0)+1);
    });
    const ranked=[...tally.entries()].sort((a,b)=>b[1]-a[1]);
    const total=d.seats.length;
    const colors=["#3978d4","#e99a43","#319879","#9164cc","#d85d68","#64748b"];
    const score=ranked.map(([party,count],i)=>`
      <div style="padding:14px;border:1px solid #e5eaf1;border-radius:14px;min-width:110px;flex:1">
        <div style="font-size:12px;color:#64748b">${esc(party)}</div>
        <div style="font-size:30px;font-weight:800;margin:5px 0;color:${colors[i%colors.length]}">${count}</div>
        <div style="font-size:11px;color:#64748b">${Math.round(count/Math.max(total,1)*100)}% of seats</div>
      </div>`).join("");
    const bar=ranked.map(([party,count],i)=>`<div title="${esc(party)}: ${count}" style="width:${count/Math.max(total,1)*100}%;background:${colors[i%colors.length]};height:12px"></div>`).join("");
    const seatRows=d.seats.slice().sort((a,b)=>Number(a.number)-Number(b.number)).map((s,i)=>{
      const w=s.result?.winner;
      const r=s.result?.runner;
      const margin=w&&r?w.votes-r.votes:null;
      return `<div style="display:grid;grid-template-columns: minmax(0,1fr) auto;gap:12px;align-items:center;padding:15px 0;border-bottom:1px solid #e8edf3">
        <div><div style="font-weight:750">${esc(s.name)}</div>
        <div style="font-size:12px;color:#64748b;margin-top:5px">${w?esc(w.candidate)+" · "+esc(w.party):"2022 result unavailable"}</div>
        ${w?`<div style="font-size:12px;color:#64748b;margin-top:3px">${w.votes.toLocaleString("en-IN")} votes${margin!==null?" · Margin "+margin.toLocaleString("en-IN"):""}</div>`:""}</div>
        <span style="font-size:12px;font-weight:750;padding:7px 10px;border-radius:9px;background:#f0f5fb">${w?esc(w.party):"N/A"}</span>
      </div>`;
    }).join("");
    panel.innerHTML=`
      <button id="closeDistrictDashboard" style="float:right;border:0;background:#edf2f8;border-radius:9px;padding:8px 12px;cursor:pointer">✕ Close</button>
      <div style="font-size:11px;letter-spacing:1.5px;color:#64748b;font-weight:750">DISTRICT ELECTION DASHBOARD · 2022</div>
      <h2 style="font-size:clamp(25px,4vw,38px);margin:9px 0">${esc(d.name)} district</h2>
      <p style="color:#64748b;margin:0 0 22px">${total} Assembly constituencies · Uttar Pradesh</p>
      ${ranked.length?`<div style="display:flex;gap:12px;flex-wrap:wrap">${score}</div>
      <div style="display:flex;overflow:hidden;border-radius:10px;margin:22px 0 8px">${bar}</div>
      <div style="font-size:11px;color:#64748b">Party-wise seats won · 2022 Assembly election</div>`:`<p style="padding:15px;background:#fff4e5;border-radius:10px">Party-wise result data could not be matched. Please check the source data.</p>`}
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:28px;flex-wrap:wrap">
        <h3 style="margin:0;font-size:20px">Assembly-wise results</h3>
        <span style="font-size:12px;color:#64748b">${d.seats.filter(s=>s.result?.winner).length}/${total} results matched</span>
      </div>
      ${seatRows}
      <p style="font-size:11px;color:#8491a3;line-height:1.6;margin-top:18px">Data source: linked 2022 Assembly CSV and local constituency GeoJSON. Verify with Election Commission records before publication.</p>`;
    document.getElementById("closeDistrictDashboard").onclick=()=>panel.remove();
    panel.scrollIntoView({behavior:"smooth",block:"start"});
  }
  const shortPartyName=party=>{
    const key=norm(party);
    if(key.includes("samajwadiparty"))return "SP";
    if(key.includes("bharatiyajanataparty"))return "BJP";
    if(key.includes("bahujansamajparty"))return "BSP";
    if(key.includes("indiannationalcongress"))return "INC";
    return party;
  };
  window.POLITISO_DISTRICT_SEARCH=query=>{
    if(!ready)return [];
    const n=norm(query);
    return districts.filter(d=>norm(d.name).includes(n)).slice(0,8).map(d=>{
      const tally=new Map();
      d.seats.forEach(s=>{
        const party=s.result?.winner?.party;
        if(party)tally.set(party,(tally.get(party)||0)+1);
      });
      const leaders=[...tally.entries()]
        .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
        .slice(0,3)
        .map(([party,count])=>`${shortPartyName(party)} ${count}`)
        .join(" · ");
      return {
        name:d.name,
        meta:`${d.seats.length} Assembly seats · 2022 district scorecard`,
        submeta:leaders||"Party totals unavailable"
      };
    });
  };
  window.POLITISO_DISTRICT_ERROR=()=>loadError;
  window.POLITISO_OPEN_DISTRICT=name=>{
    const district=districts.find(d=>norm(d.name)===norm(name));
    if(district)navigateDistrict(district);
  };
  dataReady.then(()=>{
    if(input.value)showSearchResults(input.value);
  });
  document.querySelectorAll(".popular-searches button").forEach(b => b.addEventListener("click", () => {
    input.value = b.dataset.search;
    showSearchResults(input.value);
    input.focus();
  }));
})();

