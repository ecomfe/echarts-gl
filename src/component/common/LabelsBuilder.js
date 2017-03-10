var echarts = require('echarts/lib/echarts');
var ZRTextureAtlasSurface = require('../../util/ZRTextureAtlasSurface');
var LabelsMesh = require('../../util/mesh/LabelsMesh');

var LABEL_NORMAL_SHOW_BIT = 1;
var LABEL_EMPHASIS_SHOW_BIT = 2;

function LabelsBuilder(width, height, api) {

    this._labelsMesh = new LabelsMesh();

    this._labelTextureSurface = new ZRTextureAtlasSurface({
        width: 512,
        height: 512,
        devicePixelRatio: api.getDevicePixelRatio(),
        onupdate: function () {
            api.getZr().refresh();
        }
    });
    this._api = api;

    this._labelsMesh.material.set('textureAtlas', this._labelTextureSurface.getTexture());
}

LabelsBuilder.prototype.getLabelPosition = function (dataIndex, positionDesc, distance) {
    return [0, 0, 0];
};

LabelsBuilder.prototype.getLabelOffset = function (dataIndex, positionDesc, distance) {
    return [0, 0]
};

LabelsBuilder.prototype.getMesh = function () {
    return this._labelsMesh;
};

LabelsBuilder.prototype.updateData = function (data) {

    if (!this._labelsVisibilitiesBits || this._labelsVisibilitiesBits.length !== data.count()) {
        this._labelsVisibilitiesBits = new Uint8Array(data.count());
    }
    var normalLabelVisibilityQuery = ['label', 'show'];
    var emphasisLabelVisibilityQuery = ['emphasis', 'label', 'show'];

    data.each(function (idx) {
        var itemModel = data.getItemModel(idx);
        var normalVisibility = itemModel.get(normalLabelVisibilityQuery);
        var emphasisVisibility = itemModel.get(emphasisLabelVisibilityQuery);
        if (emphasisVisibility == null) {
            emphasisVisibility = normalVisibility;
        }
        var bit = (normalVisibility ? LABEL_NORMAL_SHOW_BIT : 0)
            | (emphasisVisibility ? LABEL_EMPHASIS_SHOW_BIT : 0);
        this._labelsVisibilitiesBits[idx] = bit;
    }, false, this);

    this._data = data;
};

LabelsBuilder.prototype.updateLabels = function (highlightDataIndices) {

    if (!this._data) {
        return;
    }

    highlightDataIndices = highlightDataIndices || [];

    var hasHighlightData = highlightDataIndices.length > 0;
    var highlightDataIndicesMap = {};
    for (var i = 0; i < highlightDataIndices.length; i++) {
        highlightDataIndicesMap[highlightDataIndices[i]] = true;
    }

    this._labelsMesh.geometry.convertToDynamicArray(true);
    this._labelTextureSurface.clear();

    var normalLabelQuery = ['label'];
    var emphasisLabelQuery = ['emphasis', 'label'];
    var seriesModel = this._data.hostModel;
    var data = this._data;

    var seriesLabelModel = seriesModel.getModel(normalLabelQuery);
    var seriesLabelEmphasisModel = seriesModel.getModel(emphasisLabelQuery, seriesLabelModel);

    var textAlignMap = {
        left: 'right',
        right: 'left',
        top: 'center',
        bottom: 'center'
    };
    var textVerticalAlignMap = {
        left: 'middle',
        right: 'middle',
        top: 'bottom',
        bottom: 'top'
    };

    data.each(function (dataIndex) {
        var isEmphasis = false;
        if (hasHighlightData && highlightDataIndicesMap[dataIndex]) {
            isEmphasis = true;
        }
        var ifShow = this._labelsVisibilitiesBits[dataIndex]
            & (isEmphasis ? LABEL_EMPHASIS_SHOW_BIT : LABEL_NORMAL_SHOW_BIT);
        if (!ifShow) {
            return;
        }

        var itemModel = data.getItemModel(dataIndex);
        var labelModel = itemModel.getModel(
            isEmphasis ? emphasisLabelQuery : normalLabelQuery,
            isEmphasis ? seriesLabelEmphasisModel : seriesLabelModel
        );
        var distance = labelModel.get('distance') || 0;
        var position = labelModel.get('position');
        var textStyleModel = labelModel.getModel('textStyle');

        var dpr = this._api.getDevicePixelRatio();
        var text = seriesModel.getFormattedLabel(dataIndex, isEmphasis ? 'emphasis' : 'normal');
        var textEl = new echarts.graphic.Text({
            style: {
                text: text,
                font: textStyleModel.getFont(),
                fill: textStyleModel.get('color') || data.getItemVisual(dataIndex, 'color') || '#000',
                opacity: textStyleModel.get('opacity'),
                stroke: textStyleModel.get('borderColor'),
                lineWidth: textStyleModel.get('borderWidth') * 2,
                textAlign: 'left',
                textVerticalAlign: 'top'
            }
        });
        var rect = textEl.getBoundingRect();

        var coords = this._labelTextureSurface.add(textEl);

        var textAlign = textAlignMap[position] || 'center';
        var textVerticalAlign = textVerticalAlignMap[position] || 'bottom';

        this._labelsMesh.geometry.addSprite(
            this.getLabelPosition(dataIndex, position, distance),
            [rect.width * dpr, rect.height * dpr], coords,
            textAlign, textVerticalAlign,
            this.getLabelOffset(dataIndex, position, distance)
        );
    }, false, this);

    this._labelsMesh.material.set('uvScale', this._labelTextureSurface.getCoordsScale());

    // var canvas = this._labelTextureSurface.getTexture().image;
    // document.body.appendChild(canvas);
    // canvas.style.cssText = 'position:absolute;z-index: 1000';

    // Update image.
    this._labelTextureSurface.getZr().refreshImmediately();
    this._labelsMesh.geometry.convertToTypedArray();
    this._labelsMesh.geometry.dirty();
};

module.exports = LabelsBuilder;