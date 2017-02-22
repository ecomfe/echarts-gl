var echarts = require('echarts/lib/echarts');


function defaultId(option, idx) {
    option.id = option.id || option.name || (idx + '');
}
var GlobeModel = echarts.extendComponentModel({

    type: 'globe',

    layoutMode: 'box',

    coordinateSystem: null,

    init: function () {
        GlobeModel.superApply(this, 'init', arguments);

        echarts.util.each(this.option.layers, function (layerOption, idx) {
            echarts.util.merge(layerOption, this.defaultLayerOption);
            defaultId(layerOption);
        }, this);
    },

    mergeOption: function (option) {
        // TODO test
        var oldLayers = this.option.layers;
        this.option.layers = null;
        GlobeModel.superApply(this, 'mergeOption', arguments);

        function createLayerMap(layers) {
            return echarts.util.reduce(layers, function (obj, layerOption, idx) {
                defaultId(layerOption, idx);
                obj[layerOption.id] = layerOption;
                return obj;
            }, {});
        }
        if (oldLayers && oldLayers.length) {
            var newLayerMap = createLayerMap(option.layers);
            var oldLayerMap = createLayerMap(oldLayers);
            for (var id in newLayerMap) {
                if (oldLayerMap[id]) {
                    echarts.util.merge(oldLayerMap[id], newLayerMap[id], true);
                }
                else {
                    oldLayers.push(option.layers[id]);
                }
            }
            // Copy back
            this.option.layers = oldLayers;
        }
        // else overwrite

        // Set default
        echarts.util.each(this.option.layers, function (layerOption) {
            echarts.util.merge(layerOption, this.defaultLayerOption);
        }, this);
    },

    defaultLayerOption: {
        show: true,
        type: 'overlay'
    },

    defaultOption: {

        show: true,

        zlevel: 10,

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
        // 'color', 'lambert', 'realistic'
        // TODO, 'toon'
        shading: 'color',

        realisticMaterial: {
            roughness: 0.5,
            metalness: 0
        },

        // Light is available when material.shading is not color
        light: {
            // Main sun light
            main: {
                // Time, default it will use system time
                time: '',
                color: '#fff',
                intensity: 1
            },
            ambient: {
                color: '#fff',
                intensity: 0.2
            },
            // Emission from emissive layers
            emission: {
                intensity: 1
            },
            ambientCubemap: {
                // Panorama environment texture,
                // Support .hdr and commmon web formats.
                texture: null,
                // Available when texture is hdr.
                exposure: 1,
                // Intensity for diffuse term
                diffuseIntensity: 0.5,
                // Intensity for specular term, only available when shading is realastic
                specularIntensity: 0.5
            }
        },

        postEffect: {
            enable: false,

            bloom: {
                enable: true,
                intensity: 0.1
            },

            FXAA: {
                enable: true
            }
        },
        // Temporal super sampling when the picture is still.
        temporalSuperSampling: {
            enable: false
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

            // Alpha angle for top-down rotation
            // Positive to rotate to top.
            alpha: 0,
            // beta angle for left-right rotation
            // Positive to rotate to right.
            beta: 0
        },

        // {
        //     show: true,
        //     name: 'cloud',
        //     type: 'overlay',
        //     shading: 'lambert',
        //     distance: 10,
        //     texture: ''
        // }
        // {
        //     type: 'blend',
        //     blendTo: 'albedo'
        //     blendType: 'source-over'
        // }

        layers: []
    },

    setView: function (opts) {
        opts = opts || {};
        this.option.viewControl = this.option.viewControl || {};
        if (opts.alpha != null) {
            this.option.viewControl.alpha = opts.alpha;
        }
        if (opts.beta != null) {
            this.option.viewControl.beta = opts.beta;
        }
        if (opts.distance != null) {
            this.option.viewControl.distance = opts.distance;
        }
    }
});

module.exports = GlobeModel;