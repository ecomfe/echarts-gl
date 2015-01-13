define(function (require) {

    var zrUtil = require('zrender/tool/util');

    var ComponentBase = require('echarts/component/base');
    var ComponentBase3D = require('../component/base3d');

    var colorUtil = require('../util/color');

    var MarkBar = require('../entity/marker/MarkBar');
    var MarkLine = require('../entity/marker/MarkLine');
    var LargeMarkPoint = require('../entity/marker/LargeMarkPoint');

    var Mesh = require('qtek/Mesh');
    var Material = require('qtek/Material');
    var Shader = require('qtek/Shader');
    var LRUCache = require('qtek/core/LRU');
    var Vector3 = require('qtek/math/Vector3');

    var vec3 = require('qtek/dep/glmatrix').vec3;
    var vec4 = require('qtek/dep/glmatrix').vec4;

    function Base3D(ecTheme, messageCenter, zr, option, myChart) {

        ComponentBase.call(this, ecTheme, messageCenter, zr, option, myChart);

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

        buildMark: function (seriesIndex, parentNode) {
            var serie = this.series[seriesIndex];

            if (serie.markPoint) {
                zrUtil.merge(serie.markPoint, this.ecTheme.markPoint);
                this._buildMarkSingleType(
                    'markPoint', LargeMarkPoint, seriesIndex, parentNode
                );
            }
            if (serie.markLine) {
                zrUtil.merge(serie.markLine, this.ecTheme.markLine);
                this._buildMarkSingleType(
                    'markLine', MarkLine, seriesIndex, parentNode
                );
            }
            if (serie.markBar) {
                zrUtil.merge(serie.markBar, this.ecTheme.markBar);
                this._buildMarkSingleType(
                    'markBar', MarkBar, seriesIndex, parentNode
                );
            }
        },

        // TODO Memory leak test
        afterBuildMark: function () {
            for (var i = this._markPointCount; i < this._markPointList.length; i++) {
                this._disposeSingleMark(this._markPointList[i]);
            }
            this._markPointList.length = this._markPointCount;
            for (var i = this._largeMarkPointCount; i < this._largeMarkPointList.length; i++) {
                this._disposeSingleMark(this._largeMarkPointList[i]);
            }
            this._largeMarkPointList.length = this._largeMarkPointCount;
            for (var i = this._markLineCount; i < this._markLineList.length; i++) {
                this._disposeSingleMark(this._markLineList[i]);
            }
            this._markLineList.length = this._markLineCount;
            for (var i = this._markBarCount; i < this._markBarList.length; i++) {
                this._disposeSingleMark(this._markBarList[i]);
            }
            this._markBarList.length = this._markBarCount;
        },

        _disposeSingleMark: function (marker) {
            var sceneNode = marker.getSceneNode();
            if (sceneNode.getParent()) {
                sceneNode.getParent().remove(sceneNode);
            }
            marker.dispose();
        },

        _buildMarkSingleType: function (markerType, MarkerCtor, seriesIndex, parentNode) {
            var serie = this.series[seriesIndex];
            var list = this['_' + markerType + 'List'];
            var count = this['_' + markerType + 'Count'];
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

        getMarkCoord: function (seriesIndex, data, point) {
            out._array[0] = data.x;
            out._array[1] = data.y;
            out._array[2] = data.z;
        },

        getMarkBarPoints: function (seriesIndex, data, start, end) {
            var barHeight = data.barHeight != null ? data.barHeight : 1;
            if (typeof(barHeight) == 'function') {
                barHeight = barHeight(data);
            }
            this.getMarkCoord(seriesIndex, data, start);
            Vector3.scaleAndAdd(end, end, start, 1);
        },

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
         * 图例选择
         */
        onlegendSelected: function (param, status) {
            var legendSelected = param.selected;
            for (var itemName in this.selectedMap) {
                if (this.selectedMap[itemName] != legendSelected[itemName]) {
                    // 有一项不一致都需要重绘
                    status.needRefresh = true;
                }
                this.selectedMap[itemName] = legendSelected[itemName];
            }
            return;
        },

        onframe: function (deltaTime) {
            for (var i = 0; i < this._markList.length; i++) {
                this._markList[i].onframe(deltaTime);
            }
        }
    }

    zrUtil.inherits(Base3D, ComponentBase);
    zrUtil.inherits(Base3D, ComponentBase3D);

    return Base3D;
});