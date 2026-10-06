import { MAX_FOLDS } from './model';

/** Whole-bundle mechanics schematic. The footprint halves along alternating
 * material axes; closure is followed by a rigid quarter turn. A uniform √2
 * footprint zoom is spread over each cycle, never a one-axis stretch/reset.
 * Layer thickness is compressed continuously for readability; the separate
 * metre-scale guide in the SAME scene carries the true mathematical thickness.
 */
export type Point = readonly [number, number, number];
export type ScreenPoint = readonly [number, number];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * t * (t * (t * 6 - 15) + 10); };
export const DETAIL_MAX_BANDS = 12;
export const DETAIL_FOLD_END = .68;
export const DETAIL_MAX_THICKNESS = 30;
/** Screen-space schematic only, independent of the physical metre-scale camera.
 * The first few folds build a readable edge; a gentle continuing increase makes
 * later bundles visibly thicker too. Keep a finite budget through the entire
 * journey instead of cancelling all growth after the third fold.
 */
export function detailThickness(fold: number): number {
  const n = Math.min(MAX_FOLDS, Math.max(0, Number.isFinite(fold) ? fold : 0));
  return 2.5 + 7.5 * (1 - 2 ** (-n / 3)) + (DETAIL_MAX_THICKNESS - 10) * n / MAX_FOLDS;
}
export interface FoldGeometry {
  fold: number; phase: number; angle: number; rotation: number; zoom: number; axis: 'x' | 'y';
  thickness: number; nextThickness: number; bands: number;
  layerWeights?: { bands: number; alpha: number }[];
  outline: Point[]; backOutline: Point[]; seams: Point[][]; backSeams: Point[][];
  movingBottom: Point; movingTop: Point;
  point: (x: number, y: number, z: number) => Point;
  sheet: (fraction: number, back?: boolean) => Point[];
  crease: Point[];
}
export function foldGeometry(exponent: number, halfWidth: number): FoldGeometry {
  const safe = Math.max(0, Number.isFinite(exponent) ? exponent : 0);
  const fold = Math.floor(safe), phase = safe - fold;
  const closed = smooth(phase / DETAIL_FOLD_END);
  const angle = Math.PI * closed;
  const rotation = Math.PI / 2 * smooth((phase - DETAIL_FOLD_END) / (1 - DETAIL_FOLD_END));
  const zoom = 2 ** (closed / 2);
  const nextThickness = detailThickness(fold + 1);
  // This is a layer-group display scale, not a physical change to paper. The
  // normalization happens during the bend; the closed bundle rotates rigidly.
  const thickness = detailThickness(fold) * (nextThickness / (2 * detailThickness(fold))) ** closed;
  const t = thickness / zoom, depth = Math.SQRT2 * halfWidth;
  const bands = Math.min(DETAIL_MAX_BANDS, 2 ** Math.min(4, fold));
  const point = (x: number, y: number, z: number): Point => {
    const cx = x + halfWidth / 2 * closed;
    const c = Math.cos(rotation), s = Math.sin(rotation);
    return [(cx * c + y * s) * zoom, (y * c - cx * s) * zoom, z * zoom];
  };
  const moving = (x: number, y: number, z: number): Point => point(
    x * Math.cos(angle) + (t - z) * Math.sin(angle), y,
    t + x * Math.sin(angle) + (z - t) * Math.cos(angle),
  );
  const sheet = (fraction: number, back = false): Point[] => {
    const z = fraction * t, radius = t - z, y = (back ? 1 : -1) * depth / 2;
    const points: Point[] = [point(-halfWidth, y, z), point(0, y, z)];
    for (let i = 1; i <= 16; i++) {
      const a = angle * i / 16;
      points.push(point(radius * Math.sin(a) * (1 - closed ** 8), y, t - radius * Math.cos(a)));
    }
    points.push(moving(halfWidth, y, z));
    return points;
  };
  const outline = [...sheet(0), ...sheet(1).reverse()];
  const backOutline = [...sheet(0, true), ...sheet(1, true).reverse()];
  const seamFractions = Array.from({ length: bands - 1 }, (_, i) => (i + 1) / bands);
  // The next crease is a material trace across the folded top. As the bundle
  // turns toward the viewer it visibly becomes the next front-to-back hinge.
  const crease = [moving(halfWidth, 0, 0), point(0, 0, 2 * t)];
  return { fold, phase, angle, rotation, zoom, axis: fold % 2 ? 'y' : 'x', thickness, nextThickness, bands,
    outline, backOutline, seams: seamFractions.map(f => sheet(f)), backSeams: seamFractions.map(f => sheet(f, true)),
    point, sheet, crease, movingBottom: moving(halfWidth, -depth / 2, 0), movingTop: moving(halfWidth, -depth / 2, t) };
}

/** A jump changes scale without replaying dozens of folds. Interruptions begin
 * at the exact visible mesh, including a paused bend or a halfway quarter turn. */
export function interpolateFoldGeometry(from: FoldGeometry, to: FoldGeometry, amount: number): FoldGeometry {
  const t = clamp(amount), mix = (a: Point, b: Point): Point => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  const sheet = (fraction: number, back = false) => { const dest = to.sheet(fraction, back); return from.sheet(fraction, back).map((p,i) => mix(p,dest[i])); };
  if(t===0)return from;
  if(t===1)return to;
  const bands = Math.max(from.bands,to.bands);
  const weights=new Map<number,number>();
  for(const group of from.layerWeights??[{bands:from.bands,alpha:1}])weights.set(group.bands,(weights.get(group.bands)??0)+group.alpha*(1-t));
  for(const group of to.layerWeights??[{bands:to.bands,alpha:1}])weights.set(group.bands,(weights.get(group.bands)??0)+group.alpha*t);
  const layerWeights=[...weights].map(([bands,alpha])=>({bands,alpha}));
  return { ...to, fold:from.fold, bands, layerWeights, nextThickness:from.nextThickness+(to.nextThickness-from.nextThickness)*t, phase:from.phase*(1-t), angle:from.angle*(1-t), rotation:from.rotation*(1-t),
    outline:from.outline.map((p,i)=>mix(p,to.outline[i])), backOutline:from.backOutline.map((p,i)=>mix(p,to.backOutline[i])),
    seams:Array.from({length:bands-1},(_,i)=>sheet((i+1)/bands)), backSeams:Array.from({length:bands-1},(_,i)=>sheet((i+1)/bands,true)),
    point:(x,y,z)=>mix(from.point(x,y,z),to.point(x,y,z)), sheet,
    crease:from.crease.map((p,i)=>mix(p,to.crease[i])), movingBottom:mix(from.movingBottom,to.movingBottom), movingTop:mix(from.movingTop,to.movingTop) };
}

/** One fixed isometric view. The camera does not rotate to fake a paper turn. */
export function projectPoint([x,y,z]: Point): ScreenPoint { return [.9*x+.44*y, .22*x-.45*y-.87*z]; }
export function drawStackFold(ctx: CanvasRenderingContext2D, cx: number, floor: number, half: number, geometry: FoldGeometry): void {
  const project = (p: Point): ScreenPoint => { const [x,y]=projectPoint(p);return [cx+x,floor+y]; };
  const path = (points: readonly ScreenPoint[], close = true) => {
    ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath();
  };
  const shadow=ctx.createRadialGradient(cx,floor+4,0,cx,floor+4,half*1.5);
  shadow.addColorStop(0,'#e0b87628');shadow.addColorStop(1,'#e0b87600');
  ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(cx,floor+4,half*1.45,half*.38,0,0,Math.PI*2);ctx.fill();
  // Collapse only geometrically degenerate outline vertices. At closure the
  // inner top sheet retraces the middle seam; keeping that zero-area loop would
  // create sixteen coincident wall slivers and visible texture resets.
  const indices=geometry.outline.map((_,i)=>i);
  const distance3=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  let changed=true;
  while(changed&&indices.length>3){
    changed=false;
    for(let i=0;i<indices.length;i++){
      const a=geometry.outline[indices[(i+indices.length-1)%indices.length]],b=geometry.outline[indices[i]],c=geometry.outline[indices[(i+1)%indices.length]];
      const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-b[0],c[1]-b[1],c[2]-b[2]];
      const cross=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
      if(distance3(a,b)<1e-8||distance3(b,c)<1e-8||cross<1e-8){indices.splice(i,1);changed=true;break;}
    }
  }
  const outline=indices.map(i=>geometry.outline[i]),backOutline=indices.map(i=>geometry.backOutline[i]);
  type Face = { points: Point[]; color: string; seams?: {points:Point[];alpha:number}[] };
  const weights=geometry.layerWeights??[{bands:geometry.bands,alpha:1}];
  const capSeams=(back=false)=>[...weights.flatMap(({bands,alpha})=>Array.from({length:bands-1},(_,i)=>({points:geometry.sheet((i+1)/bands,back),alpha}))),{points:geometry.sheet(1,back),alpha:smooth(geometry.angle/.3)}];
  const faces: Face[] = [
    {points:outline,color:'#c4a779',seams:capSeams()},
    {points:[...backOutline].reverse(),color:'#a9906a',seams:capSeams(true)},
  ];
  for(let i=0;i<outline.length;i++){
    const next=(i+1)%outline.length;
    const points=[outline[i],backOutline[i],backOutline[next],outline[next]];
    const a=points[0],b=points[1],c=points[2];
    const normal=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];
    if(Math.hypot(...normal)<1e-8)continue;
    const light=Math.abs(normal[2])/Math.hypot(...normal);
    const ends=[0,geometry.sheet(0).length-1];
    const endFace=ends.some(j=>distance3(points[0],geometry.sheet(0)[j])+distance3(points[3],geometry.sheet(1)[j])<1e-6||distance3(points[3],geometry.sheet(0)[j])+distance3(points[0],geometry.sheet(1)[j])<1e-6);
    const seams = endFace ? weights.flatMap(({bands,alpha})=>Array.from({length:bands-1},(_,j)=>{
      const f=(j+1)/bands;
      const mix=(a:Point,b:Point):Point=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];
      return {points:[mix(points[0],points[3]),mix(points[1],points[2])],alpha};
    })) : undefined;
    faces.push({points,color:light>.65?'#eedbb6':light>.25?'#ddc49a':'#b4976d',seams});
  }
  const distance=(points:Point[])=>points.reduce((v,[x,y,z])=>v-.3828*x+.783*y-.5018*z,0)/points.length;
  faces.sort((a,b)=>distance(b.points)-distance(a.points));
  for(const face of faces){
    // Cull outward faces pointing away from the fixed camera. Average-depth
    // sorting alone lets a far end cap paint a spurious raised lip after a turn.
    const normal=[0,0,0];
    for(let i=0;i<face.points.length;i++){const a=face.points[i],b=face.points[(i+1)%face.points.length];normal[0]+=(a[1]-b[1])*(a[2]+b[2]);normal[1]+=(a[2]-b[2])*(a[0]+b[0]);normal[2]+=(a[0]-b[0])*(a[1]+b[1]);}
    if(normal[0]*.3828-normal[1]*.783+normal[2]*.5018<=1e-8)continue;
    const points=face.points.map(project);path(points);
    const norm=Math.hypot(...normal),nz=Math.abs(normal[2]/norm);
    // World-space light remains the same across the material-axis rebase.
    const light=Math.max(0,(-.35*normal[0]-.55*normal[1]+.76*Math.abs(normal[2]))/norm);
    ctx.fillStyle=nz>.65?'#eedbb6':`rgb(${Math.round(158+51*light)},${Math.round(127+49*light)},${Math.round(85+39*light)})`;ctx.fill();
    // Hairline edges define a connected bundle without thick triangulation seams.
    ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=1;ctx.stroke();
    const regroup=smooth((geometry.angle/Math.PI-.97)/.03);
    ctx.save();path(points);ctx.clip();ctx.strokeStyle='#6b52377a';ctx.lineWidth=.65;
    for(const seam of face.seams??[]){ctx.globalAlpha=(1-regroup)*seam.alpha;path(seam.points.map(project),false);ctx.stroke();}
    // As the bundle finishes closing, turn its sampled layer groups into the
    // next bundle's evenly spaced bands on EVERY exposed side. The next turn
    // cannot reveal a blank edge, and the integer rebase cannot add extra seams.
    if(regroup>0 && nz<.65){
      ctx.globalAlpha=regroup;
      const bands=Math.min(DETAIL_MAX_BANDS,2**Math.min(4,geometry.fold+1));
      for(let j=1;j<bands;j++){
        const z=geometry.nextThickness*j/bands,intersections:Point[]=[];
        for(let i=0;i<face.points.length;i++){
          const a=face.points[i],b=face.points[(i+1)%face.points.length];
          if((a[2]<=z&&b[2]>z)||(b[2]<=z&&a[2]>z)){const f=(z-a[2])/(b[2]-a[2]);intersections.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,z]);}
        }
        if(intersections.length>=2){let pair=[intersections[0],intersections[1]],distance=0;for(const a of intersections)for(const b of intersections){const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d>distance){pair=[a,b];distance=d;}}path(pair.map(project),false);ctx.stroke();}
      }
    }
    ctx.restore();
  }
  // A crease in the material makes the quarter turn legible even after a full
  // square/symmetric footprint would otherwise look identical at its endpoints.
  const creaseOpacity=geometry.phase>=DETAIL_FOLD_END?1:smooth((geometry.phase-.46)/.22);
  if(creaseOpacity>0){ctx.save();ctx.globalAlpha=.5*creaseOpacity;ctx.strokeStyle='#806442';ctx.lineWidth=.8;ctx.setLineDash([3,3]);path([...geometry.crease].reverse().map(project),false);ctx.stroke();ctx.restore();}
  if(geometry.phase<.2){
    const front=geometry.sheet(1)[1],back=geometry.sheet(1,true)[1];
    ctx.save();ctx.globalAlpha=.5*(1-smooth(geometry.phase/.2));ctx.strokeStyle='#806442';ctx.lineWidth=.8;ctx.setLineDash([3,3]);path([project(front),project(back)],false);ctx.stroke();ctx.restore();
  }
}
