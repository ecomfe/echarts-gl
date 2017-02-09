var echarts = require('echarts/lib/echarts');

var GlobeModel = echarts.extendComponentModel({

    type: 'globe',

    layoutMode: 'box',

    coordinateSystem: null,

    init: function () {
        GlobeModel.superApply(this, 'init', arguments);

        echarts.util.each(this.option.layers, function (layerOption, idx) {
            echarts.util.layer.merge(layerOption, this.defaultLayerOption);
            this._defaultId(layerOption);
        }, this);
    },

    _defaultId: function (option, idx) {
        option.id = option.id || option.name || (idx + '');
    },

    mergeOption: function (option) {
        // TODO test
        var oldLayers = this.option.layers;
        this.option.layers = null;
        GlobeModel.superApply(this, 'mergeOption', arguments);

        function createLayerMap(layers) {
            return echarts.util.reduce(layers, function (obj, layerOption, idx) {
                obj[layerOption.id] = layerOption;
                return obj;
            }, {});
        }
        if (oldLayers && oldLayers.length) {
            var newLayerMap = createLayerMap(option.layers);
            var oldLayerMap = createLayerMap(oldLayers);
            for (var id in newLayerMap) {
                this._defaultId(newLayerMap[id], echarts.util.indexOf(option.layers, newLayerMap[id]));
                if (oldLayerMap[id]) {
                    echarts.util.merge(newLayerMap[id]);
                }
                else {
                    oldLayers.push(option.layers);
                }
            }
            // Copy back
            this.option.layers = oldLayers;
        }
        // else overwrite
    },

    defaultLayerOption: {
        show: true,
        type: 'overlay'
    },

    defaultOption: {

        zlevel: 10,

        show: true,

        flat: false,

        // Layout used for viewport
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',

        environmentTexture: '',

        // Base albedo texture
        baseTexture: '',

        // Height texture for bump mapping and vertex displacement
        heightTexture: '',

        // Texture for vertex displacement, default use heightTexture
        displacementTexture: '',
        // Scale of vertex displacement, available only if displacementTexture is set.
        displacementScale: 0,

        globeRadius: 100,

        // Shading of globe
        // 'color', 'lambert'
        // TODO, 'realastic', 'toon'
        shading: 'color',

        // Light is available when material.shading is not color
        light: {
            sunIntensity: 1,

            ambientIntensity: 0.1,

            // Time, default it will use system time
            time: ''
        },

        // Configuration abount view control
        viewControl: {
            // If rotate on on init
            autoRotate: true,

            // Start rotating after still for a given time
            // default is 3 seconds
            autoRotateAfterStill: 3,

            // Rotate globe or pan flat map to have camera centered on given coord
            center: null,

            // Distance to the surface of globe.
            distance: 150,

            // Min distance to the surface of globe
            minDistance: 40,
            // Max distance to the surface of globe
            maxDistance: 400,

            // Position and quaternion of camera, override all other properties
            position: null,
            quaternion: null
        },

        // {
        //     show: true,
        //     name: 'cloud',
        //     type: 'overlay'
        //     distance: 10,
        //     texture: ''
        // }
        // {
        //     type: 'blend',
        //     blendTo: 'emission'
        //     blendType: 'source-over'
        // }

        layers: []
    },

    setView: function (position, quaternion) {
        this.option.viewControl.position = position;
        this.option.viewControl.quaternion = quaternion;
    }
});

module.exports = GlobeModel;