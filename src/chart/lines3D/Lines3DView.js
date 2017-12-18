import echarts from 'echarts/lib/echarts';
import graphicGL from '../../util/graphicGL';
import LinesGeometry from '../../util/geometry/Lines3D';
// import TrailMesh from './TrailMesh';
import TrailMesh2 from './TrailMesh2';

import lines3DGLSL from '../../util/shader/lines3D.glsl.js';
graphicGL.Shader.import(lines3DGLSL);

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

export default echarts.extendChartView({

    type: 'lines3D',

    __ecgl__: true,

    init: function (ecModel, api) {
        this.groupGL = new graphicGL.Node();

        this._meshLinesMaterial = new graphicGL.Material({
            shader: graphicGL.createShader('ecgl.meshLines3D'),
            transparent: true,
            depthMask: false
        });
        this._linesMesh = new graphicGL.Mesh({
            geometry: new LinesGeometry(),
            material: this._meshLinesMaterial,
            $ignorePicking: true
        });

        // this._trailMesh = new TrailMesh();
        this._trailMesh = new TrailMesh2();
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
            this._linesMesh.material[methodName]('fragment', 'SRGB_DECODE');
            this._trailMesh.material[methodName]('fragment', 'SRGB_DECODE');
        }

        var trailMesh = this._trailMesh;
        trailMesh.stopAnimation();

        if (seriesModel.get('effect.show')) {
            this.groupGL.add(trailMesh);

            trailMesh.updateData(data, api, this._linesMesh.geometry);

            trailMesh.__time = trailMesh.__time || 0;
            var time = 3600 * 1000; // 1hour
            this._curveEffectsAnimator = trailMesh.animate('', { loop: true })
                .when(time, {
                    __time: time
                })
                .during(function () {
                    trailMesh.setAnimationTime(trailMesh.__time);
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

    pauseEffect: function () {
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

        // Must set useNativeLine before calling any other methods
        geometry.useNativeLine = false;

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