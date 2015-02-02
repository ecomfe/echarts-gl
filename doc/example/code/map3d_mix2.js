var ecConfig = require('echarts/config');

$.ajax({
    url: 'data/gdp.json',
    success: function (data) {
        myChart.setOption({
            title: {
                text: 'World GDP',
                subtext: 'Data from Geohive',
                sublink: 'http://www.geohive.com/charts/ec_gdp1.aspx',
                x: 'center',
                textStyle: {
                    color: 'white'
                }
            },
            tooltip: {
                trigger: 'axis'
            },
            grid: {
                borderWidth: 0,
                x: '50%'
            },
            xAxis: {
                type: 'category',
                data: data.years.map(function (year) { return year + '年'; }),
                axisLabel: {
                    textStyle: {
                        color: 'white'
                    }
                },
                splitArea: {
                    show: false
                },
                splitLine: {
                    show: false
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    textStyle: {
                        color: 'white'
                    }
                },
                splitArea: {
                    show: false
                },
                splitLine: {
                    show: false
                },
                position: 'right'
            },
            series: [{
                name: 'Globe',
                type: 'map3d',
                mapType: 'world',
                baseLayer: {
                    backgroundColor: 'rgba(0, 0, 0, 0.3)'
                },
                itemStyle: {
                    normal: {
                        areaStyle: {
                            color: '#396696' 
                        }
                    }
                },
                data: [{}],
                mapLocation: {
                    width: '80%'
                }
            }, {
                name: 'gdp',
                type: 'bar',
                data: [1400532, 2898133, 11027922, 22000729, 32346738, 63508421, 70441599, 71918394],
                itemStyle: {
                    normal: {
                        color: '#396696'
                    }
                }
            }]
        });

        var currentName = null;
        myChart.on(ecConfig.EVENT.CLICK, function (param) {
            if (data.data[param.name] && param.name !== currentName) {
                currentName = param.name;
                myChart.setOption({
                    title: {
                        text: currentName + ' GDP'
                    },
                    series: [{
                        name: 'Globe',
                        type: 'map3d'
                    }, {
                        name: 'gdp',
                        type: 'bar',
                        data: data.data[param.name]
                    }]
                });
            } 
        });
    }
});