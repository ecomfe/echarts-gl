export default function (data, dimX, dimY) {
    var xExtent = data.getDataExtent(dimX);
    var yExtent = data.getDataExtent(dimY);

    // TODO Handle one data situation
    var xSpan = (xExtent[1] - xExtent[0]) || xExtent[0];
    var ySpan = (yExtent[1] - yExtent[0]) || yExtent[0];
    var dimSize = 50;
    var tmp = new Uint8Array(dimSize * dimSize);
    for (var i = 0; i < data.count(); i++) {
        var x = data.get(dimX, i);
        var y = data.get(dimY, i);
        var xIdx = Math.floor((x - xExtent[0]) / xSpan * (dimSize - 1));
        var yIdx = Math.floor((y - yExtent[0]) / ySpan * (dimSize - 1));
        var idx = yIdx * dimSize + xIdx;
        tmp[idx] = tmp[idx] || 1;
    }
    var filledCount = 0;
    for (var i = 0; i < tmp.length; i++) {
        if (tmp[i]) {
            filledCount++;
        }
    }
    return filledCount / tmp.length;
};