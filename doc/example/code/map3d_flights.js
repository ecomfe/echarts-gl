
myChart.showLoading();

$.ajax({
    url: './data/flights.json',
    success: function (data) {
        var markPointStyle = {
            normal: {
                color: 'red'
            }
        }
        // Airport: [name, city, country, longitude, latitude]
        var airports = data.airports.map(function (item) {
            return {
                itemStyle: markPointStyle,
                geoCoord: [item[3], item[4]]
            }
        });

        // Route: [airlineIndex, sourceAirportIndex, destinationAirportIndex]
        var routesGroupByAirline = {};
        data.routes.forEach(function (route) {
            var airline = data.airlines[route[0]];
            var airlineName = airline[0];
            if (!routesGroupByAirline[airlineName]) {
                routesGroupByAirline[airlineName] = [];
            }
            routesGroupByAirline[airlineName].push(route);
        })

        var opts = {
            title: {
                text: 'World Flights',
                subtext: 'Data from openflights.org',
                sublink: 'http://openflights.org/data.html',
                x:'center',
                y:'top',
                textStyle: {
                    color: 'white'
                }
            },
            legend: {
                show: true,
                data: data.airlines.map(function (item) {
                    // Airline name
                    return item[0];
                }),
                selected: {},
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
                mapType: 'world',
                baseLayer: {
                    backgroundColor: '',
                    backgroundImage: 'asset/earth.jpg'
                },
                itemStyle: {
                    normal: {
                        borderWidth: 1,
                        borderColor: 'yellow',
                        areaStyle: {
                            color: 'rgba(0, 0, 0, 0)'
                        }
                    }
                },
                markPoint: {
                    effect: {
                        shadowBlur: 0.2
                    },
                    large: true,
                    symbolSize: 3,
                    data: airports
                }
            }]
        };

        opts.legend.data.forEach(function (name) {
            if (name.indexOf('American Airlines') >= 0) {
                opts.legend.selected[name] = true;
            } else {
                opts.legend.selected[name] = false;
            }
        });

        data.airlines.forEach(function (item) {
            var airlineName = item[0];
            var routes = routesGroupByAirline[airlineName];
            if (routes) {
                opts.series.push({
                    type: 'map3d',
                    name: airlineName,
                    markLine: {
                        effect: {
                            show: true
                        },
                        data: routes.map(function (item) {
                            return [{
                                // Source airport
                                geoCoord: airports[item[1]].geoCoord
                            }, {
                                // Destination Airport
                                geoCoord: airports[item[2]].geoCoord
                            }]
                        })
                    }
                });
            }
        });

        myChart.setOption(opts);

        myChart.hideLoading();
    }
});