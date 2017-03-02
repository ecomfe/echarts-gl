var vec3 = require('qtek/lib/dep/glmatrix').vec3;
var ProgressiveQuickSort = require('../ProgressiveQuickSort');

var p0 = vec3.create();
var p1 = vec3.create();
var p2 = vec3.create();
var cp = vec3.create();

module.exports = {

    needsSortFaces: function () {
        return this.faces && this.sortFace;
    },

    doSortFaces: function (cameraPos, frame) {
        var faces = this.faces;
        // Do progressive quick sort.
        if (frame === 0) {
            var posAttr = this.attributes.position;
            var cameraPos = cameraPos._array;

            if (!this._faceZList || this._faceZList.length !== this.faceCount) {
                this._faceZList = this._faceZList || new Float32Array(this.faceCount);
                this._sortedFaceIndices = this._sortedFaceIndices || new Uint32Array(this.faceCount);

                this._facesTmp = new faces.constructor(faces.length);
                this._facesZListTmp = new Float32Array(this.faceCount);
            }

            var cursor = 0;
            for (var i = 0; i < faces.length;) {
                posAttr.get(faces[i++], p0);
                posAttr.get(faces[i++], p1);
                posAttr.get(faces[i++], p2);

                // FIXME If use center ?
                cp[0] = (p0[0] + p1[0] + p2[0]) / 3;
                cp[1] = (p0[1] + p1[1] + p2[1]) / 3;
                cp[2] = (p0[2] + p1[2] + p2[2]) / 3;

                // Camera position is in object space
                this._faceZList[cursor++] = vec3.sqrDist(cp, cameraPos);
            }
        }


        var sortedFaceIndices = this._sortedFaceIndices;
        for (var i = 0; i < sortedFaceIndices.length; i++) {
            sortedFaceIndices[i] = i;
        }

        if (this.faceCount < 2e4) {
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

        var targetFaces = this._facesTmp;
        var targetFacesZList = this._facesZListTmp;
        var faceZList = this._faceZList;
        for (var i = 0; i < this.faceCount; i++) {
            var fromIdx3 = sortedFaceIndices[i] * 3;
            var toIdx3 = i * 3;
            targetFaces[toIdx3++] = faces[fromIdx3++];
            targetFaces[toIdx3++] = faces[fromIdx3++];
            targetFaces[toIdx3] = faces[fromIdx3];

            targetFacesZList[i] = faceZList[sortedFaceIndices[i]];
        }

        // Swap faces.
        var tmp = this._facesTmp;
        this._facesTmp = this.faces;
        this.faces = tmp;
        var tmp = this._facesZListTmp;
        this._facesZListTmp = this._faceZList;
        this._faceZList = tmp;

        this.dirtyFaces();
    },

    _simpleSort: function () {
        var faceZList = this._faceZList;
        this._sortedFaceIndices.sort(function (a, b) {
            // Sort from far to near. which is descending order
            return faceZList[b] - faceZList[a];
        });
    },

    _progressiveQuickSort: function (frame) {
        var faceZList = this._faceZList;
        var sortedFaceIndices = this._sortedFaceIndices;

        this._quickSort = this._quickSort || new ProgressiveQuickSort();

        this._quickSort.step(sortedFaceIndices, function (a, b) {
            return faceZList[b] - faceZList[a];
        }, frame);
    }
};