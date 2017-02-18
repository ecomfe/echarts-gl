var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var OrbitControl = require('../../util/OrbitControl');
var Lines3DGeometry = require('../../util/geometry/Lines3D');
var PlanesGeometry = require('../../util/geometry/Planes');
var retrieve = require('../../util/retrieve');

graphicGL.Shader.import(require('text!../../util/shader/lines3D.glsl'));
graphicGL.Shader.import(require('text!../../util/shader/albedo.glsl'));

var parseColor = function (colorStr) {
    var colorArr = echarts.color.parse(colorStr || '#000');
    return [colorArr[0] / 255, colorArr[1] / 255, colorArr[2] / 255, colorArr[3]];
}

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


function updateFacePosition(face, node, size) {
    switch(face) {
        case 'px':
            node.position.set(size[0] / 2, 0, 0);
            node.rotation.rotateY(Math.PI / 2);
            break;
        case 'nx':
            node.position.set(-size[0] / 2, 0, 0);
            node.rotation.rotateY(-Math.PI / 2);
            break;
        case 'py':
            node.position.set(0, size[1] / 2, 0);
            node.rotation.rotateX(-Math.PI / 2);
            break;
        case 'ny':
            node.position.set(0, -size[1] / 2, 0);
            node.rotation.rotateX(Math.PI / 2);
            break;
        case 'pz':
            node.position.set(0, 0, size[2] / 2);
            break;
        case 'nz':
            node.position.set(0, 0, -size[2] / 2);
            node.rotation.rotateY(Math.PI);
            break;
    }
}

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
            // transparent: true,
            shader: graphicGL.createShader('ecgl.meshLines3D')
        });
        var planeMaterial = new graphicGL.Material({
            // transparent: true,
            shader: graphicGL.createShader('ecgl.albedo')
        });

        this.groupGL = new graphicGL.Node();

        this._control = new OrbitControl({
            zr: api.getZr()
        });
        this._control.init();

        this._faces = [
            // dim0, dim1, plane on the cube
            ['y', 'z', 'nx'],
            ['y', 'z', 'px'],
            ['x', 'y', 'ny'],
            ['x', 'y', 'py'],
            ['x', 'z', 'nz'],
            ['x', 'z', 'pz']
        ].map(function (dimInfo) {
            var node = new graphicGL.Node();
            this.groupGL.add(node);
            var linesMesh = new graphicGL.Mesh({
                geometry: new Lines3DGeometry({
                    useNativeLine: false
                }),
                material: linesMaterial,
                ignorePicking: true
            });
            var planesMesh = new graphicGL.Mesh({
                geometry: new PlanesGeometry(),
                material: planeMaterial
            });
            node.add(linesMesh);
            node.add(planesMesh);

            return {
                node: node,
                linesMesh: linesMesh,
                planesMesh: planesMesh,

                dims: dimInfo
            };
        }, this);

        this._axes = dims.map(function (dim) {
            var linesMesh = new graphicGL.Mesh({
                geometry: new Lines3DGeometry({
                    useNativeLine: false
                }),
                material: linesMaterial,
                ignorePicking: true
            });
            var node = new graphicGL.Node();
            node.add(linesMesh);
            this.groupGL.add(node);

            return {
                node: node,
                linesMesh: linesMesh,
                dim: dim
            };
        }, this);
    },

    render: function (grid3DModel, ecModel, api) {

        this._model = grid3DModel;

        var cartesian = grid3DModel.coordinateSystem;
        cartesian.viewGL.add(this.groupGL);

        var control = this._control;
        control.setCamera(cartesian.viewGL.camera);


        var viewControlModel = grid3DModel.getModel('viewControl');
        control.setFromViewControlModel(viewControlModel, 0);

        this._faces.forEach(function (faceInfo) {
            this._renderFace(faceInfo, grid3DModel, ecModel, api);
            updateFacePosition(faceInfo.dims[2], faceInfo.node, cartesian.size);
        }, this);

        this._axes.forEach(function (axisInfo) {
            var axis = cartesian.getAxis(axisInfo.dim);
            this._renderAxisLine(axisInfo.linesMesh.geometry, axis, grid3DModel, api);
        }, this);

        control.off('update');
        control.on('update', this._onCameraChange, this);
    },

    _onCameraChange: function () {
        this._updateFaceVisibility();
        this._updateAxisLinePosition();
    },

    _updateFaceVisibility: function () {
        var camera = this._control.getCamera();
        var viewSpacePos = new graphicGL.Vector3();
        camera.update();
        for (var idx = 0; idx < this._faces.length / 2; idx++) {
            var depths = [];
            for (var k = 0; k < 2; k++) {
                var face = this._faces[idx * 2 + k];
                face.node.getWorldPosition(viewSpacePos);
                viewSpacePos.transformMat4(camera.viewMatrix);
                depths[k] = viewSpacePos.z;
            }
            // Set the front face invisible
            var frontIndex = depths[0] > depths[1] ? 0 : 1;
            var frontFace = this._faces[idx * 2 + frontIndex];
            var backFace = this._faces[idx * 2 + 1 - frontIndex];
            // Update rotation.
            frontFace.node.invisible = true;
            backFace.node.invisible = false;
        }
    },

    _updateAxisLinePosition: function () {
        var cartesian = this._model.coordinateSystem;
        var size = cartesian.size;

        var xAxisNode = this._axes[0].node;
        var yAxisNode = this._axes[1].node;
        var zAxisNode = this._axes[2].node;

        var faces = this._faces;
        // Notice: in cartesian up axis is z, but in webgl up axis is y.
        var xAxisZOffset = (faces[4].node.invisible ? -size[2] : size[2]) / 2;
        var xAxisYOffset = (faces[2].node.invisible ? size[2] : -size[2]) / 2;
        var yAxisXOffset = (faces[0].node.invisible ? -size[2] : size[2]) / 2;
        var yAxisYOffset = (faces[2].node.invisible ? size[2] : -size[2]) / 2;
        var zAxisXOffset = (faces[0].node.invisible ? size[2] : -size[2]) / 2;
        var zAxisZOffset = (faces[4].node.invisible ? -size[2] : size[2]) / 2;

        xAxisNode.rotation.identity();
        yAxisNode.rotation.identity();
        zAxisNode.rotation.identity();
        faces[4].node.invisible && xAxisNode.rotation.rotateX(Math.PI);
        faces[0].node.invisible && yAxisNode.rotation.rotateZ(Math.PI);
        faces[4].node.invisible && zAxisNode.rotation.rotateY(Math.PI);

        xAxisNode.position.set(0, xAxisYOffset, xAxisZOffset);
        yAxisNode.position.set(yAxisXOffset, yAxisYOffset, 0); // Actually z
        zAxisNode.position.set(zAxisXOffset, 0, zAxisZOffset); // Actually y
    },

    _renderFace: function (faceInfo, grid3DModel, ecModel, api) {
        var cartesian = grid3DModel.coordinateSystem;
        var axes = [
            cartesian.getAxis(faceInfo.dims[0]),
            cartesian.getAxis(faceInfo.dims[1])
        ];
        var lineGeometry = faceInfo.linesMesh.geometry;

        lineGeometry.convertToDynamicArray(true);
        this._renderSplitLines(lineGeometry, axes, grid3DModel, api);
        lineGeometry.convertToTypedArray();
    },

    _renderAxisLine: function (geometry, axis, grid3DModel, api) {
        geometry.convertToDynamicArray(true);
        var axisModel = axis.model;
        var extent = axis.getExtent();

        // Render axisLine
        if (axisModel.get('axisLine.show')) {
            var axisLineStyleModel = axisModel.getModel('axisLine.lineStyle');
            var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
            var idx = dimMap[axis.dim];
            p0[idx] = extent[0];
            p1[idx] = extent[1];

            var color = parseColor(axisLineStyleModel.get('color'));
            var lineWidth = retrieve.firstNotNull(axisLineStyleModel.get('width'), 1.0);
            var opacity = retrieve.firstNotNull(axisLineStyleModel.get('opacity'), 1.0);
            color[3] *= opacity;
            geometry.addLine(p0, p1, color, lineWidth);
        }
        // Render axis ticksCoords
        if (axisModel.get('axisTick.show')) {
            var axisTickModel = axisModel.getModel('axisTick');
            var lineStyleModel = axisTickModel.getModel('lineStyle');
            var lineColor = parseColor(
                lineStyleModel.get('color') || axisModel.get('axisLine.lineStyle.color')
            );
            var opacity = retrieve.firstNotNull(lineStyleModel.get('opacity'), 1.0);
            var lineWidth = retrieve.firstNotNull(lineStyleModel.get('width'), 1.0);
            lineColor[3] *= opacity;
            var ticksCoords = axis.getTicksCoords();
            // TODO Automatic interval
            var intervalFunc = axisTickModel.get('interval') || axisModel.get('axisLabel.interval');
            var tickLength = axisTickModel.get('length');

            var otherDim = {
                x: 'y', y: 'x', z: 'y'
            };
            for (var i = 0; i < ticksCoords.length; i++) {
                if (ifIgnoreOnTick(axis, i, intervalFunc)) {
                    continue;
                }
                var tickCoord = ticksCoords[i];
                lineColor[3] *= opacity;

                var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
                var idx = dimMap[axis.dim];
                var otherIdx = dimMap[otherDim[axis.dim]];
                // 0 - x, 1 - y
                p0[idx] = p1[idx] = tickCoord;
                p1[otherIdx] = tickLength;

                geometry.addLine(p0, p1, lineColor, lineWidth);
            }
        }
        geometry.convertToTypedArray();
    },

    _renderSplitLines: function (geometry, axes, grid3DModel, api) {

        axes.forEach(function (axis, idx) {
            var axisModel = axis.model;
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
                for (var i = 0; i < ticksCoords.length; i++) {
                    if (ifIgnoreOnTick(axis, i, intervalFunc)) {
                        continue;
                    }
                    var tickCoord = ticksCoords[i];
                    var lineColor = parseColor(lineColors[count % lineColors.length]);
                    lineColor[3] *= opacity;

                    var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
                    // 0 - x, 1 - y
                    p0[idx] = p1[idx] = tickCoord;
                    p0[1 - idx] = extent[0];
                    p1[1 - idx] = extent[1];

                    geometry.addLine(p0, p1, lineColor, lineWidth);

                    count++;
                }
            }
        });
    },

    _renderAxisLabel: function () {

    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});