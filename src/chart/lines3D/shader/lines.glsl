@export ecgl.lines.vertex

uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;

attribute vec3 position: POSITION;
attribute vec4 a_Color : COLOR;
varying vec4 v_Color;

void main()
{
    gl_Position = worldViewProjection * vec4(position, 1.0);
    v_Color = a_Color;
}

@end

@export ecgl.lines.fragment

uniform vec3 color : [1.0, 1.0, 1.0];
uniform float alpha : 1.0;

varying vec4 v_Color;

void main()
{
    gl_FragColor = vec4(color, alpha) * v_Color;
}
@end