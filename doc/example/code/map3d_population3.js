$.ajax({
    url: './data/population.json',
    success: function (data) {
        var max = -Infinity;
        data = data.map(function (item) {
            max = Math.max(item[2], max);
            return {
                geoCoord: item.slice(0, 2),
                value: item[2]
            }
        });
        data.forEach(function (item) {
            item.barHeight = item.value / max * 50 + 0.1
        });

        myChart.setOption({
            title : {
                text: 'Gridded Population of the World (2000)',
                subtext: 'Data from Socioeconomic Data and Applications Center',
                sublink : 'http://sedac.ciesin.columbia.edu/data/set/gpw-v3-population-density/data-download#close',
                x:'center',
                y:'top',
                textStyle: {
                    color: 'white'
                }
            },
            tooltip: {
                formatter: '{b}'
            },
            dataRange: {
                min: 0,
                max: max,
                text:['High','Low'],
                realtime: false,
                calculable : true,
                color: ['red','yellow','lightskyblue']
            },
            series: [{
                type: 'map3d',
                mapType: 'world',
                baseLayer: {
                    backgroundColor: 'rgba(0, 150, 200, 0.5)'
                },
                data: [{}],
                itemStyle: {
                    normal: {
                        areaStyle: {
                            color: 'rgba(0, 150, 200, 0.8)'
                        },
                        borderColor: '#777'
                    }
                },
                markBar: {
                    barSize: 0.6,
                    data: data
                },
                autoRotate: true,
            }]
        });
    }
});