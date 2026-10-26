const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// Keep the 2024 results back control reliable even if the results overlay is
// recreated or its local event listener fails to attach.
document.addEventListener('click', function(event) {
  const backButton = event.target && event.target.closest ? event.target.closest('#e24Back') : null;
  if (!backButton) return;
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  const resultsPage = document.getElementById('election2024FullPage');
  if (resultsPage) resultsPage.remove();
  document.body.style.overflow = '';
  document.body.classList.remove('pc-profile-open');
  const pageViews = document.querySelectorAll('main .page-view');
  pageViews.forEach(page => {
    const active = page.dataset.page === 'elections';
    page.classList.toggle('is-active', active);
    page.setAttribute('aria-hidden', active ? 'false' : 'true');
  });
  document.querySelectorAll('.main-nav [data-route]').forEach(link => {
    const active = link.dataset.route === 'elections';
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (window.location.hash !== '#elections') {
    window.history.replaceState({route: 'elections'}, '', '#elections');
  }
  window.scrollTo({top: 0, behavior: 'auto'});
}, true);

(function setupPageNavigation(){
  const main = document.querySelector('main');
  if (!main) return;
  const byId = id => document.getElementById(id);
  const hero = byId('overview');
  const search = byId('constituencies');
  const elections = byId('elections');
  const insights = document.querySelector('.insights-section');
  const forecast = byId('predictions');
  const forum = byId('forum');
  const newsletter = document.querySelector('.newsletter');
  const overviewContext = byId('overview-context');

  const makePage = (id, title, subtitle) => {
    let page = document.getElementById(`page-${id}`);
    if (!page) {
      page = document.createElement('div');
      page.className = 'page-view';
      page.id = `page-${id}`;
      page.dataset.page = id;
      if (title) {
        const intro = document.createElement('div');
        intro.className = 'page-intro';
        intro.innerHTML = `<span class="section-kicker">POLITO · UTTAR PRADESH</span><h1>${title}</h1><p>${subtitle || ''}</p>`;
        page.appendChild(intro);
      }
      main.appendChild(page);
    }
    return page;
  };

  const pages = {
    overview: makePage('overview'),
    elections: makePage('elections', 'Election centre', 'Explore Uttar Pradesh election results and compare contests.'),
    constituencies: makePage('constituencies', 'Constituencies', 'Search a seat or explore the interactive Assembly map.'),
    predictions: makePage('predictions', '2027 Forecast', 'Explore scenarios and assumptions—not official results.'),
    forum: makePage('forum', 'Political Forum', 'A space planned for constituency issues and informed discussion.')
  };

  if (hero) {
    hero.classList.add('overview-hero');
    pages.overview.appendChild(hero);
  }
  if (overviewContext) pages.overview.appendChild(overviewContext);
  if (newsletter) pages.overview.appendChild(newsletter);
  if (elections) pages.elections.appendChild(elections);
  if (insights) pages.elections.appendChild(insights);
  if (search) pages.constituencies.appendChild(search);

  const mapSection = document.createElement('section');
  mapSection.className = 'constituency-map-section';
  mapSection.innerHTML = `
    <div class="map-page-heading">
      <span class="section-kicker">INTERACTIVE MAP</span>
      <h2>Explore all 403 Assembly constituencies</h2>
      <p>Search a seat, hover to identify it, and click a boundary to open its election results.</p>
    </div>
    <div class="map-panel map-panel-standalone">
      <div class="map-grid"></div>
      <div class="map-toolbar">
        <label class="map-search-label" for="mapSeatSearch">FIND A SEAT</label>
        <input id="mapSeatSearch" type="search" placeholder="Search constituency…" autocomplete="off" />
        <button id="mapReset" type="button" aria-label="Reset map view" title="Reset map view">↺</button>
      </div>
      <div id="upAssemblyMap" class="up-assembly-map" role="application" aria-label="Interactive map of Uttar Pradesh Assembly constituencies">
        <div class="map-loading"><span class="map-loader"></span><b>Loading constituency boundaries</b><small>Preparing the interactive 403-seat map…</small></div>
      </div>
      <div id="mapStatus" class="map-status" aria-live="polite">Waiting for map data…</div>
      <div class="map-caption"><span>UP ASSEMBLY MAP</span><span>CLICK A CONSTITUENCY</span></div>
    </div>`;
  pages.constituencies.appendChild(mapSection);

  if (forecast) pages.predictions.appendChild(forecast);
  if (forum) pages.forum.appendChild(forum);

  function routeFromHash() {
    const hash = (window.location.hash || '#overview').slice(1).toLowerCase();
    if (hash === 'elections') return 'elections';
    if (hash === 'constituencies') return 'constituencies';
    if (hash === 'predictions' || hash === 'forecast') return 'predictions';
    if (hash === 'forum') return 'forum';
    return 'overview';
  }

  function renderPage(route, scroll = true) {
    const selected = pages[route] ? route : 'overview';
    Object.entries(pages).forEach(([name, page]) => {
      page.classList.toggle('is-active', name === selected);
      page.setAttribute('aria-hidden', name === selected ? 'false' : 'true');
    });

    document.querySelectorAll('.main-nav [data-route]').forEach(link => {
      const active = link.dataset.route === selected;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    document.title = selected === 'overview'
      ? "POLITO — India's Own Political Data Center"
      : `${({elections:'Elections',constituencies:'Constituencies',predictions:'2027 Forecast',forum:'Forum'})[selected]} | POLITO`;

    const nav = document.getElementById('mainNav');
    if (nav) nav.classList.remove('open');
    window.dispatchEvent(new CustomEvent('politiso:pagechange', {detail: {route: selected}}));
    if (scroll) window.scrollTo({top: 0, behavior: 'auto'});
  }

  function navigate(route) {
    if (!pages[route]) return;
    const hash = `#${route}`;
    if (window.location.hash !== hash) history.pushState({route}, '', hash);
    renderPage(route);
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    const hash = link.getAttribute('href').slice(1).toLowerCase();
    const route = ({overview:'overview',elections:'elections',constituencies:'constituencies',predictions:'predictions',forum:'forum'})[hash];
    if (!route) return;
    link.addEventListener('click', event => {
      event.preventDefault();
      navigate(route);
    });
  });

  window.addEventListener('popstate', () => renderPage(routeFromHash()));
  window.addEventListener('hashchange', () => renderPage(routeFromHash()));
  renderPage(routeFromHash(), false);
})();

const toast = $("#toast");
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

const dialog = $("#infoDialog");
const dialogTitle = $("#dialogTitle");
const dialogText = $("#dialogText");

