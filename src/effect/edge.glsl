@export ecgl.edge
// http://williamchyr.com/2014/03/development-update-edge-detection/
// http://williamchyr.com/2014/05/revisiting-edge-detection/
// http://williamchyr.com/2015/08/edge-detection-shader-deep-dive-part-1-even-or-thinner-edges/
// http://www.thomaseichhorn.de/npr-sketch-shader-vvvv/

uniform sampler2D texture;

uniform sampler2D normalTexture;
uniform sampler2D depthTexture;

uniform mat4 projectionInv;

uniform vec2 textureSize;

uniform vec4 edgeColor: [0,0,0,0.8];

varying vec2 v_Texcoord;

vec3 packColor(vec2 coord) {
    float z = texture2D(depthTexture, coord).r * 2.0 - 1.0;
    vec4 p = vec4(v_Texcoord * 2.0 - 1.0, z, 1.0);
    vec4 p4 = projectionInv * p;

    return vec3(
        texture2D(normalTexture, coord).rg,
        -p4.z / p4.w / 5.0
    );
}

void main() {
    vec2 cc = v_Texcoord;
    // center
    vec3 center = packColor(cc);

    // PENDING Fade out in 100 - 500
    float size = clamp(1.0 - (center.z - 10.0) / 100.0, 0.0, 1.0) * 0.5;
    float dx = size / textureSize.x;
    float dy = size / textureSize.y;

    vec2 coord;
    // top left
    vec3 topLeft = packColor(cc+vec2(-dx, -dy));
    // top
    vec3 top = packColor(cc+vec2(0.0, -dy));
    // top right
    vec3 topRight = packColor(cc+vec2(dx, -dy));
    // left
    vec3 left = packColor(cc+vec2(-dx, 0.0));
    // right
    vec3 right = packColor(cc+vec2(dx, 0.0));
    // bottom left
    vec3 bottomLeft = packColor(cc+vec2(-dx, dy));
    // bottom
    vec3 bottom = packColor(cc+vec2(0.0, dy));
    // bottom right
    vec3 bottomRight = packColor(cc+vec2(dx, dy));

    vec3 v = -topLeft-2.0*top-topRight+bottomLeft+2.0*bottom+bottomRight;
    vec3 h = -bottomLeft-2.0*left-topLeft+bottomRight+2.0*right+topRight;

    float edge = sqrt(dot(h, h) + dot(v, v));

    edge = smoothstep(0.8, 1.0, edge);

    gl_FragColor = mix(texture2D(texture, v_Texcoord), vec4(edgeColor.rgb, 1.0), edgeColor.a * edge);
}
@end