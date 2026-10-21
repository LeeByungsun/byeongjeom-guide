(function () {
  const defaultPlace =
    (window.PLACES && window.PLACES.find((p) => p.slug === "gogigupneun-bangatgan")) ||
    (window.PLACES && window.PLACES[0]) ||
    { id: 1 };

  const state = {
    tab: "all", // all | main | new | station | cinema
    satStatus: "all", // all | avail16 | open16 | after17 | check
    category: "all",
    sort: "default", // default | rating
    search: "",
    mapMode: "leaflet", // leaflet | gmap
    selectedPlaceId: defaultPlace.id,
    expandAllCards: false
  };

  let map = null;
  let markerLayer = null;
  const markersById = {};

  function getExternalLinks(place) {
    const exactQuery = encodeURIComponent(`${place.roadAddress} ${place.name}`);
    const searchNameQuery = encodeURIComponent(`화성 병점 ${place.name}`);
    return {
      naver: `https://map.naver.com/p/search/${exactQuery}`,
      kakao: `https://map.kakao.com/?q=${exactQuery}`,
      google: `https://www.google.com/maps/search/?api=1&query=${exactQuery}`,
      dining: `https://www.diningcode.com/list.dc?query=${searchNameQuery}`,
      gmapEmbed: `https://maps.google.com/maps?q=${exactQuery}&hl=ko&z=17&output=embed`
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

  function updateDynamicCounts() {
    const places = window.PLACES || [];
    const total = places.length;
    const mainList = places.filter((p) => p.group === "main");
    const extraList = places.filter((p) => p.group === "new");
    const stationAll = places.filter((p) => p.area === "station");
    const cinemaAll = places.filter((p) => p.area === "cinema");
    const stationMain = mainList.filter((p) => p.area === "station");
    const cinemaMain = mainList.filter((p) => p.area === "cinema");
    const seafoodAll = places.filter((p) => p.category === "해산물/조개/회");

    // Update top badges / titles / stats strip dynamically
    const badgeTotalEl = document.getElementById("hero-badge-total");
    if (badgeTotalEl) {
      badgeTotalEl.textContent = `📌 총 ${total}곳: 일반 추천 ${mainList.length}곳 + 별도 추천 ${extraList.length}곳`;
    }

    const titleCountEl = document.getElementById("hero-title-count");
    if (titleCountEl) {
      titleCountEl.textContent = `(총 ${total}곳: 일반 추천 ${mainList.length}곳 + 별도 추천 ${extraList.length}곳)`;
    }

    const statStationEl = document.getElementById("stat-station-val");
    if (statStationEl) {
      statStationEl.textContent = `일반 추천 ${stationMain.length}곳`;
    }

    const statCinemaEl = document.getElementById("stat-cinema-val");
    if (statCinemaEl) {
      statCinemaEl.textContent = `일반 추천 ${cinemaMain.length}곳 + 별도 추천 ${extraList.length}곳`;
    }

    const statExtraEl = document.getElementById("stat-extra-val");
    if (statExtraEl) {
      statExtraEl.textContent = `별도로 살펴볼 만한 매장 ${extraList.length}곳`;
    }

    const statSeafoodEl = document.getElementById("stat-seafood-val");
    if (statSeafoodEl) {
      statSeafoodEl.textContent = `횟집·해산물·조개·해신탕 총 ${seafoodAll.length}곳`;
    }

    // Update Tabs
    const tabLabels = {
      all: `전체 보기 (${total}곳)`,
      new: `별도 추천 (${extraList.length}곳)`,
      main: `일반 추천 (${mainList.length}곳)`,
      station: `병점역 1번 출구~중간 구간 (${stationAll.length}곳)`,
      cinema: `롯데시네마·중심상가 구간 (${cinemaAll.length}곳)`
    };
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      const key = btn.getAttribute("data-tab");
      if (tabLabels[key]) {
        btn.textContent = tabLabels[key];
      }
    });

    // Update Saturday 16:00 Status Select Options
    const satCounts = {
      avail16: places.filter((p) => p.sat4pmStatus === "avail16").length,
      open16: places.filter((p) => p.sat4pmStatus === "open16").length,
      after17: places.filter((p) => p.sat4pmStatus === "after17").length,
      check: places.filter((p) => p.sat4pmStatus === "check").length
    };
    const satSelect = document.getElementById("filter-sat");
    if (satSelect) {
      const optMap = {
        all: `🕓 토요일 영업 상태: 전체 (${total}곳)`,
        avail16: `✅ 16시 방문 가능 · 영업 중 · 브레이크타임 없음 (${satCounts.avail16}곳)`,
        open16: `🔔 16시~16시 30분 오픈 (${satCounts.open16}곳)`,
        after17: `🌙 17시 이후 오픈·2차 추천 (${satCounts.after17}곳)`,
        check: `📞 영업시간 확인 필요 (${satCounts.check}곳)`
      };
      Array.from(satSelect.options).forEach((opt) => {
        if (optMap[opt.value]) {
          opt.textContent = optMap[opt.value];
        }
      });
    }

    // Update Category Select Options dynamically
    const catSelect = document.getElementById("filter-category");
    if (catSelect) {
      const catNames = {
        all: `🍖 메뉴 분류: 전체 (${total}곳)`,
        "해산물/조개/회": "🐟 횟집 / 세꼬시 / 조개구이 / 해신탕",
        "돼지고기/구이": "🥩 돼지고기 / 특수부위 구이",
        "소고기/갈비": "🐂 소고기 / 숯불갈비",
        "곱창/막창": "🔥 소곱창 / 대창 / 막창",
        "양꼬치/훠궈/중식": "🍢 양꼬치 / 마라훠궈 / 중식",
        "족발/보쌈/국물": "🍲 족발 / 보쌈 / 전골 / 감자탕",
        "포차/이자카야/닭갈비": "🍺 민속주점 / 이자카야 / 숯불닭갈비"
      };
      Array.from(catSelect.options).forEach((opt) => {
        if (opt.value === "all") {
          opt.textContent = catNames.all;
        } else if (catNames[opt.value]) {
          const cnt = places.filter((p) => p.category === opt.value).length;
          opt.textContent = `${catNames[opt.value]} (${cnt}곳)`;
        }
      });
    }

    // Update Map Mode Button & Legend dynamically
    const btnLeaflet = document.getElementById("mode-leaflet");
    if (btnLeaflet) {
      btnLeaflet.textContent = `📍 통합 핀 지도 (${total}곳)`;
    }
    const btnBackLeaflet = document.getElementById("btn-back-leaflet");
    if (btnBackLeaflet) {
      btnBackLeaflet.textContent = `← 통합 핀 지도로 돌아가기`;
    }

    const legendEl = document.getElementById("map-legend");
    if (legendEl) {
      legendEl.innerHTML = `
        <span class="legend-item"><span class="legend-dot station"></span> 병점역권 일반 추천 ${stationMain.length}곳</span>
        <span class="legend-item"><span class="legend-dot cinema"></span> 롯데시네마권 일반 추천 ${cinemaMain.length}곳</span>
        <span class="legend-item"><span class="legend-dot new"></span> 별도 추천 ${extraList.length}곳</span>
      `;
    }
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

  function updateGmapIframe(placeId, filteredList) {
    const list = filteredList || filterPlaces();
    const iframe = document.getElementById("gmap-iframe");
    const titleEl = document.getElementById("gmap-current-title");

    if (list.length === 0) {
      if (titleEl) {
        titleEl.textContent = "조건에 맞는 매장이 없습니다";
      }
      return;
    }

    let place = list.find((p) => p.id === placeId);
    if (!place) {
      place = list[0];
      state.selectedPlaceId = place.id;
    }

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

    const osmKorea = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    });

    const cartoVoyager = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
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

    const st = window.LANDMARKS.station;
    const ci = window.LANDMARKS.cinema;

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
      .bindPopup("<b>🚶 병점역 1번 출구 ↔ 병점롯데시네마 도보 동선 (약 10~12분)</b>")
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
      html: `<div class="landmark-pin">🚉 병점역 1번 출구</div>`,
      iconSize: [110, 24],
      iconAnchor: [55, 12]
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

    [100, 350, 800, 1500].forEach((ms) => {
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, ms);
    });
  }

  function updateMapMarkers(filteredPlaces) {
    const emptyOverlay = document.getElementById("map-empty-overlay");
    if (emptyOverlay) {
      if (filteredPlaces.length === 0) {
        emptyOverlay.classList.add("show");
      } else {
        emptyOverlay.classList.remove("show");
      }
    }

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
            [${p.code}] ${p.name} ${p.group === "new" ? '<span style="color:#e11d48;font-size:11px;">[별도 추천]</span>' : ""}
          </div>
          <div style="font-size:12px;color:#475569;margin-bottom:4px;">${p.subArea} · <b>${p.categoryTag}</b></div>
          <div style="font-size:11.5px;color:#047857;font-weight:700;margin-bottom:4px;">🕒 ${p.satHours}</div>
          <div style="font-size:11.5px;color:#334155;margin-bottom:6px;">📍 ${p.roadAddress}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button type="button" onclick="window.setMapMode('gmap', ${p.id})" style="padding:3px 7px;background:#0f172a;color:#38bdf8;border:1px solid #38bdf8;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">구글 지도 보기</button>
            <a href="${links.naver}" target="_blank" rel="noopener" style="padding:3px 7px;background:#03c75a;color:#fff;border-radius:4px;font-size:11px;font-weight:700;text-decoration:none;">네이버지도 검색</a>
            <a href="${links.kakao}" target="_blank" rel="noopener" style="padding:3px 7px;background:#fee500;color:#111;border-radius:4px;font-size:11px;font-weight:700;text-decoration:none;">카카오맵 검색</a>
            <a href="${links.google}" target="_blank" rel="noopener" style="padding:3px 7px;background:#4285f4;color:#fff;border-radius:4px;font-size:11px;font-weight:700;text-decoration:none;">구글 지도 새 창</a>
            <a href="${links.dining}" target="_blank" rel="noopener" style="padding:3px 7px;background:#00b8a9;color:#fff;border-radius:4px;font-size:11px;font-weight:700;text-decoration:none;">다이닝코드 검색</a>
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

    // Ensure mobile map panel is expanded when user clicks map button on a card
    const mapPanel = document.querySelector(".map-panel");
    const mobileMapBtn = document.getElementById("btn-toggle-mobile-map");
    if (mapPanel && mapPanel.classList.contains("mobile-map-collapsed")) {
      mapPanel.classList.remove("mobile-map-collapsed");
      if (mobileMapBtn) mobileMapBtn.textContent = "🗺️ 지도 접기";
    }

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

  window.resetFilters = function () {
    state.tab = "all";
    state.satStatus = "all";
    state.category = "all";
    state.sort = "default";
    state.search = "";

    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-tab") === "all");
    });

    const satSelect = document.getElementById("filter-sat");
    if (satSelect) satSelect.value = "all";

    const catSelect = document.getElementById("filter-category");
    if (catSelect) catSelect.value = "all";

    const sortSelect = document.getElementById("filter-sort");
    if (sortSelect) sortSelect.value = "default";

    const searchInput = document.getElementById("filter-search");
    if (searchInput) searchInput.value = "";

    render();
    showToast("🔄 모든 필터와 검색어가 초기화되었습니다.");
  };

  window.toggleAllCardDetails = function () {
    state.expandAllCards = !state.expandAllCards;
    document.querySelectorAll(".card-details").forEach((el) => {
      el.open = state.expandAllCards;
    });
    const btn = document.getElementById("btn-toggle-all-details");
    if (btn) {
      btn.textContent = state.expandAllCards ? "📁 카드 상세 모두 접기" : "📂 카드 상세 모두 펼치기";
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
    const areaLabel = p.area === "station" ? "🚉 병점역권" : "🎬 롯데시네마권";

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

    const phoneBtnHtml = p.phone
      ? `<a href="tel:${p.phone}" class="ext-link btn-phone">📞 전화 걸기 (${p.phone})</a>`
      : `<span class="ext-link btn-phone-muted" title="포털 검색 결과를 통해 최신 번호를 확인하세요">📞 전화번호 확인 필요</span>`;

    return `
      <article class="place-card ${p.group === "new" ? "card-new" : ""}" id="place-card-${p.id}">
        <div class="card-top">
          <div>
            <div class="card-title-row">
              <span class="code-badge ${badgeColor}">${p.code}</span>
              <h3 class="place-name">${p.name}</h3>
              ${p.openDate ? `<span class="open-date-pill">📌 ${p.openDate}</span>` : ""}
            </div>
            <div class="card-meta-tags">
              <span class="meta-tag">${areaLabel} · ${p.subArea}</span>
              <span class="meta-tag">🍴 ${p.categoryTag}</span>
              <span class="sat-badge ${p.sat4pmStatus}">🕓 ${p.sat4pmBadge}</span>
            </div>
          </div>
        </div>

        <div class="menu-list">
          ${menusHtml}
        </div>

        <div class="combo-banner">
          <strong>🍺 3인 추천 주문:</strong> ${p.threeMenCombo}
        </div>

        <div class="card-primary-actions">
          <button type="button" class="ext-link btn-focus-map" onclick="window.focusPlaceOnMap(${p.id}, 'leaflet')">📍 지도에서 위치 보기</button>
          <button type="button" class="ext-link btn-focus-gmap" onclick="window.focusPlaceOnMap(${p.id}, 'gmap')">🌏 구글 지도 보기</button>
          ${phoneBtnHtml}
        </div>

        <details class="card-details" ${state.expandAllCards ? "open" : ""}>
          <summary>상세 정보 · 주소 · 평점 · 방문 팁</summary>
          <div class="card-details-body">
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">도로명 주소</span>
                <span class="info-val">${p.roadAddress} <span style="color:#64748b">(${p.jibunAddress})</span></span>
              </div>
              <div class="info-row">
                <span class="info-label">토요일 영업시간</span>
                <span class="info-val" style="color:#34d399;font-weight:700;">${p.satHours}</span>
              </div>
              <div class="info-row">
                <span class="info-label">연락처</span>
                <span class="info-val">${p.phone ? `<a href="tel:${p.phone}" style="color:#fbbf24;text-decoration:none;font-weight:700;">${p.phone}</a>` : "외부 지도 검색을 통해 확인 필요"}</span>
              </div>
            </div>

            <div class="ratings-grid">
              <div class="rating-item">
                <span class="platform-dot naver">N</span>
                <span>네이버 ${p.ratings.naver}</span>
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
                <span>다이닝코드 ${p.ratings.diningcode}</span>
              </div>
            </div>

            <ul class="reviews-list">
              ${reviewsHtml}
            </ul>

            <div class="tip-box">
              <strong>💡 방문 팁:</strong> ${p.tipFor3Men}
            </div>

            <div class="card-links">
              <a href="${links.naver}" target="_blank" rel="noopener" class="ext-link btn-naver">네이버지도 검색</a>
              <a href="${links.kakao}" target="_blank" rel="noopener" class="ext-link btn-kakao">카카오맵 검색</a>
              <a href="${links.google}" target="_blank" rel="noopener" class="ext-link btn-google">구글 지도 새 창에서 열기</a>
              <a href="${links.dining}" target="_blank" rel="noopener" class="ext-link btn-dining">다이닝코드 검색</a>
              <button type="button" class="ext-link" style="background:rgba(255,255,255,0.06);color:#cbd5e1;" onclick="window.copyAddress('${p.roadAddress}', '${p.name}')">주소 복사</button>
            </div>
          </div>
        </details>
      </article>
    `;
  }

  function filterPlaces() {
    let list = (window.PLACES || []).slice();

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
        const menuText = (p.signatureMenus || []).map((m) => `${m.name} ${m.price}`).join(" ");
        const hay = `${p.code} ${p.name} ${p.category} ${p.categoryTag} ${p.subArea} ${p.roadAddress} ${p.jibunAddress} ${p.satHours} ${p.sat4pmBadge} ${p.openDate || ""} ${p.phone || ""} ${menuText} ${p.threeMenCombo} ${p.tipFor3Men} ${(p.reviews || []).join(" ")}`.toLowerCase();
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

    // Synchronize selectedPlaceId with filtered results
    if (filtered.length > 0 && !filtered.some((p) => p.id === state.selectedPlaceId)) {
      state.selectedPlaceId = filtered[0].id;
    }
    updateGmapIframe(state.selectedPlaceId, filtered);

    const newPlaces = filtered.filter((p) => p.group === "new");
    const mainPlaces = filtered.filter((p) => p.group === "main");

    let html = "";

    if (newPlaces.length > 0) {
      html += `
        <section class="section-block" id="section-new">
          <div class="section-header">
            <div>
              <h2 class="section-title" style="color:#fb7185;">📌 별도 추천 매장 (${newPlaces.length}곳)</h2>
              <p class="section-desc">2025년 중·하반기에 개업해 실내 시설이 비교적 깔끔하고 별도로 살펴볼 만한 매장 ${newPlaces.length}곳</p>
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
              <h2 class="section-title" style="color:#60a5fa;">🍺 병점역 ↔ 병점롯데시네마 일반 추천 매장 (${mainPlaces.length}곳)</h2>
              <p class="section-desc">병점역권 ${stationCount}곳 + 롯데시네마(진안동 중심상가)권 ${cinemaCount}곳 · 친구 셋이 든든한 식사와 술자리를 즐기기 좋은 추천 매장</p>
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
          <p style="color:#94a3b8;font-size:0.9rem;margin-bottom:16px;">검색어나 필터 조건을 변경하거나 아래 버튼을 눌러 초기화해 보세요.</p>
          <button type="button" class="btn-reset" onclick="window.resetFilters()">🔄 필터 초기화</button>
        </div>
      `;
    }

    if (container) {
      container.innerHTML = html;
    }
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

    // Mobile filter toggle
    const mobileFilterBtn = document.getElementById("btn-toggle-mobile-filters");
    const secondaryFilters = document.getElementById("secondary-filters");
    if (mobileFilterBtn && secondaryFilters) {
      mobileFilterBtn.addEventListener("click", () => {
        const isCollapsed = secondaryFilters.classList.toggle("mobile-collapsed");
        mobileFilterBtn.textContent = isCollapsed ? "⚙️ 상세 필터 펼치기" : "⚙️ 상세 필터 접기";
      });
    }

    // Mobile map toggle
    const mobileMapBtn = document.getElementById("btn-toggle-mobile-map");
    const mapPanel = document.querySelector(".map-panel");
    if (mobileMapBtn && mapPanel) {
      mobileMapBtn.addEventListener("click", () => {
        const isCollapsed = mapPanel.classList.toggle("mobile-map-collapsed");
        mobileMapBtn.textContent = isCollapsed ? "🗺️ 지도 펼치기" : "🗺️ 지도 접기";
        if (!isCollapsed && map) {
          setTimeout(() => map.invalidateSize(), 100);
        }
      });
    }

    // Map quick zoom buttons
    document.getElementById("zoom-all")?.addEventListener("click", () => {
      window.setMapMode("leaflet");
      if (map) map.flyTo([37.2102, 127.0375], 15, { duration: 0.6 });
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
          showToast("🔗 웹페이지 주소가 복사되었습니다! 모임방에 붙여넣어 공유하세요.");
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

    updateDynamicCounts();
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
