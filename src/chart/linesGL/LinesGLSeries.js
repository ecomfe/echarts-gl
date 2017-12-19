import echarts from 'echarts/lib/echarts';

var LinesSeries = echarts.extendSeriesModel({

    type: 'series.linesGL',

    dependencies: ['grid', 'geo'],

    visualColorAccessPath: 'lineStyle.color',

    streamEnabled: true,

    init: function (option) {
        this._processFlatCoordsArray(option);

        LinesSeries.superApply(this, 'init', arguments);
    },

    mergeOption: function (option) {
        this._processFlatCoordsArray(option);

        LinesSeries.superApply(this, 'mergeOption', arguments);
    },

    _getCoordsFromItemModel: function (idx) {
        var itemModel = this.getData().getItemModel(idx);
        var coords = (itemModel.option instanceof Array)
            ? itemModel.option : itemModel.getShallow('coords');

        if (__DEV__) {
            if (!(coords instanceof Array && coords.length > 0 && coords[0] instanceof Array)) {
                throw new Error('Invalid coords ' + JSON.stringify(coords) + '. Lines must have 2d coords array in data item.');
            }
        }
        return coords;
    },

    getLineCoordsCount: function (idx) {
        if (this._flatCoordsOffset) {
            return this._flatCoordsOffset[idx * 2 + 1];
        }
        else {
            return this._getCoordsFromItemModel(idx).length;
        }
    },

    getLineCoords: function (idx, out) {
        if (this._flatCoordsOffset) {
            var offset = this._flatCoordsOffset[idx * 2];
            var len = this._flatCoordsOffset[idx * 2 + 1];
            for (var i = 0; i < len; i++) {
                out[i] = out[i] || [];
                out[i][0] = this._flatCoords[offset + i * 2];
                out[i][1] = this._flatCoords[offset + i * 2 + 1];
            }
            return len;
        }
        else {
            var coords = this._getCoordsFromItemModel(idx);
            for (var i = 0; i < coords.length; i++) {
                out[i] = out[i] || [];
                out[i][0] = coords[i][0];
                out[i][1] = coords[i][1];
            }
            return coords.length;
        }
    },

    _processFlatCoordsArray: function (option) {
        var data = option.data;
        // Stored as a typed array. In format
        // Points Count(2) | x | y | x | y | Points Count(3) | x |  y | x | y | x | y |
        if (typeof data[0] === 'number') {
            var len = data.length;
            // Store offset and len of each segment
            var coordsOffsetAndLenStorage = new Uint32Array(len);
            var coordsStorage = new Float64Array(len);
            var coordsCursor = 0;
            var offsetCursor = 0;
            var dataCount = 0;
            for (var i = 0; i < len;) {
                dataCount++;
                var count = data[i++];
                // Offset
                coordsOffsetAndLenStorage[offsetCursor++] = coordsCursor;
                // Len
                coordsOffsetAndLenStorage[offsetCursor++] = count;
                for (var k = 0; k < count; k++) {
                    var x = data[i++];
                    var y = data[i++];
                    coordsStorage[coordsCursor++] = x;
                    coordsStorage[coordsCursor++] = y;

                    if (i > len) {
                        if (__DEV__) {
                            throw new Error('Invalid data format.');
                        }
                    }
                }
            }

            this._flatCoordsOffset = coordsOffsetAndLenStorage;
            this._flatCoords = coordsStorage;

            // Fill with zero values.
            option.data = new Float32Array(dataCount);
        }
        else {
            this._flatCoordsOffset = this._flatCoords = null;
        }
    },

    getInitialData: function (option, ecModel) {
        var lineData = new echarts.List(['value'], this);
        lineData.hasItemOption = false;

        lineData.initData(option.data, [], function (dataItem, dimName, dataIndex, dimIndex) {
            // dataItem is simply coords
            if (dataItem instanceof Array) {
                return NaN;
            }
            else {
                lineData.hasItemOption = true;
                var value = dataItem.value;
                if (value != null) {
                    return value instanceof Array ? value[dimIndex] : value;
                }
            }
        });

        return lineData;
    },

    defaultOption: {
        coordinateSystem: 'geo',
        zlevel: 10,

        // Cartesian coordinate system
        // xAxisIndex: 0,
        // yAxisIndex: 0,

        // Geo coordinate system
        // geoIndex: 0,

        // Support source-over, lighter
        blendMode: 'source-over',

        lineStyle: {
            opacity: 0.8
        }
    }
});