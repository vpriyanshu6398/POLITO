function openLocalElectionResultsPage(initialBody = "nagar-nigam") {
  let page = document.getElementById("localElectionResultsPage");
  if (page) {
    page.hidden = false;
    page.scrollTop = 0;
    page.querySelector(`[data-local-result-body="${initialBody}"]`)?.click();
    return;
  }

  page = document.createElement("section");
  page.id = "localElectionResultsPage";
  page.style.cssText = "position:fixed;inset:0;z-index:9999;overflow:auto;background:#f4f6fb;color:#172238;font-family:inherit";
  page.innerHTML = `
    <style>
      #localElectionResultsPage *{box-sizing:border-box}
      .local-results-top{background:#101a2d;color:#fff;padding:18px clamp(16px,4vw,55px);display:flex;justify-content:space-between;align-items:center;gap:12px}
      .local-results-back{background:#26344c;color:#fff;border:1px solid #536078;border-radius:9px;padding:10px 14px;cursor:pointer;font:inherit}
      .local-results-wrap{max-width:1320px;margin:auto;padding:30px 20px 55px}
      .local-results-hero{position:relative;overflow:hidden;border-radius:22px;padding:clamp(24px,4vw,42px);margin-bottom:20px;background:radial-gradient(circle at 85% 15%,#3970b8 0,transparent 32%),linear-gradient(125deg,#102039,#1d3c62 72%,#2b5684);color:#fff;box-shadow:0 18px 44px #152b481c}
      .local-results-hero:after{content:"";position:absolute;width:230px;height:230px;border:1px solid #ffffff1a;border-radius:50%;right:-58px;bottom:-135px;box-shadow:0 0 0 30px #ffffff08,0 0 0 60px #ffffff06}
      .local-results-kicker{font-size:11px;letter-spacing:1.5px;font-weight:800;color:#9dbce1}
      .local-results-title{font-size:clamp(30px,5vw,45px);line-height:1.08;margin:11px 0}
      .local-results-sub{max-width:720px;color:#d4dfed;line-height:1.65;margin:0}
      .local-results-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 17px;padding:5px;border:1px solid #e7edf4;border-radius:14px;background:#edf2f8}
      .local-results-tabs button{min-height:42px;border:1px solid transparent;background:transparent;color:#596a81;border-radius:10px;padding:9px 15px;font:inherit;font-size:12px;font-weight:750;cursor:pointer;transition:background .18s,border-color .18s,color .18s,transform .18s,box-shadow .18s}
      .local-results-tabs button:hover{transform:translateY(-1px);border-color:#d9e2ed;background:#fff;color:#233c5d}
      .local-results-tabs button[aria-pressed="true"]{background:#fff;border-color:#dce5f0;color:#17385f;box-shadow:0 3px 9px #19345412}
      .local-results-tabs button:focus-visible,.gp-result-filter-options button:focus-visible{outline:3px solid #4c83bd55;outline-offset:2px}
      .local-results-meta{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 12px;color:#6e7b90;font-size:13px}
      .local-results-source{color:#315f9f;font-weight:750;text-decoration:none}
      .local-results-source:hover{text-decoration:underline}
      .local-results-notice{padding:11px 14px;border-radius:10px;color:#586980;background:#fff;border:1px solid #e1e7ef;font-size:12px;line-height:1.55;margin:0 0 14px}
      .local-results-unavailable{padding:20px;border:1px solid #f0d5d1;border-radius:12px;color:#9b3529;background:#fff7f5;font-size:14px;line-height:1.7}
      .urban-results-panel{overflow:hidden;border:1px solid #e0e7f0;border-radius:18px;background:#fff;box-shadow:0 10px 30px #1d34500b}
      .urban-results-toolbar{padding:18px 20px;border-bottom:1px solid #e9eef4;background:linear-gradient(180deg,#fff,#fbfcfe)}
      .urban-results-toolbar-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:15px}
      .urban-results-heading{font-size:18px;margin:0 0 4px;color:#1d2b3e}
      .urban-results-caption{font-size:12px;color:#75839a;line-height:1.5}
      .urban-results-live{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border-radius:999px;background:#edf7f0;color:#297348;font-size:10px;font-weight:800;white-space:nowrap}
      .urban-results-live:before{content:"";width:7px;height:7px;border-radius:50%;background:#3aa66a}
      .urban-results-controls{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,1.4fr) minmax(190px,1fr);gap:11px}
      .urban-results-controls label{display:grid;gap:6px;color:#6e7d92;font-size:11px;font-weight:750}
      .gp-result-filters{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;padding:11px 12px;border:1px solid #e7edf4;border-radius:12px;background:#f8fafd}
      .gp-result-filter-label{color:#77869a;font-size:10px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;white-space:nowrap}
      .gp-result-filter-options{display:flex;flex-wrap:wrap;gap:6px}
      .gp-result-filter-options button{min-height:34px;padding:6px 11px;border:1px solid #e0e7ef;border-radius:8px;background:#fff;color:#596a80;font:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:background .18s,border-color .18s,color .18s,box-shadow .18s}
      .gp-result-filter-options button:hover{border-color:#b9c9dc;background:#f2f6fb;color:#29496e}
      .gp-result-filter-options button[aria-pressed="true"]{border-color:#234b78;background:#234b78;color:#fff;box-shadow:0 3px 8px #234b7825}
      .gp-result-filter-options button[data-result-filter="winner"][aria-pressed="true"]{border-color:#31805d;background:#31805d}
      .gp-result-filter-options button[data-result-filter="runner-up"][aria-pressed="true"]{border-color:#b87927;background:#b87927}
      .urban-results-controls select,.urban-results-controls input{width:100%;min-width:0;border:1px solid #dbe3ed;border-radius:10px;padding:11px 12px;background:#fff;color:#25364c;font:inherit;font-size:13px;outline:none}
      .urban-results-controls select:focus,.urban-results-controls input:focus{border-color:#6d96c5;box-shadow:0 0 0 3px #4c83bd1a}
      .urban-results-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 20px;background:#f8fafd;border-bottom:1px solid #edf1f6}
      .urban-results-stat{padding:11px 13px;border:1px solid #e7edf4;border-radius:11px;background:#fff}
      .urban-results-stat-label{font-size:10px;letter-spacing:.45px;text-transform:uppercase;font-weight:800;color:#8290a4}
      .urban-results-stat-value{font-size:16px;font-weight:800;color:#263950;margin-top:5px}
      .urban-results-status{display:flex;align-items:center;gap:8px;min-height:43px;padding:10px 20px;color:#6e7d92;font-size:12px}
      .urban-results-status[data-state="error"]{color:#a93e32;background:#fff7f5}
      .urban-results-status[data-state="loading"]:before{content:"";width:13px;height:13px;border:2px solid #d8e2ef;border-top-color:#346391;border-radius:50%;animation:urban-spin .7s linear infinite}
      @keyframes urban-spin{to{transform:rotate(360deg)}}
      .urban-results-table-wrap{width:100%;overflow:auto}
      .urban-results-table{width:100%;border-collapse:collapse;min-width:760px;font-size:12px}
      .urban-results-table th{position:sticky;top:0;text-align:left;background:#f4f7fa;color:#718096;font-size:10px;letter-spacing:.45px;text-transform:uppercase;white-space:nowrap}
      .urban-results-table th,.urban-results-table td{padding:12px 13px;border-bottom:1px solid #edf1f5}
      .urban-results-table tbody tr:hover{background:#f9fbfd}
      .urban-results-table td{color:#35445a;line-height:1.45}
      .urban-results-table td:first-child{font-weight:700;color:#273a53}
      .urban-results-table td[data-field="votes"]{font-weight:750;font-variant-numeric:tabular-nums}
      .urban-result-badge{display:inline-block;border-radius:999px;padding:5px 8px;background:#e9f5ed;color:#2d774b;font-size:10px;font-weight:800;white-space:nowrap}
      .urban-result-badge.runner-up{background:#fff3df;color:#a86412}
      .urban-result-badge.candidate{background:#eaf1fb;color:#426a9e}
      .urban-results-empty{padding:32px 14px!important;text-align:center!important;color:#8190a4!important}
      .urban-results-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 18px;color:#75839a;font-size:11px}
      .urban-results-pagination{display:flex;gap:7px}
      .urban-results-pagination button,.urban-results-retry{border:1px solid #d7e0ea;background:#fff;border-radius:8px;padding:8px 12px;color:#30445d;font:inherit;font-weight:700;cursor:pointer}
      .urban-results-pagination button:hover,.urban-results-retry:hover{background:#f3f7fb}
      .urban-results-pagination button:disabled{opacity:.45;cursor:default}
      .urban-results-retry{margin:0 0 12px 20px}
      #urbanBlockFilter[hidden]{display:none}
      #urbanResultsPanel[data-body="gram-panchayat"] .urban-results-controls{grid-template-columns:repeat(4,minmax(0,1fr))}
      @media(max-width:700px){.urban-results-controls{grid-template-columns:1fr 1fr}.urban-results-controls label:last-child{grid-column:1/-1}}
      @media(max-width:600px){.local-results-wrap{padding:22px 12px}.local-results-top{padding:14px 12px}.local-results-hero{border-radius:16px}.urban-results-toolbar{padding:15px 13px}.urban-results-summary{padding:11px 12px;gap:7px}.urban-results-stat{padding:9px}.urban-results-stat-value{font-size:14px}.urban-results-status{padding-inline:13px}.urban-results-footer{padding-inline:12px}}
      @media(max-width:440px){.urban-results-controls{grid-template-columns:1fr!important}.urban-results-controls label:last-child{grid-column:auto}.urban-results-live{font-size:9px}.urban-results-stat-label{font-size:9px}.gp-result-filters{align-items:flex-start;flex-direction:column}.gp-result-filter-options{width:100%}.gp-result-filter-options button{flex:1}}
    </style>
    <header class="local-results-top">
      <div><strong>POLITO</strong><div style="font-size:11px;color:#bdc8d9;margin-top:4px">UTTAR PRADESH LOCAL ELECTIONS</div></div>
      <button class="local-results-back" id="localResultsBack" type="button">← Back to Elections</button>
    </header>
    <main class="local-results-wrap">
      <section class="local-results-hero">
        <div class="local-results-kicker" id="localResultsKicker">OFFICIAL LOCAL-BODY RESULTS</div>
        <h1 class="local-results-title" id="localResultsTitle">Municipal &amp; Panchayat Results</h1>
        <p class="local-results-sub" id="localResultsDescription">Explore official Uttar Pradesh local election results by local body and district.</p>
      </section>
      <div class="local-results-tabs" role="group" aria-label="Select local-body election">
        <button type="button" data-local-result-body="nagar-nigam" aria-pressed="false">Nagar Nigam · 2023</button>
        <button type="button" data-local-result-body="nagar-palika" aria-pressed="false">Nagar Palika · 2023</button>
        <button type="button" data-local-result-body="gram-panchayat" aria-pressed="false">Gram Panchayat · 2021</button>
      </div>
      <div class="local-results-notice" id="localResultsNotice" role="status" aria-live="polite"></div>
      <div class="local-results-meta"><span id="localResultsSourceLabel"></span><a class="local-results-source" id="localResultsSource" target="_blank" rel="noopener noreferrer">Open official result page ↗</a></div>
      <section class="urban-results-panel" id="urbanResultsPanel" hidden aria-label="Local-body election results">
        <div class="urban-results-toolbar">
          <div class="urban-results-toolbar-head">
            <div><h2 class="urban-results-heading" id="urbanResultsHeading"></h2><div class="urban-results-caption" id="urbanResultsCaption">Official declared winner records from the Uttar Pradesh State Election Commission</div></div>
            <span class="urban-results-live">OFFICIAL SEC DATA</span>
          </div>
          <div class="urban-results-controls">
            <label for="urbanPostSelect">Election post<select id="urbanPostSelect"></select></label>
            <label for="urbanDistrictSelect">District<select id="urbanDistrictSelect"><option value="">All districts</option></select></label>
            <label id="urbanBlockFilter" for="urbanBlockSelect" hidden>Block<select id="urbanBlockSelect"><option value="">All blocks</option></select></label>
            <label for="urbanSearch">Search results<input id="urbanSearch" type="search" placeholder="Candidate, local body, party…" autocomplete="off" /></label>
          </div>
          <div class="gp-result-filters" id="gpResultFilters" hidden role="group" aria-label="Filter Gram Panchayat candidates by result">
            <span class="gp-result-filter-label">Candidate result</span>
            <div class="gp-result-filter-options">
              <button type="button" data-result-filter="all" aria-pressed="true">All candidates</button>
              <button type="button" data-result-filter="winner" aria-pressed="false">Winner</button>
              <button type="button" data-result-filter="runner-up" aria-pressed="false">Runner-up</button>
              <button type="button" data-result-filter="candidate" aria-pressed="false">Other candidates</button>
            </div>
          </div>
        </div>
        <div class="urban-results-summary">
          <div class="urban-results-stat"><div class="urban-results-stat-label">Results on page</div><div class="urban-results-stat-value" id="urbanResultsStatCount">—</div></div>
          <div class="urban-results-stat"><div class="urban-results-stat-label">Coverage</div><div class="urban-results-stat-value" id="urbanResultsStatCoverage">All districts</div></div>
          <div class="urban-results-stat"><div class="urban-results-stat-label">Election year</div><div class="urban-results-stat-value" id="urbanResultsStatYear">2023</div></div>
        </div>
        <div class="urban-results-status" id="urbanResultsStatus" role="status" aria-live="polite"></div>
        <button class="urban-results-retry" id="urbanResultsRetry" type="button" hidden>Retry loading results</button>
        <div class="urban-results-table-wrap">
          <table class="urban-results-table">
            <thead id="urbanResultsHead"></thead>
            <tbody id="urbanResultsRows"></tbody>
          </table>
        </div>
        <div class="urban-results-footer"><span id="urbanResultsCount"></span><div class="urban-results-pagination"><button type="button" id="urbanResultsPrevious">Previous</button><button type="button" id="urbanResultsNext">Next</button></div></div>
      </section>
      <div class="local-results-unavailable" id="localResultsUnavailable" hidden></div>
    </main>`;
  document.body.appendChild(page);

  const configurations = {
    "nagar-nigam": {
      source: "https://sec.up.nic.in/site/NewWinnerList2023.aspx",
      label: "Uttar Pradesh State Election Commission · 2023 urban local-body winner list",
      heading: "Nagar Nigam · 2023",
      notice: "Browse official Nagar Nigam mayor and ward-member winners. Filter the results by district or search within the current results page.",
      posts: [{value: "7", label: "Mayor"}, {value: "8", label: "Ward member"}],
      defaultPost: "7"
    },
    "nagar-palika": {
      source: "https://sec.up.nic.in/site/NewWinnerList2023.aspx",
      label: "Uttar Pradesh State Election Commission · 2023 urban local-body winner list",
      heading: "Nagar Palika Parishad · 2023",
      notice: "Browse official Nagar Palika Parishad chairperson and ward-member winners. Filter the results by district or search within the current results page.",
      posts: [{value: "9", label: "Chairperson"}, {value: "10", label: "Ward member"}],
      defaultPost: "9"
    },
    "gram-panchayat": {
      source: "https://sec.up.nic.in/site/WinnerListPRI2021.aspx",
      sourceLabel: "Open official SEC results ↗",
      label: "Project-provided 2021 Gram Panchayat candidate dataset · 67 districts",
      heading: "Gram Panchayat Pradhan · 2021",
      notice: "Browse the supplied 2021 Gram Panchayat candidate records. Choose one of the 67 available districts and, optionally, a block.",
      posts: [{value: "5", label: "Gram Panchayat Pradhan"}],
      defaultPost: "5",
      year: "2021"
    }
  };

  const urbanPanel = page.querySelector("#urbanResultsPanel");
  const unavailable = page.querySelector("#localResultsUnavailable");
  const sourceLink = page.querySelector("#localResultsSource");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  let urbanBody = "";
  let urbanPage = 0;
  let urbanRequestId = 0;
  let urbanRecords = [];
  let urbanTotalResults = 0;
  let urbanHasNext = false;
  let urbanHasPrevious = false;
  let urbanEmptyMessage = "";
  let gramResultFilter = "all";
  let urbanSearchTimer;
  const urbanPostSelect = page.querySelector("#urbanPostSelect");
  const urbanDistrictSelect = page.querySelector("#urbanDistrictSelect");
  const urbanBlockFilter = page.querySelector("#urbanBlockFilter");
  const urbanBlockSelect = page.querySelector("#urbanBlockSelect");
  const urbanSearch = page.querySelector("#urbanSearch");
  const urbanStatus = page.querySelector("#urbanResultsStatus");
  const urbanRetry = page.querySelector("#urbanResultsRetry");
  const urbanResultsHead = page.querySelector("#urbanResultsHead");
  const urbanResultsRows = page.querySelector("#urbanResultsRows");
  const urbanResultsCount = page.querySelector("#urbanResultsCount");
  const urbanResultsCaption = page.querySelector("#urbanResultsCaption");
  const setOptions = (select, options, placeholder) => {
    select.replaceChildren(new Option(placeholder, ""));
    options.forEach(option => select.add(new Option(option.label, option.value)));
  };
  const urbanColumnLabels = {
    district: "District",
    body: "Local body",
    block: "Block",
    panchayat: "Gram Panchayat",
    ward: "Ward",
    reservation: "Reservation",
    candidate: "Winner",
    party: "Party",
    votes: "Votes",
    voteShare: "Vote share",
    turnout: "Turnout",
    result: "Result"
  };
  const renderUrbanResults = () => {
    const query = urbanSearch.value.trim().toLocaleLowerCase();
    const filtered = urbanRecords.filter(record =>
      !query || Object.values(record).join(" ").toLocaleLowerCase().includes(query)
    );
    const columns = urbanBody === "gram-panchayat"
      ? ["district", "block", "panchayat", "candidate", "votes", "result"]
      : urbanRecords.some(record => record.ward)
        ? ["district", "body", "ward", "reservation", "candidate", "party", "votes", "voteShare", "turnout", "result"]
        : ["district", "body", "reservation", "candidate", "party", "votes", "voteShare", "turnout", "result"];
    urbanResultsHead.innerHTML = `<tr>${columns.map(key => `<th>${key === "candidate" && urbanBody === "gram-panchayat" ? "Candidate" : urbanColumnLabels[key]}</th>`).join("")}</tr>`;
    urbanResultsRows.innerHTML = filtered.length
      ? filtered.map(record => `<tr>${columns.map(key => {
        const value = record[key] || "—";
        if (key === "result") {
          const resultClass = {"winner":"winner","runner-up":"runner-up","candidate":"candidate"}[String(value).trim().toLocaleLowerCase()] || "";
          return `<td><span class="urban-result-badge ${resultClass}">${esc(value)}</span></td>`;
        }
        if (key === "votes") return `<td data-field="votes">${esc(value)}</td>`;
        if (key === "voteShare" || key === "turnout") return `<td>${value === "—" || value === "-" ? "—" : `${esc(value)}%`}</td>`;
        return `<td>${esc(value)}</td>`;
      }).join("")}</tr>`).join("")
      : `<tr><td class="urban-results-empty" colspan="${columns.length}">${urbanRecords.length ? "No results match your search on this page." : esc(urbanEmptyMessage || "Results will appear here when available.")}</td></tr>`;
    page.querySelector("#urbanResultsStatCount").textContent = filtered.length.toLocaleString("en-IN");
    const selectedBlock = urbanBody === "gram-panchayat" ? urbanBlockSelect.selectedOptions[0]?.textContent : "";
    page.querySelector("#urbanResultsStatCoverage").textContent = selectedBlock ||
      urbanDistrictSelect.selectedOptions[0]?.textContent || "All districts";
    urbanResultsCount.textContent = urbanBody === "gram-panchayat"
      ? urbanRecords.length
        ? `Showing ${filtered.length.toLocaleString("en-IN")} of ${(urbanTotalResults || 0).toLocaleString("en-IN")} matching records · page ${urbanPage + 1}`
        : "No matching candidate records"
      : urbanRecords.length
        ? `Showing ${filtered.length.toLocaleString("en-IN")} matching results on page ${urbanPage + 1}`
        : "No winner records on this page";
    page.querySelector("#urbanResultsPrevious").disabled = !urbanHasPrevious;
    page.querySelector("#urbanResultsNext").disabled = !urbanHasNext;
  };
  const loadUrbanResults = async () => {
    const requestId = ++urbanRequestId;
    const config = configurations[urbanBody];
    const post = urbanPostSelect.value || config.defaultPost;
    const district = urbanDistrictSelect.value;
    const block = urbanBlockSelect.value;
    urbanStatus.dataset.state = "loading";
    urbanStatus.textContent = urbanBody === "gram-panchayat"
      ? "Loading the Gram Panchayat candidate dataset…"
      : "Connecting to the Uttar Pradesh State Election Commission…";
    urbanRetry.hidden = true;
    urbanRecords = [];
    urbanTotalResults = 0;
    urbanResultsRows.innerHTML = "";
    page.querySelector("#urbanResultsStatCount").textContent = "…";
    page.querySelector("#urbanResultsStatCoverage").textContent = urbanDistrictSelect.selectedOptions[0]?.textContent ||
      (urbanBody === "gram-panchayat" ? "Choose a district" : "All districts");
    try {
      const params = new URLSearchParams({body: urbanBody, post, page: String(urbanPage)});
      if (district) params.set("district", district);
      if (block) params.set("block", block);
      if (urbanBody === "gram-panchayat" && urbanSearch.value.trim()) {
        params.set("q", urbanSearch.value.trim());
      }
      if (urbanBody === "gram-panchayat" && gramResultFilter !== "all") {
        params.set("result", gramResultFilter);
      }
      const response = await fetch(`/sec/api/urban-results?${params}`);
      if (!response.headers.get("content-type")?.toLocaleLowerCase().includes("application/json")) {
        throw new Error("The results API returned a web page instead of JSON. Open POLITO through its Node server at http://localhost:4173 (run npm start); a static preview cannot load local or SEC results.");
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Results request failed (${response.status})`);
      if (requestId !== urbanRequestId) return;
      const selectedDistrict = urbanDistrictSelect.value;
      const districtPlaceholder = urbanBody === "gram-panchayat" ? "Choose a district" : "All districts";
      setOptions(urbanDistrictSelect, data.districts.filter(option =>
        option.value && option.value !== "0" && option.value !== "-1"
      ), districtPlaceholder);
      urbanDistrictSelect.value = data.districts.some(option => option.value === selectedDistrict)
        ? selectedDistrict
        : "";
      if (urbanBody === "gram-panchayat") {
        const selectedBlock = urbanBlockSelect.value;
        setOptions(urbanBlockSelect, (data.blocks || []).filter(option => option.value && option.value !== "-1"), "All blocks");
        urbanBlockSelect.value = data.blocks?.some(option => option.value === selectedBlock) ? selectedBlock : "";
      }
      urbanRecords = Array.isArray(data.results) ? data.results : [];
      urbanTotalResults = Number(data.totalResults) || 0;
      urbanEmptyMessage = data.message || "";
      if (urbanBody === "gram-panchayat" && urbanSearch.value.trim() && !urbanTotalResults) {
        urbanEmptyMessage = "No candidate or Panchayat records match this search.";
      }
      urbanHasPrevious = Boolean(data.hasPrevious);
      urbanHasNext = Boolean(data.hasNext);
      urbanStatus.dataset.state = "loaded";
      const selectionLabel = [data.post, data.district, data.block].filter(Boolean).join(" · ") ||
        (urbanBody === "gram-panchayat" ? `${data.post} · Choose a district` : `${data.post} · Statewide`);
      const recordDescription = urbanBody === "gram-panchayat" ? "candidate records" : "official winner records";
      urbanStatus.textContent = urbanBody === "gram-panchayat" && urbanSearch.value.trim()
        ? `${urbanTotalResults.toLocaleString("en-IN")} matching ${recordDescription}${district ? ` in ${data.district}` : " across all districts"}`
        : data.message ||
          `${selectionLabel} · ${urbanRecords.length.toLocaleString("en-IN")} ${recordDescription} on this page`;
      page.querySelector("#urbanResultsPrevious").disabled = !data.hasPrevious;
      page.querySelector("#urbanResultsNext").disabled = !data.hasNext;
      renderUrbanResults();
    } catch (error) {
      if (requestId !== urbanRequestId) return;
      console.error("Local-election results could not load:", error);
      urbanRecords = [];
      urbanEmptyMessage = urbanBody === "gram-panchayat"
        ? "No candidate records are available for this selection."
        : "The SEC did not return results. Retry or open the official SEC page.";
      urbanHasNext = false;
      urbanHasPrevious = false;
      urbanStatus.dataset.state = "error";
      urbanStatus.textContent = error.message;
      const columnCount = urbanBody === "gram-panchayat" ? 6 : 10;
      urbanResultsRows.innerHTML = `<tr><td class="urban-results-empty" colspan="${columnCount}">${urbanBody === "gram-panchayat" ? "The Gram Panchayat dataset could not be loaded. Retry loading the data." : "The SEC did not return results. Retry, or open the official result page."}</td></tr>`;
      page.querySelector("#urbanResultsStatCount").textContent = "Unavailable";
      urbanResultsCount.textContent = "Results could not load";
      page.querySelector("#urbanResultsPrevious").disabled = true;
      page.querySelector("#urbanResultsNext").disabled = true;
      urbanRetry.hidden = false;
    }
  };
  urbanPostSelect.addEventListener("change", () => { urbanPage = 0; loadUrbanResults(); });
  urbanDistrictSelect.addEventListener("change", () => {
    urbanPage = 0;
    setOptions(urbanBlockSelect, [], "All blocks");
    loadUrbanResults();
  });
  urbanBlockSelect.addEventListener("change", () => { urbanPage = 0; loadUrbanResults(); });
  urbanSearch.addEventListener("input", () => {
    if (urbanBody !== "gram-panchayat") {
      renderUrbanResults();
      return;
    }
    window.clearTimeout(urbanSearchTimer);
    urbanPage = 0;
    urbanSearchTimer = window.setTimeout(loadUrbanResults, 300);
  });
  page.querySelectorAll("[data-result-filter]").forEach(button => {
    button.addEventListener("click", () => {
      gramResultFilter = button.dataset.resultFilter;
      page.querySelectorAll("[data-result-filter]").forEach(filterButton => {
        filterButton.setAttribute("aria-pressed", filterButton === button ? "true" : "false");
      });
      urbanPage = 0;
      loadUrbanResults();
    });
  });
  urbanRetry.addEventListener("click", loadUrbanResults);
  page.querySelector("#urbanResultsPrevious").addEventListener("click", () => {
    if (!urbanHasPrevious) return;
    urbanPage = Math.max(0, urbanPage - 1);
    loadUrbanResults();
  });
  page.querySelector("#urbanResultsNext").addEventListener("click", () => {
    if (!urbanHasNext) return;
    urbanPage += 1;
    loadUrbanResults();
  });
  const setBody = bodyType => {
    const config = configurations[bodyType] || configurations["nagar-nigam"];
    urbanRequestId += 1;
    urbanBody = bodyType;
    page.querySelectorAll("[data-local-result-body]").forEach(button => {
      button.setAttribute("aria-pressed", button.dataset.localResultBody === bodyType ? "true" : "false");
    });
    page.querySelector("#localResultsNotice").textContent = config.notice;
    page.querySelector("#localResultsSourceLabel").textContent = config.label;
    sourceLink.href = config.source;
    sourceLink.textContent = config.sourceLabel || "Open official result page ↗";
    const isGramPanchayat = bodyType === "gram-panchayat";
    gramResultFilter = "all";
    page.querySelectorAll("[data-result-filter]").forEach(button => {
      button.setAttribute("aria-pressed", button.dataset.resultFilter === "all" ? "true" : "false");
    });
    page.querySelector("#gpResultFilters").hidden = !isGramPanchayat;
    urbanSearch.placeholder = isGramPanchayat
      ? "Candidate, Panchayat, block, district…"
      : "Candidate, local body, party…";
    urbanPanel.hidden = false;
    urbanBlockFilter.hidden = !isGramPanchayat;
    urbanPanel.dataset.body = bodyType;
    page.querySelector("#localResultsKicker").textContent = isGramPanchayat
      ? "GRAM PANCHAYAT CANDIDATE DATA"
      : "OFFICIAL LOCAL-BODY RESULTS";
    page.querySelector("#localResultsTitle").textContent = isGramPanchayat
      ? "Uttar Pradesh Gram Panchayat Results"
      : "Uttar Pradesh Urban Local-Body Results";
    page.querySelector("#localResultsDescription").textContent = isGramPanchayat
      ? "Explore the supplied 2021 Gram Panchayat candidate records for 67 districts. Search candidates or Panchayats across the dataset, or choose a district and optionally a block."
      : "Explore 2023 Nagar Nigam and Nagar Palika Parishad winner results from the Uttar Pradesh State Election Commission.";
    page.querySelector("#urbanResultsHeading").textContent = config.heading;
    urbanResultsCaption.textContent = isGramPanchayat
      ? "Candidate records from the project-provided 2021 dataset"
      : "Official declared winner records from the Uttar Pradesh State Election Commission";
    page.querySelector("#urbanResultsStatYear").textContent = config.year || "2023";
    if (window.location.protocol === "file:") {
      unavailable.hidden = false;
      unavailable.textContent = "Official results need the POLITO server proxy. Run the app with npm start, or open the SEC source link above.";
      urbanPanel.hidden = true;
      return;
    }
    unavailable.hidden = true;
    setOptions(urbanPostSelect, config.posts, "Select a post");
    urbanPostSelect.value = config.defaultPost;
    setOptions(urbanDistrictSelect, [], isGramPanchayat ? "Choose a district" : "All districts");
    setOptions(urbanBlockSelect, [], "All blocks");
    urbanSearch.value = "";
    urbanPage = 0;
    urbanRecords = [];
    urbanEmptyMessage = "";
    urbanHasNext = false;
    urbanHasPrevious = false;
    urbanStatus.dataset.state = "loading";
    urbanStatus.textContent = "Preparing official results…";
    urbanResultsRows.innerHTML = "";
    urbanResultsHead.innerHTML = "";
    urbanResultsCount.textContent = "";
    page.querySelector("#urbanResultsPrevious").disabled = true;
    page.querySelector("#urbanResultsNext").disabled = true;
    loadUrbanResults();
  };

  page.querySelectorAll("[data-local-result-body]").forEach(button => {
    button.addEventListener("click", () => setBody(button.dataset.localResultBody));
  });
  page.querySelector("#localResultsBack").addEventListener("click", () => page.remove());
  setBody(configurations[initialBody] ? initialBody : "nagar-nigam");
}

function openPreview(title) {
  if (title === "2024 Lok Sabha Results") {
    open2024ElectionPage();
    return;
  }
  if (title === "2019 Parliamentary Results" || title === "Uttar Pradesh Parliamentary Results") {
    open2019ParliamentaryResultsPage();
    return;
  }
  if (title === "Uttar Pradesh Assembly Results") {
    open2022ElectionPage();
    return;
  }
  if (title === "Local Election Results") {
    openLocalElectionResultsPage();
    return;
  }
  if (dialogTitle) dialogTitle.textContent = title;
  if (dialogText) dialogText.textContent = `${title} is part of the POLITO frontend concept. This section will be connected to verified data and working features in the next development stage.`;
  if (dialog && typeof dialog.showModal === "function") dialog.showModal();
  else showToast(`${title} — frontend preview`);
}


$$("[data-modal]").forEach(button => button.addEventListener("click", () => openPreview(button.dataset.modal)));
$$("[data-local-body]").forEach(button => button.addEventListener("click", () => openLocalElectionResultsPage(button.dataset.localBody)));

$("#dialogClose")?.addEventListener("click", () => dialog?.close());
$("#dialogOk")?.addEventListener("click", () => dialog?.close());
$("#menuToggle")?.addEventListener("click", () => $("#mainNav")?.classList.toggle("open"));

$$(".main-nav a").forEach(link => link.addEventListener("click", () => $("#mainNav")?.classList.remove("open")));

$("#focusSearch")?.addEventListener("click", () => {
  $("#globalSearch")?.focus();
  $("#globalSearch")?.scrollIntoView({behavior:"smooth",block:"center"});
});

