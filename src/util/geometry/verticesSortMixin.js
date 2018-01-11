import ProgressiveQuickSort from '../ProgressiveQuickSort';
import glmatrix from 'claygl/src/dep/glmatrix';
var vec3 = glmatrix.vec3;

export default {

    needsSortVertices: function () {
        return this.sortVertices;
    },

    needsSortVerticesProgressively: function () {
        return this.needsSortVertices() && this.vertexCount >= 2e4;
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
            var cameraPos = cameraPos.array;
            var noneCount = 0;
            if (!this._zList || this._zList.length !== this.vertexCount) {
                this._zList = new Float32Array(this.vertexCount);
            }

            var firstZ;
            for (var i = 0; i < this.vertexCount; i++) {
                posAttr.get(i, p);
                // Camera position is in object space
                var z = vec3.sqrDist(p, cameraPos);
                if (isNaN(z)) {
                    // Put far away, NaN value may cause sort slow
                    z = 1e7;
                    noneCount++;
                }
                if (i === 0) {
                    firstZ = z;
                    z = 0;
                }
                else {
                    // Only store the difference to avoid the precision issue.
                    z = z - firstZ;
                }
                this._zList[i] = z;
            }

            this._noneCount = noneCount;
        }

        if (this.vertexCount < 2e4) {
            // Use simple native sort for simple geometries.
            if (frame === 0) {
                this._simpleSort(this._noneCount / this.vertexCount > 0.05);
            }
        }
        else {
            for (var i = 0; i < 3; i++) {
                this._progressiveQuickSort(frame * 3 + i);
            }
        }

        this.dirtyIndices();
    },

    _simpleSort: function (useNativeQuickSort) {
        var zList = this._zList;
        var indices = this.indices;
        function compare(a, b) {
            // Sort from far to near. which is descending order
            return zList[b] - zList[a];
        }

        // When too much value are equal, using native quick sort with three partition..
        // or the simple quick sort will be nearly O(n*n)
        // http://stackoverflow.com/questions/5126586/quicksort-complexity-when-all-the-elements-are-same

        // Otherwise simple quicksort is more effecient than v8 native quick sort when data all different.
        if (useNativeQuickSort) {
            Array.prototype.sort.call(indices, compare);
        }
        else {
            ProgressiveQuickSort.sort(indices, compare, 0, indices.length - 1);
        }
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