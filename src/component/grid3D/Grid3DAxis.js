var echarts = require('echarts/lib/echarts');
var graphicGL = require('../../util/graphicGL');
var Lines3DGeometry = require('../../util/geometry/Lines3D');
var retrieve = require('../../util/retrieve');
var LabelsMesh = require('../../util/mesh/LabelsMesh');
var firstNotNull = retrieve.firstNotNull;
var ifIgnoreOnTick = require('./ifIgnoreOnTick');

var dimIndicesMap = {
    // Left to right
    x: 0,
    // Far to near
    y: 2,
    // Bottom to up
    z: 1
};

function Grid3DAxis(dim, linesMaterial) {
    var linesMesh = new graphicGL.Mesh({
        geometry: new Lines3DGeometry({ useNativeLine: false }),
        material: linesMaterial,
        castShadow: false,
        ignorePicking: true, renderOrder: 2
    });
    var axisLabelsMesh = new LabelsMesh();
    axisLabelsMesh.material.depthMask = false;

    var rootNode = new graphicGL.Node();
    rootNode.add(linesMesh);
    rootNode.add(axisLabelsMesh);

    this.rootNode = rootNode;
    this.dim = dim;

    this.linesMesh = linesMesh;
    this.labelsMesh = axisLabelsMesh;
    this.axisLineCoords = null;
    this.labelElements = [];
}

var otherDim = {
    x: 'y', y: 'x', z: 'y'
};
Grid3DAxis.prototype.update = function (
    grid3DModel, labelIntervalFuncs, axisLabelSurface, api
) {
    var cartesian = grid3DModel.coordinateSystem;
    var axis = cartesian.getAxis(this.dim);
    var labelIntervalFunc = labelIntervalFuncs[this.dim];

    var linesGeo = this.linesMesh.geometry;
    var labelsGeo = this.labelsMesh.geometry;
    linesGeo.convertToDynamicArray(true);
    labelsGeo.convertToDynamicArray(true);
    var axisModel = axis.model;
    var extent = axis.getExtent();

    var dpr = api.getDevicePixelRatio();
    var axisLineModel = axisModel.getModel('axisLine', grid3DModel.getModel('axisLine'));
    var axisTickModel = axisModel.getModel('axisTick', grid3DModel.getModel('axisTick'));
    var axisLabelModel = axisModel.getModel('axisLabel', grid3DModel.getModel('axisLabel'));
    var axisLineColor = axisLineModel.get('lineStyle.color');
    // Render axisLine
    if (axisLineModel.get('show')) {
        var axisLineStyleModel = axisLineModel.getModel('lineStyle');
        var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
        var idx = dimIndicesMap[axis.dim];
        p0[idx] = extent[0];
        p1[idx] = extent[1];

        // Save some useful info.
        this.axisLineCoords =[p0, p1];

        var color = graphicGL.parseColor(axisLineColor);
        var lineWidth = firstNotNull(axisLineStyleModel.get('width'), 1.0);
        var opacity = firstNotNull(axisLineStyleModel.get('opacity'), 1.0);
        color[3] *= opacity;
        linesGeo.addLine(p0, p1, color, lineWidth * dpr);
    }
    // Render axis ticksCoords
    if (axisTickModel.get('show')) {
        var lineStyleModel = axisTickModel.getModel('lineStyle');
        var lineColor = graphicGL.parseColor(
            firstNotNull(lineStyleModel.get('color'), axisLineColor)
        );
        var lineWidth = firstNotNull(lineStyleModel.get('width'), 1.0);
        lineColor[3] *= firstNotNull(lineStyleModel.get('opacity'), 1.0);
        var ticksCoords = axis.getTicksCoords();
        // TODO Automatic interval
        var intervalFunc = axisTickModel.get('interval');
        if (intervalFunc == null || intervalFunc === 'auto') {
            intervalFunc = labelIntervalFunc;
        }
        var tickLength = axisTickModel.get('length');

        for (var i = 0; i < ticksCoords.length; i++) {
            if (ifIgnoreOnTick(axis, i, intervalFunc)) {
                continue;
            }
            var tickCoord = ticksCoords[i];

            var p0 = [0, 0, 0]; var p1 = [0, 0, 0];
            var idx = dimIndicesMap[axis.dim];
            var otherIdx = dimIndicesMap[otherDim[axis.dim]];
            // 0 : x, 1 : y
            p0[idx] = p1[idx] = tickCoord;
            p1[otherIdx] = tickLength;

            linesGeo.addLine(p0, p1, lineColor, lineWidth * dpr);
        }
    }

    this.labelElements = [];
    var dpr = api.getDevicePixelRatio();
    if (axisLabelModel.get('show')) {
        var labelsCoords = axis.getLabelsCoords();
        var categoryData = axisModel.get('data');
        // TODO Automatic interval
        var intervalFunc = labelIntervalFunc;

        var labelMargin = axisLabelModel.get('margin');

        var labels = axisModel.getFormattedLabels();
        var ticks = axis.scale.getTicks();
        for (var i = 0; i < labelsCoords.length; i++) {
            if (ifIgnoreOnTick(axis, i, intervalFunc)) {
                continue;
            }
            var tickCoord = labelsCoords[i];

            var p = [0, 0, 0];
            var idx = dimIndicesMap[axis.dim];
            var otherIdx = dimIndicesMap[otherDim[axis.dim]];
            // 0 : x, 1 : y
            p[idx] = p[idx] = tickCoord;
            p[otherIdx] = labelMargin;

            var itemTextStyleModel = axisLabelModel;
            if (categoryData && categoryData[ticks[i]] && categoryData[ticks[i]].textStyle) {
                itemTextStyleModel = new echarts.Model(
                    categoryData[ticks[i]].textStyle, axisLabelModel, axisModel.ecModel
                );
            }
            var textColor = firstNotNull(itemTextStyleModel.get('color'), axisLineColor);

            var textEl = new echarts.graphic.Text();
            echarts.graphic.setTextStyle(textEl.style, itemTextStyleModel, {
                text: labels[i],
                textFill: typeof textColor === 'function'
                    ? textColor(
                        // (1) In category axis with data zoom, tick is not the original
                        // index of axis.data. So tick should not be exposed to user
                        // in category axis.
                        // (2) Compatible with previous version, which always returns labelStr.
                        // But in interval scale labelStr is like '223,445', which maked
                        // user repalce ','. So we modify it to return original val but remain
                        // it as 'string' to avoid error in replacing.
                        axis.type === 'category' ? labels[i] : axis.type === 'value' ? ticks[i] + '' : ticks[i],
                        i
                    )
                    : textColor,
                textVerticalAlign: 'top',
                textAlign: 'left'
            });
            var coords = axisLabelSurface.add(textEl);
            var rect = textEl.getBoundingRect();
            labelsGeo.addSprite(p, [rect.width * dpr, rect.height * dpr], coords);

            this.labelElements.push(textEl);
        }
    }

    if (axisModel.get('name')) {
        var nameTextStyleModel = axisModel.getModel('nameTextStyle');
        var p = [0, 0, 0];
        var idx = dimIndicesMap[axis.dim];
        var otherIdx = dimIndicesMap[otherDim[axis.dim]];
        var labelColor = firstNotNull(nameTextStyleModel.get('color'), axisLineColor);
        var strokeColor = nameTextStyleModel.get('borderColor');
        var lineWidth = nameTextStyleModel.get('borderWidth');
        // TODO start and end
        p[idx] = p[idx] = (extent[0] + extent[1]) / 2;
        p[otherIdx] = axisModel.get('nameGap');

        var textEl = new echarts.graphic.Text();
        echarts.graphic.setTextStyle(textEl.style, nameTextStyleModel, {
            text: axisModel.get('name'),
            textFill: labelColor,
            textStroke: strokeColor,
            lineWidth: lineWidth
        });
        var coords = axisLabelSurface.add(textEl);
        var rect = textEl.getBoundingRect();
        labelsGeo.addSprite(p, [rect.width * dpr, rect.height * dpr], coords);

        textEl.__idx = this.labelElements.length;
        this.nameLabelElement = textEl;
    }

    this.labelsMesh.material.set('textureAtlas', axisLabelSurface.getTexture());
    this.labelsMesh.material.set('uvScale', axisLabelSurface.getCoordsScale());

    linesGeo.convertToTypedArray();
    labelsGeo.convertToTypedArray();
};

Grid3DAxis.prototype.setSpriteAlign = function (textAlign, textVerticalAlign, api) {
    var dpr = api.getDevicePixelRatio();
    var labelGeo = this.labelsMesh.geometry;
    for (var i = 0; i < this.labelElements.length; i++) {
        var labelEl = this.labelElements[i];
        var rect = labelEl.getBoundingRect();

        labelGeo.setSpriteAlign(i, [rect.width * dpr, rect.height * dpr], textAlign, textVerticalAlign);
    }
    // name label
    var nameLabelEl = this.nameLabelElement;
    if (nameLabelEl) {
        var rect = nameLabelEl.getBoundingRect();
        labelGeo.setSpriteAlign(nameLabelEl.__idx, [rect.width * dpr, rect.height * dpr], textAlign, textVerticalAlign);
        labelGeo.dirty();
    }

    this.textAlign = textAlign;
    this.textVerticalAlign = textVerticalAlign;
};

module.exports = Grid3DAxis;