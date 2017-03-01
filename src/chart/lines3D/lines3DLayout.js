var echarts = require('echarts/lib/echarts');
var glmatrix = require('qtek/lib/dep/glmatrix');
var vec3 = glmatrix.vec3;

function layoutGlobe(seriesModel, coordSys) {
    var data = seriesModel.getData();
    var isPolyline = seriesModel.get('polyline');

    var normal = vec3.create();
    var tangent = vec3.create();
    var bitangent = vec3.create();
    var halfVector = vec3.create();

    data.setLayout('lineType', isPolyline ? 'polyline' : 'cubicBezier');

    data.each(function (idx) {
        var itemModel = data.getItemModel(idx);
        var coords = (itemModel.option instanceof Array) ?
            itemModel.option : itemModel.getShallow('coords', true);

        if (!(coords instanceof Array && coords.length > 0 && coords[0] instanceof Array)) {
            throw new Error('Invalid coords ' + JSON.stringify(coords) + '. Lines must have 2d coords array in data item.');
        }

        var pts = [];
        // if (isPolyline) {

        // }
        // else {
            var p0 = pts[0] = vec3.create();
            var p1 = pts[1] = vec3.create();
            var p2 = pts[2] = vec3.create();
            var p3 = pts[3] = vec3.create();
            coordSys.dataToPoint(coords[0], p0);
            coordSys.dataToPoint(coords[1], p3);
            // Get p1
            vec3.normalize(normal, p0);
            // TODO p0-p3 is parallel with normal
            vec3.sub(tangent, p3, p0);
            vec3.normalize(tangent, tangent);
            vec3.cross(bitangent, tangent, normal);
            vec3.normalize(bitangent, bitangent);
            vec3.cross(tangent, normal, bitangent);
            // p1 is half vector of p0 and tangent on p0
            vec3.add(p1, normal, tangent);
            vec3.normalize(p1, p1);

            // Get p2
            vec3.normalize(normal, p3);
            vec3.sub(tangent, p0, p3);
            vec3.normalize(tangent, tangent);
            vec3.cross(bitangent, tangent, normal);
            vec3.normalize(bitangent, bitangent);
            vec3.cross(tangent, normal, bitangent);
            // p2 is half vector of p3 and tangent on p3
            vec3.add(p2, normal, tangent);
            vec3.normalize(p2, p2);

            // Project distance of p0 on halfVector
            vec3.add(halfVector, p0, p3);
            vec3.normalize(halfVector, halfVector);
            var projDist = vec3.dot(p0, halfVector);
            // Angle of halfVector and p1
            var cosTheta = vec3.dot(halfVector, p1);
            var len = (coordSys.radius - projDist) / cosTheta * 2;

            vec3.scaleAndAdd(p1, p0, p1, len);
            vec3.scaleAndAdd(p2, p3, p2, len);
        // }

        data.setItemLayout(idx, pts);
    });
}

function layoutGeo3D(seriesModel, coordSys) {
    var data = seriesModel.getData();
    var isPolyline = seriesModel.get('polyline');

    data.setLayout('lineType', isPolyline ? 'polyline' : 'cubicBezier');

    var normal = [];

    // TODO, different region may have different height.
    // var regionHeight = coordSys.size[1];

    data.each(function (idx) {
        var itemModel = data.getItemModel(idx);
        var coords = (itemModel.option instanceof Array) ?
            itemModel.option : itemModel.getShallow('coords', true);

        if (!(coords instanceof Array && coords.length > 0 && coords[0] instanceof Array)) {
            throw new Error('Invalid coords ' + JSON.stringify(coords) + '. Lines must have 2d coords array in data item.');
        }

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
        vec3.set(normal, 0, 1, 0);
        vec3.scaleAndAdd(p1, p1, normal, Math.min(len * 0.1, 10));
        vec3.scaleAndAdd(p2, p2, normal, Math.min(len * 0.1, 10));

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
            layoutGeo3D(seriesModel, coordSys);
        }
    });
});