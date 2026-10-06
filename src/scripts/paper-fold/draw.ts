import { formatLength, niceScale } from './model';
import { projectedReferences, type JourneyReference } from './references';

export interface SceneState { exponent: number; thicknessMm: number; logView: number }
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
export function viewLog(exponent: number, thicknessMm: number): number {
  return Math.log2(thicknessMm / 1000) + Math.max(6, exponent + .65);
}
function path(ctx: CanvasRenderingContext2D, points: number[][], close = true) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (close) ctx.closePath();
}
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = '#acbbc1', align: CanvasTextAlign = 'center', size = 10) {
  ctx.font = `${size}px system-ui, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y);
}
function measure(ctx: CanvasRenderingContext2D, x: number, bottom: number, height: number, text: string, color: string, topLimit: number) {
  if (height < 9 || height > bottom - topLimit) return;
  const top = bottom - height;
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha *= .7;
  line(ctx, x, top, x, bottom); line(ctx, x - 4, top, x + 4, top); line(ctx, x - 4, bottom, x + 4, bottom);
  ctx.save(); ctx.translate(x - 10, bottom - height / 2); ctx.rotate(-Math.PI / 2); label(ctx, text, 0, 0, color, 'center', 9); ctx.restore();
}
function drawPerson(ctx: CanvasRenderingContext2D, x: number, bottom: number, h: number) {
  ctx.save(); ctx.translate(x, bottom); ctx.scale(h / 170, h / 170);
  ctx.fillStyle = '#9cc9c8'; ctx.strokeStyle = '#9cc9c8';
  ctx.beginPath(); ctx.arc(0, -160, 10, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(ctx, [[-20,-93],[-15,-137],[15,-137],[22,-94]], false); ctx.stroke();
  path(ctx,[[-11,-134],[-9,-87],[9,-87],[11,-134]]); ctx.fill();
  ctx.lineWidth = 12; path(ctx, [[-1,-91],[-12,-49],[-15,-6]], false); ctx.stroke(); path(ctx, [[3,-91],[12,-48],[17,-6]], false); ctx.stroke();
  ctx.restore();
}
function drawHouse(ctx: CanvasRenderingContext2D, x: number, bottom: number, h: number) {
  ctx.save(); ctx.translate(x, bottom); ctx.scale(h / 100, h / 100);
  ctx.fillStyle = '#53777d'; ctx.strokeStyle = '#a5c4c5'; ctx.lineWidth = .5;
  path(ctx,[[-31,0],[-31,-69],[1,-100],[34,-70],[34,0]]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#304e57'; path(ctx,[[1,-100],[47,-80],[47,-11],[34,0],[34,-70]]); ctx.fill();
  ctx.fillStyle = '#c6c5a1'; for (const y of [-60,-40,-20]) for(const wx of [-22,-3,16]) ctx.fillRect(wx,y,8,11);
  ctx.fillStyle = '#1b3541'; ctx.fillRect(-5,-18,12,18); ctx.strokeStyle = '#a5c4c588'; line(ctx,-34,-69,1,-100);line(ctx,1,-100,38,-68);
  ctx.restore();
}
function drawEarth(ctx: CanvasRenderingContext2D, x: number, bottom: number, diameter: number) {
  const r = diameter / 2, y = bottom - r;
  ctx.save();
  const halo = ctx.createRadialGradient(x,y,r*.82,x,y,r*1.06); halo.addColorStop(0,'#5cacd500'); halo.addColorStop(.78,'#5daecc33'); halo.addColorStop(1,'#5daecc00');
  ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,r*1.06,0,Math.PI*2);ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
  const sea = ctx.createLinearGradient(x-r,y-r,x+r,y+r); sea.addColorStop(0,'#529ca5');sea.addColorStop(.55,'#235570');sea.addColorStop(1,'#102735');ctx.fillStyle=sea;ctx.fillRect(x-r,y-r,diameter,diameter);
  ctx.translate(x,y);ctx.scale(r,r);
  ctx.fillStyle='#94b1a0';path(ctx,[[-.8,-.56],[-.54,-.7],[-.4,-.53],[-.12,-.59],[.04,-.4],[-.16,-.12],[-.36,-.06],[-.33,.19],[-.52,.08],[-.64,-.18],[-.85,-.22]]);ctx.fill();
  ctx.fillStyle='#789c89';path(ctx,[[-.25,.15],[-.04,.16],[.14,.39],[.02,.64],[-.22,.86],[-.34,.6],[-.39,.35]]);ctx.fill();
  ctx.fillStyle='#84a99a';path(ctx,[[.3,-.7],[.72,-.62],[.96,-.32],[.76,-.11],[.81,.2],[.51,.29],[.35,.04],[.16,-.02],[.2,-.26],[.05,-.4]]);ctx.fill();
  ctx.fillStyle='#d1e2d9aa';path(ctx,[[-.39,-.85],[-.15,-1],[.18,-.98],[.37,-.87],[.12,-.81],[-.05,-.84]]);ctx.fill();
  ctx.strokeStyle='#e1f2eb70';ctx.lineWidth=.026;ctx.lineCap='round';ctx.beginPath();ctx.ellipse(-.15,-.34,.54,.1,-.2,.1,2.5);ctx.stroke();ctx.beginPath();ctx.ellipse(.1,.4,.7,.09,-.25,3.2,5.5);ctx.stroke();
  const shade=ctx.createLinearGradient(-1,0,1,0);shade.addColorStop(0,'#00152100');shade.addColorStop(.5,'#00152100');shade.addColorStop(1,'#001521b0');ctx.fillStyle=shade;ctx.fillRect(-1,-1,2,2);
  ctx.restore();
}
function drawSun(ctx: CanvasRenderingContext2D, x: number, bottom: number, diameter: number, color = '#f3cd72') {
  const r=diameter/2,y=bottom-r;
  ctx.save();const glow=ctx.createRadialGradient(x,y,r*.65,x,y,r*1.55);glow.addColorStop(0,`${color}45`);glow.addColorStop(.6,`${color}20`);glow.addColorStop(1,`${color}00`);ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r*1.55,0,Math.PI*2);ctx.fill();
  const body=ctx.createRadialGradient(x-r*.3,y-r*.35,r*.1,x,y,r);body.addColorStop(0,'#fff1b2');body.addColorStop(.6,color);body.addColorStop(1,`${color}a0`);ctx.fillStyle=body;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(x,y,r*.99,0,Math.PI*2);ctx.clip();for(let i=0;i<44;i++){const angle=i*2.399963,rad=r*Math.sqrt((i+.5)/44);ctx.fillStyle=i%3?'#a6683220':'#fff4c033';ctx.beginPath();ctx.ellipse(x+Math.cos(angle)*rad,y+Math.sin(angle)*rad,r*.04,r*.014,angle,0,Math.PI*2);ctx.fill();}ctx.restore();ctx.restore();
}
function drawSolar(ctx: CanvasRenderingContext2D, x: number, bottom: number, diameter: number, jupiter = false) {
  // Face-on orbit diameters are to scale; planet markers are deliberately enlarged.
  const r=diameter/2,y=bottom-r;
  ctx.save();ctx.strokeStyle='#7696ad';ctx.lineWidth=.8;
  const fractions=jupiter?[1/5.2,1]:[1/30,5.2/30,9.54/30,19.2/30,1];
  const initialAlpha=ctx.globalAlpha;
  fractions.forEach((f,i)=>{ctx.globalAlpha*=.86;ctx.beginPath();ctx.arc(x,y,r*f,0,Math.PI*2);ctx.stroke();const a=[2,4.4,3.5,5.2,.6][i];ctx.fillStyle=['#9db9ac','#cbb791','#c9c0a7','#91bcc1','#799bc7'][i];ctx.beginPath();ctx.arc(x+Math.cos(a)*r*f,y+Math.sin(a)*r*f,clamp(diameter*.014,1.5,4),0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha=initialAlpha;const glow=ctx.createRadialGradient(x,y,0,x,y,15);glow.addColorStop(0,'#edca8b99');glow.addColorStop(1,'#edca8b00');ctx.fillStyle=glow;ctx.fillRect(x-15,y-15,30,30);ctx.fillStyle='#efd4a0';ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawReference(ctx: CanvasRenderingContext2D, ref: JourneyReference, x: number, baseline: number, height: number) {
  if (ref.kind === 'person') return drawPerson(ctx, x, baseline, height);
  if (ref.kind === 'house') return drawHouse(ctx, x, baseline, height);
  if (ref.kind === 'earth') return drawEarth(ctx, x, baseline, height);
  if (ref.kind === 'sun' || ref.kind === 'star') return drawSun(ctx, x, baseline, height, ref.kind === 'star' ? ref.color : undefined);
  if (ref.kind === 'solar') return drawSolar(ctx, x, baseline, height, ref.id === 'jupiter-orbit');
  ctx.save(); ctx.translate(x, baseline); ctx.scale(height / 100, height / 100);
  ctx.fillStyle = ref.color; ctx.strokeStyle = ref.color; ctx.lineWidth = 1;
  if (ref.kind === 'hair') {
    // Cross-section: vertical diameter, not the length of a strand.
    const body = ctx.createRadialGradient(-14, -66, 1, 0, -50, 50);
    body.addColorStop(0, '#c0a280'); body.addColorStop(1, '#6a4d37');
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, -50, 50, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d3bc9666'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(0, -50, 8 + i * 6, 0, Math.PI * 2); ctx.stroke(); }
  } else if (ref.kind === 'card') {
    ctx.fillRect(-85, -100, 170, 100); ctx.fillStyle = '#779d90'; ctx.fillRect(-85, -84, 170, 12);
    ctx.fillStyle = '#d1ddc9'; ctx.fillRect(-85, -10, 170, 10);
  } else if (ref.kind === 'grain') {
    ctx.fillStyle = '#e6dcc0'; ctx.beginPath(); ctx.ellipse(0, -50, 17, 50, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a99a7c'; path(ctx, [[-3,-91], [1,-53], [-2,-13]], false); ctx.stroke();
  } else if (ref.kind === 'ball') {
    ctx.beginPath(); ctx.arc(0, -50, 50, 0, Math.PI * 2); ctx.fill(); ctx.clip();
    ctx.strokeStyle = '#f0ead0'; ctx.lineWidth = 3; for (const cx of [-54,54]) { ctx.beginPath(); ctx.ellipse(cx, -50, 32, 56, 0, 0, Math.PI * 2); ctx.stroke(); }
  } else if (ref.kind === 'book') {
    ctx.fillRect(-32, -100, 64, 100); ctx.fillStyle = '#d8d3bb'; ctx.fillRect(-27, -96, 56, 91);
    ctx.fillStyle = '#537f88'; path(ctx, [[-32,0],[-32,-100],[18,-92],[18,0]]); ctx.fill();
    ctx.strokeStyle = '#b5c6bf'; line(ctx, -20,-72,7,-68); line(ctx,-20,-65,7,-61);
  } else if (ref.kind === 'building' || ref.kind === 'tower') {
    if (ref.kind === 'building') ctx.fillRect(-23, -100, 46, 100);
    else { path(ctx, [[-19,0],[-19,-34],[-13,-34],[-13,-57],[-8,-57],[-8,-75],[-3,-75],[-3,-91],[0,-100],[3,-78],[8,-78],[8,-51],[14,-51],[14,0]]); ctx.fill(); }
    ctx.strokeStyle = '#25404e'; ctx.lineWidth = .8;
    for (let y = -6; y > -99; y -= 5) line(ctx, ref.kind === 'tower' ? -7 : -21, y, ref.kind === 'tower' ? 7 : 21, y);
  } else if (ref.kind === 'mountain') {
    ctx.fillStyle = '#6d8b91'; path(ctx, [[-82,0],[-43,-44],[-26,-38],[0,-100],[28,-55],[44,-59],[84,0]]); ctx.fill();
    ctx.fillStyle = '#415f6a'; path(ctx, [[0,-100],[10,-28],[84,0],[28,-55]]); ctx.fill();
    ctx.fillStyle = '#d0dfdc'; path(ctx, [[0,-100],[-18,-57],[-6,-66],[3,-53],[11,-64],[23,-61]]); ctx.fill();
    ctx.strokeStyle = '#82bdd0'; line(ctx,-90,0,90,0);
  } else if (ref.kind === 'moon' || ref.kind === 'jupiter') {
    ctx.beginPath(); ctx.arc(0,-50,50,0,Math.PI*2); ctx.clip();
    const body = ctx.createLinearGradient(-50,-80,50,-30); body.addColorStop(0,ref.color); body.addColorStop(1,ref.kind === 'moon' ? '#596570' : '#75635c'); ctx.fillStyle=body;ctx.fillRect(-50,-100,100,100);
    if (ref.kind === 'moon') {
      for (const [cx,cy,r] of [[-20,-70,12],[19,-46,17],[-13,-24,8],[11,-87,7]]) { ctx.fillStyle='#5c6a7550';ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e8ece833';ctx.stroke(); }
    } else {
      for (let i=0;i<9;i++) {ctx.fillStyle=i%2?'#f1dec560':'#8d615244';ctx.fillRect(-50,-94+i*11,100,5+i%3);}
      ctx.fillStyle='#b97860';ctx.beginPath();ctx.ellipse(18,-35,13,6,-.12,0,Math.PI*2);ctx.fill();
    }
  } else if (ref.kind === 'nebula') {
    // Diffuse extent, not a hard solid sphere; all cloud marks stay in this span.
    for (let i=0;i<9;i++) {
      const a=i*2.4, r=20+8*(i%3), cx=Math.cos(a)*16, cy=-50+Math.sin(a)*22;
      const cloud=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
      cloud.addColorStop(0,`${ref.color}85`);cloud.addColorStop(1,`${ref.color}00`);
      ctx.fillStyle=cloud;ctx.fillRect(cx-r,cy-r,r*2,r*2);
    }
  } else if (ref.kind === 'cluster') {
    for(let i=0;i<90;i++) {const a=i*2.399963,r=49*Math.sqrt((i+.5)/90);ctx.fillStyle=i%3?ref.color:'#fff0d9';ctx.beginPath();ctx.arc(Math.cos(a)*r,-50+Math.sin(a)*r,i%7===0?1.3:.7,0,Math.PI*2);ctx.fill();}
  } else if (ref.kind === 'supercluster' || ref.kind === 'universe') {
    // A cosmic web schematic. Dashed observable extent is not a physical wall.
    const nodes=Array.from({length:35},(_,i)=>{const a=i*2.399963,r=47*Math.sqrt((i+.5)/35);return [Math.cos(a)*r,-50+Math.sin(a)*r];});
    ctx.lineWidth=.65;ctx.strokeStyle=`${ref.color}55`;
    for(let i=1;i<nodes.length;i++) {const [x1,y1]=nodes[i], [x2,y2]=nodes[Math.max(0,i-5)];if(Math.hypot(x1-x2,y1-y2)<40)line(ctx,x1,y1,x2,y2);}
    for(const [nx,ny] of nodes) {ctx.fillStyle=ref.color;ctx.beginPath();ctx.ellipse(nx,ny,1.8,.9,-.4,0,Math.PI*2);ctx.fill();}
    if(ref.kind==='universe'){ctx.setLineDash([2,3]);ctx.strokeStyle=`${ref.color}bb`;ctx.lineWidth=.8;ctx.beginPath();ctx.arc(0,-50,50,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  } else if (ref.kind === 'galaxy') {
    const glow=ctx.createRadialGradient(0,-50,0,0,-50,50);glow.addColorStop(0,'#f6dfb6');glow.addColorStop(.22,'#e2cdd480');glow.addColorStop(1,'#a5ace500');ctx.fillStyle=glow;ctx.fillRect(-50,-100,100,100);
    if(ref.id === 'small-magellanic') {
      for(let i=0;i<65;i++){const a=i*2.399963,r=49*Math.sqrt((i+.5)/65);ctx.fillStyle=i%3?'#a8bddb80':'#ead8c8';ctx.beginPath();ctx.arc(Math.cos(a)*r*(.55+.3*Math.sin(a*3)),-50+Math.sin(a)*r,.9,0,Math.PI*2);ctx.fill();}
    } else for(let arm=0;arm<3;arm++){ctx.beginPath();for(let t=0;t<100;t++){const r=t*.5,a=t*.047+arm*Math.PI*2/3;const px=Math.cos(a)*r,py=-50+Math.sin(a)*r;t?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.strokeStyle='#cac2df80';ctx.lineWidth=2;ctx.stroke();}
  } else {
    // Distances use a vertical measured segment. Endpoint glyph sizes are schematic.
    ctx.lineWidth = Math.min(3, 180 / height); ctx.setLineDash([4,4]); line(ctx,0,-100,0,0); ctx.setLineDash([]);
    line(ctx,-13,-100,13,-100); line(ctx,-13,0,13,0);
    const beam=ctx.createLinearGradient(-10,0,10,0);beam.addColorStop(0,'#99b8dc00');beam.addColorStop(.5,'#b7c8e344');beam.addColorStop(1,'#99b8dc00');ctx.fillStyle=beam;ctx.fillRect(-10,-100,20,100);
    ctx.fillStyle=ref.color;ctx.beginPath();ctx.arc(0,-50,3,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, state: SceneState): void {
  const mobile=width<540, baseline=height-60, top=155, area=baseline-top;
  const pixelsPerMetre=area/2**state.logView;
  const thickness=state.thicknessMm/1000*2**state.exponent;
  const stackHeight=Math.max(.6,thickness*pixelsPerMetre);
  const space=clamp((state.logView-15)/15,0,1);
  ctx.clearRect(0,0,width,height);
  const background=ctx.createLinearGradient(0,0,width,height);background.addColorStop(0,'#12232d');background.addColorStop(.6,'#101c28');background.addColorStop(1,'#0d1723');ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
  const light=ctx.createRadialGradient(width*.29,baseline,0,width*.35,baseline,width*.7);light.addColorStop(0,`rgba(135,133,97,${.12-space*.06})`);light.addColorStop(1,'#14263100');ctx.fillStyle=light;ctx.fillRect(0,120,width,height-120);
  // Deterministic stars make paused frames stable, with no ambient animation.
  for(let i=0;i<100;i++){const sx=((i*719+113)%1009)/1009*width,sy=140+((i*317+71)%557)/557*(baseline-120);const alpha=(.025+space*.27)*(i%4===0?1:.4);ctx.fillStyle=`rgba(193,215,223,${alpha})`;ctx.fillRect(sx,sy,i%9===0?1.5:1, i%9===0?1.5:1);}
  ctx.save();ctx.beginPath();ctx.rect(0,148,width,baseline-120);ctx.clip();
  ctx.strokeStyle='#60768220';ctx.lineWidth=.6;
  for(let i=0;i<8;i++){const y=baseline+8+i*i*1.25;line(ctx,0,y,width,y);}
  for(let i=-6;i<=6;i++)line(ctx,width*.5+i*30,baseline,width*.5+i*160,baseline+150);
  ctx.restore();
  ctx.strokeStyle='#73919935';ctx.lineWidth=.8;line(ctx,mobile?18:30,baseline,width-(mobile?18:30),baseline);
  // Physical guide rings continually recede with the camera, including the long
  // gap between buildings and planets. Powers of two keep the grid continuous.
  ctx.save();ctx.beginPath();ctx.rect(0,150,width,baseline-149);ctx.clip();
  const guidePower=Math.floor(state.logView), guideX=width*(mobile?.275:.30);
  for(let k=-4;k<=2;k++){
    const radius=2**(guidePower+k)*pixelsPerMetre;
    const opacity=clamp(radius/35,0,1)*clamp((area*3-radius)/(area*2),0,1)*.11;
    if(opacity<=0)continue;
    ctx.strokeStyle=`rgba(142,171,180,${opacity})`;ctx.lineWidth=.65;ctx.setLineDash([2,6]);
    ctx.beginPath();ctx.arc(guideX,baseline,radius,Math.PI,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
  // Dense references share the paper's exact linear pixels/metre scale. Alternate
  // lanes keep neighbouring silhouettes separate while their opacity crossfades.
  const references = projectedReferences(state.logView, area, thickness);
  const primary = references.filter(item => item.pixels <= area * 1.15)
    .sort((a,b) => b.pixels - a.pixels)[0] ?? references[0];
  for (const item of [...references].sort((a,b) => b.pixels - a.pixels)) {
    const { reference: ref, pixels: ph, opacity: alpha, index } = item;
    // Keep each object's lane fixed when it changes from next to previous.
    const preferredX = width * (index % 2 ? .78 : .60);
    // Keep a fitting disc inside the comparison bay rather than cutting off its
    // left edge merely because it inherited the smaller object's lane.
    const x = ph <= width * .48 ? clamp(preferredX, width * .47 + ph / 2, width * .95 - ph / 2) : width * .71;
    ctx.save(); ctx.beginPath(); ctx.rect(width*.47,149,width*.48,baseline-148); ctx.clip(); ctx.globalAlpha=alpha;
    drawReference(ctx,ref,x,baseline,ph); ctx.restore();
    if (item === primary) {
      // One readable label at all sizes; full measurement details stay in the rail.
      const labelX = width * .71;
      label(ctx,ref.name,labelX,baseline+21,ref.color,'center',mobile?9:12);
      label(ctx,formatLength(ref.metres),labelX,baseline+36,'#a7bbc5','center',10);
    }
  }
  // The side's height is physical; width/depth are schematic, never volume claims.
  const px=width*(mobile?.275:.30),pw=mobile?84:132,depth=mobile?13:21,slant=mobile?15:25,sy=baseline-stackHeight;
  ctx.save();
  const shadow=ctx.createRadialGradient(px,baseline+4,0,px,baseline+4,pw*.85);shadow.addColorStop(0,'#d3b37720');shadow.addColorStop(1,'#d3b37700');ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(px,baseline+3,pw*.85,18,0,0,Math.PI*2);ctx.fill();
  const side=ctx.createLinearGradient(px-pw/2,sy,px+pw/2,baseline);side.addColorStop(0,'#e3c59b');side.addColorStop(.4,'#c7a875');side.addColorStop(1,'#a1845e');
  ctx.fillStyle=side;ctx.fillRect(px-pw/2,sy,pw,stackHeight);
  ctx.fillStyle='#a08867';path(ctx,[[px+pw/2,sy],[px+pw/2+slant,sy-depth],[px+pw/2+slant,baseline-depth],[px+pw/2,baseline]]);ctx.fill();
  ctx.save();ctx.beginPath();ctx.rect(px-pw/2,sy,pw,stackHeight);ctx.clip();
  const nLines=Math.min(32,Math.max(0,Math.round(2**Math.min(5,state.exponent))-1));ctx.strokeStyle='#604f343f';ctx.lineWidth=.8;
  for(let i=1;i<=nLines;i++)line(ctx,px-pw/2,sy+stackHeight*i/(nLines+1),px+pw/2,sy+stackHeight*i/(nLines+1));ctx.restore();
  const topColor=ctx.createLinearGradient(px,sy-depth,px,sy);topColor.addColorStop(0,'#f1e2c2');topColor.addColorStop(1,'#e3d3ad');ctx.fillStyle=topColor;
  path(ctx,[[px-pw/2,sy],[px-pw/2+slant,sy-depth],[px+pw/2+slant,sy-depth],[px+pw/2,sy]]);ctx.fill();ctx.strokeStyle='#f3e6c33f';ctx.lineWidth=.7;ctx.stroke();
  measure(ctx,px-pw/2-17,baseline,stackHeight,formatLength(thickness),'#dfbf8e',top-20);
  label(ctx,'纸叠 · 厚度',px+slant*.4,baseline+22,'#d6bc94','center',mobile?9:11);
  ctx.restore();
  // A live ruler is the persistent visual anchor during every camera transition.
  const rulerMetres=niceScale(2**state.logView*.3),rulerPixels=rulerMetres*pixelsPerMetre;
  const rx=width-(mobile?20:34),ry=top+9;
  ctx.save();ctx.strokeStyle='#8096a577';ctx.lineWidth=1;line(ctx,rx,ry,rx,ry+rulerPixels);line(ctx,rx-5,ry,rx+1,ry);line(ctx,rx-5,ry+rulerPixels,rx+1,ry+rulerPixels);ctx.translate(rx-9,ry+rulerPixels/2);ctx.rotate(-Math.PI/2);label(ctx,formatLength(rulerMetres),0,0,'#8da3ae','center',9);ctx.restore();
}
