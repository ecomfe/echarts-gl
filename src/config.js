define({

    CHART_TYPE_MAP3D: 'map3d',

    map3d: {
        zlevel: 0,

        // Base map configuration
        mapType: 'world',
        // Base map background color
        mapBackgroundColor: 'black',
        // Base map background image
        mapBackgroundImage: '',

        // Base map texture resolution
        // 'low': 1024x1024
        // 'medium': 2048x2048
        // 'high': 4096x4096
        // 
        // Or directly give the size like 512
        mapQuality: 'medium',

        // {
        //     name: 'cloud',
        //     type: 'texture|particle',
        //     // Distance to the ground surface
        //     distance: 3,
        //     // Only if type is texture
        //     image: 'cloud.png',
        //     // Surface texture size
        //     size: [2048, 1024],
        //     // Only if type is particle
        //     particle: {
        //         // Can be 3D Data matrix Or image
        //         // Which row is longitude, range [-180, 180].
        //         // Column is lattitude range [-90, 90].
        //         // Value range [-1, 1]
        //         vectorField: [],
        //         color: '#fff',
        //         // Particle size scaling
        //         // Basicly it ranges from 0 to 1
        //         sizeScaling: 5,
        //         // Particle speed scaling
        //         // Basicly it ranges from [-1, -1] to [1, 1]
        //         speedScaling: 1,
        //         // Particle number
        //         number: 256 * 256,
        //         // Motion blur factor
        //         motionBlurFactor: 0.99
        //     }
        // }
        surfaceLayers: [],

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
        // Distance to the surface
        distance: 1,
        itemStyle: {
            normal: {
                // color: '#000'
            }
        }
    },

    markPoint: {
        symbolSize: 4,
        // Distance to the surface
        distance: 1,
        // Marker orientation in 3D space. Only available when large is false.
        // Value can be 'normal', 'tangent', 'eye'.
        orientation: 'tangent',
        itemStyle: {
            normal: {
                borderWidth: 1,
                borderColor: '#000',
                label: {
                    show: true,
                    // Text poisition of ECharts-X can only be 'inside'
                    position: 'inside',
                    textStyle: {
                        color: 'black'
                    }
                }
            }
        }
    },

    markLine: {
        // Distance to the surface
        distance: 1,
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