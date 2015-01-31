myChart.setOption({
    title: {
        text: 'Jupiter',
        subtext: 'Texture from http://planetpixelemporium.com/mars.html',
        sublink: 'http://planetpixelemporium.com/mars.html',
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
        mapType: 'none',
        baseLayer: {
            backgroundColor: '',
            backgroundImage: 'asset/jupiter.jpg'
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