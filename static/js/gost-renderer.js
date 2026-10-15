// gost-renderer.js - Strict GOST 19.701-90 SVG and Visio VSDX generator
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GOSTRenderer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  'use strict';

  function escapeXML(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function textBlock(cx, cy, lines, fontSize, lineH){
    fontSize = fontSize || 13; lineH = lineH || 17;
    var n = lines.length;
    var startY = cy - (n-1)*lineH/2;
    var out = '';
    for (var i = 0; i < n; i++) {
      out += '<text class="tx" x="'+r(cx)+'" y="'+r(startY + i*lineH)+'" '+
             'style="font-size:'+fontSize+'px" '+
             'text-anchor="middle" dominant-baseline="central">'+
             escapeXML(lines[i])+'</text>';
    }
    return out;
  }
  function r(n){ return Math.round(n*100)/100; }

  function shapeToSVG(sh){
    var x = sh.x, y = sh.y, w = sh.w, h = sh.h, cx = sh.cx, cy = sh.cy;
    var body = '';
    switch (sh.type) {
      case 'terminal': {
        var rx = h/2;
        body = '<rect class="sh" x="'+r(x)+'" y="'+r(y)+'" width="'+r(w)+
               '" height="'+r(h)+'" rx="'+r(rx)+'" ry="'+r(rx)+'"/>';
        break;
      }
      case 'process':
      case 'import': {
        var cls = sh.dashed ? 'sh dash' : 'sh';
        body = '<rect class="'+cls+'" x="'+r(x)+'" y="'+r(y)+'" width="'+r(w)+
               '" height="'+r(h)+'"/>';
        break;
      }
      case 'predef': {
        body = '<rect class="sh" x="'+r(x)+'" y="'+r(y)+'" width="'+r(w)+
               '" height="'+r(h)+'"/>';
        var inset = 8;
        body += '<line class="ln" x1="'+r(x+inset)+'" y1="'+r(y)+'" x2="'+
                r(x+inset)+'" y2="'+r(y+h)+'"/>';
        body += '<line class="ln" x1="'+r(x+w-inset)+'" y1="'+r(y)+'" x2="'+
                r(x+w-inset)+'" y2="'+r(y+h)+'"/>';
        break;
      }
      case 'io': {
        var sk = sh.skew || 18;
        var pts = [[x+sk,y],[x+w,y],[x+w-sk,y+h],[x,y+h]];
        body = '<polygon class="sh" points="'+ptsStr(pts)+'"/>';
        break;
      }
      case 'decision': {
        var pts2 = [[cx,y],[x+w,cy],[cx,y+h],[x,cy]];
        body = '<polygon class="sh" points="'+ptsStr(pts2)+'"/>';
        break;
      }
      case 'loopstart': {
        var c = sh.corner || 14;
        var pts3 = [[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+h],[x,y+h],[x,y+c]];
        body = '<polygon class="sh" points="'+ptsStr(pts3)+'"/>';
        break;
      }
      case 'loopend': {
        var c2 = sh.corner || 14;
        var pts4 = [[x,y],[x+w,y],[x+w,y+h-c2],[x+w-c2,y+h],[x+c2,y+h],[x,y+h-c2]];
        body = '<polygon class="sh" points="'+ptsStr(pts4)+'"/>';
        break;
      }
      case 'prep': {
        var pc = Math.min(h*0.9, w*0.16);
        var pts5 = [[x+pc,y],[x+w-pc,y],[x+w,cy],[x+w-pc,y+h],[x+pc,y+h],[x,cy]];
        body = '<polygon class="sh" points="'+ptsStr(pts5)+'"/>';
        break;
      }
      case 'connector': {
        var cr = (sh.w ? sh.w/2 : 11);
        body = '<circle class="sh" cx="'+r(cx)+'" cy="'+r(cy)+'" r="'+r(cr)+'"/>';
        break;
      }
      default:
        body = '<rect class="sh" x="'+r(x)+'" y="'+r(y)+'" width="'+r(w)+
               '" height="'+r(h)+'"/>';
    }
    if (sh.srcLine != null)
      body = body.replace(/^<(rect|polygon|circle) /, '<$1 data-srcline="'+sh.srcLine+'" ');
    if (sh.lines && sh.lines.length && sh.lines.join('')!=='')
      body += textBlock(cx, cy, sh.lines, sh.fontSize, sh.lineH);
    if (sh.id != null) {
      var hit = '<rect x="'+r(x)+'" y="'+r(y)+'" width="'+r(w)+'" height="'+r(h)+
                '" fill="transparent"/>';
      return '<g class="fig" data-fid="'+sh.id+'">'+hit+body+'</g>';
    }
    return body;
  }

  function ptsStr(pts){
    return pts.map(function(p){ return r(p[0])+','+r(p[1]); }).join(' ');
  }

  function edgeNeedsArrow(pts){
    for (var i = 1; i < pts.length; i++)
      if (pts[i][1] < pts[i-1][1] - 2) return true;
    return false;
  }

  function edgeToSVG(e){
    var pts = e.points;
    var arrow = (e.arrowExplicit ? !!e.arrow : edgeNeedsArrow(pts));
    var poly = '<polyline class="edge" points="'+ptsStr(pts)+'" fill="none"'+
               (arrow ? ' marker-end="url(#arr)"' : '')+'/>';
    var lbl = '';
    if (e.label) {
      var pos = e.lpos ? {x:e.lpos[0], y:e.lpos[1], anchor:'middle'} : labelPos(pts);
      lbl = '<text class="elbl" x="'+r(pos.x)+'" y="'+r(pos.y)+'" '+
            'text-anchor="'+pos.anchor+'">'+escapeXML(e.label)+'</text>';
    }
    if (e.id != null) {
      var hit = '<polyline points="'+ptsStr(pts)+'" fill="none" '+
                'stroke="transparent" stroke-width="14"/>';
      return '<g class="ed" data-eid="'+e.id+'">'+hit+poly+lbl+'</g>';
    }
    return poly + lbl;
  }

  function labelPos(pts){
    var a = pts[0], b = pts[1];
    if (Math.abs(b[0]-a[0]) < Math.abs(b[1]-a[1])) {
      return { x:a[0]+6, y:(a[1]+b[1])/2, anchor:'start' };
    } else {
      return { x:(a[0]+b[0])/2, y:Math.min(a[1],b[1])-5, anchor:'middle' };
    }
  }

  function renderModelSVG(m){
    var width = m.width, height = m.height;
    var shapesSVG = m.shapes.map(shapeToSVG).join('');
    var edgesSVG = m.edges.map(edgeToSVG).join('');
    var titlesSVG = (m.titles||[]).map(function(t){
      return '<text class="title" x="'+r(t.x)+'" y="'+r(t.y)+
             '" text-anchor="start">'+escapeXML(t.text)+'</text>';
    }).join('');
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" '+
      'viewBox="0 0 '+r(width)+' '+r(height)+'" '+
      'width="'+r(width)+'" height="'+r(height)+'" '+
      'font-family="var(--diagram-font, \'IBM Plex Mono\', monospace)">'+
      '<defs><marker id="arr" markerWidth="9" markerHeight="9" '+
      'refX="7.5" refY="4" orient="auto" markerUnits="userSpaceOnUse">'+
      '<path d="M0,0 L8,4 L0,8 Z" fill="var(--ink,#1a1a2e)"/></marker>'+
      '<style>'+
      '.sh{fill:var(--paper,#fff);stroke:var(--ink,#1a1a2e);stroke-width:1.6;'+
        'transition:fill .45s ease,stroke .45s ease;}'+
      '.dash{stroke-dasharray:6 4;}'+
      '.ln{stroke:var(--ink,#1a1a2e);stroke-width:1.6;}'+
      '.edge{stroke:var(--ink,#1a1a2e);stroke-width:1.4;}'+
      '.tx{fill:var(--ink,#1a1a2e);}'+
      '.elbl{fill:var(--ink,#1a1a2e);font-size:12px;font-weight:600;}'+
      '.title{fill:var(--ink,#1a1a2e);font-size:15px;font-weight:700;}'+
      '.tx{pointer-events:none;}'+
      'svg>.sh[data-srcline]{cursor:pointer;}'+
      '.sh.hl{stroke:var(--accent,#2547ff);stroke-width:2.6;'+
        'filter:drop-shadow(0 1px 6px rgba(37,71,255,.35));'+
        'transition:stroke .12s ease,stroke-width .12s ease;}'+
      '.fig{cursor:move;}.ed{cursor:pointer;}'+
      '.fig.fflash .sh{fill:#d6f4df;stroke:#2ea043;stroke-width:2.4;}'+
      '.fig.sel .sh{stroke:var(--accent,#a81e38);stroke-width:2.6;}'+
      '.ed.sel .edge{stroke:var(--accent,#a81e38);stroke-width:2.8;}'+
      '.ed.eflash .edge{stroke:#2ea043;stroke-width:2.8;}'+
      '.ed.eortho .edge{stroke:#1f6feb;stroke-width:3;}'+
      '.fig.msel .sh{stroke:var(--accent,#a81e38);stroke-width:2.6;}'+
      '.fig.snapt .sh{transition:none;stroke:#1f6feb;stroke-width:3;}'+
      '.ed.snapt .edge{stroke:#1f6feb;stroke-width:3;}'+
      '.adl{fill:none;stroke:#1f6feb;stroke-width:2;stroke-dasharray:6 4;pointer-events:none;}'+
      '.adl-pt{fill:#1f6feb;pointer-events:none;}'+
      'svg.adding,svg.adding .fig,svg.adding .ed{cursor:crosshair;}'+
      '.fig.alit .sh{transition:none;stroke:#2ea043;stroke-width:2.6;}'+
      '.algn{stroke:#2ea043;stroke-width:1.5;stroke-dasharray:6 5;pointer-events:none;}'+
      '.ed.msel .edge{stroke:var(--accent,#a81e38);stroke-width:2.8;}'+
      '.marquee{fill:rgba(31,111,235,0.12);stroke:#1f6feb;stroke-width:1;stroke-dasharray:5 4;pointer-events:none;}'+
      '.edh{fill:#fff;stroke:var(--accent,#a81e38);stroke-width:1.5;cursor:grab;}'+
      '.edh.mid{fill:var(--accent,#a81e38);stroke:none;opacity:.5;cursor:copy;}'+
      '.edh.lbl{fill:#1f6feb;stroke:#fff;stroke-width:1.5;cursor:move;}'+
      '.ed.sel .elbl{cursor:move;}'+
      '</style></defs>'+
      '<rect x="0" y="0" width="'+r(width)+'" height="'+r(height)+
      '" fill="var(--paper,#fff)"/>'+
      edgesSVG + shapesSVG + titlesSVG +
      '</svg>');
  }

  function shiftShape(sh, dx, dy){
    var c = {};
    for (var k in sh) c[k] = sh[k];
    c.x = sh.x + dx; c.y = sh.y + dy;
    if (sh.cx != null) c.cx = sh.cx + dx;
    if (sh.cy != null) c.cy = sh.cy + dy;
    return c;
  }

  var __VSDX_TMPL__ = {"ct":"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/visio/document.xml\" ContentType=\"application/vnd.ms-visio.drawing.main+xml\"/><Override PartName=\"/visio/pages/pages.xml\" ContentType=\"application/vnd.ms-visio.pages+xml\"/><Override PartName=\"/visio/pages/page1.xml\" ContentType=\"application/vnd.ms-visio.page+xml\"/><Override PartName=\"/visio/windows.xml\" ContentType=\"application/vnd.ms-visio.windows+xml\"/><Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/><Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/><Override PartName=\"/docProps/custom.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.custom-properties+xml\"/></Types>","rootRels":"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/><Relationship Id=\"rId1\" Type=\"http://schemas.microsoft.com/visio/2010/relationships/document\" Target=\"visio/document.xml\"/><Relationship Id=\"rId5\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties\" Target=\"docProps/custom.xml\"/><Relationship Id=\"rId4\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/></Relationships>","docRels":"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId3\" Type=\"http://schemas.microsoft.com/visio/2010/relationships/windows\" Target=\"windows.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.microsoft.com/visio/2010/relationships/pages\" Target=\"pages/pages.xml\"/></Relationships>","document":"<?xml version='1.0' encoding='utf-8' ?>\r\n<VisioDocument xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships' xml:space='preserve'><DocumentSettings TopPage='0' DefaultTextStyle='3' DefaultLineStyle='3' DefaultFillStyle='3' DefaultGuideStyle='4'><GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions><SnapAngles/><DynamicGridEnabled>1</DynamicGridEnabled><ProtectStyles>0</ProtectStyles><ProtectShapes>0</ProtectShapes><ProtectMasters>0</ProtectMasters><ProtectBkgnds>0</ProtectBkgnds></DocumentSettings><Colors><ColorEntry IX='24' RGB='#7F7F7F'/><ColorEntry IX='25' RGB='#FFFFFF'/></Colors><FaceNames><FaceName NameU='Calibri' UnicodeRanges='-469750017 -1073732485 9 0' CharSets='536871423 0' Panose='2 15 5 2 2 2 4 3 2 4' Flags='325'/></FaceNames><StyleSheets><StyleSheet ID='0' NameU='No Style' IsCustomNameU='1' Name='No Style' IsCustomName='1'><Cell N='EnableLineProps' V='1'/><Cell N='EnableFillProps' V='1'/><Cell N='EnableTextProps' V='1'/><Cell N='HideForApply' V='0'/><Cell N='LineWeight' V='0.01041666666666667'/><Cell N='LineColor' V='0'/><Cell N='LinePattern' V='1'/><Cell N='Rounding' V='0'/><Cell N='EndArrowSize' V='2'/><Cell N='BeginArrow' V='0'/><Cell N='EndArrow' V='0'/><Cell N='LineCap' V='0'/><Cell N='BeginArrowSize' V='2'/><Cell N='LineColorTrans' V='0'/><Cell N='CompoundType' V='0'/><Cell N='FillForegnd' V='1'/><Cell N='FillBkgnd' V='0'/><Cell N='FillPattern' V='1'/><Cell N='ShdwForegnd' V='0'/><Cell N='ShdwPattern' V='0'/><Cell N='FillForegndTrans' V='0'/><Cell N='FillBkgndTrans' V='0'/><Cell N='ShdwForegndTrans' V='0'/><Cell N='ShapeShdwType' V='0'/><Cell N='ShapeShdwOffsetX' V='0'/><Cell N='ShapeShdwOffsetY' V='0'/><Cell N='ShapeShdwObliqueAngle' V='0'/><Cell N='ShapeShdwScaleFactor' V='1'/><Cell N='ShapeShdwBlur' V='0'/><Cell N='ShapeShdwShow' V='0'/><Cell N='LeftMargin' V='0'/><Cell N='RightMargin' V='0'/><Cell N='TopMargin' V='0'/><Cell N='BottomMargin' V='0'/><Cell N='VerticalAlign' V='1'/><Cell N='TextBkgnd' V='0'/><Cell N='DefaultTabStop' V='0.5905511811023622'/><Cell N='TextDirection' V='0'/><Cell N='TextBkgndTrans' V='0'/><Cell N='LockWidth' V='0'/><Cell N='LockHeight' V='0'/><Cell N='LockMoveX' V='0'/><Cell N='LockMoveY' V='0'/><Cell N='LockAspect' V='0'/><Cell N='LockDelete' V='0'/><Cell N='LockBegin' V='0'/><Cell N='LockEnd' V='0'/><Cell N='LockRotate' V='0'/><Cell N='LockCrop' V='0'/><Cell N='LockVtxEdit' V='0'/><Cell N='LockTextEdit' V='0'/><Cell N='LockFormat' V='0'/><Cell N='LockGroup' V='0'/><Cell N='LockCalcWH' V='0'/><Cell N='LockSelect' V='0'/><Cell N='LockCustProp' V='0'/><Cell N='LockFromGroupFormat' V='0'/><Cell N='LockThemeColors' V='0'/><Cell N='LockThemeEffects' V='0'/><Cell N='LockThemeConnectors' V='0'/><Cell N='LockThemeFonts' V='0'/><Cell N='LockThemeIndex' V='0'/><Cell N='LockReplace' V='0'/><Cell N='LockVariation' V='0'/><Cell N='NoObjHandles' V='0'/><Cell N='NonPrinting' V='0'/><Cell N='NoCtlHandles' V='0'/><Cell N='NoAlignBox' V='0'/><Cell N='UpdateAlignBox' V='0'/><Cell N='HideText' V='0'/><Cell N='DynFeedback' V='0'/><Cell N='GlueType' V='0'/><Cell N='WalkPreference' V='0'/><Cell N='BegTrigger' V='0' F='No Formula'/><Cell N='EndTrigger' V='0' F='No Formula'/><Cell N='ObjType' V='0'/><Cell N='Comment' V=''/><Cell N='IsDropSource' V='0'/><Cell N='NoLiveDynamics' V='0'/><Cell N='LocalizeMerge' V='0'/><Cell N='NoProofing' V='0'/><Cell N='Calendar' V='0'/><Cell N='LangID' V='en-GB'/><Cell N='ShapeKeywords' V=''/><Cell N='DropOnPageScale' V='1'/><Cell N='TheData' V='0' F='No Formula'/><Cell N='TheText' V='0' F='No Formula'/><Cell N='EventDblClick' V='0' F='No Formula'/><Cell N='EventXFMod' V='0' F='No Formula'/><Cell N='EventDrop' V='0' F='No Formula'/><Cell N='EventMultiDrop' V='0' F='No Formula'/><Cell N='HelpTopic' V=''/><Cell N='Copyright' V=''/><Cell N='LayerMember' V=''/><Cell N='XRulerDensity' V='32'/><Cell N='YRulerDensity' V='32'/><Cell N='XRulerOrigin' V='0'/><Cell N='YRulerOrigin' V='0'/><Cell N='XGridDensity' V='8'/><Cell N='YGridDensity' V='8'/><Cell N='XGridSpacing' V='0'/><Cell N='YGridSpacing' V='0'/><Cell N='XGridOrigin' V='0'/><Cell N='YGridOrigin' V='0'/><Cell N='Gamma' V='1'/><Cell N='Contrast' V='0.5'/><Cell N='Brightness' V='0.5'/><Cell N='Sharpen' V='0'/><Cell N='Blur' V='0'/><Cell N='Denoise' V='0'/><Cell N='Transparency' V='0'/><Cell N='SelectMode' V='1'/><Cell N='DisplayMode' V='2'/><Cell N='IsDropTarget' V='0'/><Cell N='IsSnapTarget' V='1'/><Cell N='IsTextEditTarget' V='1'/><Cell N='DontMoveChildren' V='0'/><Cell N='ShapePermeableX' V='0'/><Cell N='ShapePermeableY' V='0'/><Cell N='ShapePermeablePlace' V='0'/><Cell N='Relationships' V='0'/><Cell N='ShapeFixedCode' V='0'/><Cell N='ShapePlowCode' V='0'/><Cell N='ShapeRouteStyle' V='0'/><Cell N='ShapePlaceStyle' V='0'/><Cell N='ConFixedCode' V='0'/><Cell N='ConLineJumpCode' V='0'/><Cell N='ConLineJumpStyle' V='0'/><Cell N='ConLineJumpDirX' V='0'/><Cell N='ConLineJumpDirY' V='0'/><Cell N='ShapePlaceFlip' V='0'/><Cell N='ConLineRouteExt' V='0'/><Cell N='ShapeSplit' V='0'/><Cell N='ShapeSplittable' V='0'/><Cell N='DisplayLevel' V='0'/><Cell N='ResizePage' V='0'/><Cell N='EnableGrid' V='0'/><Cell N='DynamicsOff' V='0'/><Cell N='CtrlAsInput' V='0'/><Cell N='AvoidPageBreaks' V='0'/><Cell N='PlaceStyle' V='0'/><Cell N='RouteStyle' V='0'/><Cell N='PlaceDepth' V='0'/><Cell N='PlowCode' V='0'/><Cell N='LineJumpCode' V='1'/><Cell N='LineJumpStyle' V='0'/><Cell N='PageLineJumpDirX' V='0'/><Cell N='PageLineJumpDirY' V='0'/><Cell N='LineToNodeX' V='0.09842519685039369'/><Cell N='LineToNodeY' V='0.09842519685039369'/><Cell N='BlockSizeX' V='0.1968503937007874'/><Cell N='BlockSizeY' V='0.1968503937007874'/><Cell N='AvenueSizeX' V='0.2952755905511811'/><Cell N='AvenueSizeY' V='0.2952755905511811'/><Cell N='LineToLineX' V='0.09842519685039369'/><Cell N='LineToLineY' V='0.09842519685039369'/><Cell N='LineJumpFactorX' V='0.66666666666667'/><Cell N='LineJumpFactorY' V='0.66666666666667'/><Cell N='LineAdjustFrom' V='0'/><Cell N='LineAdjustTo' V='0'/><Cell N='PlaceFlip' V='0'/><Cell N='LineRouteExt' V='0'/><Cell N='PageShapeSplit' V='0'/><Cell N='PageLeftMargin' V='0.25'/><Cell N='PageRightMargin' V='0.25'/><Cell N='PageTopMargin' V='0.25'/><Cell N='PageBottomMargin' V='0.25'/><Cell N='ScaleX' V='1'/><Cell N='ScaleY' V='1'/><Cell N='PagesX' V='1'/><Cell N='PagesY' V='1'/><Cell N='CenterX' V='0'/><Cell N='CenterY' V='0'/><Cell N='OnPage' V='0'/><Cell N='PrintGrid' V='0'/><Cell N='PrintPageOrientation' V='1'/><Cell N='PaperKind' V='9'/><Cell N='PaperSource' V='7'/><Cell N='QuickStyleLineColor' V='100'/><Cell N='QuickStyleFillColor' V='100'/><Cell N='QuickStyleShadowColor' V='100'/><Cell N='QuickStyleFontColor' V='100'/><Cell N='QuickStyleLineMatrix' V='100'/><Cell N='QuickStyleFillMatrix' V='100'/><Cell N='QuickStyleEffectsMatrix' V='100'/><Cell N='QuickStyleFontMatrix' V='100'/><Cell N='QuickStyleType' V='0'/><Cell N='QuickStyleVariation' V='0'/><Cell N='LineGradientDir' V='0'/><Cell N='LineGradientAngle' V='1.5707963267949'/><Cell N='FillGradientDir' V='0'/><Cell N='FillGradientAngle' V='1.5707963267949'/><Cell N='LineGradientEnabled' V='0'/><Cell N='FillGradientEnabled' V='0'/><Cell N='RotateGradientWithShape' V='1'/><Cell N='UseGroupGradient' V='0'/><Cell N='BevelTopType' V='0'/><Cell N='BevelTopWidth' V='0'/><Cell N='BevelTopHeight' V='0'/><Cell N='BevelBottomType' V='0'/><Cell N='BevelBottomWidth' V='0'/><Cell N='BevelBottomHeight' V='0'/><Cell N='BevelDepthColor' V='1'/><Cell N='BevelDepthSize' V='0'/><Cell N='BevelContourColor' V='0'/><Cell N='BevelContourSize' V='0'/><Cell N='BevelMaterialType' V='0'/><Cell N='BevelLightingType' V='0'/><Cell N='BevelLightingAngle' V='0'/><Cell N='RotationXAngle' V='0'/><Cell N='RotationYAngle' V='0'/><Cell N='RotationZAngle' V='0'/><Cell N='RotationType' V='0'/><Cell N='Perspective' V='0'/><Cell N='DistanceFromGround' V='0'/><Cell N='KeepTextFlat' V='0'/><Cell N='ReflectionTrans' V='0'/><Cell N='ReflectionSize' V='0'/><Cell N='ReflectionDist' V='0'/><Cell N='ReflectionBlur' V='0'/><Cell N='GlowColor' V='1'/><Cell N='GlowColorTrans' V='0'/><Cell N='GlowSize' V='0'/><Cell N='SoftEdgesSize' V='0'/><Cell N='SketchSeed' V='0'/><Cell N='SketchEnabled' V='0'/><Cell N='SketchAmount' V='5'/><Cell N='SketchLineWeight' V='0.04166666666666666' U='PT'/><Cell N='SketchLineChange' V='0.14'/><Cell N='SketchFillChange' V='0.1'/><Cell N='ColorSchemeIndex' V='0'/><Cell N='EffectSchemeIndex' V='0'/><Cell N='ConnectorSchemeIndex' V='0'/><Cell N='FontSchemeIndex' V='0'/><Cell N='ThemeIndex' V='0'/><Cell N='VariationColorIndex' V='0'/><Cell N='VariationStyleIndex' V='0'/><Cell N='EmbellishmentIndex' V='0'/><Cell N='ReplaceLockShapeData' V='0'/><Cell N='ReplaceLockText' V='0'/><Cell N='ReplaceLockFormat' V='0'/><Cell N='ReplaceCopyCells' V='0' U='BOOL' F='No Formula'/><Cell N='PageWidth' V='0' F='No Formula'/><Cell N='PageHeight' V='0' F='No Formula'/><Cell N='ShdwOffsetX' V='0' F='No Formula'/><Cell N='ShdwOffsetY' V='0' F='No Formula'/><Cell N='PageScale' V='0' U='MM' F='No Formula'/><Cell N='DrawingScale' V='0' U='MM' F='No Formula'/><Cell N='DrawingSizeType' V='0' F='No Formula'/><Cell N='DrawingScaleType' V='0' F='No Formula'/><Cell N='InhibitSnap' V='0' F='No Formula'/><Cell N='PageLockReplace' V='0' U='BOOL' F='No Formula'/><Cell N='PageLockDuplicate' V='0' U='BOOL' F='No Formula'/><Cell N='UIVisibility' V='0' F='No Formula'/><Cell N='ShdwType' V='0' F='No Formula'/><Cell N='ShdwObliqueAngle' V='0' F='No Formula'/><Cell N='ShdwScaleFactor' V='0' F='No Formula'/><Cell N='DrawingResizeType' V='0' F='No Formula'/><Section N='Character'><Row IX='0'><Cell N='Font' V='Calibri'/><Cell N='Color' V='0'/><Cell N='Style' V='0'/><Cell N='Case' V='0'/><Cell N='Pos' V='0'/><Cell N='FontScale' V='1'/><Cell N='Size' V='0.1666666666666667'/><Cell N='DblUnderline' V='0'/><Cell N='Overline' V='0'/><Cell N='Strikethru' V='0'/><Cell N='DoubleStrikethrough' V='0'/><Cell N='Letterspace' V='0'/><Cell N='ColorTrans' V='0'/><Cell N='AsianFont' V='0'/><Cell N='ComplexScriptFont' V='0'/><Cell N='ComplexScriptSize' V='-1'/><Cell N='LangID' V='en-GB'/></Row></Section><Section N='Paragraph'><Row IX='0'><Cell N='IndFirst' V='0'/><Cell N='IndLeft' V='0'/><Cell N='IndRight' V='0'/><Cell N='SpLine' V='-1.2'/><Cell N='SpBefore' V='0'/><Cell N='SpAfter' V='0'/><Cell N='HorzAlign' V='1'/><Cell N='Bullet' V='0'/><Cell N='BulletStr' V=''/><Cell N='BulletFont' V='0'/><Cell N='BulletFontSize' V='-1'/><Cell N='TextPosAfterBullet' V='0'/><Cell N='Flags' V='0'/></Row></Section><Section N='Tabs'><Row IX='0'/></Section><Section N='LineGradient'><Row IX='0'><Cell N='GradientStopColor' V='1'/><Cell N='GradientStopColorTrans' V='0'/><Cell N='GradientStopPosition' V='0'/></Row></Section><Section N='FillGradient'><Row IX='0'><Cell N='GradientStopColor' V='1'/><Cell N='GradientStopColorTrans' V='0'/><Cell N='GradientStopPosition' V='0'/></Row></Section></StyleSheet><StyleSheet ID='1' NameU='Text Only' IsCustomNameU='1' Name='Text Only' IsCustomName='1' LineStyle='3' FillStyle='3' TextStyle='3'><Cell N='EnableLineProps' V='1'/><Cell N='EnableFillProps' V='1'/><Cell N='EnableTextProps' V='1'/><Cell N='HideForApply' V='0'/><Cell N='LineWeight' V='Themed' F='Inh'/><Cell N='LineColor' V='Themed' F='Inh'/><Cell N='LinePattern' V='Themed' F='Inh'/><Cell N='Rounding' V='Themed' F='Inh'/><Cell N='EndArrowSize' V='2' F='Inh'/><Cell N='BeginArrow' V='0' F='Inh'/><Cell N='EndArrow' V='0' F='Inh'/><Cell N='LineCap' V='Themed' F='Inh'/><Cell N='BeginArrowSize' V='2' F='Inh'/><Cell N='LineColorTrans' V='Themed' F='Inh'/><Cell N='CompoundType' V='Themed' F='Inh'/><Cell N='FillForegnd' V='Themed' F='Inh'/><Cell N='FillBkgnd' V='Themed' F='Inh'/><Cell N='FillPattern' V='Themed' F='Inh'/><Cell N='ShdwForegnd' V='Themed' F='Inh'/><Cell N='ShdwPattern' V='Themed' F='Inh'/><Cell N='FillForegndTrans' V='Themed' F='Inh'/><Cell N='FillBkgndTrans' V='Themed' F='Inh'/><Cell N='ShdwForegndTrans' V='Themed' F='Inh'/><Cell N='ShapeShdwType' V='Themed' F='Inh'/><Cell N='ShapeShdwOffsetX' V='Themed' F='Inh'/><Cell N='ShapeShdwOffsetY' V='Themed' F='Inh'/><Cell N='ShapeShdwObliqueAngle' V='Themed' F='Inh'/><Cell N='ShapeShdwScaleFactor' V='Themed' F='Inh'/><Cell N='ShapeShdwBlur' V='Themed' F='Inh'/><Cell N='ShapeShdwShow' V='0' F='Inh'/><Cell N='LeftMargin' V='0'/><Cell N='RightMargin' V='0'/><Cell N='TopMargin' V='0'/><Cell N='BottomMargin' V='0'/><Cell N='VerticalAlign' V='0'/><Cell N='TextBkgnd' V='0'/><Cell N='DefaultTabStop' V='0.5905511811023622' F='Inh'/><Cell N='TextDirection' V='0' F='Inh'/><Cell N='TextBkgndTrans' V='0' F='Inh'/><Cell N='LineGradientDir' V='Themed' F='Inh'/><Cell N='LineGradientAngle' V='Themed' F='Inh'/><Cell N='FillGradientDir' V='Themed' F='Inh'/><Cell N='FillGradientAngle' V='Themed' F='Inh'/><Cell N='LineGradientEnabled' V='Themed' F='Inh'/><Cell N='FillGradientEnabled' V='Themed' F='Inh'/><Cell N='RotateGradientWithShape' V='Themed' F='Inh'/><Cell N='UseGroupGradient' V='Themed' F='Inh'/><Section N='Paragraph'><Row IX='0'><Cell N='IndFirst' V='0' F='Inh'/><Cell N='IndLeft' V='0' F='Inh'/><Cell N='IndRight' V='0' F='Inh'/><Cell N='SpLine' V='-1.2' F='Inh'/><Cell N='SpBefore' V='0' F='Inh'/><Cell N='SpAfter' V='0' F='Inh'/><Cell N='HorzAlign' V='0'/><Cell N='Bullet' V='0' F='Inh'/><Cell N='BulletStr' V='' F='Inh'/><Cell N='BulletFont' V='0' F='Inh'/><Cell N='BulletFontSize' V='-1' F='Inh'/><Cell N='TextPosAfterBullet' V='0' F='Inh'/><Cell N='Flags' V='0' F='Inh'/></Row></Section></StyleSheet><StyleSheet ID='2' NameU='None' IsCustomNameU='1' Name='None' IsCustomName='1' LineStyle='3' FillStyle='3' TextStyle='3'><Cell N='EnableLineProps' V='1'/><Cell N='EnableFillProps' V='1'/><Cell N='EnableTextProps' V='1'/><Cell N='HideForApply' V='0'/><Cell N='LineWeight' V='Themed' F='Inh'/><Cell N='LineColor' V='Themed' F='Inh'/><Cell N='LinePattern' V='0'/><Cell N='Rounding' V='Themed' F='Inh'/><Cell N='EndArrowSize' V='2' F='Inh'/><Cell N='BeginArrow' V='0' F='Inh'/><Cell N='EndArrow' V='0' F='Inh'/><Cell N='LineCap' V='Themed' F='Inh'/><Cell N='BeginArrowSize' V='2' F='Inh'/><Cell N='LineColorTrans' V='Themed' F='Inh'/><Cell N='CompoundType' V='Themed' F='Inh'/><Cell N='FillForegnd' V='Themed' F='Inh'/><Cell N='FillBkgnd' V='Themed' F='Inh'/><Cell N='FillPattern' V='0'/><Cell N='ShdwForegnd' V='Themed' F='Inh'/><Cell N='ShdwPattern' V='Themed' F='Inh'/><Cell N='FillForegndTrans' V='Themed' F='Inh'/><Cell N='FillBkgndTrans' V='Themed' F='Inh'/><Cell N='ShdwForegndTrans' V='Themed' F='Inh'/><Cell N='ShapeShdwType' V='Themed' F='Inh'/><Cell N='ShapeShdwOffsetX' V='Themed' F='Inh'/><Cell N='ShapeShdwOffsetY' V='Themed' F='Inh'/><Cell N='ShapeShdwObliqueAngle' V='Themed' F='Inh'/><Cell N='ShapeShdwScaleFactor' V='Themed' F='Inh'/><Cell N='ShapeShdwBlur' V='Themed' F='Inh'/><Cell N='ShapeShdwShow' V='0' F='Inh'/><Cell N='LineGradientDir' V='Themed' F='Inh'/><Cell N='LineGradientAngle' V='Themed' F='Inh'/><Cell N='FillGradientDir' V='Themed' F='Inh'/><Cell N='FillGradientAngle' V='Themed' F='Inh'/><Cell N='LineGradientEnabled' V='0'/><Cell N='FillGradientEnabled' V='0'/><Cell N='RotateGradientWithShape' V='Themed' F='Inh'/><Cell N='UseGroupGradient' V='Themed' F='Inh'/><Cell N='QuickStyleLineColor' V='100' F='Inh'/><Cell N='QuickStyleFillColor' V='100' F='Inh'/><Cell N='QuickStyleShadowColor' V='100' F='Inh'/><Cell N='QuickStyleFontColor' V='100' F='Inh'/><Cell N='QuickStyleLineMatrix' V='100' F='Inh'/><Cell N='QuickStyleFillMatrix' V='100' F='Inh'/><Cell N='QuickStyleEffectsMatrix' V='0' F='GUARD(0)'/><Cell N='QuickStyleFontMatrix' V='100' F='Inh'/><Cell N='QuickStyleType' V='0' F='Inh'/><Cell N='QuickStyleVariation' V='2'/></StyleSheet><StyleSheet ID='3' NameU='Normal' IsCustomNameU='1' Name='Normal' IsCustomName='1' LineStyle='6' FillStyle='6' TextStyle='6'><Cell N='EnableLineProps' V='1'/><Cell N='EnableFillProps' V='1'/><Cell N='EnableTextProps' V='1'/><Cell N='HideForApply' V='0'/><Cell N='LeftMargin' V='0.05555555555555555' U='PT'/><Cell N='RightMargin' V='0.05555555555555555' U='PT'/><Cell N='TopMargin' V='0.05555555555555555' U='PT'/><Cell N='BottomMargin' V='0.05555555555555555' U='PT'/><Cell N='VerticalAlign' V='1' F='Inh'/><Cell N='TextBkgnd' V='0' F='Inh'/><Cell N='DefaultTabStop' V='0.5905511811023622' F='Inh'/><Cell N='TextDirection' V='0' F='Inh'/><Cell N='TextBkgndTrans' V='0' F='Inh'/></StyleSheet><StyleSheet ID='4' NameU='Guide' IsCustomNameU='1' Name='Guide' IsCustomName='1' LineStyle='3' FillStyle='3' TextStyle='3'><Cell N='EnableLineProps' V='1'/><Cell N='EnableFillProps' V='1'/><Cell N='EnableTextProps' V='1'/><Cell N='HideForApply' V='0'/><Cell N='LineWeight' V='0' U='PT'/><Cell N='LineColor' V='#7f7f7f'/><Cell N='LinePattern' V='23'/><Cell N='Rounding' V='Themed' F='Inh'/><Cell N='EndArrowSize' V='2' F='Inh'/><Cell N='BeginArrow' V='0' F='Inh'/><Cell N='EndArrow' V='0' F='Inh'/><Cell N='LineCap' V='Themed' F='Inh'/><Cell N='BeginArrowSize' V='2' F='Inh'/><Cell N='LineColorTrans' V='Themed' F='Inh'/><Cell N='CompoundType' V='Themed' F='Inh'/><Cell N='FillForegnd' V='Themed' F='Inh'/><Cell N='FillBkgnd' V='Themed' F='Inh'/><Cell N='FillPattern' V='0'/><Cell N='ShdwForegnd' V='Themed' F='Inh'/><Cell N='ShdwPattern' V='Themed' F='Inh'/><Cell N='FillForegndTrans' V='Themed' F='Inh'/><Cell N='FillBkgndTrans' V='Themed' F='Inh'/><Cell N='ShdwForegndTrans' V='Themed' F='Inh'/><Cell N='ShapeShdwType' V='Themed' F='Inh'/><Cell N='ShapeShdwOffsetX' V='Themed' F='Inh'/><Cell N='ShapeShdwOffsetY' V='Themed' F='Inh'/><Cell N='ShapeShdwObliqueAngle' V='Themed' F='Inh'/><Cell N='ShapeShdwScaleFactor' V='Themed' F='Inh'/><Cell N='ShapeShdwBlur' V='Themed' F='Inh'/><Cell N='ShapeShdwShow' V='0' F='Inh'/><Cell N='LineGradientDir' V='Themed' F='Inh'/><Cell N='LineGradientAngle' V='Themed' F='Inh'/><Cell N='FillGradientDir' V='Themed' F='Inh'/><Cell N='FillGradientAngle' V='Themed' F='Inh'/><Cell N='LineGradientEnabled' V='0'/><Cell N='FillGradientEnabled' V='0'/><Cell N='RotateGradientWithShape' V='Themed' F='Inh'/><Cell N='UseGroupGradient' V='Themed' F='Inh'/><Cell N='LeftMargin' V='0.05555555555555555' U='PT' F='Inh'/><Cell N='RightMargin' V='0.05555555555555555' U='PT' F='Inh'/><Cell N='TopMargin' V='0'/><Cell N='BottomMargin' V='0'/><Cell N='VerticalAlign' V='2'/><Cell N='TextBkgnd' V='0' F='Inh'/><Cell N='DefaultTabStop' V='0.5905511811023622' F='Inh'/><Cell N='TextDirection' V='0' F='Inh'/><Cell N='TextBkgndTrans' V='0' F='Inh'/><Cell N='NoObjHandles' V='0' F='Inh'/><Cell N='NonPrinting' V='1'/><Cell N='NoCtlHandles' V='0' F='Inh'/><Cell N='NoAlignBox' V='0' F='Inh'/><Cell N='UpdateAlignBox' V='0' F='Inh'/><Cell N='HideText' V='0' F='Inh'/><Cell N='DynFeedback' V='0' F='Inh'/><Cell N='GlueType' V='0' F='Inh'/><Cell N='WalkPreference' V='0' F='Inh'/><Cell N='BegTrigger' V='0' F='No Formula'/><Cell N='EndTrigger' V='0' F='No Formula'/><Cell N='ObjType' V='0' F='Inh'/><Cell N='Comment' V='' F='Inh'/><Cell N='IsDropSource' V='0' F='Inh'/><Cell N='NoLiveDynamics' V='0' F='Inh'/><Cell N='LocalizeMerge' V='0' F='Inh'/><Cell N='NoProofing' V='0' F='Inh'/><Cell N='Calendar' V='0' F='Inh'/><Cell N='LangID' V='en-GB' F='Inh'/><Cell N='ShapeKeywords' V='' F='Inh'/><Cell N='DropOnPageScale' V='1' F='Inh'/><Cell N='ShapePermeableX' V='1'/><Cell N='ShapePermeableY' V='1'/><Cell N='ShapePermeablePlace' V='1'/><Cell N='Relationships' V='0' F='Inh'/><Cell N='ShapeFixedCode' V='0' F='Inh'/><Cell N='ShapePlowCode' V='0' F='Inh'/><Cell N='ShapeRouteStyle' V='0' F='Inh'/><Cell N='ShapePlaceStyle' V='0' F='Inh'/><Cell N='ConFixedCode' V='0' F='Inh'/><Cell N='ConLineJumpCode' V='0' F='Inh'/><Cell N='ConLineJumpStyle' V='0' F='Inh'/><Cell N='ConLineJumpDirX' V='0' F='Inh'/><Cell N='ConLineJumpDirY' V='0' F='Inh'/><Cell N='ShapePlaceFlip' V='0' F='Inh'/><Cell N='ConLineRouteExt' V='0' F='Inh'/><Cell N='ShapeSplit' V='0' F='Inh'/><Cell N='ShapeSplittable' V='0' F='Inh'/><Cell N='DisplayLevel' V='0' F='Inh'/><Section N='Character'><Row IX='0'><Cell N='Font' V='Themed' F='Inh'/><Cell N='Color' V='4'/><Cell N='Style' V='Themed' F='Inh'/><Cell N='Case' V='0' F='Inh'/><Cell N='Pos' V='0' F='Inh'/><Cell N='FontScale' V='1' F='Inh'/><Cell N='Size' V='0.125'/><Cell N='DblUnderline' V='0' F='Inh'/><Cell N='Overline' V='0' F='Inh'/><Cell N='Strikethru' V='0' F='Inh'/><Cell N='DoubleStrikethrough' V='0' F='Inh'/><Cell N='Letterspace' V='0' F='Inh'/><Cell N='ColorTrans' V='0' F='Inh'/><Cell N='AsianFont' V='Themed' F='Inh'/><Cell N='ComplexScriptFont' V='Themed' F='Inh'/><Cell N='ComplexScriptSize' V='-1' F='Inh'/><Cell N='LangID' V='en-GB' F='Inh'/></Row></Section></StyleSheet><StyleSheet ID='6' NameU='Theme' IsCustomNameU='1' Name='Theme' IsCustomName='1' LineStyle='0' FillStyle='0' TextStyle='0'><Cell N='EnableLineProps' V='1'/><Cell N='EnableFillProps' V='1'/><Cell N='EnableTextProps' V='1'/><Cell N='HideForApply' V='0'/><Cell N='LineWeight' V='Themed' F='THEMEVAL()'/><Cell N='LineColor' V='Themed' F='THEMEVAL()'/><Cell N='LinePattern' V='Themed' F='THEMEVAL()'/><Cell N='Rounding' V='Themed' F='THEMEVAL()'/><Cell N='EndArrowSize' V='2' F='Inh'/><Cell N='BeginArrow' V='0' F='Inh'/><Cell N='EndArrow' V='0' F='Inh'/><Cell N='LineCap' V='Themed' F='THEMEVAL()'/><Cell N='BeginArrowSize' V='2' F='Inh'/><Cell N='LineColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='CompoundType' V='Themed' F='THEMEVAL()'/><Cell N='FillForegnd' V='Themed' F='THEMEVAL()'/><Cell N='FillBkgnd' V='Themed' F='THEMEVAL()'/><Cell N='FillPattern' V='Themed' F='THEMEVAL()'/><Cell N='ShdwForegnd' V='Themed' F='THEMEVAL()'/><Cell N='ShdwPattern' V='Themed' F='THEMEVAL()'/><Cell N='FillForegndTrans' V='Themed' F='THEMEVAL()'/><Cell N='FillBkgndTrans' V='Themed' F='THEMEVAL()'/><Cell N='ShdwForegndTrans' V='Themed' F='THEMEVAL()'/><Cell N='ShapeShdwType' V='Themed' F='THEMEVAL()'/><Cell N='ShapeShdwOffsetX' V='Themed' F='THEMEVAL()'/><Cell N='ShapeShdwOffsetY' V='Themed' F='THEMEVAL()'/><Cell N='ShapeShdwObliqueAngle' V='Themed' F='THEMEVAL()'/><Cell N='ShapeShdwScaleFactor' V='Themed' F='THEMEVAL()'/><Cell N='ShapeShdwBlur' V='Themed' F='THEMEVAL()'/><Cell N='ShapeShdwShow' V='0' F='Inh'/><Cell N='LineGradientDir' V='Themed' F='THEMEVAL()'/><Cell N='LineGradientAngle' V='Themed' F='THEMEVAL()'/><Cell N='FillGradientDir' V='Themed' F='THEMEVAL()'/><Cell N='FillGradientAngle' V='Themed' F='THEMEVAL()'/><Cell N='LineGradientEnabled' V='Themed' F='THEMEVAL()'/><Cell N='FillGradientEnabled' V='Themed' F='THEMEVAL()'/><Cell N='RotateGradientWithShape' V='Themed' F='THEMEVAL()'/><Cell N='UseGroupGradient' V='Themed' F='THEMEVAL()'/><Cell N='BevelTopType' V='Themed' F='THEMEVAL()'/><Cell N='BevelTopWidth' V='Themed' F='THEMEVAL()'/><Cell N='BevelTopHeight' V='Themed' F='THEMEVAL()'/><Cell N='BevelBottomType' V='0' F='Inh'/><Cell N='BevelBottomWidth' V='0' F='Inh'/><Cell N='BevelBottomHeight' V='0' F='Inh'/><Cell N='BevelDepthColor' V='1' F='Inh'/><Cell N='BevelDepthSize' V='0' F='Inh'/><Cell N='BevelContourColor' V='Themed' F='THEMEVAL()'/><Cell N='BevelContourSize' V='Themed' F='THEMEVAL()'/><Cell N='BevelMaterialType' V='Themed' F='THEMEVAL()'/><Cell N='BevelLightingType' V='Themed' F='THEMEVAL()'/><Cell N='BevelLightingAngle' V='Themed' F='THEMEVAL()'/><Cell N='ReflectionTrans' V='Themed' F='THEMEVAL()'/><Cell N='ReflectionSize' V='Themed' F='THEMEVAL()'/><Cell N='ReflectionDist' V='Themed' F='THEMEVAL()'/><Cell N='ReflectionBlur' V='Themed' F='THEMEVAL()'/><Cell N='GlowColor' V='Themed' F='THEMEVAL()'/><Cell N='GlowColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GlowSize' V='Themed' F='THEMEVAL()'/><Cell N='SoftEdgesSize' V='Themed' F='THEMEVAL()'/><Cell N='SketchSeed' V='0' F='Inh'/><Cell N='SketchEnabled' V='Themed' F='THEMEVAL()'/><Cell N='SketchAmount' V='Themed' F='THEMEVAL()'/><Cell N='SketchLineWeight' V='Themed' F='THEMEVAL()'/><Cell N='SketchLineChange' V='Themed' F='THEMEVAL()'/><Cell N='SketchFillChange' V='Themed' F='THEMEVAL()'/><Cell N='QuickStyleLineColor' V='100'/><Cell N='QuickStyleFillColor' V='100'/><Cell N='QuickStyleShadowColor' V='100'/><Cell N='QuickStyleFontColor' V='100'/><Cell N='QuickStyleLineMatrix' V='100'/><Cell N='QuickStyleFillMatrix' V='100'/><Cell N='QuickStyleEffectsMatrix' V='100'/><Cell N='QuickStyleFontMatrix' V='100'/><Cell N='QuickStyleType' V='0' F='Inh'/><Cell N='QuickStyleVariation' V='0' F='Inh'/><Cell N='ColorSchemeIndex' V='65534'/><Cell N='EffectSchemeIndex' V='65534'/><Cell N='ConnectorSchemeIndex' V='65534'/><Cell N='FontSchemeIndex' V='65534'/><Cell N='ThemeIndex' V='65534'/><Cell N='VariationColorIndex' V='65534'/><Cell N='VariationStyleIndex' V='65534'/><Cell N='EmbellishmentIndex' V='65534'/><Section N='Character'><Row IX='0'><Cell N='Font' V='Themed' F='THEMEVAL()'/><Cell N='Color' V='Themed' F='THEMEVAL()'/><Cell N='Style' V='Themed' F='THEMEVAL()'/><Cell N='Case' V='0' F='Inh'/><Cell N='Pos' V='0' F='Inh'/><Cell N='FontScale' V='1' F='Inh'/><Cell N='Size' V='0.1666666666666667' F='Inh'/><Cell N='DblUnderline' V='0' F='Inh'/><Cell N='Overline' V='0' F='Inh'/><Cell N='Strikethru' V='0' F='Inh'/><Cell N='DoubleStrikethrough' V='0' F='Inh'/><Cell N='Letterspace' V='0' F='Inh'/><Cell N='ColorTrans' V='0' F='Inh'/><Cell N='AsianFont' V='Themed' F='THEMEVAL()'/><Cell N='ComplexScriptFont' V='Themed' F='THEMEVAL()'/><Cell N='ComplexScriptSize' V='-1' F='Inh'/><Cell N='LangID' V='en-GB' F='Inh'/></Row></Section><Section N='FillGradient'><Row IX='0'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='1'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='2'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='3'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='4'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='5'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='6'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='7'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='8'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='9'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row></Section><Section N='LineGradient'><Row IX='0'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='1'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='2'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='3'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='4'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='5'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='6'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='7'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='8'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row><Row IX='9'><Cell N='GradientStopColor' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopColorTrans' V='Themed' F='THEMEVAL()'/><Cell N='GradientStopPosition' V='Themed' F='THEMEVAL()'/></Row></Section></StyleSheet><StyleSheet ID='7' NameU='Connector' IsCustomNameU='1' Name='Connector' IsCustomName='1' LineStyle='3' FillStyle='3' TextStyle='3'><Cell N='EnableLineProps' V='1'/><Cell N='EnableFillProps' V='1'/><Cell N='EnableTextProps' V='1'/><Cell N='HideForApply' V='0'/><Cell N='LeftMargin' V='0.05555555555555555' U='PT' F='Inh'/><Cell N='RightMargin' V='0.05555555555555555' U='PT' F='Inh'/><Cell N='TopMargin' V='0.05555555555555555' U='PT' F='Inh'/><Cell N='BottomMargin' V='0.05555555555555555' U='PT' F='Inh'/><Cell N='VerticalAlign' V='1' F='Inh'/><Cell N='TextBkgnd' V='#ffffff' F='THEMEGUARD(THEMEVAL(\"BackgroundColor\")+1)'/><Cell N='DefaultTabStop' V='0.5905511811023622' F='Inh'/><Cell N='TextDirection' V='0' F='Inh'/><Cell N='TextBkgndTrans' V='0' F='Inh'/><Cell N='QuickStyleLineColor' V='100'/><Cell N='QuickStyleFillColor' V='100'/><Cell N='QuickStyleShadowColor' V='100'/><Cell N='QuickStyleFontColor' V='100'/><Cell N='QuickStyleLineMatrix' V='1'/><Cell N='QuickStyleFillMatrix' V='1'/><Cell N='QuickStyleEffectsMatrix' V='1'/><Cell N='QuickStyleFontMatrix' V='1'/><Cell N='QuickStyleType' V='0'/><Cell N='QuickStyleVariation' V='0'/><Cell N='LineWeight' V='Themed' F='Inh'/><Cell N='LineColor' V='Themed' F='Inh'/><Cell N='LinePattern' V='Themed' F='Inh'/><Cell N='Rounding' V='Themed' F='Inh'/><Cell N='EndArrowSize' V='Themed' F='THEMEVAL()'/><Cell N='BeginArrow' V='Themed' F='THEMEVAL()'/><Cell N='EndArrow' V='Themed' F='THEMEVAL()'/><Cell N='LineCap' V='Themed' F='Inh'/><Cell N='BeginArrowSize' V='Themed' F='THEMEVAL()'/><Cell N='LineColorTrans' V='Themed' F='Inh'/><Cell N='CompoundType' V='Themed' F='Inh'/><Cell N='NoObjHandles' V='0' F='Inh'/><Cell N='NonPrinting' V='0' F='Inh'/><Cell N='NoCtlHandles' V='0' F='Inh'/><Cell N='NoAlignBox' V='0' F='Inh'/><Cell N='UpdateAlignBox' V='0' F='Inh'/><Cell N='HideText' V='0' F='Inh'/><Cell N='DynFeedback' V='0' F='Inh'/><Cell N='GlueType' V='0' F='Inh'/><Cell N='WalkPreference' V='0' F='Inh'/><Cell N='BegTrigger' V='0' F='No Formula'/><Cell N='EndTrigger' V='0' F='No Formula'/><Cell N='ObjType' V='0' F='Inh'/><Cell N='Comment' V='' F='Inh'/><Cell N='IsDropSource' V='0' F='Inh'/><Cell N='NoLiveDynamics' V='0' F='Inh'/><Cell N='LocalizeMerge' V='0' F='Inh'/><Cell N='NoProofing' V='0' F='Inh'/><Cell N='Calendar' V='0' F='Inh'/><Cell N='LangID' V='en-GB' F='Inh'/><Cell N='ShapeKeywords' V='' F='Inh'/><Cell N='DropOnPageScale' V='1' F='Inh'/><Section N='Character'><Row IX='0'><Cell N='Font' V='Themed' F='Inh'/><Cell N='Color' V='Themed' F='Inh'/><Cell N='Style' V='Themed' F='Inh'/><Cell N='Case' V='0' F='Inh'/><Cell N='Pos' V='0' F='Inh'/><Cell N='FontScale' V='1' F='Inh'/><Cell N='Size' V='0.1111111111111111'/><Cell N='DblUnderline' V='0' F='Inh'/><Cell N='Overline' V='0' F='Inh'/><Cell N='Strikethru' V='0' F='Inh'/><Cell N='DoubleStrikethrough' V='0' F='Inh'/><Cell N='Letterspace' V='0' F='Inh'/><Cell N='ColorTrans' V='0' F='Inh'/><Cell N='AsianFont' V='Themed' F='Inh'/><Cell N='ComplexScriptFont' V='Themed' F='Inh'/><Cell N='ComplexScriptSize' V='-1' F='Inh'/><Cell N='LangID' V='en-GB' F='Inh'/></Row></Section></StyleSheet></StyleSheets><DocumentSheet NameU='TheDoc' IsCustomNameU='1' Name='TheDoc' IsCustomName='1' LineStyle='0' FillStyle='0' TextStyle='0'><Cell N='OutputFormat' V='0'/><Cell N='LockPreview' V='0'/><Cell N='AddMarkup' V='0'/><Cell N='ViewMarkup' V='0'/><Cell N='DocLockReplace' V='0' U='BOOL'/><Cell N='NoCoauth' V='0' U='BOOL'/><Cell N='DocLockDuplicatePage' V='0' U='BOOL'/><Cell N='PreviewQuality' V='0'/><Cell N='PreviewScope' V='0'/><Cell N='DocLangID' V='en-GB'/><Section N='User'><Row N='msvNoAutoConnect'><Cell N='Value' V='1'/><Cell N='Prompt' V='' F='No Formula'/></Row></Section></DocumentSheet></VisioDocument>","windows":"<?xml version='1.0' encoding='utf-8' ?>\r\n<Windows ClientWidth='1920' ClientHeight='807' xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships' xml:space='preserve'><Window ID='0' WindowType='Drawing' WindowState='1073741824' WindowLeft='-9' WindowTop='-38' WindowWidth='1938' WindowHeight='854' ContainerType='Page' Page='0' ViewScale='1' ViewCenterX='4.0629923395543' ViewCenterY='8.956693384192'><ShowRulers>1</ShowRulers><ShowGrid>1</ShowGrid><ShowPageBreaks>0</ShowPageBreaks><ShowGuides>1</ShowGuides><ShowConnectionPoints>1</ShowConnectionPoints><GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions><SnapAngles/><DynamicGridEnabled>1</DynamicGridEnabled><TabSplitterPos>0.5</TabSplitterPos></Window></Windows>","core":"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" xmlns:dcmitype=\"http://purl.org/dc/dcmitype/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><dc:title></dc:title><dc:subject></dc:subject><dc:creator>blok-shema.ru</dc:creator><cp:keywords></cp:keywords><dc:description></dc:description><dcterms:created xsi:type=\"dcterms:W3CDTF\">2020-06-05T19:03:28Z</dcterms:created><dcterms:modified xsi:type=\"dcterms:W3CDTF\">2021-08-30T08:39:24Z</dcterms:modified><cp:category></cp:category><dc:language>ru-RU</dc:language></cp:coreProperties>","custom":"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/custom-properties\" xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\"><property fmtid=\"{D5CDD505-2E9C-101B-9397-08002B2CF9AE}\" pid=\"2\" name=\"_VPID_ALTERNATENAMES\"><vt:lpwstr></vt:lpwstr></property><property fmtid=\"{D5CDD505-2E9C-101B-9397-08002B2CF9AE}\" pid=\"3\" name=\"BuildNumberCreated\"><vt:i4>1074278842</vt:i4></property><property fmtid=\"{D5CDD505-2E9C-101B-9397-08002B2CF9AE}\" pid=\"4\" name=\"BuildNumberEdited\"><vt:i4>1075197942</vt:i4></property><property fmtid=\"{D5CDD505-2E9C-101B-9397-08002B2CF9AE}\" pid=\"5\" name=\"IsMetric\"><vt:bool>true</vt:bool></property><property fmtid=\"{D5CDD505-2E9C-101B-9397-08002B2CF9AE}\" pid=\"6\" name=\"TimeEdited\"><vt:filetime>2021-08-30T08:39:19Z</vt:filetime></property></Properties>","pagesRels":"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.microsoft.com/visio/2010/relationships/page\" Target=\"page1.xml\"/></Relationships>","app":"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\"><Application>Microsoft Visio</Application><HeadingPairs><vt:vector size=\"2\" baseType=\"variant\"><vt:variant><vt:lpstr>Pages</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size=\"1\" baseType=\"lpstr\"><vt:lpstr>Page-1</vt:lpstr></vt:vector></TitlesOfParts><AppVersion>16.0000</AppVersion></Properties>"};
  var PXIN = 96;
  function fx(n){ return (+(n).toFixed(5)).toString(); }
  function xmlEsc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  }

  function shapeOutline(sh){
    var x=sh.x, y=sh.y, w=sh.w, h=sh.h, cx=sh.cx, cy=sh.cy, i, a, pts;
    switch (sh.type) {
      case 'io': { var sk=sh.skew||18; return [[x+sk,y],[x+w,y],[x+w-sk,y+h],[x,y+h]]; }
      case 'decision': return [[cx,y],[x+w,cy],[cx,y+h],[x,cy]];
      case 'loopstart': { var c=sh.corner||14; return [[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+h],[x,y+h],[x,y+c]]; }
      case 'loopend': { var c2=sh.corner||14; return [[x,y],[x+w,y],[x+w,y+h-c2],[x+w-c2,y+h],[x+c2,y+h],[x,y+h-c2]]; }
      case 'prep': { var pc=Math.min(h*0.9,w*0.16); return [[x+pc,y],[x+w-pc,y],[x+w,cy],[x+w-pc,y+h],[x+pc,y+h],[x,cy]]; }
      case 'terminal': {
        var rr=h/2, lxp=x+rr, rxp=x+w-rr, mc=y+rr; pts=[]; var seg=12;
        pts.push([lxp,y]);
        for (i=0;i<=seg;i++){ a=-Math.PI/2 + Math.PI*(i/seg); pts.push([rxp+rr*Math.cos(a), mc+rr*Math.sin(a)]); }
        pts.push([lxp,y+h]);
        for (i=0;i<=seg;i++){ a=Math.PI/2 + Math.PI*(i/seg); pts.push([lxp+rr*Math.cos(a), mc+rr*Math.sin(a)]); }
        return pts;
      }
      default: return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
    }
  }

  function geomSection(sh, ptsPx, ix, noFill, H, s){
    var x=sh.x, y=sh.y, h=sh.h;
    function lx(px){ return (px - x) * s; }
    function ly(py){ return (h - (py - y)) * s; }
    var rows = "<Row T='MoveTo' IX='1'><Cell N='X' V='"+fx(lx(ptsPx[0][0]))+"'/><Cell N='Y' V='"+fx(ly(ptsPx[0][1]))+"'/></Row>";
    for (var i=1;i<ptsPx.length;i++)
      rows += "<Row T='LineTo' IX='"+(i+1)+"'><Cell N='X' V='"+fx(lx(ptsPx[i][0]))+"'/><Cell N='Y' V='"+fx(ly(ptsPx[i][1]))+"'/></Row>";
    return "<Section N='Geometry' IX='"+ix+"'><Cell N='NoFill' V='"+(noFill?1:0)+"'/><Cell N='NoLine' V='0'/><Cell N='NoShow' V='0'/><Cell N='NoSnap' V='0'/><Cell N='NoQuickDrag' V='0'/>"+rows+"</Section>";
  }

  function charSection(fontPx){
    var sz = (fontPx ? fontPx : 13) / PXIN;
    return "<Section N='Character'><Row IX='0'><Cell N='Size' V='"+fx(sz)+"'/></Row></Section>";
  }

  function rectGeomLocal(wIn, hIn, noFill, noLine){
    return "<Section N='Geometry' IX='0'><Cell N='NoFill' V='"+(noFill?1:0)+"'/><Cell N='NoLine' V='"+(noLine?1:0)+"'/><Cell N='NoShow' V='0'/><Cell N='NoSnap' V='0'/><Cell N='NoQuickDrag' V='0'/>"+
      "<Row T='MoveTo' IX='1'><Cell N='X' V='0'/><Cell N='Y' V='0'/></Row>"+
      "<Row T='LineTo' IX='2'><Cell N='X' V='"+fx(wIn)+"'/><Cell N='Y' V='0'/></Row>"+
      "<Row T='LineTo' IX='3'><Cell N='X' V='"+fx(wIn)+"'/><Cell N='Y' V='"+fx(hIn)+"'/></Row>"+
      "<Row T='LineTo' IX='4'><Cell N='X' V='0'/><Cell N='Y' V='"+fx(hIn)+"'/></Row>"+
      "<Row T='LineTo' IX='5'><Cell N='X' V='0'/><Cell N='Y' V='0'/></Row></Section>";
  }

  function vShape(sh, id, H, s){
    var w = sh.w*s, h = sh.h*s;
    var pinX = sh.cx*s, pinY = (H - sh.cy)*s;
    var cells = "<Cell N='PinX' V='"+fx(pinX)+"'/><Cell N='PinY' V='"+fx(pinY)+"'/>"+
                "<Cell N='Width' V='"+fx(w)+"'/><Cell N='Height' V='"+fx(h)+"'/>"+
                "<Cell N='LocPinX' V='"+fx(w/2)+"' F='Width*0.5'/><Cell N='LocPinY' V='"+fx(h/2)+"' F='Height*0.5'/>"+
                "<Cell N='Angle' V='0'/><Cell N='FlipX' V='0'/><Cell N='FlipY' V='0'/>";
    var geom;
    if (sh.type === 'connector') {
      geom = "<Section N='Geometry' IX='0'><Cell N='NoFill' V='0'/><Cell N='NoLine' V='0'/><Cell N='NoShow' V='0'/><Cell N='NoSnap' V='0'/><Cell N='NoQuickDrag' V='0'/>"+
             "<Row T='Ellipse' IX='1'><Cell N='X' V='"+fx(w/2)+"' F='Width*0.5'/><Cell N='Y' V='"+fx(h/2)+"' F='Height*0.5'/>"+
             "<Cell N='A' V='"+fx(w)+"' F='Width*1'/><Cell N='B' V='"+fx(h/2)+"' F='Height*0.5'/>"+
             "<Cell N='C' V='"+fx(w/2)+"' F='Width*0.5'/><Cell N='D' V='"+fx(h)+"' F='Height*1'/></Row></Section>";
    } else {
      var pts = shapeOutline(sh).slice(); pts.push(pts[0]);
      geom = geomSection(sh, pts, 0, false, H, s);
      if (sh.type === 'predef') {
        var inset = 8;
        geom += geomSection(sh, [[sh.x+inset,sh.y],[sh.x+inset,sh.y+sh.h]], 1, true, H, s);
        geom += geomSection(sh, [[sh.x+sh.w-inset,sh.y],[sh.x+sh.w-inset,sh.y+sh.h]], 2, true, H, s);
      }
    }
    var txt = '';
    if (sh.lines && sh.lines.length && sh.lines.join('') !== '') {
      cells += charSection(sh.fontSize);
      txt = "<Text>"+xmlEsc(sh.lines.join(String.fromCharCode(10)))+"\r\n</Text>";
    }
    return "<Shape ID='"+id+"' Type='Shape' LineStyle='3' FillStyle='3' TextStyle='3'>"+cells+geom+txt+"</Shape>";
  }

  function edgeNeedsArrowV(pts){
    for (var i=1;i<pts.length;i++) if (pts[i][1] < pts[i-1][1]-2) return true;
    return false;
  }

  function vEdge(e, id, H, s){
    var pts = e.points;
    var xs = pts.map(function(p){return p[0];}), ys = pts.map(function(p){return p[1];});
    var minx = Math.min.apply(null,xs), maxx = Math.max.apply(null,xs);
    var miny = Math.min.apply(null,ys), maxy = Math.max.apply(null,ys);
    var bw = Math.max(maxx-minx, 0.01), bh = Math.max(maxy-miny, 0.01);
    var w = bw*s, h = bh*s;
    var pinX = (minx + bw/2)*s, pinY = (H - (miny + bh/2))*s;
    var rows = pts.map(function(p,i){
      var lx=(p[0]-minx)*s, ly=(bh-(p[1]-miny))*s;
      return "<Row T='"+(i?'LineTo':'MoveTo')+"' IX='"+(i+1)+"'><Cell N='X' V='"+fx(lx)+"'/><Cell N='Y' V='"+fx(ly)+"'/></Row>";
    }).join('');
    var arrow = ((e.arrowExplicit ? !!e.arrow : edgeNeedsArrowV(pts))) ? "<Cell N='EndArrow' V='4'/><Cell N='EndArrowSize' V='1'/>" : "";
    var cells = "<Cell N='PinX' V='"+fx(pinX)+"'/><Cell N='PinY' V='"+fx(pinY)+"'/>"+
                "<Cell N='Width' V='"+fx(w)+"'/><Cell N='Height' V='"+fx(h)+"'/>"+
                "<Cell N='LocPinX' V='"+fx(w/2)+"' F='Width*0.5'/><Cell N='LocPinY' V='"+fx(h/2)+"' F='Height*0.5'/>"+
                "<Cell N='Angle' V='0'/>"+arrow;
    var geom = "<Section N='Geometry' IX='0'><Cell N='NoFill' V='1'/><Cell N='NoLine' V='0'/><Cell N='NoShow' V='0'/><Cell N='NoSnap' V='0'/><Cell N='NoQuickDrag' V='0'/>"+rows+"</Section>";
    return "<Shape ID='"+id+"' Type='Shape' LineStyle='3' FillStyle='3' TextStyle='3'>"+cells+geom+"</Shape>";
  }

  function vLabel(t, id, H, s, fontPx){
    var bw = 64, bh = 18;
    var pinX = t.x*s, pinY = (H - t.y)*s, w = bw*s, h = bh*s;
    var cells = "<Cell N='PinX' V='"+fx(pinX)+"'/><Cell N='PinY' V='"+fx(pinY)+"'/>"+
                "<Cell N='Width' V='"+fx(w)+"'/><Cell N='Height' V='"+fx(h)+"'/>"+
                "<Cell N='LocPinX' V='"+fx(w/2)+"' F='Width*0.5'/><Cell N='LocPinY' V='"+fx(h/2)+"' F='Height*0.5'/>"+
                "<Cell N='Angle' V='0'/>"+charSection(fontPx);
    var geom = rectGeomLocal(w, h, true, true);
    return "<Shape ID='"+id+"' Type='Shape' LineStyle='3' FillStyle='3' TextStyle='3'>"+cells+geom+"<Text>"+xmlEsc(t.text)+"\r\n</Text></Shape>";
  }

  function labelPosV(pts){
    var a=pts[0], b=pts[1];
    if (Math.abs(b[0]-a[0]) < Math.abs(b[1]-a[1])) return { x:a[0]+16, y:(a[1]+b[1])/2 };
    return { x:(a[0]+b[0])/2, y:Math.min(a[1],b[1])-8 };
  }

  function coreXML(tpl){
    var now=new Date().toISOString().replace(/\.\d+Z$/,'Z');
    return tpl.replace(/(<dcterms:(?:created|modified)[^>]*>)[^<]*/g, '$1'+now);
  }

  function buildVSDXParts(model){
    var H = model.height, s = 1/PXIN;
    var pw = model.width*s, ph = model.height*s;
    var id = 1, shapesXML = '';
    model.edges.forEach(function(e){ shapesXML += vEdge(e, id++, H, s); });
    model.shapes.forEach(function(sh){ shapesXML += vShape(sh, id++, H, s); });
    model.edges.forEach(function(e){
      if (e.label){ var p = e.lpos ? {x:e.lpos[0], y:e.lpos[1]} : labelPosV(e.points); shapesXML += vLabel({text:e.label, x:p.x, y:p.y}, id++, H, s, 12); }
    });
    (model.titles||[]).forEach(function(t){ shapesXML += vLabel(t, id++, H, s, 15); });

    var NS = 'http://schemas.microsoft.com/office/visio/2012/main';
    var RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    var page1 = "<?xml version='1.0' encoding='utf-8' ?>\r\n<PageContents xmlns='"+NS+"' xmlns:r='"+RNS+"' xml:space='preserve'><Shapes>"+shapesXML+"</Shapes></PageContents>";

    var pages = "<?xml version='1.0' encoding='utf-8' ?>\r\n<Pages xmlns='"+NS+"' xmlns:r='"+RNS+"' xml:space='preserve'>"+
      "<Page ID='0' NameU='Page-1' Name='Page-1' ViewScale='1' ViewCenterX='"+fx(pw/2)+"' ViewCenterY='"+fx(ph/2)+"'>"+
      "<PageSheet LineStyle='0' FillStyle='0' TextStyle='0'>"+
        "<Cell N='PageWidth' V='"+fx(pw)+"'/><Cell N='PageHeight' V='"+fx(ph)+"'/>"+
        "<Cell N='ShdwOffsetX' V='0.125'/><Cell N='ShdwOffsetY' V='-0.125'/>"+
        "<Cell N='PageScale' V='1'/><Cell N='DrawingScale' V='1'/>"+
        "<Cell N='DrawingSizeType' V='3'/><Cell N='DrawingScaleType' V='0'/>"+
        "<Cell N='InhibitSnap' V='0'/><Cell N='PageLockReplace' V='0' U='BOOL'/>"+
        "<Cell N='PageLockDuplicate' V='0' U='BOOL'/><Cell N='UIVisibility' V='0'/>"+
        "<Cell N='ShdwType' V='0'/><Cell N='ShdwObliqueAngle' V='0'/><Cell N='ShdwScaleFactor' V='1'/>"+
        "<Cell N='DrawingResizeType' V='1'/><Cell N='PageShapeSplit' V='1'/>"+
      "</PageSheet><Rel r:id='rId1'/></Page></Pages>";

    var T = __VSDX_TMPL__;
    return [
      { name:'[Content_Types].xml', text:T.ct },
      { name:'_rels/.rels', text:T.rootRels },
      { name:'docProps/app.xml', text:T.app },
      { name:'docProps/core.xml', text:coreXML(T.core) },
      { name:'docProps/custom.xml', text:T.custom },
      { name:'visio/document.xml', text:T.document },
      { name:'visio/_rels/document.xml.rels', text:T.docRels },
      { name:'visio/windows.xml', text:T.windows },
      { name:'visio/pages/pages.xml', text:pages },
      { name:'visio/pages/_rels/pages.xml.rels', text:T.pagesRels },
      { name:'visio/pages/page1.xml', text:page1 }
    ];
  }

  var _crcTable = (function(){
    var t = []; for (var n=0;n<256;n++){ var c=n; for (var k=0;k<8;k++) c = (c&1)?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0; } return t;
  })();
  function crc32(bytes){
    var crc = 0xFFFFFFFF;
    for (var i=0;i<bytes.length;i++) crc = (crc>>>8) ^ _crcTable[(crc ^ bytes[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(str){
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var b = unescape(encodeURIComponent(str)), a = new Uint8Array(b.length);
    for (var i=0;i<b.length;i++) a[i] = b.charCodeAt(i); return a;
  }
  function zipStore(files){
    var enc = files.map(function(f){ return { name:utf8(f.name), data:utf8(f.text) }; });
    var parts = [], central = [], offset = 0;
    function u16(n){ return [n&255, (n>>>8)&255]; }
    function u32(n){ return [n&255, (n>>>8)&255, (n>>>16)&255, (n>>>24)&255]; }
    enc.forEach(function(f){
      var crc = crc32(f.data), len = f.data.length;
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
                         u32(crc), u32(len), u32(len), u16(f.name.length), u16(0));
      parts.push(new Uint8Array(lh), f.name, f.data);
      var ch = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
                         u32(crc), u32(len), u32(len), u16(f.name.length), u16(0), u16(0),
                         u16(0), u16(0), u32(0), u32(offset));
      central.push(new Uint8Array(ch), f.name);
      offset += lh.length + f.name.length + len;
    });
    var cStart = offset, cSize = 0;
    central.forEach(function(p){ cSize += p.length; });
    var end = [].concat(u32(0x06054b50), u16(0), u16(0), u16(enc.length), u16(enc.length),
                        u32(cSize), u32(cStart), u16(0));
    var chunks = parts.concat(central, [new Uint8Array(end)]);
    var total = 0; chunks.forEach(function(c){ total += c.length; });
    var out = new Uint8Array(total), pos = 0;
    chunks.forEach(function(c){ out.set(c, pos); pos += c.length; });
    return out;
  }

  var g = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : this);
  if (g) {
    g.renderModelSVG = renderModelSVG;
    g.renderShapeSVG = shapeToSVG;
    g.edgeHasUpward = edgeNeedsArrow;
    g.generateVSDXFromModel = function(m){
      try { return { bytes: zipStore(buildVSDXParts(m)), error:null }; }
      catch (err) { return { bytes:null, error:(err && err.message ? err.message : String(err)) }; }
    };
  }


  return {
    renderModelSVG: renderModelSVG,
    renderShapeSVG: shapeToSVG,
    edgeHasUpward: edgeNeedsArrow,
    generateVSDXFromModel: function(m) {
      try { return { bytes: zipStore(buildVSDXParts(m)), error: null }; }
      catch (err) { return { bytes: null, error: (err && err.message ? err.message : String(err)) }; }
    }
  };
});
