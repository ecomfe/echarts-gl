var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var BarsGeometry = require('./BarsGeometry');

graphicGL.Shader.import(require('text!../../util/shader/albedo.glsl'));
graphicGL.Shader.import(require('text!../../util/shader/lambert.glsl'));

function getShader(shading) {
    var shader = new graphicGL.Shader({
        vertex: graphicGL.Shader.source('ecgl.' + shading + '.vertex'),
        fragment: graphicGL.Shader.source('ecgl.' + shading + '.fragment')
    });
    shader.define('both', 'VERTEX_COLOR');
    return shader;
}

module.exports = echarts.extendChartView({

    type: 'bar3d',

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

        this._albedoMaterial = new graphicGL.Material({
            shader: getShader('albedo')
        });
        this._albedoTransarentMaterial = new graphicGL.Material({
            shader: this._albedoMaterial.shader,
            transparent: true,
            depthMask: false
        });
        this._lambertMaterial = new graphicGL.Material({
            shader: getShader('lambert')
        });
        this._lambertTransarentMaterial = new graphicGL.Material({
            shader: this._lambertMaterial.shader,
            transparent: true,
            depthMask: false
        });

        this._barMesh = barMesh;
        this._barMeshTransparent = barMeshTransparent;
    },

    render: function (seriesModel, ecModel, api) {
        var coordSys = seriesModel.coordinateSystem;
        if (coordSys.type === 'globe') {
            coordSys.viewGL.add(this.groupGL);

            this._renderOnGlobe(seriesModel, api);
        }
    },

    _renderOnGlobe: function (seriesModel, api) {
        var data = seriesModel.getData();
        var shading = seriesModel.get('shading');
        var enableNormal = false;
        var self = this;
        if (shading === 'color') {
            this._barMesh.material = this._albedoMaterial;
            this._barMeshTransparent.material = this._albedoTransarentMaterial;
        }
        else if (shading === 'lambert') {
            enableNormal = true;
            this._barMesh.material = this._lambertMaterial;
            this._barMeshTransparent.material = this._lambertTransarentMaterial;
        }
        else {
            console.warn('Unkonw shading ' + shading);
            this._barMesh.material = this._albedoMaterial;
            this._barMeshTransparent.material = this._albedoTransarentMaterial;
        }

        this._barMesh.geometry.resetOffset();
        this._barMeshTransparent.geometry.resetOffset();

        var prevColor;
        var prevOpacity;
        var colorArr;
        var opacityAccessPath = ['itemStyle', 'normal', 'opacity'];
        var transparentBarCount = 0;
        var opaqueBarCount = 0;
        var defaultColorArr = [0, 0, 0, 1];
        // Seperate opaque and transparent bars.
        data.each(function (idx) {
            var itemModel = data.getItemModel(idx);
            var color = data.getItemVisual(idx, 'color');

            var opacity = data.getItemVisual('opacity');
            if (opacity == null) {
                opacity = itemModel.get(opacityAccessPath);
            }
            if (opacity == null) {
                opacity = 1;
            }
            if (color !== prevColor || opacity !== prevOpacity) {
                colorArr = echarts.color.parse(color);
                colorArr[0] /= 255; colorArr[1] /= 255; colorArr[2] /= 255;
                colorArr[3] *= opacity;
                prevColor = color;
                prevOpacity = opacity;
            }
            data.setItemVisual(idx, 'vertexColor', colorArr || defaultColorArr);

            if (colorArr[3] < 0.99) {
                if (colorArr[3] > 0) {
                    transparentBarCount++;
                }
            }
            else {
                opaqueBarCount++;
            }
        });
        this._barMesh.geometry.setBarCount(opaqueBarCount, enableNormal);
        this._barMeshTransparent.geometry.setBarCount(transparentBarCount, enableNormal);

        var barSize = seriesModel.get('barSize');
        if (!echarts.util.isArray(barSize)) {
            barSize = [barSize, barSize];
        }
        data.each(function (idx) {
            var layout = data.getItemLayout(idx);
            var start = layout[0];
            var end = layout[1];
            var orient = graphicGL.Vector3.UP._array;

            var colorArr = data.getItemVisual(idx, 'vertexColor');
            if (colorArr[3] < 0.99) {
                if (colorArr[3] > 0) {
                    self._barMeshTransparent.geometry.addBar(start, end, orient, barSize, colorArr);
                }
            }
            else {
                self._barMesh.geometry.addBar(start, end, orient, barSize, colorArr);
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