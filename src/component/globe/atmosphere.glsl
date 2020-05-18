@export ecgl.atmosphere.vertex
attribute vec3 position: POSITION;
attribute vec3 normal : NORMAL;
uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;
uniform mat4 normalMatrix : WORLDINVERSETRANSPOSE;
uniform mat4 world : WORLD;
uniform mat4 modelViewMatrix : WORLDVIEWINVERSE;

varying vec3 v_Normal;
varying vec3 v_PositionNormal;

void main() {
    v_Normal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
    v_PositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
    gl_Position = worldViewProjection * vec4(position, 1.0);
}
@end


@export ecgl.atmosphere.fragment
uniform float glowPower;
uniform vec3 glowColor;

varying vec3 v_Normal;
varying vec3 v_PositionNormal;

void main() {
    float intensity = pow(1.0 - 1.0 * dot(v_Normal, v_PositionNormal), glowPower);
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0) * intensity;
}
@end