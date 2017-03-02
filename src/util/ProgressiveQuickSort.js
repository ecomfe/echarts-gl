var timsort = require('zrender/lib/core/timsort');
var LinkedList = require('qtek/lib/core/LinkedList');

// TODO Test.
function ProgressiveQuickSort() {

    this._pivotList = new LinkedList();
}

function swap(arr, a, b) {
    var temp = arr[a];
    arr[a] = arr[b];
    arr[b] = temp;
}

ProgressiveQuickSort.prototype.step = function (arr, compare, frame) {

    var pivotList = this._pivotList;
    var len = arr.length;
    if (frame === 0) {
        pivotList.clear();
        this._timsortFramePivotEntry = null;
        this._timsortFrameLeft = 0;
    }

    if (pivotList.length() < 256) {
        if (frame === 0) {
            // Pick a start pivot;
            var pivot = Math.floor(len / 2);
            pivotList.insert(pivot);
        }
        else {
            var entry = pivotList.head;
            var left = 0;

            while (left < len - 1) {
                var right = entry ? entry.value : (len - 1);

                if (right - left > 10) {
                    // Insert a pivot
                    var pivot = Math.floor((right + left) / 2);
                    if (entry) {
                        pivotList.insertBeforeEntry(pivot, entry);
                    }
                    else {
                        pivotList.insert(pivot);
                    }
                }

                left = right + 1;
                entry = entry && entry.next;
            }
        }

        // partition
        var entry = pivotList.head;
        var left = 0;
        while (entry) {
            var right = entry.next ? entry.next.value : (len - 1);
            var pivot = entry.value;

            var storeIndex = left;

            // put the pivot on the right
            swap(arr, pivot, right);

            // go through the rest
            for(var v = left; v < right; v++) {
                // if the value is less than the pivot's
                // value put it to the left of the pivot
                // point and move the pivot point along one
                if (compare(v, pivot) < 0) {
                    swap(arr, v, storeIndex);
                    storeIndex++;
                }
            }

            // finally put the pivot in the correct place
            swap(arr, right, storeIndex);
            // Modify the pivot index.
            entry.value = storeIndex;

            left = right + 1;

            entry = entry.next;
        }

    }
    else {
        // Timsort each part.
        for (var k = 0; k < 10; k++) {
            var left = this._timsortFrameLeft;
            var entry = left === 0 ? pivotList.head : this._timsortFramePivotEntry;

            if (left > len - 1) {
                return true;
            }

            var right = entry ? (entry.value - 1) : (len - 1);

            if (right > left) {
                timsort(arr, compare, left, right);
            }

            this._timsortFrameLeft = (entry ? entry.value : (len - 1)) + 1;
            this._timsortFramePivotEntry = entry && entry.next;
        }
    }

    return false;
}

module.exports = ProgressiveQuickSort;