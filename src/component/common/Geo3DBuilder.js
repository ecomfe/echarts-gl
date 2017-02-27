var graphicGL = require('../../util/graphicGL');
var Triangulation = require('../../util/Triangulation');
var glmatrix = require('qtek/lib/dep/glmatrix');
var vec3 = glmatrix.vec3;

function area(points) {
    // Signed polygon area
    var n = points.length / 2;
    if (n < 3) {
        return 0;
    }
    var area = 0;
    for (var i = (n - 1) * 2, j = 0; j < n * 2;) {
        var x0 = points[i];
        var y0 = points[i + 1];
        var x1 = points[j];
        var y1 = points[j + 1];
        i = j;
        j += 2;
        area += x0 * y1 - x1 * y0;
    }

    return area;
}

function reverse(points, stride) {
    var n = points.length / stride;
    for (var i = 0; i < Math.floor(n / 2); i++) {
        for (var j = 0; j < stride; j++) {
            var a = i * stride + j;
            var b = (n - i - 1) * stride + j;
            var tmp = points[a];
            points[a] = points[b];
            points[b] = tmp;
        }
    }

    return points;
}

function Geo3DBuilder() {

    this.rootNode = new graphicGL.Node();

    this._currentMap = '';

    // Cache triangulation result
    this._triangulationResults = {};

    this._triangulator = new Triangulation();

    this._boxWidth;
    this._boxHeight;
    this._boxDepth;

    this._shadersMap = ['lambert', 'realistic', 'color'].reduce(function (obj, shaderName) {
        obj[shaderName] = graphicGL.createShader('ecgl.' + shaderName);
        obj[shaderName].define('fragment', 'DOUBLE_SIDE');
        return obj;
    }, {});
}

Geo3DBuilder.prototype = {

    constructor: Geo3DBuilder,

    update: function (componentModel) {
        var geo3D = componentModel.coordinateSystem;

        if (geo3D.map !== this._currentMap) {

            this._triangulation(geo3D);
            this._currentMap = geo3D.map;

            // Reset meshes
            this._initMeshes(componentModel);

        }
        var bevelSize = componentModel.get('bevelSize');
        var bevelSegments = componentModel.get('bevelSmoothness');

        for (var i = 0; i < geo3D.regions.length; i++) {
            var region = geo3D.regions[i];
            var mesh = this._meshesMap[region.name];
            this._updateGeometry(mesh.geometry, geo3D, region, bevelSize, bevelSegments);
        }
    },

    _initMeshes: function (componentModel) {
        this.rootNode.removeAll();

        var geo3D = componentModel.coordinateSystem;
        var meshesMap = {};
        var shader = this._getShader(componentModel.get('shading'));

        geo3D.regions.forEach(function (region) {
            meshesMap[region.name] = new graphicGL.Mesh({
                material: new graphicGL.Material({
                    shader: shader
                }),
                culling: false,
                geometry: new graphicGL.Geometry()
            });
            this.rootNode.add(meshesMap[region.name]);
        }, this);

        this._meshesMap = meshesMap;
    },

    _getShader: function (shading) {
        var shader = this._shadersMap[shading];
        if (!shader) {
            if (__DEV__) {
                console.warn('Unkonw shading ' + shading);
            }
            // Default use lambert shader.
            shader = this._shadersMap.lambert;
        }
        return shader;
    },

    _triangulation: function (geo3D) {
        this._triangulationResults = {};
        var triangulator = this._triangulator;
        geo3D.regions.forEach(function (region) {
            var polygons = [];
            for (var i = 0; i < region.geometries.length; i++) {
                // TODO interior hole
                var exterior = region.geometries[i].exterior;
                var interiors = region.geometries[i].interiors;
                var points = [];
                var holes = [];
                if (exterior.length < 3) {
                    continue;
                }
                var offset = 0;
                for (var j = 0; j < exterior.length; j++) {
                    var p = exterior[j];
                    points[offset++] = p[0];
                    points[offset++] = p[1];
                }
                if (area(points) > 0) {
                    reverse(points, 2);
                }

                for (var j = 0; j < interiors.length; j++) {
                    if (interiors[j].length.length < 3) {
                        continue;
                    }
                    var holePoints = [];
                    for (var k = 0; k < interiors[j].length; k++) {
                        var p = interiors[j][k];
                        holePoints.push(p[0]);
                        holePoints.push(p[1]);
                    }
                    // hole needs opposite direction
                    if (area(holePoints) < 0) {
                        reverse(holePoints, 2);
                    }
                    holes.push(holePoints);
                }

                triangulator.triangulate(points, holes);
                points = triangulator.points;

                var points3 = new Float32Array(points.length / 2 * 3);
                var pos = [];
                var min = [Infinity, Infinity, Infinity];
                var max = [-Infinity, -Infinity, -Infinity];
                var off3 = 0;
                for (var j = 0; j < points.length;) {
                    pos[0] = points[j++];
                    pos[1] = 0;
                    pos[2] = points[j++];
                    vec3.transformMat4(pos, pos, geo3D.transform);
                    vec3.min(min, min, pos);
                    vec3.max(max, max, pos);
                    points3[off3++] = pos[0];
                    points3[off3++] = pos[1];
                    points3[off3++] = pos[2];
                }
                polygons.push({
                    points: points3,
                    min: min,
                    max: max,
                    indices: triangulator.triangles
                });
            }
            this._triangulationResults[region.name] = polygons;
        }, this);
    },

    _updateGeometry: function (geometry, geo3D, region, bevelSize, bevelSegments) {
        // if (!(bevelSize > 0)) {
        //     bevelSegments = 0;
        // }
        // if (!(bevelSegments > 0)) {
        //     bevelSize = 0;
        // }
        bevelSegments = 0;
        bevelSize = 0;

        var faces = this.faces;
        var positionAttr = geometry.attributes.position;
        var normalAttr = geometry.attributes.normal;
        var polygons = this._triangulationResults[region.name];

        var sideVertexCount = 0;
        var sideFaceCount = 0;

        for (var i = 0; i < polygons.length; i++) {
            sideVertexCount += polygons[i].points.length / 3;
            sideFaceCount += polygons[i].indices.length / 3;
        }

        // var vertexCount = sideVertexCount * (bevelSegments * 4 + 4);
        // var faceCount = sideFaceCount * 2 + sideVertexCount * 2 * (bevelSegments * 2 + 1);
        var vertexCount = sideVertexCount * 2 + sideVertexCount * 4;
        var faceCount = sideFaceCount * 2 + sideVertexCount * 2;

        positionAttr.init(vertexCount);
        normalAttr.init(vertexCount);
        faces = geometry.faces = vertexCount > 0xffff ? new Uint32Array(faceCount * 3) : new Uint16Array(faceCount * 3);

        var vertexOffset = 0;
        var faceOffset = 0;

        var regionHeight = geo3D.size[1];

        bevelSize = Math.min(regionHeight / 2, bevelSize);

        function addVertices(polygon, y, insideOffset) {
            var nextPosition = [];
            var insidePosition = [];
            var normal = [];
            var a = [];
            var b = [];
            var points = polygon.points;

            var pointsLen = points.length;
            var prevPosition = [points[pointsLen - 3], y, points[pointsLen - 1]];
            var currentPosition = [points[0], y, points[2]];

            for (var k = 3; k <= pointsLen; k += 3) {
                nextPosition[0] = points[(k) % pointsLen];
                nextPosition[1] = y;
                nextPosition[2] = points[(k + 2) % pointsLen];

                vec3.sub(a, prevPosition, currentPosition);
                vec3.sub(b, nextPosition, currentPosition);
                vec3.add(normal, a, b);
                vec3.normalize(normal, normal);
                vec3.scaleAndAdd(insidePosition, currentPosition, normal, insideOffset);

                positionAttr.set(vertexOffset++, insidePosition);

                vec3.copy(prevPosition, currentPosition);
                vec3.copy(currentPosition, nextPosition);
            }
        }

        function buildTopBottom(polygon, y, insideOffset) {

            var startVertexOffset = vertexOffset;

            addVertices(polygon, y, insideOffset);

            var indices = polygon.indices;
            for (var k = 0; k < indices.length; k++) {
                faces[faceOffset * 3 + k] = indices[k] + startVertexOffset;
            }
            faceOffset += indices.length / 3;
        }

        // var quadToTriangle = [0, 3, 1, 1, 3, 2];
        // var quad = [];
        // function buildSide(polygon, y0, y1, insideOffset0, insideOffset1) {
        //     var startVertexOffset = vertexOffset;
        //     addVertices(polygon, y1, insideOffset1);
        //     addVertices(polygon, y0, insideOffset0);

        //     var ringVertexCount = polygon.points.length / 3;
        //     for (var i = 0; i < ringVertexCount; i++) {
        //         var next = (i + 1) % ringVertexCount;
        //         quad[0] = i;
        //         quad[1] = next;
        //         quad[2] = ringVertexCount + next;
        //         quad[3] = ringVertexCount + i;

        //         for (var k = 0; k < 6; k++) {
        //             faces[faceOffset * 3 + k] = quad[quadToTriangle[k]] + startVertexOffset;
        //         }
        //         faceOffset += 2;
        //     }
        // }
        var normalTop = [0, 1, 0];
        var normalBottom = [0, -1, 0];
        for (var p = 0; p < polygons.length; p++) {
            var startVertexOffset = vertexOffset;
            var polygon = polygons[p];
            // BOTTOM
            buildTopBottom(polygon, 0, bevelSize);
            // TOP
            buildTopBottom(polygon, regionHeight, bevelSize);
            // bevels
            // TODO. In detailed polygon lines after bevel will cross
            // for (var k = 0; k < bevelSegments; k++) {
            //     var curr = k / bevelSegments * Math.PI / 2;
            //     var next = (k + 1) / bevelSegments * Math.PI / 2;
            //     var delta0 = Math.sin(curr) * bevelSize;
            //     var delta1 = Math.sin(next) * bevelSize;
            //     var insideOffset0 = Math.cos(curr) * bevelSize;
            //     var insideOffset1 = Math.cos(next) * bevelSize;

            //     buildSide(
            //         polygon,
            //         delta0, delta1,
            //         insideOffset0, insideOffset1
            //     );

            //     buildSide(
            //         polygon,
            //         regionHeight - delta0, regionHeight - delta1,
            //         insideOffset0, insideOffset1
            //     );
            // }
            // Side
            // buildSide(polygon, bevelSize, regionHeight - bevelSize, 0, 0);


            var ringVertexCount = polygon.points.length / 3;
            for (var v = 0; v < ringVertexCount; v++) {
                normalAttr.set(startVertexOffset + v, normalBottom);
                normalAttr.set(startVertexOffset + v + ringVertexCount, normalTop);
            }

            var quadToTriangle = [0, 3, 1, 1, 3, 2];

            var quadPos = [[], [], [], []];
            var a = [];
            var b = [];
            var normal = [];
            for (var v = 0; v < ringVertexCount; v++) {
                var next = (v + 1) % ringVertexCount;

                // 0----1
                // 3----2
                for (var k = 0; k < 4; k++) {
                    var idx3 = ((k === 0 || k === 3) ? v : next) * 3;
                    quadPos[k][0] = polygon.points[idx3];
                    quadPos[k][1] = k > 1 ? regionHeight : 0;
                    quadPos[k][2] = polygon.points[idx3 + 2];
                    positionAttr.set(vertexOffset + k, quadPos[k]);
                }
                vec3.sub(a, quadPos[1], quadPos[0]);
                vec3.sub(b, quadPos[3], quadPos[0]);
                vec3.cross(normal, a, b);
                vec3.normalize(normal, normal);

                for (var k = 0; k < 4; k++) {
                    normalAttr.set(vertexOffset + k, normal);
                }

                for (var k = 0; k < 6; k++) {
                    faces[faceOffset * 3 + k] = quadToTriangle[k] + vertexOffset;
                }

                vertexOffset += 4;
                faceOffset += 2;
            }
        }
        // geometry.generateVertexNormals();
        geometry.updateBoundingBox();
    }
};

module.exports = Geo3DBuilder;