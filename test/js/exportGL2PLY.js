(function () {

    var CREDIT = 'comment ECharts v' + echarts.version + ' http://echarts.baidu.com/\n';

    function quantizeArr(out, arr, precision) {
        out[0] = Math.round(arr[0] * precision) / precision;
        out[1] = Math.round(arr[1] * precision) / precision;
        out[2] = Math.round(arr[2] * precision) / precision;
    }

    /**
     * @param {ECharts} echartsInstance
     * @param {Object} componentQuery
     * @param {string} componentQuery.mainType
     * @param {string} [componentQuery.subType]
     * @param {number} [componentQuery.index]
     * @param {string} [componentQuery.id]
     * @param {string} [componentQuery.name]
     * @param {Object} [opts]
     */
    echarts.exportGL2PLY = function (chartInstance, componentQuery, opts) {
        opts = opts || {};
        var componentModel = chartInstance.getModel().queryComponents(componentQuery)[0];
        if (!componentModel) {
            throw new Error('Unkown component.');
        }
        var coordSys = componentModel.coordinateSystem;
        var view = componentQuery.mainType === 'series'
            ? chartInstance.getViewOfSeriesModel(componentModel)
            : chartInstance.getViewOfComponentModel(componentModel);
        
        if (!view.__ecgl__) {
            throw new Error('exportGL2PLY only support GL components.');
        }

        var viewGL = (coordSys && coordSys.viewGL) || view.viewGL;
        var plyStr = 'ply\n'
            + 'format ascii 1.0\n'
            + CREDIT;

        var headerStr = '';
        var vertexStr = [];
        var faceStr = [];

        var vertexCount = 0;
        var triangleCount = 0;

        var needsNormal = false;
        var needsColor = false;
        var needsUv = false;
        viewGL.scene.traverse(function (mesh) {
            if (mesh.geometry && mesh.geometry.vertexCount) {
                var geometry = mesh.geometry;
                var colorAttr = geometry.attributes.color;
                var normalAttr = geometry.attributes.normal;
                var texcoordAttr = geometry.attributes.texcoord0;

                var hasUv = !!(texcoordAttr && texcoordAttr.value);
                var hasNormal = !!(normalAttr && normalAttr.value);
                var hasColor = !!(colorAttr && colorAttr.value);

                needsNormal = needsNormal || hasNormal;
                needsColor = needsColor || hasColor;
                needsUv = needsUv || hasUv;
            }
        });
        viewGL.scene.traverse(function (mesh) {
            if (mesh.geometry && mesh.geometry.vertexCount) {
                var geometry = mesh.geometry;
                var positionAttr = geometry.attributes.position;
                var colorAttr = geometry.attributes.color;
                var normalAttr = geometry.attributes.normal;
                var texcoordAttr = geometry.attributes.texcoord0;

                mesh.updateWorldTransform();
                var normalMat = mesh.worldTransform.clone().invert().transpose();

                var pos = new echarts.graphicGL.Vector3();
                var nor = new echarts.graphicGL.Vector3();
                var col = [];
                var uv = [];

                var hasUv = !!(texcoordAttr && texcoordAttr.value);
                var hasNormal = !!(normalAttr && normalAttr.value);
                var hasColor = !!(colorAttr && colorAttr.value);

                var tmp = [];
                for (var i = 0; i < geometry.vertexCount; i++) {
                    positionAttr.get(i, pos._array);

                    echarts.graphicGL.Vector3.transformMat4(pos, pos, mesh.worldTransform);

                    // PENDING
                    quantizeArr(tmp, pos._array, 1e5);
                    var vItem = tmp.join(' ');

                    if (needsNormal) {
                        if (hasNormal) {
                            normalAttr.get(i, nor._array);
                            echarts.graphicGL.Vector3.transformMat4(nor, nor, normalMat);
                            echarts.graphicGL.Vector3.normalize(nor, nor);
                            quantizeArr(tmp, nor._array, 1e3);
                        }
                        else {
                            tmp[0] = 0;
                            tmp[1] = 1;
                            tmp[2] = 0;
                        }
                        vItem += ' ' + tmp.join(' ');
                    }
                    if (needsColor) {
                        if (hasColor) {
                            colorAttr.get(i, col);
                            quantizeArr(col, col, 1e3);
                        }
                        else {
                            col[0] = 1;
                            col[1] = 1;
                            col[1] = 1;
                        }
                        vItem += ' ' + Math.round(col[0] * 255) + ' ' + Math.round(col[1] * 255) + ' ' + Math.round(col[2] * 255);
                    }
                    if (needsUv) {
                        if (hasUv) {
                            texcoordAttr.get(i, uv);
                        }
                        else {
                            uv[0] = 0;
                            uv[1] = 0;
                        }
                        vItem += ' ' + uv.join(' ');
                    }
                    vertexStr.push(vItem);
                }
                var indices = [];
                for (var i = 0; i < geometry.triangleCount; i++) {
                    geometry.getTriangleIndices(i, indices);
                    // Start from 1
                    for (var k = 0; k < 3; k++) {
                        indices[k] += vertexCount;
                    }

                    faceStr.push('3 ' + indices.join(' '));
                }

                vertexCount += geometry.vertexCount;
                triangleCount += geometry.triangleCount;
            }
        });

        headerStr += 'element vertex ' + vertexCount + '\n';
        headerStr += 'property float x\nproperty float y\nproperty float z\n';
        if (needsNormal) {
            headerStr += 'property float nx\nproperty float ny\nproperty float nz\n';
        }
        if (needsColor) {
            headerStr += 'property uchar red\nproperty uchar green\nproperty uchar blue\n';
        }
        if (needsUv) {
            headerStr += 'property float s\nproperty float t\n';
        }
        
        headerStr += 'element face ' + triangleCount + '\n';
        headerStr += 'property list uchar uint vertex_indices\nend_header\n';
        

        plyStr += headerStr;
        plyStr += vertexStr.join('\n') + '\n';
        plyStr += faceStr.join('\n');

        return plyStr;
    };
})();