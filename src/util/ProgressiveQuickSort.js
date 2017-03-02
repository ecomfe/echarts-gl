var timsort = require('zrender/lib/core/timsort');

// TODO Test.
function ProgressiveQuickSort() {

    // this._pivotList = new LinkedList();
    this._parts = [];
}

function swap(arr, a, b) {
    var tmp = arr[a];
    arr[a] = arr[b];
    arr[b] = tmp;
}

ProgressiveQuickSort.prototype.step = function (arr, compare, frame) {

    var len = arr.length;
    if (frame === 0) {
        this._parts = [];
        this._sorted = false;

        // Pick a start pivot;
        var pivot = Math.floor(len / 2);
        this._parts.push({
            pivot: pivot,
            left: 0,
            right: len - 1
        });
    }

    if (this._sorted) {
        return;
    }

    var parts = this._parts;
    if (parts.length === 0) {
        this._sorted = true;
        // Already finished.
        return true;
    }
    else if (parts.length < 1024) {
        // partition
        for (var i = 0; i < parts.length; i++) {
            var left = parts[i].left;
            var right = parts[i].right;
            var pivot = parts[i].pivot;

            var storeIndex = left;
            var pivotValue = arr[pivot];

            // put the pivot on the right
            swap(arr, pivot, right);

            // go through the rest
            for(var v = left; v < right; v++) {
                // if the value is less than the pivot's
                // value put it to the left of the pivot
                // point and move the pivot point along one
                if (compare(arr[v], pivotValue) < 0) {
                    swap(arr, v, storeIndex);
                    storeIndex++;
                }
            }

            // finally put the pivot in the correct place
            swap(arr, right, storeIndex);
            // Modify the pivot index.
            parts[i].pivot = storeIndex;
        }

        var subdividedParts = [];
        for (var i = 0; i < parts.length; i++) {
            // Subdivide left
            var left = parts[i].left;
            var right = parts[i].pivot - 1;
            if (right > left) {
                subdividedParts.push({
                    pivot: Math.floor((right + left) / 2),
                    left: left, right: right
                });
            }
            // Subdivide right
            var left = parts[i].pivot + 1;
            var right = parts[i].right;
            if (right > left) {
                subdividedParts.push({
                    pivot: Math.floor((right + left) / 2),
                    left: left, right: right
                });
            }
        }
        parts = this._parts = subdividedParts;
    }
    else {
        // Finally use timsort to sort the hole array.
        // PENDING timsort is much faster for the semi sorted array ?
        timsort(arr, compare);

        this._sorted = true;
        return true;
    }

    return false;
}

module.exports = ProgressiveQuickSort;