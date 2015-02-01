$.ajax({
    url: './data/winds.json',
    success: function (data) {
        var field = [];
        var p = 0;
        for (var j = 0; j < data.ny; j++) {
            field[data.ny - j - 1] = [];
            for (var i = 0; i < data.nx; i++, p++) {
                data.data[p][0] /= data.max;
                data.data[p][1] /= data.max;
                field[data.ny - j - 1][i] = data.data[p];
            }
        }
        myChart.setOption({
            title: {
                text: 'Surface Wind Field Visualization',
                subtext: 'Data from http://earth.nullschool.net',
                sublink: 'http://earth.nullschool.net',
                x: 'center',
                textStyle: {
                    color: 'white'
                }
            },
            legend: {
                show: true,
                data: ['winds'],
                x: 'left',
                orient: 'vertical',
                textStyle: {
                    color: 'white'
                }
            },
            tooltip: {
                formatter: '{b}'
            },
            series: [{
                type: 'map3d',

                baseLayer: {
                    backgroundColor: '',
                    backgroundImage: './asset/earth.jpg',
                    quality: 'high'
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
            }, {
                name: 'winds',
                type: 'map3d',

                surfaceLayers: [{
                    type: 'particle',
                    distance: 3,
                    size: [4096, 2048],
                    particle: {
                        vectorField: field,
                        color: 'white',
                        speedScaling: 1,
                        sizeScaling: 1,
                        number: 512 * 512,
                        motionBlurFactor: 0.97
                    }
                }]
            }]
        });
    }
});