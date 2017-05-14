var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var vec3 = require('qtek/lib/dep/glmatrix').vec3;

var Lines3DGeometry = require('../../util/geometry/Lines3D');

function sign(a) {
    return a > 0 ? 1 : -1;
}

graphicGL.Shader.import(require('./shader/trail2.glsl.js'));

module.exports = graphicGL.Mesh.extend(function () {

    var material = new graphicGL.Material({
        shader: new graphicGL.Shader({
            vertex: graphicGL.Shader.source('ecgl.trail2.vertex'),
            fragment: graphicGL.Shader.source('ecgl.trail2.fragment')
        }),
        transparent: true,
        depthMask: false
    });

    var geometry = new Lines3DGeometry({
        dynamic: true
    });
    geometry.createAttribute('dist', 'float', 1);
    geometry.createAttribute('distAll', 'float', 1);
    geometry.createAttribute('start', 'float', 1);

    return {
        geometry: geometry,
        material: material,
        culling: false,
        $ignorePicking: true
    };
}, {

    updateData: function (data, api, lines3DGeometry) {
        var seriesModel = data.hostModel;
        var geometry = this.geometry;

        var effectModel = seriesModel.getModel('effect');
        var size = effectModel.get('trailWidth') * api.getDevicePixelRatio();
        var trailLength = effectModel.get('trailLength');

        var speed = seriesModel.get('effect.constantSpeed');
        var period = seriesModel.get('effect.period') * 1000;
        var useConstantSpeed = speed != null;

        useConstantSpeed
            ? this.material.set('speed', speed / 1000)
            : this.material.set('period', period);

        this.material.shader[useConstantSpeed ? 'define' : 'undefine']('vertex', 'CONSTANT_SPEED');

        var isPolyline = seriesModel.get('polyline');

        geometry.trailLength = trailLength;
        this.material.set('trailLength', trailLength);

        geometry.resetOffset();

        ['position', 'positionPrev', 'positionNext'].forEach(function (attrName) {
            geometry.attributes[attrName].value = lines3DGeometry.attributes[attrName].value;
        });

        var extraAttrs = ['dist', 'distAll', 'start', 'offset', 'color'];

        extraAttrs.forEach(function (attrName) {
            geometry.attributes[attrName].init(geometry.vertexCount);
        });
        geometry.indices = lines3DGeometry.indices;

        var colorArr = [];
        var effectColor = effectModel.get('trailColor');
        var effectOpacity = effectModel.get('trailOpacity');
        var hasEffectColor = effectColor != null;
        var hasEffectOpacity = effectOpacity != null;

        var vertexOffset = 0;
        data.each(function (idx) {
            var pts = data.getItemLayout(idx);
            var opacity = hasEffectOpacity ? effectOpacity : data.getItemVisual(idx, 'opacity');
            var color = data.getItemVisual(idx, 'color');

            if (opacity == null) {
                opacity = 1;
            }
            colorArr = graphicGL.parseColor(hasEffectColor ? effectColor : color, colorArr);
            colorArr[3] *= opacity;

            var vertexCount = isPolyline
                ? lines3DGeometry.getPolylineVertexCount(pts)
                : lines3DGeometry.getCubicCurveVertexCount(pts[0], pts[1], pts[2], pts[3])

            var dist = 0;
            var pos = [];
            var posPrev = [];
            for (var i = vertexOffset; i < vertexOffset + vertexCount; i++) {
                geometry.attributes.position.get(i, pos);
                if (i > vertexOffset) {
                    dist += vec3.dist(pos, posPrev);
                }
                geometry.attributes.dist.set(i, dist);
                vec3.copy(posPrev, pos);
            }

            var randomStart = Math.random() * (useConstantSpeed ? dist : period);
            for (var i = vertexOffset; i < vertexOffset + vertexCount; i++) {
                geometry.attributes.distAll.set(i, dist);
                geometry.attributes.start.set(i, randomStart);

                geometry.attributes.offset.set(
                    i, sign(lines3DGeometry.attributes.offset.get(i)) * size / 2
                );
                geometry.attributes.color.set(i, colorArr);
            }

            vertexOffset += vertexCount;
        });

        geometry.dirty();
    },

    setAnimationTime: function (time) {
        this.material.set('time', time);
    }
});