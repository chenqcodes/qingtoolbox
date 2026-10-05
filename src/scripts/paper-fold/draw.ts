import { REFERENCES, formatLength, niceScale, type Reference } from './model';

export interface SceneState { exponent: number; thicknessMm: number; logView: number; foldPhase: number; reducedMotion: boolean }
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
function drawSun(ctx: CanvasRenderingContext2D, x: number, bottom: number, diameter: number) {
  const r=diameter/2,y=bottom-r;
  ctx.save();const glow=ctx.createRadialGradient(x,y,r*.65,x,y,r*1.55);glow.addColorStop(0,'#e5a74545');glow.addColorStop(.6,'#f3b76020');glow.addColorStop(1,'#ffaf5100');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r*1.55,0,Math.PI*2);ctx.fill();
  const body=ctx.createRadialGradient(x-r*.3,y-r*.35,r*.1,x,y,r);body.addColorStop(0,'#fff1b2');body.addColorStop(.6,'#f3cd72');body.addColorStop(1,'#c88943');ctx.fillStyle=body;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(x,y,r*.99,0,Math.PI*2);ctx.clip();for(let i=0;i<44;i++){const angle=i*2.399963,rad=r*Math.sqrt((i+.5)/44);ctx.fillStyle=i%3?'#a6683220':'#fff4c033';ctx.beginPath();ctx.ellipse(x+Math.cos(angle)*rad,y+Math.sin(angle)*rad,r*.04,r*.014,angle,0,Math.PI*2);ctx.fill();}ctx.restore();ctx.restore();
}
function drawSolar(ctx: CanvasRenderingContext2D, x: number, bottom: number, diameter: number) {
  // Face-on orbit diameters are to scale; planet markers are deliberately enlarged.
  const r=diameter/2,y=bottom-r;
  ctx.save();ctx.strokeStyle='#7696ad';ctx.lineWidth=.8;
  const fractions=[1/30,5.2/30,9.54/30,19.2/30,1];
  fractions.forEach((f,i)=>{ctx.globalAlpha*=.86;ctx.beginPath();ctx.arc(x,y,r*f,0,Math.PI*2);ctx.stroke();const a=[2,4.4,3.5,5.2,.6][i];ctx.fillStyle=['#9db9ac','#cbb791','#c9c0a7','#91bcc1','#799bc7'][i];ctx.beginPath();ctx.arc(x+Math.cos(a)*r*f,y+Math.sin(a)*r*f,clamp(diameter*.014,1.5,4),0,Math.PI*2);ctx.fill();});
  ctx.globalAlpha=1;const glow=ctx.createRadialGradient(x,y,0,x,y,15);glow.addColorStop(0,'#edca8b99');glow.addColorStop(1,'#edca8b00');ctx.fillStyle=glow;ctx.fillRect(x-15,y-15,30,30);ctx.fillStyle='#efd4a0';ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawReference(ctx: CanvasRenderingContext2D, ref: Reference, x: number, baseline: number, height: number) {
  if(ref.kind==='person')drawPerson(ctx,x,baseline,height);
  if(ref.kind==='house')drawHouse(ctx,x,baseline,height);
  if(ref.kind==='earth')drawEarth(ctx,x,baseline,height);
  if(ref.kind==='sun')drawSun(ctx,x,baseline,height);
  if(ref.kind==='solar')drawSolar(ctx,x,baseline,height);
}
export function drawScene(ctx: CanvasRenderingContext2D, width: number, height: number, state: SceneState): void {
  const mobile=width<540, baseline=height-(mobile?196:160), top=155, area=baseline-top;
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
  // All reference heights use this one linear pixels/metre scale.
  let visible=0;
  for(const ref of [...REFERENCES].reverse()){
    const ph=ref.metres*pixelsPerMetre;
    if(ph<1.5||ph>area*12)continue;
    const fadeIn=clamp(Math.log2(ph/1.5)/2,0,1),fadeOut=clamp(Math.log2(area*12/ph)/3,0,1);
    const alpha=fadeIn*fadeOut;if(alpha<.03)continue;
    visible=Math.max(visible,alpha);
    const x=width*(ref.id==='person'?.63:ref.id==='house'?.79:.72);
    ctx.save();ctx.beginPath();ctx.rect(width*.47,149,width*.53,baseline-125);ctx.clip();ctx.globalAlpha=alpha;
    drawReference(ctx,ref,x,baseline,ph);
    ctx.restore();
    if(ph>20&&ph<area*1.35){ctx.save();ctx.globalAlpha=alpha;label(ctx,ref.name,x,baseline+21,ref.color,'center',mobile?9:11);if(ph>45)label(ctx,formatLength(ref.metres),x,baseline+36,'#839da8','center',9);if(ph<area*.95&&ref.kind!=='person'&&ref.kind!=='house')measure(ctx,x+ph*.55+9,baseline,ph,ref.dimension,ref.color,top);ctx.restore();}
  }
  const next=REFERENCES.find(ref=>ref.metres>thickness)??REFERENCES[REFERENCES.length-1];
  if(visible<.75){ctx.save();ctx.globalAlpha=(1-visible)*.85;const nx=width*.73,ny=top+area*.45;ctx.strokeStyle='#a4b7bd38';ctx.setLineDash([2,5]);ctx.beginPath();ctx.arc(nx,ny,25,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);label(ctx,thickness>next.metres?'已越过海王星轨道':'下一站',nx,ny-42,'#869ea9','center',10);label(ctx,thickness>next.metres?'继续向星际深处':next.name,nx,ny+53,'#b9c7cb','center',mobile?11:13);label(ctx,thickness>next.metres?'模型仍是同一个 × 2':formatLength(next.metres),nx,ny+72,'#a3b3bb','center',10);ctx.fillStyle='#d0b98b';ctx.beginPath();ctx.arc(nx,ny,2,0,Math.PI*2);ctx.fill();ctx.restore();}
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
  // An opening/closing top leaf provides a readable fold without inventing layer detail.
  const lift=state.reducedMotion?0:Math.sin(Math.PI*state.foldPhase)*Math.min(42,area*.23);
  if(lift>.25&&state.exponent<16){const flap=pw*.48*Math.cos(state.foldPhase*Math.PI);ctx.fillStyle='#f5e7c7';path(ctx,[[px,sy],[px+slant,sy-depth],[px+slant+flap,sy-depth-lift],[px+flap,sy-lift]]);ctx.fill();ctx.strokeStyle='#b59c7066';ctx.stroke();}
  measure(ctx,px-pw/2-17,baseline,stackHeight,formatLength(thickness),'#dfbf8e',top-20);
  label(ctx,'纸叠 · 厚度',px+slant*.4,baseline+22,'#d6bc94','center',mobile?9:11);
  ctx.restore();
  // A live ruler is the persistent visual anchor during every camera transition.
  const rulerMetres=niceScale(2**state.logView*.3),rulerPixels=rulerMetres*pixelsPerMetre;
  const rx=width-(mobile?20:34),ry=top+9;
  ctx.save();ctx.strokeStyle='#8096a577';ctx.lineWidth=1;line(ctx,rx,ry,rx,ry+rulerPixels);line(ctx,rx-5,ry,rx+1,ry);line(ctx,rx-5,ry+rulerPixels,rx+1,ry+rulerPixels);ctx.translate(rx-9,ry+rulerPixels/2);ctx.rotate(-Math.PI/2);label(ctx,formatLength(rulerMetres),0,0,'#8da3ae','center',9);ctx.restore();
}
