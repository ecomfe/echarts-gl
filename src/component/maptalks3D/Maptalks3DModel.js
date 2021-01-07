import * as echarts from 'echarts/lib/echarts';

import componentPostEffectMixin from '../common/componentPostEffectMixin';
import componentLightMixin from '../common/componentLightMixin';

var MAPTALKS_CAMERA_OPTION = ['zoom', 'center', 'pitch', 'bearing'];

var Maptalks3DModel = echarts.ComponentModel.extend({

    type: 'maptalks3D',

    layoutMode: 'box',

    coordinateSystem: null,

    defaultOption: {
        zlevel: -10,

        urlTemplate: 'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="http://osm.org">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/">CARTO</a>',

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

    getMaptalksCameraOption: function () {
        var self = this;
        return MAPTALKS_CAMERA_OPTION.reduce(function (obj, key) {
            obj[key] = self.get(key);
            return obj;
        }, {});
    },

    setMaptalksCameraOption: function (option) {
        if (option != null) {
            MAPTALKS_CAMERA_OPTION.forEach(function (key) {
                if (option[key] != null) {
                    this.option[key] = option[key];
                }
            }, this);
        }
    },

    /**
     * Get maptalks instance
     */
    getMaptalks: function () {
        return this._maptalks;
    },

    setMaptalks: function (maptalks) {
        this._maptalks = maptalks;
    }
});

echarts.util.merge(Maptalks3DModel.prototype, componentPostEffectMixin);
echarts.util.merge(Maptalks3DModel.prototype, componentLightMixin);

export default Maptalks3DModel;