myChart.setOption({
    title: {
        text: 'The 25 Most Popular Tourist Attractions In The World',
        subtext: 'From businessinsider',
        sublink: 'http://www.businessinsider.com/worlds-best-attractions-2013-6?op=1',
        x: 'center',
        y: 'top',
        textStyle: {
            color: 'white'
        }
    },
    tooltip: {
        formatter: '{b}'
    },
    legend: {
        x: 'left',
        data: ['placemarks'],
        textStyle: {
            color: 'white'
        }
    },
    series: [{
        name: 'placemarks',
        type: 'map3d',
        mapType: 'world',
        baseLayer: {
            backgroundColor: '',
            backgroundImage: 'asset/earth.jpg',
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
        markPoint: {
            symbol: 'image://./asset/pin.png',
            symbolSize: 3,
            distance: 0,
            // orientation: 'normal',
            orientationAngle: 45,
            itemStyle: {
                normal: {
                    label: {
                        show: false,
                        formatter: '{b}',
                        textStyle: {
                            fontSize: 12,
                            color: 'white'
                        }
                    }
                }
            },
            data: [{
                name: '#1 Machu Picchu, Machu Picchu, Peru',
                geoCoord: [-72.544963, -13.163141]
            }, {
                name: '#2 Angkor Wat, Siem Reap, Cambodia',
                geoCoord: [103.866986, 13.412469]
            }, {
                name: '#3 Taj Mahal, Agra, India',
                geoCoord: [78.042155, 27.175015]
            }, {
                name: '#4 Petra World Heritage Site, Wadi Musa, Jordan',
                geoCoord: [35.4428063, 30.3251545]
            }, {
                name: '#5 Bayon Temple, Siem Reap, Cambodia',
                geoCoord: [103.8616785, 13.4399061]
            }, {
                name: '#6 Great Cathedral and Mosque, Cordoba, Spain',
                geoCoord: [-4.779387, 37.878906]
            }, {
                name: '#7 Church of Our Savior on Spilled Blood, St. Petersburg, Russia',
                geoCoord: [30.3289, 59.9401]
            }, {
                name: '#8 St. Peter’s Basilica, Vatican City, Italy',
                geoCoord: [12.453937, 41.902167]
            }, {
                name: '#9 Ancient City Walls, Dubrovnik, Croatia',
                geoCoord: [18.1064995, 42.642481]
            }, {
                name: '#10 Main Market Square (Rynek Glowny), Krakow, Poland',
                geoCoord: [19.936756, 50.061897]
            }, {
                name: '#11 Temple of Karnak, Luxor, Egypt',
                geoCoord: [32.65727, 25.718835]
            }, {
                name: '#12 Bellagio Fountains, Las Vegas, Nevada',
                geoCoord: [-115.174232, 36.112947]
            }, {
                name: '#13 Sheikh Zayed Grand Mosque, Abu Dhabi, United Arab Emirates',
                geoCoord: [54.474779, 24.413679]
            }, {
                name: '#14 Alcazar, Seville, Spain',
                geoCoord: [-3.2225188, 39.3947303]
            }, {
                name: '#15 Gettysburg National Military Park, Gettysburg, Pennsylvania',
                geoCoord: [-77.2379262, 39.8154696]
            }, {
                name: '#16 The Alhambra, Granada, Spain',
                geoCoord: [-3.588141, 37.176078]
            }, {
                name: '#17 Great Wall at Mutianyu, Beijing, China',
                geoCoord: [116.5604055, 40.430837]
            }, {
                name: '#18 Shwedagon Pagoda, Yangon (Rangoon), Myanmar',
                geoCoord: [96.149198, 16.798313]
            }, {
                name: '#19 USS Arizona Memorial, Honolulu, Hawaii',
                geoCoord: [-157.9519192, 21.364834]
            }, {
                name: '#20 Cristo Redentor (Statue of Christ the Redeemer), Rio de Janeiro, Brazil',
                geoCoord: [-43.372762, -22.9361413]
            }, {
                name: '#21 Top of the Rock Observation Deck, New York City, New York',
                geoCoord: [-73.9822225, 40.7560311]
            }, {
                name: '#22 Cathedral of Santiago de Compostela, Santiago de Compostela, Spain',
                geoCoord: [-8.544641, 42.880596]
            }, {
                name: '#23 Golden Gate Bridge, San Francisco, California',
                geoCoord: [-122.478255, 37.819929]
            }, {
                name: '#24 Cathedral of St. John the Baptist, Savannah, Georgia',
                geoCoord: [-81.091277, 32.073383]
            }, {
                name: '#25 Siena Cathedral, Siena, Italy',
                geoCoord: [11.328907, 43.317702]
            }]
        }
    }]
});