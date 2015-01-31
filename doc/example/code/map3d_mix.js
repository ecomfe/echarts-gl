var ecConfig = require('echarts/config');
var mapParams = require('echarts/util/mapData/params').params;

myChart.setOption({
    title: {
        text: 'Map3D Map Mixing',
        x: 'center',
        textStyle: {
            color: 'white'
        }
    },
    series: [{
        name: 'Map 3D',
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
    
});