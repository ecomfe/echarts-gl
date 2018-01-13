import echarts from 'echarts/lib/echarts';

export default {

    getFilledRegions: function (regions, mapData) {
        var regionsArr = (regions || []).slice();

        var geoJson;
        if (typeof mapData === 'string') {
            mapData = echarts.getMap(mapData);
            geoJson = mapData && mapData.geoJson;
        }
        else {
            if (mapData && mapData.features) {
                geoJson = mapData;
            }
        }
        if (!geoJson) {
            if (__DEV__) {
                console.error('Map ' + mapData + ' not exists. You can download map file on http://echarts.baidu.com/download-map.html');
                if (!geoJson.features) {
                    console.error('Invalid GeoJSON for map3D');
                }
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
        boxHeight: 10,
        boxDepth: 'auto',

        regionHeight: 3,

        environment: 'auto',

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
            orthographicSize: 60,

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
                backgroundColor: 'rgba(255,255,255,0.7)',
                padding: 3,
                borderRadius: 4
            }
        },

        // TODO
        // altitude: {
        //     min: 'auto',
        //     max: 'auto',

        //     height: []
        // },


        // labelLine

        // light
        // postEffect
        // temporalSuperSampling

        itemStyle: {
            color: '#fff',
            borderWidth: 0,
            borderColor: '#333'
        },

        emphasis: {
            itemStyle: {
                // color: '#f94b59'
                color: '#639fc0'
            },
            label: {
                show: true
            }
        }
    }
};