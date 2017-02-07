var echarts = require('echarts/lib/echarts');

module.exports = echarts.extendComponentModel({

    type: 'globe',

    layoutMode: 'box',

    coordinateSystem: null,

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

        layers: []
    },

    setView: function (position, quaternion) {
        this.option.viewControl.position = position;
        this.option.viewControl.quaternion = quaternion;
    }
});