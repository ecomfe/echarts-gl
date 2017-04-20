var control = new (require('../../src/util/OrbitControl'))();
var node = new (require('qtek/lib/Node'))();

control.setCamera(node);

for (var i = 0; i < 1000; i++) {
    var alpha = Math.round(Math.random() * 360 - 180);
    var beta = Math.round(Math.random() * 180 - 90);
    // var alpha = -91;
    // var beta = 30;

    control.setAlpha(alpha);
    control.setBeta(beta);
    alpha = control.getAlpha();
    beta = control.getBeta();

    control._updateTransform();
    control._decomposeTransform();

    if (Math.round(control.getAlpha()) !== Math.round(alpha)) {
        console.log(`Alpha should be ${alpha}, not ${control.getAlpha()}`);
        console.log(`Beta: ${beta}`)
    }
    if (Math.round(control.getBeta()) !== Math.round(beta)) {
        console.log(`Beta should be ${beta}, not ${control.getBeta()}`);
    }
}