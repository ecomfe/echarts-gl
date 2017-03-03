var ProgressiveQuickSort = require('../src/util/ProgressiveQuickSort');
var timsort = require('zrender/lib/core/timsort');

var arr = [];
for (var i = 0; i < 100000; i++) {
    arr[i] = Math.round(Math.random() * 1000);
}
var arr2 = arr.slice();
var arr3 = arr.slice();

function compare(a, b) {
    return a - b;
}

console.time('Quick sort');
ProgressiveQuickSort.sort(arr, compare, 0, arr.length - 1);
console.timeEnd('Quick sort');

console.time('Native sort');
arr2.sort(compare);
console.timeEnd('Native sort');

console.time('Tim sort');
timsort(arr3, compare);
console.timeEnd('Tim sort');

for (var i = 1; i < arr.length; i++) {
    if (arr[i - 1] > arr[i]) {
        console.log(i, arr[i - 1], arr[i]);
        break;
    }
}