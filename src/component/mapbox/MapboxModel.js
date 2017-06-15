var echarts = require('echarts/lib/echarts');

var componentPostEffectMixin = require('../common/componentPostEffectMixin');
var componentLightMixin = require('../common/componentLightMixin');

var MAPBOX_CAMERA_OPTION = ['zoom', 'center', 'pitch', 'bearing'];

var MapboxModel = echarts.extendComponentModel({

    type: 'mapbox',

    layoutMode: 'box',

    coordinateSystem: null,

    defaultOption: {
        zlevel: -10,

        style: 'mapbox://styles/mapbox/light-v9',

        center: [0, 0],

        zoom: 0,

        pitch: 0,
        
        bearing: 0,

        light: {
            main: {
                alpha: 20,
                beta: 30
            }
        },

        altitudeScale: 1,
        // Default depend on altitudeScale
        boxHeight: 'auto'
    },

    getMapboxCameraOption: function () {
        var self = this;
        return MAPBOX_CAMERA_OPTION.reduce(function (obj, key) {
            obj[key] = self.get(key);
            return obj;
        }, {});
    },

    setMapboxCameraOption: function (option) {
        if (option != null) {
            MAPBOX_CAMERA_OPTION.forEach(function (key) {
                if (option[key] != null) {
                    this.option[key] = option[key];
                }
            }, this);
        }
    },

    /**
     * Get mapbox instance
     */
    getMapbox: function () {
        return this._mapbox;
    },

    setMapbox: function (mapbox) {
        this._mapbox = mapbox;
    }
});

echarts.util.merge(MapboxModel.prototype, componentPostEffectMixin);
echarts.util.merge(MapboxModel.prototype, componentLightMixin);

module.exports = MapboxModel;