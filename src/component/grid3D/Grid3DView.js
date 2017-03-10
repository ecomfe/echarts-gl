// TODO orthographic camera

var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var OrbitControl = require('../../util/OrbitControl');
var Lines3DGeometry = require('../../util/geometry/Lines3D');
var QuadsGeometry = require('../../util/geometry/Quads');
var retrieve = require('../../util/retrieve');
var firstNotNull = retrieve.firstNotNull;
var ZRTextureAtlasSurface = require('../../util/ZRTextureAtlasSurface');
var LabelsMesh = require('../../util/mesh/LabelsMesh');
var LightHelper = require('../common/LightHelper');

var dims = ['x', 'y', 'z'];

graphicGL.Shader.import(require('text!../../util/shader/lines3D.glsl'));

dims.forEach(function (dim) {
    echarts.extendComponentView({
        type: dim + 'Axis3D'
    });
});

var FACES = [
    // dim0, dim1, dim3, dir on dim3 axis(gl), plane.
    ['y', 'z', 'x', -1, 'left'],
    ['y', 'z', 'x',  1, 'right'],
    ['x', 'y', 'z', -1, 'bottom'],
    ['x', 'y','z',  1, 'top'],
    ['x', 'z', 'y', -1, 'far'],
    ['x', 'z','y',  1, 'near']
];

var dimIndicesMap = {
    // Left to right
    x: 0,
    // Far to near
    y: 2,
    // Bottom to up
    z: 1
};

function updateFacePlane(node, plane, otherAxis, dir) {
    var coord = [0, 0, 0];
    var distance = dir < 0 ? otherAxis.getExtentMin() : otherAxis.getExtentMax();
    coord[dimIndicesMap[otherAxis.dim]] = distance;
    node.position.setArray(coord);
    node.rotation.identity();

    // Negative distance because on the opposite of normal direction.
    plane.distance = -Math.abs(distance);
    plane.normal.set(0, 0, 0);
    if (otherAxis.dim === 'x') {
        node.rotation.rotateY(dir * Math.PI / 2);
        plane.normal.x = -dir;
    }
    else if (otherAxis.dim === 'z') {
        node.rotation.rotateX(-dir * Math.PI / 2);
        plane.normal.y = -dir;
    }
    else {
        if (dir > 0) {
            node.rotation.rotateY(Math.PI);
        }
        plane.normal.z = -dir;
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
}

module.exports = echarts.extendComponentView({

    type: 'grid3D',

    __ecgl__: true,

    init: function (ecModel, api) {

        var quadsMaterial = new graphicGL.Material({
            // transparent: true,
            shader: graphicGL.createShader('ecgl.color'),
            depthMask: false,
            transparent: true
        });
        var linesMaterial = new graphicGL.Material({
            // transparent: true,
            shader: graphicGL.createShader('ecgl.meshLines3D'),
            depthMask: false,
            transparent: true
        });
        quadsMaterial.shader.define('fragment', 'DOUBLE_SIDE');
        quadsMaterial.shader.define('both', 'VERTEX_COLOR');

        this.groupGL = new graphicGL.Node();

        this._control = new OrbitControl({
            zr: api.getZr()
        });
        this._control.init();

        // Save mesh and other infos for each face.
        this._faces = FACES.map(function (dimInfo) {
            var node = new graphicGL.Node();
            this.groupGL.add(node);
            var linesMesh = new graphicGL.Mesh({
                geometry: new Lines3DGeometry({ useNativeLine: false }),
                material: linesMaterial,
                ignorePicking: true, renderOrder: 1
            });
            var quadsMesh = new graphicGL.Mesh({
                geometry: new QuadsGeometry(),
                material: quadsMaterial,
                culling: false, ignorePicking: true, renderOrder: 0
            });
            // Quads are behind lines.
            node.add(quadsMesh);
            node.add(linesMesh);

            return {
                node: node,
                plane: new graphicGL.Plane(),

                linesMesh: linesMesh,
                quadsMesh: quadsMesh,

                dims: dimInfo
            };
        }, this);

        // Save mesh and other infos for each axis.
        this._axes = dims.map(function (dim) {
            var linesMesh = new graphicGL.Mesh({
                geometry: new Lines3DGeometry({ useNativeLine: false }),
                material: linesMaterial,
                ignorePicking: true, renderOrder: 2
            });
            var axisLabelsMesh = new LabelsMesh();
            axisLabelsMesh.material.depthMask = false;

            var node = new graphicGL.Node();
            node.add(linesMesh);
            node.add(axisLabelsMesh);
            this.groupGL.add(node);

            return {
                dim: dim,
                node: node,
                linesMesh: linesMesh,
                labelsMesh: axisLabelsMesh,
                axisLineCoords: null,
                labelElements: []
            };
        }, this);

        this._axisPointerLineMesh = new graphicGL.Mesh({
            geometry: new Lines3DGeometry({ useNativeLine: false }),
            material: linesMaterial,
            // PENDING
            ignorePicking: true, renderOrder: 3
        });
        this.groupGL.add(this._axisPointerLineMesh);

        // Texture surface for label.
        this._labelTextureSurface = new ZRTextureAtlasSurface({
            width: 512, height: 512,
            devicePixelRatio: api.getDevicePixelRatio()
        });
        this._labelTextureSurface.onupdate = function () {
            api.getZr().refresh();
        };

        this._lightRoot = new graphicGL.Node();
        this._lightHelper = new LightHelper(this._lightRoot);
    },

    render: function (grid3DModel, ecModel, api) {

        this._model = grid3DModel;
        this._api = api;

        var cartesian = grid3DModel.coordinateSystem;

        // Always have light.
        cartesian.viewGL.add(this._lightRoot);

        if (grid3DModel.get('show')) {
            cartesian.viewGL.add(this.groupGL);
        }
        else {
            cartesian.viewGL.remove(this.groupGL);
        }

        // cartesian.viewGL.setCameraType(grid3DModel.get('viewControl.projection'));

        var control = this._control;
        control.setCamera(cartesian.viewGL.camera);
        control.setViewGL(cartesian.viewGL);

        var viewControlModel = grid3DModel.getModel('viewControl');
        control.setFromViewControlModel(viewControlModel, 0);

        this._labelTextureSurface.clear();

        var labelIntervalFuncs = ['x', 'y', 'z'].reduce(function (obj, axisDim) {
            var axis = cartesian.getAxis(axisDim);
            var axisModel = axis.model;
            // TODO Automatic LABEL INTERVAL
            obj[axisDim] = firstNotNull(
                axisModel.get('axisLabel.interval'),
                grid3DModel.get('axisLabel.interval')
            );
            return obj;
        }, {});
        this._faces.forEach(function (faceInfo) {
            this._renderFace(faceInfo, labelIntervalFuncs, grid3DModel, ecModel, api);
            var otherAxis = cartesian.getAxis(faceInfo.dims[2]);
            updateFacePlane(faceInfo.node, faceInfo.plane, otherAxis, faceInfo.dims[3]);
        }, this);

        this._axes.forEach(function (axisInfo) {
            var axis = cartesian.getAxis(axisInfo.dim);
            this._renderAxisLine(axisInfo, axis, grid3DModel, labelIntervalFuncs[axisInfo.dim], api);
        }, this);

        control.off('update');
        control.on('update', this._onCameraChange.bind(this, grid3DModel, api), this);

        this._lightHelper.updateLight(grid3DModel);

        // Set post effect
        cartesian.viewGL.setPostEffect(grid3DModel.getModel('postEffect'));
        cartesian.viewGL.setTemporalSuperSampling(grid3DModel.getModel('temporalSuperSampling'));

        this._initMouseHandler(grid3DModel);
    },

    afterRender: function (grid3DModel, ecModel, api, layerGL) {
        // Create ambient cubemap after render because we need to know the renderer.
        // TODO
        var renderer = layerGL.renderer;

        this._lightHelper.updateAmbientCubemap(renderer, grid3DModel, api);
    },

    /**
     * showAxisPointer will be triggered by action.
     */
    showAxisPointer: function (grid3dModel, ecModel, api, payload) {
        this._doShowAxisPointer();
        this._updateAxisPointer(payload.value);
    },

    /**
     * hideAxisPointer will be triggered by action.
     */
    hideAxisPointer: function (grid3dModel, ecModel, api, payload) {
        this._doHideAxisPointer();
    },

    _initMouseHandler: function (grid3DModel) {
        var cartesian = grid3DModel.coordinateSystem;
        var viewGL = cartesian.viewGL;

        viewGL.on('mousemove', this._showAxisPointerOnMousePosition, this);
    },

    /**
     * Try find and show axisPointer on the intersect point
     * of mouse ray with grid plane.
     */
    _showAxisPointerOnMousePosition: function (e) {
        // Ignore if mouse is on the element.
        if (e.target) {
            return;
        }
        var grid3DModel = this._model;
        var cartesian = grid3DModel.coordinateSystem;
        var viewGL = cartesian.viewGL;

        var ray = viewGL.castRay(e.offsetX, e.offsetY, new graphicGL.Ray());

        var nearestIntersectPoint;
        for (var i = 0; i < this._faces.length; i++) {
            var faceInfo = this._faces[i];
            if (faceInfo.node.invisible) {
                continue;
            }

            // Plane is not face the camera. flip it
            if (faceInfo.plane.normal.dot(viewGL.camera.worldTransform.z) < 0) {
                faceInfo.plane.normal.negate();
            }

            var point = ray.intersectPlane(faceInfo.plane);
            var axis0 = cartesian.getAxis(faceInfo.dims[0]);
            var axis1 = cartesian.getAxis(faceInfo.dims[1]);
            var idx0 = dimIndicesMap[faceInfo.dims[0]];
            var idx1 = dimIndicesMap[faceInfo.dims[1]];
            if (axis0.contain(point._array[idx0]) && axis1.contain(point._array[idx1])) {
                nearestIntersectPoint = point;
            }
        }

        if (nearestIntersectPoint) {
            var data = cartesian.pointToData(nearestIntersectPoint._array, [], true);
            this._updateAxisPointer(data);

            this._doShowAxisPointer();
        }
        else {
            this._doHideAxisPointer();
        }
    },

    _onCameraChange: function (grid3DModel, api) {
        this._updateFaceVisibility();
        this._updateAxisLinePosition();
        var control = this._control;

        api.dispatchAction({
            type: 'grid3DChangeCamera',
            alpha: control.getAlpha(),
            beta: control.getBeta(),
            distance: control.getDistance(),
            from: this.uid,
            grid3DId: grid3DModel.id
        });
    },

    /**
     * Update visibility of each face when camera view changed, front face will be invisible.
     * @private
     */
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

        // this._updateAxisPointer(2, 2, 50);
        // console.log(this._faces.filter(function (face) {
        //     return !face.node.invisible;
        // }).map(function (face) {
        //     return face.dims[4];
        // }));
    },

    /**
     * Update axis line position when camera view changed.
     * @private
     */
    _updateAxisLinePosition: function () {
        var cartesian = this._model.coordinateSystem;
        var xAxis = cartesian.getAxis('x');
        var yAxis = cartesian.getAxis('y');
        var zAxis = cartesian.getAxis('z');
        var top = zAxis.getExtentMax();
        var bottom = zAxis.getExtentMin();
        var left = xAxis.getExtentMin();
        var right = xAxis.getExtentMax();
        var near = yAxis.getExtentMax();
        var far = yAxis.getExtentMin();

        var xAxisNode = this._axes[0].node;
        var yAxisNode = this._axes[1].node;
        var zAxisNode = this._axes[2].node;

        var faces = this._faces;
        // Notice: in cartesian up axis is z, but in webgl up axis is y.
        var xAxisZOffset = (faces[4].node.invisible ? far : near);
        var xAxisYOffset = (faces[2].node.invisible ? top : bottom);
        var yAxisXOffset = (faces[0].node.invisible ? left : right);
        var yAxisYOffset = (faces[2].node.invisible ? top : bottom);
        var zAxisXOffset = (faces[0].node.invisible ? right : left);
        var zAxisZOffset = (faces[4].node.invisible ? far : near);

        xAxisNode.rotation.identity();
        yAxisNode.rotation.identity();
        zAxisNode.rotation.identity();
        faces[4].node.invisible && xAxisNode.rotation.rotateX(Math.PI);
        faces[0].node.invisible && yAxisNode.rotation.rotateZ(Math.PI);
        faces[4].node.invisible && zAxisNode.rotation.rotateY(Math.PI);

        xAxisNode.position.set(0, xAxisYOffset, xAxisZOffset);
        yAxisNode.position.set(yAxisXOffset, yAxisYOffset, 0); // Actually z
        zAxisNode.position.set(zAxisXOffset, 0, zAxisZOffset); // Actually y

        xAxisNode.update();
        yAxisNode.update();
        zAxisNode.update();

        this._updateAxisLabelAlign();
    },

    /**
     * Update label align on axis when axisLine position changed.
     * @private
     */
    _updateAxisLabelAlign: function () {
        // var cartesian = this._model.coordinateSystem;
        var camera = this._control.getCamera();
        var coords = [new graphicGL.Vector4(), new graphicGL.Vector4()];
        var center = new graphicGL.Vector4();
        this.groupGL.getWorldPosition(center);
        center.w = 1.0;
        center.transformMat4(camera.viewMatrix)
            .transformMat4(camera.projectionMatrix);
        center.x /= center.w;
        center.y /= center.w;
        this._axes.forEach(function (axisInfo) {
            var lineCoords = axisInfo.axisLineCoords;
            var labelGeo = axisInfo.labelsMesh.geometry;
            for (var i = 0; i < coords.length; i++) {
                coords[i].setArray(lineCoords[i]);
                coords[i].w = 1.0;
                coords[i].transformMat4(axisInfo.node.worldTransform)
                    .transformMat4(camera.viewMatrix)
                    .transformMat4(camera.projectionMatrix);
                coords[i].x /= coords[i].w;
                coords[i].y /= coords[i].w;
            }
            var dx = coords[1].x - coords[0].x;
            var dy = coords[1].y - coords[0].y;
            var cx = (coords[1].x + coords[0].x) / 2;
            var cy = (coords[1].y + coords[0].y) / 2;
            var textAlign;
            var verticalAlign;
            if (Math.abs(dy / dx) < 0.5) {
                textAlign = 'center';
                verticalAlign = cy > center.y ? 'bottom' : 'top';
            }
            else {
                verticalAlign = 'middle';
                textAlign = cx > center.x ? 'left' : 'right';
            }

            // axis labels
            var dpr = this._api.getDevicePixelRatio();
            for (var i = 0; i < axisInfo.labelElements.length; i++) {
                var labelEl = axisInfo.labelElements[i];
                var rect = labelEl.getBoundingRect();

                labelGeo.setSpriteAlign(i, [rect.width * dpr, rect.height * dpr], textAlign, verticalAlign);
            }
            // name label
            var nameLabelEl = axisInfo.nameLabelElement;
            var rect = nameLabelEl.getBoundingRect();
            labelGeo.setSpriteAlign(nameLabelEl.__idx, [rect.width * dpr, rect.height * dpr], textAlign, verticalAlign);

            labelGeo.dirty();
        }, this);
    },

    _doShowAxisPointer: function () {
        this._axisPointerLineMesh.invisible = false;
        this._api.getZr().refresh();
    },

    _doHideAxisPointer: function () {
        this._axisPointerLineMesh.invisible = true;
        this._api.getZr().refresh();
    },
    /**
     * @private updateAxisPointer.
     */
    _updateAxisPointer: function (data) {
        var cartesian = this._model.coordinateSystem;
        var point = cartesian.dataToPoint(data);

        var axisPointerLineMesh = this._axisPointerLineMesh;
        var linesGeo = axisPointerLineMesh.geometry;

        var axisPointerParentModel = this._model.getModel('axisPointer');

        var dpr = this._api.getDevicePixelRatio();
        linesGeo.convertToDynamicArray(true);


        function ifShowAxisPointer(axis) {
            return retrieve.firstNotNull(
                axis.model.get('axisPointer.show'),
                axisPointerParentModel.get('show')
            );
        }
        function getAxisColorAndLineWidth(axis) {
            var axisPointerModel = axis.model.getModel('axisPointer', axisPointerParentModel);
            var lineStyleModel = axisPointerModel.getModel('lineStyle');

            var color = graphicGL.parseColor(lineStyleModel.get('color'));
            var lineWidth = firstNotNull(lineStyleModel.get('width'), 1);
            var opacity = firstNotNull(lineStyleModel.get('opacity'), 1);
            color[3] *= opacity;

            return {
                color: color,
                lineWidth: lineWidth
            };
        }
        for (var k = 0; k < this._faces.length; k++) {
            var faceInfo = this._faces[k];
            if (faceInfo.node.invisible) {
                continue;
            }

            var dims = faceInfo.dims;
            var otherCoord = dims[3] < 0
                ? cartesian.getAxis(dims[2]).getExtentMin()
                : cartesian.getAxis(dims[2]).getExtentMax();
            var otherDimIdx = dimIndicesMap[dims[2]];

            // Line on face.
            for (var i = 0; i < 2; i++) {
                var dim = dims[i];
                var faceOtherDim = dims[1 - i];
                var axis = cartesian.getAxis(dim);
                var faceOtherAxis = cartesian.getAxis(faceOtherDim);

                if (!ifShowAxisPointer(axis)) {
                    continue;
                }

                var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
                var dimIdx = dimIndicesMap[dim];
                var faceOtherDimIdx = dimIndicesMap[faceOtherDim];
                p0[dimIdx] = p1[dimIdx] = point[dimIdx];

                p0[otherDimIdx] = p1[otherDimIdx] = otherCoord;
                p0[faceOtherDimIdx] = faceOtherAxis.getExtentMin();
                p1[faceOtherDimIdx] = faceOtherAxis.getExtentMax();

                var colorAndLineWidth = getAxisColorAndLineWidth(axis);
                linesGeo.addLine(p0, p1, colorAndLineWidth.color, colorAndLineWidth.lineWidth * dpr);
            }

            // Project line.
            if (ifShowAxisPointer(cartesian.getAxis(dims[2]))) {
                var p0 = point.slice();
                var p1 = point.slice();
                p1[otherDimIdx] = otherCoord;
                var colorAndLineWidth = getAxisColorAndLineWidth(cartesian.getAxis(dims[2]));
                linesGeo.addLine(p0, p1, colorAndLineWidth.color, colorAndLineWidth.lineWidth * dpr);
            }
        }
        linesGeo.convertToTypedArray();

        this._api.getZr().refresh();
    },

    /**
     * Render each face
     * @private
     */
    _renderFace: function (faceInfo, labelIntervalFuncs, grid3DModel, ecModel, api) {
        var cartesian = grid3DModel.coordinateSystem;
        var axes = [
            cartesian.getAxis(faceInfo.dims[0]),
            cartesian.getAxis(faceInfo.dims[1])
        ];
        var lineGeometry = faceInfo.linesMesh.geometry;
        var quadsGeometry = faceInfo.quadsMesh.geometry;

        lineGeometry.convertToDynamicArray(true);
        quadsGeometry.convertToDynamicArray(true);
        this._renderSplitLines(lineGeometry, axes, grid3DModel, labelIntervalFuncs, api);
        this._renderSplitAreas(quadsGeometry, axes, grid3DModel, labelIntervalFuncs, api);
        lineGeometry.convertToTypedArray();
        quadsGeometry.convertToTypedArray();
    },

    /**
     * Render each axis line.
     */
    _renderAxisLine: function (axisInfo, axis, grid3DModel, labelIntervalFunc, api) {
        var linesGeo = axisInfo.linesMesh.geometry;
        var labelsGeo = axisInfo.labelsMesh.geometry;
        linesGeo.convertToDynamicArray(true);
        labelsGeo.convertToDynamicArray(true);
        var axisModel = axis.model;
        var extent = axis.getExtent();

        var dpr = api.getDevicePixelRatio();
        var axisLineModel = axisModel.getModel('axisLine', grid3DModel.getModel('axisLine'));
        var axisTickModel = axisModel.getModel('axisTick', grid3DModel.getModel('axisTick'));
        var axisLabelModel = axisModel.getModel('axisLabel', grid3DModel.getModel('axisLabel'));
        var axisLineColor = axisLineModel.get('lineStyle.color');
        // Render axisLine
        if (axisLineModel.get('show')) {
            var axisLineStyleModel = axisLineModel.getModel('lineStyle');
            var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
            var idx = dimIndicesMap[axis.dim];
            p0[idx] = extent[0];
            p1[idx] = extent[1];

            // Save some useful info.
            axisInfo.axisLineCoords =[p0, p1];

            var color = graphicGL.parseColor(axisLineColor);
            var lineWidth = firstNotNull(axisLineStyleModel.get('width'), 1.0);
            var opacity = firstNotNull(axisLineStyleModel.get('opacity'), 1.0);
            color[3] *= opacity;
            linesGeo.addLine(p0, p1, color, lineWidth * dpr);
        }
        var otherDim = {
            x: 'y', y: 'x', z: 'y'
        };
        // Render axis ticksCoords
        if (axisTickModel.get('show')) {
            var lineStyleModel = axisTickModel.getModel('lineStyle');
            var lineColor = graphicGL.parseColor(
                firstNotNull(lineStyleModel.get('color'), axisLineColor)
            );
            var lineWidth = firstNotNull(lineStyleModel.get('width'), 1.0);
            lineColor[3] *= firstNotNull(lineStyleModel.get('opacity'), 1.0);
            var ticksCoords = axis.getTicksCoords();
            // TODO Automatic interval
            var intervalFunc = axisTickModel.get('interval');
            if (intervalFunc == null || intervalFunc === 'auto') {
                intervalFunc = labelIntervalFunc;
            }
            var tickLength = axisTickModel.get('length');

            for (var i = 0; i < ticksCoords.length; i++) {
                if (ifIgnoreOnTick(axis, i, intervalFunc)) {
                    continue;
                }
                var tickCoord = ticksCoords[i];

                var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
                var idx = dimIndicesMap[axis.dim];
                var otherIdx = dimIndicesMap[otherDim[axis.dim]];
                // 0 : x, 1 : y
                p0[idx] = p1[idx] = tickCoord;
                p1[otherIdx] = tickLength;

                linesGeo.addLine(p0, p1, lineColor, lineWidth * dpr);
            }
        }

        axisInfo.labelElements = [];
        var dpr = api.getDevicePixelRatio();
        if (axisLabelModel.get('show')) {
            var textStyleModel = axisLabelModel.getModel('textStyle');
            var labelsCoords = axis.getLabelsCoords();
            var labelColor = firstNotNull(textStyleModel.get('color'), axisLineColor);
            // TODO Automatic interval
            var intervalFunc = labelIntervalFunc;

            var labelMargin = axisLabelModel.get('margin');

            var labels = axisModel.getFormattedLabels();
            for (var i = 0; i < labelsCoords.length; i++) {
                if (ifIgnoreOnTick(axis, i, intervalFunc)) {
                    continue;
                }
                var tickCoord = labelsCoords[i];

                var p = [0, 0, 0];
                var idx = dimIndicesMap[axis.dim];
                var otherIdx = dimIndicesMap[otherDim[axis.dim]];
                // 0 : x, 1 : y
                p[idx] = p[idx] = tickCoord;
                p[otherIdx] = labelMargin;

                var textEl = new echarts.graphic.Text({
                    style: {
                        text: labels[i],
                        fill: labelColor,
                        font: textStyleModel.getFont(),
                        textVerticalAlign: 'top',
                        textAlign: 'left'
                    }
                });
                var coords = this._labelTextureSurface.add(textEl);
                var rect = textEl.getBoundingRect();
                labelsGeo.addSprite(p, [rect.width * dpr, rect.height * dpr], coords);

                axisInfo.labelElements.push(textEl);
            }
        }

        if (axisModel.get('name')) {
            var nameTextStyleModel = axisModel.getModel('nameTextStyle');
            var p = [0, 0, 0];
            var idx = dimIndicesMap[axis.dim];
            var otherIdx = dimIndicesMap[otherDim[axis.dim]];
            var labelColor = firstNotNull(nameTextStyleModel.get('color'), axisLineColor);
            // TODO start and end
            p[idx] = p[idx] = (extent[0] + extent[1]) / 2;
            p[otherIdx] = axisModel.get('nameGap');

            var textEl = new echarts.graphic.Text({
                style: {
                    text: axisModel.get('name'),
                    fill: labelColor,
                    font: nameTextStyleModel.getFont(),
                    textVerticalAlign: 'top',
                    textAlign: 'left'
                }
            });
            var coords = this._labelTextureSurface.add(textEl);
            var rect = textEl.getBoundingRect();
            labelsGeo.addSprite(p, [rect.width * dpr, rect.height * dpr], coords);

            textEl.__idx = axisInfo.labelElements.length;
            axisInfo.nameLabelElement = textEl;
        }

        axisInfo.labelsMesh.material.set('textureAtlas', this._labelTextureSurface.getTexture());
        axisInfo.labelsMesh.material.set('uvScale', this._labelTextureSurface.getCoordsScale());

        linesGeo.convertToTypedArray();
        labelsGeo.convertToTypedArray();
    },

    /**
     * Render split lines
     * @private
     */
    _renderSplitLines: function (geometry, axes, grid3DModel, labelIntervalFuncs, api) {

        var dpr = api.getDevicePixelRatio();
        axes.forEach(function (axis, idx) {
            var axisModel = axis.model;
            var otherExtent = axes[1 - idx].getExtent();

            if (axis.scale.isBlank()) {
                return;
            }

            var splitLineModel = axisModel.getModel('splitLine', grid3DModel.getModel('splitLine'));
            // Render splitLines
            if (splitLineModel.get('show')) {
                var lineStyleModel = splitLineModel.getModel('lineStyle');
                var lineColors = lineStyleModel.get('color');
                var opacity = firstNotNull(lineStyleModel.get('opacity'), 1.0);
                var lineWidth = firstNotNull(lineStyleModel.get('width'), 1.0);
                // TODO Automatic interval
                var intervalFunc = splitLineModel.get('interval');
                if (intervalFunc == null || intervalFunc === 'auto') {
                    intervalFunc = labelIntervalFuncs[axis.dim];
                }
                lineColors = echarts.util.isArray(lineColors) ? lineColors : [lineColors];

                var ticksCoords = axis.getTicksCoords();

                var count = 0;
                for (var i = 0; i < ticksCoords.length; i++) {
                    if (ifIgnoreOnTick(axis, i, intervalFunc)) {
                        continue;
                    }
                    var tickCoord = ticksCoords[i];
                    var lineColor = graphicGL.parseColor(lineColors[count % lineColors.length]);
                    lineColor[3] *= opacity;

                    var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
                    // 0 - x, 1 - y
                    p0[idx] = p1[idx] = tickCoord;
                    p0[1 - idx] = otherExtent[0];
                    p1[1 - idx] = otherExtent[1];

                    geometry.addLine(p0, p1, lineColor, lineWidth * dpr);

                    count++;
                }
            }
        });
    },

    /**
     * Render split areas.
     * @private
     */
    _renderSplitAreas: function (geometry, axes, grid3DModel, labelIntervalFuncs, api) {
        axes.forEach(function (axis, idx) {
            var axisModel = axis.model;
            var otherExtent = axes[1 - idx].getExtent();

            if (axis.scale.isBlank()) {
                return;
            }

            var splitAreaModel = axisModel.getModel('splitArea', grid3DModel.getModel('splitArea'));
            // Render splitAreas
            if (splitAreaModel.get('show')) {
                var areaStyleModel = splitAreaModel.getModel('areaStyle');
                var colors = areaStyleModel.get('color');
                var opacity = firstNotNull(areaStyleModel.get('opacity'), 1.0);
                // TODO Automatic interval
                var intervalFunc = splitAreaModel.get('interval');
                if (intervalFunc == null || intervalFunc === 'auto') {
                    intervalFunc = labelIntervalFuncs[axis.dim];
                }

                colors = echarts.util.isArray(colors) ? colors : [colors];

                var ticksCoords = axis.getTicksCoords();

                var count = 0;
                var prevP0 = [0, 0, 0];
                var prevP1 = [0, 0, 0];
                // 0 - x, 1 - y
                for (var i = 0; i < ticksCoords.length; i++) {
                    var tickCoord = ticksCoords[i];

                    var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
                    // 0 - x, 1 - y
                    p0[idx] = p1[idx] = tickCoord;
                    p0[1 - idx] = otherExtent[0];
                    p1[1 - idx] = otherExtent[1];

                    if (i === 0) {
                        prevP0 = p0;
                        prevP1 = p1;
                        continue;
                    }

                    if (ifIgnoreOnTick(axis, i, intervalFunc)) {
                        continue;
                    }

                    var color = graphicGL.parseColor(colors[count % colors.length]);
                    color[3] *= opacity;
                    geometry.addQuad([prevP0, p0, p1, prevP1], color);

                    prevP0 = p0;
                    prevP1 = p1;

                    count++;
                }
            }
        });
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});