$.ajax({
    url: './data/population.json',
    success: function (data) {
        var max = -Infinity;
        var min = Infinity;
        data = data.map(function (dataItem) {
            max = Math.max(dataItem[2], max);
            min = Math.min(dataItem[2], min);
            return {
                geoCoord: dataItem.slice(0, 2),
                value: dataItem[2],
                distance: Math.random()
            }
        });
        data.forEach(function (dataItem) {
            // Map symbol size to 2 - 20
            dataItem.symbolSize = (dataItem.value - min) / (max - min) * 18 + 2;
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
            dataRange: {
                min: 0,
                max: max,
                text:['High','Low'],
                realtime: false,
                calculable : true,
                color: ['red','yellow','lightskyblue']
            },
            series: [{
                name: 'World Population',
                type: 'map3d',
                mapType: 'world',

                baseLayer: {
                    backgroundColor: '#005f99'
                },

                itemStyle: {
                    normal: {
                        borderColor: '#777',
                        areaStyle: {
                            color: "#000011"
                        }
                    }
                },
                markPoint: {
                    large: true,
                    effect: {
                        show: true,
                        shadowBlur: 0.4
                    },
                    data: data
                }
            }]
        });
    }
});