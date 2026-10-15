// diagram-editor.js - Interactive visual flowchart editor (ГОСТ 19.701-90)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DiagramEditor = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ED = {
    on: false,
    model: null,
    sel: null,
    multi: [],
    nextId: 1,
    addEdge: null,
    flash: null,
    flashTimer: null,
    saved: null,
    savedCode: null,
    clipboard: null,
    undo: [],
    redo: [],
    _baseline: null,
    _dirty: false
  };

  // Environment bindings injected by init
  var ENV = {
    code: null,
    gutter: null,
    sheet: null,
    scroll: null,
    edbar: null,
    edToggle: null,
    showLineHl: function(){},
    onSave: function(){},
    getScale: function(){ return 1; },
    setScale: function(){},
    applyZoom: function(){}
  };

  function init(env) {
    Object.assign(ENV, env);
  }

  // Inject extracted editor methods
  function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escAttr(s){ return escHtml(s).replace(/"/g,'&quot;'); }
  function edTypes(){ return [
    ['process','Процесс'],['terminal','Терминатор'],['decision','Решение'],
    ['io','Данные (ввод/вывод)'],['predef','Предопр. процесс'],
    ['loopstart','Начало цикла'],['loopend','Конец цикла'],
    ['prep','Подготовка'],['connector','Соединитель']]; }

  function distToBox(p,s){
    var dx=Math.max(s.x-p[0],0,p[0]-(s.x+s.w));
    var dy=Math.max(s.y-p[1],0,p[1]-(s.y+s.h));
    return Math.sqrt(dx*dx+dy*dy);
  }
  function nearestShape(shapes,p){
    var best=null,bd=1e9;
    shapes.forEach(function(s){ var d=distToBox(p,s); if(d<bd){bd=d;best=s;} });
    return (best&&bd<60)?best.id:null;
  }
  function highlightSourceLine(s){
    if(!s || s.srcLine==null) return;
    var arr=code.value.split('\n'), ln=s.srcLine;
    if(ln<1) ln=1; if(ln>arr.length) ln=arr.length;
    var start=0; for(var k=0;k<ln-1;k++) start+=arr[k].length+1;
    var end=start+arr[ln-1].length;
    if(ED.on){
      var cs0=getComputedStyle(code);
      var lh0=parseFloat(cs0.lineHeight)||20, pt0=parseFloat(cs0.paddingTop)||16;
      code.scrollTop=Math.max(0,(ln-1)*lh0+pt0-code.clientHeight/2);
      showLineHl(ln);
      return;
    }
    try{
      code.focus();
      code.setSelectionRange(start,end);
      var cs=getComputedStyle(code);
      var lh=parseFloat(cs.lineHeight)||20, pt=parseFloat(cs.paddingTop)||16;
      code.scrollTop=Math.max(0,(ln-1)*lh+pt-code.clientHeight/2);
    }catch(e){}
    updateGutter();
  }
  function toEditModel(m){
    var shapes=m.shapes.map(function(s,i){
      return { id:'s'+(i+1), type:s.type, x:s.x, y:s.y, w:s.w, h:s.h,
        cx:s.cx, cy:s.cy, lines:(s.lines||['']).slice(),
        skew:s.skew, corner:s.corner, fontSize:s.fontSize, lineH:s.lineH,
        srcLine:s.srcLine };
    });
    var n=shapes.length;
    var edges=m.edges.map(function(e,i){
      var p=e.points.map(function(q){ return q.slice(); });
      return { id:'e'+(n+i+1), points:p, arrowExplicit:true,
        arrow:!!window.edgeHasUpward(p),
        from:nearestShape(shapes,p[0]), to:nearestShape(shapes,p[p.length-1]),
        label:e.label||'' };
    });
    ED.nextId=n+edges.length+1;
    return { shapes:shapes, edges:edges, titles:[], width:m.width, height:m.height };
  }
  function shapeById(id){ var a=ED.model.shapes; for(var i=0;i<a.length;i++) if(a[i].id===id) return a[i]; return null; }
  function edgeById(id){ var a=ED.model.edges; for(var i=0;i<a.length;i++) if(a[i].id===id) return a[i]; return null; }

  function relayoutShape(s){
    var lines=(s.lines&&s.lines.length)?s.lines:[''];
    var maxlen=0; lines.forEach(function(l){ if(l.length>maxlen)maxlen=l.length; });
    var lineH=17, w, h;
    if(s.type==='connector'){ w=h=Math.max(22,s.w||24); }
    else if(s.type==='decision'){ w=Math.min(320,Math.max(150,maxlen*8+70)); h=Math.max(72,lines.length*lineH+44); }
    else { w=Math.min(300,Math.max(120,maxlen*8+36)); h=Math.max(40,lines.length*lineH+18); }
    if(s.type!=='connector'){ w=Math.max(w, s.w||0); h=Math.max(h, s.h||0); }
    if(s.manualW) w=s.w;
    if(s.manualH) h=s.h;
    var cx=s.cx, cy=s.cy;
    s.w=w; s.h=h; s.x=cx-w/2; s.y=cy-h/2; s.cx=cx; s.cy=cy;
    s.fontSize=13; s.lineH=lineH;
    reattachShapeEdges(s);
  }
  function setSize(s, dim, val){
    val=Math.max(20,Math.min(620,val));
    if(dim==='w'){ s.w=val; s.manualW=true; s.x=s.cx-val/2; }
    else { s.h=val; s.manualH=true; s.y=s.cy-val/2; }
    reattachShapeEdges(s);
  }

  function orthRoute(A,B){
    var acx=A.cx, bcx=B.cx, aBot=A.y+A.h, aTop=A.y, bTop=B.y, bBot=B.y+B.h;
    if(bTop>=aBot-2){
      if(Math.abs(acx-bcx)<2) return [[acx,aBot],[bcx,bTop]];
      var mid=(aBot+bTop)/2;
      return [[acx,aBot],[acx,mid],[bcx,mid],[bcx,bTop]];
    }
    if(bBot<=aTop+2){
      var lane=Math.min(A.x,B.x)-34;
      return [[A.x,A.cy],[lane,A.cy],[lane,B.cy],[B.x,B.cy]];
    }
    if(bcx>=acx) return [[A.x+A.w,A.cy],[B.x,B.cy]];
    return [[A.x,A.cy],[B.x+B.w,B.cy]];
  }
  function rerouteEdge(e){ var A=shapeById(e.from), B=shapeById(e.to); if(A&&B) e.points=orthRoute(A,B); }
  function rerouteConnected(sid, dx, dy){
    ED.model.edges.forEach(function(e){
      var f=(e.from===sid), t=(e.to===sid);
      if(!f && !t) return;
      if(e.manual){
        if(typeof dx==='number' && e.points && e.points.length){
          if(f) e.points[0]=[e.points[0][0]+dx, e.points[0][1]+dy];
          if(t){ var li=e.points.length-1; e.points[li]=[e.points[li][0]+dx, e.points[li][1]+dy]; }
        }
      } else { rerouteEdge(e); }
    });
  }
  var ATTACH_TOL=14;
  function reattachShapeEdges(s){
    ED.model.edges.forEach(function(e){
      var f=(e.from===s.id), t=(e.to===s.id);
      if((!f && !t) || !e.points || !e.points.length) return;
      if(f && distToBox(e.points[0],s)<ATTACH_TOL) e.points[0]=snapBorder(s,e.points[0]);
      var li=e.points.length-1;
      if(t && distToBox(e.points[li],s)<ATTACH_TOL) e.points[li]=snapBorder(s,e.points[li]);
    });
  }
  function edgePointsStr(e){ return e.points.map(function(q){ return (+q[0]).toFixed(1)+','+(+q[1]).toFixed(1); }).join(' '); }
  function updateEdgePolyline(svg,e){
    var g=svg.querySelector('[data-eid="'+e.id+'"]'); if(!g) return;
    var str=edgePointsStr(e), pls=g.querySelectorAll('polyline');
    for(var i=0;i<pls.length;i++) pls[i].setAttribute('points',str);
  }
  function moveHandleEl(ht,p){
    if(ht.tagName.toLowerCase()==='circle'){ ht.setAttribute('cx',p[0]); ht.setAttribute('cy',p[1]); }
    else { ht.setAttribute('x',p[0]-4.5); ht.setAttribute('y',p[1]-4.5); }
  }
  function removeHandles(svg,keep){ var hs=svg.querySelectorAll('.edh'); for(var i=0;i<hs.length;i++){ if(hs[i]!==keep) hs[i].parentNode.removeChild(hs[i]); } }
  var RESIZE_CURSOR={n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',
                     ne:'nesw-resize',sw:'nesw-resize',nw:'nwse-resize',se:'nwse-resize'};
  function addShapeHandles(svg){
    if(!ED.sel || ED.sel.kind!=='shape' || ED.addEdge) return;
    var s=shapeById(ED.sel.id); if(!s) return;
    var NS='http://www.w3.org/2000/svg', sz=9;
    var L=s.x,R=s.x+s.w,T=s.y,B=s.y+s.h,CX=s.cx,CY=s.cy;
    var pos={nw:[L,T],n:[CX,T],ne:[R,T],e:[R,CY],se:[R,B],s:[CX,B],sw:[L,B],w:[L,CY]};
    Object.keys(pos).forEach(function(dir){
      var p=pos[dir], r=document.createElementNS(NS,'rect');
      r.setAttribute('x',p[0]-sz/2); r.setAttribute('y',p[1]-sz/2);
      r.setAttribute('width',sz); r.setAttribute('height',sz);
      r.setAttribute('class','edh shh'); r.setAttribute('data-dir',dir);
      r.style.cursor=RESIZE_CURSOR[dir];
      svg.appendChild(r);
    });
  }
  function redrawShapeNode(svg,s,selected){
    var g=svg.querySelector('[data-fid="'+s.id+'"]'); if(!g || !window.renderShapeSVG) return;
    var d=document.createElement('div');
    d.innerHTML='<svg xmlns="http://www.w3.org/2000/svg">'+window.renderShapeSVG(s)+'</svg>';
    var ng=d.querySelector('[data-fid]'); if(!ng) return;
    if(selected) ng.classList.add('sel');
    g.parentNode.replaceChild(ng,g);
  }
  function startShapeResize(ev,svg,dir){
    var s=shapeById(ED.sel.id); if(!s) return;
    var before=snap(), start=svgPoint(svg,ev);
    var o={x:s.x,y:s.y,w:s.w,h:s.h};
    removeHandles(svg);
    var pushed=false, lastW=Math.round(o.w), lastH=Math.round(o.h);
    function mv(ev2){
      var p=svgPoint(svg,ev2), dx=p[0]-start[0], dy=p[1]-start[1];
      if(!pushed){ if(Math.abs(dx)+Math.abs(dy)<=2) return; pushHist(before); pushed=true; }
      var L=o.x, R=o.x+o.w, T=o.y, B=o.y+o.h;
      if(dir.indexOf('e')>-1) R=o.x+o.w+dx;
      if(dir.indexOf('w')>-1) L=o.x+dx;
      if(dir.indexOf('s')>-1) B=o.y+o.h+dy;
      if(dir.indexOf('n')>-1) T=o.y+dy;
      if(GRIDON){
        if(dir.indexOf('e')>-1) R=gridPull(R);
        if(dir.indexOf('w')>-1) L=gridPull(L);
        if(dir.indexOf('s')>-1) B=gridPull(B);
        if(dir.indexOf('n')>-1) T=gridPull(T);
      }
      var w=R-L, h=B-T;
      if(/e|w/.test(dir)){
        var mw=null, dwb=SNAP_HOLD+0.001;
        ED.model.shapes.forEach(function(o){ if(o.id===s.id) return; var d2=Math.abs(o.w-w); if(d2<dwb){ dwb=d2; mw=o.w; } });
        if(mw!==null){ w=mw; if(dir.indexOf('w')>-1) L=R-w; else R=L+w; }
      }
      if(/n|s/.test(dir)){
        var mh=null, dhb=SNAP_HOLD+0.001;
        ED.model.shapes.forEach(function(o){ if(o.id===s.id) return; var d2=Math.abs(o.h-h); if(d2<dhb){ dhb=d2; mh=o.h; } });
        if(mh!==null){ h=mh; if(dir.indexOf('n')>-1) T=B-h; else B=T+h; }
      }
      if(w<20){  if(dir.indexOf('w')>-1) L=R-20;  else R=L+20;  w=20; }
      if(w>620){ if(dir.indexOf('w')>-1) L=R-620; else R=L+620; w=620; }
      if(h<20){  if(dir.indexOf('n')>-1) T=B-20;  else B=T+20;  h=20; }
      if(h>620){ if(dir.indexOf('n')>-1) T=B-620; else B=T+620; h=620; }
      s.x=L; s.y=T; s.w=w; s.h=h; s.cx=L+w/2; s.cy=T+h/2;
      if(/e|w/.test(dir)) s.manualW=true;
      if(/n|s/.test(dir)) s.manualH=true;
      redrawShapeNode(svg,s,true);
      var rw=Math.round(w), rh=Math.round(h);
      if(/e|w/.test(dir)) maybeFlash(s,'w',lastW,rw);
      if(/n|s/.test(dir)) maybeFlash(s,'h',lastH,rh);
      if(!ED.flash){
        var held=[];
        ED.model.shapes.forEach(function(o){
          if(o.id===s.id) return;
          if((/e|w/.test(dir) && Math.round(o.w)===rw) || (/n|s/.test(dir) && Math.round(o.h)===rh)) held.push(o.id);
        });
        if(held.length){ held.push(s.id); doFlash(held); }
      }
      lastW=rw; lastH=rh;
      markFlash(svg);
    }
    function up(){
      document.removeEventListener('pointermove',mv);
      document.removeEventListener('pointerup',up);
      if(pushed) reattachShapeEdges(s);
      renderEdit();
    }
    document.addEventListener('pointermove',mv);
    document.addEventListener('pointerup',up);
    ev.preventDefault(); ev.stopPropagation();
  }
  function shapeAt(p){
    for(var i=ED.model.shapes.length-1;i>=0;i--){ var s=ED.model.shapes[i];
      if(p[0]>=s.x && p[0]<=s.x+s.w && p[1]>=s.y && p[1]<=s.y+s.h) return s.id; }
    return null;
  }
  function snapBorder(s,p){
    var x=Math.max(s.x, Math.min(s.x+s.w, p[0])), y=Math.max(s.y, Math.min(s.y+s.h, p[1]));
    var dl=x-s.x, dr=s.x+s.w-x, dt=y-s.y, db=s.y+s.h-y, m=Math.min(dl,dr,dt,db);
    if(m===dl) x=s.x; else if(m===dr) x=s.x+s.w; else if(m===dt) y=s.y; else y=s.y+s.h;
    return [x,y];
  }
  var SNAP_R=26;
  function sideAnchors(s){ return [[s.cx,s.y],[s.cx,s.y+s.h],[s.x,s.cy],[s.x+s.w,s.cy]]; }
  function nearestAnchor(p){
    var best=null;
    ED.model.shapes.forEach(function(s){
      sideAnchors(s).forEach(function(a){
        var d=Math.hypot(p[0]-a[0],p[1]-a[1]);
        if(d<=SNAP_R && (!best || d<best.d)) best={sid:s.id, pt:[a[0],a[1]], d:d};
      });
    });
    return best;
  }
  function setSnapTarget(svg,sid){
    var cur=svg.querySelector('.fig.snapt');
    if(cur && cur.getAttribute('data-fid')!==sid) cur.classList.remove('snapt');
    if(sid){ var g=svg.querySelector('[data-fid="'+sid+'"]'); if(g) g.classList.add('snapt'); }
  }
  var SNAP_HOLD=7, GRID_SNAP=5;
  function gridSnapDelta(a,b){
    function d(v){ return Math.round(v/GRID_STEP)*GRID_STEP - v; }
    var da=d(a), db=d(b), best=Math.abs(da)<=Math.abs(db)?da:db;
    return Math.abs(best)<=GRID_SNAP ? best : 0;
  }
  function gridPull(v){
    var g=Math.round(v/GRID_STEP)*GRID_STEP;
    return Math.abs(g-v)<=GRID_SNAP ? g : v;
  }
  function magnetCenters(s,dx,dy){
    var cx=s.cx+dx, cy=s.cy+dy, bx=null, by=null, bdx=SNAP_HOLD+0.001, bdy=SNAP_HOLD+0.001;
    ED.model.shapes.forEach(function(o){
      if(o.id===s.id) return;
      var ddx=Math.abs(o.cx-cx); if(ddx<bdx){ bdx=ddx; bx=o.cx; }
      var ddy=Math.abs(o.cy-cy); if(ddy<bdy){ bdy=ddy; by=o.cy; }
    });
    return [ bx===null?dx:bx-s.cx, by===null?dy:by-s.cy ];
  }
  function clearAlign(svg){
    [].slice.call(svg.querySelectorAll('.algn')).forEach(function(n){ n.parentNode.removeChild(n); });
    [].slice.call(svg.querySelectorAll('.fig.alit')).forEach(function(n){ n.classList.remove('alit'); });
  }
  function updateAlignGuides(svg,s,dx,dy){
    clearAlign(svg);
    var cx=s.cx+dx, cy=s.cy+dy, v=[], h=[];
    ED.model.shapes.forEach(function(o){
      if(o.id===s.id) return;
      if(Math.round(o.cx)===Math.round(cx)) v.push(o);
      if(Math.round(o.cy)===Math.round(cy)) h.push(o);
    });
    var NS='http://www.w3.org/2000/svg';
    function lit(o){ var g=svg.querySelector('[data-fid="'+o.id+'"]'); if(g) g.classList.add('alit'); }
    function gline(x1,y1,x2,y2){
      var l=document.createElementNS(NS,'line');
      l.setAttribute('x1',x1); l.setAttribute('y1',y1);
      l.setAttribute('x2',x2); l.setAttribute('y2',y2);
      l.setAttribute('class','algn'); svg.appendChild(l);
    }
    if(v.length){
      var ys=v.map(function(o){ return o.cy; }).concat([cy]);
      gline(cx, Math.min.apply(null,ys)-40, cx, Math.max.apply(null,ys)+40);
      v.forEach(lit); lit(s);
    }
    if(h.length){
      var xs=h.map(function(o){ return o.cx; }).concat([cx]);
      gline(Math.min.apply(null,xs)-40, cy, Math.max.apply(null,xs)+40, cy);
      h.forEach(lit); lit(s);
    }
  }
  function segAngle(a,b){ var d=Math.atan2(b[1]-a[1], b[0]-a[0])*180/Math.PI; return d<0?d+360:d; }
  function nearCardinal(ang){ return Math.round(ang)%90===0; }
  function vertexIsOrtho(e,vix){
    var p=e.points;
    if(vix>0 && nearCardinal(segAngle(p[vix-1],p[vix]))) return true;
    if(vix<p.length-1 && nearCardinal(segAngle(p[vix],p[vix+1]))) return true;
    return false;
  }
  function setEdgeOrtho(svg,e,on){ var g=svg.querySelector('[data-eid="'+e.id+'"]'); if(g) g.classList.toggle('eortho',!!on); }
  function markMulti(svg){
    if(!ED.multi) return;
    ED.multi.forEach(function(m){
      var el=svg.querySelector('['+(m.kind==='shape'?'data-fid':'data-eid')+'="'+m.id+'"]');
      if(el) el.classList.add('msel');
    });
  }
  function rectsIntersect(a,b){ return !(b.x>a.x+a.w || b.x+b.w<a.x || b.y>a.y+a.h || b.y+b.h<a.y); }
  function ptIn(box,p){ return p[0]>=box.x && p[0]<=box.x+box.w && p[1]>=box.y && p[1]<=box.y+box.h; }
  function itemsInBox(box){
    var out=[];
    ED.model.shapes.forEach(function(s){ if(rectsIntersect(box,{x:s.x,y:s.y,w:s.w,h:s.h})) out.push({kind:'shape',id:s.id}); });
    ED.model.edges.forEach(function(e){ if(e.points && e.points.some(function(p){ return ptIn(box,p); })) out.push({kind:'edge',id:e.id}); });
    return out;
  }
  function startMarquee(ev, svg){
    var start=svgPoint(svg,ev), NS='http://www.w3.org/2000/svg';
    var rect=document.createElementNS(NS,'rect'); rect.setAttribute('class','marquee'); svg.appendChild(rect);
    var moved=false, box={x:start[0],y:start[1],w:0,h:0};
    function mv(ev2){
      var p=svgPoint(svg,ev2);
      if(Math.abs(p[0]-start[0])+Math.abs(p[1]-start[1])>3) moved=true;
      box={ x:Math.min(start[0],p[0]), y:Math.min(start[1],p[1]), w:Math.abs(p[0]-start[0]), h:Math.abs(p[1]-start[1]) };
      rect.setAttribute('x',box.x); rect.setAttribute('y',box.y); rect.setAttribute('width',box.w); rect.setAttribute('height',box.h);
    }
    function up(){
      document.removeEventListener('pointermove',mv); document.removeEventListener('pointerup',up);
      if(rect.parentNode) rect.parentNode.removeChild(rect);
      if(!moved){ ED.sel=null; ED.multi=[]; renderEdit(); return; }
      ED.multi=itemsInBox(box); ED.sel=null; ED.addEdge=null; renderEdit();
    }
    document.addEventListener('pointermove',mv); document.addEventListener('pointerup',up);
    ev.preventDefault();
  }
  function deleteMulti(){
    if(!ED.multi || !ED.multi.length) return;
    pushHist();
    var sIds={}, eIds={};
    ED.multi.forEach(function(m){ if(m.kind==='shape') sIds[m.id]=1; else eIds[m.id]=1; });
    ED.model.shapes=ED.model.shapes.filter(function(s){ return !sIds[s.id]; });
    ED.model.edges=ED.model.edges.filter(function(e){ return !eIds[e.id] && !sIds[e.from] && !sIds[e.to]; });
    ED.multi=[]; ED.sel=null; renderEdit();
  }
  function currentSelectionList(){
    if(ED.multi && ED.multi.length) return ED.multi.slice();
    if(ED.sel) return [ED.sel];
    return [];
  }
  function clipboardHas(){ return ED.clipboard && (ED.clipboard.shapes.length || ED.clipboard.edges.length); }
  function copySelection(){
    var sel=currentSelectionList(); if(!sel.length) return;
    var shapes=[], edges=[];
    sel.forEach(function(m){ if(m.kind==='shape'){ var s=shapeById(m.id); if(s) shapes.push(clone(s)); } });
    sel.forEach(function(m){ if(m.kind==='edge'){ var e=edgeById(m.id); if(e) edges.push(clone(e)); } });
    ED.clipboard={ shapes:shapes, edges:edges };
    var h=$('edHint'); if(h){ h.textContent='Скопировано: '+(shapes.length+edges.length)+' · Ctrl+V — вставить'; h.style.color='#1a7f37'; }
    buildPanel();
  }
  function clipboardBBox(){
    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,any=false;
    ED.clipboard.shapes.forEach(function(s){ any=true;
      minX=Math.min(minX,s.x); minY=Math.min(minY,s.y);
      maxX=Math.max(maxX,s.x+s.w); maxY=Math.max(maxY,s.y+s.h); });
    ED.clipboard.edges.forEach(function(e){ (e.points||[]).forEach(function(p){ any=true;
      minX=Math.min(minX,p[0]); minY=Math.min(minY,p[1]);
      maxX=Math.max(maxX,p[0]); maxY=Math.max(maxY,p[1]); }); });
    if(!any) return null;
    return { cx:(minX+maxX)/2, cy:(minY+maxY)/2 };
  }
  function pasteClipboard(){
    if(!clipboardHas()) return;
    pushHist();
    var offX=24, offY=24;
    if(ED.pasteAt){
      var bb=clipboardBBox();
      if(bb){ offX=ED.pasteAt[0]-bb.cx; offY=ED.pasteAt[1]-bb.cy; }
    }
    var idMap={}, sel=[];
    ED.clipboard.shapes.forEach(function(s){
      var ns=clone(s), nid='s'+(ED.nextId++); idMap[s.id]=nid;
      ns.id=nid; ns.cx+=offX; ns.cy+=offY; ns.x=ns.cx-ns.w/2; ns.y=ns.cy-ns.h/2;
      ED.model.shapes.push(ns); sel.push({kind:'shape',id:nid});
    });
    ED.clipboard.edges.forEach(function(e){
      var ne=clone(e), nid='e'+(ED.nextId++); ne.id=nid;
      ne.points=(e.points||[]).map(function(p){ return [p[0]+offX,p[1]+offY]; });
      if(e.lpos) ne.lpos=[e.lpos[0]+offX, e.lpos[1]+offY];
      var nf=idMap[e.from], nt=idMap[e.to];
      ne.from=nf||null; ne.to=nt||null;
      ED.model.edges.push(ne);
      if(nf && nt && !e.manual){ ne.manual=false; rerouteEdge(ne); } else { ne.manual=true; }
      sel.push({kind:'edge',id:nid});
    });
    if(sel.length>1){ ED.multi=sel; ED.sel=null; } else { ED.multi=[]; ED.sel=sel[0]||null; }
    renderEdit();
  }
  function addEdgeHandles(svg){
    if(!ED.sel || ED.sel.kind!=='edge') return;
    var e=edgeById(ED.sel.id); if(!e || !e.points || e.points.length<2) return;
    var NS='http://www.w3.org/2000/svg', pts=e.points;
    for(var i=0;i<pts.length-1;i++){
      var mx=(pts[i][0]+pts[i+1][0])/2, my=(pts[i][1]+pts[i+1][1])/2;
      var c=document.createElementNS(NS,'circle');
      c.setAttribute('cx',mx); c.setAttribute('cy',my); c.setAttribute('r','4.5');
      c.setAttribute('class','edh mid'); c.setAttribute('data-seg',i);
      svg.appendChild(c);
    }
    pts.forEach(function(p,i){
      var sz=9, r=document.createElementNS(NS,'rect');
      r.setAttribute('x',p[0]-sz/2); r.setAttribute('y',p[1]-sz/2);
      r.setAttribute('width',sz); r.setAttribute('height',sz);
      r.setAttribute('class','edh'); r.setAttribute('data-vix',i);
      r.setAttribute('data-ept',(i===0||i===pts.length-1)?'1':'0');
      svg.appendChild(r);
    });
    if(e.label){
      var t=svg.querySelector('[data-eid="'+e.id+'"] text.elbl');
      if(t){
        var lx=parseFloat(t.getAttribute('x'))||0, ly=parseFloat(t.getAttribute('y'))||0;
        var lc=document.createElementNS(NS,'circle');
        lc.setAttribute('cx',lx); lc.setAttribute('cy',ly-11); lc.setAttribute('r','5');
        lc.setAttribute('class','edh lbl');
        svg.appendChild(lc);
      }
    }
  }

  function recomputeBounds(){
    var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
    function ext(x,y){ if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y; }
    ED.model.shapes.forEach(function(s){ ext(s.x,s.y); ext(s.x+s.w,s.y+s.h); });
    ED.model.edges.forEach(function(e){ e.points.forEach(function(p){ ext(p[0],p[1]); }); });
    if(minX===1e9){ ED.model.width=400; ED.model.height=300; return; }
    var pad=30;
    var dx=Math.round((pad-minX)/GRID_STEP)*GRID_STEP, dy=Math.round((pad-minY)/GRID_STEP)*GRID_STEP;
    if(minX+dx<6) dx+=GRID_STEP;
    if(minY+dy<6) dy+=GRID_STEP;
    if(dx||dy){
      ED.model.shapes.forEach(function(s){ s.x+=dx;s.y+=dy;s.cx+=dx;s.cy+=dy; });
      ED.model.edges.forEach(function(e){
        e.points=e.points.map(function(p){ return [p[0]+dx,p[1]+dy]; });
        if(e.lpos) e.lpos=[e.lpos[0]+dx, e.lpos[1]+dy];
      });
      maxX+=dx; maxY+=dy;
    }
    ED.model.width=maxX+pad; ED.model.height=maxY+pad;
  }

  function paintSVG(){
    sheet.innerHTML=window.renderModelSVG(ED.model);
    natW=ED.model.width; natH=ED.model.height;
    var svg=sheet.querySelector('svg');
    if(svg){
      svg.removeAttribute('width'); svg.removeAttribute('height');
      svg.style.overflow='visible';
      if(ED.addEdge) svg.classList.add('adding');
      applyZoom(); attachEditHandlers(svg); markFlash(svg); markSel(svg); markMulti(svg); addEdgeHandles(svg); addShapeHandles(svg);
    }
  }
  function flashSel(id){ return String(id).charAt(0)==='e' ? ['[data-eid="'+id+'"]','eflash'] : ['[data-fid="'+id+'"]','fflash']; }
  function markFlash(svg){
    if(!ED.flash) return;
    ED.flash.forEach(function(id){ var fs=flashSel(id), el=svg.querySelector(fs[0]); if(el) el.classList.add(fs[1]); });
  }
  function edgeLenR(e){
    var L=0, p=e.points||[];
    for(var i=1;i<p.length;i++) L+=Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]);
    return Math.round(L);
  }
  function maybeFlashEdgeLen(e,oldR,newR){
    var hit=[];
    ED.model.edges.forEach(function(o){ if(o.id!==e.id && edgeLenR(o)===newR) hit.push(o.id); });
    if(!hit.length) return;
    if(newR!==oldR || !ED.flash){ hit.push(e.id); doFlash(hit); }
  }
  function doFlash(ids){
    if(ED.flashTimer) clearTimeout(ED.flashTimer);
    ED.flash=ids.slice();
    ED.flashTimer=setTimeout(function(){
      ED.flashTimer=null; var keep=ED.flash||[]; ED.flash=null;
      var svg=sheet.querySelector('svg'); if(!svg) return;
      keep.forEach(function(id){ var fs=flashSel(id), el=svg.querySelector(fs[0]); if(el) el.classList.remove(fs[1]); });
    },1000);
  }
  function maybeFlash(s, dim, oldR, newR){
    if(newR===oldR) return;
    var hit=[];
    ED.model.shapes.forEach(function(o){
      if(o.id===s.id) return;
      if(Math.round(dim==='w'?o.w:o.h)===newR) hit.push(o.id);
    });
    if(hit.length){ hit.push(s.id); doFlash(hit); }
  }
  function renderEdit(){ recomputeBounds(); paintSVG(); buildPanel(); syncEditLineHl(); }
  function syncEditLineHl(){
    var s=ED.on && ED.sel && ED.sel.kind==='shape' ? shapeById(ED.sel.id) : null;
    if(!s || s.srcLine==null || s.srcLine!==hlLine) showLineHl(0);
  }
  function renderSVGOnly(){ recomputeBounds(); paintSVG(); }
  function markSel(svg){
    if(!ED.sel) return;
    var el=svg.querySelector('[data-fid="'+ED.sel.id+'"], [data-eid="'+ED.sel.id+'"]');
    if(el) el.classList.add('sel');
  }
  function attachEditHandlers(svg){ svg.addEventListener('pointerdown', onDown); svg.addEventListener('pointermove', onAddLineMove); }

  var ADD_HINT1='Кликните, откуда вести линию: фигура, другая линия или пустое место · Esc — отмена',
      ADD_HINT2='Теперь кликните, куда: фигура, линия или пустое место · Esc — отмена';
  function nearestOnEdge(e,p){
    var best=null, P=e.points||[];
    for(var i=0;i<P.length-1;i++){
      var a=P[i], b=P[i+1], vx=b[0]-a[0], vy=b[1]-a[1], L2=vx*vx+vy*vy;
      var t=L2 ? Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/L2)) : 0;
      var q=[a[0]+t*vx, a[1]+t*vy], d=Math.hypot(p[0]-q[0],p[1]-q[1]);
      if(!best || d<best.d) best={pt:q, d:d, vert:Math.abs(vy)>Math.abs(vx), seg:[a,b]};
    }
    return best;
  }
  function lineAnchor(p, info){
    if(info && info.kind==='shape'){
      var na=nearestAnchor(p);
      return { kind:'shape', sid:info.id, pt:p, side:(na && na.sid===info.id) ? na.pt : null };
    }
    if(info && info.kind==='edge'){
      var e=edgeById(info.id), h=e && nearestOnEdge(e,p);
      if(h) return { kind:'edge', eid:e.id, pt:h.pt, vert:h.vert, seg:h.seg };
    }
    var a=nearestAnchor(p);
    if(a) return { kind:'shape', sid:a.sid, pt:a.pt, side:a.pt };
    if(GRIDON) p=[Math.round(p[0]/GRID_STEP)*GRID_STEP, Math.round(p[1]/GRID_STEP)*GRID_STEP];
    return { kind:'free', pt:p };
  }
  function anchorRef(a){ var s=a.kind==='shape' && shapeById(a.sid); return s ? [s.cx,s.cy] : a.pt; }
  function anchorEnd(a, q){
    if(a.kind==='shape'){
      var s=shapeById(a.sid), pt=a.side;
      if(!pt){
        if(q[1]>=s.y+s.h) pt=[s.cx,s.y+s.h];
        else if(q[1]<=s.y) pt=[s.cx,s.y];
        else pt = q[0]>=s.cx ? [s.x+s.w,s.cy] : [s.x,s.cy];
      }
      return { pt:pt.slice(), dir:(Math.abs(pt[0]-s.cx)<0.5 ? 'V' : 'H') };
    }
    if(a.kind==='edge') return { pt:a.pt.slice(), dir:a.vert?'H':'V', slide:a.vert?1:0, seg:a.seg };
    return { pt:a.pt.slice(), dir:null, free:true };
  }
  function alignEnds(e0, e1, k){
    if(Math.abs(e0.pt[k]-e1.pt[k])>=10 || e0.pt[k]===e1.pt[k]) return;
    function canSlide(e, v){
      if(e.free) return true;
      if(e.seg && e.slide===k){ var lo=Math.min(e.seg[0][k],e.seg[1][k]), hi=Math.max(e.seg[0][k],e.seg[1][k]); return v>=lo && v<=hi; }
      return false;
    }
    if(canSlide(e1,e0.pt[k])) e1.pt[k]=e0.pt[k];
    else if(canSlide(e0,e1.pt[k])) e0.pt[k]=e1.pt[k];
  }
  function anchorPath(A, B){
    var e0=anchorEnd(A, anchorRef(B)), e1=anchorEnd(B, e0.pt);
    if(e0.dir!=='H' && e1.dir!=='H') alignEnds(e0,e1,0);
    if(e0.dir!=='V' && e1.dir!=='V') alignEnds(e0,e1,1);
    var p0=e0.pt, p1=e1.pt, d0=e0.dir, d1=e1.dir;
    if(!d0 && !d1){ d0='V'; d1='H'; }
    if(!d0) d0 = d1==='V' ? 'H' : 'V';
    if(!d1) d1 = d0==='V' ? 'H' : 'V';
    var pts;
    if(p0[0]===p1[0] || p0[1]===p1[1]) pts=[p0,p1];
    else if(d0==='V' && d1==='H') pts=[p0,[p0[0],p1[1]],p1];
    else if(d0==='H' && d1==='V') pts=[p0,[p1[0],p0[1]],p1];
    else if(d0==='V'){ var my=(p0[1]+p1[1])/2; pts=[p0,[p0[0],my],[p1[0],my],p1]; }
    else { var mx=(p0[0]+p1[0])/2; pts=[p0,[mx,p0[1]],[mx,p1[1]],p1]; }
    return pts;
  }
  function finishAddLine(A, B){
    if(A.kind==='shape' && B.kind==='shape' && A.sid===B.sid) return false;
    var ne;
    if(A.kind==='shape' && B.kind==='shape' && !A.side && !B.side){
      ne={ id:'e'+(ED.nextId++), from:A.sid, to:B.sid, arrow:true, arrowExplicit:true, label:'', points:[] };
      rerouteEdge(ne);
    } else {
      var pts=anchorPath(A,B);
      if(Math.hypot(pts[0][0]-pts[pts.length-1][0], pts[0][1]-pts[pts.length-1][1])<8) return false;
      ne={ id:'e'+(ED.nextId++), from:A.kind==='shape'?A.sid:null, to:B.kind==='shape'?B.sid:null,
           manual:true, arrow:true, arrowExplicit:true, label:'', points:pts };
    }
    pushHist(); ED.model.edges.push(ne);
    ED.addEdge=null; ED.sel={kind:'edge',id:ne.id}; ED.multi=[]; renderEdit();
    return true;
  }
  function drawAddPreview(svg, A, B){
    var NS='http://www.w3.org/2000/svg', g=svg.querySelector('.adl-g');
    if(!g){ g=document.createElementNS(NS,'g'); g.setAttribute('class','adl-g'); svg.appendChild(g); }
    var pts = B ? anchorPath(A,B) : [A.side||A.pt];
    var str=pts.map(function(q){ return (+q[0]).toFixed(1)+','+(+q[1]).toFixed(1); }).join(' ');
    g.innerHTML='<polyline class="adl" points="'+str+'"/>'+
      '<circle class="adl-pt" cx="'+pts[0][0]+'" cy="'+pts[0][1]+'" r="4"/>'+
      (B ? '<circle class="adl-pt" cx="'+pts[pts.length-1][0]+'" cy="'+pts[pts.length-1][1]+'" r="4"/>' : '');
    var cur=svg.querySelector('.ed.snapt'); if(cur) cur.classList.remove('snapt');
    setSnapTarget(svg, B && B.kind==='shape' ? B.sid : null);
    if(B && B.kind==='edge'){ var eg=svg.querySelector('[data-eid="'+B.eid+'"]'); if(eg) eg.classList.add('snapt'); }
  }
  function onAddLineMove(ev){
    if(!ED.addEdge || !ED.addEdge.start) return;
    var svg=sheet.querySelector('svg'); if(!svg) return;
    drawAddPreview(svg, ED.addEdge.start, lineAnchor(svgPoint(svg,ev), targetInfo(ev)));
  }
  function targetInfo(ev){
    var g=ev.target.closest?ev.target.closest('[data-fid],[data-eid]'):null;
    if(!g) return null;
    return g.hasAttribute('data-fid')?{kind:'shape',id:g.getAttribute('data-fid')}
                                     :{kind:'edge', id:g.getAttribute('data-eid')};
  }
  function svgPoint(svg,ev){ var b=svg.getBoundingClientRect(); return [(ev.clientX-b.left)/scale,(ev.clientY-b.top)/scale]; }

  function onDown(ev){
    var svg=sheet.querySelector('svg'); if(!svg) return;
    if(document.activeElement===code) code.blur();
    if(ev.button===0 || ev.button===undefined) ED.pasteAt=svgPoint(svg,ev);
    if(ED.addEdge){
      var anc=lineAnchor(svgPoint(svg,ev), targetInfo(ev));
      if(!ED.addEdge.start){ ED.addEdge.start=anc; setHint(ADD_HINT2); drawAddPreview(svg, anc, null); }
      else finishAddLine(ED.addEdge.start, anc);
      ev.preventDefault();
      return;
    }
    var rh=ev.target.closest ? ev.target.closest('.shh') : null;
    if(rh && ED.sel && ED.sel.kind==='shape'){ startShapeResize(ev,svg,rh.getAttribute('data-dir')); return; }
    var ht=ev.target.closest ? ev.target.closest('.edh') : null;
    if(ht && ED.sel && ED.sel.kind==='edge'){
      if(ht.classList.contains('lbl')) startLabelDrag(ev,svg,ED.sel.id);
      else startHandleDrag(ev,svg,ht);
      return;
    }
    var lt=(ev.target.classList && ev.target.classList.contains('elbl')) ? ev.target : null;
    if(lt){
      var lg=lt.closest('[data-eid]'), leid=lg && lg.getAttribute('data-eid');
      if(leid && ED.sel && ED.sel.kind==='edge' && ED.sel.id===leid){ startLabelDrag(ev,svg,leid); return; }
      if(leid){ ED.sel={kind:'edge',id:leid}; ED.multi=[]; renderEdit(); return; }
    }
    var info=targetInfo(ev);
    if(!info){ startMarquee(ev,svg); return; }
    if(info.kind==='edge'){
      ED.sel=info; ED.multi=[];
      startEdgeMove(ev,svg,info.id);
      return;
    }
    if(ED.multi && ED.multi.length &&
       ED.multi.some(function(m){ return m.kind==='shape' && m.id===info.id; })){
      startMultiMove(ev, svg); return;
    }
    var s=shapeById(info.id); if(!s) return;
    var g=svg.querySelector('[data-fid="'+info.id+'"]');
    var before=snap();
    var start=svgPoint(svg,ev), dx=0, dy=0, moved=false;
    function mv(e2){
      var p=svgPoint(svg,e2); dx=p[0]-start[0]; dy=p[1]-start[1];
      if(Math.abs(dx)+Math.abs(dy)>3) moved=true;
      if(moved){
        var rdx=dx, rdy=dy, m=magnetCenters(s,dx,dy); dx=m[0]; dy=m[1];
        if(GRIDON){
          if(dx===rdx) dx+=gridSnapDelta(s.x+dx, s.x+s.w+dx);
          if(dy===rdy) dy+=gridSnapDelta(s.y+dy, s.y+s.h+dy);
        }
      }
      if(g&&moved) g.setAttribute('transform','translate('+dx.toFixed(1)+','+dy.toFixed(1)+')');
      if(moved) updateAlignGuides(svg,s,dx,dy);
    }
    function up(){
      document.removeEventListener('pointermove',mv);
      document.removeEventListener('pointerup',up);
      clearAlign(svg);
      if(moved){ pushHist(before); s.cx+=dx; s.cy+=dy; s.x=s.cx-s.w/2; s.y=s.cy-s.h/2; rerouteConnected(s.id,dx,dy); }
      ED.sel={kind:'shape',id:info.id}; ED.multi=[]; renderEdit();
      if(!moved) highlightSourceLine(s);
    }
    document.addEventListener('pointermove',mv);
    document.addEventListener('pointerup',up);
    ev.preventDefault();
  }

  function startMultiMove(ev, svg){
    var selShape={}, selEdge={}, shapes=[], edges=[], groups=[];
    ED.multi.forEach(function(m){
      if(m.kind==='shape'){ var s=shapeById(m.id); if(s){ shapes.push(s); selShape[m.id]=1; } }
      else { var e=edgeById(m.id); if(e){ edges.push(e); selEdge[m.id]=1; } }
    });
    shapes.forEach(function(s){ var g=svg.querySelector('[data-fid="'+s.id+'"]'); if(g) groups.push(g); });
    edges.forEach(function(e){ var g=svg.querySelector('[data-eid="'+e.id+'"]'); if(g) groups.push(g); });
    var before=snap(), start=svgPoint(svg,ev), dx=0, dy=0, moved=false;
    function mv(e2){
      var p=svgPoint(svg,e2); dx=p[0]-start[0]; dy=p[1]-start[1];
      if(Math.abs(dx)+Math.abs(dy)>3) moved=true;
      if(moved){
        var tf='translate('+dx.toFixed(1)+','+dy.toFixed(1)+')';
        groups.forEach(function(g){ g.setAttribute('transform',tf); });
      }
    }
    function up(){
      document.removeEventListener('pointermove',mv);
      document.removeEventListener('pointerup',up);
      if(moved){
        pushHist(before);
        shapes.forEach(function(s){ s.cx+=dx; s.cy+=dy; s.x=s.cx-s.w/2; s.y=s.cy-s.h/2; });
        edges.forEach(function(e){
          if(e.points) e.points=e.points.map(function(p){ return [p[0]+dx,p[1]+dy]; });
          if(e.lpos) e.lpos=[e.lpos[0]+dx, e.lpos[1]+dy];
        });
        ED.model.edges.forEach(function(e){
          if(selEdge[e.id]) return;
          var f=selShape[e.from], t=selShape[e.to];
          if(!f && !t) return;
          if(e.manual){
            if(f && e.points && e.points.length) e.points[0]=[e.points[0][0]+dx, e.points[0][1]+dy];
            if(t && e.points && e.points.length){ var li=e.points.length-1; e.points[li]=[e.points[li][0]+dx, e.points[li][1]+dy]; }
          } else { rerouteEdge(e); }
        });
      }
      renderEdit();
    }
    document.addEventListener('pointermove',mv);
    document.addEventListener('pointerup',up);
    ev.preventDefault();
  }

  var AXIS_SNAP=6;
  function lineSnapR(){ return 16/Math.min(1, scale||1); }
  function axisSnap(pt,q){
    if(!q) return pt;
    var r=AXIS_SNAP/Math.min(1, scale||1), o=pt.slice();
    if(Math.abs(o[0]-q[0])<r) o[0]=q[0];
    if(Math.abs(o[1]-q[1])<r) o[1]=q[1];
    return o;
  }
  function snapToLine(self, p, nb){
    var R=lineSnapR(), best=null;
    ED.model.edges.forEach(function(o){
      if(o===self) return;
      var P=o.points||[];
      for(var i=0;i<P.length-1;i++){
        var a=P[i], b=P[i+1], vx=b[0]-a[0], vy=b[1]-a[1], L2=vx*vx+vy*vy;
        if(!L2) continue;
        var t=Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/L2));
        var proj=[a[0]+t*vx, a[1]+t*vy], d=Math.hypot(p[0]-proj[0],p[1]-proj[1]);
        if(d>R || (best && d>=best.d)) continue;
        var vert=Math.abs(vx)<0.5, horz=Math.abs(vy)<0.5, pt=proj;
        if(nb && vert && nb[1]>=Math.min(a[1],b[1]) && nb[1]<=Math.max(a[1],b[1]) &&
           Math.abs(nb[1]-proj[1])<=R*2.5) pt=[a[0], nb[1]];
        else if(nb && horz && nb[0]>=Math.min(a[0],b[0]) && nb[0]<=Math.max(a[0],b[0]) &&
           Math.abs(nb[0]-proj[0])<=R*2.5) pt=[nb[0], a[1]];
        best={eid:o.id, pt:pt, d:d, vert:vert, horz:horz};
      }
    });
    return best;
  }
  function setLineTarget(svg, eid){
    [].forEach.call(svg.querySelectorAll('.ed.snapt'),function(g){ if(g.getAttribute('data-eid')!==eid) g.classList.remove('snapt'); });
    if(eid){ var g=svg.querySelector('[data-eid="'+eid+'"]'); if(g) g.classList.add('snapt'); }
  }
  function tidyPoints(P){
    var out=[];
    P.forEach(function(q){ var l=out[out.length-1]; if(!l || Math.abs(l[0]-q[0])>0.01 || Math.abs(l[1]-q[1])>0.01) out.push(q); });
    for(var i=out.length-2;i>=1;i--){
      var a=out[i-1], b=out[i], c=out[i+1];
      if((Math.abs(a[0]-b[0])<0.01 && Math.abs(b[0]-c[0])<0.01) || (Math.abs(a[1]-b[1])<0.01 && Math.abs(b[1]-c[1])<0.01)) out.splice(i,1);
    }
    return out;
  }
  var JOIN_GAP=20;
  function approachPts(nb, end, how){
    function same(a,b){ return Math.abs(a-b)<0.01; }
    if(how==='V') return same(nb[0],end[0]) ? [] : [[end[0],nb[1]]];
    if(how==='H') return same(nb[1],end[1]) ? [] : [[nb[0],end[1]]];
    if(how==='top' || how==='bottom'){
      var outside = how==='top' ? nb[1]<=end[1] : nb[1]>=end[1];
      if(outside) return same(nb[0],end[0]) ? [] : [[end[0],nb[1]]];
      var yy = how==='top' ? end[1]-JOIN_GAP : end[1]+JOIN_GAP;
      return [[nb[0],yy],[end[0],yy]];
    }
    var before = how==='left' ? nb[0]<=end[0] : nb[0]>=end[0];
    if(before) return same(nb[1],end[1]) ? [] : [[nb[0],end[1]]];
    var xx = how==='left' ? end[0]-JOIN_GAP : end[0]+JOIN_GAP;
    return [[xx,nb[1]],[xx,end[1]]];
  }
  function joinToLine(e, vix, how, keepLink){
    var P=e.points, end=P[vix], nb=P[vix===0?1:vix-1];
    if(!keepLink){ if(vix===0) e.from=null; else e.to=null; }
    var add = (nb && how) ? approachPts(nb, end, how) : [];
    if(add.length){
      if(vix===0) P.splice.apply(P,[1,0].concat(add.reverse()));
      else P.splice.apply(P,[vix,0].concat(add));
    }
    e.points=tidyPoints(P);
  }
  function shapeSide(sh, ep){
    if(Math.abs(ep[0]-sh.cx)<0.5 && Math.abs(ep[1]-sh.y)<0.5) return 'top';
    if(Math.abs(ep[0]-sh.cx)<0.5 && Math.abs(ep[1]-sh.y-sh.h)<0.5) return 'bottom';
    if(Math.abs(ep[1]-sh.cy)<0.5 && Math.abs(ep[0]-sh.x)<0.5) return 'left';
    if(Math.abs(ep[1]-sh.cy)<0.5 && Math.abs(ep[0]-sh.x-sh.w)<0.5) return 'right';
    return null;
  }
  function startHandleDrag(ev, svg, ht){
    var e=edgeById(ED.sel.id); if(!e) return;
    var before=snap();
    var isMid=ht.classList.contains('mid'), vix;
    if(isMid){
      var seg=parseInt(ht.getAttribute('data-seg'),10);
      var mp=[(e.points[seg][0]+e.points[seg+1][0])/2,(e.points[seg][1]+e.points[seg+1][1])/2];
      e.points.splice(seg+1,0,mp);
      vix=seg+1;
    } else { vix=parseInt(ht.getAttribute('data-vix'),10); }
    var endpoint=(vix===0||vix===e.points.length-1);
    removeHandles(svg, ht);
    var pushed=false, moved=false, curSnap=null, lineSnap=null, lastLen=edgeLenR(e);
    function mv(ev2){
      var p=svgPoint(svg,ev2);
      moved=true;
      if(!pushed){ pushHist(before); pushed=true; e.manual=true; e.arrowExplicit=true; }
      var pt=[p[0],p[1]];
      if(endpoint){
        var nb=e.points[vix===0?1:vix-1];
        curSnap=nearestAnchor(p); lineSnap=null;
        if(curSnap){ pt=[curSnap.pt[0],curSnap.pt[1]]; }
        else {
          var sid0=shapeAt(p);
          if(sid0) curSnap={sid:sid0, pt:null};
          else {
            lineSnap=snapToLine(e,p,nb);
            pt = lineSnap ? lineSnap.pt.slice() : axisSnap(pt,nb);
          }
        }
        setSnapTarget(svg, curSnap?curSnap.sid:null);
        setLineTarget(svg, lineSnap?lineSnap.eid:null);
      } else {
        pt=axisSnap(axisSnap(pt,e.points[vix-1]),e.points[vix+1]);
      }
      e.points[vix]=pt;
      moveHandleEl(ht,pt);
      updateEdgePolyline(svg,e);
      setEdgeOrtho(svg,e, vertexIsOrtho(e,vix));
      var rl=edgeLenR(e);
      maybeFlashEdgeLen(e,lastLen,rl); lastLen=rl;
      markFlash(svg);
    }
    function up(){
      document.removeEventListener('pointermove',mv);
      document.removeEventListener('pointerup',up);
      setEdgeOrtho(svg,e,false);
      setSnapTarget(svg,null); setLineTarget(svg,null);
      if(!moved){ if(isMid) e.points.splice(vix,1); renderEdit(); return; }
      if(endpoint && lineSnap) joinToLine(e,vix,lineSnap.vert?'H':(lineSnap.horz?'V':null));
      else if(endpoint){
        var p=e.points[vix], sid=(curSnap&&curSnap.sid)||shapeAt(p);
        if(sid){
          var sh=shapeById(sid);
          e.points[vix]=(curSnap&&curSnap.pt)?curSnap.pt:snapBorder(sh,p);
          if(vix===0) e.from=sid; else e.to=sid;
          joinToLine(e,vix,shapeSide(sh,e.points[vix]),true);
        }
        else { if(vix===0) e.from=null; else e.to=null; }
      }
      renderEdit();
    }
    document.addEventListener('pointermove',mv);
    document.addEventListener('pointerup',up);
    ev.preventDefault(); ev.stopPropagation();
  }

  function startEdgeMove(ev, svg, eid){
    var e=edgeById(eid); if(!e) return;
    var before=snap(), start=svgPoint(svg,ev);
    var orig=e.points.map(function(p){ return p.slice(); });
    removeHandles(svg);
    var pushed=false, moved=false;
    function mv(ev2){
      var p=svgPoint(svg,ev2), dx=p[0]-start[0], dy=p[1]-start[1];
      if(Math.abs(dx)+Math.abs(dy)>3) moved=true;
      if(moved){
        if(!pushed){ pushHist(before); pushed=true; e.manual=true; e.arrowExplicit=true; e.from=null; e.to=null; }
        e.points=orig.map(function(q){ return [q[0]+dx,q[1]+dy]; });
        updateEdgePolyline(svg,e);
      }
    }
    function up(){
      document.removeEventListener('pointermove',mv);
      document.removeEventListener('pointerup',up);
      renderEdit();
    }
    document.addEventListener('pointermove',mv);
    document.addEventListener('pointerup',up);
    ev.preventDefault();
  }

  function startLabelDrag(ev, svg, eid){
    var e=edgeById(eid); if(!e) return;
    var before=snap();
    removeHandles(svg);
    var pushed=false;
    function lblText(){ return svg.querySelector('[data-eid="'+eid+'"] text.elbl'); }
    function mv(ev2){
      var p=svgPoint(svg,ev2);
      if(!pushed){ pushHist(before); pushed=true; }
      e.lpos=[p[0],p[1]];
      var t=lblText(); if(t){ t.setAttribute('x',p[0]); t.setAttribute('y',p[1]); t.setAttribute('text-anchor','middle'); }
    }
    function up(){
      document.removeEventListener('pointermove',mv);
      document.removeEventListener('pointerup',up);
      renderEdit();
    }
    document.addEventListener('pointermove',mv);
    document.addEventListener('pointerup',up);
    ev.preventDefault(); ev.stopPropagation();
  }

  function setHint(t){ var h=$('edHint'); if(h) h.textContent=t||''; }
  function shapeOptionList(sel){
    return '<option value="">— нет —</option>'+ED.model.shapes.map(function(s){
      var t=(s.lines&&s.lines[0])||''; t=t||({process:'процесс',terminal:'терминатор',decision:'решение',io:'данные',predef:'процесс',loopstart:'цикл',loopend:'цикл',prep:'подготовка',connector:'•'}[s.type]||s.type);
      if(t.length>20) t=t.slice(0,20)+'…';
      return '<option value="'+s.id+'"'+(s.id===sel?' selected':'')+'>'+escHtml(t)+'</option>';
    }).join('');
  }
  function typeSelect(id,cur){
    return '<select id="'+id+'" class="ed-sel">'+edTypes().map(function(t){
      return '<option value="'+t[0]+'"'+(t[0]===cur?' selected':'')+'>'+t[1]+'</option>';
    }).join('')+'</select>';
  }
  function buildPanel(){
    if(!ED.on){ edbar.style.display='none'; edbar.innerHTML=''; return; }
    edbar.style.display='block';
    var html='<div class="ed-row">'+
      '<button class="ed-btn arr" id="edUndo" title="Вернуть (отменить последнее действие)"'+(ED.undo.length?'':' disabled')+'>←</button>'+
      '<button class="ed-btn arr" id="edRedo" title="Вперёд (повторить отменённое)"'+(ED.redo.length?'':' disabled')+'>→</button>'+
      (currentSelectionList().length?'<button class="ed-btn" id="edCopy" title="Копировать (Ctrl+C)">Копировать</button>':'')+
      (clipboardHas()?'<button class="ed-btn" id="edPaste" title="Вставить (Ctrl+V)">Вставить</button>':'')+
      '<span class="ed-div"></span>'+
      '<button class="ed-btn" id="edAdd">＋ Фигура</button>'+typeSelect('edAddType','process')+
      '<button class="ed-btn'+(ED.addEdge?' on':'')+'" id="edAddEdge" title="Концы линии можно ставить на фигуру, на другую линию или в пустое место">＋ Линия</button>'+
      '<button class="ed-btn ok" id="edSave">Сохранить</button>'+
      '<span class="ed-hint" id="edHint"></span></div>';
    if(ED.multi && ED.multi.length){
      html+='<div class="ed-row"><span class="ed-lab">Выделено объектов: '+ED.multi.length+'</span>'+
        (linkedEdges(selShapeIds()).length?detachBtn('edDetachMulti'):'')+
        '<button class="ed-btn danger" id="edDelMulti">Удалить выделенное</button>'+
        '<span class="ed-hint">или клавиша Delete · клик по пустому месту — снять выделение.</span></div>';
    } else if(ED.sel&&ED.sel.kind==='shape'){
      var s=shapeById(ED.sel.id);
      if(s){
        html+='<div class="ed-row"><label class="ed-lab">Тип</label>'+typeSelect('edType',s.type)+
          '<label class="ed-lab">Ширина</label><input id="edW" class="ed-num" type="number" min="20" max="620" value="'+Math.round(s.w)+'">'+
          '<label class="ed-lab">Высота</label><input id="edH" class="ed-num" type="number" min="20" max="620" value="'+Math.round(s.h)+'">'+
          detachBtn('edDetach')+
          '<button class="ed-btn danger" id="edDel">Удалить фигуру</button></div>'+
          '<div class="ed-row"><label class="ed-lab">Текст</label>'+
          '<textarea id="edText" class="ed-inp" rows="1">'+escHtml(s.lines.join('\n'))+'</textarea></div>';
      }
    } else if(ED.sel&&ED.sel.kind==='edge'){
      var e=edgeById(ED.sel.id);
      if(e){
        html+='<div class="ed-row"><label class="ed-lab">От</label>'+
          '<select id="edFrom" class="ed-sel">'+shapeOptionList(e.from)+'</select>'+
          '<label class="ed-lab">К</label>'+
          '<select id="edTo" class="ed-sel">'+shapeOptionList(e.to)+'</select>'+
          '<label class="ed-chk"><input type="checkbox" id="edArrow"'+(e.arrow?' checked':'')+'> стрелка</label>'+
          '<button class="ed-btn danger" id="edDelE">Удалить линию</button></div>'+
          '<div class="ed-row"><label class="ed-lab">Подпись</label>'+
          '<input id="edLabel" class="ed-inp" style="flex:0 0 110px;min-width:0" value="'+escAttr(e.label||'')+'">'+
          '<button class="ed-btn" id="edLblYes">Да</button>'+
          '<button class="ed-btn" id="edLblNo">Нет</button>'+
          '<button class="ed-btn" id="edLblClr">Без подписи</button>'+
          '<span class="ed-hint">подпись можно перетащить · □ концы — тянуть/привязать · ○ середина — излом · по линии — перенести.</span></div>';
      }
    } else {
      html+='<div class="ed-row"><span class="ed-hint">Кликните фигуру или линию, чтобы её изменить · фигуру можно перетащить мышью.</span></div>';
    }
    edbar.innerHTML=html;
    wirePanel();
    if(ED.addEdge) setHint(ED.addEdge.start?ADD_HINT2:ADD_HINT1);
  }
  function wirePanel(){
    var b;
    if(b=$('edUndo')) b.onclick=doUndo;
    if(b=$('edRedo')) b.onclick=doRedo;
    if(b=$('edCopy')) b.onclick=copySelection;
    if(b=$('edPaste')) b.onclick=pasteClipboard;
    if(b=$('edAdd')) b.onclick=addShape;
    if(b=$('edAddEdge')) b.onclick=function(){ ED.addEdge=ED.addEdge?null:{start:null}; ED.multi=[]; ED.sel=null; renderEdit(); };
    if(b=$('edSave')) b.onclick=persistSave;
    if(b=$('edDelMulti')) b.onclick=deleteMulti;
    if(b=$('edDetach')) b.onclick=detachSelection;
    if(b=$('edDetachMulti')) b.onclick=detachSelection;
    if(b=$('edType')) b.onchange=function(){ var s=shapeById(ED.sel.id); if(s){ pushHist(); s.type=this.value; relayoutShape(s); renderEdit(); } };
    if(b=$('edW')){
      b.onfocus=function(){ ED._baseline=snap(); ED._dirty=false; };
      b.oninput=function(){ var s=shapeById(ED.sel.id), v=parseFloat(this.value); if(s&&isFinite(v)){ beginContinuous(); var o=Math.round(s.w); setSize(s,'w',v); maybeFlash(s,'w',o,Math.round(s.w)); renderSVGOnly(); } };
    }
    if(b=$('edH')){
      b.onfocus=function(){ ED._baseline=snap(); ED._dirty=false; };
      b.oninput=function(){ var s=shapeById(ED.sel.id), v=parseFloat(this.value); if(s&&isFinite(v)){ beginContinuous(); var o=Math.round(s.h); setSize(s,'h',v); maybeFlash(s,'h',o,Math.round(s.h)); renderSVGOnly(); } };
    }
    if(b=$('edText')){
      var ta=b;
      ta.style.height='auto'; ta.style.height=Math.min(120,ta.scrollHeight+2)+'px';
      ta.onfocus=function(){ ED._baseline=snap(); ED._dirty=false; };
      ta.oninput=function(){
        var s=shapeById(ED.sel.id); if(!s) return;
        beginContinuous();
        s.lines=this.value.split('\n'); relayoutShape(s);
        this.style.height='auto'; this.style.height=Math.min(120,this.scrollHeight+2)+'px';
        renderSVGOnly();
      };
    }
    if(b=$('edDel')) b.onclick=deleteSel;
    if(b=$('edFrom')) b.onchange=function(){ var e=edgeById(ED.sel.id); if(e){ pushHist(); e.from=this.value||null; e.manual=false; rerouteEdge(e); renderEdit(); } };
    if(b=$('edTo')) b.onchange=function(){ var e=edgeById(ED.sel.id); if(e){ pushHist(); e.to=this.value||null; e.manual=false; rerouteEdge(e); renderEdit(); } };
    if(b=$('edArrow')) b.onchange=function(){ var e=edgeById(ED.sel.id); if(e){ pushHist(); e.arrow=this.checked; renderSVGOnly(); } };
    if(b=$('edLabel')){
      b.onfocus=function(){ ED._baseline=snap(); ED._dirty=false; };
      b.oninput=function(){ var e=edgeById(ED.sel.id); if(e){ beginContinuous(); e.label=this.value; renderSVGOnly(); } };
    }
    function setLbl(v){ var e=edgeById(ED.sel.id); if(e){ pushHist(); e.label=v; renderEdit(); } }
    if(b=$('edLblYes')) b.onclick=function(){ setLbl('Да'); };
    if(b=$('edLblNo')) b.onclick=function(){ setLbl('Нет'); };
    if(b=$('edLblClr')) b.onclick=function(){ var e=edgeById(ED.sel.id); if(e){ pushHist(); e.label=''; e.lpos=null; renderEdit(); } };
    if(b=$('edDelE')) b.onclick=deleteSel;
  }

  function addShape(){
    pushHist();
    var type=$('edAddType')?$('edAddType').value:'process';
    var sc=$('scroll'), cx=natW/2, cy=natH/2;
    if(sc&&sc.clientWidth){ cx=(sc.scrollLeft+sc.clientWidth/2)/scale; cy=(sc.scrollTop+sc.clientHeight/2)/scale; }
    var s={ id:'s'+(ED.nextId++), type:type, cx:cx, cy:cy,
            lines:[type==='connector'?'':'текст'], fontSize:13, lineH:17, w:24, h:24 };
    relayoutShape(s);
    ED.model.shapes.push(s); ED.sel={kind:'shape',id:s.id}; ED.multi=[]; renderEdit();
  }
  function selShapeIds(){
    var ids={}; currentSelectionList().forEach(function(m){ if(m.kind==='shape') ids[m.id]=1; });
    return ids;
  }
  function linkedEdges(ids){
    return ED.model.edges.filter(function(e){ return (e.from && ids[e.from]) || (e.to && ids[e.to]); });
  }
  function detachBtn(id){
    var n=linkedEdges(selShapeIds()).length;
    return '<button class="ed-btn" id="'+id+'"'+(n?'':' disabled')+
      ' title="'+(n?'Линии останутся на месте, а фигуру можно будет двигать или удалить отдельно. '+
      'Прикрепить обратно — перетащите конец линии на фигуру':'К фигуре не прикреплено ни одной линии')+
      '">Открепить от линий</button>';
  }
  function detachSelection(){
    var ids=selShapeIds(), list=linkedEdges(ids);
    if(!list.length) return;
    pushHist();
    list.forEach(function(e){
      if(e.from && ids[e.from]) e.from=null;
      if(e.to && ids[e.to]) e.to=null;
      e.manual=true; e.arrowExplicit=true;
    });
    renderEdit();
    setHint('Линии откреплены: фигуру можно двигать отдельно');
  }
  function deleteSel(){
    if(!ED.sel) return;
    pushHist();
    if(ED.sel.kind==='shape'){
      var id=ED.sel.id;
      ED.model.shapes=ED.model.shapes.filter(function(s){ return s.id!==id; });
      ED.model.edges=ED.model.edges.filter(function(e){ return e.from!==id&&e.to!==id; });
    } else {
      ED.model.edges=ED.model.edges.filter(function(e){ return e.id!==ED.sel.id; });
    }
    ED.sel=null; renderEdit();
  }
  function stripModel(m){
    function strip(o){ var c={}; for(var k in o) c[k]=o[k]; delete c.id; return c; }
    return { width:m.width, height:m.height, titles:[],
      shapes:m.shapes.map(strip), edges:m.edges.map(strip) };
  }
  function cleanEditModel(){ return stripModel(ED.model); }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function snap(){ return clone(ED.model); }
  function pushHist(state){
    ED.undo.push(state||snap());
    if(ED.undo.length>80) ED.undo.shift();
    ED.redo=[];
    updateHistButtons();
  }
  function beginContinuous(){ if(!ED._dirty){ pushHist(ED._baseline||snap()); ED._dirty=true; } }
  function updateHistButtons(){
    var u=$('edUndo'), r=$('edRedo');
    if(u) u.disabled = ED.undo.length===0;
    if(r) r.disabled = ED.redo.length===0;
  }
  function doUndo(){
    if(!ED.undo.length) return;
    ED.redo.push(snap());
    ED.model=ED.undo.pop();
    ED.sel=null; ED.addEdge=null; ED._dirty=false;
    renderEdit();
  }
  function doRedo(){
    if(!ED.redo.length) return;
    ED.undo.push(snap());
    ED.model=ED.redo.pop();
    ED.sel=null; ED.addEdge=null; ED._dirty=false;
    renderEdit();
  }
  function resetHistory(){ ED.undo=[]; ED.redo=[]; ED._dirty=false; ED._baseline=null; }
  function bumpNextId(){
    var mx=0;
    ED.model.shapes.concat(ED.model.edges).forEach(function(o){
      var n=parseInt(String(o.id).replace(/\D/g,''),10); if(isFinite(n)&&n>mx) mx=n;
    });
    ED.nextId=mx+1;
  }
  function persistSave(){
    ED.saved=clone(ED.model);
    ED.savedCode=code.value;
    resetHistory();
    buildPanel();
    var h=$('edHint'); if(h){ h.textContent='Правки сохранены ✓'; h.style.color='#2ea043'; h.style.fontStyle='normal'; }
  }
  function clearSaved(){ ED.saved=null; ED.savedCode=null; resetHistory(); }
  function markSavedBadge(on){
    var t=$('edToggle'); if(!t) return;
    t.style.boxShadow = on ? 'inset 0 0 0 2px #2ea043' : '';
    t.title = !SUP.token ? 'Редактирование схемы доступно после входа'
            : on ? 'Есть сохранённые правки — нажмите, чтобы продолжить их редактирование'
                 : 'Редактировать схему вручную';
  }

  $('edToggle').addEventListener('click',function(){
    if(!ED.on){
      if(!SUP.token){
        authSetMode('reg'); showTab('auth'); AUTH.after='edit';
        authMsg('Редактирование схемы доступно после регистрации — это бесплатно',true);
        return;
      }
      if(!ED.saved && needBuildFirst()) return;
      var base;
      if(ED.saved){ base=clone(ED.saved); }
      else {
        base=toEditModel(builtModel());
      }
      errBox.style.display='none'; sheet.style.visibility='visible';
      ED.on=true; this.classList.add('active'); markSavedBadge(false);
      ED.model=base; ED.sel=null; ED.multi=[]; ED.addEdge=null; bumpNextId(); resetHistory();
      renderEdit();
    } else {
      if(!ED.undo.length) return closeEditor(true);
      askChoice({
        title:'Выйти из редактора?',
        text: ED.saved
          ? 'Последние правки ещё не сохранены. Если выйти без сохранения, схема вернётся к последнему сохранённому виду.'
          : 'Последние правки ещё не сохранены. Если выйти без сохранения, схема вернётся к исходному виду.',
        buttons:[{label:'Остаться', value:null},
                 {label:'Выйти без сохранения', value:'discard', kind:'dng'},
                 {label:'Сохранить и выйти', value:'save', kind:'pri', focus:true}]
      }).then(function(v){
        if(!ED.on || !v) return;
        if(v==='save') persistSave();
        closeEditor(true);
      });
    }
  });
  function closeEditor(rebuild){
    ED.on=false; $('edToggle').classList.remove('active');
    ED.sel=null; ED.multi=[]; ED.addEdge=null; showLineHl(0);
    if(ED.flashTimer){ clearTimeout(ED.flashTimer); ED.flashTimer=null; } ED.flash=null;
    edbar.style.display='none'; edbar.innerHTML='';
    markSavedBadge(!!ED.saved);
    if(rebuild) build(false);
  }

  function askChoice(o){
    return new Promise(function(resolve){

  return {
    ED: ED,
    init: init,
    toggle: function() {
      if (!ED.on) {
        if (!window.BUILT || !window.BUILT.res || !window.BUILT.res.model) {
          if (window.app && window.app.build) window.app.build();
        }
        if (!window.BUILT || !window.BUILT.res || !window.BUILT.res.model) return;
        ED.on = true;
        if (ENV.edToggle) ENV.edToggle.classList.add('active');
        toEditModel(ED.saved ? clone(ED.saved) : window.BUILT.res.model);
        renderEdit();
      } else {
        closeEditor(false);
      }
    },
    close: function(rebuild) {
      closeEditor(rebuild);
    },
    getModel: function() {
      if (ED.on) return cleanEditModel();
      if (ED.saved) return stripModel(ED.saved);
      return window.BUILT && window.BUILT.res ? window.BUILT.res.model : null;
    },
    hasSaved: function() { return !!ED.saved; },
    clearSaved: clearSaved
  };
});
