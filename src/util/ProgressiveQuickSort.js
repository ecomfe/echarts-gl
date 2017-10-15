
function swap(arr, a, b) {
    var tmp = arr[a];
    arr[a] = arr[b];
    arr[b] = tmp;
}
function partition(arr, pivot, left, right, compare) {
    var storeIndex = left;
    var pivotValue = arr[pivot];

    // put the pivot on the right
    swap(arr, pivot, right);

    // go through the rest
    for(var v = left; v < right; v++) {
        if(compare(arr[v], pivotValue) < 0) {
            swap(arr, v, storeIndex);
            storeIndex++;
        }
    }

    // finally put the pivot in the correct place
    swap(arr, right, storeIndex);

    return storeIndex;
}

function quickSort(array, compare, left, right) {
    if(left < right) {
        var pivot = Math.floor((left + right) / 2);
        var newPivot = partition(array, pivot, left, right, compare);
        quickSort(array, compare, left, newPivot - 1);
        quickSort(array, compare, newPivot + 1, right);
    }
}


// TODO Test.
function ProgressiveQuickSort() {

    // this._pivotList = new LinkedList();
    this._parts = [];
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

        this._currentSortPartIdx = 0;
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
    else if (parts.length < 512) {
        // Sort large parts in about 10 frames.
        for (var i = 0; i < parts.length; i++) {
            // Partition and Modify the pivot index.
            parts[i].pivot = partition(
                arr, parts[i].pivot, parts[i].left, parts[i].right, compare
            );
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
        // console.time('sort');
        // Finally quick sort each parts in 10 frames.
        for (var i = 0; i < Math.floor(parts.length / 10); i++) {
            // Sort near parts first.
            var idx = parts.length - 1 - this._currentSortPartIdx;
            quickSort(arr, compare, parts[idx].left, parts[idx].right);
            this._currentSortPartIdx++;

            // Finish sort
            if (this._currentSortPartIdx === parts.length) {
                this._sorted = true;
                return true;
            }
        }
        // console.timeEnd('sort');

    }

    return false;
};

ProgressiveQuickSort.sort = quickSort;

export default ProgressiveQuickSort;