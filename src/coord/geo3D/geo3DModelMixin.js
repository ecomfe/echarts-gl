var echarts = require('echarts/lib/echarts');

module.exports = {

    getFilledRegions: function (regions, map) {
        var regionsArr = (regions || []).slice();

        var map = echarts.getMap(map);
        var geoJson = map && map.geoJson;
        if (!geoJson) {
            if (__DEV__) {
                console.error('Map ' + map + ' not exists. You can download map file on http://echarts.baidu.com/download-map.html');
            }
            return [];
        }

        var dataNameMap = {};
        var features = geoJson.features;
        for (var i = 0; i < regionsArr.length; i++) {
            dataNameMap[regionsArr[i].name] = regionsArr[i];
        }

        for (var i = 0; i < features.length; i++) {
            var name = features[i].properties.name;
            if (!dataNameMap[name]) {
                regionsArr.push({
                    name: name
                });
            }
        }

        return regionsArr;
    },

    defaultOption: {
        show: true,

        zlevel: -10,

        // geoJson used by geo3D
        map: '',

        // Layout used for viewport
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',

        boxWidth: 100,
        boxHeight: 3,
        boxDepth: 'auto',

        groundPlane: {
            show: false,
            color: '#aaa'
        },

        shading: 'lambert',

        light: {
            main: {
                alpha: 40,
                beta: 30
            }
        },

        viewControl: {
            alpha: 40,
            beta: 0,
            distance: 100,

            minAlpha: 5,
            minBeta: -80,
            maxBeta: 80
        },

        label: {
            show: false,
            // Distance in 3d space.
            distance: 2,

            textStyle: {
                fontSize: 20,
                color: '#000',
                borderWidth: 1,
                borderColor: '#fff'
            }
        },
        // labelLine

        // light
        // postEffect
        // temporalSuperSampling
        // viewControl

        itemStyle: {
            areaColor: '#fff',
            borderWidth: 0,
            borderColor: '#333'
        },

        emphasis: {
            itemStyle: {
                // areaColor: '#f94b59'
                areaColor: '#639fc0'
            },
            label: {
                show: true
            }
        }
    }
};