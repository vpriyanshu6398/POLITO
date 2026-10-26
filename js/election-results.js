const upAssembly2017CsvUrl = "https://raw.githubusercontent.com/DeepakKumarGS/UP-Election-Analysis/master/up_res.csv";
let upAssembly2017DataPromise;

function normalizeUPAssemblyName(value) {
  return String(value || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function parseUPAssembly2017CSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ""; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function loadUPAssembly2017Data() {
  if (!upAssembly2017DataPromise) {
    upAssembly2017DataPromise = fetch(upAssembly2017CsvUrl)
      .then(response => {
        if (!response.ok) throw new Error(`2017 Assembly results failed to load (HTTP ${response.status})`);
        return response.text();
      })
      .then(csv => {
        const rows = parseUPAssembly2017CSV(csv.replace(/^\uFEFF/, ""));
        const headers = (rows.shift() || []).map(value => value.trim().toLowerCase());
        const index = Object.fromEntries(headers.map((value, i) => [value, i]));
        const required = ["ac", "ac_no", "candidate", "party", "votes"];
        const missing = required.filter(column => index[column] === undefined);
        if (missing.length) throw new Error(`2017 Assembly results are missing columns: ${missing.join(", ")}`);
        const seats = new Map();
        for (const row of rows) {
          const name = String(row[index.ac] || "").trim();
          const candidate = String(row[index.candidate] || "").trim();
          const party = String(row[index.party] || "").trim();
          const votes = Number(String(row[index.votes] || "").replace(/,/g, ""));
          if (!name || !candidate || !party) continue;
          if (!Number.isFinite(votes)) throw new Error(`2017 Assembly results contain an invalid vote total for ${name}`);
          const key = normalizeUPAssemblyName(name);
          if (!seats.has(key)) seats.set(key, { name, rows: [] });
          seats.get(key).rows.push({
            candidate,
            party,
            votes,
            constituencyNumber: String(row[index.ac_no] || "").trim(),
            district: String(row[index.district] || "").trim()
          });
        }
        if (seats.size !== 403) throw new Error(`2017 Assembly results contain ${seats.size} constituencies; expected 403`);

        const seatsByNumber = new Map();
        const partyStats = new Map();
        let validVotes = 0;
        for (const seat of seats.values()) {
          seat.rows.sort((a, b) => b.votes - a.votes);
          const seatNumber = seat.rows[0]?.constituencyNumber;
          if (seatNumber) seatsByNumber.set(seatNumber, seat);
          const validCandidates = seat.rows.filter(candidate =>
            normalizeUPAssemblyName(candidate.party) !== "noneoftheabove" &&
            normalizeUPAssemblyName(candidate.candidate) !== "noneoftheabove"
          );
          seat.winner = validCandidates[0];
          seat.runner = validCandidates[1];
          for (const candidate of seat.rows) {
            if (normalizeUPAssemblyName(candidate.party) === "noneoftheabove" ||
                normalizeUPAssemblyName(candidate.candidate) === "noneoftheabove") continue;
            validVotes += candidate.votes;
            const partyKey = normalizeUPAssemblyName(candidate.party);
            if (!partyStats.has(partyKey)) {
              partyStats.set(partyKey, { name: candidate.party, short: candidate.party, seats: 0, votes: 0 });
            }
            partyStats.get(partyKey).votes += candidate.votes;
          }
          if (seat.winner) {
            const winnerParty = partyStats.get(normalizeUPAssemblyName(seat.winner.party));
            if (winnerParty) winnerParty.seats++;
          }
        }
        const palette = ["#f28b36", "#dc4545", "#3975d5", "#52a5e8", "#45a66d", "#8a65c9", "#269d9d", "#887f9b"];
        const parties = [...partyStats.values()]
          .map(party => ({
            ...party,
            vote: validVotes ? party.votes / validVotes * 100 : 0,
            color: ({
              "bjp": "#f28b36", "bjpplus": "#f28b36", "sp": "#dc4545",
              "bsp": "#3975d5", "inc": "#52a5e8", "rld": "#45a66d",
              "independent": "#887f9b", "others": "#8a65c9"
            })[normalizeUPAssemblyName(party.name)]
          }))
          .sort((a, b) => b.seats - a.seats || b.votes - a.votes);
        parties.forEach((party, i) => {
          if (!party.color) party.color = palette[i % palette.length];
        });
        if (seatsByNumber.size !== 403) throw new Error(`2017 Assembly results contain ${seatsByNumber.size} unique constituency numbers; expected 403`);
        if ([...partyStats.values()].reduce((total, party) => total + party.seats, 0) !== 403) {
          throw new Error("2017 Assembly results do not contain a valid winner for all 403 constituencies");
        }
        return { seats, seatsByNumber, parties, validVotes };
      })
      .catch(error => {
        upAssembly2017DataPromise = undefined;
        throw error;
      });
  }
  return upAssembly2017DataPromise;
}

function open2022ElectionPage() {
  let page = document.getElementById("election2022FullPage");
  if (page) {
    page.hidden = false;
    page.scrollTop = 0;
    return;
  }

  let parties = [
    {name:"Bharatiya Janata Party",short:"BJP",seats:255,vote:41.29,votes:38051721,color:"#f28b36"},
    {name:"Samajwadi Party",short:"SP",seats:111,vote:32.06,votes:29543934,color:"#dc4545"},
    {name:"Bahujan Samaj Party",short:"BSP",seats:1,vote:12.88,votes:11873137,color:"#3975d5"},
    {name:"Rashtriya Lok Dal",short:"RLD",seats:8,vote:2.85,votes:2630168,color:"#45a66d"},
    {name:"Indian National Congress",short:"INC",seats:2,vote:2.33,votes:2151234,color:"#52a5e8"},
    {name:"Apna Dal (Sonelal)",short:"AD(S)",seats:12,vote:1.62,votes:1493181,color:"#8a65c9"},
    {name:"Suheldev Bharatiya Samaj Party",short:"SBSP",seats:6,vote:1.36,votes:1252925,color:"#b49b38"},
    {name:"NISHAD Party",short:"NISHAD",seats:6,vote:0.91,votes:840584,color:"#269d9d"},
    {name:"Jansatta Dal Loktantrik",short:"JD(L)",seats:2,vote:0.21,votes:191874,color:"#887f9b"}
  ];

  const fmt = n => Number(n).toLocaleString("en-IN");
  const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  page = document.createElement("section");
  page.id = "election2022FullPage";
  page.className = "election2022-full-page";
  page.innerHTML = `
    <style>
      .election2022-full-page{position:fixed;inset:0;z-index:9999;overflow:auto;background:#f4f6fb;color:#172238;font-family:inherit}
      .e22-top{background:#101a2d;color:#fff;padding:18px clamp(18px,4vw,60px);display:flex;align-items:center;justify-content:space-between;gap:15px}
      .e22-back{border:1px solid #536078;background:#202c42;color:#fff;border-radius:10px;padding:10px 14px;cursor:pointer;font:inherit}
      .e22-wrap{max-width:1250px;margin:auto;padding:30px 22px 60px}
      .e22-kicker{font-size:11px;font-weight:800;letter-spacing:1.5px;color:#63738d}
      .e22-title{font-size:clamp(30px,5vw,48px);line-height:1.08;margin:10px 0}
      .e22-sub{color:#69778d;line-height:1.6;margin:0 0 24px}
      .e22-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      .e22-card,.e22-panel{background:#fff;border:1px solid #e4e9f2;border-radius:17px;padding:20px;box-shadow:0 5px 20px #1c31500a}
      .e22-label{font-size:12px;color:#718097;font-weight:700}
      .e22-number{font-size:32px;font-weight:800;margin:8px 0 4px;letter-spacing:-1px}
      .e22-note{font-size:12px;color:#77849a}
      .e22-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}
      .e22-panel h2{font-size:19px;margin:0 0 6px}
      .e22-panel>p{font-size:13px;color:#7b879b;margin:0 0 20px}
      .e22-row{display:grid;grid-template-columns:60px 1fr 45px;gap:10px;align-items:center;margin:15px 0;font-size:13px}
      .e22-track{height:12px;background:#edf1f7;border-radius:20px;overflow:hidden}
      .e22-fill{height:100%;border-radius:20px}
      .e22-party{display:flex;align-items:center;gap:8px}
      .e22-dot{width:9px;height:9px;border-radius:50%;display:inline-block;flex-shrink:0}
      .e22-table-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
      .e22-search{border:1px solid #dbe2ed;border-radius:10px;padding:11px 13px;font:inherit;max-width:100%;width:270px}
      .e22-table-wrap{overflow-x:auto}
      .e22-table{width:100%;border-collapse:collapse;min-width:650px;font-size:13px}
      .e22-table th{text-align:left;color:#758198;font-size:11px;letter-spacing:.5px}
      .e22-table th,.e22-table td{padding:13px 10px;border-bottom:1px solid #edf0f5}
      .e22-table td:nth-child(n+3),.e22-table th:nth-child(n+3){text-align:right}
      .e22-pill{display:inline-block;padding:5px 8px;border-radius:7px;background:#eef2f8;font-size:11px;font-weight:800}
      .e22-insight{background:#eaf1ff;border:1px solid #d9e5ff;border-radius:14px;padding:18px;margin-top:20px;line-height:1.6;font-size:14px}
      .e22-source{font-size:11px;color:#78859a;line-height:1.6;margin-top:20px}
      .e22-year-switch{display:flex;gap:8px;margin:0 0 18px}
      .e22-year-switch button{border:1px solid #d4dce8;background:#fff;color:#34445a;border-radius:9px;padding:9px 15px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
      .e22-year-switch button[aria-pressed="true"]{background:#193454;border-color:#193454;color:#fff}
      .e22-data-status{min-height:18px;color:#8a4b12;font-size:13px;margin:-8px 0 16px}
      @media(max-width:800px){.e22-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.e22-grid{grid-template-columns:1fr}.e22-number{font-size:27px}}
      @media(max-width:430px){.e22-wrap{padding:22px 13px 40px}.e22-card,.e22-panel{padding:15px}.e22-row{grid-template-columns:52px 1fr 42px;gap:7px}.e22-title{font-size:31px}}
    </style>
    <header class="e22-top">
      <div><strong>POLITO</strong><div style="font-size:11px;color:#b8c4d7;margin-top:4px">UTTAR PRADESH ASSEMBLY ELECTIONS</div></div>
      <button class="e22-back" id="e22Back">← Back to Elections</button>
    </header>
    <div class="e22-wrap">
      <div class="e22-kicker">UTTAR PRADESH · VIDHAN SABHA ELECTION</div>
      <h1 class="e22-title">Uttar Pradesh Assembly Results</h1>
      <p class="e22-sub" id="e22ElectionDescription">The results, party standings and vote-share picture from the 18th Uttar Pradesh Legislative Assembly election.</p>
      <div class="e22-year-switch" role="group" aria-label="Select Assembly election year">
        <button type="button" data-election-year="2022" aria-pressed="true">2022</button>
        <button type="button" data-election-year="2017" aria-pressed="false">2017</button>
      </div>
      <div class="e22-data-status" id="e22DataStatus" role="status" aria-live="polite"></div>

      <div class="e22-stats">
        <article class="e22-card"><div class="e22-label">TOTAL SEATS</div><div class="e22-number">403</div><div class="e22-note">Assembly constituencies</div></article>
        <article class="e22-card"><div class="e22-label">MAJORITY MARK</div><div class="e22-number">202</div><div class="e22-note">Seats needed to govern</div></article>
        <article class="e22-card"><div class="e22-label" id="e22LeadingPartyLabel">BJP SEATS</div><div class="e22-number" id="e22LeadingPartySeats">255</div><div class="e22-note" id="e22LeadingPartyNote">Single-party majority</div></article>
        <article class="e22-card"><div class="e22-label">VOTER TURNOUT</div><div class="e22-number" id="e22Turnout">61.03%</div><div class="e22-note" id="e22TurnoutNote">Reported turnout figure</div></article>
      </div>

      <div class="e22-grid">
        <article class="e22-panel">
          <h2>Seats won by party</h2>
          <p>Seat count out of 403 Assembly constituencies.</p>
          <div id="e22SeatChart"></div>
        </article>
        <article class="e22-panel">
          <h2>Party vote share</h2>
          <p>Share of votes polled across Uttar Pradesh.</p>
          <div id="e22VoteChart"></div>
        </article>
      </div>

      <article class="e22-panel" style="margin-top:20px">
        <div class="e22-table-head">
          <div><h2>Party-wise results</h2><p style="margin-top:6px">Seats, votes and statewide vote share.</p></div>
          <input class="e22-search" id="e22PartySearch" placeholder="Search party…" aria-label="Search parties">
        </div>
        <div class="e22-table-wrap">
          <table class="e22-table">
            <thead><tr><th>PARTY</th><th>SEATS</th><th>VOTES</th><th>VOTE SHARE</th></tr></thead>
            <tbody id="e22PartyRows"></tbody>
          </table>
        </div>
      </article>

      <div class="e22-insight" id="e22Insight"><strong>Key takeaway</strong><br>BJP secured a majority on its own with 255 seats. The Samajwadi Party won 111 seats, while BSP received 12.88% of the vote but won just one constituency.</div>
      <div class="e22-source" id="e22Source">Data note: party vote shares and seat counts are based on published 2022 election results. Turnout may differ slightly between datasets depending on the reporting method. Verify against the Election Commission of India before using as a final reference.</div>
    </div>`;

  document.body.appendChild(page);

  const seatChart = page.querySelector("#e22SeatChart");
  const voteChart = page.querySelector("#e22VoteChart");
  const tbody = page.querySelector("#e22PartyRows");
  const partySearch = page.querySelector("#e22PartySearch");
  const renderCharts = () => {
    seatChart.innerHTML = parties.slice(0,8).map(p=>`
      <div class="e22-row">
        <div class="e22-party"><i class="e22-dot" style="background:${p.color}"></i><b>${esc(p.short)}</b></div>
        <div class="e22-track"><div class="e22-fill" style="width:${p.seats/403*100}%;background:${p.color}"></div></div>
        <strong>${p.seats}</strong>
      </div>`).join("");
    voteChart.innerHTML = parties.slice(0,8).map(p=>`
      <div class="e22-row">
        <div class="e22-party"><i class="e22-dot" style="background:${p.color}"></i><b>${esc(p.short)}</b></div>
        <div class="e22-track"><div class="e22-fill" style="width:${p.vote}%;background:${p.color}"></div></div>
        <strong>${p.vote.toFixed(2)}%</strong>
      </div>`).join("");
  };
  function renderRows(query="") {
    tbody.innerHTML = parties.filter(p=>(p.name+" "+p.short).toLowerCase().includes(query.toLowerCase())).map(p=>`
      <tr>
        <td><span class="e22-party"><i class="e22-dot" style="background:${p.color}"></i><b>${esc(p.name)}</b></span>${p.name!==p.short?`<div style="color:#7a879c;font-size:11px;margin-top:4px">${esc(p.short)}</div>`:''}</td>
        <td><span class="e22-pill">${p.seats}</span></td>
        <td>${fmt(p.votes)}</td>
        <td><b>${p.vote.toFixed(2)}%</b></td>
      </tr>`).join("");
  }
  function showElectionYear(year, data) {
    const status = page.querySelector("#e22DataStatus");
    if (year === 2017 && !data) {
      status.textContent = "2017 results are unavailable. Check the data source connection and retry.";
      return;
    }
    if (year === 2022) {
      parties = [
        {name:"Bharatiya Janata Party",short:"BJP",seats:255,vote:41.29,votes:38051721,color:"#f28b36"},
        {name:"Samajwadi Party",short:"SP",seats:111,vote:32.06,votes:29543934,color:"#dc4545"},
        {name:"Bahujan Samaj Party",short:"BSP",seats:1,vote:12.88,votes:11873137,color:"#3975d5"},
        {name:"Rashtriya Lok Dal",short:"RLD",seats:8,vote:2.85,votes:2630168,color:"#45a66d"},
        {name:"Indian National Congress",short:"INC",seats:2,vote:2.33,votes:2151234,color:"#52a5e8"},
        {name:"Apna Dal (Sonelal)",short:"AD(S)",seats:12,vote:1.62,votes:1493181,color:"#8a65c9"},
        {name:"Suheldev Bharatiya Samaj Party",short:"SBSP",seats:6,vote:1.36,votes:1252925,color:"#b49b38"},
        {name:"NISHAD Party",short:"NISHAD",seats:6,vote:0.91,votes:840584,color:"#269d9d"},
        {name:"Jansatta Dal Loktantrik",short:"JD(L)",seats:2,vote:0.21,votes:191874,color:"#887f9b"}
      ];
      page.querySelector("#e22ElectionDescription").textContent = "The results, party standings and vote-share picture from the 18th Uttar Pradesh Legislative Assembly election.";
      page.querySelector("#e22LeadingPartyLabel").textContent = "BJP SEATS";
      page.querySelector("#e22LeadingPartySeats").textContent = "255";
      page.querySelector("#e22LeadingPartyNote").textContent = "Single-party majority";
      page.querySelector("#e22Turnout").textContent = "61.03%";
      page.querySelector("#e22TurnoutNote").textContent = "Reported turnout figure";
      page.querySelector("#e22Insight").innerHTML = "<strong>Key takeaway</strong><br>BJP secured a majority on its own with 255 seats. The Samajwadi Party won 111 seats, while BSP received 12.88% of the vote but won just one constituency.";
      page.querySelector("#e22Source").textContent = "Data note: party vote shares and seat counts are based on published 2022 election results. Turnout may differ slightly between datasets depending on the reporting method. Verify against the Election Commission of India before using as a final reference.";
    } else {
      parties = data.parties;
      const leader = parties[0];
      page.querySelector("#e22ElectionDescription").textContent = "Party seats, candidate votes and statewide vote shares from the 2017 Uttar Pradesh Legislative Assembly election.";
      page.querySelector("#e22LeadingPartyLabel").textContent = `${leader.short} SEATS`;
      page.querySelector("#e22LeadingPartySeats").textContent = String(leader.seats);
      page.querySelector("#e22LeadingPartyNote").textContent = "Largest party grouping in the source data";
      page.querySelector("#e22Turnout").textContent = "61.11%";
      page.querySelector("#e22TurnoutNote").textContent = "Reported statewide turnout";
      page.querySelector("#e22Insight").innerHTML = `<strong>Key takeaway</strong><br>${esc(leader.short)} led the source dataset with ${leader.seats} seats. Seat counts and vote shares use the party groupings recorded in that dataset.`;
      page.querySelector("#e22Source").textContent = "2017 candidate-level results: DeepakKumarGS/UP-Election-Analysis (up_res.csv). The statewide turnout figure (61.11%) is reported in Election Commission of India election statistics. Party totals follow the candidate source's labels, including alliance groupings. Verify all figures against Election Commission of India records before publication.";
    }
    status.textContent = "";
    renderCharts();
    renderRows(partySearch.value);
    page.querySelectorAll("[data-election-year]").forEach(button => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.electionYear) === year));
    });
  }
  page.querySelectorAll("[data-election-year]").forEach(button => button.addEventListener("click", async () => {
    const year = Number(button.dataset.electionYear);
    if (year === 2022) {
      showElectionYear(2022);
      return;
    }
    const status = page.querySelector("#e22DataStatus");
    status.textContent = "Loading 2017 Assembly results…";
    try {
      showElectionYear(2017, await loadUPAssembly2017Data());
    } catch (error) {
      console.error("2017 Assembly results could not load:", error);
      status.textContent = `2017 Assembly results could not load: ${error.message}`;
    }
  }));
  renderCharts();
  renderRows();

  partySearch.addEventListener("input",e=>renderRows(e.target.value));
  page.querySelector("#e22Back").addEventListener("click",()=>page.hidden=true);
}

async function open2019ParliamentaryResultsPage() {
  let page = document.getElementById("electionParliamentFullPage");
  if (page) {
    page.hidden = false;
    page.scrollTop = 0;
    return;
  }

  page = document.createElement("section");
  page.id = "electionParliamentFullPage";
  page.style.cssText = "position:fixed;inset:0;z-index:9999;overflow:auto;background:#f4f6fb;color:#172238;font-family:inherit";
  page.innerHTML = `
    <style>
      #electionParliamentFullPage *{box-sizing:border-box}
      .e19-top{background:#101a2d;color:#fff;padding:18px clamp(16px,4vw,55px);display:flex;justify-content:space-between;align-items:center;gap:12px}
      .e19-back{background:#26344c;color:#fff;border:1px solid #536078;border-radius:9px;padding:10px 14px;cursor:pointer;font:inherit}
      .e19-wrap{max-width:1200px;margin:auto;padding:30px 20px 55px}
      .e19-kicker{font-size:11px;letter-spacing:1.5px;font-weight:800;color:#6d7a90}
      .e19-title{font-size:clamp(30px,5vw,46px);margin:10px 0}
      .e19-sub{color:#718096;line-height:1.6;margin:0 0 24px}
      .e19-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      .e19-card,.e19-panel{background:#fff;border:1px solid #e2e8f1;border-radius:16px;padding:20px}
      .e19-label{font-size:12px;color:#738097;font-weight:700}
      .e19-number{font-size:32px;font-weight:800;margin:9px 0 4px}
      .e19-note{font-size:12px;color:#7a879a}
      .e19-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}
      .e19-panel h2{font-size:19px;margin:0 0 7px}
      .e19-panel>p{font-size:13px;color:#7a879a;margin:0 0 20px}
      .e19-row{display:grid;grid-template-columns:90px 1fr 55px;gap:9px;align-items:center;margin:15px 0;font-size:13px}
      .e19-track{height:12px;background:#edf1f7;border-radius:20px;overflow:hidden}
      .e19-fill{height:100%;border-radius:20px}
      .e19-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px}
      .e19-table-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:15px}
      .e19-search{width:260px;max-width:100%;padding:11px;border:1px solid #dbe2ed;border-radius:9px;font:inherit}
      .e19-table-wrap{overflow-x:auto}
      .e19-table{width:100%;min-width:620px;border-collapse:collapse;font-size:13px}
      .e19-table th,.e19-table td{padding:13px 10px;border-bottom:1px solid #edf0f5;text-align:left}
      .e19-table th{font-size:11px;color:#758198}
      .e19-table td:nth-child(n+3),.e19-table th:nth-child(n+3){text-align:right}
      .e19-pill{background:#eef2f8;padding:5px 8px;border-radius:7px;font-weight:800}
      .e19-insight{padding:18px;border-radius:13px;background:#eaf1ff;border:1px solid #d8e4ff;margin-top:20px;line-height:1.65;font-size:14px}
      .e19-source{font-size:11px;color:#7b8799;line-height:1.7;margin-top:20px}
      .e19-status{padding:16px;border-radius:12px;background:#fff8ed;color:#7c4b12}
      .e19-year-switch{display:flex;gap:8px;margin:0 0 12px}
      .e19-year-switch button{border:1px solid #d4dce8;background:#fff;color:#34445a;border-radius:9px;padding:9px 15px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
      .e19-year-switch button[aria-pressed="true"]{background:#193454;border-color:#193454;color:#fff}
      @media(max-width:760px){.e19-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.e19-grid{grid-template-columns:1fr}}
      @media(max-width:430px){.e19-wrap{padding:22px 12px}.e19-card,.e19-panel{padding:15px}.e19-number{font-size:27px}.e19-row{grid-template-columns:78px 1fr 48px;gap:6px}}
    </style>
    <header class="e19-top">
      <div><strong>POLITO</strong><div style="font-size:11px;color:#bdc8d9;margin-top:4px">UTTAR PRADESH PARLIAMENTARY ELECTIONS</div></div>
      <button class="e19-back" id="e19Back" type="button">← Back to Elections</button>
    </header>
    <main class="e19-wrap">
      <div class="e19-kicker">GENERAL ELECTION · UTTAR PRADESH</div>
      <h1 class="e19-title">Uttar Pradesh Parliamentary Results</h1>
      <p class="e19-sub">Compare party seats, statewide vote shares and candidate results across both Uttar Pradesh Lok Sabha elections.</p>
      <div class="e19-year-switch" role="group" aria-label="Select Parliamentary election year">
        <button type="button" data-parliamentary-year="2024" aria-pressed="true">2024</button>
        <button type="button" data-parliamentary-year="2019" aria-pressed="false">2019</button>
      </div>
      <div id="e19DataStatus" class="e19-note" role="status" aria-live="polite"></div>
      <div id="e19ResultsContent"></div>
    </main>`;
  document.body.appendChild(page);

  page.querySelector("#e19Back").addEventListener("click", () => {
    page.remove();
    if (window.location.hash !== "#elections") window.location.hash = "#elections";
    else window.scrollTo({top:0,behavior:"auto"});
  });

  const fmt = value => Number(value).toLocaleString("en-IN");
  const esc = value => String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const colors = {
    bjp:"#f28b36",sp:"#dc4545",bsp:"#3975d5",inc:"#3988d8",adal:"#8a65c9",
    rld:"#45a66d",nota:"#8993a3",ind:"#887f9b","aspkr":"#249b9b"
  };
  const parliamentary2024Parties = [
    {name:"Samajwadi Party",short:"SP",seats:37,vote:33.60,votes:29534902,color:"#e34c4c"},
    {name:"Bharatiya Janata Party",short:"BJP",seats:33,vote:41.36,votes:36364011,color:"#f28b36"},
    {name:"Indian National Congress",short:"INC",seats:6,vote:9.46,votes:8315527,color:"#3988d8"},
    {name:"Rashtriya Lok Dal",short:"RLD",seats:2,vote:1.02,votes:893460,color:"#43a66d"},
    {name:"Apna Dal (Soneylal)",short:"AD(S)",seats:1,vote:0.92,votes:808245,color:"#8a65c9"},
    {name:"Aazad Samaj Party (Kanshi Ram)",short:"ASP(KR)",seats:1,vote:0.69,votes:602739,color:"#249b9b"},
    {name:"Bahujan Samaj Party",short:"BSP",seats:0,vote:9.39,votes:8253489,color:"#3c70d0"}
  ];
  let selectedYear = 2024;
  let parliamentary2019Parties = null;
  const status = page.querySelector("#e19DataStatus");
  const content = page.querySelector("#e19ResultsContent");
  const renderParliamentaryResults = (year, parties) => {
    const [largest,second,third] = parties;
    content.innerHTML=`
      <div class="e19-stats">
        <article class="e19-card"><div class="e19-label">TOTAL SEATS</div><div class="e19-number">80</div><div class="e19-note">Uttar Pradesh Lok Sabha seats</div></article>
        <article class="e19-card"><div class="e19-label">LARGEST PARTY</div><div class="e19-number">${esc(largest.short)} · ${largest.seats}</div><div class="e19-note">${esc(largest.name)} · seats won</div></article>
        <article class="e19-card"><div class="e19-label">2ND LARGEST PARTY</div><div class="e19-number">${esc(second.short)} · ${second.seats}</div><div class="e19-note">${esc(second.name)} · seats won</div></article>
        <article class="e19-card"><div class="e19-label">3RD LARGEST PARTY</div><div class="e19-number">${esc(third.short)} · ${third.seats}</div><div class="e19-note">${esc(third.name)} · seats won</div></article>
      </div>
      <div class="e19-grid">
        <article class="e19-panel"><h2>Seats won by party</h2><p>Each bar represents seats won out of 80.</p><div class="e19-seat-chart"></div></article>
        <article class="e19-panel"><h2>Party vote share</h2><p>Statewide share of reported candidate votes.</p><div class="e19-vote-chart"></div></article>
      </div>
      <section class="e19-panel" style="margin-top:20px">
        <div class="e19-table-head"><div><h2>Party-wise results · ${year}</h2><p style="margin-top:6px">Seats, candidate votes and statewide vote share.</p></div><input class="e19-search" placeholder="Search party…" aria-label="Search parties"></div>
        <div class="e19-table-wrap"><table class="e19-table"><thead><tr><th>PARTY</th><th>SEATS</th><th>VOTES</th><th>VOTE SHARE</th></tr></thead><tbody class="e19-rows"></tbody></table></div>
      </section>
      <div class="e19-insight"><strong>Result overview · ${year}</strong><br>${esc(largest.name)} won the most seats in Uttar Pradesh with ${largest.seats}. ${esc(second.name)} won ${second.seats}, and ${esc(third.name)} won ${third.seats}.</div>
      <button class="e19-back e19-segments" type="button" style="margin-top:16px">View ${year} Assembly segment results ↗</button>
      <div class="e19-source">${year===2019?"Party seats are based on each constituency's highest-vote candidate. Vote shares are calculated from the supplied dataset, excluding NOTA; source party labels are retained without alliance grouping.<br>Source: supplied 2019 Lok Sabha candidate data (<code>data/up-lok-sabha-2019-candidates.csv</code>). Verify with Election Commission records before publication.":"2024 statewide party results from published Uttar Pradesh Lok Sabha results. Figures are rounded; the table includes the main parties.<br><a href=\"https://results.eci.gov.in/PcResultGenJune2024/partywiseresult-S24.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Election Commission of India results ↗</a>"}</div>`;

    const topParties=parties.slice(0,8);
    content.querySelector(".e19-seat-chart").innerHTML=topParties.map(party=>`
      <div class="e19-row"><div><i class="e19-dot" style="background:${party.color}"></i><b>${esc(party.short)}</b></div><div class="e19-track"><div class="e19-fill" style="width:${party.seats/80*100}%;background:${party.color}"></div></div><strong>${party.seats}</strong></div>`).join("");
    content.querySelector(".e19-vote-chart").innerHTML=topParties.map(party=>`
      <div class="e19-row"><div><i class="e19-dot" style="background:${party.color}"></i><b>${esc(party.short)}</b></div><div class="e19-track"><div class="e19-fill" style="width:${party.vote}%;background:${party.color}"></div></div><strong>${party.vote.toFixed(2)}%</strong></div>`).join("");
    const tbody=content.querySelector(".e19-rows");
    const tableParties=year===2019?parties.slice(0,7):parties;
    const renderRows=query=>{
      tbody.innerHTML=tableParties.filter(party=>(party.name+" "+party.short).toLowerCase().includes(query.toLowerCase())).map(party=>`
        <tr><td><i class="e19-dot" style="background:${party.color}"></i><b>${esc(party.name)}</b>${party.name!==party.short?`<div style="font-size:11px;color:#7a879a;margin:4px 0 0 18px">${esc(party.short)}</div>`:""}</td><td><span class="e19-pill">${party.seats}</span></td><td>${fmt(party.votes)}</td><td><b>${party.vote.toFixed(2)}%</b></td></tr>`).join("");
    };
    renderRows("");
    content.querySelector(".e19-search").addEventListener("input",event=>renderRows(event.target.value));
    content.querySelector(".e19-segments")?.addEventListener("click",()=>openParliamentarySegmentResults(year));
  };

  page.querySelectorAll("[data-parliamentary-year]").forEach(button => button.addEventListener("click", () => {
    selectedYear = Number(button.dataset.parliamentaryYear);
    page.querySelectorAll("[data-parliamentary-year]").forEach(yearButton => {
      yearButton.setAttribute("aria-pressed", String(Number(yearButton.dataset.parliamentaryYear) === selectedYear));
    });
    if (selectedYear === 2024) {
      status.textContent = "";
      renderParliamentaryResults(2024, parliamentary2024Parties);
    } else if (parliamentary2019Parties) {
      status.textContent = "";
      renderParliamentaryResults(2019, parliamentary2019Parties);
    } else {
      status.textContent = "Loading 2019 Parliamentary results…";
    }
  }));
  renderParliamentaryResults(2024, parliamentary2024Parties);

  try {
    const response = await fetch("data/up-lok-sabha-2019-candidates.csv");
    if (!response.ok) throw new Error(`Could not load 2019 parliamentary results (HTTP ${response.status})`);
    const csv = (await response.text()).replace(/^\uFEFF/,"");
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      if (char === '"' && quoted && csv[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(field); field = ""; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && csv[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
        field = "";
      } else field += char;
    }
    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);

    const headers = (rows.shift() || []).map(value => value.trim());
    const index = Object.fromEntries(headers.map((header, i) => [header, i]));
    const required = ["State_Name", "Year", "Constituency_Name", "Candidate", "Party", "Votes", "Election_Type"];
    const missing = required.filter(header => index[header] === undefined);
    if (missing.length) throw new Error(`2019 result file is missing columns: ${missing.join(", ")}`);
    const normalize = value => String(value || "").toLowerCase().replace(/_/g, " ").replace(/[^a-z0-9]/g, "");
    const candidatesBySeat = new Map();
    for (const values of rows) {
      const value = header => String(values[index[header]] || "").trim();
      if (normalize(value("State_Name")) !== "uttarpradesh" || value("Year") !== "2019" ||
          !/Lok Sabha/i.test(value("Election_Type") || "")) continue;
      const seat = value("Constituency_Name");
      const candidate = value("Candidate");
      const party = value("Party");
      const votes = Number(value("Votes"));
      if (!seat || !candidate || !party) continue;
      if (!Number.isFinite(votes)) throw new Error(`Invalid vote count for ${candidate} in ${seat}`);
      const key = normalize(seat);
      if (!candidatesBySeat.has(key)) candidatesBySeat.set(key, []);
      candidatesBySeat.get(key).push({candidate,party,votes});
    }
    if (candidatesBySeat.size !== 80) throw new Error(`Expected results for 80 constituencies, found ${candidatesBySeat.size}`);

    const aggregate = new Map();
    let validVotes = 0;
    for (const candidates of candidatesBySeat.values()) {
      candidates.sort((a,b)=>b.votes-a.votes);
      const validCandidates = candidates.filter(candidate =>
        normalize(candidate.party) !== "nota" && normalize(candidate.candidate) !== "nota"
      );
      const winner = validCandidates[0];
      for (const candidate of validCandidates) {
        validVotes += candidate.votes;
        const key = normalize(candidate.party);
        if (!aggregate.has(key)) aggregate.set(key,{name:candidate.party,short:candidate.party,seats:0,votes:0});
        aggregate.get(key).votes += candidate.votes;
      }
      if (winner) aggregate.get(normalize(winner.party)).seats++;
    }
    if (!validVotes || [...aggregate.values()].reduce((total,party)=>total+party.seats,0)!==80) {
      throw new Error("2019 party totals did not reconcile to 80 parliamentary seats");
    }
    const palette=["#269d9d","#b49b38","#d85d68","#64748b"];
    const parties=[...aggregate.values()]
      .map(party=>({...party,vote:party.votes/validVotes*100,color:colors[normalize(party.short)]}))
      .sort((a,b)=>b.seats-a.seats||b.votes-a.votes);
    parties.forEach((party,i)=>{if(!party.color)party.color=palette[i%palette.length];});
    parliamentary2019Parties = parties;
    if (selectedYear === 2019) {
      status.textContent = "";
      renderParliamentaryResults(2019, parties);
    }
  } catch (error) {
    console.error("2019 parliamentary results could not load:",error);
    if (selectedYear === 2019) status.textContent=`2019 Parliamentary results could not load: ${error.message}`;
  }
}

async function openParliamentarySegmentResults(year) {
  let page = document.getElementById("electionParliamentSegmentResultsPage");
  if (page) {
    if (Number(page.dataset.electionYear) === year) {
      page.hidden = false;
      page.scrollTop = 0;
      return;
    }
    page.remove();
  }

  page = document.createElement("section");
  page.id = "electionParliamentSegmentResultsPage";
  page.dataset.electionYear = String(year);
  page.style.cssText = "position:fixed;inset:0;z-index:10000;overflow:auto;background:#f4f6fb;color:#172238;font-family:inherit";
  page.innerHTML = `
    <style>
      #electionParliamentSegmentResultsPage *{box-sizing:border-box}
      .e19s-top{background:#101a2d;color:#fff;padding:18px clamp(16px,4vw,55px);display:flex;justify-content:space-between;align-items:center;gap:12px}
      .e19s-back{background:#26344c;color:#fff;border:1px solid #536078;border-radius:9px;padding:10px 14px;cursor:pointer;font:inherit}
      .e19s-wrap{max-width:1200px;margin:auto;padding:30px 20px 55px}
      .e19s-kicker{font-size:11px;letter-spacing:1.5px;font-weight:800;color:#6d7a90}
      .e19s-title{font-size:clamp(30px,5vw,46px);margin:10px 0}
      .e19s-muted{color:#718096;line-height:1.6;margin:0 0 24px}
      .e19s-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .e19s-card,.e19s-panel{background:#fff;border:1px solid #e2e8f1;border-radius:16px;padding:20px}
      .e19s-label{font-size:12px;color:#738097;font-weight:700}
      .e19s-number{font-size:30px;font-weight:800;margin:9px 0 4px}
      .e19s-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}
      .e19s-row{display:grid;grid-template-columns:90px 1fr 55px;gap:9px;align-items:center;margin:15px 0;font-size:13px}
      .e19s-track{height:12px;background:#edf1f7;border-radius:20px;overflow:hidden}
      .e19s-fill{height:100%;border-radius:20px}
      .e19s-table-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:15px}
      .e19s-search{width:270px;max-width:100%;padding:11px;border:1px solid #dbe2ed;border-radius:9px;font:inherit}
      .e19s-table-wrap{overflow-x:auto}
      .e19s-table{width:100%;min-width:760px;border-collapse:collapse;font-size:13px}
      .e19s-table th,.e19s-table td{padding:12px 10px;border-bottom:1px solid #edf0f5;text-align:left}
      .e19s-table th{font-size:11px;color:#758198}
      .e19s-table td:nth-child(n+4),.e19s-table th:nth-child(n+4){text-align:right}
      .e19s-error{padding:16px;border-radius:12px;background:#fff8ed;border:1px solid #f2d1a7;color:#7c4b12}
      .e19s-source{font-size:11px;color:#7b8799;line-height:1.7;margin-top:20px}
      @media(max-width:760px){.e19s-stats,.e19s-grid{grid-template-columns:1fr}}
      @media(max-width:430px){.e19s-wrap{padding:22px 12px}.e19s-card,.e19s-panel{padding:15px}}
    </style>
    <header class="e19s-top">
      <div><strong>POLITO</strong><div style="font-size:11px;color:#bdc8d9;margin-top:4px">ASSEMBLY SEGMENT RESULTS · LOK SABHA ${year}</div></div>
      <button class="e19s-back" type="button">← Back to Parliamentary Results</button>
    </header>
    <main class="e19s-wrap">
      <div class="e19s-kicker">UTTAR PRADESH · LOK SABHA ELECTION ${year}</div>
      <h1 class="e19s-title">${year} Assembly Segment Results</h1>
      <p class="e19s-muted">The leading candidate and party in each Assembly constituency, based on votes cast there during the ${year} Lok Sabha election. These are segment leads, not Assembly election results.</p>
      <div class="e19s-content" role="status" aria-live="polite">Loading ${year} Assembly segment results…</div>
    </main>`;
  document.body.appendChild(page);
  page.querySelector(".e19s-back").addEventListener("click", () => {
    page.remove();
    const dashboard = document.getElementById("electionParliamentFullPage");
    if (dashboard) {
      dashboard.hidden = false;
      dashboard.scrollTop = 0;
    }
  });

  try {
    const response = await fetch(`data/up-lok-sabha-${year}-segments.csv`);
    if (!response.ok) throw new Error(`Could not load ${year} segment results (HTTP ${response.status})`);
    const text = (await response.text()).replace(/^\uFEFF/,"");
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(field); field = ""; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
        field = "";
      } else field += char;
    }
    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);
    const headerRowIndex = rows.findIndex(values =>
      values.some(value => value.trim() === "CANDIDATE NAME") &&
      values.some(value => value.trim() === "AC NO") &&
      values.some(value => /^(State-UT Code & Name|State\/UT Name)$/.test(value.trim()))
    );
    if (headerRowIndex < 0) throw new Error(`${year} segment data header row was not found`);
    const headers = rows.splice(headerRowIndex,1)[0].map(value => value.trim());
    const index = Object.fromEntries(headers.map((header,i) => [header,i]));
    const stateHeader = year === 2019 ? "State-UT Code & Name" : "State/UT Name";
    const required = [stateHeader,"PC NO","PC NAME","AC NO","AC NAME","CANDIDATE NAME","PARTY","VOTES SECURED EVM"];
    const missing = required.filter(header => index[header] === undefined);
    if (missing.length) throw new Error(`2019 segment data is missing columns: ${missing.join(", ")}`);
    const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g,"");
    const esc = value => String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    const segments = new Map();
    for (const values of rows) {
      const value = header => String(values[index[header]] || "").trim();
      if (normalize(value(stateHeader)) !== "uttarpradesh") continue;
      const pcNo = value("PC NO"), pcName = value("PC NAME");
      const acNo = value("AC NO"), acName = value("AC NAME");
      const candidate = value("CANDIDATE NAME"), party = value("PARTY");
      if (!pcNo || !pcName || !acNo || !acName || !candidate || !party) continue;
      const votes = Number(value("VOTES SECURED EVM").replace(/,/g,""));
      if (!Number.isFinite(votes)) throw new Error(`Invalid segment vote total for ${candidate} in ${acName}`);
      const key = `${pcNo}:${acNo}`;
      if (!segments.has(key)) segments.set(key,{pcNo,pcName,acNo,acName,candidates:[]});
      segments.get(key).candidates.push({candidate,party,votes});
    }
    if (segments.size !== 403) throw new Error(`Expected 403 Assembly segments for ${year}, found ${segments.size}`);
    const partyLeads = new Map();
    const results = [...segments.values()].map(segment => {
      segment.candidates.sort((a,b) => b.votes-a.votes);
      const [winner,runner] = segment.candidates;
      if (!winner || !runner) throw new Error(`Incomplete candidate results for ${segment.acName}`);
      const partyKey = normalize(winner.party);
      if (!partyLeads.has(partyKey)) partyLeads.set(partyKey,{party:winner.party,seats:0});
      partyLeads.get(partyKey).seats++;
      return {...segment,winner,runner,margin:winner.votes-runner.votes};
    }).sort((a,b) => Number(a.acNo)-Number(b.acNo));
    const leads = [...partyLeads.values()].sort((a,b)=>b.seats-a.seats||a.party.localeCompare(b.party));
    const largest = leads[0];
    const content = page.querySelector(".e19s-content");
    content.removeAttribute("role");
    content.innerHTML = `
      <div class="e19s-stats">
        <article class="e19s-card"><div class="e19s-label">TOTAL ASSEMBLY SEGMENTS</div><div class="e19s-number">403</div></article>
        <article class="e19s-card"><div class="e19s-label">MOST SEGMENT LEADS</div><div class="e19s-number">${largest.seats} · ${esc(largest.party)}</div></article>
        <article class="e19s-card"><div class="e19s-label">2ND MOST SEGMENT LEADS</div><div class="e19s-number">${esc(leads[1]?.party||"—")} · ${leads[1]?.seats??0}</div></article>
      </div>
      <div class="e19s-grid">
        <article class="e19s-panel"><h2>Assembly segment leads by party</h2><p>Each bar represents leads out of 403 Assembly constituencies.</p><div class="e19s-chart"></div></article>
        <article class="e19s-panel"><h2>Segment lead totals</h2><p>Party receiving the most votes within each Assembly constituency.</p><div class="e19s-lead-list"></div></article>
      </div>
      <section class="e19s-panel" style="margin-top:20px">
        <div class="e19s-table-head"><div><h2>Results in all 403 Assembly segments</h2><p style="margin-top:6px">Winner, runner-up, votes and margin for the ${year} Lok Sabha election.</p></div><input class="e19s-search" placeholder="Search segment, PC or party…" aria-label="Search segment results"></div>
        <div class="e19s-table-wrap"><table class="e19s-table"><thead><tr><th>PC</th><th>ASSEMBLY CONSTITUENCY</th><th>WINNER / PARTY</th><th>VOTES</th><th>RUNNER-UP</th><th>MARGIN</th></tr></thead><tbody></tbody></table></div>
      </section>
      <div class="e19s-source">Segment leader is the candidate with the highest vote total in the Assembly constituency during the ${year} Lok Sabha election. Margin is the difference from the runner-up. Source: <code>data/up-lok-sabha-${year}-segments.csv</code>.</div>`;
    const colors = {bjp:"#f28b36",sp:"#dc4545",bsp:"#3975d5",inc:"#3988d8",adal:"#8a65c9",rld:"#45a66d"};
    content.querySelector(".e19s-chart").innerHTML = leads.slice(0,10).map(lead=>`
      <div class="e19s-row"><b>${esc(lead.party)}</b><div class="e19s-track"><div class="e19s-fill" style="width:${lead.seats/403*100}%;background:${colors[normalize(lead.party)]||"#64748b"}"></div></div><strong>${lead.seats}</strong></div>`).join("");
    content.querySelector(".e19s-lead-list").innerHTML = leads.map(lead=>`
      <div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #edf0f5"><span>${esc(lead.party)}</span><b>${lead.seats}</b></div>`).join("");
    const tbody = content.querySelector("tbody");
    const renderRows = query => {
      const term = normalize(query);
      tbody.innerHTML = results.filter(result=>normalize(`${result.pcName} ${result.acName} ${result.winner.candidate} ${result.winner.party} ${result.runner.candidate}`).includes(term)).map(result=>`
        <tr><td>${esc(result.pcNo)} · ${esc(result.pcName)}</td><td>${esc(result.acNo)} · ${esc(result.acName)}</td><td><b>${esc(result.winner.candidate)}</b><div style="font-size:11px;color:#7a879a;margin-top:4px">${esc(result.winner.party)}</div></td><td>${Number(result.winner.votes).toLocaleString("en-IN")}</td><td>${esc(result.runner.candidate)}<div style="font-size:11px;color:#7a879a;margin-top:4px">${esc(result.runner.party)}</div></td><td>${Number(result.margin).toLocaleString("en-IN")}</td></tr>`).join("");
    };
    renderRows("");
    content.querySelector(".e19s-search").addEventListener("input",event=>renderRows(event.target.value));
  } catch (error) {
    console.error(`${year} Parliamentary segment results could not load:`,error);
    const content = page.querySelector(".e19s-content");
    content.className = "e19s-error";
    content.textContent = `${year} segment results could not load: ${error.message}`;
  }
}

function open2024ElectionPage() {
  let page = document.getElementById("election2024FullPage");
  if (page) {
    page.hidden = false;
    return;
  }

  const parties = [
    {name:"Samajwadi Party",short:"SP",seats:37,vote:33.60,votes:29534902,color:"#e34c4c"},
    {name:"Bharatiya Janata Party",short:"BJP",seats:33,vote:41.36,votes:36364011,color:"#f28b36"},
    {name:"Indian National Congress",short:"INC",seats:6,vote:9.46,votes:8315527,color:"#3988d8"},
    {name:"Rashtriya Lok Dal",short:"RLD",seats:2,vote:1.02,votes:893460,color:"#43a66b"},
    {name:"Apna Dal (Soneylal)",short:"AD(S)",seats:1,vote:0.92,votes:808245,color:"#8a65c9"},
    {name:"Aazad Samaj Party (Kanshi Ram)",short:"ASP(KR)",seats:1,vote:0.69,votes:602739,color:"#249b9b"},
    {name:"Bahujan Samaj Party",short:"BSP",seats:0,vote:9.39,votes:8253489,color:"#3c70d0"}
  ];

  const fmt = n => Number(n).toLocaleString("en-IN");
  const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  page = document.createElement("section");
  page.id = "election2024FullPage";
  page.className = "election2024-full-page";
  page.style.cssText = "position:fixed;inset:0;z-index:9999;overflow:auto;background:#f4f6fb;color:#172238;font-family:inherit";
  page.innerHTML = `
    <style>
      .e24-top{background:#101a2d;color:white;padding:18px clamp(16px,4vw,55px);display:flex;justify-content:space-between;align-items:center;gap:12px}
      .e24-back{background:#26344c;color:white;border:1px solid #536078;border-radius:9px;padding:10px 14px;cursor:pointer;font:inherit}
      .e24-wrap{max-width:1200px;margin:auto;padding:30px 20px 55px}
      .e24-kicker{font-size:11px;letter-spacing:1.5px;font-weight:800;color:#6d7a90}
      .e24-title{font-size:clamp(30px,5vw,46px);margin:10px 0}
      .e24-sub{color:#718096;line-height:1.6;margin:0 0 24px}
      .e24-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      .e24-card,.e24-panel{background:white;border:1px solid #e2e8f1;border-radius:16px;padding:20px}
      .e24-label{font-size:12px;color:#738097;font-weight:700}
      .e24-number{font-size:32px;font-weight:800;margin:9px 0 4px}
      .e24-note{font-size:12px;color:#7a879a}
      .e24-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}
      .e24-panel h2{font-size:19px;margin:0 0 7px}
      .e24-panel>p{font-size:13px;color:#7a879a;margin:0 0 20px}
      .e24-row{display:grid;grid-template-columns:75px 1fr 55px;gap:9px;align-items:center;margin:15px 0;font-size:13px}
      .e24-track{height:12px;background:#edf1f7;border-radius:20px;overflow:hidden}
      .e24-fill{height:100%;border-radius:20px}
      .e24-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:7px}
      .e24-table-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:15px}
      .e24-search{width:260px;max-width:100%;padding:11px;border:1px solid #dbe2ed;border-radius:9px;font:inherit}
      .e24-table-wrap{overflow-x:auto}
      .e24-table{width:100%;min-width:620px;border-collapse:collapse;font-size:13px}
      .e24-table th,.e24-table td{padding:13px 10px;border-bottom:1px solid #edf0f5;text-align:left}
      .e24-table th{font-size:11px;color:#758198}
      .e24-table td:nth-child(n+3),.e24-table th:nth-child(n+3){text-align:right}
      .e24-pill{background:#eef2f8;padding:5px 8px;border-radius:7px;font-weight:800}
      .e24-insight{padding:18px;border-radius:13px;background:#eaf1ff;border:1px solid #d8e4ff;margin-top:20px;line-height:1.65;font-size:14px}
      .e24-source{font-size:11px;color:#7b8799;line-height:1.7;margin-top:20px}
      @media(max-width:760px){.e24-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.e24-grid{grid-template-columns:1fr}}
      @media(max-width:430px){.e24-wrap{padding:22px 12px}.e24-card,.e24-panel{padding:15px}.e24-number{font-size:27px}.e24-row{grid-template-columns:65px 1fr 48px;gap:6px}}
    </style>

    <header class="e24-top">
      <div><strong>POLITO</strong><div style="font-size:11px;color:#bdc8d9;margin-top:4px">LOK SABHA ELECTIONS · 2024</div></div>
      <button class="e24-back" id="e24Back" type="button">← Back to Parliamentary Results</button>
    </header>

    <div class="e24-wrap">
      <div class="e24-kicker">GENERAL ELECTION · UTTAR PRADESH</div>
      <h1 class="e24-title">Lok Sabha Election 2024</h1>
      <p class="e24-sub">Explore the results across all 80 parliamentary constituencies in Uttar Pradesh.</p>

      
<div class="e24-stats">
  <article class="e24-card">
    <div class="e24-label">TOTAL SEATS</div>
    <div class="e24-number">80</div>
    <div class="e24-note">Uttar Pradesh Lok Sabha seats</div>
  </article>
  <article class="e24-card">
    <div class="e24-label">LARGEST PARTY</div>
    <div class="e24-number">SP · 37</div>
    <div class="e24-note">Samajwadi Party · seats won</div>
  </article>
  <article class="e24-card">
    <div class="e24-label">2ND LARGEST PARTY</div>
    <div class="e24-number">BJP · 33</div>
    <div class="e24-note">Bharatiya Janata Party · seats won</div>
  </article>
  <article class="e24-card">
    <div class="e24-label">3RD LARGEST PARTY</div>
    <div class="e24-number">INC · 6</div>
    <div class="e24-note">Indian National Congress · seats won</div>
  </article>
</div>


      <div class="e24-grid">
        <article class="e24-panel">
          <h2>Seats won by party</h2>
          <p>Each bar represents seats won out of 80.</p>
          <div id="e24SeatChart"></div>
        </article>
        <article class="e24-panel">
          <h2>Party vote share</h2>
          <p>Published statewide vote share for selected parties.</p>
          <div id="e24VoteChart"></div>
        </article>
      </div>

      <section class="e24-panel" style="margin-top:20px">
        <div class="e24-table-head">
          <div><h2>Party-wise results</h2><p style="margin-top:6px">Seats, candidate votes and statewide vote share.</p></div>
          <input class="e24-search" id="e24Search" placeholder="Search party…" aria-label="Search parties">
        </div>
        <div class="e24-table-wrap">
          <table class="e24-table">
            <thead><tr><th>PARTY</th><th>SEATS</th><th>VOTES</th><th>VOTE SHARE</th></tr></thead>
            <tbody id="e24Rows"></tbody>
          </table>
        </div>
      </section>

      <section class="e24-panel" style="margin-top:20px">
        <div class="e24-kicker">GROUND-LEVEL PERFORMANCE</div>
        <h2 style="font-size:25px;margin:8px 0">Assembly Segment Leads · 2024</h2>
        <p>How parties led across Uttar Pradesh's 403 Assembly segments during the Lok Sabha election.</p>

        <div class="e24-stats" style="margin:20px 0">
          <article class="e24-card">
            <div class="e24-label">INDIA BLOC</div>
            <div class="e24-number" style="color:#25845b">224</div>
            <div class="e24-note">55.6% of segments</div>
          </article>
          <article class="e24-card">
            <div class="e24-label">NDA</div>
            <div class="e24-number" style="color:#e58a2b">174</div>
            <div class="e24-note">43.2% of segments</div>
          </article>
          <article class="e24-card">
            <div class="e24-label">OTHERS</div>
            <div class="e24-number" style="color:#8a65c9">5</div>
            <div class="e24-note">1.2% of segments</div>
          </article>
          <article class="e24-card">
            <div class="e24-label">TOTAL SEGMENTS</div>
            <div class="e24-number">403</div>
            <div class="e24-note">Across 80 Lok Sabha seats</div>
          </article>
        </div>

        <h3 style="font-size:17px;margin:24px 0 14px">Party-wise lead scoreboard</h3>

        <div style="display:grid;gap:15px">
          <div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:6px">
              <strong>Samajwadi Party (SP)</strong><strong>184</strong>
            </div>
            <div style="height:11px;background:#edf1f7;border-radius:20px;overflow:hidden">
              <div style="height:100%;width:45.66%;background:#e34c4c;border-radius:20px"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:6px">
              <strong>Bharatiya Janata Party (BJP)</strong><strong>162</strong>
            </div>
            <div style="height:11px;background:#edf1f7;border-radius:20px;overflow:hidden">
              <div style="height:100%;width:40.20%;background:#f28b36;border-radius:20px"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:6px">
              <strong>Indian National Congress (INC)</strong><strong>39</strong>
            </div>
            <div style="height:11px;background:#edf1f7;border-radius:20px;overflow:hidden">
              <div style="height:100%;width:9.68%;background:#3988d8;border-radius:20px"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:6px">
              <strong>Rashtriya Lok Dal (RLD)</strong><strong>8</strong>
            </div>
            <div style="height:11px;background:#edf1f7;border-radius:20px;overflow:hidden">
              <div style="height:100%;width:1.99%;min-width:4px;background:#43a66b;border-radius:20px"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:6px">
              <strong>Aazad Samaj Party (Kanshi Ram)</strong><strong>5</strong>
            </div>
            <div style="height:11px;background:#edf1f7;border-radius:20px;overflow:hidden">
              <div style="height:100%;width:1.24%;min-width:4px;background:#249b9b;border-radius:20px"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:6px">
              <strong>Apna Dal (Soneylal)</strong><strong>4</strong>
            </div>
            <div style="height:11px;background:#edf1f7;border-radius:20px;overflow:hidden">
              <div style="height:100%;width:0.99%;min-width:4px;background:#8a65c9;border-radius:20px"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:6px">
              <strong>All India Trinamool Congress (AITC)</strong><strong>1</strong>
            </div>
            <div style="height:11px;background:#edf1f7;border-radius:20px;overflow:hidden">
              <div style="height:100%;width:0.25%;min-width:4px;background:#d85d68;border-radius:20px"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:6px">
              <strong>Suheldev Bharatiya Samaj Party (SBSP)</strong><strong>0</strong>
            </div>
            <div style="height:11px;background:#edf1f7;border-radius:20px;overflow:hidden"></div>
          </div>
        </div>

        <div class="e24-insight" style="margin-top:24px">
          <strong>What the scoreboard tells us</strong><br>
          SP led in 184 segments, the highest for any party. SP and Congress together led in 223 segments, plus one AITC-led segment, giving the INDIA bloc grouping 224. BJP led in 162 segments; NDA allies RLD and Apna Dal (Soneylal) led in 8 and 4 respectively. ASP(KR) led in 5 segments.
        </div>
        <div class="e24-source">
          Assembly-segment leads are based on the leading party within each segment of the 2024 Lok Sabha election. Alliance totals group parties according to their 2024 electoral alliances; they are not Assembly election seat counts.
          <br><a href="https://data.gov.in/catalog/general-election-lok-sabha-2024-statistical-reports-data" target="_blank" rel="noopener noreferrer">Election Commission statistical data on data.gov.in ↗</a>
        </div>
      </section>


      <div class="e24-insight">
        <strong>Result overview</strong><br>
        SP won 37 seats and BJP won 33. Congress won 6 seats, RLD won 2, and Apna Dal (Soneylal) and Aazad Samaj Party (Kanshi Ram) won one seat each. BSP won no seats despite receiving a statewide vote share of about 9.39%.
      </div>

      <div class="e24-source">
        Source: published 2024 Uttar Pradesh parliamentary results and party-wise vote totals. Vote-share figures are rounded. The table highlights the main parties rather than every registered party and independent candidate.
        <br><a href="https://results.eci.gov.in/PcResultGenJune2024/partywiseresult-S24.htm" target="_blank" rel="noopener noreferrer">View Election Commission of India results ↗</a>
        · <a href="https://www.electionsarchive.in/lok-sabha/2024/uttar-pradesh/" target="_blank" rel="noopener noreferrer">Explore constituency-wise results ↗</a>
      </div>
    </div>`;

  document.body.appendChild(page);

  page.querySelector("#e24SeatChart").innerHTML = parties.map(p=>`
    <div class="e24-row">
      <div><i class="e24-dot" style="background:${p.color}"></i><b>${p.short}</b></div>
      <div class="e24-track"><div class="e24-fill" style="width:${p.seats/80*100}%;background:${p.color}"></div></div>
      <strong>${p.seats}</strong>
    </div>`).join("");

  page.querySelector("#e24VoteChart").innerHTML = parties.map(p=>`
    <div class="e24-row">
      <div><i class="e24-dot" style="background:${p.color}"></i><b>${p.short}</b></div>
      <div class="e24-track"><div class="e24-fill" style="width:${p.vote}%;background:${p.color}"></div></div>
      <strong>${p.vote.toFixed(2)}%</strong>
    </div>`).join("");

  const tbody = page.querySelector("#e24Rows");
  function renderRows(query="") {
    tbody.innerHTML = parties.filter(p=>(p.name+" "+p.short).toLowerCase().includes(query.toLowerCase())).map(p=>`
      <tr>
        <td><i class="e24-dot" style="background:${p.color}"></i><b>${esc(p.name)}</b><div style="font-size:11px;color:#7a879a;margin-top:4px">${p.short}</div></td>
        <td><span class="e24-pill">${p.seats}</span></td>
        <td>${fmt(p.votes)}</td>
        <td><b>${p.vote.toFixed(2)}%</b></td>
      </tr>`).join("");
  }
  renderRows();

  
  page.querySelector("#e24Search").addEventListener("input",e=>renderRows(e.target.value));

  page.querySelector("#e24Back").addEventListener("click",(event)=>{
    event.preventDefault();
    event.stopPropagation();
    const dashboard = document.getElementById("election2024FullPage");
    if (dashboard) dashboard.remove();
    const parliamentaryDashboard = document.getElementById("electionParliamentFullPage");
    if (parliamentaryDashboard) {
      parliamentaryDashboard.hidden = false;
      parliamentaryDashboard.scrollTop = 0;
      return;
    }
    document.body.style.overflow = "";
    if (window.location.hash !== "#elections") {
      window.location.hash = "#elections";
    } else {
      window.scrollTo({top: 0, behavior: "auto"});
    }
  });
}




