var sort = new (require('../../src/util/ProgressiveQuickSort'))();

var arr = [];
for (var i = 0; i < 1000000; i++) {
    arr[i] = Math.random();
}

function compare(a, b) {
    return a - b;
}

var idx = 0;
// var arrSort = arr.slice();
while (!sort.step(arr, compare, idx)) {
    idx++;
}

// sort.step(arrSort, compare, idx);
// console.log(arr);
// console.log(arrSort);


for (var i = 1; i < arr.length; i++) {
    if (arr[i - 1] > arr[i]) {
        console.log(i, arr[i - 1], arr[i]);
        break;
    }
}