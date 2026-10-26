const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const secSessions = new Map();
let gramPanchayatSearchRecordsPromise;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".gz": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function parseTagAttributes(tag) {
  const attributes = {};
  const pattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = pattern.exec(tag))) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] || match[3] || match[4] || "");
  }
  return attributes;
}

function parseHiddenFields(html) {
  const fields = {};
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = parseTagAttributes(match[0]);
    if (attributes.type === "hidden" && attributes.name) {
      fields[attributes.name] = attributes.value || "";
    }
  }
  return fields;
}

function parseSelectOptions(html, selectName) {
  const select = [...html.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)]
    .find(match => parseTagAttributes(match[0].match(/^<select\b[^>]*>/i)[0]).name === selectName);
  if (!select) throw new Error(`SEC page is missing the ${selectName} selector`);
  return [...select[0].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map(match => {
    const attributes = parseTagAttributes(`<option ${match[1]}>`);
    return {
      value: attributes.value || "",
      label: decodeHtml(match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim())
    };
  });
}

function stripHtmlText(value) {
  return decodeHtml(value
    .replace(/<br\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function findTableById(html, tableId) {
  const tags = /<\/?table\b[^>]*>/gi;
  let opening;
  while ((opening = tags.exec(html))) {
    if (/^<\//.test(opening[0]) || parseTagAttributes(opening[0]).id !== tableId) continue;
    const start = opening.index;
    const openingEnd = tags.lastIndex;
    let depth = 1;
    let next;
    while ((next = tags.exec(html))) {
      depth += /^<\//.test(next[0]) ? -1 : 1;
      if (depth === 0) {
        return { start, openingEnd, closingStart: next.index, end: tags.lastIndex };
      }
    }
  }
  return null;
}

function findDirectTableRows(tableContent) {
  const tags = /<\/?(table|tr)\b[^>]*>/gi;
  const rows = [];
  let nestedTables = 0;
  let rowStart = -1;
  let match;
  while ((match = tags.exec(tableContent))) {
    const closing = /^<\//.test(match[0]);
    if (match[1].toLowerCase() === "table") {
      nestedTables += closing ? -1 : 1;
    } else if (!closing && nestedTables === 0) {
      rowStart = match.index;
    } else if (closing && nestedTables === 0 && rowStart >= 0) {
      rows.push({ start: rowStart, end: tags.lastIndex });
      rowStart = -1;
    }
  }
  return rows;
}

function findDirectCells(row) {
  const tags = /<\/?(table|td|th)\b[^>]*>/gi;
  const cells = [];
  let nestedTables = 0;
  let cellStart = -1;
  let match;
  while ((match = tags.exec(row))) {
    const closing = /^<\//.test(match[0]);
    const tagName = match[1].toLowerCase();
    if (tagName === "table") {
      nestedTables += closing ? -1 : 1;
    } else if (nestedTables === 0 && !closing) {
      cellStart = match.index;
    } else if (nestedTables === 0 && closing && cellStart >= 0) {
      cells.push({ start: cellStart, end: tags.lastIndex });
      cellStart = -1;
    }
  }
  return cells;
}

function removePersonalResultColumns(html, tableId, expectedColumns, hiddenColumns) {
  const table = findTableById(html, tableId);
  if (!table) return html;

  const content = html.slice(table.openingEnd, table.closingStart);
  const rows = findDirectTableRows(content);
  const header = rows.map(row => content.slice(row.start, row.end))
    .find(row => /<th\b/i.test(row));
  const headerCells = header && findDirectCells(header);
  const schemas = typeof expectedColumns === "number"
    ? { [expectedColumns]: hiddenColumns }
    : expectedColumns;
  if (!headerCells) {
    if (rows.every(row => findDirectCells(content.slice(row.start, row.end)).length <= 1)) return html;
    throw new Error(`Unexpected ${tableId} result-table structure; refusing to display unfiltered personal fields`);
  }
  const columnCount = headerCells.length;
  const columnsToHide = schemas[columnCount];
  if (!columnsToHide) {
    throw new Error(`Unexpected ${tableId} result-table structure; refusing to display unfiltered personal fields`);
  }

  let cleanContent = content;
  for (const row of rows.reverse()) {
    const rowHtml = content.slice(row.start, row.end);
    const cells = findDirectCells(rowHtml);
    if (cells.length !== columnCount) continue;
    let result = "";
    let cursor = 0;
    cells.forEach((cell, index) => {
      result += rowHtml.slice(cursor, cell.start);
      if (!columnsToHide.includes(index + 1)) result += rowHtml.slice(cell.start, cell.end);
      cursor = cell.end;
    });
    result += rowHtml.slice(cursor);
    cleanContent = cleanContent.slice(0, row.start) + result + cleanContent.slice(row.end);
  }
  return html.slice(0, table.openingEnd) + cleanContent + html.slice(table.closingStart);
}

function sanitizeSecResults(html) {
  let sanitized = html;
  if (sanitized.includes('id="ctl00_ContentPlaceHolder1_winnerdetail"')) {
    sanitized = removePersonalResultColumns(
      sanitized,
      "ctl00_ContentPlaceHolder1_winnerdetail",
      {
        15: [5, 6, 7, 9, 10, 11],
        16: [6, 7, 8, 10, 11, 12]
      }
    );
  }
  if (sanitized.includes('id="ctl00_ContentPlaceHolder1_GridView1"')) {
    sanitized = removePersonalResultColumns(
      sanitized,
      "ctl00_ContentPlaceHolder1_GridView1",
      15,
      [5, 6, 7, 8, 9, 10, 11]
    );
  }
  return sanitized;
}

function parseUrbanResults(html) {
  const table = findTableById(html, "ctl00_ContentPlaceHolder1_winnerdetail");
  if (!table) throw new Error("The SEC response did not contain the expected results table");

  const content = html.slice(table.openingEnd, table.closingStart);
  const rows = findDirectTableRows(content).map(row => {
    const rowHtml = content.slice(row.start, row.end);
    return findDirectCells(rowHtml).map(cell => stripHtmlText(rowHtml.slice(cell.start, cell.end)));
  }).filter(cells => cells.length > 1);
  const headerIndex = rows.findIndex(cells => cells.includes("जनपद"));
  if (headerIndex < 0) throw new Error("The SEC results table did not include its expected column headings");

  const header = rows[headerIndex];
  const columns = header.length === 15
    ? { district: 0, body: 1, reservation: 2, candidate: 3, party: 7, votes: 11, voteShare: 12, turnout: 13, result: 14 }
    : header.length === 16
      ? { district: 0, body: 1, ward: 2, reservation: 3, candidate: 4, party: 8, votes: 12, voteShare: 13, turnout: 14, result: 15 }
      : null;
  if (!columns) throw new Error(`The SEC results table has an unsupported ${header.length}-column format`);

  const results = rows.slice(headerIndex + 1)
    .filter(cells => cells.length === header.length)
    .map(cells => Object.fromEntries(Object.entries(columns).map(([key, index]) => [key, cells[index]])));
  const decodedHtml = decodeHtml(html);
  const hasNext = /Page\$Next/i.test(decodedHtml);
  const hasPrevious = /Page\$Prev(?:ious)?/i.test(decodedHtml);
  return { results, hasNext, hasPrevious };
}

function parsePanchayatResults(html) {
  const table = findTableById(html, "ctl00_ContentPlaceHolder1_GridView1");
  if (!table) throw new Error("The SEC response did not contain the Gram Panchayat results table");

  const content = html.slice(table.openingEnd, table.closingStart);
  const rows = findDirectTableRows(content).map(row => {
    const rowHtml = content.slice(row.start, row.end);
    return {
      hasHeader: /<th\b/i.test(rowHtml),
      cells: findDirectCells(rowHtml).map(cell => stripHtmlText(rowHtml.slice(cell.start, cell.end)))
    };
  }).filter(row => row.cells.length);
  if (rows.some(row => /कोई डेटा उपलब्ध नहीं|no data available/i.test(row.cells.join(" ")))) {
    return { results: [], hasNext: false, hasPrevious: false };
  }

  const header = rows.find(row => row.hasHeader);
  if (!header) return { results: [], hasNext: false, hasPrevious: false };

  const normalizeHeader = value => value.toLocaleLowerCase().replace(/[\s._%()-]+/g, "");
  const headerIndexes = header.cells.map(normalizeHeader);
  const findColumn = patterns => headerIndexes.findIndex(value => patterns.some(pattern => pattern.test(value)));
  const columns = {
    district: findColumn([/^(district|जनपद|जिलाका?नाम)$/]),
    block: findColumn([/^(block|विकासखंड|विकासखण्ड|खंड)$/]),
    panchayat: findColumn([/^(grampanchayat|पंचायतनाम|ग्रामपंचायत|ग्रामपंचायतनाम)$/]),
    candidate: findColumn([/^(candidate|उम्मीदवार|प्रत्याशी|प्रत्याशीकानाम)$/]),
    votes: findColumn([/^(votes|मत|प्राप्तवैधमत|मतप्राप्त)$/]),
    result: findColumn([/^(result|परिणाम|स्थिति)$/])
  };
  if (columns.district < 0 || columns.block < 0 || columns.panchayat < 0 ||
      columns.candidate < 0 || columns.result < 0) {
    if (header.cells.length !== 15) {
      throw new Error("The SEC Gram Panchayat table has an unsupported column format");
    }
    Object.assign(columns, { district: 0, block: 1, panchayat: 2, candidate: 3, votes: 11, result: 14 });
  }

  const results = rows.slice(rows.indexOf(header) + 1)
    .filter(row => !row.hasHeader && row.cells.length === header.cells.length)
    .map(({cells}) => ({
      district: cells[columns.district],
      block: cells[columns.block],
      panchayat: cells[columns.panchayat],
      candidate: cells[columns.candidate],
      votes: columns.votes >= 0 ? cells[columns.votes] : "",
      result: cells[columns.result]
    }));
  const decodedHtml = decodeHtml(html);
  return {
    results,
    hasNext: /Page\$Next/i.test(decodedHtml),
    hasPrevious: /Page\$Prev(?:ious)?/i.test(decodedHtml)
  };
}

function loadGramPanchayatSearchRecords(index) {
  if (!gramPanchayatSearchRecordsPromise) {
    gramPanchayatSearchRecordsPromise = Promise.all(index.recordsByDistrict.map(async district => {
      const filePath = path.join(root, "data", "up-gram-panchayat-2021", district.file);
      const compressed = await fs.promises.readFile(filePath);
      const records = JSON.parse(zlib.gunzipSync(compressed).toString("utf8"));
      return records.map(record => ({
        district: district.name,
        districtSlug: district.slug,
        block: record.block || "",
        panchayat: record.panchayat || "",
        candidate: record.candidate || "",
        result: record.result || "",
        searchText: [district.name, record.block, record.panchayat, record.candidate, record.result]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
      }));
    })).then(districtRecords => districtRecords.flat()).catch(error => {
      gramPanchayatSearchRecordsPromise = undefined;
      throw error;
    });
  }
  return gramPanchayatSearchRecordsPromise;
}

function requestSec(pathname, method, headers, body = "") {
  return new Promise((resolve, reject) => {
    const upstream = http.request({
      hostname: "sec.up.nic.in",
      port: 80,
      path: pathname,
      method,
      headers: {
        "Accept-Encoding": "identity",
        "User-Agent": headers["user-agent"] || "Mozilla/5.0 POLITO local results viewer",
        ...(headers.cookie ? { Cookie: headers.cookie } : {}),
        ...(headers["content-type"] ? { "Content-Type": headers["content-type"] } : {}),
        ...(headers.referer ? { Referer: headers.referer } : {}),
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {})
      }
    }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve({
        statusCode: response.statusCode || 502,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
    });
    upstream.setTimeout(25000, () => upstream.destroy(new Error("SEC request timed out")));
    upstream.on("error", reject);
    if (body) upstream.write(body);
    upstream.end();
  });
}

function updateSecCookies(session, headers) {
  const cookies = new Map(
    session.cookie.split("; ").filter(Boolean).map(cookie => {
      const separator = cookie.indexOf("=");
      return [cookie.slice(0, separator), cookie.slice(separator + 1)];
    })
  );
  for (const item of headers["set-cookie"] || []) {
    const pair = item.split(";")[0];
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    if (/max-age=0/i.test(item)) cookies.delete(name);
    else cookies.set(name, pair.slice(separator + 1));
  }
  session.cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  session.lastUsed = Date.now();
}

function ensureSecSuccess(response, action) {
  if (response.statusCode === 200) return;
  if (response.statusCode >= 300 && response.statusCode < 400 && /error\.html/i.test(response.headers.location || "")) {
    throw new Error(`The SEC website redirected to its maintenance page while ${action}. Please retry in a little while.`);
  }
  throw new Error(`The SEC request failed while ${action} (HTTP ${response.statusCode})`);
}

function getSecSession(req, res) {
  const match = (req.headers.cookie || "").match(/(?:^|;\s*)politisoSecSession=([a-f0-9]+)/);
  let id = match && match[1];
  let session = id && secSessions.get(id);
  if (!session) {
    id = crypto.randomBytes(16).toString("hex");
    session = { cookie: "", lastUsed: Date.now() };
    secSessions.set(id, session);
    res.setHeader("Set-Cookie", `politisoSecSession=${id}; HttpOnly; SameSite=Lax; Path=/sec; Max-Age=3600`);
  }
  session.lastUsed = Date.now();
  for (const [sessionId, state] of secSessions) {
    if (Date.now() - state.lastUsed > 3600000) secSessions.delete(sessionId);
  }
  if (secSessions.size > 100) {
    const oldest = [...secSessions].sort((left, right) => left[1].lastUsed - right[1].lastUsed)[0];
    if (oldest) secSessions.delete(oldest[0]);
  }
  return session;
}

function postSecSelection(html, pathname, session, headers, selector) {
  const fields = parseHiddenFields(html);
  if (!fields.__VIEWSTATE) throw new Error("The SEC results page is missing its form state; please retry");
  fields.__EVENTTARGET = selector.control;
  fields.__EVENTARGUMENT = selector.argument || "";
  if (Object.prototype.hasOwnProperty.call(selector, "value")) {
    fields[selector.control] = selector.value;
  }
  const body = new URLSearchParams(fields).toString();
  return requestSec(pathname, "POST", {
    ...headers,
    cookie: session.cookie,
    "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    referer: `http://sec.up.nic.in${pathname}`
  }, body);
}

async function getUrbanResults(req, res, url) {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json; charset=utf-8", Allow: "GET" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const selections = {
    "nagar-nigam": { post: "7", posts: ["7", "8"], page: "/site/NewWinnerList2023.aspx" },
    "nagar-palika": { post: "9", posts: ["9", "10"], page: "/site/NewWinnerList2023.aspx" }
  };
  const bodyType = url.searchParams.get("body");
  const selection = selections[bodyType];
  const postValue = url.searchParams.get("post") || (selection && selection.post);
  const districtValue = url.searchParams.get("district") || "";
  const pageNumber = Number(url.searchParams.get("page") || 0);
  if (!selection || !selection.posts.includes(postValue) || !Number.isInteger(pageNumber) || pageNumber < 0 || pageNumber > 50) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ error: "Choose a supported local-body type and valid results page." }));
    return;
  }

  const session = getSecSession(req, res);
  const headers = { "user-agent": req.headers["user-agent"], cookie: session.cookie };
  try {
    let upstream = await requestSec(selection.page, "GET", headers);
    updateSecCookies(session, upstream.headers);
    ensureSecSuccess(upstream, "opening the results");

    upstream = await postSecSelection(upstream.body.toString("utf8"), selection.page, session, headers, {
      control: "ctl00$ContentPlaceHolder1$DropDownList1",
      value: postValue
    });
    updateSecCookies(session, upstream.headers);
    ensureSecSuccess(upstream, "selecting the election post");
    let html = upstream.body.toString("utf8");
    const districtOptions = parseSelectOptions(html, "ctl00$ContentPlaceHolder1$ddlDistrict");

    if (districtValue) {
      if (!districtOptions.some(option => option.value === districtValue)) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ error: "Choose a district from the available list." }));
        return;
      }
      upstream = await postSecSelection(html, selection.page, session, headers, {
        control: "ctl00$ContentPlaceHolder1$ddlDistrict",
        value: districtValue
      });
      updateSecCookies(session, upstream.headers);
      ensureSecSuccess(upstream, "selecting the district");
      html = upstream.body.toString("utf8");
    }

    let parsed = parseUrbanResults(html);
    for (let currentPage = 0; currentPage < pageNumber; currentPage += 1) {
      if (!parsed.hasNext) break;
      upstream = await postSecSelection(html, selection.page, session, headers, {
        control: "ctl00$ContentPlaceHolder1$winnerdetail",
        argument: "Page$Next"
      });
      updateSecCookies(session, upstream.headers);
      ensureSecSuccess(upstream, "loading another results page");
      html = upstream.body.toString("utf8");
      parsed = parseUrbanResults(html);
    }

    const postOptions = parseSelectOptions(html, "ctl00$ContentPlaceHolder1$DropDownList1");
    const activePost = postOptions.find(option => option.value === postValue);
    const district = districtOptions.find(option => option.value === districtValue);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({
      body: bodyType,
      post: activePost ? activePost.label : "",
      district: district ? district.label : "",
      districts: districtOptions,
      results: parsed.results,
      page: pageNumber,
      hasPrevious: parsed.hasPrevious && pageNumber > 0,
      hasNext: parsed.hasNext
    }));
  } catch (error) {
    console.error("Official urban local-election results could not load:", error.message);
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ error: `The UP State Election Commission results could not load: ${error.message}` }));
  }
}

async function getGramPanchayatResults(req, res, url) {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json; charset=utf-8", Allow: "GET" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const districtValue = url.searchParams.get("district") || "";
  const blockValue = url.searchParams.get("block") || "";
  const searchQuery = (url.searchParams.get("q") || "").trim().toLocaleLowerCase();
  const requestedResult = url.searchParams.get("result") || "";
  const resultFilter = requestedResult === "all" ? "" : requestedResult;
  const pageNumber = Number(url.searchParams.get("page") || 0);
  if (!Number.isInteger(pageNumber) || pageNumber < 0 || pageNumber > 5000 ||
      searchQuery.length > 100 || (blockValue && !districtValue) ||
      !["", "winner", "runner-up", "candidate"].includes(resultFilter)) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ error: "Choose valid district, block, and results-page filters." }));
    return;
  }

  try {
    const indexPath = path.join(root, "data", "up-gram-panchayat-2021", "index.json");
    const index = JSON.parse(await fs.promises.readFile(indexPath, "utf8"));
    const districts = index.recordsByDistrict.map(({name, slug}) => ({value: slug, label: name}));
    const district = index.recordsByDistrict.find(entry => entry.slug === districtValue);
    if (districtValue && !district) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ error: "Choose a district from the available dataset." }));
      return;
    }

    let records = [];
    let blocks = [];
    if (searchQuery || resultFilter) {
      records = await loadGramPanchayatSearchRecords(index);
      if (district) {
        blocks = [...new Set(records
          .filter(record => record.districtSlug === district.slug)
          .map(record => record.block)
          .filter(Boolean))]
          .sort((left, right) => left.localeCompare(right));
        if (blockValue && !blocks.includes(blockValue)) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
          res.end(JSON.stringify({ error: "Choose a block from the selected district's available list." }));
          return;
        }
      }
    } else if (district) {
      const compressed = await fs.promises.readFile(path.join(path.dirname(indexPath), district.file));
      const districtRecords = JSON.parse(zlib.gunzipSync(compressed).toString("utf8"));
      blocks = [...new Set(districtRecords.map(record => record.block).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right));
      if (blockValue && !blocks.includes(blockValue)) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ error: "Choose a block from the selected district's available list." }));
        return;
      }
      records = districtRecords.map(record => ({
        district: district.name,
        block: record.block || "",
        panchayat: record.panchayat || "",
        candidate: record.candidate || "",
        result: record.result || ""
      }));
    }

    if (searchQuery || district || resultFilter) {
      records = records.filter(record =>
        (!district || record.districtSlug === district.slug || record.district === district.name) &&
        (!blockValue || record.block === blockValue) &&
        (!resultFilter || String(record.result || "").trim().toLocaleLowerCase() === resultFilter) &&
        (!searchQuery || (record.searchText || [
          record.district, record.block, record.panchayat, record.candidate, record.result
        ].filter(Boolean).join(" ").toLocaleLowerCase()).includes(searchQuery))
      );
    }

    const totalResults = records.length;
    const pageSize = 100;
    const start = pageNumber * pageSize;
    const pageRecords = records.slice(start, start + pageSize).map(record => ({
      district: record.district || district.name,
      block: record.block || "",
      panchayat: record.panchayat || "",
      candidate: record.candidate || "",
      votes: "",
      result: record.result || ""
    }));
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({
      body: "gram-panchayat",
      post: "Gram Panchayat Pradhan · 2021",
      district: district ? district.name : "",
      block: blockValue,
      districts,
      blocks: blocks.map(value => ({value, label: value})),
      results: pageRecords,
      totalResults,
      message: !districtValue && !searchQuery && !resultFilter ? "Choose a district or search to load Gram Panchayat candidate records." : "",
      page: pageNumber,
      hasPrevious: pageNumber > 0,
      hasNext: start + pageSize < totalResults
    }));
  } catch (error) {
    console.error("Gram Panchayat dataset could not load:", error.message);
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ error: `The Gram Panchayat dataset could not load: ${error.message}` }));
  }
}

function proxySecRequest(req, res, url) {
  if (url.pathname === "/sec/api/urban-results") {
    if (url.searchParams.get("body") === "gram-panchayat") {
      getGramPanchayatResults(req, res, url);
    } else {
      getUrbanResults(req, res, url);
    }
    return;
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "GET, POST" });
    res.end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end("Invalid SEC path");
    return;
  }
  if (!pathname.startsWith("/sec/site/") || pathname.includes("..")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const session = getSecSession(req, res);
  const upstreamPath = pathname.slice(4);
  const upstreamQuery = new URLSearchParams(url.searchParams);
  const bodyType = upstreamQuery.get("body");
  upstreamQuery.delete("body");
  const query = upstreamQuery.toString();
  const target = `${upstreamPath}${query ? `?${query}` : ""}`;
  const headers = {
    "user-agent": req.headers["user-agent"],
    cookie: session.cookie,
    referer: req.headers.referer
      ? req.headers.referer.replace(/^https?:\/\/[^/]+\/sec/, "http://sec.up.nic.in")
      : ""
  };
  const selection = req.method === "GET" && bodyType ? {
    "nagar-nigam": {
      path: "/site/NewWinnerList2023.aspx",
      control: "ctl00$ContentPlaceHolder1$DropDownList1",
      value: "7"
    },
    "nagar-palika": {
      path: "/site/NewWinnerList2023.aspx",
      control: "ctl00$ContentPlaceHolder1$DropDownList1",
      value: "9"
    },
    "gram-panchayat": {
      path: "/site/WinnerListPRI2021.aspx",
      control: "ctl00$ContentPlaceHolder1$ddlPostTypes",
      value: "5"
    }
  }[bodyType] : null;

  let requestBody = "";
  req.on("data", chunk => { requestBody += chunk; });
  req.on("end", async () => {
    try {
      let upstream = await requestSec(target, req.method, {
        ...headers,
        "content-type": req.headers["content-type"]
      }, requestBody);
      updateSecCookies(session, upstream.headers);

      if (selection && selection.path === upstreamPath && upstream.statusCode === 200) {
        const selected = await postSecSelection(
          upstream.body.toString("utf8"),
          upstreamPath,
          session,
          headers,
          selection
        );
        if (selected) {
          updateSecCookies(session, selected.headers);
          upstream = selected;
        }
      }

      let responseBody = upstream.body;
      const contentType = upstream.headers["content-type"] || "application/octet-stream";
      if (contentType.includes("text/html") || contentType.includes("text/plain")) {
        let html = sanitizeSecResults(responseBody.toString("utf8"))
          .replace(/<!--\s*Histats\.com\s+START[\s\S]*?<!--\s*Histats\.com\s+END\s*-->/gi, "")
          .replace(/<!--\s*Histats\.com[\s\S]*?-->/gi, "")
          .replace(/<div\b(?=[^>]*\bid=["']histats_counter["'])[^>]*>[\s\S]*?<\/div>/gi, "");
        if (contentType.includes("text/html")) {
          html = html
            .replace(/https?:\/\/sec\.up\.nic\.in\/site\//gi, "/sec/site/")
            .replace(/(["'(=\s])\/site\//g, "$1/sec/site/");
        }
        responseBody = Buffer.from(html, "utf8");
      }
      const location = upstream.headers.location
        ? upstream.headers.location.replace(/^https?:\/\/sec\.up\.nic\.in\/site\//i, "/sec/site/")
        : undefined;
      res.writeHead(upstream.statusCode, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        ...(location ? { Location: location } : {})
      });
      res.end(responseBody);
    } catch (error) {
      console.error("Official local-election results could not load:", error.message);
      res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end("<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>Results unavailable</title><body><p>The Uttar Pradesh State Election Commission results service is temporarily unavailable. Retry later or use the official source link.</p></body></html>");
    }
  });
}

http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  } catch {
    res.writeHead(400);
    res.end("Invalid request URL");
    return;
  }
  if (url.pathname.startsWith("/sec/")) {
    proxySecRequest(req, res, url);
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end("Invalid path");
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(root, "." + pathname);

  if (!filePath.startsWith(root + path.sep) && filePath !== path.join(root, "index.html")) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": filePath.endsWith(".json.gz")
        ? "application/json; charset=utf-8"
        : mime[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      ...(filePath.endsWith(".json.gz") ? { "Content-Encoding": "gzip" } : {}),
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`POLITO preview server running on port ${port}`);
  console.log(`On this computer: http://localhost:${port}`);
  console.log("On your phone: open http://YOUR-COMPUTER-LAN-IP:" + port + " while both devices are on the same Wi-Fi.");
});
