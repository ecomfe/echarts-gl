define(function (require) {
    
    var zrUtil = require('zrender/tool/util');
    var MarkBase = require('./Base');
    var Mesh = require('qtek/Mesh');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var BarsGeometry = require('../../util/geometry/Bars');
    var Vector3 = require('qtek/math/Vector3');

    var MarkBar = function (chart) {
        MarkBase.call(this, chart);

        this._markBarMesh = null;
    };

    MarkBar.prototype = {
        
        constructor: MarkBar,

        _createMarkBarMesh: function () {
            var material = new Material({
                shader: new Shader({
                    vertex: Shader.source('ecx.albedo.vertex'),
                    fragment: Shader.source('ecx.albedo.fragment')
                })
            });
            material.shader.define('both', 'VERTEX_COLOR');
            this._markBarMesh = new Mesh({
                geometry: new BarsGeometry(),
                material: material,
                ignorePicking: true
            });
        },

        setSerie: function (serie, seriesIndex) {
            if (! serie.markBar || ! serie.markBar.data) {
                return;
            }

            var chart = this.chart;
            var component = chart.component;
            var legend = component.legend;
            var dataRange = component.dataRange;

            if (! this._markBarMesh) {
                this._createMarkBarMesh();
            }

            var dataList = serie.markBar.data;
            var geometry = this._markBarMesh.geometry;

            var serieColor;
            if (legend) {
                serieColor = legend.getColor(serie.name);
            }
            serieColor = chart.query(serie.markBar, 'itemStyle.normal.color') || serieColor;
            var serieDefaultColor = chart.zr.getColor(seriesIndex);

            var start = new Vector3();
            var end = new Vector3();
            var normal = new Vector3();

            var globalBarSize = serie.markBar.barSize;
            for (var i = 0; i < dataList.length; i++) {
                var dataItem = dataList[i];
                var value = chart.getDataFromOption(dataItem, null);
                var dataRangeColor = null;
                if (dataRange) {
                    dataRangeColor = isNaN(value) ? color : dataRange.getColor(value);
                    // Hide the mark if dataRange is enabled and return null from the given value
                    if (dataRangeColor == null) {
                        continue;
                    }
                }
                var itemColor = chart.query(dataItem, 'itemStyle.normal.color');

                // 0. Use the color of itemStyle in single data
                // 2. Color in user customized itemStyle
                // 1. Use the color provided by data range component
                // 3. Use the color provided by legend component
                // 4. Use series default color
                var color = itemColor || dataRangeColor || serieColor || serieDefaultColor;
                if (typeof(color) == 'function') {
                    color = color(dataItem);
                }
                var colorArr = chart.parseColor(color) || new Float32Array();

                var barSize = dataItem.barSize != null ? dataItem.barSize : globalBarSize;
                if (typeof(barSize) == 'function') {
                    barSize = barSize(dataItem);
                }

                chart.getMarkBarPoints(seriesIndex, dataItem, start, end);
                this._markBarMesh.geometry.addBar(start, end, barSize, colorArr);
            }

            this._markBarMesh.geometry.dirty();
        },

        getSceneNode: function () {
            return this._markBarMesh;
        },

        clear: function () {
            if (this._markBarMesh) {
                this._markBarMesh.geometry.clearBars();
            }
        },

        onframe: function (deltaTime) {}
    };

    zrUtil.inherits(MarkBar, MarkBase);

    return MarkBar;
});