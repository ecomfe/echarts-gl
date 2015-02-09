myChart.setOption({
    title: {
        text: 'Earth with sun light example',
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

            heightImage: 'asset/elev_bump.jpg'
        },

        light: {
            enable: true,
            // Use the system time
            time: ''
        },

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