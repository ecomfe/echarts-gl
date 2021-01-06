import * as echarts from 'echarts/lib/echarts';
import glmatrix from 'claygl/src/dep/glmatrix';
var vec3 = glmatrix.vec3;
var isDimensionStacked = echarts.helper.dataStack.isDimensionStacked;

function ifCrossZero(extent) {
    var min = extent[0];
    var max = extent[1];
    return !((min > 0 && max > 0) || (min < 0 && max < 0));
};

function cartesian3DLayout(seriesModel, coordSys) {

    var data = seriesModel.getData();
    // var barOnPlane = seriesModel.get('onGridPlane');

    var barSize = seriesModel.get('barSize');
    if (barSize == null) {
        var size = coordSys.size;
        var barWidth;
        var barDepth;
        var xAxis = coordSys.getAxis('x');
        var yAxis = coordSys.getAxis('y');

        if (xAxis.type === 'category') {
            barWidth = xAxis.getBandWidth() * 0.7;
        }
        else {
            // PENDING
            barWidth = Math.round(size[0] / Math.sqrt(data.count())) * 0.6;
        }
        if (yAxis.type === 'category') {
            barDepth = yAxis.getBandWidth() * 0.7;
        }
        else {
            barDepth = Math.round(size[1] / Math.sqrt(data.count())) * 0.6;
        }
        barSize = [barWidth, barDepth];
    }
    else if (!echarts.util.isArray(barSize)) {
        barSize = [barSize, barSize];
    }

    var zAxisExtent = coordSys.getAxis('z').scale.getExtent();
    var ifZAxisCrossZero = ifCrossZero(zAxisExtent);

    var dims = ['x', 'y', 'z'].map(function (coordDimName) {
        return seriesModel.coordDimToDataDim(coordDimName)[0];
    });

    var isStacked = isDimensionStacked(data, dims[2]);
    var valueDim = isStacked
        ? data.getCalculationInfo('stackResultDimension')
        : dims[2];

    data.each(dims, function (x, y, z, idx) {
        // TODO zAxis is inversed
        // TODO On different plane.
        var stackedValue = data.get(valueDim, idx);

        var baseValue = isStacked ? (stackedValue - z)
            : (ifZAxisCrossZero ? 0 : zAxisExtent[0]);

        var start = coordSys.dataToPoint([x, y, baseValue]);
        var end = coordSys.dataToPoint([x, y, stackedValue]);
        var height = vec3.dist(start, end);
        // PENDING When zAxis is not cross zero.
        var dir = [0, end[1] < start[1] ? -1 : 1, 0];
        if (Math.abs(height) === 0) {
            // TODO
            height = 0.1;
        }
        var size = [barSize[0], height, barSize[1]];
        data.setItemLayout(idx, [start, dir, size]);
    });

    data.setLayout('orient', [1, 0, 0]);
}

export default cartesian3DLayout;