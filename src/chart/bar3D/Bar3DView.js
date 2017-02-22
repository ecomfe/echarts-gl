var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var retrieve = require('../../util/retrieve');
var BarsGeometry = require('../../util/geometry/Bars3DGeometry');

function getShader(shading) {
    var shader = graphicGL.createShader('ecgl.' + shading);
    shader.define('both', 'VERTEX_COLOR');
    return shader;
}

module.exports = echarts.extendChartView({

    type: 'bar3D',

    __ecgl__: true,

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        var barMesh = new graphicGL.Mesh({
            geometry: new BarsGeometry({
                dynamic: true
            }),
            ignorePicking: true
        });
        var barMeshTransparent = new graphicGL.Mesh({
            geometry: new BarsGeometry({
                dynamic: true
            }),
            ignorePicking: true
        });

        this.groupGL.add(barMesh);
        this.groupGL.add(barMeshTransparent);

        var materials = {};
        var transparentMaterials = {};
        ['lambert', 'color', 'realistic'].forEach(function (shading) {
            if (shading === 'color') {
                shading = 'albedo';
            }
            materials[shading] = new graphicGL.Material({
                shader: getShader(shading)
            });
            transparentMaterials[shading] = new graphicGL.Material({
                shader: getShader(shading),
                transparent: true,
                depthMask: false
            });
        });

        this._materials = materials;
        this._transparentMaterials = transparentMaterials;

        this._barMesh = barMesh;
        this._barMeshTransparent = barMeshTransparent;
    },

    render: function (seriesModel, ecModel, api) {
        this.groupGL.add(this._barMesh);
        this.groupGL.add(this._barMeshTransparent);

        var coordSys = seriesModel.coordinateSystem;
        this._doRender(seriesModel, api);
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);

            var methodName = coordSys.viewGL.isLinearSpace() ? 'define' : 'unDefine';
            this._barMesh.material.shader[methodName]('fragment', 'SRGB_DECODE');
            this._barMeshTransparent.material.shader[methodName]('fragment', 'SRGB_DECODE');
        }

    },

    _doRender: function (seriesModel, api) {
        var data = seriesModel.getData();
        var shading = seriesModel.get('shading');
        var enableNormal = shading !== 'color';
        var self = this;

        if (this._materials[shading]) {
            this._barMesh.material = this._materials[shading];
            this._barMeshTransparent.material = this._transparentMaterials[shading];
        }
        else {
            if (__DEV__) {
                console.warn('Unkonw shading ' + shading);
            }
            this._barMesh.material = this._materials.lambert;
            this._barMeshTransparent.material = this._transparentMaterials.lambert;
        }
        if (shading === 'realistic') {
            var matModel = seriesModel.getModel('realisticMaterial');
            var matOpt = {
                roughness: retrieve.firstNotNull(matModel.get('roughness'), 0.5),
                metalness: matModel.get('metalness') || 0
            };
            this._barMesh.material.set(matOpt);
            this._barMeshTransparent.material.set(matOpt);
        }

        this._barMesh.geometry.enableNormal = enableNormal;
        this._barMeshTransparent.geometry.enableNormal = enableNormal;

        this._barMesh.geometry.resetOffset();
        this._barMeshTransparent.geometry.resetOffset();

        // Bevel settings
        var bevelSize = seriesModel.get('bevelSize');
        var bevelSegments = seriesModel.get('bevelSmoothness');
        this._barMesh.geometry.bevelSegments = bevelSegments;
        this._barMeshTransparent.geometry.bevelSegments = bevelSegments;

        this._barMesh.geometry.bevelSize = bevelSize;
        this._barMeshTransparent.bevelSize = bevelSize;

        var transparentBarCount = 0;
        var opaqueBarCount = 0;

        var colorArr = [];
        var vertexColors = new Float32Array(data.count() * 4);
        var colorOffset = 0;
        // Seperate opaque and transparent bars.
        data.each(function (idx) {
            if (!data.hasValue(idx)) {
                return;
            }
            var color = data.getItemVisual(idx, 'color');

            var opacity = data.getItemVisual(idx, 'opacity');
            if (opacity == null) {
                opacity = 1;
            }

            echarts.color.parse(color, colorArr);
            vertexColors[colorOffset++] = colorArr[0] / 255;
            vertexColors[colorOffset++] = colorArr[1] / 255;
            vertexColors[colorOffset++] = colorArr[2] / 255;
            vertexColors[colorOffset++] = colorArr[3] * opacity;

            if (colorArr[3] < 0.99) {
                if (colorArr[3] > 0) {
                    transparentBarCount++;
                }
            }
            else {
                opaqueBarCount++;
            }
        });

        this._barMesh.geometry.setBarCount(opaqueBarCount);
        this._barMeshTransparent.geometry.setBarCount(transparentBarCount);

        var orient = data.getLayout('orient');
        data.each(function (idx) {
            if (!data.hasValue(idx)) {
                return;
            }
            var layout = data.getItemLayout(idx);
            var start = layout[0];
            var dir = layout[1];
            var size = layout[2];

            var idx4 = idx * 4;
            colorArr[0] = vertexColors[idx4++];
            colorArr[1] = vertexColors[idx4++];
            colorArr[2] = vertexColors[idx4++];
            colorArr[3] = vertexColors[idx4++];
            if (colorArr[3] < 0.99) {
                if (colorArr[3] > 0) {
                    self._barMeshTransparent.geometry.addBar(start, dir, orient, size, colorArr);
                }
            }
            else {
                self._barMesh.geometry.addBar(start, dir, orient, size, colorArr);
            }
        });

        this._barMesh.geometry.dirty();
        this._barMeshTransparent.geometry.dirty();
    },

    remove: function () {
        this.groupGL.removeAll();
    },

    dispose: function () {
        this.groupGL.removeAll();
    }
});