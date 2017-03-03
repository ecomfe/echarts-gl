var vec3 = require('qtek/lib/dep/glmatrix').vec3;
var ProgressiveQuickSort = require('../ProgressiveQuickSort');

var p0 = vec3.create();
var p1 = vec3.create();
var p2 = vec3.create();
// var cp = vec3.create();

module.exports = {

    needsSortTriangles: function () {
        return this.indices && this.sortTriangles;
    },

    doSortTriangles: function (cameraPos, frame) {
        var indices = this.indices;
        // Do progressive quick sort.
        if (frame === 0) {
            var posAttr = this.attributes.position;
            var cameraPos = cameraPos._array;

            if (!this._triangleZList || this._triangleZList.length !== this.triangleCount) {
                this._triangleZList = this._triangleZList || new Float32Array(this.triangleCount);
                this._sortedTriangleIndices = this._sortedTriangleIndices || new Uint32Array(this.triangleCount);

                this._indicesTmp = new indices.constructor(indices.length);
                this._triangleZListTmp = new Float32Array(this.triangleCount);
            }

            var cursor = 0;
            for (var i = 0; i < indices.length;) {
                posAttr.get(indices[i++], p0);
                posAttr.get(indices[i++], p1);
                posAttr.get(indices[i++], p2);

                // FIXME If use center ?
                // cp[0] = (p0[0] + p1[0] + p2[0]) / 3;
                // cp[1] = (p0[1] + p1[1] + p2[1]) / 3;
                // cp[2] = (p0[2] + p1[2] + p2[2]) / 3;
                // Camera position is in object space

                // Use max of three points, PENDING
                var z0 = vec3.sqrDist(p0, cameraPos);
                var z1 = vec3.sqrDist(p1, cameraPos);
                var z2 = vec3.sqrDist(p2, cameraPos);
                var zMax = Math.min(z0, z1);
                zMax = Math.min(zMax, z2);
                this._triangleZList[cursor++] = zMax;
            }
        }


        var sortedTriangleIndices = this._sortedTriangleIndices;
        for (var i = 0; i < sortedTriangleIndices.length; i++) {
            sortedTriangleIndices[i] = i;
        }

        if (this.triangleCount < 2e4) {
            // Use simple timsort for simple geometries.
            if (frame === 0) {
                this._simpleSort();
            }
        }
        else {
            for (var i = 0; i < 3; i++) {
                this._progressiveQuickSort(frame * 3 + i);
            }
        }

        var targetIndices = this._indicesTmp;
        var targetTriangleZList = this._triangleZListTmp;
        var faceZList = this._triangleZList;
        for (var i = 0; i < this.triangleCount; i++) {
            var fromIdx3 = sortedTriangleIndices[i] * 3;
            var toIdx3 = i * 3;
            targetIndices[toIdx3++] = indices[fromIdx3++];
            targetIndices[toIdx3++] = indices[fromIdx3++];
            targetIndices[toIdx3] = indices[fromIdx3];

            targetTriangleZList[i] = faceZList[sortedTriangleIndices[i]];
        }

        // Swap indices.
        var tmp = this._indicesTmp;
        this._indicesTmp = this.indices;
        this.indices = tmp;
        var tmp = this._triangleZListTmp;
        this._triangleZListTmp = this._triangleZList;
        this._triangleZList = tmp;

        this.dirtyIndices();
    },

    _simpleSort: function () {
        var faceZList = this._triangleZList;
        var sortedTriangleIndices = this._sortedTriangleIndices;
        // Simple quicksort is more effecient than v8 native quick sort when data all different.
        // In this case triangles with same depth are rare. so use simple quicksort here.
        ProgressiveQuickSort.sort(sortedTriangleIndices, function (a, b) {
            // Sort from far to near. which is descending order
            return faceZList[b] - faceZList[a];
        }, 0, sortedTriangleIndices.length - 1);
    },

    _progressiveQuickSort: function (frame) {
        var faceZList = this._triangleZList;
        var sortedTriangleIndices = this._sortedTriangleIndices;

        this._quickSort = this._quickSort || new ProgressiveQuickSort();

        this._quickSort.step(sortedTriangleIndices, function (a, b) {
            return faceZList[b] - faceZList[a];
        }, frame);
    }
};