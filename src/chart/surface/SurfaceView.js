var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');

graphicGL.Shader.import(require('text!../../util/shader/albedo.glsl'));
graphicGL.Shader.import(require('text!../../util/shader/lambert.glsl'));

echarts.extendChartView({

    type: 'scatter3D',

    init: function (ecModel, api) {

        this.groupGL = new graphicGL.Node();

        var lambertMaterial = new graphicGL.Material({
            shader: graphicGL.createShader('ecgl.lambert')
        });
        var albedoMaterial = new graphicGL.Material({
            shader: graphicGL.createShader('ecgl.albedo')
        });

        this._lambertMaterial = lambertMaterial;
        this._albedoMaterial = albedoMaterial;
        var mesh = new graphicGL.Mesh({
            geometry: new graphicGL.Geometry(),
            material: lambertMaterial
        });

        this._surfaceMesh = mesh;
        this.groupGL.add(this._surfaceMesh);
    },

    render: function (seriesModel, ecModel, api) {
        var coordSys = seriesModel.coordinateSystem;
        if (coordSys && coordSys.viewGL) {
            coordSys.viewGL.add(this.groupGL);
        }

        var shading = seriesModel.get('shading');
        var data = seriesModel.getData();

        if (shading === 'albedo') {
            this._surfaceMesh.material = this._albedoMaterial;
        }
        else if (shading === 'lambert') {
            this._surfaceMesh.material = this._lambertMaterial;
        }
        else {
            if (__DEV__) {
                console.error('Unkown shading %s', shading);
            }
            this._surfaceMesh.material = this._lambertMaterial;
        }
    },

    dispose: function () {
        this.groupGL.removeAll();
    },

    remove: function () {
        this.groupGL.removeAll();
    }
});