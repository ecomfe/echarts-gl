var ecConfig = require('echarts/config');
var mapParams = require('echarts/util/mapData/params').params;

mapParams.world.getGeoJson(function (data) {
    data.features.forEach(function (feature) {
        // Register regions
        mapParams[feature.properties.name] = {
            getGeoJson: function (callback) {
                callback({
                    type: 'FeatureCollection',
                    features: [feature]
                })
            }
        }
    })
});

mapParams.usa = {
    getGeoJson: function (callback) {
        $.ajax({
            url: 'data/usa_geo.json',
            success: function (data) {
                callback(data);
            }
        });
    }
}

myChart.setOption({
    title: {
        text: 'Map3D Map Mixing',
        x: 'center',
        textStyle: {
            color: 'white'
        }
    },
    series: [{
        name: 'Globe',
        type: 'map3d',
        mapType: 'world',
        data: [{}],
        mapLocation: {
            x: 0,
            y: 0,
            width: '50%',
            height: '100%'
        }
    }, {
        name: 'Map',
        type: 'map',
        mapType: 'china',
        data: [{}],
        itemStyle:{
            normal:{
                borderColor:'rgba(100,149,237,1)',
                borderWidth:1.5,
                areaStyle:{
                    color: '#1b1b1b'
                }
            }
        },
        mapLocation: {
            x: '50%',
            y: 0,
            width: '50%',
            height: '100%'
        }
    }]
});

myChart.on(ecConfig.EVENT.CLICK, function (param) {
    var name = param.name;
    if (name === 'China') {
        myChart.setOption({
            series: [{
                name: 'Globe',
                type: 'map3d'
            }, {
                name: 'Map',
                type: 'map',
                mapType: 'china'
            }]
        });
    }
    else if(name === 'United States of America') {
        myChart.setOption({
            series: [{
                name: 'Globe',
                type: 'map3d'
            }, {
                name: 'Map',
                type: 'map',
                mapType: 'usa'
            }]
        })
    }
    else {
        myChart.setOption({
            series: [{
                name: 'Globe',
                type: 'map3d'
            }, {
                name: 'Map',
                type: 'map',
                mapType: name
            }]
        })
    }
});