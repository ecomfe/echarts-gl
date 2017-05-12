var echarts = require('echarts/lib/echarts');
var glmatrix = require('qtek/lib/dep/glmatrix');
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

function mapCoordElevation(coord, elevationRange, distance, isDistanceRange) {
    coord[2] = isDistanceRange
        ? echarts.number.linearMap(coord[2], elevationRange, distance) : distance;
}

function getCubicPointsOnGlobe(coords, coordSys, elevationRange, distanceToGlobe, isDistanceRange) {
    var globeRadius = coordSys.radius;

    vec2.copy(coord0, coords[0]);
    vec2.copy(coord1, coords[1]);
    // PENDING, handle NaN elevation
    mapCoordElevation(coord0, elevationRange, distanceToGlobe, isDistanceRange);
    mapCoordElevation(coord1, elevationRange, distanceToGlobe, isDistanceRange);

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
    var len = ((coord0[2] + coord1[2]) / 2 + globeRadius - projDist) / cosTheta * 2;

    vec3.scaleAndAdd(p1, p0, p1, len);
    vec3.scaleAndAdd(p2, p3, p2, len);

    return pts;
}

function getPolylinePoints(coords, coordSys, elevationRange, distance, isDistanceRange) {
    var pts = new Float32Array(coords.length * 3);
    var off = 0;
    var pt = [];
    for (var i = 0; i < coords.length; i++) {
        vec3.copy(coord0, coords[i]);
        mapCoordElevation(coord0, elevationRange, distance, isDistanceRange);
        coordSys.dataToPoint(coord0, pt);
        pts[off++] = pt[0];
        pts[off++] = pt[1];
        pts[off++] = pt[2];
    }
    return pts;
}

function prepareCoords(data, isDistanceRange) {
    var coordsList = [];
    var elevationRange = [Infinity, -Infinity];

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

        if (isDistanceRange) {
            for (var i = 0; i < coords.length; i++) {
                var elevation = coords[i][2];
                if (elevation != null) {
                    elevationRange[0] = Math.min(elevationRange[0], elevation);
                    elevationRange[1] = Math.max(elevationRange[1], elevation);
                }
            }
        }
    });

    return {
        coordsList: coordsList,
        elevationRange: elevationRange
    };
}

function layoutGlobe(seriesModel, coordSys) {
    var data = seriesModel.getData();
    var isPolyline = seriesModel.get('polyline');

    var distanceToGlobe = seriesModel.get('distanceToGlobe') || 0;

    data.setLayout('lineType', isPolyline ? 'polyline' : 'cubicBezier');

    var isDistanceRange = echarts.util.isArray(distanceToGlobe);

    var res = prepareCoords(data, isDistanceRange);

    data.each(function (idx) {
        var coords = res.coordsList[idx];
        var getPointsMethod = isPolyline ? getPolylinePoints : getCubicPointsOnGlobe;
        data.setItemLayout(idx, getPointsMethod(
            coords, coordSys, res.elevationRange, distanceToGlobe, isDistanceRange
        ));
    });
}

function layoutGeo3D(seriesModel, coordSys) {
    var data = seriesModel.getData();
    var isPolyline = seriesModel.get('polyline');

    var distanceToGeo3D = seriesModel.get('distanceToGeo3D');
    var isDistanceRange = echarts.util.isArray(distanceToGeo3D);

    var res = prepareCoords(data, isDistanceRange);

    data.setLayout('lineType', isPolyline ? 'polyline' : 'cubicBezier');

    var normal = [];

    // TODO, different region may have different height.
    // var regionHeight = coordSys.size[1];

    data.each(function (idx) {
        var pts = [];

        var coords = res.coordsList[idx];

        if (isPolyline) {
            data.setItemLayout(idx, getPolylinePoints(
                coords, coordSys, res.elevationRange, distanceToGeo3D, isDistanceRange
            ));
        }
        else {
            var p0 = pts[0] = vec3.create();
            var p1 = pts[1] = vec3.create();
            var p2 = pts[2] = vec3.create();
            var p3 = pts[3] = vec3.create();

            coordSys.dataToPoint(coords[0], p0);
            coordSys.dataToPoint(coords[1], p3);

            var len = vec3.dist(p0, p3);
            vec3.lerp(p1, p0, p3, 0.3);
            vec3.lerp(p2, p0, p3, 0.3);
            vec3.set(normal, 0, 1, 0);
            vec3.scaleAndAdd(p1, p1, normal, Math.min(len * 0.1, 10));
            vec3.scaleAndAdd(p2, p2, normal, Math.min(len * 0.1, 10));

            data.setItemLayout(idx, pts);
        }
    });
}

echarts.registerLayout(function (ecModel, api) {
    ecModel.eachSeriesByType('lines3D', function (seriesModel) {
        var coordSys = seriesModel.coordinateSystem;
        if (coordSys.type === 'globe') {
            layoutGlobe(seriesModel, coordSys);
        }
        else if (coordSys.type === 'geo3D') {
            layoutGeo3D(seriesModel, coordSys);
        }
    });
});