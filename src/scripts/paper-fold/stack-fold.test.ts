import test from 'node:test';
import assert from 'node:assert/strict';
import { DETAIL_FOLD_END, DETAIL_MAX_BANDS, detailThickness, foldGeometry, interpolateFoldGeometry, projectPoint, type FoldGeometry, type Point } from './stack-fold';

const close=(a:number,b:number,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b} (tolerance ${tolerance})`);
const distance=(a:Point,b:Point)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const vertices=(g:FoldGeometry)=>[...g.outline,...g.backOutline];
const span=(points:readonly Point[],axis:number)=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]));
const rotate=([x,y,z]:Point,angle:number):Point=>[x*Math.cos(angle)+y*Math.sin(angle),y*Math.cos(angle)-x*Math.sin(angle),z];

test('every existing layer participates in the fold with the full displayed bundle thickness',()=>{
  for(const n of [0,1,2,3,4,10,50,102,106])for(const phase of [.03,.15,DETAIL_FOLD_END/2,.55,DETAIL_FOLD_END,.8,.95]){
    const g=foldGeometry(n+phase,82);
    close(distance(g.movingBottom,g.movingTop),g.thickness);
    assert.equal(g.seams.length,g.bands-1);assert.equal(g.backSeams.length,g.bands-1);assert.ok(g.bands<=DETAIL_MAX_BANDS);
    for(const back of [false,true])for(const fraction of [0,.125,.25,.5,.75,1]){
      const sheet=g.sheet(fraction,back);assert.equal(sheet.length,g.sheet(0).length);close(sheet[0][2],fraction*g.thickness);
      close(distance(g.sheet(fraction,false).at(-1)!,g.sheet(fraction,true).at(-1)!),Math.SQRT2*82*g.zoom);
    }
    if(phase===DETAIL_FOLD_END/2){close(g.angle,Math.PI/2);close(g.movingBottom[2],g.movingTop[2]);assert.ok(g.movingBottom[0]>g.movingTop[0]);}
  }
});

test('closure halves exactly one footprint axis and doubles the displayed bundle thickness',()=>{
  for(let n=0;n<107;n++){
    const start=foldGeometry(n,82),closed=foldGeometry(n+DETAIL_FOLD_END,82);
    close(closed.angle,Math.PI);close(closed.rotation,0);close(closed.zoom,Math.SQRT2);
    // Divide out uniform camera magnification to measure material dimensions.
    close(span(vertices(closed),0)/closed.zoom,span(vertices(start),0)/2);
    close(span(vertices(closed),1)/closed.zoom,span(vertices(start),1));
    close(span(vertices(closed),2),2*closed.thickness);close(span(vertices(closed),2),detailThickness(n+1));
    close(closed.movingBottom[2],2*closed.thickness);close(closed.movingTop[2],closed.thickness);
    for(const back of [false,true])for(const fraction of [0,.125,.25,.5,.75,1]){
      const sheet=closed.sheet(fraction,back);close(sheet[0][2],fraction*closed.thickness);close(sheet.at(-1)![2],(2-fraction)*closed.thickness);
    }
  }
});

test('original material axes alternate and physical footprint area halves each cycle',()=>{
  const originalX=164,originalY=Math.SQRT2*82;
  for(let n=0;n<=107;n++){
    const g=foldGeometry(n,82),accumulatedZoom=2**(n/2);
    // Undo accumulated zoom, then undo the local-axis rebase following each turn.
    const canonical=[span(vertices(g),0)/accumulatedZoom,span(vertices(g),1)/accumulatedZoom];
    const [materialX,materialY]=n%2?[canonical[1],canonical[0]]:canonical;
    close(materialX/(originalX/2**Math.ceil(n/2)),1);close(materialY/(originalY/2**Math.floor(n/2)),1);
    close(materialX*materialY/(originalX*originalY*2**-n),1);
    assert.equal(g.axis,n%2?'y':'x');
    assert.ok(g.axis==='x'?materialX>materialY:materialY>materialX,'the next fold must halve the remaining long material side');
  }
});

test('the closed bundle turns rigidly with no scaling, stretching or thickness change',()=>{
  for(const n of [0,1,2,3,4,10,50,102,106]){
    const closed=foldGeometry(n+DETAIL_FOLD_END,82),base=vertices(closed);
    for(const phase of [.69,.72,.8,.84,.9,.95,.99999]){
      const g=foldGeometry(n+phase,82);close(g.angle,Math.PI);close(g.zoom,closed.zoom);close(g.thickness,closed.thickness);
      vertices(g).forEach((point,i)=>close(distance(point,rotate(base[i],g.rotation)),0,1e-6));
      for(const back of [false,true])for(const fraction of [0,.25,.5,.75,1])g.sheet(fraction,back).forEach((point,i)=>close(distance(point,rotate(closed.sheet(fraction,back)[i],g.rotation)),0,1e-6));
    }
    close(foldGeometry(n+.99999,82).rotation,Math.PI/2,1e-7);
  }
});

test('integer rebasing preserves the entire solid silhouette and next crease',()=>{
  const directions:Point[]=[];
  for(let az=0;az<16;az++)for(let el=-3;el<=3;el++)directions.push([Math.cos(az*Math.PI/8),Math.sin(az*Math.PI/8),el/3]);
  for(let n=0;n<107;n++){
    const end=foldGeometry(n+1-1e-7,82),next=foldGeometry(n+1,82),begin=foldGeometry(n+1+1e-7,82);
    for(const direction of directions){
      const support=(g:FoldGeometry)=>Math.max(...vertices(g).map(p=>p.reduce((sum,v,i)=>sum+v*direction[i],0)));
      close(support(end),support(next),1e-5);close(support(next),support(begin),1e-5);
    }
    const nextCrease=[next.sheet(1)[1],next.sheet(1,true)[1]];
    for(const p of end.crease)close(Math.min(...nextCrease.map(q=>distance(p,q))),0,1e-5);
  }
});

test('all projected poses stay finite and fit the original comparison bay',()=>{
  for(const width of [272,320,342,390,540,800,1200]){
    const mobile=width<540,half=Math.min(82,width*.125),cx=width*(mobile?.265:.275),gaugeRight=(mobile?24:42)+6;
    for(const n of [0,1,2,3,4,10,50,102,106])for(let tick=0;tick<=100;tick++){
      const g=foldGeometry(n+tick/100,half);
      for(const point of vertices(g)){
        assert.ok(point.every(Number.isFinite));assert.ok(point[2]>=-1e-8,'paper passes below its supporting plane');
        const [x,y]=projectPoint(point);
        assert.ok(cx+x>gaugeRight,`paper intersects thickness guide at ${width}px, fold ${n+tick/100}`);
        assert.ok(cx+x<width*.47,`paper crosses reference bay at ${width}px, fold ${n+tick/100}`);
        assert.ok(y-half*.68<0,`paper passes below common baseline at ${width}px, fold ${n+tick/100}`);
      }
    }
  }
});

test('interrupted bends and turns start at the exact visible mesh and reach the target',()=>{
  for(const source of [0.3,3.43,3.8,10.95,102.84])for(const destination of [0,1,50,103,107]){
    const from=foldGeometry(source,82),to=foldGeometry(destination,82);
    for(const amount of [0,1]){
      const g=interpolateFoldGeometry(from,to,amount),expected=amount===0?from:to;
      for(const key of ['outline','backOutline','crease'] as const)g[key].forEach((p,i)=>close(distance(p,expected[key][i]),0));
      for(const key of ['seams','backSeams'] as const){
        assert.equal(g[key].length,expected[key].length,`${key} count changes at interpolation endpoint ${amount} from ${source} to ${destination}`);
        g[key].forEach((seam,i)=>seam.forEach((p,j)=>close(distance(p,expected[key][i][j]),0)));
      }
      close(distance(g.movingBottom,expected.movingBottom),0);close(distance(g.movingTop,expected.movingTop),0);
      for(const back of [false,true])for(const fraction of [0,.25,.5,.75,1])g.sheet(fraction,back).forEach((p,i)=>close(distance(p,expected.sheet(fraction,back)[i]),0));
    }
    const midpoint=interpolateFoldGeometry(from,to,.5),before=vertices(from),after=vertices(to);
    vertices(midpoint).forEach((p,i)=>close(distance(p,[(before[i][0]+after[i][0])/2,(before[i][1]+after[i][1])/2,(before[i][2]+after[i][2])/2]),0));
  }
});


test('interrupted layer sampling crossfades without losing or duplicating opacity',()=>{
  const weights=(g:FoldGeometry)=>g.layerWeights??[{bands:g.bands,alpha:1}];
  for(const source of [.3,3.8,10.95])for(const destination of [0,50,103]){
    const from=foldGeometry(source,82),to=foldGeometry(destination,82);
    for(const amount of [1e-7,.2,.5,.8,1-1e-7]){
      const g=interpolateFoldGeometry(from,to,amount);
      close(weights(g).reduce((sum,item)=>sum+item.alpha,0),1);
      for(const item of weights(g)){assert.ok(item.alpha>=0&&item.alpha<=1);assert.ok(item.bands>=1&&item.bands<=DETAIL_MAX_BANDS);}
      const first=weights(g)[0],last=weights(g).at(-1)!;
      close(first.alpha,1-amount);close(last.alpha,amount);
      const interrupted=interpolateFoldGeometry(g,foldGeometry(2,82),.4);
      close(weights(interrupted).reduce((sum,item)=>sum+item.alpha,0),1);
      weights(g).forEach((item,i)=>{assert.equal(weights(interrupted)[i].bands,item.bands);close(weights(interrupted)[i].alpha,item.alpha*.6);});
    }
  }
});
