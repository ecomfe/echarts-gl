myChart.setOption({
    title: {
        text: 'Earth with sun light example',
        subtext: 'Environment texture from Natural Earth III',
        sublink: 'http://www.shadedrelief.com/natural3/pages/textures.html',
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

        background: 'asset/starfield.jpg',
        // Have a try to change an environment
        // background: 'asset/background.jpg',

        baseLayer: {
            backgroundColor: '',
            backgroundImage: 'asset/earth.jpg',
            quality: 'medium',

            heightImage: 'asset/elev_bump.jpg'
        },

        light: {
            show: true,
            // Use the system time
            // time: '2013-08-07 18:09:09',
            sunIntensity: 1
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