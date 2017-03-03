var vec3 = require('qtek/lib/dep/glmatrix').vec3;
var ProgressiveQuickSort = require('../ProgressiveQuickSort');

module.exports = {

    needsSortVertices: function () {
        return this.sortVertices;
    },

    doSortVertices: function (cameraPos, frame) {
        var indices = this.indices;
        var p = vec3.create();

        if (!indices) {
            indices = this.indices = this.vertexCount > 0xffff ? new Uint32Array(this.vertexCount) : new Uint16Array(this.vertexCount);
            for (var i = 0; i < indices.length; i++) {
                indices[i] = i;
            }
        }
        // Do progressive quick sort.
        if (frame === 0) {
            var posAttr = this.attributes.position;
            var cameraPos = cameraPos._array;

            if (!this._zList || this._zList.length !== this.vertexCount) {
                this._zList = this._zList || new Float32Array(this.vertexCount);
            }

            for (var i = 0; i < this.vertexCount; i++) {
                posAttr.get(i, p);
                // Camera position is in object space
                var z = vec3.sqrDist(p, cameraPos);
                if (isNaN(z)) {
                    // Put far away, NaN value may cause sort slow
                    z = 1e7;
                }
                this._zList[i] = z;
            }
        }

        if (this.vertexCount < 2e4) {
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

        this.dirtyIndices();
    },

    _simpleSort: function () {
        var zList = this._zList;
        var indices = this.indices;
        ProgressiveQuickSort.sort(indices, function (a, b) {
            // Sort from far to near. which is descending order
            return zList[b] - zList[a];
        }, 0, indices.length - 1);
    },

    _progressiveQuickSort: function (frame) {
        var zList = this._zList;
        var indices = this.indices;

        this._quickSort = this._quickSort || new ProgressiveQuickSort();

        this._quickSort.step(indices, function (a, b) {
            return zList[b] - zList[a];
        }, frame);
    }
};