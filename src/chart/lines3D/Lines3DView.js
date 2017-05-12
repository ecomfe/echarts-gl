var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var LinesGeometry = require('../../util/geometry/Lines3D');
var TrailMesh = require('./TrailMesh');

graphicGL.Shader.import(require('../../util/shader/lines3D.glsl.js'));

function getCoordSysSize(coordSys) {
    if (coordSys.radius != null) {
        return coordSys.radius;
    }
    if (coordSys.size != null) {
        return Math.max(coordSys.size[0], coordSys.size[1], coordSys.size[2]);
    }
    else {
        return 100;
    }
}

module.exports = echarts.extendChartView({

    type: 'lines3D',

    __ecgl__: true,

    init: function (ecModel, api) {
        this.groupGL = new graphicGL.Node();

        this._nativeLinesMaterial = new graphicGL.Material({
            shader: graphicGL.createShader('ecgl.lines3D'),
            transparent: true,
            depthMask: false
        });

        this._projectedLinesMaterial = new graphicGL.Material({
            shader: graphicGL.createShader('ecgl.meshLines3D'),
            transparent: true,
            depthMask: false
        });
        this._linesMesh = new graphicGL.Mesh({
            geometry: new LinesGeometry()
        });

        this._trailMesh = new TrailMesh();
    },

    render: function (seriesModel, ecModel, api) {

        this.groupGL.add(this._linesMesh);

        var coordSys = seriesModel.coordinateSystem;
        var data = seriesModel.getData();

        if (coordSys && coordSys.viewGL) {
            var viewGL = coordSys.viewGL;
            viewGL.add(this.groupGL);

            this._updateLines(seriesModel, ecModel, api);

            var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'undefine';
            this._linesMesh.material.shader[methodName]('fragment', 'SRGB_DECODE');
        }

        var trailMesh = this._trailMesh;
        trailMesh.stopAnimation();

        if (seriesModel.get('effect.show')) {
            var trailLength = seriesModel.get('effect.trailLength');
            var percentScale = trailLength + 1.0;

            this.groupGL.add(trailMesh);

            trailMesh.setScale(getCoordSysSize(coordSys));
            trailMesh.setData(data, api);

            var period = seriesModel.get('effect.period') * 1000;
            var delay = trailMesh.__percent ? -(period * trailMesh.__percent / percentScale) : 0;
            trailMesh.__percent = 0;
            this._curveEffectsAnimator = trailMesh.animate('', { loop: true })
                .when(period * percentScale, {
                    __percent: percentScale
                })
                .delay(delay)
                .during(function () {
                    trailMesh.setAnimationPercent(trailMesh.__percent);
                })
                .start();
        }
        else {
            this.groupGL.remove(trailMesh);
            this._curveEffectsAnimator = null;
        }

        this._linesMesh.material.blend = this._trailMesh.material.blend
            = seriesModel.get('blendMode') === 'lighter'
            ? graphicGL.additiveBlend : null;
    },

    puaseEffect: function () {
        if (this._curveEffectsAnimator) {
            this._curveEffectsAnimator.pause();
        }
    },

    resumeEffect: function () {
        if (this._curveEffectsAnimator) {
            this._curveEffectsAnimator.resume();
        }
    },

    toggleEffect: function () {
        var animator = this._curveEffectsAnimator;
        if (animator) {
            animator.isPaused() ? animator.resume() : animator.pause();
        }
    },

    _updateLines: function (seriesModel, ecModel, api) {
        var data = seriesModel.getData();
        var coordSys = seriesModel.coordinateSystem;
        var geometry = this._linesMesh.geometry;
        var isPolyline = seriesModel.get('polyline');

        geometry.expandLine = true;

        var size = getCoordSysSize(coordSys);
        geometry.segmentScale = size / 20;

        var lineWidthQueryPath = 'lineStyle.width'.split('.');
        var dpr = api.getDevicePixelRatio();
        var canUseNativeLine = true;
        var maxLineWidth = 0;
        data.each(function (idx) {
            var itemModel = data.getItemModel(idx);
            var lineWidth = itemModel.get(lineWidthQueryPath);
            if (lineWidth == null) {
                lineWidth = 1;
            }
            data.setItemVisual(idx, 'lineWidth', lineWidth);
            maxLineWidth = Math.max(lineWidth, maxLineWidth);
        });
        var canUseNativeLine = false;
        // var canUseNativeLine = maxLineWidth * dpr <= 1;
        // Must set useNativeLine before calling any other methods
        geometry.useNativeLine = canUseNativeLine;

        var nVertex = 0;
        var nTriangle = 0;
        data.each(function (idx) {
            var pts = data.getItemLayout(idx);
            if (isPolyline) {
                nVertex += geometry.getPolylineVertexCount(pts);
                nTriangle += geometry.getPolylineTriangleCount(pts);
            }
            else {
                nVertex += geometry.getCubicCurveVertexCount(pts[0], pts[1], pts[2], pts[3]);
                nTriangle += geometry.getCubicCurveTriangleCount(pts[0], pts[1], pts[2], pts[3]);
            }
        });

        this._linesMesh.material = canUseNativeLine ? this._nativeLinesMaterial : this._projectedLinesMaterial;
        this._linesMesh.mode = canUseNativeLine ? graphicGL.Mesh.LINES : graphicGL.Mesh.TRIANGLES;

        geometry.setVertexCount(nVertex);
        geometry.setTriangleCount(nTriangle);
        geometry.resetOffset();

        var colorArr = [];
        data.each(function (idx) {
            var pts = data.getItemLayout(idx);
            var color = data.getItemVisual(idx, 'color');
            var opacity = data.getItemVisual(idx, 'opacity');
            var lineWidth = data.getItemVisual(idx, 'lineWidth') * dpr;
            if (opacity == null) {
                opacity = 1;
            }

            colorArr = graphicGL.parseColor(color, colorArr);
            colorArr[3] *= opacity;
            if (isPolyline) {
                geometry.addPolyline(pts, colorArr, lineWidth);
            }
            else {
                geometry.addCubicCurve(pts[0], pts[1], pts[2], pts[3], colorArr, lineWidth);
            }
        });

        geometry.dirty();
    },

    remove: function () {
        this.groupGL.removeAll();
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});