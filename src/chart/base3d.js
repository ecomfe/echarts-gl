/**
 * Base class for 3d charts
 * 
 * @module echarts-x/chart/base3d
 * @author Yi Shen(http://github.com/pissang)
 */
define(function (require) {

    'use strict';

    var ecConfig = require('echarts/config');
    var zrUtil = require('zrender/tool/util');

    var ComponentBase3D = require('../component/base3d');

    var colorUtil = require('../util/color');

    var LRUCache = require('qtek/core/LRU');
    var Vector3 = require('qtek/math/Vector3');
    var Matrix4 = require('qtek/math/Matrix4');

    var MarkerCtorMap = {
        markLine: require('../entity/marker/MarkLine'),
        markBar: require('../entity/marker/MarkBar'),
        markPoint: require('../entity/marker/MarkPoint'),
        largeMarkPoint: require('../entity/marker/LargeMarkPoint')
    };

    /**
     * @constructor
     * @alias module:echarts-x/chart/base3d
     * @extends module:echarts-x/component/base3d
     * 
     * @param {Object} ecTheme
     * @param {Object} messageCenter
     * @param {module:zrender~ZRender} zr
     * @param {Object} option
     * @param {module:echarts~ECharts} myChart
     */
    function Base3D(ecTheme, messageCenter, zr, option, myChart) {

        ComponentBase3D.call(this, ecTheme, messageCenter, zr, option, myChart);

        // Markers
        this._markLineList = [];
        this._markLineCount = 0;

        this._markPointList = [];
        this._markPointCount = 0;

        this._markBarList = [];
        this._markBarCount = 0;

        this._largeMarkPointList = [];
        this._largeMarkPointCount = 0;

        this._markList = [];
    };

    Base3D.prototype = {

        constructor: Base3D,

        /**
         * Call before building mark of each series.
         * Marker construction in ecx is costly. So we use the instance cached in last update as much as possible.
         * Only dynamic data like geometry vertices will be updated every time.
         * Instances which is no longer used will be disposed in the afterBuildMark method
         */
        beforeBuildMark: function () {
            for (var i = 0; i < this._markList.length; i++) {
                this._markList[i].clear();
            }
            this._markList.length = 0;

            this._markBarCount = 0;
            this._markPointCount = 0;
            this._markLineCount = 0;
            this._largeMarkPointCount = 0;
        },

        /**
         * Build marker of each series.
         * @param  {number} seriesIndex
         * @param  {qtek.Node} parentNode
         *         Parent scene node where marker renderable will be mounted
         */
        buildMark: function (seriesIndex, parentNode) {
            var serie = this.series[seriesIndex];

            if (serie.markPoint) {
                zrUtil.merge(
                    zrUtil.merge(
                        serie.markPoint, this.ecTheme.markPoint || {}
                    ),
                    ecConfig.markPoint
                );
                if (serie.markPoint.large) {
                    this._buildSingleTypeMarker(
                        'largeMarkPoint', seriesIndex, parentNode
                    );
                } else {
                    this._buildSingleTypeMarker(
                        'markPoint', seriesIndex, parentNode
                    );
                }
            }
            if (serie.markLine) {
                zrUtil.merge(
                    zrUtil.merge(
                        serie.markLine, this.ecTheme.markLine || {}
                    ),
                    ecConfig.markLine
                );
                this._buildSingleTypeMarker(
                    'markLine', seriesIndex, parentNode
                );
            }
            if (serie.markBar) {
                zrUtil.merge(
                    zrUtil.merge(
                        serie.markBar, this.ecTheme.markBar || {}
                    ),
                    ecConfig.markBar
                );
                this._buildSingleTypeMarker(
                    'markBar', seriesIndex, parentNode
                );
            }
        },

        /**
         * Call after built mark of all series.
         */
        afterBuildMark: function () {
            // TODO Memory leak test
            for (var i = this._markPointCount; i < this._markPointList.length; i++) {
                this._disposeSingleSerieMark(this._markPointList[i]);
            }
            this._markPointList.length = this._markPointCount;
            for (var i = this._largeMarkPointCount; i < this._largeMarkPointList.length; i++) {
                this._disposeSingleSerieMark(this._largeMarkPointList[i]);
            }
            this._largeMarkPointList.length = this._largeMarkPointCount;
            for (var i = this._markLineCount; i < this._markLineList.length; i++) {
                this._disposeSingleSerieMark(this._markLineList[i]);
            }
            this._markLineList.length = this._markLineCount;
            for (var i = this._markBarCount; i < this._markBarList.length; i++) {
                this._disposeSingleSerieMark(this._markBarList[i]);
            }
            this._markBarList.length = this._markBarCount;
        },

        /**
         * Dispose a singler marker
         * @param  {module:echarts-x/entity/marker/Base} marker
         */
        _disposeSingleSerieMark: function (marker) {
            var sceneNode = marker.getSceneNode();
            if (sceneNode.getParent()) {
                sceneNode.getParent().remove(sceneNode);
            }
            marker.dispose();
        },

        /**
         * Build a single marker
         * @param  {string} markerType
         *         Marker type can be 'markPoint', 'largeMarkPoint', 'markLine', 'markBar'
         * @param  {number} seriesIndex
         * @param  {qtek.Node} parentNode
         */
        _buildSingleTypeMarker: function (markerType, seriesIndex, parentNode) {
            var serie = this.series[seriesIndex];
            var list = this['_' + markerType + 'List'];
            var count = this['_' + markerType + 'Count'];
            var MarkerCtor = MarkerCtorMap[markerType];
            if (! list || ! MarkerCtor) {
                // Invalid marker type
                return;
            }
            // Using the cached markpoint instance if possible
            if (! list[count]) {
                list[count] = new MarkerCtor(this);
            }
            var marker = list[count];
            marker.setSeries(serie, seriesIndex);
            var sceneNode = marker.getSceneNode();
            if (sceneNode.getParent() !== parentNode) {
                parentNode.add(sceneNode);
            }

            this['_' + markerType + 'Count']++;

            this._markList.push(marker);
        },

        /**
         * Parse a color string and return an array that can be used in shader uniform
         * @param {string} colorStr
         * @return {Array.<number>}
         */
        parseColor: function (colorStr) {
            if (!colorStr) {
                return null;
            }
            if (colorStr instanceof Array) {
                return colorStr;
            }

            if (!this._colorCache) {
                this._colorCache = new LRUCache(10);
            }
            var colorArr = this._colorCache.get(colorStr);
            if (!colorArr) {
                colorArr = colorUtil.parse(colorStr);
                this._colorCache.put(colorStr, colorArr);
                colorArr[0] /= 255;
                colorArr[1] /= 255;
                colorArr[2] /= 255;
            }
            return colorArr;
        },

        /**
         * Map a mark coord to 3D cartesian coordinates vector.
         * Default it is a simply copy. Each chart can overwrite it and implement its own 
         * Mapping algorithm
         * @param  {number} seriesIndex
         * @param  {Object} data Given marker data
         * @param  {qtek.math.Vector3} point Output 3d vector
         */
        getMarkCoord: function (seriesIndex, data, point) {
            point._array[0] = data.x;
            point._array[1] = data.y;
            point._array[2] = data.z;
        },

        /**
         * Calculate mark point transform according to its orientation
         * Each chart can overwrite it and implement its own algorithm
         * @param  {number} seriesIndex
         * @param  {Object} data Given marker data
         * @param  {qtek.math.Matrix4} matrix
         */
        getMarkPointTransform: function (seriesIndex, data, matrix) {
            Matrix4.identity(matrix);
            var position = new Vector3();
            this.getMarkCoord(seriesIndex, data, position);
            // Simply set the position
            var arr = matrix._array;
            arr[12] = position.x;
            arr[13] = position.y;
            arr[14] = position.z;
        },

        /**
         * Calculate the bar start and end point in 3d cartesian coordinates from a given barHeight parameter
         * Each chart can overwrite it and implement its own algorithm
         * @param  {number} seriesIndex
         * @param  {Object} data Given marker data
         * @param  {qtek.math.Vector3} start Output start 3d vector
         * @param  {qtek.math.Vector3} end Output end 3d vector
         */
        getMarkBarPoints: function (seriesIndex, data, start, end) {
            var barHeight = data.barHeight != null ? data.barHeight : 1;
            if (typeof(barHeight) == 'function') {
                barHeight = barHeight(data);
            }
            this.getMarkCoord(seriesIndex, data, start);
            Vector3.scaleAndAdd(end, end, start, 1);
        },

        /**
         * Calculate line points.
         * It is a straight line if p2 and p3 is not given. Else it is a cubic curve
         * Each chart can overwrite it and implement its own algorithm
         * @param  {number} seriesIndex
         * @param  {Object} data
         * @param  {qtek.math.Vector3} p0
         * @param  {qtek.math.Vector3} p1
         * @param  {qtek.math.Vector3} [p2]
         * @param  {qtek.math.Vector3} [p3]
         */
        getMarkLinePoints: function (seriesIndex, data, p0, p1, p2, p3) {
            var isCurve = !!p2;
            if (!isCurve) { // Mark line is not a curve
                p3 = p1;
            }
            this.getMarkCoord(seriesIndex, data[0], p0);
            this.getMarkCoord(seriesIndex, data[1], p3);
            if (isCurve) {
                Vector3.copy(p1, p0);
                Vector3.copy(p2, p3);
            }
        },

        /**
         * Get label text based with formatter
         * Code from echarts
         * @param {Object} serie
         * @param {Object} data
         * @param {string} name
         * @param {string} status Can be 'normal' or 'emphasis'
         */
        getSerieLabelText: function (serie, data, name, status) {
            var formatter = this.deepQuery(
                [data, serie],
                'itemStyle.' + status + '.label.formatter'
            );
            if (!formatter && status === 'emphasis') {
                // emphasis时需要看看normal下是否有formatter
                formatter = this.deepQuery(
                    [data, serie],
                    'itemStyle.normal.label.formatter'
                );
            }
            
            var value = this.getDataFromOption(data, '-');
            
            if (formatter) {
                if (typeof formatter === 'function') {
                    return formatter.call(
                        this.myChart,
                        {
                            seriesName: serie.name,
                            series: serie,
                            name: name,
                            value: value,
                            data: data,
                            status: status
                        }
                    );
                }
                else if (typeof formatter === 'string') {
                    formatter = formatter.replace('{a}','{a0}')
                                         .replace('{b}','{b0}')
                                         .replace('{c}','{c0}')
                                         .replace('{a0}', serie.name)
                                         .replace('{b0}', name)
                                         .replace('{c0}', this.numAddCommas(value));
    
                    return formatter;
                }
            }
            else {
                if (value instanceof Array) {
                    return value[2] != null
                           ? this.numAddCommas(value[2])
                           : (value[0] + ' , ' + value[1]);
                }
                else {
                    return this.numAddCommas(value);
                }
            }
        },

        // Overwrite onlegendSelected
        onlegendSelected: function (param, status) {
            var legendSelected = param.selected;
            for (var itemName in this.selectedMap) {
                if (this.selectedMap[itemName] != legendSelected[itemName]) {
                    status.needRefresh = true;
                }
                this.selectedMap[itemName] = legendSelected[itemName];
            }
            return;
        },

        // Overwrite dispose
        dispose: function () {
            ComponentBase3D.prototype.dispose.call(this);

            // Dispose all the markers
            for (var i = 0; i < this._markList.length; i++) {
                this._disposeSingleSerieMark(this._markList[i]);
            }
        },

        // Overwrite onframe
        onframe: function (deltaTime) {
            for (var i = 0; i < this._markList.length; i++) {
                this._markList[i].onframe(deltaTime);
            }
        }
    }

    zrUtil.inherits(Base3D, ComponentBase3D);

    return Base3D;
});