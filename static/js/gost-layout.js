// gost-layout.js - Orthogonal layout engine adhering strictly to GOST 19.701-90
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GOSTLayout = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FONT_SIZE = 13;
  var LINE_HEIGHT = 17;
  var CHAR_WIDTH = 8.2;
  var VERTICAL_GAP = 34;
  var MIN_BLOCK_WIDTH = 180;

  function measureLines(lines) {
    var maxLen = 0;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].length > maxLen) maxLen = lines[i].length;
    }
    return {
      maxLen: maxLen,
      textWidth: maxLen * CHAR_WIDTH,
      textHeight: lines.length * LINE_HEIGHT
    };
  }

  function computeShapeDimensions(type, lines) {
    var m = measureLines(lines);
    var w = MIN_BLOCK_WIDTH;
    var h = 46;
    var skew = 20;

    switch (type) {
      case 'terminal':
        w = Math.max(MIN_BLOCK_WIDTH, Math.round(m.textWidth + 50));
        h = Math.max(46, Math.round(m.textHeight + 24));
        break;

      case 'process':
        w = Math.max(MIN_BLOCK_WIDTH, Math.round(m.textWidth + 40));
        h = Math.max(46, Math.round(m.textHeight + 22));
        break;

      case 'io':
        skew = 22;
        w = Math.max(MIN_BLOCK_WIDTH + 20, Math.round(m.textWidth + skew * 2 + 36));
        h = Math.max(46, Math.round(m.textHeight + 22));
        break;

      case 'decision':
        // Diamond shape geometry: ensure text never overflows diamond edges
        h = Math.max(70, Math.round(m.textHeight + 38));
        w = Math.max(214, Math.round((m.textWidth + 44) * 1.48));
        break;

      case 'prep':
        w = Math.max(MIN_BLOCK_WIDTH + 20, Math.round(m.textWidth + 60));
        h = Math.max(46, Math.round(m.textHeight + 24));
        break;

      case 'predef':
        w = Math.max(MIN_BLOCK_WIDTH, Math.round(m.textWidth + 52));
        h = Math.max(46, Math.round(m.textHeight + 22));
        break;

      default:
        w = Math.max(MIN_BLOCK_WIDTH, Math.round(m.textWidth + 40));
        h = Math.max(46, Math.round(m.textHeight + 22));
    }

    // Make widths even numbers for crisp pixel-aligned rendering
    if (w % 2 !== 0) w++;
    if (h % 2 !== 0) h++;

    return { w: w, h: h, skew: skew };
  }

  // Layout a sequence of CFG nodes into shapes and edges
  function layoutDiagram(cfg, options) {
    options = options || {};
    var shapes = [];
    var edges = [];

    // First pass: recursively layout nodes and compute bounding boxes
    // Sub-graphs return { shapes, edges, width, height, entryPoint, exitPoint, leftBypass, rightBypass }
    var result = layoutSequence(cfg.nodes, 0, 0, options);

    // Normalize coordinates so minX starts at padding (e.g. 50px)
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    result.shapes.forEach(function (s) {
      if (s.x < minX) minX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.x + s.w > maxX) maxX = s.x + s.w;
      if (s.y + s.h > maxY) maxY = s.y + s.h;
    });

    result.edges.forEach(function (e) {
      e.points.forEach(function (p) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
      });
    });

    var padX = 50;
    var padY = 40;
    var shiftX = padX - (isFinite(minX) ? minX : 0);
    var shiftY = padY - (isFinite(minY) ? minY : 0);

    result.shapes.forEach(function (s) {
      s.x += shiftX;
      s.y += shiftY;
      s.cx = s.x + s.w / 2;
      s.cy = s.y + s.h / 2;
    });

    result.edges.forEach(function (e) {
      e.points = e.points.map(function (p) {
        return [Math.round((p[0] + shiftX) * 10) / 10, Math.round((p[1] + shiftY) * 10) / 10];
      });
    });

    var totalW = Math.round(maxX - minX + padX * 2);
    var totalH = Math.round(maxY - minY + padY * 2);

    return {
      shapes: result.shapes,
      edges: result.edges,
      titles: [],
      width: Math.max(300, totalW),
      height: Math.max(400, totalH)
    };
  }

  function layoutSequence(nodes, startX, startY, options) {
    var shapes = [];
    var edges = [];
    var curY = startY;
    var prevExit = null;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];

      if (node.type === 'if') {
        var ifResult = layoutIf(node, startX, curY, options);
        shapes = shapes.concat(ifResult.shapes);
        edges = edges.concat(ifResult.edges);

        if (prevExit) {
          edges.push({
            points: [prevExit, ifResult.entryPoint],
            arrow: false
          });
        }

        prevExit = ifResult.exitPoint;
        curY = ifResult.bottomY + VERTICAL_GAP;
        continue;
      }

      if (node.type === 'for' || node.type === 'while' || node.type === 'foreach') {
        var loopResult = layoutLoop(node, startX, curY, options);
        shapes = shapes.concat(loopResult.shapes);
        edges = edges.concat(loopResult.edges);

        if (prevExit) {
          edges.push({
            points: [prevExit, loopResult.entryPoint],
            arrow: false
          });
        }

        prevExit = loopResult.exitPoint;
        curY = loopResult.bottomY + VERTICAL_GAP;
        continue;
      }

      if (node.type === 'dowhile') {
        var doResult = layoutDoWhile(node, startX, curY, options);
        shapes = shapes.concat(doResult.shapes);
        edges = edges.concat(doResult.edges);

        if (prevExit) {
          edges.push({
            points: [prevExit, doResult.entryPoint],
            arrow: false
          });
        }

        prevExit = doResult.exitPoint;
        curY = doResult.bottomY + VERTICAL_GAP;
        continue;
      }

      // Simple node (terminal, process, io, predef)
      var dim = computeShapeDimensions(node.type, node.lines);
      var x = startX - dim.w / 2;
      var y = curY;
      var cx = startX;
      var cy = y + dim.h / 2;

      var shapeObj = {
        id: node.id,
        type: node.type,
        x: x,
        y: y,
        w: dim.w,
        h: dim.h,
        cx: cx,
        cy: cy,
        lines: node.lines,
        fontSize: FONT_SIZE,
        lineH: LINE_HEIGHT,
        srcLine: node.srcLine,
        skew: dim.skew
      };
      shapes.push(shapeObj);

      var entryPoint = [cx, y];
      var exitPoint = [cx, y + dim.h];

      if (prevExit) {
        edges.push({
          points: [prevExit, entryPoint],
          arrow: false
        });
      }

      prevExit = exitPoint;
      curY = y + dim.h + VERTICAL_GAP;
    }

    return {
      shapes: shapes,
      edges: edges,
      entryPoint: shapes.length > 0 ? [startX, shapes[0].y] : [startX, startY],
      exitPoint: prevExit,
      bottomY: curY - VERTICAL_GAP
    };
  }

  // Layout IF-THEN / IF-THEN-ELSE
  function layoutIf(node, startX, startY, options) {
    var shapes = [];
    var edges = [];

    var condLines = node.lines || [node.condition];
    var dim = computeShapeDimensions('decision', condLines);
    var decX = startX - dim.w / 2;
    var decY = startY;
    var decCx = startX;
    var decCy = decY + dim.h / 2;

    var decisionShape = {
      id: node.id,
      type: 'decision',
      x: decX,
      y: decY,
      w: dim.w,
      h: dim.h,
      cx: decCx,
      cy: decCy,
      lines: condLines,
      fontSize: FONT_SIZE,
      lineH: LINE_HEIGHT,
      srcLine: node.srcLine
    };
    shapes.push(decisionShape);

    var thenStartY = decY + dim.h + VERTICAL_GAP;
    var thenResult = (node.thenBranch && node.thenBranch.length > 0)
      ? layoutSequence(node.thenBranch, startX, thenStartY, options)
      : null;

    if (thenResult) {
      shapes = shapes.concat(thenResult.shapes);
      edges = edges.concat(thenResult.edges);
      // Downward edge from bottom of decision to then branch: "Да"
      edges.push({
        points: [[decCx, decY + dim.h], thenResult.entryPoint],
        label: 'Да',
        arrow: false
      });
    }

    var elseResult = null;
    var elseX = startX + dim.w / 2 + 80;

    if (node.elseBranch && node.elseBranch.length > 0) {
      // Find width of then branch to ensure adequate clearance
      var thenMaxW = dim.w;
      if (thenResult) {
        thenResult.shapes.forEach(function (s) {
          if (s.w > thenMaxW) thenMaxW = s.w;
        });
      }
      elseX = startX + Math.max(dim.w / 2 + 60, thenMaxW / 2 + 50) + 110;

      elseResult = layoutSequence(node.elseBranch, elseX, thenStartY, options);
      shapes = shapes.concat(elseResult.shapes);
      edges = edges.concat(elseResult.edges);

      // Edge from right vertex of decision to else branch: "Нет"
      edges.push({
        points: [
          [decX + dim.w, decCy],
          [elseX, decCy],
          elseResult.entryPoint
        ],
        label: 'Нет',
        arrow: false
      });
    }

    // Merge point calculation
    var thenBottomY = thenResult ? thenResult.bottomY : (decY + dim.h);
    var elseBottomY = elseResult ? elseResult.bottomY : decCy;
    var mergeY = Math.max(thenBottomY, elseBottomY) + 24;

    // Connect then-branch to merge point
    if (thenResult && thenResult.exitPoint) {
      edges.push({
        points: [thenResult.exitPoint, [decCx, mergeY]],
        arrow: false
      });
    } else if (!thenResult) {
      edges.push({
        points: [[decCx, decY + dim.h], [decCx, mergeY]],
        label: 'Да',
        arrow: false
      });
    }

    // Connect else-branch (or "Нет" bypass if no else branch) to merge point
    if (elseResult && elseResult.exitPoint) {
      edges.push({
        points: [
          elseResult.exitPoint,
          [elseX, mergeY],
          [decCx, mergeY]
        ],
        arrow: false
      });
    } else {
      // If without else: right vertex goes right and down to merge
      var bypassX = startX + dim.w / 2 + 40;
      edges.push({
        points: [
          [decX + dim.w, decCy],
          [bypassX, decCy],
          [bypassX, mergeY],
          [decCx, mergeY]
        ],
        label: 'Нет',
        arrow: false
      });
    }

    return {
      shapes: shapes,
      edges: edges,
      entryPoint: [decCx, decY],
      exitPoint: [decCx, mergeY],
      bottomY: mergeY
    };
  }

  // Layout FOR / WHILE / FOREACH loops
  function layoutLoop(node, startX, startY, options) {
    var shapes = [];
    var edges = [];

    var isPrep = (node.type === 'for' || node.type === 'foreach');
    var shapeType = isPrep ? 'prep' : 'decision';
    var lines = node.lines || [node.text || node.condition];

    var dim = computeShapeDimensions(shapeType, lines);
    var headX = startX - dim.w / 2;
    var headY = startY;
    var headCx = startX;
    var headCy = headY + dim.h / 2;

    var headShape = {
      id: node.id,
      type: shapeType,
      x: headX,
      y: headY,
      w: dim.w,
      h: dim.h,
      cx: headCx,
      cy: headCy,
      lines: lines,
      fontSize: FONT_SIZE,
      lineH: LINE_HEIGHT,
      srcLine: node.srcLine
    };
    shapes.push(headShape);

    // Layout body below loop header
    var bodyStartY = headY + dim.h + VERTICAL_GAP;
    var bodyResult = (node.body && node.body.length > 0)
      ? layoutSequence(node.body, startX, bodyStartY, options)
      : null;

    if (bodyResult) {
      shapes = shapes.concat(bodyResult.shapes);
      edges = edges.concat(bodyResult.edges);

      // Downward flow from header into body
      edges.push({
        points: [[headCx, headY + dim.h], bodyResult.entryPoint],
        label: isPrep ? null : 'Да',
        arrow: false
      });
    }

    // Find max width of body to calculate left and right bypass channels cleanly
    var maxBodyW = dim.w;
    if (bodyResult) {
      bodyResult.shapes.forEach(function (s) {
        if (s.w > maxBodyW) maxBodyW = s.w;
      });
    }

    var leftTrackX = startX - maxBodyW / 2 - 36;
    var rightTrackX = startX + maxBodyW / 2 + 36;
    var bodyBottomY = bodyResult ? bodyResult.bottomY : (headY + dim.h);

    // 1. Return path (Back-edge): End of body -> Left track -> UP -> into Left vertex of loop header
    // Strict GOST: Line going UP has arrow!
    var loopReturnY = bodyBottomY + 16;
    var bodyExit = bodyResult ? bodyResult.exitPoint : [headCx, headY + dim.h + 20];

    edges.push({
      points: [
        bodyExit,
        [headCx, loopReturnY],
        [leftTrackX, loopReturnY],
        [leftTrackX, headCy],
        [headX, headCy]
      ],
      arrow: true // UPWARD FLOW MUST HAVE ARROW UNDER GOST 19.701-90!
    });

    // 2. Exit path: Right vertex of header -> Right track -> DOWN -> below loop body
    var loopExitY = loopReturnY + 24;
    edges.push({
      points: [
        [headX + dim.w, headCy],
        [rightTrackX, headCy],
        [rightTrackX, loopExitY],
        [headCx, loopExitY]
      ],
      label: isPrep ? null : 'Нет',
      arrow: false // Downward flow has no arrow
    });

    return {
      shapes: shapes,
      edges: edges,
      entryPoint: [headCx, headY],
      exitPoint: [headCx, loopExitY],
      bottomY: loopExitY
    };
  }

  // Layout DO-WHILE loop (Body first, condition at bottom, back-edge to top)
  function layoutDoWhile(node, startX, startY, options) {
    var shapes = [];
    var edges = [];

    // 1. Layout body first
    var bodyResult = (node.body && node.body.length > 0)
      ? layoutSequence(node.body, startX, startY, options)
      : null;

    if (bodyResult) {
      shapes = shapes.concat(bodyResult.shapes);
      edges = edges.concat(bodyResult.edges);
    }

    var condStartY = bodyResult ? (bodyResult.bottomY + VERTICAL_GAP) : startY;

    // 2. Condition decision diamond at bottom
    var condLines = node.lines || [node.condition];
    var dim = computeShapeDimensions('decision', condLines);
    var decX = startX - dim.w / 2;
    var decY = condStartY;
    var decCx = startX;
    var decCy = decY + dim.h / 2;

    var decisionShape = {
      id: node.id,
      type: 'decision',
      x: decX,
      y: decY,
      w: dim.w,
      h: dim.h,
      cx: decCx,
      cy: decCy,
      lines: condLines,
      fontSize: FONT_SIZE,
      lineH: LINE_HEIGHT,
      srcLine: node.srcLine
    };
    shapes.push(decisionShape);

    if (bodyResult && bodyResult.exitPoint) {
      edges.push({
        points: [bodyResult.exitPoint, [decCx, decY]],
        arrow: false
      });
    }

    // 3. Loop back path: from right vertex of decision -> UP to top of body with arrow!
    var maxW = dim.w;
    if (bodyResult) {
      bodyResult.shapes.forEach(function (s) {
        if (s.w > maxW) maxW = s.w;
      });
    }
    var rightTrackX = startX + maxW / 2 + 36;
    var bodyEntryY = bodyResult ? bodyResult.entryPoint[1] - 14 : startY - 14;

    edges.push({
      points: [
        [decX + dim.w, decCy],
        [rightTrackX, decCy],
        [rightTrackX, bodyEntryY],
        [startX, bodyEntryY]
      ],
      label: 'Да',
      arrow: true // Upward line has arrow!
    });

    // 4. Exit path: from bottom of decision straight down
    var exitPoint = [decCx, decY + dim.h];

    return {
      shapes: shapes,
      edges: edges,
      entryPoint: bodyResult ? bodyResult.entryPoint : [decCx, decY],
      exitPoint: exitPoint,
      bottomY: decY + dim.h
    };
  }

  return {
    layoutDiagram: layoutDiagram,
    computeShapeDimensions: computeShapeDimensions
  };
});
