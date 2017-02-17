var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var OrbitControl = require('../../util/OrbitControl');
var Lines3DGeometry = require('../../util/geometry/Lines3D');
var parseColor = echarts.color.parse;
var retrieve = require('../../util/retrieve');

graphicGL.Shader.import(require('text!../../util/shader/lines3D.glsl'));

var dims = ['x', 'y', 'z'];

dims.forEach(function (dim) {
    echarts.extendComponentView({
        type: dim + 'Axis3D'
    });
});

var dimMap = {
    // Left to right
    x: 0,
    // Far to near
    y: 2,
    // Bottom to up
    z: 1
};
var otherDimsMap = {
    x: ['y', 'z'],
    y: ['x', 'z'],
    z: ['x', 'y']
};
function ifIgnoreOnTick(axis, i, interval) {
    var rawTick;
    var scale = axis.scale;
    return scale.type === 'ordinal'
        && (
            typeof interval === 'function'
                ? (
                    rawTick = scale.getTicks()[i],
                    !interval(rawTick, scale.getLabel(rawTick))
                )
                : i % (interval + 1)
        );
};

module.exports = echarts.extendComponentView({

    type: 'grid3D',

    init: function (ecModel, api) {

        var linesMaterial = new graphicGL.Material({
            transparent: true,
            shader: graphicGL.createShader('ecgl.meshLines3D')
        });
        this.groupGL = new graphicGL.Node();

        this._control = new OrbitControl({
            zr: api.getZr()
        });
        this._control.init();

        this._axisLinesMesh = new graphicGL.Mesh({
            geometry: new Lines3DGeometry({
                useNativeLine: false
            }),
            material: linesMaterial,
            ignorePicking: true
        });
        this.groupGL.add(this._axisLinesMesh);
    },

    render: function (grid3DModel, ecModel, api) {

        var cartesian = grid3DModel.coordinateSystem;

        cartesian.viewGL.add(this.groupGL);

        var control = this._control;
        control.setCamera(cartesian.viewGL.camera);

        var viewControlModel = grid3DModel.getModel('viewControl');
        control.setFromViewControlModel(viewControlModel, 0);


        this._axisLinesMesh.geometry.convertToDynamicArray(true);
        dims.forEach(function (dim) {
            this._renderAxis(dim, grid3DModel, ecModel, api);
        }, this);
        this._axisLinesMesh.geometry.convertToTypedArray();
    },

    _renderAxis: function (dim, grid3DModel, ecModel, api) {
        var cartesian = grid3DModel.coordinateSystem;
        var axis = cartesian.getAxis(dim);
        var geometry = this._axisLinesMesh.geometry;

        this._renderSplitLines(geometry, axis, grid3DModel, api);
        this._renderAxisLine(geometry, axis, grid3DModel, api);
    },

    _renderAxisLine: function (geometry, axis, grid3DModel, api) {

        var axisModel = axis.model;
        var dim = axis.dim;
        var extent = axis.getExtent();

        // Render axisLine
        if (axisModel.get('axisLine.show')) {
            var axisLineStyleModel = axisModel.getModel('axisLine.lineStyle');
            var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
            p1[dimMap[dim]] = extent[1];

            var color = parseColor(axisLineStyleModel.get('color'));
            var lineWidth = retrieve.firstNotNull(axisLineStyleModel.get('width'), 1.0);
            var opacity = retrieve.firstNotNull(axisLineStyleModel.get('opacity'), 1.0);
            color[3] *= opacity;
            geometry.addLine(p0, p1, color, lineWidth);
        }
    },

    _renderSplitLines: function (geometry, axis, grid3DModel, api) {
        var axisModel = axis.model;
        var dim = axis.dim;
        var extent = axis.getExtent();

        if (axis.scale.isBlank()) {
            return;
        }

        // Render splitLines
        if (axisModel.get('splitLine.show')) {
            var splitLineModel = axisModel.getModel('splitLine');
            var lineStyleModel = splitLineModel.getModel('lineStyle');
            var lineColors = lineStyleModel.get('color');
            var opacity = retrieve.firstNotNull(lineStyleModel.get('opacity'), 1.0);
            var lineWidth = retrieve.firstNotNull(lineStyleModel.get('width'), 1.0);
            // TODO Automatic interval
            var intervalFunc = splitLineModel.get('interval') || axisModel.get('axisLabel.interval');
            lineColors = echarts.util.isArray(lineColors) ? lineColors : [lineColors];

            var ticksCoords = axis.getTicksCoords();

            var count = 0;
            // Not render first splitLine to avoid cover the axisLine.
            var startTick = axisModel.get('axisLine.show') ? 1 : 0;
            for (var i = startTick; i < ticksCoords.length; i++) {
                if (ifIgnoreOnTick(axis, i, intervalFunc)) {
                    continue;
                }
                var tickCoord = ticksCoords[i];
                var lineColor = parseColor(lineColors[count % lineColors.length]);
                lineColor[3] *= opacity;
                for (var k = 0; k < 2; k++) {
                    var otherDim = otherDimsMap[dim][k];
                    var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
                    p0[dimMap[dim]] = p1[dimMap[dim]] = tickCoord;
                    p1[dimMap[otherDim]] = extent[1];

                    geometry.addLine(p0, p1, lineColor, lineWidth);
                }

                count++;
            }
        }
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});