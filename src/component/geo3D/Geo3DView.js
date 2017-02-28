var Geo3DBuilder = require('../common/Geo3DBuilder');
var echarts = require('echarts/lib/echarts');

var graphicGL = require('../../util/graphicGL');
var OrbitControl = require('../../util/OrbitControl');
var LightHelper = require('../common/LightHelper');

module.exports = echarts.extendComponentView({

    type: 'geo3D',

    __ecgl__: true,

    init: function (ecModel, api) {

        this._geo3DBuilder = new Geo3DBuilder();
        this.groupGL = new graphicGL.Node();

        this.groupGL.add(this._geo3DBuilder.rootNode);

        this._lightHelper = new LightHelper(this.groupGL);

        this._control = new OrbitControl({
            zr: api.getZr()
        });
        this._control.init();

        var materials = {};
        ['lambert', 'color', 'realistic'].forEach(function (shading) {
            materials[shading] = new graphicGL.Material({
                shader: graphicGL.createShader('ecgl.' + shading)
            });
        });
        this._groundMaterials = materials;

        this._groundMesh = new graphicGL.Mesh({
            geometry: new graphicGL.PlaneGeometry(),
            castShadow: false
        });
        this._groundMesh.rotation.rotateX(-Math.PI / 2);
        this._groundMesh.scale.set(1000, 1000, 1);
        this.groupGL.add(this._groundMesh);
    },

    render: function (geo3DModel, ecModel, api) {
        var geo3D = geo3DModel.coordinateSystem;

        if (!geo3D || !geo3D.viewGL) {
            return;
        }
        geo3D.viewGL.add(this.groupGL);

        this._geo3DBuilder.update(geo3DModel, ecModel, api);

        var control = this._control;
        control.setCamera(geo3D.viewGL.camera);

        var viewControlModel = geo3DModel.getModel('viewControl');
        control.setFromViewControlModel(viewControlModel, 0);

        this._lightHelper.updateLight(geo3DModel);

        // Set post effect
        geo3D.viewGL.setPostEffect(geo3DModel.getModel('postEffect'));
        geo3D.viewGL.setTemporalSuperSampling(geo3DModel.getModel('temporalSuperSampling'));

        this._updateGroudPlane(geo3DModel);
    },

    _updateGroudPlane: function (geo3DModel) {
        var groundModel = geo3DModel.getModel('groundPlane');
        var shading = geo3DModel.get('shading');
        var material = this._groundMaterials[shading];
        if (!material) {
            if (__DEV__) {
                console.warn('Unkonw shading ' + shading);
            }
            material = this._groundMaterials.lambert;
        }
        this._groundMesh.material = material;
        this._groundMesh.material.set('color', graphicGL.parseColor(groundModel.get('color')));
        this._groundMesh.invisible = !geo3DModel.get('show');
    },

    afterRender: function (geo3DModel, ecModel, api, layerGL) {
        var renderer = layerGL.renderer;
        this._lightHelper.updateAmbientCubemap(renderer, geo3DModel, api);
    }
});