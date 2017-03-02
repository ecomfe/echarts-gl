var timsort = require('zrender/lib/core/timsort');
var vec3 = require('qtek/lib/dep/glmatrix').vec3;

var p0 = vec3.create();
var p1 = vec3.create();
var p2 = vec3.create();
var cp = vec3.create();

module.exports = {

    needsSortFaces: function () {
        return this.faces && this.faceCount < 1e5;
    },

    doSortFaces: function (worldViewMatrix, frame) {
        // Do progressive quick sort.
        if (frame === 0) {
            var posAttr = this.attributes.position;
            var mat = worldViewMatrix._array;
            var faces = this.faces;
            if (!this._faceZList || this._faceZList.length !== this.faceCount) {
                this._faceZList = this._faceZList || new Float32Array(this.faceCount);
                this._sortedFaceIndices = this._sortedFaceIndices || new Uint32Array(this.faceCount);

                this._facesTmp = new faces.constructor(faces.length);
            }
            var faceZList = this._faceZList;
            var targetFaces = this._facesTmp;

            var cursor = 0;
            for (var i = 0; i < faces.length;) {
                posAttr.get(faces[i++], p0);
                posAttr.get(faces[i++], p1);
                posAttr.get(faces[i++], p2);

                cp[0] = (p0[0] + p1[0] + p2[0]) / 3;
                cp[1] = (p0[1] + p1[1] + p2[1]) / 3;
                cp[2] = (p0[2] + p1[2] + p2[2]) / 3;

                vec3.transformMat4(cp, cp, mat);
                // Convert to positive
                faceZList[cursor++] = -cp[2];
            }

            var sortedFaceIndices = this._sortedFaceIndices;
            for (var i = 0; i < sortedFaceIndices.length; i++) {
                sortedFaceIndices[i] = i;
            }
            timsort(sortedFaceIndices, function (a, b) {
                // Sort from far to near. which is descending order
                return faceZList[b] - faceZList[a];
            });

            for (var i = 0; i < this.faceCount; i++) {
                var fromIdx3 = sortedFaceIndices[i] * 3;
                var toIdx3 = i * 3;
                targetFaces[toIdx3++] = faces[fromIdx3++];
                targetFaces[toIdx3++] = faces[fromIdx3++];
                targetFaces[toIdx3] = faces[fromIdx3];
            }
            // Swap faces.
            var tmp = this._facesTmp;
            this._facesTmp = this.faces;
            this.faces = tmp;

            this.dirtyFaces();
        }
    }
};