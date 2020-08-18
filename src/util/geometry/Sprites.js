/**
 * Geometry collecting sprites
 *
 * @module echarts-gl/util/geometry/Sprites
 * @author Yi Shen(https://github.com/pissang)
 */
import * as echarts from 'echarts/lib/echarts';
import Geometry from 'claygl/src/Geometry';
import dynamicConvertMixin from './dynamicConvertMixin';

var squareTriangles = [
    0, 1, 2, 0, 2, 3
];

var SpritesGeometry = Geometry.extend(function () {
    return {
        attributes: {
            position: new Geometry.Attribute('position', 'float', 3, 'POSITION'),
            texcoord: new Geometry.Attribute('texcoord', 'float', 2, 'TEXCOORD_0'),
            offset: new Geometry.Attribute('offset', 'float', 2),
            color: new Geometry.Attribute('color', 'float', 4, 'COLOR')
        }
    };
}, {
    resetOffset: function () {
        this._vertexOffset = 0;
        this._faceOffset = 0;
    },
    setSpriteCount: function (spriteCount) {
        this._spriteCount = spriteCount;

        var vertexCount = spriteCount * 4;
        var triangleCount = spriteCount * 2;

        if (this.vertexCount !== vertexCount) {
            this.attributes.position.init(vertexCount);
            this.attributes.offset.init(vertexCount);
            this.attributes.color.init(vertexCount);
        }
        if (this.triangleCount !== triangleCount) {
            this.indices = vertexCount > 0xffff ? new Uint32Array(triangleCount * 3) : new Uint16Array(triangleCount * 3);
        }
    },

    setSpriteAlign: function (spriteOffset, size, align, verticalAlign, margin) {
        if (align == null) {
            align = 'left';
        }
        if (verticalAlign == null) {
            verticalAlign = 'top';
        }

        var leftOffset, topOffset, rightOffset, bottomOffset;
        margin = margin || 0;
        switch (align) {
            case 'left':
                leftOffset = margin;
                rightOffset = size[0] + margin;
                break;
            case 'center':
            case 'middle':
                leftOffset = -size[0] / 2;
                rightOffset = size[0] / 2;
                break;
            case 'right':
                leftOffset = -size[0] - margin;
                rightOffset = -margin;
                break;
        }
        switch (verticalAlign) {
            case 'bottom':
                topOffset = margin;
                bottomOffset = size[1] + margin;
                break;
            case 'middle':
                topOffset = -size[1] / 2;
                bottomOffset = size[1] / 2;
                break;
            case 'top':
                topOffset = -size[1] - margin;
                bottomOffset = -margin;
                break;
        }
        // 3----2
        // 0----1
        var vertexOffset = spriteOffset * 4;
        var offsetAttr = this.attributes.offset;
        offsetAttr.set(vertexOffset, [leftOffset, bottomOffset]);
        offsetAttr.set(vertexOffset + 1, [rightOffset, bottomOffset]);
        offsetAttr.set(vertexOffset + 2, [rightOffset, topOffset]);
        offsetAttr.set(vertexOffset + 3, [leftOffset, topOffset]);
    },
    /**
     * Add sprite
     * @param {Array.<number>} position
     * @param {Array.<number>} size [width, height]
     * @param {Array.<Array>} coords [leftBottom, rightTop]
     * @param {string} [align='left'] 'left' 'center' 'right'
     * @param {string} [verticalAlign='top'] 'top' 'middle' 'bottom'
     * @param {number} [screenMargin=0]
     */
    addSprite: function (position, size, coords, align, verticalAlign, screenMargin) {
        var vertexOffset = this._vertexOffset;
        this.setSprite(
            this._vertexOffset / 4, position, size, coords, align, verticalAlign, screenMargin
        )
        for (var i = 0; i < squareTriangles.length; i++) {
            this.indices[this._faceOffset * 3 + i] = squareTriangles[i] + vertexOffset;
        }
        this._faceOffset += 2;
        this._vertexOffset += 4;

        return vertexOffset / 4;
    },

    setSprite: function (spriteOffset, position, size, coords, align, verticalAlign, screenMargin) {
        var vertexOffset = spriteOffset * 4;

        var attributes = this.attributes;
        for (var i = 0; i < 4; i++) {
            attributes.position.set(vertexOffset + i, position);
        }
        // 3----2
        // 0----1
        var texcoordAttr = attributes.texcoord;

        texcoordAttr.set(vertexOffset, [coords[0][0], coords[0][1]]);
        texcoordAttr.set(vertexOffset + 1, [coords[1][0], coords[0][1]]);
        texcoordAttr.set(vertexOffset + 2, [coords[1][0], coords[1][1]]);
        texcoordAttr.set(vertexOffset + 3, [coords[0][0], coords[1][1]]);

        this.setSpriteAlign(spriteOffset, size, align, verticalAlign, screenMargin);
    }
});

echarts.util.defaults(SpritesGeometry.prototype, dynamicConvertMixin);

export default SpritesGeometry;