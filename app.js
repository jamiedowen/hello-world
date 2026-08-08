/* Wurm Unlimited Deed Planner
 * Vanilla JS + canvas. No dependencies, no build step.
 */
(function(){
"use strict";

/* ---------------------------------------------------------------- data ---- */

const TERRAIN_TYPES = [
  {id:0,  name:'Grass',        color:'#5c9e46'},
  {id:1,  name:'Dirt',         color:'#8b6238'},
  {id:2,  name:'Sand',         color:'#d9c98a'},
  {id:3,  name:'Gravel',       color:'#a8a296'},
  {id:4,  name:'Rock / Cliff', color:'#7d7a72'},
  {id:5,  name:'Water',        color:'#3f7fb0'},
  {id:6,  name:'Moss',         color:'#4f7a52'},
  {id:7,  name:'Steppe',       color:'#c2b060'},
  {id:8,  name:'Tundra',       color:'#b9c6c1'},
  {id:9,  name:'Moor',         color:'#5a6a4a'},
  {id:10, name:'Clay',         color:'#b06a4a'},
  {id:11, name:'Farmland',     color:'#7a5a3a'},
  {id:12, name:'Road / Pavement', color:'#9a9a9a'},
  {id:13, name:'Wood Floor',   color:'#b5854f'},
  {id:14, name:'Stone Floor',  color:'#b7b7b7'},
  {id:15, name:'Cave Floor',   color:'#4a4a52'},
];
const DEFAULT_TERRAIN = 0;

// index 0 reserved for "no wall"
const WALL_TYPES = [
  null,
  {id:1,  name:'Wood Wall',    color:'#6b4423', width:5},
  {id:2,  name:'Stone Wall',   color:'#8a8a8a', width:5},
  {id:3,  name:'Wood Fence',   color:'#8a6a3a', width:2, dashed:true},
  {id:4,  name:'Stone Fence',  color:'#9a9a9a', width:3, dashed:true},
  {id:5,  name:'Palisade',     color:'#4a3626', width:4},
  {id:6,  name:'Hedge',        color:'#3f6b30', width:4},
  {id:7,  name:'Rope Fence',   color:'#c9a86a', width:1.5, dashed:true},
  {id:8,  name:'Iron Fence',   color:'#555a5f', width:2},
  {id:9,  name:'Door',         color:'#d98c3a', width:5, opening:true},
  {id:10, name:'Gate',         color:'#3a86d9', width:6, opening:true},
];

const TOOLS = ['terrain','wall','house','deed','marker','erase','pan'];

/* ---------------------------------------------------------------- state --- */

let state = null;           // { w,h, tiles, vWalls, hWalls, deed, markers }
let selTerrain = 0;
let selWall = 1;
let selHouseFloor = 13;
let selHouseWall = 1;
let currentTool = 'terrain';

let view = { zoom:1, panX:0, panY:0 };
const BASE_TILE = 24;

let undoStack = [];
let redoStack = [];
const UNDO_LIMIT = 40;

let drag = null;            // active paint/drag operation
let panDrag = null;         // active pan operation
let hover = { x:-1, y:-1 };
let editingMarkerIndex = -1;

/* --------------------------------------------------------- state helpers -- */

function newState(w, h){
  return {
    w, h,
    tiles: new Uint8Array(w*h).fill(DEFAULT_TERRAIN),
    vWalls: new Uint8Array((w+1)*h),
    hWalls: new Uint8Array(w*(h+1)),
    deed: new Uint8Array(w*h),
    markers: [],
  };
}

function tileIdx(x,y){ return y*state.w + x; }
function vIdx(x,y){ return y*(state.w+1) + x; }        // x in 0..w, y in 0..h-1
function hIdx(x,y){ return y*state.w + x; }             // x in 0..w-1, y in 0..h

function inBounds(x,y){ return x>=0 && y>=0 && x<state.w && y<state.h; }

function resizeState(newW, newH){
  const ns = newState(newW, newH);
  const cw = Math.min(state.w, newW), ch = Math.min(state.h, newH);
  for(let y=0;y<ch;y++){
    for(let x=0;x<cw;x++){
      ns.tiles[y*newW+x] = state.tiles[tileIdx(x,y)];
      ns.deed[y*newW+x] = state.deed[tileIdx(x,y)];
    }
  }
  for(let y=0;y<ch;y++){
    for(let x=0;x<=cw;x++){
      if(x<=newW) ns.vWalls[y*(newW+1)+x] = state.vWalls[vIdx(x,y)];
    }
  }
  for(let y=0;y<=ch;y++){
    for(let x=0;x<cw;x++){
      if(y<=newH) ns.hWalls[y*newW+x] = state.hWalls[hIdx(x,y)];
    }
  }
  ns.markers = state.markers.filter(m=>m.x<newW && m.y<newH).map(m=>({...m}));
  state = ns;
}

/* ---------------------------------------------------------- serialization - */

function serialize(){
  return {
    w: state.w, h: state.h,
    tiles: Array.from(state.tiles),
    vWalls: Array.from(state.vWalls),
    hWalls: Array.from(state.hWalls),
    deed: Array.from(state.deed),
    markers: state.markers,
  };
}

function deserialize(data){
  const ns = newState(data.w, data.h);
  ns.tiles.set(data.tiles);
  ns.vWalls.set(data.vWalls);
  ns.hWalls.set(data.hWalls);
  if(data.deed) ns.deed.set(data.deed);
  ns.markers = Array.isArray(data.markers) ? data.markers.map(m=>({...m})) : [];
  state = ns;
}

/* ------------------------------------------------------------ undo/redo --- */

function pushUndo(){
  undoStack.push(JSON.stringify(serialize()));
  if(undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack = [];
}

function undo(){
  if(!undoStack.length) return;
  redoStack.push(JSON.stringify(serialize()));
  const snap = undoStack.pop();
  deserialize(JSON.parse(snap));
  refreshAll();
}

function redo(){
  if(!redoStack.length) return;
  undoStack.push(JSON.stringify(serialize()));
  const snap = redoStack.pop();
  deserialize(JSON.parse(snap));
  refreshAll();
}

/* ----------------------------------------------------------------- dom ---- */

const canvas = document.getElementById('grid-canvas');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('canvas-wrap');
const markerEditor = document.getElementById('marker-editor');
const markerInput = document.getElementById('markerInput');

/* ------------------------------------------------------------- geometry -- */

function tilePx(){ return BASE_TILE * view.zoom; }

function screenToWorld(sx, sy){
  const tp = tilePx();
  return { x:(sx - view.panX)/tp, y:(sy - view.panY)/tp };
}

function worldToTile(wx, wy){ return { x:Math.floor(wx), y:Math.floor(wy) }; }

function clientToCanvas(evt){
  const r = canvas.getBoundingClientRect();
  return { x: evt.clientX - r.left, y: evt.clientY - r.top };
}

function nearestEdge(wx, wy, tx, ty){
  const fx = wx - tx, fy = wy - ty;
  const dLeft = fx, dRight = 1-fx, dTop = fy, dBottom = 1-fy;
  const m = Math.min(dLeft, dRight, dTop, dBottom);
  if(m === dLeft)   return {kind:'v', x:tx,   y:ty};
  if(m === dRight)  return {kind:'v', x:tx+1, y:ty};
  if(m === dTop)    return {kind:'h', x:tx,   y:ty};
  return {kind:'h', x:tx, y:ty+1};
}

/* ------------------------------------------------------------- resizing --- */

function resizeCanvas(){
  const dpr = window.devicePixelRatio || 1;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  canvas.style.width = w+'px';
  canvas.style.height = h+'px';
  canvas.width = Math.round(w*dpr);
  canvas.height = Math.round(h*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
window.addEventListener('resize', resizeCanvas);

/* ------------------------------------------------------------- rendering -- */

function draw(){
  const w = wrap.clientWidth, h = wrap.clientHeight;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#11130d';
  ctx.fillRect(0,0,w,h);

  const tp = tilePx();
  const x0 = Math.max(0, Math.floor((-view.panX)/tp) - 1);
  const y0 = Math.max(0, Math.floor((-view.panY)/tp) - 1);
  const x1 = Math.min(state.w, Math.ceil((w - view.panX)/tp) + 1);
  const y1 = Math.min(state.h, Math.ceil((h - view.panY)/tp) + 1);

  // terrain
  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      const t = state.tiles[tileIdx(x,y)];
      ctx.fillStyle = TERRAIN_TYPES[t].color;
      const sx = view.panX + x*tp, sy = view.panY + y*tp;
      ctx.fillRect(sx, sy, tp+0.6, tp+0.6);
    }
  }

  // deed overlay fill
  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      if(state.deed[tileIdx(x,y)]){
        const sx = view.panX + x*tp, sy = view.panY + y*tp;
        ctx.fillStyle = 'rgba(201,162,39,0.22)';
        ctx.fillRect(sx, sy, tp+0.6, tp+0.6);
      }
    }
  }

  // grid lines
  if(document.getElementById('toggleGrid').checked && tp >= 6){
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=x0;x<=x1;x++){
      const sx = Math.round(view.panX + x*tp)+0.5;
      ctx.moveTo(sx, Math.max(0,view.panY+y0*tp));
      ctx.lineTo(sx, Math.min(h,view.panY+y1*tp));
    }
    for(let y=y0;y<=y1;y++){
      const sy = Math.round(view.panY + y*tp)+0.5;
      ctx.moveTo(Math.max(0,view.panX+x0*tp), sy);
      ctx.lineTo(Math.min(w,view.panX+x1*tp), sy);
    }
    ctx.stroke();
  }

  // deed boundary (thicker line where inside meets outside)
  ctx.save();
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = Math.max(2, tp*0.09);
  ctx.beginPath();
  for(let y=y0;y<y1;y++){
    for(let x=x0;x<x1;x++){
      const inside = state.deed[tileIdx(x,y)];
      if(!inside) continue;
      const sx = view.panX + x*tp, sy = view.panY + y*tp;
      const leftIn = x>0 && state.deed[tileIdx(x-1,y)];
      const rightIn = x<state.w-1 && state.deed[tileIdx(x+1,y)];
      const upIn = y>0 && state.deed[tileIdx(x,y-1)];
      const downIn = y<state.h-1 && state.deed[tileIdx(x,y+1)];
      if(!leftIn){ ctx.moveTo(sx,sy); ctx.lineTo(sx,sy+tp); }
      if(!rightIn){ ctx.moveTo(sx+tp,sy); ctx.lineTo(sx+tp,sy+tp); }
      if(!upIn){ ctx.moveTo(sx,sy); ctx.lineTo(sx+tp,sy); }
      if(!downIn){ ctx.moveTo(sx,sy+tp); ctx.lineTo(sx+tp,sy+tp); }
    }
  }
  ctx.stroke();
  ctx.restore();

  // coordinates
  if(document.getElementById('toggleCoords').checked && tp >= 22){
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `${Math.min(11,tp*0.28)}px sans-serif`;
    ctx.textBaseline = 'top';
    for(let y=y0;y<y1;y++){
      for(let x=x0;x<x1;x++){
        ctx.fillText(`${x},${y}`, view.panX+x*tp+2, view.panY+y*tp+1);
      }
    }
  }

  // walls: vertical
  const vx0 = Math.max(0,x0), vx1 = Math.min(state.w, x1);
  for(let y=y0;y<y1;y++){
    for(let x=vx0;x<=vx1;x++){
      const wt = state.vWalls[vIdx(x,y)];
      if(!wt) continue;
      drawWallSeg(view.panX + x*tp, view.panY + y*tp, view.panX + x*tp, view.panY + (y+1)*tp, WALL_TYPES[wt]);
    }
  }
  // walls: horizontal
  for(let y=y0;y<=y1;y++){
    for(let x=x0;x<x1;x++){
      const wt = state.hWalls[hIdx(x,y)];
      if(!wt) continue;
      drawWallSeg(view.panX + x*tp, view.panY + y*tp, view.panX + (x+1)*tp, view.panY + y*tp, WALL_TYPES[wt]);
    }
  }

  // markers
  for(const mk of state.markers){
    if(mk.x<x0-1||mk.x>x1||mk.y<y0-1||mk.y>y1) continue;
    const cx = view.panX + (mk.x+0.5)*tp, cy = view.panY + (mk.y+0.5)*tp;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(4,tp*0.22), 0, Math.PI*2);
    ctx.fillStyle = '#d98c3a';
    ctx.fill();
    ctx.strokeStyle = '#1b1e17';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if(tp >= 16){
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(12,tp*0.3)}px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('!', cx, cy+0.5);
      ctx.textAlign = 'left';
      if(mk.label){
        ctx.font = `${Math.min(12,tp*0.3)}px sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        const label = mk.label;
        const tw = ctx.measureText(label).width;
        ctx.fillRect(cx+8, cy-8, tw+6, 16);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, cx+11, cy);
      }
    }
  }

  // hover highlight
  if(hover.x>=0 && inBounds(hover.x,hover.y)){
    const sx = view.panX + hover.x*tp, sy = view.panY + hover.y*tp;
    if(currentTool==='wall' && hover.edge){
      const e = hover.edge;
      const col = WALL_TYPES[selWall].color;
      ctx.save();
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(3, WALL_TYPES[selWall].width * view.zoom + 2);
      ctx.beginPath();
      if(e.kind==='v'){
        ctx.moveTo(view.panX+e.x*tp, view.panY+e.y*tp);
        ctx.lineTo(view.panX+e.x*tp, view.panY+(e.y+1)*tp);
      } else {
        ctx.moveTo(view.panX+e.x*tp, view.panY+e.y*tp);
        ctx.lineTo(view.panX+(e.x+1)*tp, view.panY+e.y*tp);
      }
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx+1, sy+1, tp-2, tp-2);
    }
  }

  // drag preview (house / deed rectangle)
  if(drag && (drag.tool==='house' || drag.tool==='deed') && drag.rectPreview){
    const r = drag.rectPreview;
    const sx = view.panX + r.x0*tp, sy = view.panY + r.y0*tp;
    const ww = (r.x1-r.x0+1)*tp, hh = (r.y1-r.y0+1)*tp;
    ctx.save();
    ctx.strokeStyle = drag.tool==='house' ? '#d98c3a' : '#c9a227';
    ctx.lineWidth = 2;
    ctx.setLineDash([6,4]);
    ctx.strokeRect(sx, sy, ww, hh);
    ctx.restore();
  }

  updateStatus();
}

function drawWallSeg(x1,y1,x2,y2, wt){
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = wt.color;
  ctx.lineWidth = Math.max(1.5, wt.width * view.zoom);
  if(wt.dashed) ctx.setLineDash([Math.max(3,6*view.zoom), Math.max(2,4*view.zoom)]);
  else ctx.setLineDash([]);
  if(wt.opening){
    // draw as two short end-caps with a gap in the middle to suggest an opening
    const mx = (x1+x2)/2, my=(y1+y2)/2;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x1+(mx-x1)*0.35, y1+(my-y1)*0.35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2+(mx-x2)*0.35, y2+(my-y2)*0.35); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = wt.color;
    ctx.lineWidth = Math.max(1, wt.width*view.zoom*0.5);
    ctx.beginPath(); ctx.moveTo(x1+(mx-x1)*0.35,y1+(my-y1)*0.35); ctx.lineTo(x2+(mx-x2)*0.35,y2+(my-y2)*0.35); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
    ctx.stroke();
  }
  ctx.restore();
}

/* -------------------------------------------------------------- painting -- */

function paintTerrain(x,y,val){
  if(!inBounds(x,y)) return false;
  const i = tileIdx(x,y);
  if(state.tiles[i]===val) return false;
  state.tiles[i]=val;
  return true;
}

function paintDeed(x,y,val){
  if(!inBounds(x,y)) return false;
  const i = tileIdx(x,y);
  if(state.deed[i]===val) return false;
  state.deed[i]=val;
  return true;
}

function paintWallAt(edge, val){
  if(edge.kind==='v'){
    if(edge.x<0||edge.x>state.w||edge.y<0||edge.y>=state.h) return false;
    const i = vIdx(edge.x,edge.y);
    if(state.vWalls[i]===val) return false;
    state.vWalls[i]=val;
  } else {
    if(edge.x<0||edge.x>=state.w||edge.y<0||edge.y>state.h) return false;
    const i = hIdx(edge.x,edge.y);
    if(state.hWalls[i]===val) return false;
    state.hWalls[i]=val;
  }
  return true;
}

function stampHouse(x0,y0,x1,y1){
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) paintTerrain(x,y,selHouseFloor);
  for(let y=y0;y<=y1;y++){
    paintWallAt({kind:'v',x:x0,y}, selHouseWall);
    paintWallAt({kind:'v',x:x1+1,y}, selHouseWall);
  }
  for(let x=x0;x<=x1;x++){
    paintWallAt({kind:'h',x,y:y0}, selHouseWall);
    paintWallAt({kind:'h',x,y:y1+1}, selHouseWall);
  }
}

/* -------------------------------------------------------------- markers --- */

function findMarkerAt(x,y){
  return state.markers.findIndex(m=>m.x===x && m.y===y);
}

function openMarkerEditor(x,y,screenPos){
  editingMarkerIndex = findMarkerAt(x,y);
  markerEditor.style.left = screenPos.x+'px';
  markerEditor.style.top = screenPos.y+'px';
  markerEditor.style.display = 'flex';
  markerInput.value = editingMarkerIndex>=0 ? state.markers[editingMarkerIndex].label : '';
  markerInput.dataset.x = x; markerInput.dataset.y = y;
  markerInput.focus();
  markerInput.select();
}

function closeMarkerEditor(){ markerEditor.style.display='none'; editingMarkerIndex=-1; }

document.getElementById('markerSave').onclick = ()=>{
  const label = markerInput.value.trim();
  const x = +markerInput.dataset.x, y = +markerInput.dataset.y;
  pushUndo();
  if(!label){
    if(editingMarkerIndex>=0) state.markers.splice(editingMarkerIndex,1);
  } else if(editingMarkerIndex>=0){
    state.markers[editingMarkerIndex].label = label;
  } else {
    state.markers.push({x,y,label});
  }
  closeMarkerEditor();
  refreshAll();
};
document.getElementById('markerCancel').onclick = ()=>{ closeMarkerEditor(); draw(); };
markerInput.addEventListener('keydown', e=>{
  if(e.key==='Enter') document.getElementById('markerSave').click();
  if(e.key==='Escape') document.getElementById('markerCancel').click();
});

/* ------------------------------------------------------------ pointer io -- */

let spaceDown = false;
window.addEventListener('keydown', e=>{
  if(e.code==='Space'){ spaceDown = true; wrap.style.cursor='grab'; }
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); }
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); }
});
window.addEventListener('keyup', e=>{ if(e.code==='Space'){ spaceDown=false; wrap.style.cursor=''; } });

function isPanTrigger(evt){ return currentTool==='pan' || spaceDown || evt.button===1 || evt.button===2; }

canvas.addEventListener('contextmenu', e=>e.preventDefault());

canvas.addEventListener('mousedown', evt=>{
  closeMarkerEditor();
  const p = clientToCanvas(evt);
  if(isPanTrigger(evt)){
    panDrag = { startX:evt.clientX, startY:evt.clientY, panX0:view.panX, panY0:view.panY };
    return;
  }
  if(evt.button!==0) return;

  const wpt = screenToWorld(p.x,p.y);
  const t = worldToTile(wpt.x,wpt.y);
  if(!inBounds(t.x,t.y)) return;

  if(currentTool==='marker'){
    openMarkerEditor(t.x,t.y,p);
    return;
  }

  pushUndo();

  if(currentTool==='terrain' || currentTool==='erase'){
    const val = currentTool==='erase' ? DEFAULT_TERRAIN : selTerrain;
    const changed = paintTerrain(t.x,t.y,val);
    drag = { tool:currentTool, kind:'terrain', val };
    if(!changed) undoStack.pop(); else draw();
  } else if(currentTool==='wall'){
    const e = nearestEdge(wpt.x,wpt.y,t.x,t.y);
    const cur = e.kind==='v' ? state.vWalls[vIdx(e.x,e.y)] : state.hWalls[hIdx(e.x,e.y)];
    const val = cur===selWall ? 0 : selWall;
    const changed = paintWallAt(e,val);
    drag = { tool:'wall', kind:'wall', val };
    if(!changed) undoStack.pop(); else draw();
  } else if(currentTool==='deed'){
    const cur = state.deed[tileIdx(t.x,t.y)];
    const val = cur ? 0 : 1;
    drag = { tool:'deed', kind:'rect', val, x0:t.x,y0:t.y, rectPreview:{x0:t.x,y0:t.y,x1:t.x,y1:t.y} };
  } else if(currentTool==='house'){
    drag = { tool:'house', kind:'rect', x0:t.x,y0:t.y, rectPreview:{x0:t.x,y0:t.y,x1:t.x,y1:t.y} };
  }
});

window.addEventListener('mousemove', evt=>{
  const p = clientToCanvas(evt);

  if(panDrag){
    view.panX = panDrag.panX0 + (evt.clientX - panDrag.startX);
    view.panY = panDrag.panY0 + (evt.clientY - panDrag.startY);
    draw();
    return;
  }

  const wpt = screenToWorld(p.x,p.y);
  const t = worldToTile(wpt.x,wpt.y);
  hover.x = t.x; hover.y = t.y;
  if(currentTool==='wall' && inBounds(t.x,t.y)) hover.edge = nearestEdge(wpt.x,wpt.y,t.x,t.y);
  else hover.edge = null;

  if(drag){
    if(drag.kind==='terrain' && inBounds(t.x,t.y)){
      paintTerrain(t.x,t.y,drag.val);
      draw();
    } else if(drag.kind==='wall' && inBounds(t.x,t.y)){
      const e = nearestEdge(wpt.x,wpt.y,t.x,t.y);
      paintWallAt(e, drag.val);
      draw();
    } else if(drag.kind==='rect'){
      const cx = Math.max(0,Math.min(state.w-1,t.x));
      const cy = Math.max(0,Math.min(state.h-1,t.y));
      drag.rectPreview = { x0:Math.min(drag.x0,cx), y0:Math.min(drag.y0,cy), x1:Math.max(drag.x0,cx), y1:Math.max(drag.y0,cy) };
      draw();
    }
  } else {
    draw();
  }
});

window.addEventListener('mouseup', evt=>{
  if(panDrag){ panDrag=null; return; }
  if(drag){
    if(drag.tool==='deed' && drag.rectPreview){
      const r = drag.rectPreview;
      for(let y=r.y0;y<=r.y1;y++) for(let x=r.x0;x<=r.x1;x++) paintDeed(x,y,drag.val);
    } else if(drag.tool==='house' && drag.rectPreview){
      const r = drag.rectPreview;
      stampHouse(r.x0,r.y0,r.x1,r.y1);
    }
    drag = null;
    refreshAll();
  }
});

wrap.addEventListener('wheel', evt=>{
  evt.preventDefault();
  const p = clientToCanvas(evt);
  const before = screenToWorld(p.x,p.y);
  const factor = evt.deltaY < 0 ? 1.12 : 1/1.12;
  view.zoom = Math.max(0.25, Math.min(4, view.zoom*factor));
  const tp = tilePx();
  view.panX = p.x - before.x*tp;
  view.panY = p.y - before.y*tp;
  updateZoomLabel();
  draw();
}, {passive:false});

canvas.addEventListener('mouseleave', ()=>{ hover.x=-1; hover.y=-1; });

/* -------------------------------------------------------------- ui build -- */

function buildTerrainList(){
  const el = document.getElementById('terrainList');
  el.innerHTML='';
  TERRAIN_TYPES.forEach(t=>{
    const d = document.createElement('div');
    d.className='swatch'+(t.id===selTerrain?' active':'');
    d.innerHTML = `<span class="chip" style="background:${t.color}"></span><span class="lbl">${t.name}</span>`;
    d.onclick = ()=>{ selTerrain=t.id; buildTerrainList(); };
    el.appendChild(d);
  });
}

function buildWallList(containerId, selectedGetter, selectedSetter){
  const el = document.getElementById(containerId);
  el.innerHTML='';
  for(let i=1;i<WALL_TYPES.length;i++){
    const w = WALL_TYPES[i];
    const d = document.createElement('div');
    d.className='swatch'+(w.id===selectedGetter()?' active':'');
    const style = `border-top-width:${Math.max(2,w.width)}px;border-top-color:${w.color};${w.dashed?'border-top-style:dashed;':''}`;
    d.innerHTML = `<span class="line" style="${style}"></span><span class="lbl">${w.name}</span>`;
    d.onclick = ()=>{ selectedSetter(w.id); buildWallList(containerId, selectedGetter, selectedSetter); };
    el.appendChild(d);
  }
}

function buildHouseFloorList(){
  const el = document.getElementById('houseFloorList');
  el.innerHTML='';
  TERRAIN_TYPES.forEach(t=>{
    const d = document.createElement('div');
    d.className='swatch'+(t.id===selHouseFloor?' active':'');
    d.innerHTML = `<span class="chip" style="background:${t.color}"></span><span class="lbl">${t.name}</span>`;
    d.onclick = ()=>{ selHouseFloor=t.id; buildHouseFloorList(); };
    el.appendChild(d);
  });
}

function buildLegend(){
  const el = document.getElementById('legendWalls');
  el.innerHTML='';
  for(let i=1;i<WALL_TYPES.length;i++){
    const w = WALL_TYPES[i];
    const row = document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-dim);';
    const style = `width:20px;border-top-width:${Math.max(2,w.width)}px;border-top-color:${w.color};border-top-style:${w.dashed?'dashed':'solid'};`;
    row.innerHTML = `<span style="${style}"></span>${w.name}`;
    el.appendChild(row);
  }
}

function setTool(tool){
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.toggle('active', b.dataset.tool===tool));
  ['terrain','wall','house','deed','marker'].forEach(id=>{
    const p = document.getElementById('panel-'+id);
    if(p) p.style.display = (id===tool) ? '' : 'none';
  });
  document.getElementById('statusTool').textContent = tool.charAt(0).toUpperCase()+tool.slice(1);
  wrap.style.cursor = tool==='pan' ? 'grab' : 'crosshair';
}

document.getElementById('toolButtons').addEventListener('click', e=>{
  const b = e.target.closest('.tool-btn');
  if(b) setTool(b.dataset.tool);
});

/* ------------------------------------------------------------ status/etc -- */

function updateZoomLabel(){
  const pct = Math.round(view.zoom*100)+'%';
  document.getElementById('zoomLabel').textContent = pct;
  document.getElementById('statusZoom').textContent = pct;
}

function updateStatus(){
  document.getElementById('statusTile').textContent = inBounds(hover.x,hover.y) ? `${hover.x}, ${hover.y}` : '-, -';
  document.getElementById('statGrid').textContent = `${state.w} x ${state.h}`;
  let deedTiles=0;
  for(let i=0;i<state.deed.length;i++) if(state.deed[i]) deedTiles++;
  document.getElementById('statDeedTiles').textContent = deedTiles;
  const rate = parseFloat(document.getElementById('upkeepRate').value)||0;
  const dayCopper = deedTiles*rate;
  document.getElementById('statUpkeepDay').textContent = formatCurrency(dayCopper);
  document.getElementById('statUpkeepMonth').textContent = formatCurrency(dayCopper*30);
}

function formatCurrency(copper){
  copper = Math.round(copper*100)/100;
  let c = Math.floor(copper);
  const frac = copper - c;
  const g = Math.floor(c/10000); c -= g*10000;
  const s = Math.floor(c/100); c -= s*100;
  const parts = [];
  if(g) parts.push(g+'g');
  if(s) parts.push(s+'s');
  if(c || parts.length===0) parts.push((c+frac).toFixed(frac?1:0)+'c');
  return parts.join(' ');
}

function refreshAll(){
  resizeCanvas();
  draw();
  renderSavesList();
}

/* --------------------------------------------------------------- resize --- */

document.getElementById('resizeBtn').onclick = ()=>{
  const w = Math.max(5, Math.min(250, parseInt(document.getElementById('gridW').value)||state.w));
  const h = Math.max(5, Math.min(250, parseInt(document.getElementById('gridH').value)||state.h));
  pushUndo();
  resizeState(w,h);
  refreshAll();
};

/* ----------------------------------------------------------------- zoom --- */

document.getElementById('zoomIn').onclick = ()=>{ view.zoom=Math.min(4,view.zoom*1.2); updateZoomLabel(); draw(); };
document.getElementById('zoomOut').onclick = ()=>{ view.zoom=Math.max(0.25,view.zoom/1.2); updateZoomLabel(); draw(); };
document.getElementById('zoomReset').onclick = ()=>{ view.zoom=1; view.panX=20; view.panY=20; updateZoomLabel(); draw(); };

document.getElementById('undoBtn').onclick = undo;
document.getElementById('redoBtn').onclick = redo;

document.getElementById('toggleGrid').onchange = draw;
document.getElementById('toggleCoords').onchange = draw;
document.getElementById('upkeepRate').oninput = updateStatus;

document.getElementById('clearBtn').onclick = ()=>{
  if(!confirm('Clear the entire plan? This cannot be undone once you leave the page.')) return;
  pushUndo();
  resizeState(state.w, state.h);
  refreshAll();
};

/* --------------------------------------------------------- import/export -- */

document.getElementById('exportJson').onclick = ()=>{
  const blob = new Blob([JSON.stringify(serialize(),null,0)], {type:'application/json'});
  downloadBlob(blob, 'deed-plan.json');
};

document.getElementById('importJsonBtn').onclick = ()=> document.getElementById('importJsonFile').click();
document.getElementById('importJsonFile').addEventListener('change', evt=>{
  const file = evt.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(typeof data.w!=='number' || typeof data.h!=='number' || !Array.isArray(data.tiles)) throw new Error('bad format');
      pushUndo();
      deserialize(data);
      view.zoom=1; view.panX=20; view.panY=20;
      refreshAll();
    }catch(err){ alert('Could not read that file as a deed plan JSON.'); }
    evt.target.value='';
  };
  reader.readAsText(file);
});

document.getElementById('exportPng').onclick = ()=>{
  const px = state.w*state.h > 40000 ? 8 : 16;
  const off = document.createElement('canvas');
  off.width = state.w*px+2; off.height = state.h*px+2;
  const octx = off.getContext('2d');
  octx.fillStyle = '#11130d'; octx.fillRect(0,0,off.width,off.height);
  for(let y=0;y<state.h;y++){
    for(let x=0;x<state.w;x++){
      octx.fillStyle = TERRAIN_TYPES[state.tiles[tileIdx(x,y)]].color;
      octx.fillRect(x*px,y*px,px+1,px+1);
      if(state.deed[tileIdx(x,y)]){
        octx.fillStyle='rgba(201,162,39,0.22)';
        octx.fillRect(x*px,y*px,px+1,px+1);
      }
    }
  }
  octx.strokeStyle='rgba(255,255,255,0.08)'; octx.lineWidth=1;
  for(let x=0;x<=state.w;x++){ octx.beginPath(); octx.moveTo(x*px+0.5,0); octx.lineTo(x*px+0.5,state.h*px); octx.stroke(); }
  for(let y=0;y<=state.h;y++){ octx.beginPath(); octx.moveTo(0,y*px+0.5); octx.lineTo(state.w*px,y*px+0.5); octx.stroke(); }
  for(let y=0;y<state.h;y++) for(let x=0;x<=state.w;x++){
    const wt=state.vWalls[vIdx(x,y)]; if(!wt) continue;
    octx.strokeStyle=WALL_TYPES[wt].color; octx.lineWidth=Math.max(1,WALL_TYPES[wt].width*(px/24));
    octx.beginPath(); octx.moveTo(x*px,y*px); octx.lineTo(x*px,(y+1)*px); octx.stroke();
  }
  for(let y=0;y<=state.h;y++) for(let x=0;x<state.w;x++){
    const wt=state.hWalls[hIdx(x,y)]; if(!wt) continue;
    octx.strokeStyle=WALL_TYPES[wt].color; octx.lineWidth=Math.max(1,WALL_TYPES[wt].width*(px/24));
    octx.beginPath(); octx.moveTo(x*px,y*px); octx.lineTo((x+1)*px,y*px); octx.stroke();
  }
  octx.fillStyle='#d98c3a';
  for(const mk of state.markers){
    octx.beginPath(); octx.arc((mk.x+0.5)*px,(mk.y+0.5)*px,px*0.3,0,Math.PI*2); octx.fill();
  }
  off.toBlob(blob=> downloadBlob(blob, 'deed-plan.png'));
};

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------- save slots - */

const SAVES_KEY = 'wurmDeedPlanner_saves';
const AUTOSAVE_KEY = 'wurmDeedPlanner_autosave';

function getSaves(){
  try{ return JSON.parse(localStorage.getItem(SAVES_KEY)) || {}; }catch(e){ return {}; }
}
function setSaves(obj){ localStorage.setItem(SAVES_KEY, JSON.stringify(obj)); }

function renderSavesList(){
  const el = document.getElementById('savesList');
  const saves = getSaves();
  const names = Object.keys(saves).sort();
  el.innerHTML='';
  if(!names.length){ el.innerHTML = '<div class="hint">No saved plans yet.</div>'; return; }
  names.forEach(name=>{
    const row = document.createElement('div');
    row.className='save-item';
    row.innerHTML = `<span class="name">${escapeHtml(name)}</span><span class="del" title="Delete">&times;</span>`;
    row.querySelector('.name').onclick = ()=>{
      pushUndo();
      deserialize(saves[name]);
      view.zoom=1; view.panX=20; view.panY=20;
      refreshAll();
    };
    row.querySelector('.del').onclick = (e)=>{
      e.stopPropagation();
      if(!confirm(`Delete saved plan "${name}"?`)) return;
      const s = getSaves(); delete s[name]; setSaves(s); renderSavesList();
    };
    el.appendChild(row);
  });
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

document.getElementById('saveBtn').onclick = ()=>{
  const name = document.getElementById('saveName').value.trim();
  if(!name){ alert('Enter a plan name first.'); return; }
  const saves = getSaves();
  if(saves[name] && !confirm(`Overwrite existing plan "${name}"?`)) return;
  saves[name] = serialize();
  setSaves(saves);
  renderSavesList();
};

/* ------------------------------------------------------------- autosave --- */

let autosaveTimer=null;
function scheduleAutosave(){
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(()=>{
    try{ localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serialize())); }catch(e){}
  }, 800);
}

/* wrap draw to also trigger autosave on real edits (after mouseup / marker save / etc) */
const _origRefresh = refreshAll;
refreshAll = function(){ _origRefresh(); scheduleAutosave(); };

/* -------------------------------------------------------------- startup --- */

function init(){
  buildTerrainList();
  buildWallList('wallList', ()=>selWall, v=>selWall=v);
  buildHouseFloorList();
  buildWallList('houseWallList', ()=>selHouseWall, v=>selHouseWall=v);
  buildLegend();
  setTool('terrain');

  let loaded = false;
  try{
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if(raw){ deserialize(JSON.parse(raw)); loaded = true; }
  }catch(e){}
  if(!loaded) state = newState(50,50);

  document.getElementById('gridW').value = state.w;
  document.getElementById('gridH').value = state.h;

  view.zoom=1; view.panX=20; view.panY=20;
  updateZoomLabel();
  resizeCanvas();
  renderSavesList();
  draw();
}

init();

})();
