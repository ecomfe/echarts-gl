myChart.setOption({
    title: {
        text: 'Map with texture',
        x: 'center',
        textStyle: {
            color: 'white'
        }
    },
    tooltip: {
        formatter: '{b}'
    },
    series: [{
        type: 'map3d',
        mapType: 'world',
        baseLayer: {
            backgroundColor: '',
            backgroundImage: 'asset/earth.jpg',
            quality: 'high',
        },

        surfaceLayers: [{
            type: 'texture',
            distance: 3,
            image: 'asset/clouds.png'
        }],

        itemStyle: {
            normal: {
                label: {
                    show: true
                },
                borderWidth: 1,
                borderColor: 'yellow',
                areaStyle: {
                    color: 'rgba(0, 0, 0, 0)'
                }
            }
        },
        data: [{}]
    }]
});