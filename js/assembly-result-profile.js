(function(){
  if(document.getElementById("politisoFullResults"))return;
  const style=document.createElement("style");
  style.textContent=`
  #politisoFullResults{position:fixed;inset:0;z-index:999999;overflow:auto;background:#f3f6fa;color:#17263a;font-family:Arial,sans-serif}
  #politisoFullResults *{box-sizing:border-box}
  .pr-top{background:#102039;color:white;padding:16px 4%;display:flex;align-items:center;gap:16px}
  .pr-top button{padding:10px 15px;border:1px solid #52647c;border-radius:8px;background:#203653;color:white;cursor:pointer}
  .pr-wrap{max-width:1200px;margin:auto;padding:25px 18px}
  .pr-hero{padding:30px;border-radius:18px;background:linear-gradient(120deg,#102039,#24577b);color:white}
  .pr-hero small{color:#ffd17a;font-weight:bold;letter-spacing:2px}
  .pr-hero h1{font-size:clamp(28px,5vw,46px);margin:12px 0}
  .pr-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:18px 0}
  .pr-card,.pr-section{background:white;border:1px solid #e0e7ef;border-radius:14px;padding:18px;min-width:0}
  .pr-card small{color:#68798d}
  .pr-card strong{display:block;font-size:22px;margin:10px 0;overflow-wrap:anywhere}
  .pr-grid{display:grid;grid-template-columns:1fr 2fr;gap:16px}
  .pr-section{margin-bottom:16px}
  .pr-section h2{font-size:20px;margin-top:0}
  .pr-bar{height:10px;background:#e7edf4;border-radius:20px;overflow:hidden;margin:8px 0 16px}
  .pr-bar span{display:block;height:100%;background:#2776a8;border-radius:20px}
  .pr-table{overflow-x:auto}
  .pr-table table{width:100%;border-collapse:collapse;min-width:530px;font-size:13px}
  .pr-table th,.pr-table td{text-align:left;padding:12px;border-bottom:1px solid #e5eaf0}
  .pr-table th{background:#f0f4f8}
  .pr-table tr:first-child{background:#eaf8ef}
  .pr-muted{color:#68798d;font-size:12px}
  @media(max-width:750px){.pr-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.pr-grid{grid-template-columns:1fr}.pr-hero{padding:22px}}
  `;
  document.head.appendChild(style);
  const page=document.createElement("section");
  page.id="politisoFullResults";
  page.hidden=true;
  document.body.appendChild(page);
  window.POLITISO_SHOW_RESULTS=function(data){
    const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const fmt=n=>Number(n||0).toLocaleString("en-IN");
    const rows=(data.candidates||[]).slice().sort((a,b)=>Number(b.votes)-Number(a.votes));
    const total=rows.reduce((s,r)=>s+Number(r.votes||0),0);
    const share=r=>total?Number(r.votes||0)*100/total:0;
    const winner=rows[0],runner=rows[1];
    const card=(label,r)=>`<article class="pr-card"><small>${label}</small><strong>${esc(r?.candidate||"Unavailable")}</strong><div>${esc(r?.party||"")}</div><strong>${fmt(r?.votes||0)}</strong><small>${r?share(r).toFixed(2)+"% vote share":""}</small></article>`;
    page.hidden=false;
    document.body.style.overflow="hidden";
    page.innerHTML=`
      <header class="pr-top">
        <button id="prBack">← Back</button>
        <b>POLITO</b>
        <span style="margin-left:auto">2022 Assembly Results</span>
      </header>
      <main class="pr-wrap">
        <section class="pr-hero">
          <small>UTTAR PRADESH · ASSEMBLY ELECTION 2022</small>
          <h1>${esc(data.name)}</h1>
          <p>${esc(data.district||"Uttar Pradesh")} · Constituency election profile</p>
        </section>
        <section class="pr-cards">
          ${card("WINNER",winner)}
          ${card("RUNNER-UP",runner)}
          <article class="pr-card"><small>VICTORY MARGIN</small><strong>${runner?fmt(winner.votes-runner.votes):"—"}</strong><small>Votes</small></article>
          <article class="pr-card"><small>CANDIDATES</small><strong>${rows.length}</strong><small>Loaded result rows</small></article>
        </section>
        <div class="pr-grid">
          <div>
            <section class="pr-section">
              <h2>Vote-share graphics</h2>
              ${rows.slice(0,8).map((r,i)=>`<p><b>${i+1}. ${esc(r.candidate)}</b><br><span class="pr-muted">${esc(r.party)} · ${fmt(r.votes)} votes · ${share(r).toFixed(2)}%</span></p><div class="pr-bar"><span style="width:${Math.min(100,share(r))}%;background:${i===0?"#15945e":"#2776a8"}"></span></div>`).join("")}
            </section>
          </div>
          <section class="pr-section">
            <h2>All candidates · 2022</h2>
            <p class="pr-muted">Ranked by votes received</p>
            <div class="pr-table"><table>
              <thead><tr><th>Rank</th><th>Candidate / Party</th><th>Votes</th><th>Share</th></tr></thead>
              <tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.candidate)}</b><br><span class="pr-muted">${esc(r.party)}</span></td><td>${fmt(r.votes)}</td><td>${share(r).toFixed(2)}%</td></tr>`).join("")}</tbody>
            </table></div>
            <p class="pr-muted">Vote share is calculated from the candidate vote totals supplied to this page.</p>
          </section>
        </div>
      </main>`;
    document.getElementById("prBack").onclick=()=>{
      page.hidden=true;
      document.body.style.overflow="";
    };
  };
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&!page.hidden){
      page.hidden=true;
      document.body.style.overflow="";
    }
  });
})();



