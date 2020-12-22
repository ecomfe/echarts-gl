// Ear clipping polygon triangulation.

// https://www.geometrictools.com/Documentation/TriangulationByEarClipping.pdf

// http://www.cosy.sbg.ac.at/~held/projects/triang/triang.html
// Z Order Hash ?

import LinkedList from 'claygl/src/core/LinkedList';

// From x,y point cast a ray to right. and intersect with edge x0, y0, x1, y1;
// Return x value of intersect point
function intersectEdge(x0, y0, x1, y1, x, y) {
    if ((y > y0 && y > y1) || (y < y0 && y < y1)) {
        return -Infinity;
    }
    // Ignore horizontal line
    if (y1 === y0) {
        return -Infinity;
    }
    var dir = y1 < y0 ? 1 : -1;
    var t = (y - y0) / (y1 - y0);

    // Avoid winding error when intersection point is the connect point of two line of polygon
    if (t === 1 || t === 0) {
        dir = y1 < y0 ? 0.5 : -0.5;
    }

    var x_ = t * (x1 - x0) + x0;

    return x_;
};

function triangleArea(x0, y0, x1, y1, x2, y2) {
    return (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1);
}

function isPointInTriangle(x0, y0, x1, y1, x2, y2, xi, yi) {
    return !(triangleArea(x0, y0, x2, y2, xi, yi) <= 0
        || triangleArea(x0, y0, xi, yi, x1, y1) <= 0
        || triangleArea(xi, yi, x2, y2, x1, y1) <= 0);
}

function area(points) {
    // Signed polygon area
    var n = points.length / 2;
    if (n < 3) {
        return 0;
    }
    var area = 0;
    for (var i = (n - 1) * 2, j = 0; j < n * 2;) {
        var x0 = points[i];
        var y0 = points[i + 1];
        var x1 = points[j];
        var y1 = points[j + 1];
        i = j;
        j += 2;
        area += x0 * y1 - x1 * y0;
    }

    return area;
}

function reverse(points, stride) {
    var n = points.length / stride;
    for (var i = 0; i < Math.floor(n / 2); i++) {
        for (var j = 0; j < stride; j++) {
            var a = i * stride + j;
            var b = (n - i - 1) * stride + j;
            var tmp = points[a];
            points[a] = points[b];
            points[b] = tmp;
        }
    }

    return points;
}

var VERTEX_TYPE_CONVEX = 1;
var VERTEX_TYPE_REFLEX = 2;

var VERTEX_COUNT_NEEDS_GRID = 50;

function Point(idx) {
    this.idx = idx;
}

var TriangulationContext = function () {

    this.points = [];

    this.triangles = [];

    this.maxGridNumber = 50;

    this.minGridNumber = 4;

    this._gridNumber = 20;

    this._boundingBox = [[Infinity, Infinity], [-Infinity, -Infinity]];

    this._nPoints = 0;

    this._pointsTypes = [];

    this._grids = [];

    this._gridWidth = 0;
    this._gridHeight = 0;

    this._candidates = null;
}

/**
 * @param {Array.<number>} exterior. Exterior points
 *      exterior should be clockwise order. (When y is from bottom to top)
 * @param {Array.<Array>} holes. holes should be counter clockwise order.
 */
TriangulationContext.prototype.triangulate = function (exterior, holes) {
    this._nPoints = exterior.length / 2;
    if (this._nPoints < 3) {
        return;
    }

    // PENDING Dynamic grid number or fixed grid number ?
    this._gridNumber = Math.ceil(Math.sqrt(this._nPoints) / 2);
    this._gridNumber = Math.max(Math.min(this._gridNumber, this.maxGridNumber), this.minGridNumber);

    this.points = exterior;

    this._needsGreed = this._nPoints > VERTEX_COUNT_NEEDS_GRID;

    if (area(this.points) > 0) {
        // Don't konw why, but use slice is more faster than new Float32Array(this.points).
        this.points = this.points.slice();
        reverse(this.points, 2);
    }

    this.holes = (holes || []).map(function (hole) {
        if (area(hole) < 0) {
            hole = hole.slice();
            reverse(hole, 2);
        }
        return hole;
    });

    this._reset();

    this._prepare();

    this._earClipping();
}

TriangulationContext.prototype._reset = function () {

    this._candidates = new LinkedList();
    this.triangles = [];

    this._boundingBox[0][0] = this._boundingBox[0][1] = Infinity;
    this._boundingBox[1][0] = this._boundingBox[1][1] = -Infinity;
    // Initialize grid

    var nGrids = this._gridNumber * this._gridNumber;
    for (var i = 0; i < nGrids; i++) {
        this._grids[i] = [];
    }
    this._grids.length = nGrids;
}

// Prepare points
TriangulationContext.prototype._prepare = function () {
    var bb = this._boundingBox;
    var n = this._nPoints;
    var points = this.points;

    this._pointsTypes = [];

    // Update bounding box and determine point type is reflex or convex
    for (var i = 0, j = n - 1; i < n;) {
        var k = (i + 1) % n;
        var x0 = points[j * 2];
        var y0 = points[j * 2 + 1];
        var x1 = points[i * 2];
        var y1 = points[i * 2 + 1];
        var x2 = points[k * 2];
        var y2 = points[k * 2 + 1];

        if (this._needsGreed) {
            if (x1 < bb[0][0]) { bb[0][0] = x1; }
            if (y1 < bb[0][1]) { bb[0][1] = y1; }
            if (x1 > bb[1][0]) { bb[1][0] = x1; }
            if (y1 > bb[1][1]) { bb[1][1] = y1; }

            // Make the bounding box a litte bigger
            // Avoid the geometry hashing will touching the bound of the bounding box
            bb[0][0] -= 0.1;
            bb[0][1] -= 0.1;
            bb[1][0] += 0.1;
            bb[1][1] += 0.1;
        }

        var area = triangleArea(x0, y0, x1, y1, x2, y2);

        // Including 0.
        this._pointsTypes[i] = area <= 0 ? VERTEX_TYPE_CONVEX : VERTEX_TYPE_REFLEX;

        j = i;
        i++;
    }

    this._cutHoles();

    // points may be changed after cutHoles.
    n = this._nPoints;
    points = this.points;

    // Init candidates.
    for (var i= 0; i < n; i++) {
        this._candidates.insert(new Point(i));
    }

    // Put the points in the grids
    if (this._needsGreed) {
        this._gridWidth = (bb[1][0] - bb[0][0]) / this._gridNumber;
        this._gridHeight = (bb[1][1] - bb[0][1]) / this._gridNumber;
        for (var i = 0; i < n; i++) {
            var x = points[i * 2];
            var y = points[i * 2 + 1];
            if (this._pointsTypes[i] == VERTEX_TYPE_REFLEX) {
                var key = this._getPointHash(x, y);
                this._grids[key].push(i);
            }
        }
    }
};

// Finding Mutually Visible Vertices and cut the polygon to remove holes.
TriangulationContext.prototype._cutHoles = function () {
    var holes = this.holes;

    if (!holes.length) {
        return;
    }
    holes = holes.slice();
    var xMaxOfHoles = [];
    var xMaxIndicesOfHoles = [];
    for (var i = 0; i < holes.length; i++) {
        var hole = holes[i];
        var holeMaxX = -Infinity;
        var holeMaxXIndex = 0;
        // Find index of xMax in the hole.
        for (var k = 0; k < hole.length; k += 2) {
            var x = hole[k * 2];
            if (x > holeMaxX) {
                holeMaxXIndex = k / 2;
                holeMaxX = x;
            }
        }
        xMaxOfHoles.push(holeMaxX);
        xMaxIndicesOfHoles.push(holeMaxXIndex);
    }

    var self = this;
    function cutHole() {
        var points = self.points;
        var nPoints = self._nPoints;

        var holeMaxX = -Infinity;
        var holeMaxXIndex = 0;
        var holeIndex = 0;
        // Find hole which xMax is rightest
        for (var i = 0; i < xMaxOfHoles.length; i++) {
            if (xMaxOfHoles[i] > holeMaxX) {
                holeMaxX = xMaxOfHoles[i];
                holeMaxXIndex = xMaxIndicesOfHoles[i];
                holeIndex = i;
            }
        }

        var holePoints = holes[holeIndex];

        xMaxOfHoles.splice(holeIndex, 1);
        xMaxIndicesOfHoles.splice(holeIndex, 1);
        holes.splice(holeIndex, 1);

        var holePointX = holePoints[holeMaxXIndex * 2];
        var holePointY = holePoints[holeMaxXIndex * 2 + 1];
        var minRayX = Infinity;
        var edgeStartPointIndex = -1;
        // Find nearest intersected line
        for (var i = 0, j = points.length - 2; i < points.length; i += 2) {
            var x0 = points[j], y0 = points[j + 1];
            var x1 = points[i], y1 = points[i + 1];

            var rayX = intersectEdge(x0, y0, x1, y1, holePointX, holePointY);
            if (rayX >= holePointX) {
                // Intersected.
                if (rayX < minRayX) {
                    minRayX = rayX;
                    edgeStartPointIndex = j / 2;
                }
            }

            j = i;
        }
        // Didn't find
        if (edgeStartPointIndex < 0) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Hole must be inside exterior.');
            }
            return;
        }
        var edgeEndPointIndex = (edgeStartPointIndex + 1) % (points.length / 2);
        // Point of seam edge/
        var seamPointIndex = (points[edgeStartPointIndex * 2] > points[edgeEndPointIndex * 2]) ? edgeStartPointIndex : edgeEndPointIndex;
        // Use maximum x of edge
        var seamX = points[seamPointIndex * 2];
        var seamY = points[seamPointIndex * 2 + 1];

        var minimumAngleCos = Infinity;
        // And figure out if any of reflex points is in the triangle,
        // if has, use the reflex point with minimum angle with (1, 0)
        for (var i = 0; i < nPoints; i++) {
            if (self._pointsTypes[i] === VERTEX_TYPE_REFLEX) {
                var xi = points[i * 2];
                var yi = points[i * 2 + 1];
                if (isPointInTriangle(holePointX, holePointY, minRayX, holePointY, seamX, seamY, xi, yi)) {
                    // Use dot product with (1, 0) as angle
                    var dx = xi - holePointX;
                    var dy = yi - holePointY;
                    var len = Math.sqrt(dx * dx + dy * dy);
                    dx /= len; dy /= len;
                    var angleCos = dx * dx;
                    if (angleCos < minimumAngleCos) {
                        minimumAngleCos = angleCos;
                        // Replaced seam.
                        seamPointIndex = i;
                    }
                }
            }
        }

        // TODO Use splice to add maybe slow
        var newPointsCount = nPoints + holePoints.length / 2 + 2;
        var newPoints = new Float32Array(newPointsCount * 2);
        var newPointsTypes = new Uint8Array(newPointsCount);
        seamX = points[seamPointIndex * 2];
        seamY = points[seamPointIndex * 2 + 1];

        var offPt = 0;
        var offType = 0;

        // x, y, prevX, prevY, nextX, nextY is used for point type.
        var x, y;
        var prevX, prevY, nextX, nextY;
        function copyPoints(idx, source) {
            prevX = x;
            prevY = y;
            x = newPoints[offPt++] = source[idx * 2];
            y = newPoints[offPt++] = source[idx * 2 + 1];
        }
        function guessAndAddPointType() {
            var type = triangleArea(prevX, prevY, x, y, nextX, nextY) < 0 ? VERTEX_TYPE_CONVEX : VERTEX_TYPE_REFLEX;
            newPointsTypes[offType++] = type;
        }

        for (var i = 0; i < seamPointIndex; i++) {
            copyPoints(i, points);
            newPointsTypes[offType++] = self._pointsTypes[i];
        }
        copyPoints(seamPointIndex, points);
        if (0 === seamPointIndex) { // In case first point is seam.
            prevX = points[nPoints * 2 - 2];
            prevY = points[nPoints * 2 - 1];
        }
        nextX = holePoints[holeMaxXIndex * 2];
        nextY = holePoints[holeMaxXIndex * 2 + 1];

        guessAndAddPointType();

        // Add hole
        for (var i = 0, holePointsCount = holePoints.length / 2; i < holePointsCount; i++) {
            var idx = (i + holeMaxXIndex) % holePointsCount;
            copyPoints(idx, holePoints);

            var nextIdx = (idx + 1) % holePointsCount;
            nextX = holePoints[nextIdx * 2]; nextY = holePoints[nextIdx * 2 + 1];
            guessAndAddPointType();
        }
        // Add another seam.
        copyPoints(holeMaxXIndex, holePoints);
        nextX = seamX; nextY = seamY;
        guessAndAddPointType();
        copyPoints(seamPointIndex, points);
        var nextIdx = (seamPointIndex + 1) % nPoints;
        nextX = points[nextIdx * 2]; nextY = points[nextIdx * 2 + 1];
        guessAndAddPointType();

        // Add rest
        for (var i = seamPointIndex + 1; i < nPoints; i++) {
            copyPoints(i, points);
            newPointsTypes[offType++] = self._pointsTypes[i];
        }

        // Update points and pointsTypes
        self.points = newPoints;
        self._pointsTypes = newPointsTypes;
        self._nPoints = newPointsCount;
    }

    var count = holes.length;
    while (count--) {
        cutHole();
    }
};

TriangulationContext.prototype._earClipping = function () {
    var candidates = this._candidates;
    while (candidates.length() > 2) {
        var isDesperate = true;
        var entry = candidates.head;
        while (entry && candidates.length() > 2) {
            if (this._isEar(entry)) {
                entry = this._clipEar(entry);
                isDesperate = false;
            }
            else {
                entry = entry.next;
            }
        }

        if (isDesperate && candidates.length() > 2) {
            // var entry = candidates.head;
            // console.log('------');
            // while (entry) {
            //     var idx = entry.value.idx;
            //     var xi = this.points[idx * 2];
            //     var yi = this.points[idx * 2 + 1];
            //     console.log([xi, yi]);
            //     entry = entry.next;
            // }


            // Random pick a convex vertex when there is no more ear
            // can be clipped and there are more than 3 points left
            // After clip the random picked vertex, go on finding ears again
            // So it can be extremely slow in worst case
            // TODO
            this._clipEar(candidates.head);
        }
    }
}

TriangulationContext.prototype._isEar = function (pointEntry) {
    if (this._pointsTypes[pointEntry.value.idx] === VERTEX_TYPE_REFLEX) {
        return;
    }

    var points = this.points;

    var prevPointEntry = pointEntry.prev || this._candidates.tail;
    var nextPointEntry = pointEntry.next || this._candidates.head;
    var p0 = prevPointEntry.value.idx;
    var p1 = pointEntry.value.idx;
    var p2 = nextPointEntry.value.idx;

    p0 *= 2;
    p1 *= 2;
    p2 *= 2;
    var x0 = points[p0];
    var y0 = points[p0 + 1];
    var x1 = points[p1];
    var y1 = points[p1 + 1];
    var x2 = points[p2];
    var y2 = points[p2 + 1];

    // Clipped the tiny triangles directly
    if (Math.abs(triangleArea(x0, y0, x1, y1, x2, y2)) < Number.EPSILON) {
        return true;
    }

    if (this._needsGreed) {
        var range = this._getTriangleGrids(x0, y0, x1, y1, x2, y2);

        // Find all the points in the grids covered by the triangle
        // And figure out if any of them is in the triangle
        for (var j = range[0][1]; j <= range[1][1]; j++) {
            for (var i = range[0][0]; i <= range[1][0]; i++) {
                var gridIdx = j * this._gridNumber + i;
                var gridPoints = this._grids[gridIdx];

                for (var k = 0; k < gridPoints.length; k++) {
                    var idx = gridPoints[k];
                    if (this._pointsTypes[idx] == VERTEX_TYPE_REFLEX) {
                        var xi = points[idx * 2];
                        var yi = points[idx * 2 + 1];
                        if (isPointInTriangle(x0, y0, x1, y1, x2, y2, xi, yi)) {
                            return false;
                        }
                    }
                }
            }
        }
    }
    else {
        var entry = this._candidates.head;
        while (entry) {
            var idx = entry.value.idx;
            var xi = points[idx * 2];
            var yi = points[idx * 2 + 1];
            if (this._pointsTypes[idx] == VERTEX_TYPE_REFLEX) {
                if (isPointInTriangle(x0, y0, x1, y1, x2, y2, xi, yi)) {
                    return false;
                }
            }
            entry = entry.next;
        }
    }

    return true;
}

TriangulationContext.prototype._clipEar = function (pointEntry) {

    var candidates = this._candidates;

    var prevPointEntry = pointEntry.prev || candidates.tail;
    var nextPointEntry = pointEntry.next || candidates.head;

    var p0 = prevPointEntry.value.idx;
    var p1 = pointEntry.value.idx;
    var p2 = nextPointEntry.value.idx;

    var triangles = this.triangles;
    // FIXME e0 may same with e1
    triangles.push(p0);
    triangles.push(p1);
    triangles.push(p2);

    // PENDING
    // The index in the grids also needs to be removed
    // But because it needs `splice` and `indexOf`
    // may cost too much
    candidates.remove(pointEntry);

    if (candidates.length() === 3) {
        triangles.push(p0);
        triangles.push(p2);
        triangles.push((nextPointEntry.next || candidates.head).value.idx);
        return;
    }

    var nextNextPointEntry = nextPointEntry.next || candidates.head;
    var prevPrevPointEntry = prevPointEntry.prev || candidates.tail;

    var p0 = prevPrevPointEntry.value.idx;
    var p1 = prevPointEntry.value.idx;
    var p2 = nextPointEntry.value.idx;
    var p3 = nextNextPointEntry.value.idx;
    // Update p1, p2, vertex type.
    // New candidate after clipping (convex vertex)
    this._pointsTypes[p1] = this.isTriangleConvex2(p0, p1, p2) ? VERTEX_TYPE_CONVEX : VERTEX_TYPE_REFLEX;
    this._pointsTypes[p2] = this.isTriangleConvex2(p1, p2, p3) ? VERTEX_TYPE_CONVEX : VERTEX_TYPE_REFLEX;

    return prevPointEntry;
};

// Get geometric hash of point
// Actually it will find the grid index by giving the point (x y)
TriangulationContext.prototype._getPointHash = function (x, y) {
    var bb = this._boundingBox;
    return Math.floor((y - bb[0][1]) / this._gridHeight) * this._gridNumber
        + Math.floor((x - bb[0][0]) / this._gridWidth);
};

// Get the grid range covered by the triangle
TriangulationContext.prototype._getTriangleGrids = (function () {
    var range = [[-1, -1], [-1, -1]];
    var minX, minY, maxX, maxY;
    return function (x0, y0, x1, y1, x2, y2) {
        var bb = this._boundingBox;

        minX = maxX = x0;
        minY = maxY = y0;
        if (x1 < minX) { minX = x1; }
        if (y1 < minY) { minY = y1; }
        if (x1 > maxX) { maxX = x1; }
        if (y1 > maxY) { maxY = y1; }
        if (x2 < minX) { minX = x2; }
        if (y2 < minY) { minY = y2; }
        if (x2 > maxX) { maxX = x2; }
        if (y2 > maxY) { maxY = y2; }

        range[0][0] = Math.floor((minX - bb[0][0]) / this._gridWidth);
        range[1][0] = Math.floor((maxX - bb[0][0]) / this._gridWidth);

        range[0][1] = Math.floor((minY - bb[0][1]) / this._gridHeight);
        range[1][1] = Math.floor((maxY - bb[0][1]) / this._gridHeight);

        return range;
    };
})();

TriangulationContext.prototype.isTriangleConvex2 = function (p0, p1, p2) {
    // Including 0
    return this.triangleArea(p0, p1, p2) <= 0;
};

TriangulationContext.prototype.triangleArea = function (p0, p1, p2) {
    var x0 = this.points[p0 * 2];
    var y0 = this.points[p0 * 2 + 1];
    var x1 = this.points[p1 * 2];
    var y1 = this.points[p1 * 2 + 1];
    var x2 = this.points[p2 * 2];
    var y2 = this.points[p2 * 2 + 1];
    return (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1);
};

export default TriangulationContext;