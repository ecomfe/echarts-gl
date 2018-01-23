import echarts from 'echarts/lib/echarts';
import glmatrix from 'claygl/src/dep/glmatrix';
var vec3 = glmatrix.vec3;
var vec2 = glmatrix.vec2;
var normalize = vec3.normalize;
var cross = vec3.cross;
var sub = vec3.sub;
var add = vec3.add;
var create = vec3.create;

var normal = create();
var tangent = create();
var bitangent = create();
var halfVector = create();

var coord0 = [];
var coord1 = [];

function getCubicPointsOnGlobe(coords, coordSys) {
    vec2.copy(coord0, coords[0]);
    vec2.copy(coord1, coords[1]);

    var pts = [];
    var p0 = pts[0] = create();
    var p1 = pts[1] = create();
    var p2 = pts[2] = create();
    var p3 = pts[3] = create();
    coordSys.dataToPoint(coord0, p0);
    coordSys.dataToPoint(coord1, p3);
    // Get p1
    normalize(normal, p0);
    // TODO p0-p3 is parallel with normal
    sub(tangent, p3, p0);
    normalize(tangent, tangent);
    cross(bitangent, tangent, normal);
    normalize(bitangent, bitangent);
    cross(tangent, normal, bitangent);
    // p1 is half vector of p0 and tangent on p0
    add(p1, normal, tangent);
    normalize(p1, p1);

    // Get p2
    normalize(normal, p3);
    sub(tangent, p0, p3);
    normalize(tangent, tangent);
    cross(bitangent, tangent, normal);
    normalize(bitangent, bitangent);
    cross(tangent, normal, bitangent);
    // p2 is half vector of p3 and tangent on p3
    add(p2, normal, tangent);
    normalize(p2, p2);

    // Project distance of p0 on halfVector
    add(halfVector, p0, p3);
    normalize(halfVector, halfVector);
    var projDist = vec3.dot(p0, halfVector);
    // Angle of halfVector and p1
    var cosTheta = vec3.dot(halfVector, p1);

    var len = (Math.max(vec3.len(p0), vec3.len(p3)) - projDist) / cosTheta * 2;

    vec3.scaleAndAdd(p1, p0, p1, len);
    vec3.scaleAndAdd(p2, p3, p2, len);

    return pts;
}

function getCubicPointsOnPlane(coords, coordSys, up) {
    var pts = [];
    var p0 = pts[0] = vec3.create();
    var p1 = pts[1] = vec3.create();
    var p2 = pts[2] = vec3.create();
    var p3 = pts[3] = vec3.create();

    coordSys.dataToPoint(coords[0], p0);
    coordSys.dataToPoint(coords[1], p3);

    var len = vec3.dist(p0, p3);
    vec3.lerp(p1, p0, p3, 0.3);
    vec3.lerp(p2, p0, p3, 0.3);

    vec3.scaleAndAdd(p1, p1, up, Math.min(len * 0.1, 10));
    vec3.scaleAndAdd(p2, p2, up, Math.min(len * 0.1, 10));

    return pts;
}

function getPolylinePoints(coords, coordSys) {
    var pts = new Float32Array(coords.length * 3);
    var off = 0;
    var pt = [];
    for (var i = 0; i < coords.length; i++) {
        coordSys.dataToPoint(coords[i], pt);
        pts[off++] = pt[0];
        pts[off++] = pt[1];
        pts[off++] = pt[2];
    }
    return pts;
}

function prepareCoords(data) {
    var coordsList = [];

    data.each(function (idx) {
        var itemModel = data.getItemModel(idx);
        var coords = (itemModel.option instanceof Array) ?
            itemModel.option : itemModel.getShallow('coords', true);

        if (__DEV__) {
            if (!(coords instanceof Array && coords.length > 0 && coords[0] instanceof Array)) {
                throw new Error('Invalid coords ' + JSON.stringify(coords) + '. Lines must have 2d coords array in data item.');
            }
        }
        coordsList.push(coords);
    });

    return {
        coordsList: coordsList
    };
}

function layoutGlobe(seriesModel, coordSys) {
    var data = seriesModel.getData();
    var isPolyline = seriesModel.get('polyline');

    data.setLayout('lineType', isPolyline ? 'polyline' : 'cubicBezier');

    var res = prepareCoords(data);

    data.each(function (idx) {
        var coords = res.coordsList[idx];
        var getPointsMethod = isPolyline ? getPolylinePoints : getCubicPointsOnGlobe;
        data.setItemLayout(idx, getPointsMethod(coords, coordSys));
    });
}

function layoutOnPlane(seriesModel, coordSys, normal) {
    var data = seriesModel.getData();
    var isPolyline = seriesModel.get('polyline');

    var res = prepareCoords(data);

    data.setLayout('lineType', isPolyline ? 'polyline' : 'cubicBezier');

    data.each(function (idx) {
        var coords = res.coordsList[idx];
        var pts = isPolyline ? getPolylinePoints(coords, coordSys)
            : getCubicPointsOnPlane(coords, coordSys, normal);
        data.setItemLayout(idx, pts);
    });
}

echarts.registerLayout(function (ecModel, api) {
    ecModel.eachSeriesByType('lines3D', function (seriesModel) {
        var coordSys = seriesModel.coordinateSystem;
        if (coordSys.type === 'globe') {
            layoutGlobe(seriesModel, coordSys);
        }
        else if (coordSys.type === 'geo3D') {
            layoutOnPlane(seriesModel, coordSys, [0, 1, 0]);
        }
        else if (coordSys.type === 'mapbox3D' || coordSys.type === 'maptalks3D') {
            layoutOnPlane(seriesModel, coordSys, [0, 0, 1]);
        }
    });
});