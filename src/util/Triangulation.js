// Ear clipping polygon triangulation.
// @author pissang(https://github.com/pissang)

// https://www.geometrictools.com/Documentation/TriangulationByEarClipping.pdf

var LinkedList = require('qtek/lib/core/LinkedList');

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

var VERTEX_TYPE_CONVEX = 1;
var VERTEX_TYPE_REFLEX = 2;

function Edge(p0, p1) {

    this.p0 = p0;

    this.p1 = p1;

    // Dirty trick to speed up the delete operation in linked list
    this._linkedListEntry = null;
}

var TriangulationContext = function () {

    this.points = [];

    this.triangles = [];

    this.maxGridNumber = 50;

    this.minGridNumber = 0;

    this._gridNumber = 20;

    this._boundingBox = [[Infinity, Infinity], [-Infinity, -Infinity]];

    this._nPoints = 0;

    this._nTriangle = 0;

    this._pointsTypes = [];

    this._grids = [];

    this._gridWidth = 0;
    this._gridHeight = 0;

    this._edgeList = new LinkedList();

    // Map of point index and the edge out from the vertex
    this._edgeOut = [];

    // Map of point index and the edge in to the vertex
    this._edgeIn = [];

    this._candidates = [];
}

/**
 * @param {Array.<number>} exterior. Exterior points
 *      Points must be clockwise order. (When y is from bottom to top)
 * @param {Array.<Array>} holes. holes must be counter clockwise order.
 */
TriangulationContext.prototype.triangulate = function (exterior, holes) {
    this._nPoints = exterior.length / 2;
    if (this._nPoints < 3) {
        return;
    }

    // PENDING Dynamic grid number or fixed grid number ?
    this._gridNumber = Math.ceil(Math.sqrt(this._nPoints));
    this._gridNumber = Math.max(Math.min(this._gridNumber, this.maxGridNumber), this.minGridNumber);

    this.points = new Float32Array(exterior);

    this.holes = holes || [];

    this._reset();

    this._prepare();

    this._earClipping();
}

TriangulationContext.prototype._reset = function () {

    this._nTriangle = 0;

    this._edgeList.clear();

    this._candidates = [];
    this.triangles = [];

    this._boundingBox[0][0] = this._boundingBox[0][1] = Infinity;
    this._boundingBox[1][0] = this._boundingBox[1][1] = -Infinity;
    // Initialize grid
    var nGrids = this._gridNumber * this._gridNumber;
    var len = this._grids.length;
    for (var i = 0; i < len; i++) {
        this._grids[i].length = 0;
    }
    for (; i < nGrids; i++) {
        this._grids[i] = [];
    }
    this._grids.length = nGrids;

    // Initialize edges
    // In case the array have undefined values
    if (len < this._nPoints) {
        len = this._edgeIn.length;
        for (var i = len; i < this._nPoints; i++) {
            this._edgeIn[i] = this._edgeOut[i] = null;
        }
    }
    else {
        this._edgeIn.length = this._edgeOut.length = this._nPoints;
    }
}

// Prepare points and edges
TriangulationContext.prototype._prepare = function () {
    var bb = this._boundingBox;
    var n = this._nPoints;
    var points = this.points;

    this._pointsTypes = new Uint8Array(n);
    // Update bounding box and determine point type is reflex or convex
    for (var i = 0, j = n - 1; i < n;) {
        var k = (i + 1) % n;
        var x0 = points[j * 2];
        var y0 = points[j * 2 + 1];
        var x1 = points[i * 2];
        var y1 = points[i * 2 + 1];
        var x2 = points[k * 2];
        var y2 = points[k * 2 + 1];

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

        var area = triangleArea(x0, y0, x1, y1, x2, y2);

        this._pointsTypes[i] = area < 0 ? VERTEX_TYPE_CONVEX : VERTEX_TYPE_REFLEX;

        j = i;
        i++;
    }

    this._cutHoles();

    // nPoints may be changed after cutHoles.
    n = this._nPoints;

    // Put the points in the grids
    this._gridWidth = (bb[1][0] - bb[0][0]) / this._gridNumber;
    this._gridHeight = (bb[1][1] - bb[0][1]) / this._gridNumber;
    for (var i = 0; i < n; i++) {
        if (this._pointsTypes[i] == VERTEX_TYPE_REFLEX) {
            var x = this.points[i * 2];
            var y = this.points[i * 2 + 1];
            var key = this._getPointHash(x, y);
            this._grids[key].push(i);
        }
    }

    // Init candidates.
    for (var i= 0; i < n; i++) {
        if (this._pointsTypes[i] === VERTEX_TYPE_CONVEX) {
            this._candidates.push(i);
        }
    }
    // Create edges
    for (var i = 0; i < n - 1; i++) {
        this._addEdge(i, i+1);
    }
    this._addEdge(i, 0);
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
            var x = this.points[k * 2];
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
            if (__DEV__) {
                console.warn('Hole must be inside exterior.');
            }
            return;
        }
        var edgeEndPointIndex = (edgeStartPointIndex + 1) % points.length / 2;
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
                        seamPointIndex = idx;
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
    var nPoints = this._nPoints;
    while (candidates.length) {
        var isDesperate = true;
        for (var i = 0; i < candidates.length;) {
            var idx = candidates[i];
            if (this._isEar(idx)) {
                this._clipEar(idx);
                // TODO
                // candidates[i] = candidates[candidates.length - 1];
                // candidates.pop();
                candidates.splice(i, 1);
                isDesperate = false;

                nPoints--;
            }
            else {
                i++;
            }
        }

        if (isDesperate) {
            // Random pick a convex vertex when there is no more ear
            // can be clipped and there are more than 3 points left
            // After clip the random picked vertex, go on finding ears again
            // So it can be extremely slow in worst case
            // TODO
            this._clipEar(candidates.pop());
            nPoints--;
        }
    }
}

TriangulationContext.prototype._isEar = function (p1) {
    // Find two adjecent edges
    var e0 = this._edgeIn[p1];
    var e1 = this._edgeOut[p1];
    // Find two adjecent vertices
    var p0 = e0.p0;
    var p2 = e1.p1;

    var x0 = this.points[p0 * 2];
    var y0 = this.points[p0 * 2 + 1];
    var x1 = this.points[p1 * 2];
    var y1 = this.points[p1 * 2 + 1];
    var x2 = this.points[p2 * 2];
    var y2 = this.points[p2 * 2 + 1];

    // Clipped the tiny triangles directly
    // if (Math.abs(triangleArea(x0, y0, x1, y1, x2, y2)) < 1) {
    //     return true;
    // }

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
                    var xi = this.points[idx * 2];
                    var yi = this.points[idx * 2 + 1];
                    if (isPointInTriangle(x0, y0, x1, y1, x2, y2, xi, yi)) {
                        return false;
                    }
                }
            }
        }
    }

    return true;
}

TriangulationContext.prototype._clipEar = function (p1) {

    var e0 = this._edgeIn[p1];
    var e1 = this._edgeOut[p1];

    var offset = this._nTriangle * 3;
    // FIXME e0 may same with e1
    this.triangles[offset] = e0.p0;
    this.triangles[offset + 1] = e0.p1;
    this.triangles[offset + 2] = e1.p1;

    this._nTriangle++;

    var e0i = this._edgeIn[e0.p0];
    var e1o = this._edgeOut[e1.p1];
    // New candidate after clipping (convex vertex)
    if (this._pointsTypes[e0.p0] == VERTEX_TYPE_REFLEX) {
        if (this.isTriangleConvex2(e0i.p0, e0.p0, e1.p1)) {
            // PENDING
            // The index in the grids also needs to be removed
            // But because it needs `splice` and `indexOf`
            // may cost too much
            this._candidates.push(e0.p0);
            this._pointsTypes[e0.p0] = VERTEX_TYPE_CONVEX;
        }
    }
    if (this._pointsTypes[e1.p1] == VERTEX_TYPE_REFLEX) {
        if (this.isTriangleConvex2(e0.p0, e1.p1, e1o.p1)) {
            this._candidates.push(e1.p1);
            this._pointsTypes[e1.p1] = VERTEX_TYPE_CONVEX;
        }
    }

    this._removeEdge(e0);
    this._removeEdge(e1);

    this._addEdge(e0.p0, e1.p1);

};

TriangulationContext.prototype._addEdge = function (p0, p1) {

    var edge = new Edge(p0, p1);
    this._edgeOut[p0] = edge;
    this._edgeIn[p1] = edge;
    var entry = this._edgeList.insert(edge);
    edge._linkedListEntry = entry;

    return edge;
};

TriangulationContext.prototype._removeEdge = function (e) {
    this._edgeList.remove(e._linkedListEntry);
    this._edgeOut[e.p0] = null;
    this._edgeIn[e.p1] = null;
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

        // Use `if` instead of `min` `max` methods when having three or more params
        // http://jsperf.com/min-max-multiple-param
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
    return this.triangleArea(p0, p1, p2) < 0;
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

module.exports = TriangulationContext;