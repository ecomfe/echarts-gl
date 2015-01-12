define({

    CHART_TYPE_MAP3D: 'map3d',

    map3d: {
        zlevel: 0,

        // TODO
        mapType: 'world',
        mapBackgroundColor: 'black',
        mapBackgroundImage: '',

        mapGridColor: '#17192e',

        itemStyle: {
            normal: {
                label: {
                    show: false,
                    textStyle: {
                        color: 'black'
                    }
                },
                borderColor: 'black',
                borderWidth: 1,
                areaStyle: {
                    color: '#17192e',
                    opacity: 1
                }
            },
            emphasis: {
                borderColor: 'black',
                borderWidth: 1,
                areaStyle: {
                    color: 'rgba(255,215,0,0.5)'
                }
            }
        },

        autoRotate: true
    },

    markBar: {
        barSize: 1,
        itemStyle: {
            normal: {
                // color: '#000'
            }
        }
    },

    markPoint: {
        symbolSize: 4
    },

    markLine: {
        itemStyle: {
            normal: {
                lineStyle: {
                    width: 1,
                    opacity: 0.2
                }
            }
        }
    },

    // Overwrite the config
    title: {
        zlevel: 1
    },
    legend: {
        zlevel: 1
    },
    dataRange: {
        zlevel: 1
    },
    toolbox: {
        zlevel: 1
    },
    tooltip: {
        zlevel: 2
    },
    dataZoom: {
        zlevel: 1
    },
    grid: {
        zlevel: 1
    },
    categoryAxis: {
        zlevel: 1
    },
    valueAxis: {
        zlevel: 1
    },
    polar: {
        zlevel: 1
    },
    timeline: {
        zlevel: 1
    },
    roamController: {
        zlevel: 1
    },
    bar: {
        zlevel: 1
    },
    line: {
        zlevel: 1
    },
    k: {
        zlevel: 1
    },
    scatter: {
        zlevel: 1
    },
    radar: {
        zlevel: 1
    },
    pie: {
        zlevel: 1
    },
    map: {
        zlevel: 1
    },
    force: {
        zlevel: 1
    },
    chord: {
        zlevel: 1
    },
    gauge: {
        zlevel: 1
    },
    funnel: {
        zlevel: 1
    },
    eventRiver: {
        zlevel: 1
    },
    island: {
        zlevel: 1
    }
});