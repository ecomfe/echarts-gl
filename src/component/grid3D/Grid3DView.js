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
}

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

        this._axisMesh = new graphicGL.Mesh({
            geometry: new Lines3DGeometry({
                useNativeLine: false
            }),
            material: linesMaterial,
            ignorePicking: true
        });
        this.groupGL.add(this._axisMesh);
    },

    render: function (grid3DModel, ecModel, api) {

        var cartesian = grid3DModel.coordinateSystem;

        cartesian.viewGL.add(this.groupGL);

        var control = this._control;
        control.setCamera(cartesian.viewGL.camera);

        var viewControlModel = grid3DModel.getModel('viewControl');
        control.setFromViewControlModel(viewControlModel, 0);


        this._axisMesh.geometry.convertToDynamicArray(true);
        dims.forEach(function (dim) {
            this._renderAxis(dim, grid3DModel, ecModel, api);
        }, this);
        this._axisMesh.geometry.convertToTypedArray();
    },

    _renderAxis: function (dim, grid3DModel, ecModel, api) {

        var geometry = this._axisMesh.geometry;

        var cartesian = grid3DModel.coordinateSystem;
        var axis = cartesian.getAxis(dim);
        var axisModel = axis.model;

        var extent = axis.getExtent();

        // Render axisLine
        if (axisModel.get('axisLine.show')) {
            var axisLineStyleModel = axisModel.getModel('axisLine.lineStyle');
            var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
            p1[dimMap[dim]] = extent[1];

            var color = parseColor(axisLineStyleModel.get('color'));
            var lineWidth = axisLineStyleModel.get('width');
            var opacity = retrieve.firstNotNull(axisLineStyleModel.get('opacity'), 1.0);
            color[3] *= opacity;
            geometry.addLine(p0, p1, color, lineWidth);
        }
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});