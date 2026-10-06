import test from 'node:test';
import assert from 'node:assert/strict';
import { DETAIL_FOLD_END, DETAIL_MAX_BANDS, detailThickness, foldGeometry, interpolateFoldGeometry } from './stack-fold';
const close=(a:number,b:number,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('the complete moving cross-section rotates, keeping all of the prior thickness',()=>{
  for(const n of [0,1,2,3,10,50,102]) for(const p of [.1,.2,.38,.6,.75]){
    const g=foldGeometry(n+p,90);
    close(Math.hypot(g.movingTop[0]-g.movingBottom[0],g.movingTop[1]-g.movingBottom[1]),g.thickness);
    assert.equal(g.seams.length,Math.min(2**Math.min(n,4),DETAIL_MAX_BANDS)-1);
    if(p===.38){close(g.angle,Math.PI/2);close(g.movingTop[1],g.movingBottom[1]);assert.ok(g.movingBottom[0]>g.movingTop[0]);}
  }
});
test('every layer stays connected along the hinge, and closure doubles bundle thickness',()=>{
  for(const n of [0,1,2,3,10,102]){
    const g=foldGeometry(n+DETAIL_FOLD_END,90);
    close(g.angle,Math.PI);close(g.reframe,0);
    close(g.movingBottom[1],2*g.thickness);close(g.movingTop[1],g.thickness);
    for(let f=0;f<=1;f+=.125){const sheet=g.sheet(f);close(sheet[0][1],f*g.thickness);close(sheet.at(-1)![1],(2-f)*g.thickness);}
  }
});
test('reframing finishes at the next complete bundle without an outline size jump',()=>{
  for(let n=0;n<107;n++){
    const end=foldGeometry(n+1-1e-9,90),next=foldGeometry(n+1,90);
    const bounds=(g:typeof end)=>[Math.min(...g.outline.map(p=>p[0])),Math.max(...g.outline.map(p=>p[0])),Math.min(...g.outline.map(p=>p[1])),Math.max(...g.outline.map(p=>p[1]))];
    bounds(end).forEach((b,i)=>close(b,bounds(next)[i],1e-5));
    close(Math.max(...end.outline.map(p=>p[1])),detailThickness(n+1),1e-5);
  }
});
test('all journey poses fit bounded detail geometry, including high layers and mobile widths',()=>{
  for(const half of [48,64,100]) for(let n=0;n<=107;n+=.03125){
    const g=foldGeometry(n,half);
    assert.ok(g.bands<=DETAIL_MAX_BANDS);
    for(const [x,z]of g.outline){assert.ok(Number.isFinite(x)&&Number.isFinite(z));assert.ok(x>=-half-1e-8&&x<=half+22);assert.ok(z>=-1e-8&&z<=half+44);}
  }
});
test('interrupting into a long journey morph begins at the exact current mesh',()=>{
  const current=foldGeometry(3.43,90),target=foldGeometry(103,90);
  assert.deepEqual(interpolateFoldGeometry(current,target,0).outline,current.outline);
  assert.deepEqual(interpolateFoldGeometry(current,target,1).outline,target.outline);
  const middle=interpolateFoldGeometry(current,target,.5);assert.notDeepEqual(middle.outline,current.outline);assert.notDeepEqual(middle.outline,target.outline);
});
