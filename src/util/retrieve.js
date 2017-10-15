import echarts from 'echarts/lib/echarts';

var retrieve = {

    firstNotNull: function () {
        for (var i = 0, len = arguments.length; i < len; i++) {
            if (arguments[i] != null) {
                return arguments[i];
            }
        }
    },

    /**
     * @param {module:echarts/data/List} data
     * @param {Object} payload Contains dataIndex (means rawIndex) / dataIndexInside / name
     *                         each of which can be Array or primary type.
     * @return {number|Array.<number>} dataIndex If not found, return undefined/null.
     */
    queryDataIndex: function (data, payload) {
        if (payload.dataIndexInside != null) {
            return payload.dataIndexInside;
        }
        else if (payload.dataIndex != null) {
            return echarts.util.isArray(payload.dataIndex)
                ? echarts.util.map(payload.dataIndex, function (value) {
                    return data.indexOfRawIndex(value);
                })
                : data.indexOfRawIndex(payload.dataIndex);
        }
        else if (payload.name != null) {
            return echarts.util.isArray(payload.name)
                ? echarts.util.map(payload.name, function (value) {
                    return data.indexOfName(value);
                })
                : data.indexOfName(payload.name);
        }
    }
};

export default retrieve;