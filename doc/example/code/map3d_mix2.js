var echarts = require('echarts');
var ecConfig = require('echarts/config');
var mapParams = require('echarts/util/mapData/params').params;

myChart.setOption({
    title: {
        text: 'World GDP',
        x: 'center',
        textStyle: {
            color: 'white'
        }
    },
    series: [{
        name: 'Map 3D',
        type: 'map3d',
        mapType: 'world',
        data: [{}]
    }]
});

$.ajax({
    url: 'data/gdp.json',
    success: function (data) {

        $('#chart').css({
            width: '50%'
        });
        myChart.resize();

        var $chart2 = $('<div></div>').css({
            width: '50%',
            position: 'absolute',
            right: "0px",
            top: '0px',
            bottom: '0px'
        }).appendTo($('#main'));

        var barChart = echarts.init($chart2[0]);
        barChart.setOption({
            title: {
                text: 'GDP',
                x: 'center',
                textStyle: {
                    color: 'white'
                }
            },
            tooltip: {
                trigger: 'axis'
            },
            xAxis: {
                type: 'category',
                data: data.years.map(function (year) { return year + '年'; }),
                axisLabel: {
                    textStyle: {
                        color: 'white'
                    }
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    textStyle: {
                        color: 'white'
                    }
                }
            },
            series: [{
                name: 'gdp',
                type: 'bar',
                data: [1400532, 2898133, 11027922, 22000729, 32346738, 63508421, 70441599, 71918394]
            }]
        });

        var currentName = null;
        myChart.on(ecConfig.EVENT.CLICK, function (param) {
            if (data.data[param.name] && param.name !== currentName) {
                currentName = param.name;
                barChart.setOption({
                    title: {
                        text: currentName + ' GDP'
                    },
                    grid: {
                        show: false
                    },
                    series: [{
                        name: 'gdp',
                        type: 'bar',
                        data: data.data[param.name]
                    }]
                });
            } 
        });
    }
});
