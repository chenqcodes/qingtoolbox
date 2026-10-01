import * as THREE from 'three';
import { hasWebGL2 } from './runtime';
import { SceneDissolve } from './scene-dissolve';
import { bindExplorer } from './explorer-ui';
import type { SpaceScene } from './scene';
import { createScene } from './scene';
import { BodySystem } from './bodies';
import { StarSystem } from './stars';
import { CometSystem } from './cometSystem';
import { CameraController, formatSpeed } from './camera';
import { Hud, describeFocus, describeStarFocus, type HudState } from './hud';
import { Minimap } from './minimap';
import { BodyLabels } from './labels';
import { ScenePicker } from './pick';
import { BODIES, BODY_BY_ID, type BodyId } from './constants';
import { COMETS, type CometId } from './comets';
import { selfCheckEarthDistance, selfCheckSatellites } from './astronomy';
import { selfCheckStars } from './stars-check';
import { loadSpaceTextures } from './textures';
import type { StarId } from './stars';
import type { ScaleMode } from './scale';

export function bootSpace() {
  const w = window as unknown as { __spaceCleanup?: () => void };
  if (w.__spaceCleanup) w.__spaceCleanup();

  const canvas = document.getElementById('space-canvas') as HTMLCanvasElement | null;
  const hudRoot = document.getElementById('space-hud');
  const miniCanvas = document.getElementById('sp-minimap') as HTMLCanvasElement | null;
  if (!canvas || !hudRoot) return;

  if (!selfCheckEarthDistance() || !selfCheckSatellites()) {
    console.warn('[space] Earth/satellite visual check failed');
  }
  if (!selfCheckStars()) {
    console.warn('[space] nearby-star catalog check failed');
  }

  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state: HudState = {
    simDate: new Date(),
    timeMult: reducedMotion ? 0 : 1,
    mode: 'observe',
    focus: 'earth',
    starFocus: 'sol',
    scaleMode: 'solar',
    speedMult: 1,
    orbits: true,
    info: 'SYS ONLINE',
    speedText: '—',
    touring: false,
  };

  let cam!: CameraController;
  let bodies!: BodySystem;
  let stars!: StarSystem;
  let comets!: CometSystem;
  let camera!: THREE.PerspectiveCamera;
  let minimap: Minimap | null = null;
  let labels: BodyLabels | null = null;
  let sceneReady = false;
  let scenePack: SpaceScene | null = null;
  let dissolve: SceneDissolve | null = null;
  let cleanupExplorer: (() => void) | null = null;
  const resizeMinimap = () => minimap?.resize();
  let raf = 0;
  let dead = false;

  const showFallback = (message?: string) => {
    const fallback = document.getElementById('sp-fallback');
    if (fallback) fallback.hidden = false;
    const text = document.getElementById('sp-fallback-message');
    if (text && message) text.textContent = message;
    hudRoot.hidden = true;
    cleanupExplorer?.();
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    dead = true;
    cancelAnimationFrame(raf);
    dissolve?.clear();
    showFallback('图形上下文已中断。请重新载入页面恢复星图，也可以使用下面的文字与计算工具。');
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const gotoBody = (id: BodyId) => {
    if (!sceneReady) return;
    // 已在看这颗星：再点不跳转
    if (id == cam.focus && cam.mode != 'travel' && !cam.cometFocus && cam.scaleMode === 'solar') return;
    if (cam.mode == 'travel' && cam.travelDomain == 'body' && cam.travelDestId == id) return;
    cam.stopTour();
    state.touring = false;
    cam.travelTo(id);
    state.mode = cam.mode;
    state.focus = cam.travelDestId;
    rebuildInfo();
    hud.render();
  };

  const gotoStar = (id: StarId) => {
    if (!sceneReady) return;
    if (id == cam.starFocus && cam.mode != 'travel' && cam.scaleMode == 'stellar') return;
    if (cam.mode == 'travel' && cam.travelDomain == 'star' && cam.travelDestStar == id && cam.scaleMode == 'stellar') return;
    cam.stopTour();
    state.touring = false;
    cam.travelToStar(id);
    state.mode = cam.mode;
    state.scaleMode = cam.scaleMode;
    state.starFocus = cam.travelDestStar;
    rebuildInfo();
    hud.render();
  };

  const gotoComet = (id: CometId) => {
    if (!sceneReady) return;
    if (cam.cometFocus == id && cam.mode != 'travel') return;
    cam.stopTour();
    state.touring = false;
    cam.travelToComet(id);
    state.mode = cam.mode;
    rebuildInfo();
    hud.render();
  };

  const returnSol = () => {
    if (!sceneReady) return;
    cam.returnToSol();
    state.mode = cam.mode;
    state.scaleMode = cam.scaleMode;
    rebuildInfo();
    hud.render();
  };

  const onScaleChange = (m: ScaleMode) => {
    state.scaleMode = m;
    minimap?.setScaleMode(m);
    hud.render();
  };

  const hud = new Hud(hudRoot, () => state, {
    onGoto: gotoBody,
    onGotoStar: gotoStar,
    onGotoComet: gotoComet,
    onReturnSol: returnSol,
    onTour: () => {
      if (!sceneReady) return;
      cam.toggleTour();
      state.touring = cam.touring;
      state.mode = cam.mode;
      hud.render();
    },
    onFaceSun: () => {
      if (!sceneReady) return;
      cam.faceSun();
      state.mode = cam.mode;
      rebuildInfo();
      hud.render();
    },
    onChange: (patch) => {
      Object.assign(state, patch);
      if (sceneReady) {
        if (patch.mode != null && patch.mode != 'travel' && patch.mode != 'tour' && patch.mode != 'facesun') {
          cam.stopTour();
          state.touring = false;
          cam.setMode(patch.mode);
        }
        if (patch.focus != null) cam.setFocus(patch.focus);
        if (patch.speedMult != null) cam.speedMult = patch.speedMult;
        if (patch.orbits != null) bodies.setOrbitsVisible(patch.orbits);
        if (patch.simDate != null) bodies.updatePositions(state.simDate, true);
      }
      rebuildInfo();
      hud.render();
    },
  });
  hud.render();

  const tmp = new THREE.Vector3();
  const foTarget = new THREE.Vector3();
  const FO_REBASE_SOLAR = 2.2;
  const FO_REBASE_STELLAR = 8;

  function rebaseFloatingOrigin() {
    if (!sceneReady) return;
    if (cam.scaleMode == 'stellar') {
      const fid = cam.mode == 'travel' ? cam.travelDestStar : cam.starFocus;
      stars.getLogicalPos(fid, foTarget);
      const need =
        camera.position.length() > FO_REBASE_STELLAR ||
        stars.floatingOrigin.distanceTo(foTarget) > FO_REBASE_STELLAR;
      if (!need) return;
      const delta = stars.setFloatingOrigin(foTarget);
      cam.applyOriginShift(delta);
      return;
    }

    // 巡航：以相机为原点，可自由穿小行星带
    if (cam.mode == 'fly') {
      foTarget.copy(bodies.floatingOrigin).add(camera.position);
      if (camera.position.length() < FO_REBASE_SOLAR * 0.85) {
        comets.syncOrigin(bodies.floatingOrigin);
        return;
      }
      const delta = bodies.setFloatingOrigin(foTarget);
      comets.syncOrigin(bodies.floatingOrigin);
      cam.applyOriginShift(delta);
      return;
    }

    if (cam.cometFocus || (cam.mode == 'travel' && cam.travelDomain == 'comet')) {
      const cid = cam.mode == 'travel' ? cam.travelDestComet : cam.cometFocus!;
      comets.getLogicalPos(cid, foTarget);
      const need =
        camera.position.length() > FO_REBASE_SOLAR ||
        bodies.floatingOrigin.distanceTo(foTarget) > FO_REBASE_SOLAR;
      if (!need) return;
      const delta = bodies.setFloatingOrigin(foTarget);
      comets.syncOrigin(bodies.floatingOrigin);
      cam.applyOriginShift(delta);
      return;
    }

    const fid = cam.mode == 'travel' ? cam.travelDestId : cam.focus;
    bodies.getLogicalPos(fid, foTarget);
    const need =
      camera.position.length() > FO_REBASE_SOLAR ||
      bodies.floatingOrigin.distanceTo(foTarget) > FO_REBASE_SOLAR;
    if (!need) return;
    const delta = bodies.setFloatingOrigin(foTarget);
    comets.syncOrigin(bodies.floatingOrigin);
    cam.applyOriginShift(delta);
  }

  function rebuildInfo() {
    if (!sceneReady) return;
    if (cam.scaleMode == 'stellar') {
      const sid = cam.mode == 'travel' ? cam.travelDestStar : cam.starFocus;
      const target = stars.getWorldPos(sid, tmp);
      state.info = describeStarFocus(camera.position.distanceTo(target), sid);
      state.speedText = formatSpeed(cam.currentSpeedAu || cam.getAdaptiveSpeedAu(), true);
    } else if (cam.cometFocus || (cam.mode == 'travel' && cam.travelDomain == 'comet')) {
      const cid = cam.mode == 'travel' ? cam.travelDestComet : cam.cometFocus!;
      const def = comets.getDef(cid);
      const target = comets.getWorldPos(cid, tmp);
      state.info = `${def.name} · 沿彗尾视角 · WASD 巡航可自由飞`;
      state.speedText = formatSpeed(cam.currentSpeedAu || cam.getAdaptiveSpeedAu(), false);
      void target;
    } else {
      const fid = cam.mode == 'travel' ? cam.travelDestId : cam.focus;
      const def = BODY_BY_ID[fid];
      const target = bodies.getWorldPos(fid, tmp);
      const flyHint = cam.mode == 'fly' ? ' · 巡航中（WASD 遨游）' : '';
      state.info = describeFocus(cam, camera.position.distanceTo(target), def.name) + flyHint;
      state.speedText = formatSpeed(cam.currentSpeedAu || cam.getAdaptiveSpeedAu(), false);
    }
    state.touring = cam.touring;
    state.scaleMode = cam.scaleMode;
    state.starFocus = cam.starFocus;
    const scaleNote = document.getElementById('sp-scale-note');
    if (scaleNote) scaleNote.textContent = cam.scaleMode === 'stellar'
      ? '星域：距离单位为光年（ly）；恒星大小是可见标记，静态星表不随日期演化'
      : '太阳系：行星位置以 AU 为单位；球体半径、卫星间距经过放大，不可从画面直接量距';
  }

  w.__spaceCleanup = () => {
    dead = true;
    cancelAnimationFrame(raf);
    cleanupExplorer?.();
    dissolve?.clear();
    cam?.dispose();
    scenePack?.dispose();
    window.removeEventListener('resize', resizeMinimap);
    canvas.removeEventListener('webglcontextlost', onContextLost);
  };

  if (!hasWebGL2(canvas)) {
    showFallback();
    return;
  }

  loadSpaceTextures()
    .then((tex) => {
      if (dead) return;
      const pack = createScene(canvas, tex);
      scenePack = pack;
      camera = pack.camera;
      bodies = new BodySystem(pack.scene, tex);
      bodies.attachSunLight(pack.sunLight);
      comets = new CometSystem(pack.scene);
      stars = new StarSystem(pack.scene, tex.sun);
      bodies.updatePositions(state.simDate, true);
      comets.updatePositions(state.simDate);
      dissolve = new SceneDissolve(canvas, () => pack.render());
      cam = new CameraController(camera, canvas, bodies, stars, comets, onScaleChange, () => dissolve?.capture());
      cam.setFocus('earth');
      cam.speedMult = state.speedMult;
      bodies.getLogicalPos('earth', foTarget);
      const d0 = bodies.setFloatingOrigin(foTarget);
      comets.syncOrigin(bodies.floatingOrigin);
      cam.applyOriginShift(d0);
      cam.beginEarthEntryOrbit();
      cam.setReducedMotion(reducedMotion);

      if (miniCanvas) {
        minimap = new Minimap(miniCanvas, bodies, stars, camera);
        minimap.bind(gotoBody, gotoStar);
        minimap.resize();
        window.addEventListener('resize', resizeMinimap);
      }
      labels = new BodyLabels(hudRoot);
      labels.bind(gotoBody, gotoStar, gotoComet);
      new ScenePicker(canvas, camera, () => cam.scaleMode, bodies, stars, gotoBody, gotoStar);

      sceneReady = true;
      const syncNavigation = () => {
        state.mode = cam.mode;
        state.focus = cam.focus;
        state.starFocus = cam.starFocus;
        state.scaleMode = cam.scaleMode;
        state.touring = cam.touring;
        rebuildInfo();
        hud.render();
      };
      cleanupExplorer = bindExplorer(hudRoot, {
        onStop: stop => {
          state.timeMult = 0;
          if (stop.body) cam.navigateToBody(stop.body);
          else if (stop.star) cam.navigateToStar(stop.star);
          syncNavigation();
        },
        onHome: () => { cam.navigateToBody('earth'); syncNavigation(); },
        onReset: () => { cam.resetView(); syncNavigation(); },
        onZoom: factor => { cam.zoomBy(factor); syncNavigation(); },
        onQuality: quality => pack.setQuality(quality),
        onMotion: enabled => {
          reducedMotion = enabled;
          cam.setReducedMotion(enabled);
          if (enabled) { state.timeMult = 0; dissolve?.clear(); }
          const tour = document.getElementById('sp-tour') as HTMLButtonElement | null;
          if (tour) { tour.disabled = enabled; tour.title = enabled ? '减少动态已开启；请使用逐站导览' : ''; }
          syncNavigation();
        },
      }, reducedMotion);
      const tourButton = document.getElementById('sp-tour') as HTMLButtonElement | null;
      if (tourButton) { tourButton.disabled = reducedMotion; tourButton.title = reducedMotion ? '减少动态已开启；请使用逐站导览' : ''; }
      rebuildInfo();
      hud.render();

      let last = performance.now();
      let orbitRebuildAcc = 0;
      let infoAcc = 0;
      let mapAcc = 0;
      const t0 = performance.now();

      function frame(now: number) {
        if (dead) return;
        if (document.hidden) { last = now; raf = requestAnimationFrame(frame); return; }
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = reducedMotion ? 0 : (now - t0) / 1000;

        if (cam.scaleMode == 'solar' && state.timeMult != 0) {
          state.simDate = new Date(state.simDate.getTime() + dt * 1000 * state.timeMult);
          bodies.updatePositions(state.simDate, false);
          comets.updatePositions(state.simDate);
          orbitRebuildAcc += dt;
          const needRebuild =
            (state.timeMult > 1 && orbitRebuildAcc > 2) ||
            (state.timeMult >= 86400 && orbitRebuildAcc > 0.5) ||
            (state.timeMult > 0 && state.timeMult <= 1 && orbitRebuildAcc > 30);
          if (needRebuild) {
            bodies.buildOrbits(state.simDate);
            orbitRebuildAcc = 0;
          }
        }

        if (cam.scaleMode == 'solar') bodies.tick(t, state.simDate);
        else {
          stars.tick(t);
          stars.updateLink(cam.mode == 'travel' ? cam.travelDestStar : cam.starFocus);
        }
        cam.update(dt);
        rebaseFloatingOrigin();
        state.mode = cam.mode;
        state.scaleMode = cam.scaleMode;
        state.focus = cam.mode == 'travel' && cam.scaleMode == 'solar' && cam.travelDomain == 'body'
          ? cam.travelDestId
          : cam.focus;
        state.starFocus = cam.mode == 'travel' && cam.scaleMode == 'stellar' ? cam.travelDestStar : cam.starFocus;
        state.touring = cam.touring;

        // 降频：信息条 / 小地图不必每帧写 DOM
        infoAcc += dt;
        if (infoAcc > 0.2) {
          infoAcc = 0;
          rebuildInfo();
        }
        mapAcc += dt;
        if (mapAcc > 0.1) {
          mapAcc = 0;
          minimap?.setScaleMode(cam.scaleMode);
          minimap?.draw(state.focus, state.starFocus, cam.travelTrail);
        }
        labels?.update(
          bodies,
          stars,
          camera,
          cam.scaleMode,
          state.focus,
          state.starFocus,
          canvas!,
          comets,
          cam.cometFocus,
        );

        if (((now / 250) | 0) != (((now - dt * 1000) / 250) | 0)) hud.render();

        pack.render();
        dissolve?.update(dt);
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      (window as unknown as { __space: unknown }).__space = { bodies, stars, comets, cam, state, BODIES, COMETS };
    })
    .catch((err) => {
      console.error(err);
      state.info = '场景加载失败';
      hud.render();
      showFallback();
    });
}
