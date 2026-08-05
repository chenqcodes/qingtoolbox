/**
 * 模拟页「地图对照」：把本地米制轮廓叠到 OSM 地图上核对位置。
 */
(function () {
  'use strict';

  let map = null;
  let layerGroup = null;

  function metersToLatLng(x, y, lat0, lon0) {
    const mPerDegLat = 111320;
    const mPerDegLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
    return [lat0 + y / mPerDegLat, lon0 + x / mPerDegLon];
  }

  function ensureUi() {
    let modal = document.getElementById('mapPreviewModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'mapPreviewModal';
    modal.className = 'map-preview-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="map-preview-panel">
        <div class="map-preview-head">
          <strong>地图对照</strong>
          <button type="button" id="btnCloseMapPreview" class="map-preview-close" aria-label="关闭">×</button>
        </div>
        <p class="map-preview-hint">根据项目经纬度与轮廓叠在 OpenStreetMap 上，用于核对楼栋位置（只读）。</p>
        <div id="mapPreviewMap" class="map-preview-map"></div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('btnCloseMapPreview').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target == modal) close();
    });
    return modal;
  }

  function close() {
    const modal = document.getElementById('mapPreviewModal');
    if (modal) modal.hidden = true;
  }

  function open(projectData) {
    if (!projectData || !Array.isArray(projectData.buildings) || !projectData.buildings.length) {
      alert('请先导入或加载楼盘数据');
      return;
    }
    if (typeof L == 'undefined') {
      alert('地图库未加载');
      return;
    }

    const modal = ensureUi();
    modal.hidden = false;

    const lat0 = Number(projectData.latitude);
    const lon0 = Number(projectData.longitude);
    if (!Number.isFinite(lat0) || !Number.isFinite(lon0)) {
      alert('项目缺少有效经纬度');
      return;
    }

    const mapEl = document.getElementById('mapPreviewMap');
    if (!map) {
      map = L.map(mapEl, { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      layerGroup = L.layerGroup().addTo(map);
    }

    layerGroup.clearLayers();
    const bounds = [];
    projectData.buildings.forEach((b) => {
      if (!b.shape || b.shape.length < 3) return;
      const latlngs = b.shape.map((p) => metersToLatLng(p.x, p.y, lat0, lon0));
      const poly = L.polygon(latlngs, {
        color: b.isThisCommunity === false ? '#888' : '#0d6efd',
        weight: 2,
        fillOpacity: 0.28,
      });
      poly.bindTooltip(b.name || '楼栋');
      layerGroup.addLayer(poly);
      latlngs.forEach((ll) => bounds.push(ll));
    });

    setTimeout(() => {
      map.invalidateSize();
      if (bounds.length) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 18 });
      else map.setView([lat0, lon0], 16);
    }, 50);
  }

  window.QING_BS = window.QING_BS || {};
  window.QING_BS.openMapPreview = open;
  window.QING_BS.closeMapPreview = close;
})();
