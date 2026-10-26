# POLITO Frontend — Interactive Map Update

Responsive frontend concept for POLITO — India's Own Political Data Center.

## Run locally
1. Extract this folder.
2. Open `index.html` in a modern browser, or run the local preview server from the runnable package.
3. The map requires an internet connection because it loads Leaflet and public GeoJSON boundary data.

## Interactive Assembly map
The hero now uses Leaflet and attempts to load the public 403-seat Uttar Pradesh Assembly boundary dataset from `https://indiastats.org/geojson/uttar-pradesh-assemblies.json`. Constituency polygons can be hovered, searched, zoomed and clicked to open a POLITO profile preview. If that source is unavailable or blocks browser access, the panel shows a clear fallback link to the official Uttar Pradesh Legislative Assembly map: https://www.upvidhansabhaproceedings.gov.in/by-map.

## Important data note
Election results are loaded from the sources identified in the page/profile notes and have not yet been independently verified against the Election Commission of India. Check source licensing and constituency-name/number fields before production deployment.


## Map troubleshooting (important)
This build uses an external GeoJSON boundary endpoint. If it is blocked or unavailable, the map panel now shows a visible recovery screen instead of a blank/black map, with links to an interactive map and the official UP Vidhan Sabha map. The external fallback is a separate website; constituency data is not yet integrated into POLITO profiles.

**Replace the old project completely:** extract this ZIP into a new folder named `POLITO-FIXED-MAP`, open that folder in VS Code, and run `npm start`. Do not keep opening an older extracted folder.


## Separate section pages
The navigation now opens separate in-site page views for Overview, Elections, Constituencies, 2027 Forecast, and Forum. Browser Back returns to the previous POLITO page view; it does not exit the site. The page views use hash routes so they work with the included local Node preview server.

## JavaScript files
The browser code is split into feature-focused files in `js/` and loaded in order by `index.html`:

- `app.js` — shared page navigation and interface setup
- `election-results.js` — Assembly and Parliamentary election dashboards
- `local-election-results.js` — local-body results and election-card actions
- `constituency-search.js` — constituency search, profiles, and interactive map
- `district-dashboard.js` — district scorecards
- `assembly-result-profile.js` — Assembly candidate result profile
- `parliamentary-profiles.js` — Parliamentary constituency profiles

These are regular scripts, not modules, so keep their order in `index.html`; later files use shared functions and data declared by earlier files. The split preserves the existing features and behavior.


## Local constituency map data
The Constituencies map now loads `data/up-constituencies.geojson` locally, converted from the uploaded `S24_AC` shapefile set. The data contains 403 polygon features. Keep the three source files together if you need to reconvert: `.shp`, `.shx`, `.dbf`. Your Overview glowing map remains linked to `images/up-map.png`; copy your existing local image into that folder if it is not included in this ZIP.

## Uttar Pradesh Assembly results
The Elections page's Uttar Pradesh Assembly Results view includes 2017 and 2022 party charts and result tables. The 2017 candidate dataset is fetched from [DeepakKumarGS/UP-Election-Analysis](https://github.com/DeepakKumarGS/UP-Election-Analysis/blob/master/up_res.csv); its source party labels include alliance groupings. The 2017 dashboard also displays the statewide turnout figure of 61.11% reported in Election Commission of India election statistics. Assembly constituency profiles include 2017 and 2022 Assembly candidate results, followed by segment-wise 2024 and 2019 Lok Sabha results. Verify historical figures against Election Commission records before publication.

## Uttar Pradesh Parliamentary Results
The Elections page's Uttar Pradesh Parliamentary Results view switches between 2019 and 2024 statewide party tallies and links to same-year Assembly segment results. The 2019 party figures are aggregated from `data/up-lok-sabha-2019-candidates.csv`; seat totals use the highest-vote candidate in each parliamentary constituency, and vote shares exclude NOTA. As in the 2024 summary, the 2019 party-wise table highlights seven main parties rather than listing every party. Segment results for 2019 and 2024 use `data/up-lok-sabha-2019-segments.csv` and `data/up-lok-sabha-2024-segments.csv`, respectively, and show the leading candidate, runner-up, votes, margin, and party lead totals across 403 segments. Verify historical figures against Election Commission records before publication.


## Parliamentary constituency profiles
The global search supports Assembly and Parliamentary Constituencies, districts, and Assembly candidate names from the 2017 and 2022 elections. Candidate matches show the candidate, party, election year, and corresponding Assembly seat; selecting a match opens that constituency profile. A matching Parliamentary seat opens an in-site profile with candidate-wise 2019 and 2024 Lok Sabha results, vote shares, winner/margin, turnout/elector summary where present, and its available Assembly segments. Parliamentary profiles use the CSV files in `data/`. Search selection does not change the interactive map's polygon-click behavior. Statistics are limited to the fields in the supplied files; missing data is labeled as unavailable.

## Local-body election results
The Elections page's local-government card opens a shared results panel for Nagar Nigam and Nagar Palika Parishad (2023) and Gram Panchayat Pradhan (2021). The municipal views retrieve official declared winners from the Uttar Pradesh State Election Commission (SEC). Gram Panchayat uses the supplied Parquet-derived 2021 candidate dataset because the SEC lookup can return no data for district/block selections. The supplied dataset covers 67 of the expected 75 districts and includes candidate names and winner/runner-up labels, but not vote counts. Search matches candidates, Panchayats, blocks, and districts across the entire dataset before pagination; choose a district and optionally a block to narrow the search. Gram Panchayat results can also be filtered to winners, runner-up candidates, or other candidates. Results are returned 100 records per page. Use the official SEC link to consult its Panchayat results independently.

The urban local-body view displays winner, party, vote, turnout, reservation, ward, and local-body fields while excluding personal contact and demographic details. The SEC publishes declared winners, not a complete list of losing candidates. The Node server must be running (`npm start`) to load the municipal SEC results and the packaged Gram Panchayat data; opening `index.html` directly cannot load these results.

Official sources: the SEC [2023 urban local-body winner list](https://sec.up.nic.in/site/NewWinnerList2023.aspx) and [2021 Panchayat winner list](https://sec.up.nic.in/site/WinnerListPRI2021.aspx). The SEC notes that its Panchayat list is for public convenience and that the signed list supplied by the election officer is authoritative.

## District scorecards
Search a district in the Constituencies page's white search box to find its 2022 Assembly scorecard. The dropdown previews party seat counts, and selecting the district opens a breakdown of each Assembly constituency, winner, votes, and margin. District membership comes from `data/up-constituencies.geojson`; 2022 candidate results are loaded from the linked Assembly results CSV.
