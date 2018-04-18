// TODO orthographic camera

import echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import OrbitControl from '../../util/OrbitControl';
import Lines3DGeometry from '../../util/geometry/Lines3D';
import retrieve from '../../util/retrieve';
var firstNotNull = retrieve.firstNotNull;
import ZRTextureAtlasSurface from '../../util/ZRTextureAtlasSurface';
import SceneHelper from '../common/SceneHelper';
import Grid3DFace from './Grid3DFace';
import Grid3DAxis from './Grid3DAxis';
import LabelsMesh from '../../util/mesh/LabelsMesh';

import lines3DGLSL from '../../util/shader/lines3D.glsl.js';
graphicGL.Shader.import(lines3DGLSL);

['x', 'y', 'z'].forEach(function (dim) {
    echarts.extendComponentView({
        type: dim + 'Axis3D'
    });
});

var dimIndicesMap = {
    // Left to right
    x: 0,
    // Far to near
    y: 2,
    // Bottom to up
    z: 1
};

export default echarts.extendComponentView({

    type: 'grid3D',

    __ecgl__: true,

    init: function (ecModel, api) {

        var FACES = [
            // planeDim0, planeDim1, offsetDim, dir on dim3 axis(gl), plane.
            ['y', 'z', 'x', -1, 'left'],
            ['y', 'z', 'x',  1, 'right'],
            ['x', 'y', 'z', -1, 'bottom'],
            ['x', 'y','z',  1, 'top'],
            ['x', 'z', 'y', -1, 'far'],
            ['x', 'z','y',  1, 'near']
        ];

        var DIMS = ['x', 'y', 'z'];

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
        quadsMaterial.define('fragment', 'DOUBLE_SIDED');
        quadsMaterial.define('both', 'VERTEX_COLOR');

        this.groupGL = new graphicGL.Node();

        this._control = new OrbitControl({
            zr: api.getZr()
        });
        this._control.init();

        // Save mesh and other infos for each face.
        this._faces = FACES.map(function (faceInfo) {
            var face = new Grid3DFace(faceInfo, linesMaterial, quadsMaterial);
            this.groupGL.add(face.rootNode);
            return face;
        }, this);

        // Save mesh and other infos for each axis.
        this._axes = DIMS.map(function (dim) {
            var axis = new Grid3DAxis(dim, linesMaterial);
            this.groupGL.add(axis.rootNode);
            return axis;
        }, this);

        var dpr = api.getDevicePixelRatio();
        // Texture surface for label.
        this._axisLabelSurface = new ZRTextureAtlasSurface({
            width: 256, height: 256,
            devicePixelRatio: dpr
        });
        this._axisLabelSurface.onupdate = function () {
            api.getZr().refresh();
        };

        this._axisPointerLineMesh = new graphicGL.Mesh({
            geometry: new Lines3DGeometry({ useNativeLine: false }),
            material: linesMaterial,
            castShadow: false,
            // PENDING
            ignorePicking: true,
            renderOrder: 3
        });
        this.groupGL.add(this._axisPointerLineMesh);

        this._axisPointerLabelsSurface = new ZRTextureAtlasSurface({
            width: 128, height: 128,
            devicePixelRatio: dpr
        });
        this._axisPointerLabelsMesh = new LabelsMesh({
            ignorePicking: true, renderOrder: 4,
            castShadow: false
        });
        this._axisPointerLabelsMesh.material.set('textureAtlas', this._axisPointerLabelsSurface.getTexture());
        this.groupGL.add(this._axisPointerLabelsMesh);

        this._lightRoot = new graphicGL.Node();
        this._sceneHelper = new SceneHelper();
        this._sceneHelper.initLight(this._lightRoot);
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
        control.setViewGL(cartesian.viewGL);

        var viewControlModel = grid3DModel.getModel('viewControl');
        control.setFromViewControlModel(viewControlModel, 0);

        this._axisLabelSurface.clear();

        control.off('update');
        if (grid3DModel.get('show')) {
            this._faces.forEach(function (face) {
                face.update(grid3DModel, ecModel, api);
            }, this);
            this._axes.forEach(function (axis) {
                axis.update(grid3DModel, this._axisLabelSurface, api);
            }, this);
        }

        control.on('update', this._onCameraChange.bind(this, grid3DModel, api), this);

        this._sceneHelper.setScene(cartesian.viewGL.scene);
        this._sceneHelper.updateLight(grid3DModel);

        // Set post effect
        cartesian.viewGL.setPostEffect(grid3DModel.getModel('postEffect'), api);
        cartesian.viewGL.setTemporalSuperSampling(grid3DModel.getModel('temporalSuperSampling'));

        this._initMouseHandler(grid3DModel);
    },

    afterRender: function (grid3DModel, ecModel, api, layerGL) {
        // Create ambient cubemap after render because we need to know the renderer.
        // TODO
        var renderer = layerGL.renderer;

        this._sceneHelper.updateAmbientCubemap(renderer, grid3DModel, api);

        this._sceneHelper.updateSkybox(renderer, grid3DModel, api);
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

        // TODO xAxis3D.axisPointer.show ?
        if (grid3DModel.get('show') && grid3DModel.get('axisPointer.show')) {
            viewGL.on('mousemove', this._updateAxisPointerOnMousePosition, this);
        }
        else {
            viewGL.off('mousemove', this._updateAxisPointerOnMousePosition);
        }
    },

    /**
     * Try find and show axisPointer on the intersect point
     * of mouse ray with grid plane.
     */
    _updateAxisPointerOnMousePosition: function (e) {
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
            var face = this._faces[i];
            if (face.rootNode.invisible) {
                continue;
            }

            // Plane is not face the camera. flip it
            if (face.plane.normal.dot(viewGL.camera.worldTransform.z) < 0) {
                face.plane.normal.negate();
            }

            var point = ray.intersectPlane(face.plane);
            if (!point) {
                continue;
            }
            var axis0 = cartesian.getAxis(face.faceInfo[0]);
            var axis1 = cartesian.getAxis(face.faceInfo[1]);
            var idx0 = dimIndicesMap[face.faceInfo[0]];
            var idx1 = dimIndicesMap[face.faceInfo[1]];
            if (axis0.contain(point.array[idx0]) && axis1.contain(point.array[idx1])) {
                nearestIntersectPoint = point;
            }
        }

        if (nearestIntersectPoint) {
            var data = cartesian.pointToData(nearestIntersectPoint.array, [], true);
            this._updateAxisPointer(data);

            this._doShowAxisPointer();
        }
        else {
            this._doHideAxisPointer();
        }
    },

    _onCameraChange: function (grid3DModel, api) {

        if (grid3DModel.get('show')) {
            this._updateFaceVisibility();
            this._updateAxisLinePosition();
        }

        var control = this._control;

        api.dispatchAction({
            type: 'grid3DChangeCamera',
            alpha: control.getAlpha(),
            beta: control.getBeta(),
            distance: control.getDistance(),
            center: control.getCenter(),
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
                face.rootNode.getWorldPosition(viewSpacePos);
                viewSpacePos.transformMat4(camera.viewMatrix);
                depths[k] = viewSpacePos.z;
            }
            // Set the front face invisible
            var frontIndex = depths[0] > depths[1] ? 0 : 1;
            var frontFace = this._faces[idx * 2 + frontIndex];
            var backFace = this._faces[idx * 2 + 1 - frontIndex];
            // Update rotation.
            frontFace.rootNode.invisible = true;
            backFace.rootNode.invisible = false;
        }
    },

    /**
     * Update axis line position when camera view changed.
     * @private
     */
    _updateAxisLinePosition: function () {
        // Put xAxis, yAxis on x, y visible plane.
        // Put zAxis on the left.
        // TODO
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

        var xAxisNode = this._axes[0].rootNode;
        var yAxisNode = this._axes[1].rootNode;
        var zAxisNode = this._axes[2].rootNode;

        var faces = this._faces;
        // Notice: in cartesian up axis is z, but in webgl up axis is y.
        var xAxisZOffset = (faces[4].rootNode.invisible ? far : near);
        var xAxisYOffset = (faces[2].rootNode.invisible ? top : bottom);
        var yAxisXOffset = (faces[0].rootNode.invisible ? left : right);
        var yAxisYOffset = (faces[2].rootNode.invisible ? top : bottom);
        var zAxisXOffset = (faces[0].rootNode.invisible ? right : left);
        var zAxisZOffset = (faces[4].rootNode.invisible ? far : near);

        xAxisNode.rotation.identity();
        yAxisNode.rotation.identity();
        zAxisNode.rotation.identity();
        if (faces[4].rootNode.invisible) {
            this._axes[0].flipped = true;
            xAxisNode.rotation.rotateX(Math.PI);
        }
        if (faces[0].rootNode.invisible) {
            this._axes[1].flipped = true;
            yAxisNode.rotation.rotateZ(Math.PI);
        }
        if (faces[4].rootNode.invisible) {
            this._axes[2].flipped = true;
            zAxisNode.rotation.rotateY(Math.PI);
        }

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
                coords[i].transformMat4(axisInfo.rootNode.worldTransform)
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
            axisInfo.setSpriteAlign(textAlign, verticalAlign, this._api);
        }, this);
    },

    _doShowAxisPointer: function () {
        if (!this._axisPointerLineMesh.invisible) {
            return;
        }

        this._axisPointerLineMesh.invisible = false;
        this._axisPointerLabelsMesh.invisible = false;
        this._api.getZr().refresh();
    },

    _doHideAxisPointer: function () {
        if (this._axisPointerLineMesh.invisible) {
            return;
        }

        this._axisPointerLineMesh.invisible = true;
        this._axisPointerLabelsMesh.invisible = true;
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
            var face = this._faces[k];
            if (face.rootNode.invisible) {
                continue;
            }

            var faceInfo = face.faceInfo;
            var otherCoord = faceInfo[3] < 0
                ? cartesian.getAxis(faceInfo[2]).getExtentMin()
                : cartesian.getAxis(faceInfo[2]).getExtentMax();
            var otherDimIdx = dimIndicesMap[faceInfo[2]];

            // Line on face.
            for (var i = 0; i < 2; i++) {
                var dim = faceInfo[i];
                var faceOtherDim = faceInfo[1 - i];
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
            if (ifShowAxisPointer(cartesian.getAxis(faceInfo[2]))) {
                var p0 = point.slice();
                var p1 = point.slice();
                p1[otherDimIdx] = otherCoord;
                var colorAndLineWidth = getAxisColorAndLineWidth(cartesian.getAxis(faceInfo[2]));
                linesGeo.addLine(p0, p1, colorAndLineWidth.color, colorAndLineWidth.lineWidth * dpr);
            }
        }
        linesGeo.convertToTypedArray();

        this._updateAxisPointerLabelsMesh(data);

        this._api.getZr().refresh();
    },

    _updateAxisPointerLabelsMesh: function (data) {
        var grid3dModel = this._model;
        var axisPointerLabelsMesh = this._axisPointerLabelsMesh;
        var axisPointerLabelsSurface = this._axisPointerLabelsSurface;
        var cartesian = grid3dModel.coordinateSystem;

        var axisPointerParentModel = grid3dModel.getModel('axisPointer');

        axisPointerLabelsMesh.geometry.convertToDynamicArray(true);
        axisPointerLabelsSurface.clear();

        var otherDim = {
            x: 'y', y: 'x', z: 'y'
        };
        this._axes.forEach(function (axisInfo, idx) {
            var axis = cartesian.getAxis(axisInfo.dim);
            var axisModel = axis.model;
            var axisPointerModel = axisModel.getModel('axisPointer', axisPointerParentModel);
            var labelModel = axisPointerModel.getModel('label');
            var lineColor = axisPointerModel.get('lineStyle.color');
            if (!labelModel.get('show') || !axisPointerModel.get('show')) {
                return;
            }
            var val = data[idx];
            var formatter = labelModel.get('formatter');
            var text = axis.scale.getLabel(val);
            if (formatter != null) {
                text = formatter(text, data);
            }
            else {
                if (axis.scale.type === 'interval' || axis.scale.type === 'log') {
                    var precision = echarts.number.getPrecisionSafe(axis.scale.getTicks()[0]);
                    text = val.toFixed(precision + 2);
                }
            }

            var textStyleModel = labelModel.getModel('textStyle');
            var labelColor = textStyleModel.get('color');
            var textEl = new echarts.graphic.Text();
            echarts.graphic.setTextStyle(textEl.style, textStyleModel, {
                text: text,
                textFill: labelColor || lineColor,
                textAlign: 'left',
                textVerticalAlign: 'top'
            });
            var coords = axisPointerLabelsSurface.add(textEl);
            var rect = textEl.getBoundingRect();
            var dpr = this._api.getDevicePixelRatio();
            var pos = axisInfo.rootNode.position.toArray();
            var otherIdx = dimIndicesMap[otherDim[axisInfo.dim]];
            pos[otherIdx] += (axisInfo.flipped ? -1 : 1) * labelModel.get('margin');
            pos[dimIndicesMap[axisInfo.dim]] = axis.dataToCoord(data[idx]);

            axisPointerLabelsMesh.geometry.addSprite(
                pos, [rect.width * dpr, rect.height * dpr], coords,
                axisInfo.textAlign, axisInfo.textVerticalAlign
            );
        }, this);
        axisPointerLabelsSurface.getZr().refreshImmediately();
        axisPointerLabelsMesh.material.set('uvScale', axisPointerLabelsSurface.getCoordsScale());
        axisPointerLabelsMesh.geometry.convertToTypedArray();
    },

    dispose: function () {
        this.groupGL.removeAll();
        this._control.dispose();
    }
});