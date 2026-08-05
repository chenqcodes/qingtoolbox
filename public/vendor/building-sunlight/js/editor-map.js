/**
 * 地图规划：设计图按「米制宽度 + 经纬度中心」锚定地图，随地图平移缩放；
 * 点选后图上拖动/四角缩放/旋转柄旋转；未选中时事件穿透到地图。
 */
(function () {
  'use strict';

  const DEFAULT_LAT = CONFIG?.DEFAULTS?.LATITUDE ?? 36.65;
  const DEFAULT_LON = CONFIG?.DEFAULTS?.LONGITUDE ?? 117.12;
  const DEFAULT_TZ = CONFIG?.DEFAULTS?.TIME_ZONE ?? 'Asia/Shanghai';

  const mapEl = document.getElementById('map');
  const overlayHost = document.getElementById('overlayHost');
  const overlayBox = document.getElementById('overlayBox');
  const overlayImg = document.getElementById('overlayImg');
  const citySelect = document.getElementById('citySelect');
  const latInput = document.getElementById('lat');
  const lonInput = document.getElementById('lon');
  const buildingList = document.getElementById('buildingList');

  let map;
  let baseLayer = null;
  let buildings = [];
  let drawMode = false;
  let currentPts = [];
  let currentLine = null;
  let overlayOn = false;

  // 地理锚定：宽高按米，不跟浏览器窗口走
  const overlay = {
    lat: DEFAULT_LAT,
    lng: DEFAULT_LON,
    widthMeters: 120,
    rotation: 0,
    opacity: 0.55,
    naturalW: 0,
    naturalH: 0,
    selected: false,
  };

  let interact = null; // { mode: 'move'|'scale'|'rot', ... }

  const BASEMAPS = {
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
    topo: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      maxZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    },
  };

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function metersPerPixel(lat, zoom) {
    // WebMercator 近似
    return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  }

  function latLngToMeters(latlng, origin) {
    const mPerDegLat = 111320;
    const mPerDegLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);
    return {
      x: (latlng.lng - origin.lng) * mPerDegLon,
      y: (latlng.lat - origin.lat) * mPerDegLat,
    };
  }

  function overlayPixelSize() {
    const mpp = metersPerPixel(overlay.lat, map.getZoom());
    const w = Math.max(16, overlay.widthMeters / mpp);
    const ratio = overlay.naturalH / overlay.naturalW || 1;
    return { w, h: w * ratio };
  }

  function overlayCenterPoint() {
    return map.latLngToContainerPoint([overlay.lat, overlay.lng]);
  }

  /** 点击是否落在旋转后的图片矩形内 */
  function hitTestOverlay(containerPt) {
    if (!overlayOn || !overlay.naturalW) return false;
    const c = overlayCenterPoint();
    const { w, h } = overlayPixelSize();
    const rad = (-overlay.rotation * Math.PI) / 180;
    const dx = containerPt.x - c.x;
    const dy = containerPt.y - c.y;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
  }

  function setSelected(on) {
    overlay.selected = !!on;
    overlayHost.classList.toggle('is-selected', overlay.selected);
    if (overlay.selected) {
      // 选中时禁止地图拖拽抢手势（滚轮缩放仍可用）
      map.dragging.disable();
    } else {
      map.dragging.enable();
      interact = null;
    }
    syncOverlayTransform();
    syncFinePanel();
  }

  function syncFinePanel() {
    const fine = document.getElementById('overlayFine');
    if (!fine) return;
    fine.hidden = !overlayOn;
    const wEl = document.getElementById('overlayWidthM');
    const rEl = document.getElementById('overlayRot');
    if (wEl && document.activeElement != wEl) wEl.value = Math.round(overlay.widthMeters);
    if (rEl && document.activeElement != rEl) rEl.value = round2(overlay.rotation);
  }

  function syncOverlayTransform() {
    if (!overlayOn || !overlay.naturalW) return;
    const c = overlayCenterPoint();
    const { w, h } = overlayPixelSize();
    overlayBox.style.width = w + 'px';
    overlayBox.style.height = h + 'px';
    overlayBox.style.left = c.x - w / 2 + 'px';
    overlayBox.style.top = c.y - h / 2 + 'px';
    overlayBox.style.transform = `rotate(${overlay.rotation}deg)`;
    overlayImg.style.opacity = String(overlay.opacity);
    overlayHost.hidden = false;
    syncFinePanel();
  }

  /** 按地面米数微调位移：n/s/e/w */
  function nudgeOverlay(dir, meters) {
    if (!overlayOn || drawMode) return;
    const m = Number(meters);
    if (!(m > 0)) return;
    const mPerDegLat = 111320;
    const mPerDegLon = 111320 * Math.cos((overlay.lat * Math.PI) / 180);
    if (dir == 'n') overlay.lat += m / mPerDegLat;
    else if (dir == 's') overlay.lat -= m / mPerDegLat;
    else if (dir == 'e') overlay.lng += m / mPerDegLon;
    else if (dir == 'w') overlay.lng -= m / mPerDegLon;
    if (!overlay.selected) setSelected(true);
    else syncOverlayTransform();
  }

  function setOverlayWidth(meters) {
    if (!overlayOn || drawMode) return;
    const v = Number(meters);
    if (!Number.isFinite(v)) return;
    overlay.widthMeters = Math.max(10, Math.min(5000, v));
    if (!overlay.selected) setSelected(true);
    else syncOverlayTransform();
  }

  function setOverlayRotation(deg) {
    if (!overlayOn || drawMode) return;
    const v = Number(deg);
    if (!Number.isFinite(v)) return;
    overlay.rotation = ((v % 360) + 360) % 360;
    if (overlay.rotation > 180) overlay.rotation -= 360;
    if (!overlay.selected) setSelected(true);
    else syncOverlayTransform();
  }

  function setBasemap(key) {
    const cfg = BASEMAPS[key] || BASEMAPS.osm;
    if (baseLayer) map.removeLayer(baseLayer);
    baseLayer = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
      attribution: cfg.attribution,
    }).addTo(map);
  }

  function setOverlayImage(file) {
    const url = URL.createObjectURL(file);
    overlayImg.onload = () => {
      overlay.naturalW = overlayImg.naturalWidth;
      overlay.naturalH = overlayImg.naturalHeight;
      const center = map.getCenter();
      overlay.lat = center.lat;
      overlay.lng = center.lng;
      overlay.rotation = 0;
      // 初始约占当前视口宽度 55% 对应的地面米数（之后固定，不随窗口变）
      const mpp = metersPerPixel(center.lat, map.getZoom());
      overlay.widthMeters = Math.max(20, map.getSize().x * 0.55 * mpp);
      overlayOn = true;
      setSelected(true);
      syncOverlayTransform();
    };
    overlayImg.src = url;
  }

  function clearOverlay() {
    overlayOn = false;
    setSelected(false);
    overlayHost.hidden = true;
    overlayImg.removeAttribute('src');
    overlay.naturalW = 0;
    overlay.naturalH = 0;
    syncFinePanel();
  }

  function initMap() {
    latInput.value = DEFAULT_LAT;
    lonInput.value = DEFAULT_LON;

    map = L.map(mapEl, {
      center: [DEFAULT_LAT, DEFAULT_LON],
      zoom: 17,
      zoomControl: true,
    });

    setBasemap('osm');

    map.on('click', onMapClick);
    map.on('move zoom viewreset', syncOverlayTransform);
    window.addEventListener('resize', () => {
      map.invalidateSize();
      syncOverlayTransform();
    });

    // 捕获阶段：未选中时点在图上 → 选中；点在图外 → 取消选中
    // 描楼模式下不抢点击，让事件落到地图上描点
    mapEl.addEventListener(
      'pointerdown',
      (e) => {
        if (!overlayOn || e.button != 0) return;
        if (drawMode) return;
        if (e.target.closest && e.target.closest('.handle')) return;
        const rect = mapEl.getBoundingClientRect();
        const pt = L.point(e.clientX - rect.left, e.clientY - rect.top);
        const hit = hitTestOverlay(pt);
        if (hit && !overlay.selected) {
          setSelected(true);
          e.stopPropagation();
          e.preventDefault();
        } else if (!hit && overlay.selected) {
          setSelected(false);
        }
      },
      true,
    );
  }

  function initCities() {
    if (typeof generateCityOptions == 'function') {
      citySelect.innerHTML = generateCityOptions(CONFIG?.DEFAULTS?.CITY || '济南');
    }
    citySelect.addEventListener('change', () => {
      const opt = citySelect.options[citySelect.selectedIndex];
      if (!opt?.dataset?.lat) return;
      const lat = parseFloat(opt.dataset.lat);
      const lon = parseFloat(opt.dataset.lon);
      latInput.value = lat;
      lonInput.value = lon;
      map.setView([lat, lon], Math.max(map.getZoom(), 17));
      syncOverlayTransform();
    });

    if (navigator.geolocation && typeof findNearestCity == 'function') {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const city = findNearestCity(pos.coords.latitude, pos.coords.longitude);
          if (city) {
            citySelect.innerHTML = generateCityOptions(city.name);
            citySelect.value = city.name;
            latInput.value = city.lat;
            lonInput.value = city.lon;
            map.setView([city.lat, city.lon], 17);
          } else {
            latInput.value = pos.coords.latitude;
            lonInput.value = pos.coords.longitude;
            map.setView([pos.coords.latitude, pos.coords.longitude], 17);
          }
          syncOverlayTransform();
        },
        () => {},
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
      );
    }
  }

  function onMapClick(e) {
    if (overlay.selected) return;
    if (!drawMode) return;
    currentPts.push(e.latlng);
    document.getElementById('btnUndo').disabled = currentPts.length == 0;
    document.getElementById('btnFinish').disabled = currentPts.length < 3;
    if (currentLine) map.removeLayer(currentLine);
    if (currentPts.length >= 2) {
      currentLine = L.polyline(currentPts, { color: '#0d6efd', weight: 3 }).addTo(map);
    } else if (currentPts.length == 1) {
      currentLine = L.circleMarker(currentPts[0], { radius: 5, color: '#0d6efd' }).addTo(map);
    }
    document.getElementById('drawHint').textContent =
      `已点 ${currentPts.length} 个点` + (currentPts.length >= 3 ? '，可点「完成当前楼栋」' : '，继续点击');
  }

  function finishBuilding() {
    if (currentPts.length < 3) return;
    const floors = parseInt(document.getElementById('defFloors').value, 10) || 30;
    const floorHeight = parseFloat(document.getElementById('defFloorH').value) || 3;
    const units = parseInt(document.getElementById('defUnits').value, 10) || 4;
    const id = 'b' + Date.now().toString(36);
    const name = buildings.length + 1 + '号楼';
    const latlngs = currentPts.map((p) => L.latLng(p.lat, p.lng));
    const poly = L.polygon(latlngs, {
      color: '#198754',
      weight: 2,
      fillOpacity: 0.25,
    }).addTo(map);
    poly.bindTooltip(name);
    buildings.push({ id, name, floors, floorHeight, units, latlngs, layer: poly });
    if (currentLine) {
      map.removeLayer(currentLine);
      currentLine = null;
    }
    currentPts = [];
    document.getElementById('btnUndo').disabled = true;
    document.getElementById('btnFinish').disabled = true;
    document.getElementById('drawHint').textContent = '楼栋已添加。可继续描下一栋，或导出。';
    renderList();
  }

  function renderList() {
    buildingList.innerHTML = buildings
      .map(
        (b) => `<li>
        <span>${b.name} · ${b.floors}层 · ${b.units}户/层</span>
        <button type="button" data-del="${b.id}">删除</button>
      </li>`,
      )
      .join('');
    const undoB = document.getElementById('btnUndoBuilding');
    if (undoB) undoB.disabled = buildings.length == 0;
  }

  function buildExportPayload() {
    if (!buildings.length) {
      alert('请先描至少一栋楼');
      return null;
    }
    const lat = parseFloat(latInput.value);
    const lon = parseFloat(lonInput.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      alert('请填写有效经纬度');
      return null;
    }
    const origin = L.latLng(lat, lon);
    const shapes = buildings.map((b) => {
      const meters = b.latlngs.map((p) => latLngToMeters(p, origin));
      let sx = 0;
      let sy = 0;
      meters.forEach((p) => {
        sx += p.x;
        sy += p.y;
      });
      const center = { x: round2(sx / meters.length), y: round2(sy / meters.length) };
      return {
        name: b.name,
        floors: b.floors,
        floorHeight: b.floorHeight,
        units: b.units,
        totalHeight: b.floors * b.floorHeight,
        isThisCommunity: true,
        shape: meters.map((p) => ({ x: round2(p.x), y: round2(p.y) })),
        center,
      };
    });

    const exportData = {
      version: CONFIG?.APP?.VERSION ?? 3.2,
      latitude: lat,
      longitude: lon,
      timeZone: DEFAULT_TZ,
      northAngle: 0,
      scaleRatio: 1,
      origin: { x: 0, y: 0 },
      buildings: shapes,
    };

    const normalized = Utils.normalizeBuildingData(exportData);
    if (!normalized.valid) {
      alert(normalized.errors.slice(0, 6).join('\n'));
      return null;
    }
    return normalized.data;
  }

  function bindOverlayInteract() {
    overlayBox.addEventListener('pointerdown', (e) => {
      if (!overlay.selected || e.button != 0) return;
      e.preventDefault();
      e.stopPropagation();
      const handle = e.target.getAttribute('data-handle');
      const rect = mapEl.getBoundingClientRect();
      const pt = L.point(e.clientX - rect.left, e.clientY - rect.top);
      if (handle == 'rot') {
        const c = overlayCenterPoint();
        interact = {
          mode: 'rot',
          startAngle: Math.atan2(pt.y - c.y, pt.x - c.x),
          baseRot: overlay.rotation,
        };
      } else if (handle) {
        interact = {
          mode: 'scale',
          startDist: Math.max(8, pt.distanceTo(overlayCenterPoint())),
          baseWidth: overlay.widthMeters,
        };
      } else {
        interact = {
          mode: 'move',
          startPt: pt,
          baseLat: overlay.lat,
          baseLng: overlay.lng,
        };
      }
      overlayBox.setPointerCapture(e.pointerId);
    });

    overlayBox.addEventListener('pointermove', (e) => {
      if (!interact) return;
      const rect = mapEl.getBoundingClientRect();
      const pt = L.point(e.clientX - rect.left, e.clientY - rect.top);
      if (interact.mode == 'move') {
        const start = map.containerPointToLatLng(interact.startPt);
        const now = map.containerPointToLatLng(pt);
        overlay.lat = interact.baseLat + (now.lat - start.lat);
        overlay.lng = interact.baseLng + (now.lng - start.lng);
      } else if (interact.mode == 'scale') {
        const dist = Math.max(8, pt.distanceTo(overlayCenterPoint()));
        const ratio = dist / interact.startDist;
        overlay.widthMeters = Math.max(10, Math.min(5000, interact.baseWidth * ratio));
      } else if (interact.mode == 'rot') {
        const c = overlayCenterPoint();
        const ang = Math.atan2(pt.y - c.y, pt.x - c.x);
        const deg = ((ang - interact.startAngle) * 180) / Math.PI;
        overlay.rotation = interact.baseRot + deg;
      }
      syncOverlayTransform();
    });

    overlayBox.addEventListener('pointerup', () => {
      interact = null;
    });
    overlayBox.addEventListener('pointercancel', () => {
      interact = null;
    });
  }

  function bindUi() {
    document.getElementById('basemapSelect').addEventListener('change', (e) => {
      setBasemap(e.target.value);
    });

    document.getElementById('btnLocate').addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('浏览器不支持定位');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          latInput.value = pos.coords.latitude;
          lonInput.value = pos.coords.longitude;
          map.setView([pos.coords.latitude, pos.coords.longitude], 18);
          syncOverlayTransform();
        },
        () => alert('定位失败'),
      );
    });

    document.getElementById('btnFly').addEventListener('click', () => {
      const lat = parseFloat(latInput.value);
      const lon = parseFloat(lonInput.value);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      map.setView([lat, lon], Math.max(map.getZoom(), 17));
      syncOverlayTransform();
    });

    document.getElementById('overlayFile').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) setOverlayImage(file);
      e.target.value = '';
    });

    document.getElementById('overlayOpacity').addEventListener('input', (e) => {
      overlay.opacity = Number(e.target.value) / 100;
      document.getElementById('opacityVal').textContent = e.target.value + '%';
      syncOverlayTransform();
    });

    document.getElementById('btnClearOverlay').addEventListener('click', clearOverlay);

    // 精细移动按钮
    document.getElementById('overlayFine').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-nudge]');
      if (!btn) return;
      const step = parseFloat(document.getElementById('nudgeStep').value) || 0.5;
      nudgeOverlay(btn.getAttribute('data-nudge'), step);
    });

    document.getElementById('btnScaleDown').addEventListener('click', () => {
      setOverlayWidth(overlay.widthMeters - 1);
    });
    document.getElementById('btnScaleUp').addEventListener('click', () => {
      setOverlayWidth(overlay.widthMeters + 1);
    });
    document.getElementById('overlayWidthM').addEventListener('change', (e) => {
      setOverlayWidth(e.target.value);
    });

    document.getElementById('btnRotLeft').addEventListener('click', () => {
      setOverlayRotation(overlay.rotation - 1);
    });
    document.getElementById('btnRotRight').addEventListener('click', () => {
      setOverlayRotation(overlay.rotation + 1);
    });
    document.getElementById('overlayRot').addEventListener('change', (e) => {
      setOverlayRotation(e.target.value);
    });

    // 方向键微调（输入框聚焦时不拦截）
    window.addEventListener('keydown', (e) => {
      if (!overlayOn || !overlay.selected) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag == 'INPUT' || tag == 'TEXTAREA' || tag == 'SELECT') return;
      const mapKey = {
        ArrowUp: 'n',
        ArrowDown: 's',
        ArrowLeft: 'w',
        ArrowRight: 'e',
      };
      const dir = mapKey[e.key];
      if (!dir) return;
      e.preventDefault();
      const step = parseFloat(document.getElementById('nudgeStep').value) || 0.5;
      // Shift = 10 倍步长，便于粗调
      nudgeOverlay(dir, e.shiftKey ? step * 10 : step);
    });

    document.getElementById('btnDraw').addEventListener('click', () => {
      drawMode = !drawMode;
      // 描楼时强制取消设计图选中，点击可穿透到地图
      if (drawMode) setSelected(false);
      document.getElementById('btnDraw').classList.toggle('on', drawMode);
      document.getElementById('btnDraw').textContent = drawMode ? '描楼中…(再点退出)' : '开始描楼';
      document.getElementById('drawHint').textContent = drawMode
        ? '描楼中：可直接在设计图上点击描点；退出描楼后再点图可对齐设计图'
        : '点击「开始描楼」后，在地图上依次点击轮廓点';
    });

    document.getElementById('btnUndo').addEventListener('click', () => {
      currentPts.pop();
      if (currentLine) map.removeLayer(currentLine);
      currentLine = null;
      if (currentPts.length >= 2) {
        currentLine = L.polyline(currentPts, { color: '#0d6efd', weight: 3 }).addTo(map);
      } else if (currentPts.length == 1) {
        currentLine = L.circleMarker(currentPts[0], { radius: 5, color: '#0d6efd' }).addTo(map);
      }
      document.getElementById('btnUndo').disabled = currentPts.length == 0;
      document.getElementById('btnFinish').disabled = currentPts.length < 3;
    });

    document.getElementById('btnFinish').addEventListener('click', finishBuilding);

    document.getElementById('btnUndoBuilding').addEventListener('click', () => {
      if (!buildings.length) return;
      const last = buildings.pop();
      if (last?.layer) map.removeLayer(last.layer);
      renderList();
      document.getElementById('drawHint').textContent = buildings.length
        ? '已撤销上一栋，可继续描楼或导出。'
        : '已清空楼栋，请重新描楼。';
    });

    buildingList.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-del');
      if (!id) return;
      const idx = buildings.findIndex((b) => b.id == id);
      if (idx < 0) return;
      map.removeLayer(buildings[idx].layer);
      buildings.splice(idx, 1);
      renderList();
    });

    document.getElementById('btnExport').addEventListener('click', () => {
      const data = buildExportPayload();
      if (!data) return;
      Utils.downloadFile(JSON.stringify(data, null, 2), 'buildings_config.json', 'application/json');
      window.QING_BS?.saveProject?.(data);
    });

    document.getElementById('btnCache').addEventListener('click', () => {
      const data = buildExportPayload();
      if (!data) return;
      window.QING_BS?.saveProject?.(data);
      location.href = '/building-sunlight/';
    });

    bindOverlayInteract();
  }

  initMap();
  initCities();
  bindUi();
})();
