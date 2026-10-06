/** A close-up of the ENTIRE stack, independent of the physical scale comparison.
 * The hinge joins every existing layer. After closing, the close-up continuously
 * reframes the new bundle; its width, thickness and sampled bands are schematic.
 */
export type Point = readonly [number, number]; // horizontal position, height
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const DETAIL_MAX_BANDS = 16;
export const DETAIL_FOLD_END = .76;
export function detailThickness(fold: number): number { return Math.min(22, 2.75 * 2 ** Math.min(3, Math.max(0, fold))); }
export interface FoldGeometry {
  fold: number; phase: number; angle: number; reframe: number;
  thickness: number; nextThickness: number; bands: number;
  outline: Point[]; seams: Point[][]; endSeams: Point[][];
  /** Both edges of the moving half, used to verify whole-stack rotation. */
  movingBottom: Point; movingTop: Point;
  point: (x: number, z: number) => Point;
  sheet: (fraction: number) => Point[];
}
export function foldGeometry(exponent: number, halfWidth: number): FoldGeometry {
  const safe = Math.max(0, Number.isFinite(exponent) ? exponent : 0);
  const fold = Math.floor(safe), phase = safe - fold;
  const angle = Math.PI * smooth(phase / DETAIL_FOLD_END);
  const reframe = smooth((phase - DETAIL_FOLD_END) / (1 - DETAIL_FOLD_END));
  const thickness = detailThickness(fold), nextThickness = detailThickness(fold + 1);
  const bands = Math.min(DETAIL_MAX_BANDS, 2 ** Math.min(4, fold));
  const scaleX = 1 + reframe, scaleZ = 1 + reframe * (nextThickness / (2 * thickness) - 1);
  const point = (x: number, z: number): Point => [x * scaleX + halfWidth * reframe, z * scaleZ];
  const moving = (x: number, z: number): Point => point(
    x * Math.cos(angle) + (thickness - z) * Math.sin(angle),
    thickness + x * Math.sin(angle) + (z - thickness) * Math.cos(angle),
  );
  const sheet = (fraction: number): Point[] => {
    const z = fraction * thickness, radius = thickness - z;
    const points: Point[] = [point(-halfWidth, z), point(0, z)];
    // All layers share this continuous bend. The rounded spine is simplified
    // continuously during reframing, never detached from either half.
    for (let i = 1; i <= 20; i++) {
      const a = angle * i / 20;
      points.push(point(radius * Math.sin(a) * (1 - reframe), thickness - radius * Math.cos(a)));
    }
    points.push(moving(halfWidth, z));
    return points;
  };
  const outline = [...sheet(0), ...sheet(1).reverse()];
  const seams = Array.from({ length: bands - 1 }, (_, i) => sheet((i + 1) / bands));
  const nextBands = Math.min(DETAIL_MAX_BANDS, bands * 2);
  const endSeams = Array.from({ length: nextBands - 1 }, (_, i): Point[] => [
    [-halfWidth, nextThickness * (i + 1) / nextBands], [halfWidth, nextThickness * (i + 1) / nextBands],
  ]);
  return { fold, phase, angle, reframe, thickness, nextThickness, bands, outline, seams, endSeams, point, sheet,
    movingBottom: moving(halfWidth, 0), movingTop: moving(halfWidth, thickness) };
}

/** Interrupted/scrubbed journeys morph from the actual visible mesh to the new
 * resting stack. They never replay dozens of folds in a single short camera move. */
export function interpolateFoldGeometry(from: FoldGeometry, to: FoldGeometry, amount: number): FoldGeometry {
  const t=clamp(amount), mix=(a: Point,b: Point): Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const sheet=(fraction: number)=>{ const destination=to.sheet(fraction);return from.sheet(fraction).map((p,i)=>mix(p,destination[i])); };
  const bands=Math.max(from.bands,to.bands);
  return {...to, phase:from.phase*(1-t), angle:from.angle*(1-t), reframe:0,
    outline:from.outline.map((p,i)=>mix(p,to.outline[i])),
    seams:Array.from({length:bands-1},(_,i)=>sheet((i+1)/bands)), endSeams:[],
    point:(x,z)=>mix(from.point(x,z),to.point(x,z)),sheet,
    movingBottom:mix(from.movingBottom,to.movingBottom),movingTop:mix(from.movingTop,to.movingTop)};
}

export function drawStackFold(ctx: CanvasRenderingContext2D, width: number, height: number, exponent: number, pose?: (half: number) => FoldGeometry): FoldGeometry {
  const half = Math.min(100, Math.max(48, width * .27));
  const geometry = pose ? pose(half) : foldGeometry(exponent, half);
  const { outline, reframe, angle } = geometry;
  const depthX = Math.min(25, width * .065), depthY = 25;
  const cx = width / 2 - depthX / 2, floor = height - 27;
  const project = ([x,z]: Point, back = 0): Point => [cx + x + back * depthX, floor - z - back * depthY];
  const path = (points: readonly Point[], close = true) => {
    ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); if (close) ctx.closePath();
  };
  ctx.clearRect(0,0,width,height);
  const shadow = ctx.createRadialGradient(cx,floor+3,0,cx,floor+3,half*1.3);
  shadow.addColorStop(0,'#e0b87624');shadow.addColorStop(1,'#e0b87600');
  ctx.fillStyle=shadow;ctx.beginPath();ctx.ellipse(cx,floor+3,half*1.3,13,0,0,Math.PI*2);ctx.fill();
  // Extrude the whole connected cross-section, including both thick halves.
  path(outline.map(p=>project(p,1)));ctx.fillStyle='#a38861';ctx.fill();
  const edges=outline.map((p,i)=>({p,q:outline[(i+1)%outline.length]})).sort((a,b)=>(a.p[1]+a.q[1])-(b.p[1]+b.q[1]));
  for(const {p,q} of edges){
    path([project(p),project(p,1),project(q,1),project(q)]);
    ctx.fillStyle=q[0]>p[0]?'#bca078':'#eee0be';ctx.fill();
  }
  const front=ctx.createLinearGradient(cx,floor-70,cx,floor);
  front.addColorStop(0,'#ead6ad');front.addColorStop(1,'#bd9c6c');
  path(outline.map(p=>project(p)));ctx.fillStyle=front;ctx.fill();
  ctx.strokeStyle='#f3dfb999';ctx.lineWidth=.8;ctx.stroke();
  ctx.save();path(outline.map(p=>project(p)));ctx.clip();
  const seamFade=smooth((reframe-.55)/.45);
  ctx.strokeStyle='#735839';ctx.lineWidth=.8;ctx.globalAlpha=.68*(1-seamFade);
  for(const seam of geometry.seams){path(seam.map(p=>project(p)),false);ctx.stroke();}
  // The original top sheet becomes the middle seam of the doubled stack.
  if(angle>0){path(geometry.sheet(1).map(p=>project(p)),false);ctx.stroke();}
  ctx.globalAlpha=.68*seamFade;
  for(const seam of geometry.endSeams){path(seam.map(p=>project(p)),false);ctx.stroke();}
  ctx.restore();
  // Dashed crease runs through the full bundle, rather than a decorative leaf.
  if(geometry.phase<.3){
    const hinge=project(geometry.point(0,geometry.thickness));
    ctx.save();ctx.globalAlpha=.5*(1-smooth(geometry.phase/.3));ctx.strokeStyle='#8d704b';ctx.lineWidth=1;ctx.setLineDash([3,3]);
    path([hinge,[hinge[0]+depthX,hinge[1]-depthY]],false);ctx.stroke();ctx.restore();
  }
  return geometry;
}
