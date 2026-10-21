(function () {
  const state = {
    tab: "all", // all | main | new | station | cinema
    satStatus: "all", // all | immediate | open4pm
    category: "all",
    sort: "default", // default | rating
    search: "",
    mapMode: "leaflet", // leaflet | gmap
    selectedPlaceId: 23 // default: 고기굽는방앗간 화성병점점
  };

  let map = null;
  let markerLayer = null;
  const markersById = {};

  function getExternalLinks(place) {
    const query = encodeURIComponent(`화성 병점 ${place.name}`);
    const addrQuery = encodeURIComponent(`${place.roadAddress} ${place.name}`);
    return {
      naver: `https://map.naver.com/p/search/${query}`,
      kakao: `https://map.kakao.com/?q=${query}`,
      google: `https://www.google.com/maps/search/?api=1&query=${addrQuery}`,
      dining: `https://www.diningcode.com/list.dc?query=${query}`,
      gmapEmbed: `https://maps.google.com/maps?q=${encodeURIComponent(place.roadAddress + " " + place.name)}&hl=ko&z=17&output=embed`
    };
  }

  function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }

  window.setMapMode = function (mode, placeId) {
    state.mapMode = mode;
    if (placeId) {
      state.selectedPlaceId = placeId;
    }

    const mapEl = document.getElementById("map");
    const gmapWrap = document.getElementById("gmap-wrap");
    const btnLeaflet = document.getElementById("mode-leaflet");
    const btnGmap = document.getElementById("mode-gmap");

    if (mode === "gmap") {
      if (mapEl) mapEl.style.display = "none";
      if (gmapWrap) gmapWrap.style.display = "flex";
      btnLeaflet?.classList.remove("active");
      btnGmap?.classList.add("active");
      updateGmapIframe(state.selectedPlaceId);
    } else {
      if (mapEl) mapEl.style.display = "block";
      if (gmapWrap) gmapWrap.style.display = "none";
      btnLeaflet?.classList.add("active");
      btnGmap?.classList.remove("active");
      if (map) {
        setTimeout(() => map.invalidateSize(), 50);
      }
    }
  };

  function updateGmapIframe(placeId) {
    const place = window.PLACES.find((p) => p.id === placeId) || window.PLACES[0];
    const iframe = document.getElementById("gmap-iframe");
    const titleEl = document.getElementById("gmap-current-title");
    if (titleEl && place) {
      titleEl.textContent = `[${place.code}] ${place.name} · ${place.roadAddress}`;
    }
    if (iframe && place) {
      const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(place.roadAddress + " " + place.name)}&hl=ko&z=17&output=embed`;
      if (iframe.getAttribute("src") !== embedUrl) {
        iframe.setAttribute("src", embedUrl);
      }
    }
  }

  function initMap() {
    if (map) return;
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    map = L.map("map", {
      center: [37.2103, 127.0385],
      zoom: 15,
      scrollWheelZoom: true
    });

    // OpenStreetMap Korean Standard Tile Layer (API Key NOT required, shows full Korean labels)
    const osmKorea = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (API 키 불필요)',
      maxZoom: 19
    });

    const cartoVoyager = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19
    });

    osmKorea.addTo(map);
    L.control.layers(
      {
        "🇰🇷 한글 상세 도로지도 (OSM)": osmKorea,
        "🗺️ 심플 컬러 지도 (CARTO)": cartoVoyager
      },
      null,
      { position: "topright" }
    ).addTo(map);

    // Draw zone circles, corridor line & landmarks (병점역 1번출구 ↔ 병점롯데시네마 사이)
    const st = window.LANDMARKS.station;
    const ci = window.LANDMARKS.cinema;

    // Walking corridor line between Byeongjeom Station Exit 1 and Byeongjeom Lotte Cinema
    L.polyline(
      [
        [st.lat, st.lng],
        [37.2098, 127.0368],
        [37.21185, 127.03830],
        [37.21285, 127.04020],
        [ci.lat, ci.lng]
      ],
      {
        color: "#10b981",
        weight: 4,
        opacity: 0.65,
        dashArray: "8 6"
      }
    )
      .bindPopup("<b>🚶 병점역 1번출구 ↔ 병점롯데시네마 도보 동선 (약 10~12분)</b>")
      .addTo(map);

    L.circle([37.2063, 127.0358], {
      radius: 260,
      color: "#2563eb",
      weight: 2,
      fillColor: "#3b82f6",
      fillOpacity: 0.08,
      dashArray: "6 4"
    }).addTo(map);

    L.circle([37.2129, 127.0406], {
      radius: 320,
      color: "#d97706",
      weight: 2,
      fillColor: "#f59e0b",
      fillOpacity: 0.09,
      dashArray: "6 4"
    }).addTo(map);

    const stIcon = L.divIcon({
      className: "",
      html: `<div class="landmark-pin">🚉 병점역</div>`,
      iconSize: [74, 24],
      iconAnchor: [37, 12]
    });
    L.marker([st.lat, st.lng], { icon: stIcon })
      .bindPopup(`<strong>${st.name}</strong><br/><span style="font-size:12px">${st.desc}</span>`)
      .addTo(map);

    const ciIcon = L.divIcon({
      className: "",
      html: `<div class="landmark-pin" style="border-color:#f59e0b">🎬 병점롯데시네마</div>`,
      iconSize: [110, 24],
      iconAnchor: [55, 12]
    });
    L.marker([ci.lat, ci.lng], { icon: ciIcon })
      .bindPopup(`<strong>${ci.name}</strong><br/><span style="font-size:12px">${ci.desc}</span>`)
      .addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    // Force Leaflet tile recalculation after dynamic DOM insertion
    [100, 350, 800, 1500].forEach((ms) => {
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, ms);
    });
  }

  function updateMapMarkers(filteredPlaces) {
    if (!markerLayer || !map) return;
    markerLayer.clearLayers();

    const bounds = [];

    filteredPlaces.forEach((p) => {
      const pinClass = p.group === "new" ? "pin-new" : p.area === "station" ? "pin-station" : "pin-cinema";
      const icon = L.divIcon({
        className: "",
        html: `<div class="custom-pin ${pinClass}" title="${p.name}">${p.code}</div>`,
        iconSize: p.group === "new" ? [34, 34] : [30, 30],
        iconAnchor: p.group === "new" ? [17, 17] : [15, 15]
      });

      const links = getExternalLinks(p);
      const popupHtml = `
        <div style="min-width:230px;font-family:Pretendard,sans-serif;line-height:1.45;color:#0f172a;">
          <div style="font-weight:800;font-size:14px;margin-bottom:3px;">
            [${p.code}] ${p.name} ${p.group === "new" ? '<span style="color:#e11d48;font-size:11px;">[신규개업]</span>' : ""}
          </div>
          <div style="font-size:12px;color:#475569;margin-bottom:4px;">${p.subArea} · <b>${p.categoryTag}</b></div>
          <div style="font-size:11.5px;color:#047857;font-weight:700;margin-bottom:4px;">🕒 ${p.satHours}</div>
          <div style="font-size:11.5px;color:#334155;margin-bottom:6px;">📍 ${p.roadAddress}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button type="button" onclick="window.setMapMode('gmap', ${p.id})" style="padding:3px 7px;background:#0f172a;color:#38bdf8;border:1px solid #38bdf8;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">구글맵 상세뷰</button>
            <a href="${links.naver}" target="_blank" rel="noopener" style="padding:3px 7px;background:#03c75a;color:#fff;border-radius:4px;font-size:11px;font-weight:700;text-decoration:none;">네이버</a>
            <a href="${links.kakao}" target="_blank" rel="noopener" style="padding:3px 7px;background:#fee500;color:#111;border-radius:4px;font-size:11px;font-weight:700;text-decoration:none;">카카오</a>
            <a href="${links.google}" target="_blank" rel="noopener" style="padding:3px 7px;background:#4285f4;color:#fff;border-radius:4px;font-size:11px;font-weight:700;text-decoration:none;">구글맵</a>
            <a href="${links.dining}" target="_blank" rel="noopener" style="padding:3px 7px;background:#00b8a9;color:#fff;border-radius:4px;font-size:11px;font-weight:700;text-decoration:none;">다이닝코드</a>
          </div>
        </div>
      `;

      const marker = L.marker([p.lat, p.lng], { icon }).bindPopup(popupHtml);
      marker.on("click", () => {
        state.selectedPlaceId = p.id;
        highlightCard(p.id, false);
      });

      marker.addTo(markerLayer);
      markersById[p.id] = marker;
      bounds.push([p.lat, p.lng]);
    });

    if (bounds.length > 0) {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    }
  }

  window.focusPlaceOnMap = function (id, mode) {
    const place = window.PLACES.find((p) => p.id === id);
    if (!place) return;
    state.selectedPlaceId = id;

    if (mode === "gmap") {
      window.setMapMode("gmap", id);
      highlightCard(id, false);
      if (window.innerWidth <= 1080) {
        document.getElementById("gmap-wrap")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    window.setMapMode("leaflet", id);
    if (map) {
      map.invalidateSize();
      map.flyTo([place.lat, place.lng], 17, { duration: 0.65 });
      const marker = markersById[id];
      if (marker) {
        setTimeout(() => marker.openPopup(), 350);
      }
    }
    highlightCard(id, false);
    if (window.innerWidth <= 1080) {
      document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  window.copyAddress = function (addr, name) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(addr).then(() => {
        showToast(`📋 '${name}' 도로명 주소가 복사되었습니다!`);
      });
    } else {
      showToast(`주소: ${addr}`);
    }
  };

  function highlightCard(id, scroll) {
    document.querySelectorAll(".place-card").forEach((el) => el.classList.remove("highlighted"));
    const target = document.getElementById(`place-card-${id}`);
    if (target) {
      target.classList.add("highlighted");
      if (scroll) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function createCardHtml(p) {
    const links = getExternalLinks(p);
    const badgeColor = p.group === "new" ? "new" : p.area === "station" ? "station" : "cinema";
    const areaLabel = p.area === "station" ? "🚉 병점역권" : "🎬 병점롯데시네마권";

    const menusHtml = p.signatureMenus
      .map(
        (m) => `
        <div class="menu-row">
          <span class="menu-name">${m.name}</span>
          <span class="menu-price">${m.price}</span>
        </div>`
      )
      .join("");

    const reviewsHtml = p.reviews.map((r) => `<li>${r}</li>`).join("");

    return `
      <article class="place-card ${p.group === "new" ? "card-new" : ""}" id="place-card-${p.id}">
        <div class="card-top">
          <div>
            <div class="card-title-row">
              <span class="code-badge ${badgeColor}">${p.code}</span>
              <h3 class="place-name">${p.name}</h3>
              ${p.openDate ? `<span class="open-date-pill">🔥 ${p.openDate}</span>` : ""}
            </div>
            <div class="card-meta-tags">
              <span class="meta-tag">${areaLabel} · ${p.subArea}</span>
              <span class="meta-tag">🍴 ${p.categoryTag}</span>
              <span class="sat-badge ${p.sat4pmStatus}">🕓 ${p.sat4pmBadge}</span>
            </div>
          </div>
        </div>

        <div class="info-box">
          <div class="info-row">
            <span class="info-label">도로명주소</span>
            <span class="info-val">${p.roadAddress} <span style="color:#64748b">(${p.jibunAddress})</span></span>
          </div>
          <div class="info-row">
            <span class="info-label">토요일영업</span>
            <span class="info-val" style="color:#34d399;font-weight:700;">${p.satHours}</span>
          </div>
        </div>

        <div class="ratings-grid">
          <div class="rating-item">
            <span class="platform-dot naver">N</span>
            <span>${p.ratings.naver}</span>
          </div>
          <div class="rating-item">
            <span class="platform-dot kakao">K</span>
            <span>카카오 ${p.ratings.kakao}</span>
          </div>
          <div class="rating-item">
            <span class="platform-dot google">G</span>
            <span>구글 ${p.ratings.google}</span>
          </div>
          <div class="rating-item">
            <span class="platform-dot dining">D</span>
            <span>${p.ratings.diningcode}</span>
          </div>
        </div>

        <div class="menu-list">
          ${menusHtml}
        </div>

        <div class="combo-banner">
          <strong>🍺 남자 3인 추천 조합:</strong> ${p.threeMenCombo}
        </div>

        <ul class="reviews-list">
          ${reviewsHtml}
        </ul>

        <div class="tip-box">
          <strong>💡 토요일 4시 방문 팁:</strong> ${p.tipFor3Men}
        </div>

        <div class="card-links">
          <button type="button" class="ext-link btn-focus-map" onclick="window.focusPlaceOnMap(${p.id}, 'leaflet')">📍 핀위치</button>
          <button type="button" class="ext-link btn-focus-map" style="background:rgba(16,185,129,0.16);color:#34d399;border-color:rgba(16,185,129,0.35);" onclick="window.focusPlaceOnMap(${p.id}, 'gmap')">🌏 구글맵내장</button>
          <a href="${links.naver}" target="_blank" rel="noopener" class="ext-link btn-naver">네이버지도</a>
          <a href="${links.kakao}" target="_blank" rel="noopener" class="ext-link btn-kakao">카카오맵</a>
          <a href="${links.google}" target="_blank" rel="noopener" class="ext-link btn-google">구글맵새창</a>
          <a href="${links.dining}" target="_blank" rel="noopener" class="ext-link btn-dining">다이닝코드</a>
          <button type="button" class="ext-link" style="background:rgba(255,255,255,0.06);color:#cbd5e1;" onclick="window.copyAddress('${p.roadAddress}', '${p.name}')">주소복사</button>
        </div>
      </article>
    `;
  }

  function filterPlaces() {
    let list = window.PLACES.slice();

    if (state.tab === "main") {
      list = list.filter((p) => p.group === "main");
    } else if (state.tab === "new") {
      list = list.filter((p) => p.group === "new");
    } else if (state.tab === "station") {
      list = list.filter((p) => p.area === "station");
    } else if (state.tab === "cinema") {
      list = list.filter((p) => p.area === "cinema");
    }

    if (state.satStatus !== "all") {
      list = list.filter((p) => p.sat4pmStatus === state.satStatus);
    }

    if (state.category !== "all") {
      list = list.filter((p) => p.category === state.category);
    }

    if (state.search.trim() !== "") {
      const q = state.search.trim().toLowerCase();
      list = list.filter((p) => {
        const hay = `${p.name} ${p.category} ${p.categoryTag} ${p.subArea} ${p.roadAddress} ${p.jibunAddress} ${p.threeMenCombo} ${p.reviews.join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (state.sort === "rating") {
      list.sort((a, b) => b.scoreNumeric - a.scoreNumeric);
    } else {
      list.sort((a, b) => a.id - b.id);
    }

    return list;
  }

  function render() {
    const filtered = filterPlaces();
    const container = document.getElementById("places-container");
    const countLabel = document.getElementById("result-count");

    if (countLabel) {
      countLabel.textContent = `총 ${filtered.length}곳 표시 중`;
    }

    const newPlaces = filtered.filter((p) => p.group === "new");
    const mainPlaces = filtered.filter((p) => p.group === "main");

    let html = "";

    if (newPlaces.length > 0) {
      html += `
        <section class="section-block" id="section-new">
          <div class="section-header">
            <div>
              <h2 class="section-title" style="color:#fb7185;">🔥 신규개업(신상 오픈) 별도 추천 (${newPlaces.length}곳)</h2>
              <p class="section-desc">최근 병점역·병점롯데시네마 인근에 새로 오픈해 시설이 쾌적하고 초기 평점이 폭발적인 핫플레이스 5선</p>
            </div>
          </div>
          <div class="cards-grid">
            ${newPlaces.map(createCardHtml).join("")}
          </div>
        </section>
      `;
    }

    if (mainPlaces.length > 0) {
      const stationCount = mainPlaces.filter((p) => p.area === "station").length;
      const cinemaCount = mainPlaces.filter((p) => p.area === "cinema").length;
      html += `
        <section class="section-block" id="section-main">
          <div class="section-header">
            <div>
              <h2 class="section-title" style="color:#60a5fa;">🏆 병점역 & 병점롯데시네마 검증 맛집·술집 추천 (${mainPlaces.length}곳)</h2>
              <p class="section-desc">병점역 인근 ${stationCount}곳 + 병점롯데시네마(진안동 중심상가) 인근 ${cinemaCount}곳 · 토요일 오후 4시 남자 셋 모임 최적화</p>
            </div>
          </div>
          <div class="cards-grid">
            ${mainPlaces.map(createCardHtml).join("")}
          </div>
        </section>
      `;
    }

    if (filtered.length === 0) {
      html = `
        <div style="padding:48px 20px;text-align:center;background:#1e293b;border-radius:16px;border:1px solid rgba(148,163,184,0.2);">
          <p style="font-size:1.1rem;font-weight:700;margin-bottom:8px;">조건에 맞는 매장이 없습니다.</p>
          <p style="color:#94a3b8;font-size:0.9rem;">필터나 검색어를 초기화해 보세요.</p>
        </div>
      `;
    }

    container.innerHTML = html;
    updateMapMarkers(filtered);
  }

  function renderCourses() {
    const grid = document.getElementById("courses-grid");
    if (!grid || !window.COURSES) return;
    grid.innerHTML = window.COURSES.map(
      (c) => `
      <div class="course-card">
        <div class="course-title">${c.title}</div>
        <div class="course-sub">${c.subtitle}</div>
        <div class="course-steps">
          ${c.steps
            .map(
              (s) => `
            <div class="course-step">
              <div><span class="step-time">${s.time}</span><span class="step-place">${s.place}</span></div>
              <div class="step-note">${s.note}</div>
            </div>`
            )
            .join("")}
        </div>
      </div>
    `
    ).join("");
  }

  function bindEvents() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.tab = btn.getAttribute("data-tab");
        render();
      });
    });

    const satSelect = document.getElementById("filter-sat");
    if (satSelect) {
      satSelect.addEventListener("change", (e) => {
        state.satStatus = e.target.value;
        render();
      });
    }

    const catSelect = document.getElementById("filter-category");
    if (catSelect) {
      catSelect.addEventListener("change", (e) => {
        state.category = e.target.value;
        render();
      });
    }

    const sortSelect = document.getElementById("filter-sort");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        state.sort = e.target.value;
        render();
      });
    }

    const searchInput = document.getElementById("filter-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.search = e.target.value;
        render();
      });
    }

    // Map quick zoom buttons
    document.getElementById("zoom-all")?.addEventListener("click", () => {
      window.setMapMode("leaflet");
      if (map) map.flyTo([37.2102, 127.0355], 14, { duration: 0.6 });
    });
    document.getElementById("zoom-station")?.addEventListener("click", () => {
      window.setMapMode("leaflet");
      if (map) map.flyTo([window.LANDMARKS.station.lat, window.LANDMARKS.station.lng], 16, { duration: 0.6 });
    });
    document.getElementById("zoom-cinema")?.addEventListener("click", () => {
      window.setMapMode("leaflet");
      if (map) map.flyTo([window.LANDMARKS.cinema.lat, window.LANDMARKS.cinema.lng], 16, { duration: 0.6 });
    });

    // Share button
    document.getElementById("btn-share-url")?.addEventListener("click", () => {
      const url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast("🔗 웹페이지 주소가 복사되었습니다! 단톡방에 붙여넣어 공유하세요.");
        });
      } else {
        showToast(`주소: ${url}`);
      }
    });
  }

  function ensureLeafletCss() {
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }

  function ensureLeafletAndInitMap() {
    ensureLeafletCss();
    if (map) return;
    if (typeof window.L !== "undefined" && typeof window.L.map === "function") {
      try {
        initMap();
        updateMapMarkers(filterPlaces());
      } catch (e) {
        console.error("Map init error:", e);
      }
      return;
    }

    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = function () {
      try {
        initMap();
        updateMapMarkers(filterPlaces());
      } catch (e) {
        console.error("Dynamic Leaflet init error:", e);
      }
    };
    document.head.appendChild(s);
  }

  function boot() {
    if (window.__byeongjeomBooted) return;
    window.__byeongjeomBooted = true;

    const gpLoading = document.getElementById("loading");
    if (gpLoading) gpLoading.style.display = "none";
    const gpMain = document.getElementById("main");
    if (gpMain) gpMain.style.display = "none";

    renderCourses();
    bindEvents();
    render();
    ensureLeafletAndInitMap();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  }
  setTimeout(boot, 0);
})();
