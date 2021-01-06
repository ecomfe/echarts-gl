import * as echarts from 'echarts/lib/echarts';

export default function (seriesModel, dims, source) {
    source = source || seriesModel.getSource();

    var coordSysDimensions = dims || echarts.getCoordinateSystemDimensions(seriesModel.get('coordinateSystem')) || ['x', 'y', 'z'];

    var dimensions = echarts.helper.createDimensions(source, {
        dimensionsDefine: source.dimensionsDefine || seriesModel.get('dimensions'),
        encodeDefine: source.encodeDefine || seriesModel.get('encode'),
        coordDimensions: coordSysDimensions.map(function (dim) {
            var axis3DModel = seriesModel.getReferringComponents(dim + 'Axis3D').models[0];
            return {
                type: (axis3DModel && axis3DModel.get('type') === 'category') ? 'ordinal' : 'float',
                name: dim
                // Find stackable dimension. Which will represent value.
                // stackable: dim === 'z'
            };
        })
    });
    if (seriesModel.get('coordinateSystem') === 'cartesian3D') {
        dimensions.forEach(function (dimInfo) {
            if (coordSysDimensions.indexOf(dimInfo.coordDim) >= 0) {
                var axis3DModel = seriesModel.getReferringComponents(dimInfo.coordDim + 'Axis3D').models[0];
                if (axis3DModel && axis3DModel.get('type') === 'category') {
                    dimInfo.ordinalMeta = axis3DModel.getOrdinalMeta();
                }
            }
        });
    }

    var stackCalculationInfo = echarts.helper.dataStack.enableDataStack(
        // Only support 'z' and `byIndex` now.
        seriesModel, dimensions, {byIndex: true, stackedCoordDimension: 'z'}
    );

    var data = new echarts.List(dimensions, seriesModel);

    data.setCalculationInfo(stackCalculationInfo);

    data.initData(source);

    return data;
}